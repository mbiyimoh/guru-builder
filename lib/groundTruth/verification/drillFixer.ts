/**
 * Ground Truth Module - Drill Fixer
 *
 * Uses GPT-4o to rewrite drills that failed verification.
 * Takes the engine's correct answer and top alternatives,
 * then updates the drill's correctAnswer, options, and feedback.
 */

import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import type {
  PhaseOrganizedDrillSeries,
  PhaseDrill
} from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema'
import type { DrillVerificationResult } from './drillVerifier'

/**
 * Result of fixing a single drill
 */
export interface DrillFixResult {
  drillId: string
  fixed: boolean
  originalAnswer: string
  newAnswer: string
  error?: string
}

/**
 * Result of fixing all failed drills
 */
export interface FixAllDrillsResult {
  fixedContent: PhaseOrganizedDrillSeries
  results: DrillFixResult[]
  summary: {
    totalAttempted: number
    successfullyFixed: number
    failedToFix: number
  }
}

/**
 * Schema for GPT-4o drill fix response
 */
const drillFixResponseSchema = z.object({
  correctAnswer: z.string().describe('The engine-verified best move'),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCorrect: z.boolean()
  })).describe('Updated options with correct isCorrect flags'),
  feedback: z.object({
    correct: z.string().describe('Feedback for selecting the correct (engine-best) move'),
    incorrect: z.string().describe('Feedback for selecting an incorrect move'),
    partialCredit: z.string().nullable().optional()
  })
})

type DrillFixResponse = z.infer<typeof drillFixResponseSchema>

/**
 * Create OpenAI client lazily to avoid build-time errors
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  return new OpenAI({ apiKey })
}

/**
 * Build the prompt for fixing a single drill
 */
function buildFixPrompt(
  drill: PhaseDrill,
  engineData: NonNullable<DrillVerificationResult['engineData']>
): string {
  const optionsText = drill.options
    ? drill.options.map(o => `- ${o.id}: "${o.text}" (isCorrect: ${o.isCorrect})`).join('\n')
    : '(no options provided)'

  return `You are fixing a backgammon drill that has an incorrect answer according to engine analysis.

## Original Drill

**Drill ID:** ${drill.drillId}
**Game Phase:** ${drill.gamePhase}
**Position ID:** ${drill.positionId}
**Primary Principle:** ${drill.primaryPrincipleId}

**Scenario:**
${drill.scenario}

**Question:**
${drill.question}

**Current Correct Answer:** ${drill.correctAnswer}

**Options:**
${optionsText}

**Current Feedback:**
- Correct: ${drill.feedback.correct}
- Incorrect: ${drill.feedback.incorrect}

## Engine Analysis

The ground truth engine (GNUBG) says the mathematically best move is:
- **Best Move:** ${engineData.bestMove} (equity: ${engineData.bestEquity.toFixed(4)})

**Top 3 Moves by Engine:**
${engineData.top3.map((m, i) => `${i + 1}. ${m.move} (equity: ${m.equity.toFixed(4)})`).join('\n')}

## Your Task

Rewrite the drill fields to use the engine's best move as the correct answer. You must:

1. **correctAnswer**: Set to "${engineData.bestMove}" (the engine's best move)

2. **options**: Update the options array so that:
   - The option matching "${engineData.bestMove}" has isCorrect: true
   - All other options have isCorrect: false
   - If no option matches the best move exactly, update the closest option's text to match
   - Keep all option IDs unchanged

3. **feedback.correct**: Rewrite to explain why "${engineData.bestMove}" is the best move based on the principle being practiced (${drill.primaryPrincipleId})

4. **feedback.incorrect**: Rewrite to explain common mistakes and why alternative moves are inferior

Keep the explanations focused on teaching the principle, not just stating the engine result.

Return ONLY the JSON object with the updated fields.`
}

/**
 * Fix a single drill using GPT-4o
 */
async function fixSingleDrill(
  drill: PhaseDrill,
  engineData: NonNullable<DrillVerificationResult['engineData']>,
  openai: OpenAI
): Promise<DrillFixResponse | null> {
  const prompt = buildFixPrompt(drill, engineData)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a backgammon teaching expert. You update drill content to ensure mathematically correct answers based on engine analysis. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: zodResponseFormat(drillFixResponseSchema, 'drill_fix'),
      temperature: 0.3 // Lower temperature for more consistent fixes
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error(`[DrillFixer] No content in GPT response for drill ${drill.drillId}`)
      return null
    }

    const parsed = JSON.parse(content) as DrillFixResponse
    return parsed
  } catch (error) {
    console.error(`[DrillFixer] Error fixing drill ${drill.drillId}:`, error)
    return null
  }
}

