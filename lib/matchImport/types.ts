/**
 * Match Archive Import System - TypeScript Interfaces
 *
 * Defines all types for importing, parsing, and processing backgammon match archives
 * in JellyFish .txt/.mat format.
 */

// Re-export BoardPosition from ground truth module
export type { BoardPosition } from '@/lib/groundTruth/mcpClient'

// =============================================================================
// PARSED MATCH TYPES (Output of JellyFish parser)
// =============================================================================

/**
 * A fully parsed backgammon match from a JellyFish .txt file
 */
export interface ParsedMatch {
  /** Match length in points (e.g., 7, 11, 15) */
  matchLength: number
  /** All games in the match */
  games: ParsedGame[]
  /** Match-level metadata */
  metadata: MatchMetadata
}

/**
 * A single game within a match
 */
export interface ParsedGame {
  /** 1-indexed game number within the match */
  gameNumber: number
  /** Player 1 info (moves from point 24 to 1 from their perspective) */
  player1: PlayerInfo
  /** Player 2 info (moves from point 24 to 1 from their perspective) */
  player2: PlayerInfo
  /** All moves in the game */
  moves: ParsedMove[]
  /** How the game ended */
  outcome?: GameOutcome
}

/**
 * Player information from game header
 */
export interface PlayerInfo {
  /** Player name as it appears in the file */
  name: string
  /** ISO 3166-1 alpha-3 country code (e.g., "USA", "GBR", "JPN") */
  country?: string
  /** Player's score at the start of this game */
  score: number
}

/**
 * A single move line containing both players' moves
 * In JellyFish format, each line has both P1 and P2 moves
 */
export interface ParsedMove {
  /** 1-indexed move number within the game */
  moveNumber: number
  /** Player 1's dice roll (undefined if no move this turn) */
  player1Dice?: DiceRoll
  /** Player 1's checker moves (undefined if couldn't move or didn't roll) */
  player1Moves?: MoveNotation[]
  /** Player 2's dice roll (undefined if no move this turn) */
  player2Dice?: DiceRoll
  /** Player 2's checker moves (undefined if couldn't move or didn't roll) */
  player2Moves?: MoveNotation[]
}

/**
 * Dice roll as a tuple [die1, die2]
 */
export type DiceRoll = [number, number]

/**
 * Single checker move from one point to another
 */
export interface MoveNotation {
  /** Starting point: 1-24 for board, 25 for bar */
  from: number
  /** Ending point: 1-24 for board, 0 for bearing off */
  to: number
  /** Whether this move hit an opponent's blot */
  isHit: boolean
}

/**
 * Match-level metadata
 */
export interface MatchMetadata {
  /** Original filename (e.g., "tournament_player1-vs-player2.mat") */
  filename: string
  /** Tournament/event name (often extracted from filename) */
  tournamentName?: string
  /** Person who annotated the match */
  annotator?: string
  /** Date the match was played */
  date?: Date
  /** Source collection (e.g., "Hardy", "BigBrother", "LittleSister") */
  sourceCollection?: string
}

/**
 * How a game ended
 */
export interface GameOutcome {
  /** Which player won (1 or 2) */
  winner: 1 | 2
  /** Points scored (1 = single, 2 = gammon, 3 = backgammon) */
  points: 1 | 2 | 3
  /** Whether the cube was involved */
  cubeValue?: number
}

// =============================================================================
// REPLAYED POSITION TYPES (Output of replay engine)
// =============================================================================

/**
 * A fully reconstructed board position from replay
 */
export interface ReplayedPosition {
  /** The board state with all 26 points */
  board: BoardState
  /** The dice rolled to create this position */
  dice: DiceRoll
  /** Which player is on roll ('x' = player 1, 'o' = player 2) */
  player: 'x' | 'o'
  /** Move number within the game */
  moveNumber: number
  /** Game number within the match */
  gameNumber: number
  /** Total pip count for player X */
  pipCountX: number
  /** Total pip count for player O */
  pipCountO: number
  /** GNUBG position ID for this board state */
  positionId?: string
  /** ASCII representation of the board */
  asciiBoard?: string
}

/**
 * Board state with all 26 points
 * Array indices:
 *   0: X's bar
 *   1-24: Points (from X's perspective)
 *   25: O's bar
 *
 * Values: positive = X checkers, negative = O checkers
 */
export type BoardState = number[]

/**
 * Full replay result for a match
 */
export interface MatchReplayResult {
  /** All positions extracted from the match */
  positions: ReplayedPosition[]
  /** Any errors encountered during replay */
  errors: ReplayError[]
  /** Statistics about the replay */
  stats: ReplayStats
}

/**
 * Error during replay
 */
export interface ReplayError {
  /** Game where error occurred */
  gameNumber: number
  /** Move where error occurred */
  moveNumber: number
  /** Error description */
  message: string
  /** Whether replay continued despite error */
  recoverable: boolean
}

/**
 * Replay statistics
 */
export interface ReplayStats {
  /** Total games processed */
  totalGames: number
  /** Total moves processed */
  totalMoves: number
  /** Total positions extracted */
  totalPositions: number
  /** Positions by game phase */
  positionsByPhase: {
    OPENING: number
    EARLY: number
    MIDDLE: number
    BEAROFF: number
  }
  /** Processing time in milliseconds */
  processingTimeMs: number
}

