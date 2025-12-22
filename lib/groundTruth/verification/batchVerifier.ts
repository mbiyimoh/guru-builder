/**
 * Ground Truth Module - Batch Claim Verifier
 *
 * Verifies multiple extracted claims against the ground truth engine.
 * Provides comprehensive validation with caching, error handling,
 * and detailed reporting of discrepancies.
 */

import type {
  VerificationClaim,
  ClaimVerificationResult,
  GroundTruthConfig,
  VerificationResult,
  ToolCallResult
} from '../types'
import { executeGroundTruthTool, checkEngineHealth } from '../executor'
import { getOpeningMoves, formatMove, clearSession } from '../mcpClient'
import { checkCache, cacheResponse, buildCacheKey, CACHE_TTL } from '../cache'
import { extractDiceRoll, normalizeMove, movesAreEquivalent } from './moveExtractor'
import { detectPositionType, getOpeningXGID } from './positionDetector'

/**
 * Engine response format for move evaluation
 */
interface EngineMoveResponse {
  success: boolean
  data?: {
    bestMoves?: Array<{
      move: string
      equity: number
      winChance: number
    }>
    isOptimal?: boolean
    isCorrect?: boolean
    evaluation?: {
      equity: number
      winProbability: number
      gammonProbability: number
    }
  }
  error?: string
}

/**
 * Verify all claims against the ground truth engine
 *
 * Processes a batch of verification claims, checking each against
 * the ground truth engine. Uses intelligent caching to minimize
 * redundant API calls for identical positions/moves.
 *
 * @param claims - Array of claims to verify
 * @param config - Ground truth configuration
 * @returns Comprehensive verification result with status and details
 *
 * @example
 * const result = await verifyClaimsAgainstGroundTruth([
 *   {
 *     id: '1',
 *     type: 'move_recommendation',
 *     content: 'Best play is 8/5 6/5',
 *     location: { drillIndex: 0 },
 *     extractedMove: '8/5 6/5',
 *     extractedPosition: 'XGID=...'
 *   }
 * ], config)
 */
export async function verifyClaimsAgainstGroundTruth(
  claims: VerificationClaim[],
  config: GroundTruthConfig
): Promise<VerificationResult> {
  // Check engine health before attempting verification
  const healthCheck = await checkEngineHealth(config)

  if (!healthCheck.available) {
    console.warn(`[GroundTruth] Engine unavailable: ${healthCheck.error}. Marking artifact as UNVERIFIED`)

    // Return UNVERIFIED status gracefully without throwing
    return {
      status: 'UNVERIFIED',
      claims: claims.map(c => ({
        claim: c,
        verified: false,
        discrepancy: 'Engine unavailable for verification',
        cached: false
      })),
      toolCalls: [],
      summary: {
        totalClaims: claims.length,
        verifiedClaims: 0,
        failedClaims: 0,
        cachedResponses: 0
      }
    }
  }

  console.log(`[GroundTruth] Engine available (latency: ${healthCheck.latency}ms), proceeding with verification`)

  const results: ClaimVerificationResult[] = []
  const toolCalls: ToolCallResult[] = []
  let cachedCount = 0

  // Verify each claim sequentially
  for (const claim of claims) {
    const result = await verifySingleClaim(claim, config)
    results.push(result)

    // Track tool calls (only for non-cached verifications)
    if (!result.cached && result.engineResponse) {
      toolCalls.push({
        toolName: 'evaluate_move',
        arguments: {
          position: claim.extractedPosition,
          move: claim.extractedMove
        },
        result: result.engineResponse,
        cached: false,
        executionTime: 0 // Timing handled by executor
      })
    }

    if (result.cached) cachedCount++
  }

  // Calculate summary statistics
  const verifiedCount = results.filter(r => r.verified).length
  const failedCount = results.filter(r => !r.verified).length

  // Determine overall status based on failure threshold
  let status: VerificationResult['status']
  if (failedCount === 0) {
    status = 'VERIFIED'
  } else if (failedCount > claims.length * 0.3) {
    // More than 30% failed -> needs review
    status = 'NEEDS_REVIEW'
  } else if (verifiedCount === 0) {
    // All failed -> unverified
    status = 'UNVERIFIED'
  } else {
    // Some failures but mostly verified
    status = 'VERIFIED'
  }

  return {
    status,
    claims: results,
    toolCalls,
    summary: {
      totalClaims: claims.length,
      verifiedClaims: verifiedCount,
      failedClaims: failedCount,
      cachedResponses: cachedCount
    }
  }
}

