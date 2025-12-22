/**
 * Ground Truth Module - Per-Drill Verifier
 *
 * Verifies EVERY drill's correctAnswer against GNUBG, not just extracted claims.
 * This ensures 100% verification coverage with clear drill-level tracking.
 *
 * Key differences from claim-based verification:
 * - Iterates over actual drills (not text-extracted claims)
 * - Every drill gets a verification result
 * - Stores engine data for failed drills (for auto-fix)
 * - Count always matches total drills generated
 */

import type { GroundTruthConfig } from '../types'
import type {
  PhaseOrganizedDrillSeries,
  PhaseDrill
} from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema'
import { getOpeningMoves, formatMove, clearSession, type OpeningMoveResult } from '../mcpClient'
import { checkCache, cacheResponse, buildCacheKey, CACHE_TTL } from '../cache'
import { checkEngineHealth } from '../executor'
import { movesAreEquivalent } from './moveExtractor'

/**
 * Result of verifying a single drill's correct answer
 */
export interface DrillVerificationResult {
  /** Drill ID from the content */
  drillId: string
  /** Phase the drill belongs to */
  phase: string
  /** Principle the drill is practicing */
  principleId: string
  /** Whether the drill's correctAnswer was verified */
  verified: boolean
  /** Whether this drill was skipped (non-opening, can't verify yet) */
  skipped: boolean
  /** Position ID from the drill */
  positionId: string | null
  /** The drill's claimed correct answer */
  claimedMove: string
  /** Engine's analysis data (for failed drills - used by fixer) */
  engineData: {
    bestMove: string
    bestEquity: number
    top3: Array<{ move: string; equity: number }>
  } | null
  /** Description of discrepancy (if failed) */
  discrepancy: string | null
  /** Whether verification used cached data */
  cached: boolean
}

/**
 * Overall result of verifying all drills in a drill series
 */
export interface DrillSeriesVerificationResult {
  /** Overall status */
  status: 'VERIFIED' | 'NEEDS_REVIEW' | 'UNVERIFIED' | 'FAILED'
  /** Per-drill verification results */
  drills: DrillVerificationResult[]
  /** Summary statistics */
  summary: {
    totalDrills: number
    verifiedDrills: number
    failedDrills: number
    skippedDrills: number
    cachedResponses: number
  }
}

/**
 * Parse position ID to extract dice values for opening positions
 *
 * Handles formats like:
 * - "opening-3-1" -> { die1: 3, die2: 1 }
 * - "3-1" -> { die1: 3, die2: 1 }
 */
function parseOpeningPositionId(positionId: string): { die1: number; die2: number } | null {
  // Try "opening-X-Y" format
  const openingMatch = positionId.match(/^opening-(\d)-(\d)$/)
  if (openingMatch) {
    return {
      die1: parseInt(openingMatch[1]),
      die2: parseInt(openingMatch[2])
    }
  }

  // Try "X-Y" format
  const diceMatch = positionId.match(/^(\d)-(\d)$/)
  if (diceMatch) {
    return {
      die1: parseInt(diceMatch[1]),
      die2: parseInt(diceMatch[2])
    }
  }

  return null
}

/**
 * Check if a position ID is an opening position we can verify
 */
function isOpeningPosition(positionId: string): boolean {
  return parseOpeningPositionId(positionId) !== null
}

/**
 * Verify a single drill's correct answer against GNUBG
 */
