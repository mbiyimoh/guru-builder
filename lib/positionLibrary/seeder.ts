// lib/positionLibrary/seeder.ts
// Position seeding for drill generation

import { prisma } from '@/lib/db'
import type {
  SeededPosition,
  SeededPositionsByPhase,
  SeededPositionWithContext,
  SeededPositionsWithContextByPhase,
  AlternativeMove,
  PositionProbabilityBreakdown,
  GamePhase,
  PositionMetadata,
  PositionMatchContext,
  PositionArchiveContext,
} from './types'

/** Extended probability breakdown that may include metadata for curated positions */
interface ExtendedProbabilityBreakdown extends PositionProbabilityBreakdown {
  metadata?: {
    name: string
    description: string
  }
}

/**
 * Fisher-Yates shuffle for random position sampling.
 * Provides variety across regenerations by randomizing position order.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Default maximum positions to seed per non-OPENING phase.
 * OPENING always seeds all 21 positions (unique opening rolls).
 * Other phases are limited to prevent token explosion in prompts.
 *
 * Token Budget Calculation:
 * - Each position: ~500 chars (ASCII board + metadata) ≈ 125 tokens
 * - Per phase at 25 limit: 25 × 125 = 3,125 tokens
 * - 4 phases max: 3,125 × 4 = 12,500 tokens (safe budget)
 *
 * This value is used as fallback when DrillGenerationConfig.maxPositionsPerPhase
 * is not specified.
 *
 * @see DrillGenerationConfig.maxPositionsPerPhase for user configuration
 */
export const DEFAULT_MAX_POSITIONS_PER_PHASE = 25

/**
 * Fetch positions for a specific game phase from the Position Library.
 *
 * For OPENING phase, all positions are returned (21 unique opening rolls).
 * For other phases, positions are limited to DEFAULT_MAX_POSITIONS_PER_PHASE to prevent
 * token explosion when all positions are injected into the prompt.
 *
 * @param engineId - The ground truth engine ID
 * @param phase - The game phase to fetch
 * @param maxPositionsPerPhase - Optional override for max positions per non-OPENING phase (defaults to DEFAULT_MAX_POSITIONS_PER_PHASE)
 * @returns Array of seeded positions ready for prompt injection
 */
export async function seedPositionsForPhase(
  engineId: string,
  phase: GamePhase,
  maxPositionsPerPhase?: number
): Promise<SeededPosition[]> {
  // OPENING phase gets all positions (21 opening rolls), other phases are limited
  const limit = phase === 'OPENING' ? undefined : (maxPositionsPerPhase ?? DEFAULT_MAX_POSITIONS_PER_PHASE)

  // For non-OPENING phases, fetch 2x the limit to enable random sampling
  // This provides variety across regenerations
  const fetchLimit = phase === 'OPENING' ? undefined : (limit ? limit * 2 : undefined)

  const positions = await prisma.positionLibrary.findMany({
    where: {
      engineId,
      gamePhase: phase
    },
    orderBy: phase === 'OPENING' ? { diceRoll: 'asc' } : { createdAt: 'desc' },
    take: fetchLimit
  })

  // For non-OPENING phases, shuffle positions for variety then take the limit
  const positionsToProcess = phase === 'OPENING'
    ? positions
    : shuffleArray(positions).slice(0, limit)

  return positionsToProcess.map(p => {
    // Parse probability breakdown from JSON (may include metadata for curated positions)
    const probBreakdown = p.probabilityBreakdown as ExtendedProbabilityBreakdown | null

    // Build alternatives with probability data
    const alternatives: AlternativeMove[] = []
    if (p.secondBestMove && p.secondEquity !== null) {
      alternatives.push({
        move: p.secondBestMove,
        equity: p.secondEquity,
        probability: probBreakdown?.second ?? undefined
      })
    }
    if (p.thirdBestMove && p.thirdEquity !== null) {
      alternatives.push({
        move: p.thirdBestMove,
        equity: p.thirdEquity,
        probability: probBreakdown?.third ?? undefined
      })
    }

    // Extract metadata for curated (non-opening) positions
    let metadata: PositionMetadata | undefined
    if (probBreakdown?.metadata) {
      metadata = {
        name: probBreakdown.metadata.name,
        description: probBreakdown.metadata.description
      }
    }

    return {
      positionId: p.positionId,
      diceRoll: p.diceRoll,
      bestMove: p.bestMove,
      bestMoveEquity: p.bestMoveEquity,
      bestMoveProbability: probBreakdown?.best ?? undefined,
      alternatives,
      asciiBoard: p.asciiBoard,
      metadata
    }
  })
}

