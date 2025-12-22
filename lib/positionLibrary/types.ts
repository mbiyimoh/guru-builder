// lib/positionLibrary/types.ts
// TypeScript types for the Position Library feature

import { GamePhase, PositionSource } from '@prisma/client'

export type { GamePhase, PositionSource }

/**
 * Probability breakdown from GNUBG analysis
 */
export interface ProbabilityBreakdown {
  win: number       // Win probability (0-1)
  winG: number      // Gammon win probability
  winBG: number     // Backgammon win probability
  lose: number      // Lose probability
  loseG: number     // Gammon loss probability
  loseBG: number    // Backgammon loss probability
}

/**
 * Full probability breakdown for all moves in a position
 */
export interface PositionProbabilityBreakdown {
  best: ProbabilityBreakdown
  second: ProbabilityBreakdown | null
  third: ProbabilityBreakdown | null
}

/**
 * Position data as stored in the database
 */
export interface PositionData {
  positionId: string
  gamePhase: GamePhase
  diceRoll: string
  bestMove: string
  bestMoveEquity: number
  secondBestMove?: string | null
  secondEquity?: number | null
  thirdBestMove?: string | null
  thirdEquity?: number | null
  probabilityBreakdown?: PositionProbabilityBreakdown | null
  asciiBoard: string
  sourceType: PositionSource
  engineId: string
}

/**
 * Alternative move with full analysis
 */
export interface AlternativeMove {
  move: string
  equity: number
  probability?: ProbabilityBreakdown
}

/**
 * Educational metadata for curated positions
 */
export interface PositionMetadata {
  name: string
  description: string
}

/**
 * Position formatted for seeding into drill generation prompt
 */
export interface SeededPosition {
  positionId: string
  diceRoll: string
  bestMove: string
  bestMoveEquity: number
  bestMoveProbability?: ProbabilityBreakdown
  alternatives: AlternativeMove[]
  asciiBoard: string
  /** Educational metadata for curated (non-opening) positions */
  metadata?: PositionMetadata
}

/**
 * Positions grouped by game phase for prompt seeding
 */
export interface SeededPositionsByPhase {
  OPENING: SeededPosition[]
  EARLY: SeededPosition[]    // Phase 2
  MIDDLE: SeededPosition[]   // Phase 2
  BEAROFF: SeededPosition[]  // Phase 2
}

/**
 * Result from position population
 */
export interface PopulationResult {
  populated: number
  errors: string[]
}

/**
 * Engine move result from GNUBG
 */
export interface EngineMove {
  move: string
  equity: number
  equityDiff?: number
}

/**
 * Result from get_best_moves ground truth tool
 */
export interface GetBestMovesResult {
  success: boolean
  moves?: EngineMove[]
  error?: string
}

// =============================================================================
// POSITION ATTRIBUTION TYPES (Phase-Organized Drill Library)
// =============================================================================

/**
 * Match context for positions sourced from imported matches
 */
export interface PositionMatchContext {
  player1Name: string
  player1Country?: string
  player2Name: string
  player2Country?: string
  tournamentName?: string
  matchLength: number
  gameNumber?: number
  moveNumber?: number
}

/**
 * Archive source information
 */
export interface PositionArchiveContext {
  filename: string
  sourceCollection?: string
}

/**
 * Extended seeded position with full context for drill generation.
 * Includes match/archive metadata for attribution in generated drills.
 */
export interface SeededPositionWithContext extends SeededPosition {
  /** Database record ID for linking */
  libraryId: string

  /** Source type (OPENING_CATALOG, MATCH_IMPORT, CURATED, SELF_PLAY) */
  sourceType: PositionSource

  /** Match context (populated for MATCH_IMPORT source) */
  match?: PositionMatchContext

  /** Archive context (populated for MATCH_IMPORT source) */
  archive?: PositionArchiveContext
}

/**
 * Positions grouped by phase with full context
 */
export interface SeededPositionsWithContextByPhase {
  OPENING: SeededPositionWithContext[]
  EARLY: SeededPositionWithContext[]
  MIDDLE: SeededPositionWithContext[]
  BEAROFF: SeededPositionWithContext[]
}
