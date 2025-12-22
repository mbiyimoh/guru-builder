/**
 * Drill Designer Generator
 *
 * Generates deliberate practice drills from mental model and curriculum using GPT-4o.
 * Requires both mental model and curriculum as dependencies.
 */

import { zodResponseFormat } from 'openai/helpers/zod'
import { phaseOrganizedDrillSeriesSchema, type PhaseOrganizedDrillSeries } from '../schemas/phaseOrganizedDrillSchema'
import type { MentalModelOutput } from '../schemas/mentalModelSchema'
import type { CurriculumOutput } from '../schemas/curriculumSchema'
import { buildDrillDesignerPrompt } from '../prompts/drillDesignerPrompt'
import { CREATIVE_TEACHING_SYSTEM_PROMPT } from '../prompts/creativeSystemPrompt'
import { composeCorpusSummary, computeCorpusHash } from '../corpusHasher'
import type { GeneratorOptions, GenerationResult, DrillGenerationConfig } from '../types'
import { resolveGroundTruthConfig } from '@/lib/groundTruth/config'
import { generateDrillSeriesWithGroundTruth } from '@/lib/groundTruth/generatorWithVerification'
import { buildProfilePromptBlock } from '@/lib/guruProfile/promptFormatter'
import type { SeededPositionsByPhase } from '@/lib/positionLibrary'
import { validateDrillOutput, validateLegacyDrillOutput, buildRetryFeedback } from './drillValidation'

/**
 * Check if option matches the correct answer.
 * Uses case-insensitive, trimmed comparison for robustness.
 */
function isCorrectOption(
  optText: string,
  optId: string,
  correctAnswer: string
): boolean {
  const normalizedCorrect = correctAnswer.trim().toLowerCase()
  const normalizedText = optText.trim().toLowerCase()
  const normalizedId = optId.toLowerCase()

  return normalizedText === normalizedCorrect || normalizedId === normalizedCorrect
}

/**
 * Normalize drill options from string array to object array.
 * GPT-4o sometimes returns options as ["text1", "text2"] instead of [{id, text, isCorrect}]
 *
 * @param options - Raw options from GPT response
 * @param correctAnswer - The correct answer to identify which option is correct
 * @returns Normalized options array with proper object structure
 */
function normalizeOptions(
  options: unknown[],
  correctAnswer: string
): Array<{ id: string; text: string; isCorrect: boolean }> {
  return options.map((opt, index) => {
    const defaultId = `opt-${String.fromCharCode(97 + index)}` // opt-a, opt-b, opt-c

    // Already proper object format - pass through unchanged
    if (typeof opt === 'object' && opt !== null && 'id' in opt && 'text' in opt && 'isCorrect' in opt) {
      return opt as { id: string; text: string; isCorrect: boolean }
    }

    // String format - convert to object
    if (typeof opt === 'string') {
      const text = opt.trim()
      return {
        id: defaultId,
        text,
        isCorrect: isCorrectOption(text, defaultId, correctAnswer),
      }
    }

    // Partial object - fill in missing fields
    if (typeof opt === 'object' && opt !== null) {
      const partial = opt as Record<string, unknown>
      const id = (partial.id as string) || defaultId
      const text = ((partial.text as string) || String(partial)).trim()
      // Preserve explicit isCorrect if present, otherwise infer from correctAnswer
      const explicitCorrect = typeof partial.isCorrect === 'boolean' ? partial.isCorrect : null
      return {
        id,
        text,
        isCorrect: explicitCorrect ?? isCorrectOption(text, id, correctAnswer),
      }
    }

    // Fallback
    return { id: defaultId, text: String(opt), isCorrect: false }
  })
}

/**
 * Normalize drill series output to fix common GPT response issues.
 * This handles cases where the ground truth path produces JSON that doesn't
 * exactly match the Zod schema.
 */
