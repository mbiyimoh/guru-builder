/**
 * Claim Extraction - Simplified API
 *
 * Extract verifiable claims from drill/curriculum content for post-generation verification.
 * This module provides a high-level interface to the claim extraction system.
 *
 * Usage:
 *   import { extractVerifiableClaims } from '@/lib/groundTruth/claimExtraction'
 *
 *   const claims = extractVerifiableClaims(drillSeriesContent)
 *   // Returns array of claims that can be verified against ground truth engine
 */

import type { VerificationClaim, ClaimLocation } from './types'
import type { PhaseOrganizedDrillSeries, PhaseDrill } from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema'
import type { CurriculumOutput } from '@/lib/guruFunctions/schemas/curriculumSchema'
import { extractBackgammonMove, extractDiceRoll } from './verification/moveExtractor'
import { detectPositionType } from './verification/positionDetector'

// Re-export ClaimLocation for convenience
export type { ClaimLocation } from './types'

/**
 * Claim types that can be verified against ground truth
 */
export type ClaimType =
  | 'move_recommendation'   // "The best move is 8/5 6/5"
  | 'position_evaluation'   // "White has a small advantage"
  | 'equity_value'          // "Equity: +0.15"
  | 'match_score'           // "Leading 3-1 in a 5-point match"

/**
 * Extract all verifiable claims from drill series content
 *
 * Processes drill series content to identify factual claims that can be
 * verified against a ground truth engine. Extracts:
 * - Move recommendations with position context
 * - Equity values
 * - Position evaluations
 * - Match score context
 *
 * For scenario-based drills with positionId (e.g., "opening-3-1"):
 * - Uses positionId to determine the position context
 * - Extracts dice roll from positionId or scenario text
 * - Finds correct answer option and extracts move from its text
 *
 * @param content - PhaseOrganizedDrillSeries from artifact generation
 * @returns Array of verification claims with extracted metadata
 *
 * @example
 * const drillSeries = await generateDrillSeries(...)
 * const claims = extractVerifiableClaims(drillSeries)
 * console.log(`Found ${claims.length} verifiable claims`)
 */
export function extractVerifiableClaims(
  content: PhaseOrganizedDrillSeries
): VerificationClaim[] {
  const claims: VerificationClaim[] = []

  // Process each drill in each phase -> principleGroup -> drills
  content.phases.forEach((phase) => {
    phase.principleGroups.forEach((group) => {
      group.drills.forEach((drill, drillIndex) => {
        const location: ClaimLocation = {
          drillIndex,
          sectionName: `${phase.phaseTitle} - ${group.principleName}`
        }

        // Find the correct answer option (used in multiple extraction strategies)
        const correctOption = drill.options?.find((opt: { id: string; isCorrect: boolean }) => opt.id === drill.correctAnswer || opt.isCorrect)
        const scenarioText = drill.scenario + ' ' + drill.question

        // Strategy 1: Drills with positionId (from Position Library)
        if (drill.positionId) {
          const positionClaims = extractScenarioBasedClaims(drill, location)
          claims.push(...positionClaims)
        }
        // Strategy 2: Drills without positionId - try to extract context from scenario
        else if (correctOption) {
          const diceRoll = extractDiceRoll(scenarioText)
          const move = extractBackgammonMove(correctOption.text)

          if (diceRoll && move) {
            // Opening-style drill: dice roll in scenario, move in answer
            const diceStr = `${diceRoll.die1}-${diceRoll.die2}`
            claims.push({
              id: generateClaimId(),
              type: 'move_recommendation',
              content: `Dice: ${diceStr}, Answer: ${correctOption.text}`,
              location,
              extractedMove: move,
              extractedPosition: diceStr
            })
          } else {
            // Fallback: Try XGID detection in scenario text
            const position = detectPositionType(scenarioText)
            if (position.xgid && move) {
              claims.push({
                id: generateClaimId(),
                type: 'move_recommendation',
                content: correctOption.text,
                location,
                extractedMove: move,
                extractedPosition: position.xgid
              })
            } else if (move) {
              // Last resort: Extract move without position context
              claims.push(...extractAnswerClaims(correctOption.text, location))
            }
          }
        }

        // Extract from feedback - new schema has simple correct/incorrect strings
        const explanationText = [
          drill.explanation,
          drill.feedback.correct,
          drill.feedback.incorrect,
        ].join(' ')

        if (explanationText) {
          const explanationClaims = extractExplanationClaims(
            explanationText,
            location
          )
          claims.push(...explanationClaims)
        }
      })
    })
  })

  return deduplicateClaims(claims)
}

