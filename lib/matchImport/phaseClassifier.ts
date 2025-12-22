/**
 * Game Phase Classifier
 *
 * Classifies backgammon positions into game phases:
 * - OPENING: First 1-2 moves of the game
 * - EARLY: Development phase (moves 3-6, pip count > 120)
 * - MIDDLE: Main game (complex positions)
 * - BEAROFF: All checkers in home board, bearing off
 */

import type {
  ReplayedPosition,
  BoardState,
  GamePhase,
  PhaseClassification,
} from './types'
import { allInHomeBoard, calculatePipCount, countCheckers } from './replayEngine'

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Opening phase threshold - moves 1-2 are considered opening
 */
const OPENING_MOVE_THRESHOLD = 2

/**
 * Early game threshold - moves 3-6 with high pip count
 */
const EARLY_MOVE_THRESHOLD = 6

/**
 * Pip count threshold for early vs middle game
 * Above this is early, below is middle (unless bearoff)
 */
const EARLY_PIP_THRESHOLD = 120

/**
 * Standard starting pip count per player
 */
const STARTING_PIP_COUNT = 167

// =============================================================================
// PHASE CLASSIFICATION
// =============================================================================

/**
 * Classify the phase of a replayed position
 *
 * @param position - The position to classify
 * @returns Phase classification with confidence and reasoning
 */
export function classifyPhase(position: ReplayedPosition): PhaseClassification {
  const { moveNumber, board, pipCountX, pipCountO } = position

  // Check BEAROFF first (takes precedence)
  if (isBearoffPosition(board)) {
    return {
      phase: 'BEAROFF',
      confidence: 1.0,
      reason: 'All checkers in home board',
    }
  }

  // Check OPENING (first 1-2 moves)
  if (moveNumber <= OPENING_MOVE_THRESHOLD) {
    // Also verify the position looks like an opening
    const totalPips = pipCountX + pipCountO
    const nearStarting = totalPips >= STARTING_PIP_COUNT * 2 - 20 // Within ~10 pips per side

    if (nearStarting) {
      return {
        phase: 'OPENING',
        confidence: 0.95,
        reason: `Move ${moveNumber}, near starting pip count`,
      }
    }
  }

  // Check EARLY (moves 3-6 with high pip count)
  if (moveNumber <= EARLY_MOVE_THRESHOLD) {
    const avgPipCount = (pipCountX + pipCountO) / 2
    if (avgPipCount >= EARLY_PIP_THRESHOLD) {
      return {
        phase: 'EARLY',
        confidence: 0.85,
        reason: `Move ${moveNumber}, average pip count ${avgPipCount.toFixed(0)}`,
      }
    }
  }

  // Check for late game / race
  const avgPipCount = (pipCountX + pipCountO) / 2
  if (avgPipCount < 60) {
    // Low pip count but not bearoff - this is a race
    return {
      phase: 'MIDDLE',
      confidence: 0.75,
      reason: 'Late race position',
    }
  }

  // Default: MIDDLE game
  return {
    phase: 'MIDDLE',
    confidence: 0.8,
    reason: `Standard middle game, move ${moveNumber}`,
  }
}

/**
 * Check if a position is a bearoff position
 * Both players have all checkers in their home boards
 */
export function isBearoffPosition(board: BoardState): boolean {
  const xInHome = allInHomeBoard(board, 'x')
  const oInHome = allInHomeBoard(board, 'o')

  // It's a bearoff if at least one player is in bearoff
  // (the other might already have borne off all checkers)
  return xInHome || oInHome
}

/**
 * Check if a position is pure bearoff (both sides bearing off)
 */
export function isPureBearoff(board: BoardState): boolean {
  return allInHomeBoard(board, 'x') && allInHomeBoard(board, 'o')
}

/**
 * Calculate race status (both sides disengaged)
 */
export function isRacePosition(board: BoardState): boolean {
  // In a race, neither player has checkers behind the opponent
  // X shouldn't have checkers on points 19-24 if O has checkers on 1-18
  // O shouldn't have checkers on points 1-6 if X has checkers on 7-24

  // Simplified check: no checkers on opposing outer boards
  let xHasBack = false
  let oHasFront = false

  for (let point = 19; point <= 24; point++) {
    if (board[point] > 0) xHasBack = true
  }

  for (let point = 1; point <= 6; point++) {
    if (board[point] < 0) oHasFront = true
  }

  // Race if neither has checkers behind the opponent's front line
  return !xHasBack && !oHasFront
}

// =============================================================================
// POSITION CHARACTERISTICS
// =============================================================================

/**
 * Analyze position characteristics for richer classification
 */