/**
 * Verify a single claim against the ground truth engine
 *
 * Handles cache checking, engine queries, and result evaluation.
 * Returns detailed verification result including any discrepancies found.
 *
 * For opening positions (positionId like "opening-3-1"), uses the MCP client
 * directly since the executor uses an incompatible API format.
 *
 * @param claim - Claim to verify
 * @param config - Ground truth configuration
 * @returns Verification result for this claim
 */
async function verifySingleClaim(
  claim: VerificationClaim,
  config: GroundTruthConfig
): Promise<ClaimVerificationResult> {
  // Skip claims we can't verify (missing move or position)
  if (!claim.extractedMove || !claim.extractedPosition) {
    return {
      claim,
      verified: true, // Can't verify, assume correct
      cached: false
    }
  }

  try {
    // Check if this is an opening position (from Position Library)
    const openingMatch = claim.extractedPosition.match(/^opening-(\d)-(\d)$/)
    if (openingMatch) {
      return verifyOpeningClaim(claim, config, parseInt(openingMatch[1]), parseInt(openingMatch[2]))
    }

    // Also check for dice roll in position string (e.g., "3-1")
    const diceOnlyMatch = claim.extractedPosition.match(/^(\d)-(\d)$/)
    if (diceOnlyMatch) {
      return verifyOpeningClaim(claim, config, parseInt(diceOnlyMatch[1]), parseInt(diceOnlyMatch[2]))
    }

    // Fallback to original verification for non-opening positions
    // Resolve position identifier (XGID or opening)
    const positionId = resolvePositionIdentifier(claim.extractedPosition)
    if (!positionId) {
      return {
        claim,
        verified: false,
        discrepancy: 'Could not resolve position identifier',
        cached: false
      }
    }

    // Extract dice roll from position or content
    const dice = extractDiceFromClaim(claim)
    if (!dice) {
      return {
        claim,
        verified: false,
        discrepancy: 'Could not extract dice roll from position',
        cached: false
      }
    }

    // Check cache first
    const cacheKey = buildCacheKey('evaluate_move', positionId, claim.extractedMove)
    const cached = await checkCache(cacheKey)

    if (cached) {
      return {
        claim,
        verified: evaluateEngineResponse(cached as EngineMoveResponse, claim),
        engineResponse: cached,
        discrepancy: evaluateEngineResponse(cached as EngineMoveResponse, claim)
          ? undefined
          : buildDiscrepancyMessage(cached as EngineMoveResponse, claim),
        cached: true
      }
    }

    // Call engine to evaluate move
    const result = await executeGroundTruthTool(
      'evaluate_move',
      {
        position: positionId,
        dice,
        move: claim.extractedMove
      },
      config
    )

    // Handle engine errors
    if (!result.result || typeof result.result !== 'object') {
      return {
        claim,
        verified: false,
        discrepancy: 'Engine returned invalid response',
        cached: false
      }
    }

    const engineResponse = result.result as EngineMoveResponse

    if (!engineResponse.success) {
      return {
        claim,
        verified: false,
        discrepancy: `Engine error: ${engineResponse.error || 'Unknown error'}`,
        cached: false
      }
    }

    // Cache the successful response
    await cacheResponse(cacheKey, engineResponse, CACHE_TTL.VERIFICATION)

    // Evaluate if move is verified
    const verified = evaluateEngineResponse(engineResponse, claim)

    return {
      claim,
      verified,
      engineResponse,
      discrepancy: verified ? undefined : buildDiscrepancyMessage(engineResponse, claim),
      cached: false
    }

  } catch (error) {
    // Engine error - can't verify
    return {
      claim,
      verified: false,
      discrepancy: `Engine error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      cached: false
    }
  }
}

/**
 * Verify a claim for an opening position using the MCP client
 *
 * Uses the proper MCP protocol to query GNUBG for opening moves,
 * then compares the claimed move against the engine's best moves.
 *
 * @param claim - Claim to verify
 * @param config - Ground truth configuration
 * @param die1 - First die value
 * @param die2 - Second die value
 * @returns Verification result
 */
async function verifyOpeningClaim(
  claim: VerificationClaim,
  config: GroundTruthConfig,
  die1: number,
  die2: number
): Promise<ClaimVerificationResult> {
  try {
    // Check cache first
    const cacheKey = buildCacheKey('opening', `${die1}-${die2}`, claim.extractedMove || '')
    const cached = await checkCache(cacheKey)

    if (cached && Array.isArray(cached)) {
      const isVerified = verifyMoveAgainstOpeningResults(claim.extractedMove!, cached)
      return {
        claim,
        verified: isVerified,
        engineResponse: cached,
        discrepancy: isVerified ? undefined : buildOpeningDiscrepancy(claim.extractedMove!, cached),
        cached: true
      }
    }

    // Query GNUBG for opening moves
    const moves = await getOpeningMoves(die1, die2, config, 5)

    // Cache the response
    await cacheResponse(cacheKey, moves, CACHE_TTL.OPENING)

    // Verify the claimed move
    const isVerified = verifyMoveAgainstOpeningResults(claim.extractedMove!, moves)

    return {
      claim,
      verified: isVerified,
      engineResponse: moves,
      discrepancy: isVerified ? undefined : buildOpeningDiscrepancy(claim.extractedMove!, moves),
      cached: false
    }
  } catch (error) {
    // Clear session on error to force reconnection
    clearSession(config.engineUrl)

    return {
      claim,
      verified: false,
      discrepancy: `MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      cached: false
    }
  }
}

