/**
 * Match Archive Import System
 *
 * Barrel export for all match import functionality.
 */

// Types
export type {
  ParsedMatch,
  ParsedGame,
  ParsedMove,
  PlayerInfo,
  MoveNotation,
  MatchMetadata,
  DiceRoll,
  GameOutcome,
  ReplayedPosition,
  BoardState,
  MatchReplayResult,
  ReplayError,
  ReplayStats,
  GamePhase,
  PhaseClassification,
  ImportStatus,
  ImportProgress,
  ImportResult,
  FileUpload,
  PositionVerification,
  BatchVerificationResult,
  ParserOptions,
  ParserResult,
  ParserError,
  ParserWarning,
  MatchArchiveRecord,
  ImportedMatchRecord,
  PositionWithContext,
} from './types'

// Parser
export {
  parseJellyFishMatch,
  enrichMatchMetadata,
  validateParsedMatch,
  countExpectedPositions,
} from './jellyFishParser'

// Replay Engine
export {
  INITIAL_BOARD,
  cloneBoard,
  calculatePipCount,
  allInHomeBoard,
  countCheckers,
  convertPointToXPerspective,
  applyMove,
  applyMoves,
  replayMatch,
  replayGame,
  generateAsciiBoard,
  generatePositionHash,
  boardToGnubgId,
  boardStateToMCPFormat,
  generatePositionIdFromBoard,
} from './replayEngine'
export type { BoardPosition } from './replayEngine'

// Phase Classifier
export {
  classifyPhase,
  isBearoffPosition,
  isPureBearoff,
  isRacePosition,
  analyzePosition,
  classifyPositions,
  getPhaseDistribution,
} from './phaseClassifier'
export type { PositionCharacteristics } from './phaseClassifier'

// File Storage
export {
  storeArchiveFile,
  readArchiveFile,
  archiveFileExists,
  deleteArchiveFile,
  getArchiveFileSize,
  listArchiveFiles,
} from './fileStorage'

// Scraper
export {
  discoverHardyArchives,
  downloadArchive,
  filterAlreadyImported,
} from './scraper'
export type { DiscoveredArchive, ScrapeResult } from './scraper'