function normalizeDrillSeriesOutput(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data }

  // Fix practiceSequences - filter out malformed entries or set to null
  if (result.practiceSequences) {
    if (Array.isArray(result.practiceSequences)) {
      const validSequences = (result.practiceSequences as Record<string, unknown>[]).filter(
        (seq) =>
          seq &&
          typeof seq === 'object' &&
          typeof seq.name === 'string' &&
          typeof seq.description === 'string' &&
          Array.isArray(seq.drillIds)
      )
      // If no valid sequences, set to null (allowed by schema)
      result.practiceSequences = validSequences.length > 0 ? validSequences : null
    } else {
      result.practiceSequences = null
    }
  }

  // Fix designThoughts - convert object fields to strings if needed
  if (result.designThoughts && typeof result.designThoughts === 'object') {
    const thoughts = result.designThoughts as Record<string, unknown>
    const normalizedThoughts: Record<string, unknown> = { ...thoughts }

    // varietyAnalysis should be a string, but GPT sometimes returns an object
    if (thoughts.varietyAnalysis && typeof thoughts.varietyAnalysis === 'object') {
      normalizedThoughts.varietyAnalysis = JSON.stringify(thoughts.varietyAnalysis)
    }

    // Same for other string fields that might be objects
    if (thoughts.methodologyRationale && typeof thoughts.methodologyRationale === 'object') {
      normalizedThoughts.methodologyRationale = JSON.stringify(thoughts.methodologyRationale)
    }
    if (thoughts.pedagogicalNotes && typeof thoughts.pedagogicalNotes === 'object') {
      normalizedThoughts.pedagogicalNotes = JSON.stringify(thoughts.pedagogicalNotes)
    }

    result.designThoughts = normalizedThoughts
  }

  // Fix drill options - GPT sometimes returns string arrays instead of object arrays
  // Structure: phases[] → principleGroups[] → drills[] → options[]
  if (result.phases && Array.isArray(result.phases)) {
    result.phases = (result.phases as Record<string, unknown>[]).map((phase) => {
      if (!phase.principleGroups || !Array.isArray(phase.principleGroups)) {
        return phase
      }

      return {
        ...phase,
        principleGroups: (phase.principleGroups as Record<string, unknown>[]).map((group) => {
          if (!group.drills || !Array.isArray(group.drills)) {
            return group
          }

          return {
            ...group,
            drills: (group.drills as Record<string, unknown>[]).map((drill) => {
              // Always normalize options to ensure consistent format and correct isCorrect flags
              // Handles: string arrays, partial objects, missing isCorrect, case variations
              if (drill.options && Array.isArray(drill.options) && drill.options.length > 0) {
                const correctAnswer = (drill.correctAnswer as string) || ''
                drill.options = normalizeOptions(drill.options as unknown[], correctAnswer)
              }
              return drill
            }),
          }
        }),
      }
    })
  }

  return result
}

// Lazy-load OpenAI client to avoid build-time errors
let openaiClient: import('openai').default | null = null