/**
 * Extract claims from scenario-based drills with positionId
 *
 * For drills that reference a position from the Position Library (e.g., "opening-3-1"),
 * we can extract the dice roll from the positionId and verify the correct answer move.
 */
function extractScenarioBasedClaims(
  drill: PhaseDrill,
  location: ClaimLocation
): VerificationClaim[] {
  const claims: VerificationClaim[] = []

  // Extract dice roll from positionId (e.g., "opening-3-1" -> "3-1")
  const diceMatch = drill.positionId?.match(/(\d-\d)$/)
  const extractedDice = extractDiceRoll(drill.scenario)
  const diceRoll = diceMatch ? diceMatch[1] : (extractedDice ? `${extractedDice.die1}-${extractedDice.die2}` : undefined)

  // Find the correct option
  const correctOption = drill.options?.find((opt: { id: string; isCorrect: boolean }) => opt.id === drill.correctAnswer || opt.isCorrect)
  if (!correctOption) return claims

  // Extract move from correct option text
  const move = extractBackgammonMove(correctOption.text)

  if (move && diceRoll) {
    claims.push({
      id: generateClaimId(),
      type: 'move_recommendation',
      content: `Position: ${drill.positionId}, Dice: ${diceRoll}, Correct: ${correctOption.text}`,
      location,
      extractedMove: move,
      extractedPosition: drill.positionId || diceRoll
    })
  }

  // Also extract from scenario text for additional context
  const scenarioMove = extractBackgammonMove(drill.scenario + ' ' + drill.question)
  if (scenarioMove && scenarioMove !== move) {
    claims.push({
      id: generateClaimId(),
      type: 'move_recommendation',
      content: drill.scenario.substring(0, 100),
      location,
      extractedMove: scenarioMove,
      extractedPosition: drill.positionId || diceRoll || undefined
    })
  }

  return claims
}

/**
 * Extract position-related claims from scenario text
 *
 * Identifies position type (opening, midgame, etc.) and any embedded
 * position identifiers like XGIDs.
 */
function extractPositionClaims(
  text: string,
  location: ClaimLocation
): VerificationClaim[] {
  const claims: VerificationClaim[] = []
  const position = detectPositionType(text)

  // Only create claim if we detected a specific position type
  if (position.type !== 'unknown' && position.xgid) {
    claims.push({
      id: generateClaimId(),
      type: 'position_evaluation',
      content: text.substring(0, 100), // First 100 chars as context
      location,
      extractedMove: undefined,
      extractedPosition: position.xgid
    })
  }

  return claims
}

/**
 * Extract move recommendations from text
 *
 * Looks for backgammon move notation (e.g., "8/5 6/5") and associates
 * it with position context and dice rolls when available.
 */
function extractAnswerClaims(
  text: string,
  location: ClaimLocation
): VerificationClaim[] {
  const claims: VerificationClaim[] = []
  const move = extractBackgammonMove(text)
  const position = detectPositionType(text)

  if (move) {
    claims.push({
      id: generateClaimId(),
      type: 'move_recommendation',
      content: text,
      location,
      extractedMove: move,
      extractedPosition: position.xgid || position.diceRoll || position.type
    })
  }

  return claims
}

/**
 * Extract position evaluations from explanation text
 *
 * Identifies:
 * - Equity values (e.g., "equity: +0.15")
 * - Move comparisons (e.g., "8/5 is better than 6/5")
 * - Evaluative statements (e.g., "this is the best move")
 */