/**
 * Seed positions by phase for drill generation.
 * Fetches positions for all phases from the database.
 *
 * @param engineId - The ground truth engine ID
 * @param requestedPhases - Optional array of phases to fetch (defaults to all)
 * @param maxPositionsPerPhase - Optional limit for non-OPENING phases (defaults to DEFAULT_MAX_POSITIONS_PER_PHASE)
 * @returns Positions grouped by game phase, or null if none available
 */
export async function seedPositionsByPhase(
  engineId: string,
  requestedPhases?: GamePhase[],
  maxPositionsPerPhase?: number
): Promise<SeededPositionsByPhase | null> {
  // Determine which phases to fetch (default to all)
  const phases = requestedPhases ?? ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as GamePhase[]

  // Fetch positions for all requested phases in parallel
  const [opening, early, middle, bearoff] = await Promise.all([
    phases.includes('OPENING') ? seedPositionsForPhase(engineId, 'OPENING', maxPositionsPerPhase) : Promise.resolve([]),
    phases.includes('EARLY') ? seedPositionsForPhase(engineId, 'EARLY', maxPositionsPerPhase) : Promise.resolve([]),
    phases.includes('MIDDLE') ? seedPositionsForPhase(engineId, 'MIDDLE', maxPositionsPerPhase) : Promise.resolve([]),
    phases.includes('BEAROFF') ? seedPositionsForPhase(engineId, 'BEAROFF', maxPositionsPerPhase) : Promise.resolve([]),
  ])

  // Calculate totals
  const totalCount = opening.length + early.length + middle.length + bearoff.length

  // If no positions available, return null to trigger fallback
  if (totalCount === 0) {
    console.warn('[Seeder] No positions found for any requested phase, engine:', engineId)
    return null
  }

  console.log(`[Seeder] Seeded positions: OPENING=${opening.length}, EARLY=${early.length}, MIDDLE=${middle.length}, BEAROFF=${bearoff.length}`)

  return {
    OPENING: opening,
    EARLY: early,
    MIDDLE: middle,
    BEAROFF: bearoff
  }
}

/**
 * Get position IDs used in a seeded positions set.
 * Useful for tracking which positions were used in drill generation.
 *
 * @param seededPositions - The seeded positions object
 * @returns Array of position IDs
 */
export function getPositionIdsFromSeeded(
  seededPositions: SeededPositionsByPhase | null
): string[] {
  if (!seededPositions) return []

  return [
    ...seededPositions.OPENING,
    ...seededPositions.EARLY,
    ...seededPositions.MIDDLE,
    ...seededPositions.BEAROFF
  ].map(p => p.positionId)
}

// =============================================================================
// POSITION SEEDING WITH CONTEXT (Phase-Organized Drill Library)
// =============================================================================

/**
 * Fetch positions for a phase with full match/archive context.
 * Used for generating drills with position attribution.
 *
 * For OPENING phase, all positions are returned (21 unique opening rolls).
 * For other phases, positions are limited to DEFAULT_MAX_POSITIONS_PER_PHASE.
 *
 * @param engineId - The ground truth engine ID
 * @param phase - The game phase to fetch
 * @param maxPositionsPerPhase - Optional override for max positions per non-OPENING phase (defaults to DEFAULT_MAX_POSITIONS_PER_PHASE)
 * @returns Array of positions with full context
 */
