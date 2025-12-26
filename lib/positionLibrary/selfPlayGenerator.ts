/**
 * Self-Play Position Generator
 *
 * Simulates backgammon games using GNUBG engine and collects all positions
 * that occur during gameplay. These positions are stored in the Position Library
 * for use in scenario-based drill generation.
 */

import {
  INITIAL_BOARD,
  cloneBoard,
  calculatePipCount,
  countCheckers,
  generateAsciiBoard,
  generatePositionIdFromBoard,
  boardStateToMCPFormat,
} from '../matchImport/replayEngine'
import { getPlaysForPosition, formatMove } from '../groundTruth/mcpClient'
import type { PlaysResult, PlaysBoardConfig } from '../groundTruth/mcpClient'
import { classifyPhase } from '../matchImport/phaseClassifier'
import type { GroundTruthConfig } from '../groundTruth/types'
import type { BoardState, ReplayedPosition } from '../matchImport/types'
import type { GamePhase } from '@prisma/client'

// =============================================================================
// TYPES
// =============================================================================

export interface SelfPlayConfig {
  gamesCount: number // How many games to simulate
  skipOpening: boolean // Skip opening positions (we have catalog)
  engineConfig: GroundTruthConfig
  batchId: string // For tracking
  onProgress?: (progress: SelfPlayProgress) => Promise<void>
}

export interface SelfPlayProgress {
  gamesCompleted: number
  gamesTotal: number
  positionsStored: number
  duplicatesSkipped: number
  currentGameMoveNumber: number
}

export interface SelfPlayResult {
  success: boolean
  gamesPlayed: number
  positions: GeneratedPosition[]
  duplicatesSkipped: number
  errors: string[]
}

export interface GeneratedPosition {
  positionId: string
  gamePhase: GamePhase
  diceRoll: string
  board: BoardState
  player: 'x' | 'o'
  bestMove: string
  bestMoveEquity: number
  secondBestMove?: string
  secondEquity?: number
  thirdBestMove?: string
  thirdEquity?: number
  probabilityBreakdown?: {
    best?: PlaysResult['evaluation']['probability']
    second?: PlaysResult['evaluation']['probability']
    third?: PlaysResult['evaluation']['probability']
  }
  asciiBoard: string
  gameNumber: number
  moveNumber: number
}

// =============================================================================
// DICE ROLLING
// =============================================================================

/**
 * Roll two fair dice (1-6)
 */
export function rollDice(): [number, number] {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return [die1, die2]
}

/**
 * Format dice roll as string (e.g., "6-4")
 * Always puts larger die first for consistency
 */
export function formatDiceRoll(dice: [number, number]): string {
  const [d1, d2] = dice
  return d1 >= d2 ? `${d1}-${d2}` : `${d2}-${d1}`
}

// =============================================================================
// GAME LOGIC
// =============================================================================

/**
 * Check if the game is over (one player has borne off all checkers)
 * Uses existing countCheckers utility from replayEngine
 */
export function isGameOver(board: BoardState): { over: boolean; winner?: 'x' | 'o' } {
  const xCheckers = countCheckers(board, 'x')
  const oCheckers = countCheckers(board, 'o')

  if (xCheckers === 0) return { over: true, winner: 'x' }
  if (oCheckers === 0) return { over: true, winner: 'o' }

  return { over: false }
}

/**
 * Apply a move returned by GNUBG to the board.
 *
 * GNUBG returns moves with point numbers from the moving player's perspective:
 * - For X: points 1-24 where X's home = 1-6
 * - For O: points 1-24 where O's home = 1-6 (which is X's 19-24)
 *
 * Our internal board uses X's perspective always.
 */
