// lib/positionLibrary/openings.ts
// Opening position population for the Position Library

import { prisma } from '@/lib/db'
import { getOpeningMoves, formatMove, clearSession } from '@/lib/groundTruth/mcpClient'
import type { GroundTruthConfig } from '@/lib/groundTruth/types'
import type { PopulationResult } from './types'
import { renderOpeningBoard } from './asciiRenderer'

/**
 * The 21 unique opening rolls in backgammon.
 * Non-doubles: 15 combinations (6-5 through 2-1)
 * Doubles: 6 combinations (6-6 through 1-1)
 */
export const OPENING_ROLLS = [
  // Non-doubles (15 combinations)
  '6-5', '6-4', '6-3', '6-2', '6-1',
  '5-4', '5-3', '5-2', '5-1',
  '4-3', '4-2', '4-1',
  '3-2', '3-1',
  '2-1',
  // Doubles (6 combinations)
  '6-6', '5-5', '4-4', '3-3', '2-2', '1-1'
] as const

export type OpeningRoll = typeof OPENING_ROLLS[number]

/**
 * Standard opening position identifier.
 * In GNUBG, the opening position is the default starting position.
 */
export const OPENING_POSITION_ID = 'opening'

/**
 * Parse dice string to array of numbers.
 * @param dice - Dice string like "3-1" or "6-6"
 * @returns Array of two dice values [3, 1]
 */
function parseDice(dice: string): [number, number] {
  const parts = dice.split('-').map(d => parseInt(d, 10))
  return [parts[0], parts[1]]
}

/**
 * Populate the Position Library with all 21 opening roll positions.
 * Queries the GNUBG engine for best moves for each roll using MCP protocol.
 *
 * @param engineConfig - Ground truth engine configuration
 * @returns Result with count of populated positions and any errors
 */
export async function populateOpeningPositions(
  engineConfig: GroundTruthConfig
): Promise<PopulationResult> {
  const errors: string[] = []
  let populated = 0

  console.log(`[PositionLibrary] Starting population of ${OPENING_ROLLS.length} opening positions`)

  // Clear any stale session
  clearSession(engineConfig.engineUrl)

  for (const dice of OPENING_ROLLS) {
    try {
      console.log(`[PositionLibrary] Querying engine for opening roll: ${dice}`)

      // Parse dice for engine call
      const [die1, die2] = parseDice(dice)

      // Query engine for best moves using MCP client
      const moves = await getOpeningMoves(die1, die2, engineConfig, 3)

      if (!moves || moves.length === 0) {
        const errorMsg = `No moves returned for ${dice}`
        console.error(`[PositionLibrary] ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }

      // Format moves to standard notation
      const bestMove = formatMove(moves[0].play)
      const secondMove = moves[1] ? formatMove(moves[1].play) : null
      const thirdMove = moves[2] ? formatMove(moves[2].play) : null

      // Build probability breakdown for all moves
      const probabilityBreakdown = {
        best: moves[0].evaluation.probability,
        second: moves[1]?.evaluation.probability ?? null,
        third: moves[2]?.evaluation.probability ?? null
      }

      // Generate position ID for this opening roll
      const positionId = `opening-${dice}`

      // Upsert position to database
      await prisma.positionLibrary.upsert({
        where: { positionId },
        create: {
          positionId,
          gamePhase: 'OPENING',
          diceRoll: dice,
          bestMove,
          bestMoveEquity: moves[0].evaluation.eq,
          secondBestMove: secondMove,
          secondEquity: moves[1]?.evaluation.eq ?? null,
          thirdBestMove: thirdMove,
          thirdEquity: moves[2]?.evaluation.eq ?? null,
          probabilityBreakdown,
          asciiBoard: renderOpeningBoard(dice),
          sourceType: 'OPENING_CATALOG',
          engineId: engineConfig.engineId
        },
        update: {
          bestMove,
          bestMoveEquity: moves[0].evaluation.eq,
          secondBestMove: secondMove,
          secondEquity: moves[1]?.evaluation.eq ?? null,
          thirdBestMove: thirdMove,
          thirdEquity: moves[2]?.evaluation.eq ?? null,
          probabilityBreakdown,
          asciiBoard: renderOpeningBoard(dice)
        }
      })

      populated++
      console.log(`[PositionLibrary] Populated ${positionId}: ${bestMove} (eq: ${moves[0].evaluation.eq.toFixed(3)})`)

    } catch (error) {
      const errorMsg = `Error processing ${dice}: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(`[PositionLibrary] ${errorMsg}`)
      errors.push(errorMsg)

      // Clear session on error to force reconnection
      clearSession(engineConfig.engineUrl)
    }
  }

  console.log(`[PositionLibrary] Population complete: ${populated}/${OPENING_ROLLS.length} positions`)

  return { populated, errors }
}

/**
 * Get all opening positions from the database.
 * @returns Array of opening positions
 */
export async function getOpeningPositions() {
  return prisma.positionLibrary.findMany({
    where: { gamePhase: 'OPENING' },
    orderBy: { diceRoll: 'asc' }
  })
}

/**
 * Get opening position by dice roll.
 * @param diceRoll - The dice roll (e.g., "3-1")
 * @returns Position or null if not found
 */
export async function getOpeningByDice(diceRoll: string) {
  return prisma.positionLibrary.findUnique({
    where: { positionId: `opening-${diceRoll}` }
  })
}

/**
 * Check if all opening positions are populated.
 * @returns True if all 21 positions exist
 */
export async function areOpeningsPopulated(): Promise<boolean> {
  const count = await prisma.positionLibrary.count({
    where: { gamePhase: 'OPENING' }
  })
  return count >= OPENING_ROLLS.length
}