export async function seedPositionsForPhaseWithContext(
  engineId: string,
  phase: GamePhase,
  maxPositionsPerPhase?: number
): Promise<SeededPositionWithContext[]> {
  // OPENING phase gets all positions (21 opening rolls), other phases are limited
  const limit = phase === 'OPENING' ? undefined : (maxPositionsPerPhase ?? DEFAULT_MAX_POSITIONS_PER_PHASE)

  // For non-OPENING phases, fetch 2x the limit to enable random sampling
  const fetchLimit = phase === 'OPENING' ? undefined : (limit ? limit * 2 : undefined)

  const positions = await prisma.positionLibrary.findMany({
    where: {
      engineId,
      gamePhase: phase,
    },
    include: {
      match: {
        select: {
          player1Name: true,
          player1Country: true,
          player2Name: true,
          player2Country: true,
          tournamentName: true,
          matchLength: true,
        },
      },
      archive: {
        select: {
          filename: true,
          sourceCollection: true,
        },
      },
    },
    orderBy: phase === 'OPENING' ? { diceRoll: 'asc' } : { createdAt: 'desc' },
    take: fetchLimit,
  })

  // For non-OPENING phases, shuffle positions for variety then take the limit
  const positionsToProcess = phase === 'OPENING'
    ? positions
    : shuffleArray(positions).slice(0, limit)

  return positionsToProcess.map((p) => {
    // Parse probability breakdown
    const probBreakdown = p.probabilityBreakdown as ExtendedProbabilityBreakdown | null

    // Build alternatives with probability data
    const alternatives: AlternativeMove[] = []
    if (p.secondBestMove && p.secondEquity !== null) {
      alternatives.push({
        move: p.secondBestMove,
        equity: p.secondEquity,
        probability: probBreakdown?.second ?? undefined,
      })
    }
    if (p.thirdBestMove && p.thirdEquity !== null) {
      alternatives.push({
        move: p.thirdBestMove,
        equity: p.thirdEquity,
        probability: probBreakdown?.third ?? undefined,
      })
    }

    // Extract metadata for curated positions
    let metadata: PositionMetadata | undefined
    if (probBreakdown?.metadata) {
      metadata = {
        name: probBreakdown.metadata.name,
        description: probBreakdown.metadata.description,
      }
    }

    // Build match context if available
    let matchContext: PositionMatchContext | undefined
    if (p.match) {
      matchContext = {
        player1Name: p.match.player1Name,
        player1Country: p.match.player1Country ?? undefined,
        player2Name: p.match.player2Name,
        player2Country: p.match.player2Country ?? undefined,
        tournamentName: p.match.tournamentName ?? undefined,
        matchLength: p.match.matchLength,
        gameNumber: p.gameNumber ?? undefined,
        moveNumber: p.moveNumber ?? undefined,
      }
    }

    // Build archive context if available
    let archiveContext: PositionArchiveContext | undefined
    if (p.archive) {
      archiveContext = {
        filename: p.archive.filename,
        sourceCollection: p.archive.sourceCollection ?? undefined,
      }
    }

    return {
      // Base SeededPosition fields
      positionId: p.positionId,
      diceRoll: p.diceRoll,
      bestMove: p.bestMove,
      bestMoveEquity: p.bestMoveEquity,
      bestMoveProbability: probBreakdown?.best ?? undefined,
      alternatives,
      asciiBoard: p.asciiBoard,
      metadata,

      // Extended context fields
      libraryId: p.id,
      sourceType: p.sourceType,
      match: matchContext,
      archive: archiveContext,
    }
  })
}

/**
 * Seed positions by phase with full context for drill generation.
 *
 * @param engineId - The ground truth engine ID
 * @param requestedPhases - Optional array of phases to fetch (defaults to all)
 * @param maxPositionsPerPhase - Optional limit for non-OPENING phases (defaults to DEFAULT_MAX_POSITIONS_PER_PHASE)
 * @returns Positions grouped by phase with full context, or null if none available
 */
export async function seedPositionsByPhaseWithContext(
  engineId: string,
  requestedPhases?: GamePhase[],
  maxPositionsPerPhase?: number
): Promise<SeededPositionsWithContextByPhase | null> {
  const phases = requestedPhases ?? (['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as GamePhase[])

  const [opening, early, middle, bearoff] = await Promise.all([
    phases.includes('OPENING') ? seedPositionsForPhaseWithContext(engineId, 'OPENING', maxPositionsPerPhase) : Promise.resolve([]),
    phases.includes('EARLY') ? seedPositionsForPhaseWithContext(engineId, 'EARLY', maxPositionsPerPhase) : Promise.resolve([]),
    phases.includes('MIDDLE') ? seedPositionsForPhaseWithContext(engineId, 'MIDDLE', maxPositionsPerPhase) : Promise.resolve([]),
    phases.includes('BEAROFF') ? seedPositionsForPhaseWithContext(engineId, 'BEAROFF', maxPositionsPerPhase) : Promise.resolve([]),
  ])

  const totalCount = opening.length + early.length + middle.length + bearoff.length

  if (totalCount === 0) {
    console.warn('[Seeder] No positions with context found for any requested phase, engine:', engineId)
    return null
  }

  console.log(`[Seeder] Seeded positions with context: OPENING=${opening.length}, EARLY=${early.length}, MIDDLE=${middle.length}, BEAROFF=${bearoff.length}`)

  return {
    OPENING: opening,
    EARLY: early,
    MIDDLE: middle,
    BEAROFF: bearoff,
  }
}

/**
 * Get library IDs from seeded positions with context.
 * Useful for tracking which positions were used in drill generation.
 */
export function getLibraryIdsFromSeededWithContext(
  seededPositions: SeededPositionsWithContextByPhase | null
): string[] {
  if (!seededPositions) return []

  return [
    ...seededPositions.OPENING,
    ...seededPositions.EARLY,
    ...seededPositions.MIDDLE,
    ...seededPositions.BEAROFF,
  ].map((p) => p.libraryId)
}