export function applyGnubgMove(
  board: BoardState,
  play: Array<{ from: string; to: string }>,
  player: 'x' | 'o'
): BoardState {
  const newBoard = cloneBoard(board)

  for (const move of play) {
    if (player === 'x') {
      // X's move - GNUBG already uses X's perspective
      const from = move.from === 'bar' ? 0 : parseInt(move.from)
      const to = move.to === 'off' ? -1 : parseInt(move.to)

      // Remove from source
      if (from === 0) {
        newBoard[0]-- // X's bar
      } else {
        newBoard[from]--
      }

      // Add to destination (unless bearing off)
      if (to !== -1) {
        // Check for hit
        if (newBoard[to] === -1) {
          newBoard[to] = 1 // Replace O's blot with X
          newBoard[25]-- // O goes to bar (more negative)
        } else {
          newBoard[to]++
        }
      }
    } else {
      // O's move - GNUBG uses O's perspective, need to convert
      // O's point 1 = X's point 24, O's point 24 = X's point 1
      const fromO = move.from === 'bar' ? 'bar' : parseInt(move.from)
      const toO = move.to === 'off' ? 'off' : parseInt(move.to)

      // Convert to X's perspective
      const from = fromO === 'bar' ? 25 : (25 - fromO)
      const to = toO === 'off' ? -1 : (25 - toO)

      // Remove from source
      if (from === 25) {
        newBoard[25]++ // O's bar (less negative)
      } else {
        newBoard[from]++ // Remove O checker (less negative)
      }

      // Add to destination (unless bearing off)
      if (to !== -1) {
        // Check for hit
        if (newBoard[to] === 1) {
          newBoard[to] = -1 // Replace X's blot with O
          newBoard[0]++ // X goes to bar
        } else {
          newBoard[to]-- // Add O checker (more negative)
        }
      }
    }
  }

  return newBoard
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Simulate a single game and collect all positions
 */
export async function simulateSingleGame(
  engineConfig: GroundTruthConfig,
  gameNumber: number,
  skipOpening: boolean = true
): Promise<{ positions: GeneratedPosition[]; errors: string[] }> {
  const positions: GeneratedPosition[] = []
  const errors: string[] = []

  let board = cloneBoard(INITIAL_BOARD)
  let moveNumber = 0
  let player: 'x' | 'o' = 'x' // X always moves first

  const MAX_MOVES = 200 // Safety limit

  while (moveNumber < MAX_MOVES) {
    const gameStatus = isGameOver(board)
    if (gameStatus.over) break

    const dice = rollDice()
    moveNumber++

    try {
      // Build board config for GNUBG
      const boardConfig: PlaysBoardConfig = {
        board: boardStateToMCPFormat(board),
        cubeful: false, // Money play, no cube
        dice: dice,
        player: player,
        'max-moves': 3,
        'score-moves': true,
      }

      // Get best moves from GNUBG
      const moves = await getPlaysForPosition(boardConfig, engineConfig)

      if (moves.length === 0) {
        // No legal moves (e.g., all blocked) - skip turn
        player = player === 'x' ? 'o' : 'x'
        continue
      }

      const bestMove = moves[0]
      const secondBest = moves[1]
      const thirdBest = moves[2]

      // Classify phase
      const replayedPos: ReplayedPosition = {
        board: cloneBoard(board),
        dice: dice,
        player: player,
        moveNumber: moveNumber,
        gameNumber: gameNumber,
        pipCountX: calculatePipCount(board, 'x'),
        pipCountO: calculatePipCount(board, 'o'),
      }
      const phase = classifyPhase(replayedPos)

      // Decide whether to store this position
      const shouldStore = !skipOpening || phase.phase !== 'OPENING'

      if (shouldStore) {
        const positionId = generatePositionIdFromBoard(board, dice, player)

        positions.push({
          positionId,
          gamePhase: phase.phase as GamePhase,
          diceRoll: formatDiceRoll(dice),
          board: cloneBoard(board),
          player,
          bestMove: formatMove(bestMove.play),
          bestMoveEquity: bestMove.evaluation.eq,
          secondBestMove: secondBest ? formatMove(secondBest.play) : undefined,
          secondEquity: secondBest?.evaluation.eq,
          thirdBestMove: thirdBest ? formatMove(thirdBest.play) : undefined,
          thirdEquity: thirdBest?.evaluation.eq,
          probabilityBreakdown: {
            best: bestMove.evaluation.probability,
            second: secondBest?.evaluation.probability,
            third: thirdBest?.evaluation.probability,
          },
          asciiBoard: generateAsciiBoard(board),
          gameNumber,
          moveNumber,
        })
      }

      // Apply the best move to advance the game
      board = applyGnubgMove(board, bestMove.play, player)

      // Switch player
      player = player === 'x' ? 'o' : 'x'
    } catch (error) {
      errors.push(
        `Game ${gameNumber}, Move ${moveNumber}: ${error instanceof Error ? error.message : String(error)}`
      )
      // Continue with next move by switching player
      player = player === 'x' ? 'o' : 'x'
    }
  }

  return { positions, errors }
}

/**
 * Run full self-play generation batch
 */
export async function runSelfPlayBatch(config: SelfPlayConfig): Promise<SelfPlayResult> {
  const allPositions: GeneratedPosition[] = []
  const allErrors: string[] = []
  let duplicatesSkipped = 0

  // Track seen position IDs within this batch
  const seenPositionIds = new Set<string>()

  for (let gameNum = 1; gameNum <= config.gamesCount; gameNum++) {
    const gameResult = await simulateSingleGame(
      config.engineConfig,
      gameNum,
      config.skipOpening
    )

    // Deduplicate within batch
    for (const pos of gameResult.positions) {
      if (seenPositionIds.has(pos.positionId)) {
        duplicatesSkipped++
      } else {
        seenPositionIds.add(pos.positionId)
        allPositions.push(pos)
      }
    }

    allErrors.push(...gameResult.errors)

    // Report progress
    if (config.onProgress) {
      await config.onProgress({
        gamesCompleted: gameNum,
        gamesTotal: config.gamesCount,
        positionsStored: allPositions.length,
        duplicatesSkipped,
        currentGameMoveNumber: 0,
      })
    }
  }

  return {
    success: allErrors.length === 0,
    gamesPlayed: config.gamesCount,
    positions: allPositions,
    duplicatesSkipped,
    errors: allErrors,
  }
}