function extractExplanationClaims(
  text: string,
  location: ClaimLocation
): VerificationClaim[] {
  const claims: VerificationClaim[] = []

  // Look for equity values
  const equityMatch = text.match(/equity[:\s]+([+-]?\d+\.?\d*)/i)
  if (equityMatch) {
    claims.push({
      id: generateClaimId(),
      type: 'equity_value',
      content: equityMatch[0],
      location,
      extractedMove: undefined,
      extractedPosition: undefined
    })
  }

  // Look for move comparisons ("X is better than Y")
  const comparisonPatterns = [
    /(\S+)\s+is\s+(better|worse|best|optimal|superior|inferior)/i,
    /the\s+(best|correct|optimal|right)\s+(move|play|decision)/i,
    /prefer\s+(\S+)\s+over/i,
  ]

  for (const pattern of comparisonPatterns) {
    const match = text.match(pattern)
    if (match) {
      const move = extractBackgammonMove(text)
      const position = detectPositionType(text)

      if (move) {
        claims.push({
          id: generateClaimId(),
          type: 'move_recommendation',
          content: match[0],
          location,
          extractedMove: move,
          extractedPosition: position.xgid || position.type
        })
        break // Only add one comparison claim per text
      }
    }
  }

  // Look for match score context
  const matchScoreMatch = text.match(/(?:score|trailing|leading)[:\s]+(\d+)[:-](\d+)/i)
  if (matchScoreMatch) {
    claims.push({
      id: generateClaimId(),
      type: 'match_score',
      content: matchScoreMatch[0],
      location,
      extractedMove: undefined,
      extractedPosition: undefined
    })
  }

  return claims
}

/**
 * Generate unique claim ID
 *
 * Creates a unique identifier for each claim using timestamp and random suffix.
 * Format: claim_<timestamp>_<random>
 */