function getOpenAIClient(): import('openai').default {
  if (!openaiClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai').default
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient!
}

export interface DrillDesignerOptions extends GeneratorOptions {
  mentalModel: MentalModelOutput
  curriculum: CurriculumOutput
  seededPositions?: SeededPositionsByPhase | null
  drillConfig?: DrillGenerationConfig
}

/**
 * Generate drill series from mental model and curriculum.
 *
 * This function routes to ground truth validated generation if enabled,
 * otherwise uses standard generation.
 */
export async function generateDrillSeries(
  options: DrillDesignerOptions
): Promise<GenerationResult<PhaseOrganizedDrillSeries>> {
  const {
    projectId,
    contextLayers,
    knowledgeFiles,
    domain,
    userNotes,
    mentalModel,
    curriculum,
    customSystemPrompt,
    customUserPromptTemplate,
  } = options

  // Validate inputs
  if (!mentalModel) {
    throw new Error('Mental model is required to generate drills')
  }

  if (!curriculum) {
    throw new Error('Curriculum is required to generate drills')
  }

  if (contextLayers.length === 0 && knowledgeFiles.length === 0) {
    throw new Error('Cannot generate drills from empty corpus')
  }

  // Check for ground truth configuration
  const gtConfig = await resolveGroundTruthConfig(projectId)

  if (gtConfig && gtConfig.enabled) {
    // Use ground truth validated generation
    console.log(`[DrillDesigner] Using ground truth validation for project ${projectId}`)
    return generateWithGroundTruth(options, gtConfig)
  }

  // Standard generation (no validation)
  console.log(`[DrillDesigner] Standard generation for project ${projectId}`)
  return generateStandardDrillSeries(options)
}

/**
 * Generate drill series with ground truth verification.
 */
async function generateWithGroundTruth(
  options: DrillDesignerOptions,
  gtConfig: NonNullable<Awaited<ReturnType<typeof resolveGroundTruthConfig>>>
): Promise<GenerationResult<PhaseOrganizedDrillSeries>> {
  const {
    contextLayers,
    knowledgeFiles,
    domain,
    userNotes,
    mentalModel,
    curriculum,
    customSystemPrompt,
    customUserPromptTemplate,
    guruProfile,
    seededPositions,
    drillConfig,
  } = options

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)

  // Build prompts
  const userPrompt = customUserPromptTemplate?.trim()
    ? customUserPromptTemplate
        .replace(/\{\{domain\}\}/g, domain)
        .replace(/\{\{corpusSummary\}\}/g, corpusSummary)
        .replace(/\{\{userNotes\}\}/g, userNotes || '')
        .replace(/\{\{mentalModel\}\}/g, JSON.stringify(mentalModel, null, 2))
        .replace(/\{\{curriculum\}\}/g, JSON.stringify(curriculum, null, 2))
    : buildDrillDesignerPrompt({
        domain,
        corpusSummary,
        mentalModel,
        curriculum,
        userNotes,
        seededPositions,
        drillConfig,
      })

  // Build system prompt - inject guru profile if available
  let systemPrompt = customSystemPrompt ?? CREATIVE_TEACHING_SYSTEM_PROMPT
  if (guruProfile) {
    const profileBlock = buildProfilePromptBlock(guruProfile)
    systemPrompt = profileBlock + '\n\n' + systemPrompt
  }

  // Call ground truth generator
  const result = await generateDrillSeriesWithGroundTruth(
    systemPrompt,
    userPrompt,
    gtConfig
  )

  // Parse the content as JSON and validate with schema
  // Handle cases where response might contain JSON wrapped in text or markdown
  let parsed: unknown
  try {
    parsed = JSON.parse(result.content)
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks or surrounding text
    const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      result.content.match(/(\{[\s\S]*\})/)
    if (jsonMatch && jsonMatch[1]) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim())
      } catch {
        console.error('[DrillDesigner] Failed to extract JSON from response:', result.content.substring(0, 500))
        throw new Error(`Invalid JSON in drill series response: ${parseError instanceof Error ? parseError.message : 'Parse error'}`)
      }
    } else {
      console.error('[DrillDesigner] No JSON found in response:', result.content.substring(0, 500))
      throw new Error(`Invalid JSON in drill series response: ${parseError instanceof Error ? parseError.message : 'Parse error'}`)
    }
  }

  // Normalize the parsed data to fix common GPT output issues before Zod validation
  const normalized = normalizeDrillSeriesOutput(parsed as Record<string, unknown>)

  // Log what we're about to parse for debugging
  const topLevelKeys = Object.keys(normalized)
  console.log(`[DrillDesigner] Parsed response has keys: ${topLevelKeys.join(', ')}`)
  if (!normalized.drillSeriesTitle || !normalized.series) {
    console.error('[DrillDesigner] Missing required fields. Raw parsed:', JSON.stringify(normalized).substring(0, 1000))
  }

  const content = phaseOrganizedDrillSeriesSchema.parse(normalized)

  const markdown = renderPhaseOrganizedMarkdown(content)

  return {
    content,
    markdown,
    corpusHash,
    userPrompt,
  }
}

/**
 * Standard drill series generation (no ground truth verification).
 */