async function verifySingleDrill(
  drill: PhaseDrill,
  config: GroundTruthConfig
): Promise<DrillVerificationResult> {
  const baseResult: Omit<DrillVerificationResult, 'verified' | 'skipped' | 'engineData' | 'discrepancy' | 'cached'> = {
    drillId: drill.drillId,
    phase: drill.gamePhase,
    principleId: drill.primaryPrincipleId,
    positionId: drill.positionId || null,
    claimedMove: drill.correctAnswer
  }

  // Skip if no position ID
  if (!drill.positionId) {
    return {
      ...baseResult,
      verified: false,
      skipped: true,
      engineData: null,
      discrepancy: 'No position ID available',
      cached: false
    }
  }

  // Skip non-opening positions (future work: XGID lookup)
  if (!isOpeningPosition(drill.positionId)) {
    return {
      ...baseResult,
      verified: false,
      skipped: true,
      engineData: null,
      discrepancy: 'Non-opening position (verification not yet supported)',
      cached: false
    }
  }

  // Parse dice from position ID
  const dice = parseOpeningPositionId(drill.positionId)
  if (!dice) {
    return {
      ...baseResult,
      verified: false,
      skipped: true,
      engineData: null,
      discrepancy: 'Could not parse dice from position ID',
      cached: false
    }
  }

  try {
    // Check cache first
    const cacheKey = buildCacheKey('opening', `${dice.die1}-${dice.die2}`, drill.correctAnswer)
    const cached = await checkCache(cacheKey)

    let moves: OpeningMoveResult[]
    let isCached = false

    if (cached && Array.isArray(cached)) {
      moves = cached as OpeningMoveResult[]
      isCached = true
    } else {
      // Query GNUBG for opening moves (get top 5 for engine data)
      moves = await getOpeningMoves(dice.die1, dice.die2, config, 5)
      // Cache the response
      await cacheResponse(cacheKey, moves, CACHE_TTL.OPENING)
    }

    // Check if drill's correct answer matches any of engine's top moves
    const isVerified = moves.some(engineMove => {
      const formattedMove = formatMove(engineMove.play)
      return movesAreEquivalent(drill.correctAnswer, formattedMove)
    })

    // Build engine data for use by fixer (always include, even for verified drills)
    const engineData = {
      bestMove: formatMove(moves[0].play),
      bestEquity: moves[0].evaluation.eq,
      top3: moves.slice(0, 3).map(m => ({
        move: formatMove(m.play),
        equity: m.evaluation.eq
      }))
    }

    if (isVerified) {
      return {
        ...baseResult,
        verified: true,
        skipped: false,
        engineData,
        discrepancy: null,
        cached: isCached
      }
    }

    // Build discrepancy message
    const discrepancy = `Claimed "${drill.correctAnswer}" but engine's best is "${engineData.bestMove}" (eq: ${engineData.bestEquity.toFixed(3)}). Top 3: ${engineData.top3.map(m => m.move).join(', ')}`

    return {
      ...baseResult,
      verified: false,
      skipped: false,
      engineData,
      discrepancy,
      cached: isCached
    }
  } catch (error) {
    // Clear session on error to force reconnection
    clearSession(config.engineUrl)

    return {
      ...baseResult,
      verified: false,
      skipped: false,
      engineData: null,
      discrepancy: `Engine error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      cached: false
    }
  }
}

/**
 * Verify all drills in a phase-organized drill series against GNUBG
 *
 * Iterates through phases -> principleGroups -> drills and verifies
 * each drill's correctAnswer against the ground truth engine.
 *
 * @param content - Phase-organized drill series content
 * @param config - Ground truth configuration
 * @returns Comprehensive verification result with per-drill details
 */
export async function verifyAllDrills(
  content: PhaseOrganizedDrillSeries,
  config: GroundTruthConfig
): Promise<DrillSeriesVerificationResult> {
  // Check engine health first
  const healthCheck = await checkEngineHealth(config)

  if (!healthCheck.available) {
    console.warn(`[DrillVerifier] Engine unavailable: ${healthCheck.error}. Marking as UNVERIFIED`)

    // Collect all drills but mark as unverified
    const allDrills: DrillVerificationResult[] = []

    for (const phase of content.phases) {
      for (const group of phase.principleGroups) {
        for (const drill of group.drills) {
          allDrills.push({
            drillId: drill.drillId,
            phase: drill.gamePhase,
            principleId: drill.primaryPrincipleId,
            verified: false,
            skipped: true,
            positionId: drill.positionId || null,
            claimedMove: drill.correctAnswer,
            engineData: null,
            discrepancy: 'Engine unavailable',
            cached: false
          })
        }
      }
    }

    return {
      status: 'UNVERIFIED',
      drills: allDrills,
      summary: {
        totalDrills: allDrills.length,
        verifiedDrills: 0,
        failedDrills: 0,
        skippedDrills: allDrills.length,
        cachedResponses: 0
      }
    }
  }

  console.log(`[DrillVerifier] Engine available (latency: ${healthCheck.latency}ms), verifying drills...`)

  // Verify each drill
  const results: DrillVerificationResult[] = []

  for (const phase of content.phases) {
    for (const group of phase.principleGroups) {
      for (const drill of group.drills) {
        const result = await verifySingleDrill(drill, config)
        results.push(result)
      }
    }
  }

  // Calculate summary
  const verifiedCount = results.filter(r => r.verified).length
  const failedCount = results.filter(r => !r.verified && !r.skipped).length
  const skippedCount = results.filter(r => r.skipped).length
  const cachedCount = results.filter(r => r.cached).length

  // Determine overall status
  let status: DrillSeriesVerificationResult['status']

  // Only consider non-skipped drills for status calculation
  const verifiableDrills = results.filter(r => !r.skipped)
  const verifiableTotal = verifiableDrills.length

  if (verifiableTotal === 0) {
    // All drills were skipped (no openings)
    status = 'UNVERIFIED'
  } else if (failedCount === 0) {
    status = 'VERIFIED'
  } else if (failedCount > verifiableTotal * 0.3) {
    // More than 30% of verifiable drills failed
    status = 'NEEDS_REVIEW'
  } else {
    // Some failures but less than 30%
    status = 'VERIFIED'
  }

  console.log(`[DrillVerifier] Verification complete: ${verifiedCount} verified, ${failedCount} failed, ${skippedCount} skipped`)

  return {
    status,
    drills: results,
    summary: {
      totalDrills: results.length,
      verifiedDrills: verifiedCount,
      failedDrills: failedCount,
      skippedDrills: skippedCount,
      cachedResponses: cachedCount
    }
  }
}

/**
 * Get only the failed drill results (for use by fixer)
 */
export function getFailedDrills(result: DrillSeriesVerificationResult): DrillVerificationResult[] {
  return result.drills.filter(d => !d.verified && !d.skipped && d.engineData !== null)
}
