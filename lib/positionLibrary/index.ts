// lib/positionLibrary/index.ts
// Barrel export for Position Library module

// Types
export type {
  PositionData,
  SeededPosition,
  SeededPositionsByPhase,
  SeededPositionWithContext,
  SeededPositionsWithContextByPhase,
  PositionMatchContext,
  PositionArchiveContext,
  PopulationResult,
  GamePhase,
  PositionSource,
  EngineMove,
  GetBestMovesResult
} from './types'

// Opening positions
export {
  OPENING_ROLLS,
  OPENING_POSITION_ID,
  populateOpeningPositions,
  getOpeningPositions,
  getOpeningByDice,
  areOpeningsPopulated
} from './openings'
export type { OpeningRoll } from './openings'

// ASCII rendering
export { renderOpeningBoard, renderAsciiBoard, renderBoardFromPosition } from './asciiRenderer'

// Position seeding
export {
  seedPositionsForPhase,
  seedPositionsByPhase,
  getPositionIdsFromSeeded,
  // With context (for position attribution)
  seedPositionsForPhaseWithContext,
  seedPositionsByPhaseWithContext,
  getLibraryIdsFromSeededWithContext,
  // Constants
  DEFAULT_MAX_POSITIONS_PER_PHASE
} from './seeder'