function generateClaimId(): string {
  return `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Remove duplicate claims (same move + position)
 *
 * Deduplication strategy:
 * - Claims with identical type, move, and position are considered duplicates
 * - First occurrence is kept, subsequent duplicates are filtered out
 * - This prevents redundant verification of the same factual claim
 *
 * @param claims - Array of claims to deduplicate
 * @returns Deduplicated array with unique claims only
 */
function deduplicateClaims(claims: VerificationClaim[]): VerificationClaim[] {
  const seen = new Set<string>()
  return claims.filter(claim => {
    // Create unique key from claim properties
    const key = `${claim.type}:${claim.extractedMove || 'none'}:${claim.extractedPosition || 'none'}`

    if (seen.has(key)) {
      return false // Duplicate - filter out
    }

    seen.add(key)
    return true // Unique - keep it
  })
}

/**
 * Extract all verifiable claims from curriculum content
 *
 * Processes curriculum content to identify factual claims that can be
 * verified against a ground truth engine. Primarily extracts claims from:
 * - EXAMPLE lessons (may contain move demonstrations)
 * - PRACTICE lessons (may contain exercises with answers)
 * - Expanded content with detailed explanations
 *
 * @param content - CurriculumOutput from artifact generation
 * @returns Array of verification claims with extracted metadata
 *
 * @example
 * const curriculum = await generateCurriculum(...)
 * const claims = extractCurriculumClaims(curriculum)
 * console.log(`Found ${claims.length} verifiable claims`)
 */
export function extractCurriculumClaims(
  content: CurriculumOutput
): VerificationClaim[] {
  const claims: VerificationClaim[] = []

  // Process universal principles module
  content.universalPrinciplesModule.principleUnits.forEach((unit, unitIndex) => {
    unit.lessons.forEach((lesson, lessonIndex) => {
      const location: ClaimLocation = {
        moduleIndex: 0, // Universal module is always first
        lessonIndex: unitIndex * 4 + lessonIndex, // 4 lessons per principle
        sectionName: `${content.universalPrinciplesModule.moduleTitle} - ${unit.principleName}`,
        lessonType: lesson.type
      }

      // Extract from lesson content - essence (main content)
      const essenceClaims = extractLessonClaims(
        lesson.content.essence,
        location
      )
      claims.push(...essenceClaims)

      // Extract from expanded content
      const expandedClaims = extractLessonClaims(
        lesson.content.expandedContent,
        location
      )
      claims.push(...expandedClaims)

      // EXAMPLE and PRACTICE lessons are more likely to have verifiable moves
      if (lesson.type === 'EXAMPLE' || lesson.type === 'PRACTICE') {
        // Also check headline for move recommendations
        const headlineClaims = extractLessonClaims(
          lesson.content.headline,
          location
        )
        claims.push(...headlineClaims)
      }
    })
  })

  // Process phase modules
  content.phaseModules.forEach((phaseModule, phaseIndex) => {
    phaseModule.principleUnits.forEach((unit, unitIndex) => {
      unit.lessons.forEach((lesson, lessonIndex) => {
        const location: ClaimLocation = {
          moduleIndex: phaseIndex + 1, // +1 because universal module is first
          lessonIndex: unitIndex * 4 + lessonIndex,
          sectionName: `${phaseModule.phaseTitle} - ${unit.principleName}`,
          lessonType: lesson.type
        }

        // Extract from lesson content - essence (main content)
        const essenceClaims = extractLessonClaims(
          lesson.content.essence,
          location
        )
        claims.push(...essenceClaims)

        // Extract from expanded content if present (detailed explanations)
        if (lesson.content.expandedContent) {
          const expandedClaims = extractLessonClaims(
            lesson.content.expandedContent,
            location
          )
          claims.push(...expandedClaims)
        }

        // EXAMPLE and PRACTICE lessons are more likely to have verifiable moves
        if (lesson.type === 'EXAMPLE' || lesson.type === 'PRACTICE') {
          // Also check headline for move recommendations
          const headlineClaims = extractLessonClaims(
            lesson.content.headline,
            location
          )
          claims.push(...headlineClaims)
        }
      })
    })
  })

  return deduplicateClaims(claims)
}

/**
 * Extract claims from lesson text content
 *
 * Combines logic from answer and explanation claim extraction
 * since curriculum lessons may contain both types of content.
 */
function extractLessonClaims(
  text: string,
  location: ClaimLocation
): VerificationClaim[] {
  const claims: VerificationClaim[] = []

  // Look for move recommendations
  const move = extractBackgammonMove(text)
  const position = detectPositionType(text)

  if (move) {
    claims.push({
      id: generateClaimId(),
      type: 'move_recommendation',
      content: text.substring(0, 200), // Context for debugging
      location,
      extractedMove: move,
      extractedPosition: position.xgid || position.diceRoll || position.type
    })
  }

  // Look for position evaluations with XGID
  if (position.type !== 'unknown' && position.xgid) {
    claims.push({
      id: generateClaimId(),
      type: 'position_evaluation',
      content: text.substring(0, 100),
      location,
      extractedMove: undefined,
      extractedPosition: position.xgid
    })
  }

  // Look for equity values
  const equityMatch = text.match(/equity[:\s]+([+-]?\d+\.?\d*)/i)
  if (equityMatch) {
    claims.push({
      id: generateClaimId(),
      type: 'equity_value',
      content: equityMatch[0],
      location,
      extractedMove: undefined,
      extractedPosition: undefined
    })
  }

  // Look for match score context
  const matchScoreMatch = text.match(/(?:score|trailing|leading)[:\s]+(\d+)[:-](\d+)/i)
  if (matchScoreMatch) {
    claims.push({
      id: generateClaimId(),
      type: 'match_score',
      content: matchScoreMatch[0],
      location,
      extractedMove: undefined,
      extractedPosition: undefined
    })
  }

  return claims
}

/**
 * Extract backgammon moves from text (re-exported for convenience)
 */
export { extractBackgammonMove, extractAllMoves, extractDiceRoll } from './verification/moveExtractor'

/**
 * Detect position type from text (re-exported for convenience)
 */
export { detectPositionType, getOpeningXGID } from './verification/positionDetector'