/**
 * Verify a move against opening results from GNUBG
 *
 * Checks if the claimed move matches any of the top moves returned by the engine.
 */
function verifyMoveAgainstOpeningResults(
  claimedMove: string,
  moves: Array<{ play: Array<{ from: string; to: string }>; evaluation: { eq: number } }>
): boolean {
  // Format each engine move and compare
  for (const engineMove of moves) {
    const formattedMove = formatMove(engineMove.play)
    if (movesAreEquivalent(claimedMove, formattedMove)) {
      return true
    }
  }
  return false
}

/**
 * Build discrepancy message for opening verification failure
 */
function buildOpeningDiscrepancy(
  claimedMove: string,
  moves: Array<{ play: Array<{ from: string; to: string }>; evaluation: { eq: number } }>
): string {
  if (!moves || moves.length === 0) {
    return 'No moves returned from engine'
  }

  const topMove = formatMove(moves[0].play)
  const topThree = moves.slice(0, 3).map(m => formatMove(m.play))

  let message = `Claimed move "${claimedMove}" not in engine's top moves. `
  message += `Best: "${topMove}" (eq: ${moves[0].evaluation.eq.toFixed(3)}). `
  message += `Top 3: ${topThree.join(', ')}.`

  return message
}

/**
 * Evaluate engine response to determine if claim is verified
 *
 * Checks if the claimed move matches the engine's analysis.
 * Handles multiple response formats from different engine tools.
 *
 * @param response - Engine response
 * @param claim - Original claim being verified
 * @returns True if claim is verified as accurate
 */