async function generateStandardDrillSeries(
  options: DrillDesignerOptions
): Promise<GenerationResult<PhaseOrganizedDrillSeries>> {
  const {
    contextLayers,
    knowledgeFiles,
    domain,
    userNotes,
    mentalModel,
    curriculum,
    customSystemPrompt,
    customUserPromptTemplate,
    guruProfile,
    seededPositions,
    drillConfig,
  } = options

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)

  // Build user prompt - use custom template if provided, otherwise default builder
  let userPrompt: string
  if (customUserPromptTemplate?.trim()) {
    // Substitute variables in custom template
    userPrompt = customUserPromptTemplate
      .replace(/\{\{domain\}\}/g, domain)
      .replace(/\{\{corpusSummary\}\}/g, corpusSummary)
      .replace(/\{\{userNotes\}\}/g, userNotes || '')
      .replace(/\{\{mentalModel\}\}/g, JSON.stringify(mentalModel, null, 2))
      .replace(/\{\{curriculum\}\}/g, JSON.stringify(curriculum, null, 2))
  } else {
    userPrompt = buildDrillDesignerPrompt({
      domain,
      corpusSummary,
      mentalModel,
      curriculum,
      userNotes,
      seededPositions,
      drillConfig,
    })
  }

  // Build system prompt - inject guru profile if available
  let systemPrompt = customSystemPrompt ?? CREATIVE_TEACHING_SYSTEM_PROMPT
  if (guruProfile) {
    const profileBlock = buildProfilePromptBlock(guruProfile)
    systemPrompt = profileBlock + '\n\n' + systemPrompt
  }

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'drill_series',
        schema: zodResponseFormat(phaseOrganizedDrillSeriesSchema, 'drill_series').json_schema.schema,
        strict: true,
      },
    },
    temperature: 0.7,
  })

  const rawContent = completion.choices[0].message.content
  if (!rawContent) {
    throw new Error('No content in drill series response')
  }

  // Parse and normalize before Zod validation
  // (Same normalization as ground truth path to handle GPT quirks like string options)
  const parsed = JSON.parse(rawContent)
  const normalized = normalizeDrillSeriesOutput(parsed as Record<string, unknown>)
  const content = phaseOrganizedDrillSeriesSchema.parse(normalized)

  const markdown = renderPhaseOrganizedMarkdown(content)

  return {
    content,
    markdown,
    corpusHash,
    userPrompt,
  }
}

/**
 * Maximum number of generation retries when validation fails
 */
const MAX_GENERATION_RETRIES = 3;

/**
 * Generate drill series with validation and retry logic.
 *
 * This function wraps the standard drill generation with automatic validation
 * and retry. If the generated drill count doesn't match the requested count,
 * it will retry up to MAX_GENERATION_RETRIES times with feedback.
 *
 * @param options - Drill generation options (must include drillConfig)
 * @returns Generation result with validation warning and retry count
 *
 * @example
 * const result = await generateDrillSeriesWithValidation({
 *   ...baseOptions,
 *   drillConfig: { targetDrillCount: 10, gamePhases: ['OPENING'] }
 * });
 *
 * if (result.validationWarning) {
 *   console.warn('Partial result accepted:', result.validationWarning);
 * }
 */
export async function generateDrillSeriesWithValidation(
  options: DrillDesignerOptions
): Promise<GenerationResult<PhaseOrganizedDrillSeries> & {
  validationWarning?: string;
  retryCount: number;
}> {
  // Ensure drillConfig is present
  if (!options.drillConfig) {
    throw new Error('drillConfig is required for validation-enabled generation');
  }

  let lastResult: GenerationResult<PhaseOrganizedDrillSeries> | null = null;
  let lastValidation: ReturnType<typeof validateDrillOutput> | null = null;

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    // Build retry feedback if not first attempt
    let enhancedUserNotes = options.userNotes || '';
    if (attempt > 0 && lastValidation) {
      const retryFeedback = buildRetryFeedback(lastValidation, options.drillConfig);
      enhancedUserNotes = retryFeedback + '\n\n' + (options.userNotes || '');
      console.log(`[DrillDesigner] Retry attempt ${attempt + 1}/${MAX_GENERATION_RETRIES}`);
    }

    // Generate with enhanced notes
    const result = await generateDrillSeries({
      ...options,
      userNotes: enhancedUserNotes,
    });

    // Validate using phase-organized validator
    const validation = validateDrillOutput(result.content, options.drillConfig);

    if (validation.valid) {
      console.log(`[DrillDesigner] Validation passed on attempt ${attempt + 1}`);
      return { ...result, retryCount: attempt };
    }

    lastResult = result;
    lastValidation = validation;

    console.log(
      `[DrillDesigner] Validation failed (attempt ${attempt + 1}/${MAX_GENERATION_RETRIES}):`,
      validation.issues
    );
  }

  // Accept partial results with warning after all retries exhausted
  const warning = `Generated ${lastValidation!.actualCount} of ${lastValidation!.expectedCount} requested drills after ${MAX_GENERATION_RETRIES} attempts. Issues: ${lastValidation!.issues.join('; ')}`;

  console.warn(`[DrillDesigner] ${warning}`);

  return {
    ...lastResult!,
    validationWarning: warning,
    retryCount: MAX_GENERATION_RETRIES,
  };
}

