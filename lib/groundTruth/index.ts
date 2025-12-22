/**
 * Ground Truth Module
 *
 * Central export point for all ground truth verification functionality.
 *
 * This module integrates authoritative backgammon engine verification
 * into AI-generated teaching artifacts to ensure factual accuracy.
 */

// Types
export * from './types'

// Tools
export { GROUND_TRUTH_TOOLS } from './tools'

// Executor
export { executeGroundTruthTool, checkEngineHealth } from './executor'
export type { EngineHealthResult } from './executor'

// MCP Client (for direct engine communication)
export { getOpeningMoves, formatMove, clearSession } from './mcpClient'
export type { OpeningMoveResult } from './mcpClient'

// Cache
export { checkCache, cacheResponse, buildCacheKey } from './cache'

// Config
export { resolveGroundTruthConfig } from './config'

// Claim Extraction
export {
  extractVerifiableClaims,
  extractCurriculumClaims,
  type ClaimType,
  type ClaimLocation,
} from './claimExtraction'

// Move Extraction (from verification subdirectory)
export {
  extractBackgammonMove,
  extractAllMoves,
  extractDiceRoll,
  normalizeMove,
  movesAreEquivalent,
  BACKGAMMON_MOVE_PATTERNS,
} from './verification/moveExtractor'

// Position Detection (from verification subdirectory)
export {
  detectPositionType,
  getOpeningXGID,
  STANDARD_OPENINGS,
  type PositionIdentifier as VerificationPositionIdentifier,
} from './verification/positionDetector'

// Additional move extraction utilities
export {
  extractBackgammonMoves,
  moveContainsHit,
  type PositionType,
  type PositionIdentifier,
} from './moveExtraction'

// Batch Verification (legacy claim-based)
export { verifyClaimsAgainstGroundTruth } from './verification/batchVerifier'

// Per-Drill Verification (new)
export {
  verifyAllDrills,
  getFailedDrills,
  type DrillVerificationResult,
  type DrillSeriesVerificationResult,
} from './verification/drillVerifier'

// Drill Fixer
export {
  fixFailedDrills,
  type DrillFixResult,
  type FixAllDrillsResult,
} from './verification/drillFixer'