function evaluateEngineResponse(response: EngineMoveResponse, claim: VerificationClaim): boolean {
  if (!response || !response.success || !response.data) {
    return false
  }

  const { data } = response

  // Check direct verification fields
  if (data.isOptimal !== undefined) {
    return Boolean(data.isOptimal)
  }

  if (data.isCorrect !== undefined) {
    return Boolean(data.isCorrect)
  }

  // Check if move is in best moves list
  if (data.bestMoves && Array.isArray(data.bestMoves) && data.bestMoves.length > 0) {
    const claimedMove = claim.extractedMove!

    // Check if claimed move matches any of the best moves
    // Use movesAreEquivalent for robust comparison
    return data.bestMoves.some(engineMove =>
      movesAreEquivalent(claimedMove, engineMove.move)
    )
  }

  // If no evaluation data available, can't verify
  return false
}

/**
 * Build human-readable discrepancy message
 *
 * Creates a detailed message explaining why a claim failed verification,
 * including what the engine recommends instead.
 *
 * @param response - Engine response
 * @param claim - Original claim
 * @returns Discrepancy message
 */
function buildDiscrepancyMessage(response: EngineMoveResponse, claim: VerificationClaim): string {
  if (!response.success || !response.data) {
    return 'Engine failed to evaluate move'
  }

  const { data } = response

  // Build message with engine recommendations
  if (data.bestMoves && Array.isArray(data.bestMoves) && data.bestMoves.length > 0) {
    const topMove = data.bestMoves[0]
    const topThree = data.bestMoves.slice(0, 3)

    let message = `Claimed move "${claim.extractedMove}" not found in engine's top moves. `
    message += `Best move: "${topMove.move}" (equity: ${topMove.equity.toFixed(3)}, `
    message += `win chance: ${(topMove.winChance * 100).toFixed(1)}%). `

    if (topThree.length > 1) {
      message += `Top 3: ${topThree.map(m => m.move).join(', ')}.`
    }

    return message
  }

  return `Move "${claim.extractedMove}" could not be verified against engine analysis`
}

/**
 * Resolve position identifier to XGID or other canonical format
 *
 * Handles multiple position formats:
 * - Direct XGID strings
 * - Opening position descriptions
 * - Position strings with embedded XGIDs
 *
 * @param position - Position string from claim
 * @returns Resolved position identifier, or null if can't resolve
 */
function resolvePositionIdentifier(position: string): string | null {
  // Check if already an XGID
  const xgidMatch = position.match(/XGID[=:][A-Za-z0-9+\-:]+/i)
  if (xgidMatch) {
    return xgidMatch[0]
  }

  // Try to detect position type and get XGID for openings
  const posType = detectPositionType(position)

  if (posType.type === 'opening' && posType.diceRoll) {
    return getOpeningXGID(posType.diceRoll)
  }

  // Return as-is if we have an xgid from detection
  if (posType.xgid) {
    return posType.xgid
  }

  // Can't resolve
  return null
}

/**
 * Extract dice roll from claim content or position
 *
 * Tries multiple sources:
 * 1. Embedded in position string
 * 2. Claim content text
 * 3. Position type detection
 *
 * @param claim - Claim to extract dice from
 * @returns Dice string in format "3-1", or null if not found
 */
function extractDiceFromClaim(claim: VerificationClaim): string | null {
  // Try to extract from position
  if (claim.extractedPosition) {
    const dice = extractDiceRoll(claim.extractedPosition)
    if (dice) {
      return `${dice.die1}-${dice.die2}`
    }
  }

  // Try to extract from claim content
  const dice = extractDiceRoll(claim.content)
  if (dice) {
    return `${dice.die1}-${dice.die2}`
  }

  // Try position detection
  if (claim.extractedPosition) {
    const posType = detectPositionType(claim.extractedPosition)
    if (posType.diceRoll) {
      return posType.diceRoll
    }
  }

  // Last resort: try to extract from XGID dice field
  if (claim.extractedPosition) {
    const xgidDiceMatch = claim.extractedPosition.match(/:1:(\d\d):/)
    if (xgidDiceMatch) {
      const diceStr = xgidDiceMatch[1]
      return `${diceStr[0]}-${diceStr[1]}`
    }
  }

  return null
}