/**
 * Render phase-organized drill series as readable Markdown.
 */
export function renderPhaseOrganizedMarkdown(drillSeries: PhaseOrganizedDrillSeries): string {
  const lines: string[] = []

  lines.push(`# ${drillSeries.drillSeriesTitle}`)
  lines.push('')
  lines.push(`**Total Drills:** ${drillSeries.totalDrillCount}`)
  lines.push('')
  lines.push(`**Estimated Time:** ${drillSeries.estimatedCompletionMinutes} minutes`)
  lines.push('')

  // Design Thoughts section
  if (drillSeries.designThoughts) {
    lines.push('---')
    lines.push('')
    lines.push('## Design Thoughts')
    lines.push('')
    lines.push(`**Methodology Rationale:** ${drillSeries.designThoughts.methodologyRationale}`)
    lines.push('')
    lines.push(`**Variety Analysis:** ${drillSeries.designThoughts.varietyAnalysis}`)
    lines.push('')
    lines.push(`**Pedagogical Notes:** ${drillSeries.designThoughts.pedagogicalNotes}`)
    lines.push('')
    lines.push(`**Principle Integration:** ${drillSeries.designThoughts.principleIntegration}`)
    lines.push('')
  }

  // Phases
  for (const phase of drillSeries.phases) {
    lines.push('---')
    lines.push('')
    lines.push(`## ${phase.phaseTitle}`)
    lines.push('')
    lines.push(phase.phaseDescription)
    lines.push('')
    lines.push(`**Drills in this phase:** ${phase.actualDrillCount}`)
    lines.push('')

    // Universal principles for this phase
    if (phase.universalPrinciples.length > 0) {
      lines.push(`**Universal Principles:** ${phase.universalPrinciples.map(p => p.name).join(', ')}`)
      lines.push('')
    }

    // Principle Groups
    for (const group of phase.principleGroups) {
      lines.push(`### ${group.principleName}`)
      lines.push('')
      lines.push(group.principleDescription)
      lines.push('')

      // Drills in this principle group
      for (const drill of group.drills) {
        const tierEmoji: Record<string, string> = {
          RECOGNITION: '👁️',
          APPLICATION: '🎯',
          TRANSFER: '🚀',
        }

        lines.push(`#### ${tierEmoji[drill.tier] || '📝'} ${drill.tier}: ${drill.methodology}`)
        lines.push('')
        lines.push(`*Principle: ${drill.primaryPrincipleId}*`)
        if (drill.universalPrincipleIds.length > 0) {
          lines.push(`*Also reinforces: ${drill.universalPrincipleIds.join(', ')}*`)
        }
        lines.push('')

        // Scenario
        lines.push('**Scenario:**')
        lines.push('')
        lines.push(drill.scenario)
        lines.push('')

        lines.push(`**Question:** ${drill.question}`)
        lines.push('')

        // Options if present
        if (drill.options && drill.options.length > 0) {
          lines.push('**Options:**')
          lines.push('')
          for (const option of drill.options) {
            const marker = option.isCorrect ? '✓' : '○'
            lines.push(`- ${marker} **${option.id}:** ${option.text}`)
          }
          lines.push('')
        }

        lines.push(`**Correct Answer:** ${drill.correctAnswer}`)
        lines.push('')

        // Feedback (collapsed)
        lines.push('<details>')
        lines.push('<summary>View Feedback</summary>')
        lines.push('')
        lines.push('**Explanation:**')
        lines.push(`> ${drill.explanation}`)
        lines.push('')
        lines.push('**Correct:**')
        lines.push(`> ${drill.feedback.correct}`)
        lines.push('')
        lines.push('**If Incorrect:**')
        lines.push(`> ${drill.feedback.incorrect}`)
        lines.push('')
        if (drill.hints && drill.hints.length > 0) {
          lines.push('**Hints:**')
          for (const hint of drill.hints) {
            lines.push(`- ${hint}`)
          }
          lines.push('')
        }
        lines.push('</details>')
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}
