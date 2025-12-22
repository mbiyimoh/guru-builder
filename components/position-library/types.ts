// Types for Position Library Browser components

import { GamePhase, PositionSource } from '@prisma/client'

export type { GamePhase, PositionSource }

/**
 * Match metadata from ImportedMatch relation
 */
export interface MatchMetadata {
  player1Name: string
  player1Country: string | null
  player2Name: string
  player2Country: string | null
  tournamentName: string | null
  matchLength: number
}

/**
 * Archive metadata from MatchArchive relation
 */
export interface ArchiveMetadata {
  filename: string
  sourceCollection: string | null
}

/**
 * Position data as returned by the API with relations
 */
export interface PositionWithRelations {
  id: string
  positionId: string
  gamePhase: GamePhase
  diceRoll: string
  bestMove: string
  bestMoveEquity: number
  secondBestMove: string | null
  secondEquity: number | null
  thirdBestMove: string | null
  thirdEquity: number | null
  asciiBoard: string
  sourceType: PositionSource
  gameNumber: number | null
  moveNumber: number | null
  createdAt: string
  engine: {
    id: string
    name: string
    domain: string
  }
  archive: ArchiveMetadata | null
  match: MatchMetadata | null
}

/**
 * API response from /api/position-library
 */
export interface PositionLibraryResponse {
  positions: PositionWithRelations[]
  counts: Record<string, number>
  total: number
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}