/**
 * Apply a fix to a drill in the content structure
 */
function applyFixToDrill(drill: PhaseDrill, fix: DrillFixResponse): PhaseDrill {
  return {
    ...drill,
    correctAnswer: fix.correctAnswer,
    options: fix.options,
    feedback: {
      ...drill.feedback,
      correct: fix.feedback.correct,
      incorrect: fix.feedback.incorrect,
      partialCredit: fix.feedback.partialCredit ?? drill.feedback.partialCredit
    }
  }
}

/**
 * Find and update a drill in the phase-organized structure
 */
function updateDrillInContent(
  content: PhaseOrganizedDrillSeries,
  drillId: string,
  updater: (drill: PhaseDrill) => PhaseDrill
): PhaseOrganizedDrillSeries {
  return {
    ...content,
    phases: content.phases.map(phase => ({
      ...phase,
      principleGroups: phase.principleGroups.map(group => ({
        ...group,
        drills: group.drills.map(drill =>
          drill.drillId === drillId ? updater(drill) : drill
        )
      }))
    }))
  }
}

/**
 * Find a drill by ID in the content structure
 */
function findDrillById(content: PhaseOrganizedDrillSeries, drillId: string): PhaseDrill | null {
  for (const phase of content.phases) {
    for (const group of phase.principleGroups) {
      for (const drill of group.drills) {
        if (drill.drillId === drillId) {
          return drill
        }
      }
    }
  }
  return null
}

/**
 * Fix all failed drills using GPT-4o
 *
 * Takes the content and failed drill results, then uses GPT-4o
 * to rewrite each failed drill with the engine's correct answer.
 *
 * @param content - Original drill series content
 * @param failedDrills - Verification results for failed drills (with engineData)
 * @returns Updated content and fix results
 */
export async function fixFailedDrills(
  content: PhaseOrganizedDrillSeries,
  failedDrills: DrillVerificationResult[]
): Promise<FixAllDrillsResult> {
  const openai = getOpenAIClient()
  const results: DrillFixResult[] = []
  let fixedContent = { ...content }

  console.log(`[DrillFixer] Attempting to fix ${failedDrills.length} failed drills...`)

  for (const failedDrill of failedDrills) {
    // Skip if no engine data (shouldn't happen, but defensive)
    if (!failedDrill.engineData) {
      results.push({
        drillId: failedDrill.drillId,
        fixed: false,
        originalAnswer: failedDrill.claimedMove,
        newAnswer: failedDrill.claimedMove,
        error: 'No engine data available for fixing'
      })
      continue
    }

    // Find the actual drill in content
    const drill = findDrillById(fixedContent, failedDrill.drillId)
    if (!drill) {
      results.push({
        drillId: failedDrill.drillId,
        fixed: false,
        originalAnswer: failedDrill.claimedMove,
        newAnswer: failedDrill.claimedMove,
        error: 'Drill not found in content'
      })
      continue
    }

    // Fix the drill using GPT-4o
    const fix = await fixSingleDrill(drill, failedDrill.engineData, openai)

    if (fix) {
      // Apply the fix to content
      fixedContent = updateDrillInContent(fixedContent, failedDrill.drillId, (d) =>
        applyFixToDrill(d, fix)
      )

      results.push({
        drillId: failedDrill.drillId,
        fixed: true,
        originalAnswer: failedDrill.claimedMove,
        newAnswer: fix.correctAnswer
      })

      console.log(`[DrillFixer] Fixed drill ${failedDrill.drillId}: "${failedDrill.claimedMove}" -> "${fix.correctAnswer}"`)
    } else {
      results.push({
        drillId: failedDrill.drillId,
        fixed: false,
        originalAnswer: failedDrill.claimedMove,
        newAnswer: failedDrill.claimedMove,
        error: 'GPT-4o failed to generate fix'
      })
    }
  }

  const successCount = results.filter(r => r.fixed).length
  const failCount = results.filter(r => !r.fixed).length

  console.log(`[DrillFixer] Fix complete: ${successCount} fixed, ${failCount} failed`)

  return {
    fixedContent,
    results,
    summary: {
      totalAttempted: failedDrills.length,
      successfullyFixed: successCount,
      failedToFix: failCount
    }
  }
}