// =============================================================================
// GAME PHASE CLASSIFICATION
// =============================================================================

/**
 * Game phase enum (mirrors Prisma)
 */
export type GamePhase = 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF'

/**
 * Phase classification result
 */
export interface PhaseClassification {
  /** The determined phase */
  phase: GamePhase
  /** Confidence score (0-1) */
  confidence: number
  /** Reasoning for classification */
  reason: string
}

// =============================================================================
// IMPORT PIPELINE TYPES
// =============================================================================

/**
 * Import status enum (mirrors Prisma)
 */
export type ImportStatus =
  | 'PENDING'
  | 'PARSING'
  | 'REPLAYING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'

/**
 * Progress update during import
 */
export interface ImportProgress {
  /** Current status */
  status: ImportStatus
  /** Human-readable message */
  message: string
  /** Progress percentage (0-100) */
  percentage: number
  /** Current item being processed */
  currentItem?: string
  /** Items processed so far */
  processed: number
  /** Total items to process */
  total: number
}

/**
 * Import job result
 */
export interface ImportResult {
  /** Success or failure */
  success: boolean
  /** Archive ID in database */
  archiveId?: string
  /** Total positions imported */
  positionsImported: number
  /** Positions verified by ground truth */
  positionsVerified: number
  /** Error message if failed */
  error?: string
  /** Detailed errors */
  errors: ReplayError[]
  /** Processing statistics */
  stats?: ReplayStats
}

/**
 * File upload info
 */
export interface FileUpload {
  /** Original filename */
  filename: string
  /** File content (text) */
  content: string
  /** File size in bytes */
  sizeBytes: number
  /** Source URL if from web */
  sourceUrl?: string
  /** Source collection identifier */
  sourceCollection?: string
}

// =============================================================================
// VERIFICATION TYPES
// =============================================================================

/**
 * Verification result for a single position
 */
export interface PositionVerification {
  /** Position ID */
  positionId: string
  /** Whether verification succeeded */
  verified: boolean
  /** Best move from engine */
  bestMove?: string
  /** Best move equity */
  bestEquity?: number
  /** Second best move */
  secondBestMove?: string
  /** Second best equity */
  secondEquity?: number
  /** Third best move */
  thirdBestMove?: string
  /** Third best equity */
  thirdEquity?: number
  /** Error if verification failed */
  error?: string
}

/**
 * Batch verification result
 */
export interface BatchVerificationResult {
  /** Total positions in batch */
  total: number
  /** Successfully verified */
  verified: number
  /** Failed to verify */
  failed: number
  /** Individual results */
  results: PositionVerification[]
  /** Processing time in ms */
  processingTimeMs: number
}

// =============================================================================
// PARSER CONFIGURATION
// =============================================================================

/**
 * Parser options
 */
export interface ParserOptions {
  /** Whether to be strict about format violations */
  strict?: boolean
  /** Maximum games to parse (for testing) */
  maxGames?: number
  /** Whether to include games with parse errors */
  includePartialGames?: boolean
}

/**
 * Parser result
 */
export interface ParserResult {
  /** Parsed match data */
  match?: ParsedMatch
  /** Success or failure */
  success: boolean
  /** Parser errors */
  errors: ParserError[]
  /** Parser warnings */
  warnings: ParserWarning[]
}

/**
 * Parser error
 */
export interface ParserError {
  /** Line number where error occurred */
  line: number
  /** Column number if applicable */
  column?: number
  /** Error message */
  message: string
  /** The problematic content */
  content?: string
}

/**
 * Parser warning (non-fatal)
 */
export interface ParserWarning {
  /** Line number */
  line: number
  /** Warning message */
  message: string
  /** Auto-fix applied */
  autoFixed?: boolean
}

// =============================================================================
// DATABASE TYPES (matching Prisma models)
// =============================================================================

/**
 * Match archive record (Prisma model shape)
 */
export interface MatchArchiveRecord {
  id: string
  filename: string
  sourceUrl?: string | null
  sourceCollection?: string | null
  totalMatches: number
  totalGames: number
  totalPositions: number
  positionsVerified: number
  importStatus: ImportStatus
  errorMessage?: string | null
  createdAt: Date
  completedAt?: Date | null
}

/**
 * Imported match record (Prisma model shape)
 */
export interface ImportedMatchRecord {
  id: string
  archiveId: string
  tournamentName?: string | null
  matchLength: number
  player1Name: string
  player1Country?: string | null
  player2Name: string
  player2Country?: string | null
  totalGames: number
  winner?: number | null
  datePlayedEstimate?: Date | null
  createdAt: Date
}

/**
 * Position library record with match context
 */
export interface PositionWithContext {
  positionId: string
  gamePhase: GamePhase
  diceRoll: string
  bestMove: string
  bestMoveEquity: number
  // Match context
  matchId?: string
  gameNumber?: number
  moveNumber?: number
  tournamentName?: string
  player1Name?: string
  player2Name?: string
}