export interface PositionCharacteristics {
  /** Is this a priming position? */
  hasPrime: boolean
  /** Prime location if exists */
  primePoints?: number[]
  /** Is this a blitz/attacking position? */
  isBlitz: boolean
  /** Is this a holding game? */
  isHoldingGame: boolean
  /** Is this a backgame? */
  isBackgame: boolean
  /** Is this a racing position? */
  isRace: boolean
  /** Number of checkers hit (on bar) */
  checkersOnBar: { x: number; o: number }
  /** Pip count differential (positive = X ahead) */
  pipDifferential: number
}

/**
 * Analyze position for rich characteristics
 */
export function analyzePosition(board: BoardState): PositionCharacteristics {
  const pipCountX = calculatePipCount(board, 'x')
  const pipCountO = calculatePipCount(board, 'o')

  // Detect prime (6 consecutive points)
  const xPrime = findPrime(board, 'x')
  const oPrime = findPrime(board, 'o')

  // Check for blitz (opponent on bar, strong board)
  const isBlitz = detectBlitz(board)

  // Check for holding game
  const isHoldingGame = detectHoldingGame(board)

  // Check for backgame
  const isBackgame = detectBackgame(board)

  return {
    hasPrime: xPrime.length >= 4 || oPrime.length >= 4,
    primePoints: xPrime.length >= oPrime.length ? xPrime : oPrime,
    isBlitz,
    isHoldingGame,
    isBackgame,
    isRace: isRacePosition(board),
    checkersOnBar: {
      x: board[0], // X_BAR
      o: Math.abs(board[25]), // O_BAR
    },
    pipDifferential: pipCountO - pipCountX, // Positive = X ahead
  }
}

/**
 * Find consecutive points owned by a player (prime)
 */
function findPrime(board: BoardState, player: 'x' | 'o'): number[] {
  const consecutive: number[] = []
  let current: number[] = []

  const start = player === 'x' ? 1 : 19
  const end = player === 'x' ? 12 : 24 // Home board blocking area

  for (let point = start; point <= end; point++) {
    const hasPoint = player === 'x'
      ? board[point] >= 2
      : board[point] <= -2

    if (hasPoint) {
      current.push(point)
    } else {
      if (current.length > consecutive.length) {
        consecutive.length = 0
        consecutive.push(...current)
      }
      current = []
    }
  }

  if (current.length > consecutive.length) {
    return current
  }

  return consecutive
}

/**
 * Detect blitz position (attacking with opponent on bar)
 */
function detectBlitz(board: BoardState): boolean {
  // O has checkers on bar, X has good home board
  const oOnBar = Math.abs(board[25]) >= 1

  if (!oOnBar) return false

  // Count X's home board points
  let xHomePoints = 0
  for (let point = 1; point <= 6; point++) {
    if (board[point] >= 2) xHomePoints++
  }

  return xHomePoints >= 4 // Strong board for blitz
}

/**
 * Detect holding game position
 */
function detectHoldingGame(board: BoardState): boolean {
  // O has an anchor on a high point (20-24)
  let oHighAnchor = false
  for (let point = 20; point <= 24; point++) {
    if (board[point] <= -2) {
      oHighAnchor = true
      break
    }
  }

  if (!oHighAnchor) return false

  // Both sides still have lots of checkers in play
  const xCheckers = countCheckers(board, 'x')
  const oCheckers = countCheckers(board, 'o')

  return xCheckers >= 10 && oCheckers >= 10
}

/**
 * Detect backgame position
 */
function detectBackgame(board: BoardState): boolean {
  // O has multiple anchors in X's home/outfield
  let oAnchors = 0
  for (let point = 1; point <= 12; point++) {
    if (board[point] <= -2) oAnchors++
  }

  if (oAnchors < 2) return false

  // X is significantly ahead in the race
  const pipCountX = calculatePipCount(board, 'x')
  const pipCountO = calculatePipCount(board, 'o')

  return pipCountO - pipCountX > 30 // X at least 30 pips ahead
}

// =============================================================================
// BATCH CLASSIFICATION
// =============================================================================

/**
 * Classify multiple positions and return statistics
 */
export function classifyPositions(
  positions: ReplayedPosition[]
): Map<GamePhase, ReplayedPosition[]> {
  const grouped = new Map<GamePhase, ReplayedPosition[]>()
  grouped.set('OPENING', [])
  grouped.set('EARLY', [])
  grouped.set('MIDDLE', [])
  grouped.set('BEAROFF', [])

  for (const position of positions) {
    const classification = classifyPhase(position)
    const list = grouped.get(classification.phase)!
    list.push(position)
  }

  return grouped
}

/**
 * Get phase distribution statistics
 */
export function getPhaseDistribution(
  positions: ReplayedPosition[]
): Record<GamePhase, number> {
  const stats: Record<GamePhase, number> = {
    OPENING: 0,
    EARLY: 0,
    MIDDLE: 0,
    BEAROFF: 0,
  }

  for (const position of positions) {
    const classification = classifyPhase(position)
    stats[classification.phase]++
  }

  return stats
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { GamePhase, PhaseClassification }
