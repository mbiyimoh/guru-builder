/**
 * Match Replay Engine
 *
 * Reconstructs board positions by replaying moves from parsed matches.
 * Produces positions suitable for verification and storage.
 */

import type {
  ParsedMatch,
  ParsedGame,
  ParsedMove,
  MoveNotation,
  DiceRoll,
  ReplayedPosition,
  BoardState,
  MatchReplayResult,
  ReplayError,
  ReplayStats,
} from './types'

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Standard backgammon starting position
 * Array indices: 0=X bar, 1-24=points, 25=O bar
 * Positive values = X checkers, Negative = O checkers
 *
 * X (White) setup: 2 on 24, 5 on 13, 3 on 8, 5 on 6
 * O (Black) setup: 2 on 1, 5 on 12, 3 on 17, 5 on 19 (from X's perspective)
 */
export const INITIAL_BOARD: BoardState = [
  0,    // 0: X's bar
  -2, 0, 0, 0, 0, 5,    // Points 1-6: O has 2 on 1, X has 5 on 6
  0, 3, 0, 0, 0, -5,    // Points 7-12: X has 3 on 8, O has 5 on 12
  5, 0, 0, 0, -3, 0,    // Points 13-18: X has 5 on 13, O has 3 on 17
  -5, 0, 0, 0, 0, 2,    // Points 19-24: O has 5 on 19, X has 2 on 24
  0,    // 25: O's bar
]

// Indexes for bar positions
const X_BAR = 0
const O_BAR = 25

// =============================================================================
// BOARD UTILITIES
// =============================================================================

/**
 * Create a deep copy of a board state
 */
export function cloneBoard(board: BoardState): BoardState {
  return [...board]
}

/**
 * Calculate pip count for a player
 *
 * @param board - Current board state
 * @param player - 'x' or 'o'
 * @returns Total pip count
 */
export function calculatePipCount(board: BoardState, player: 'x' | 'o'): number {
  let pipCount = 0

  if (player === 'x') {
    // X moves from high to low (24 -> 1 -> off)
    // Bar checkers are 25 pips away
    pipCount += board[X_BAR] * 25

    for (let point = 1; point <= 24; point++) {
      if (board[point] > 0) {
        pipCount += board[point] * point
      }
    }
  } else {
    // O moves from high to low from O's perspective
    // which is low to high from X's perspective (1 -> 24 -> off)
    // Bar checkers are 25 pips away
    pipCount += Math.abs(board[O_BAR]) * 25

    for (let point = 1; point <= 24; point++) {
      if (board[point] < 0) {
        pipCount += Math.abs(board[point]) * (25 - point)
      }
    }
  }

  return pipCount
}

/**
 * Check if a player has all checkers in home board (can bear off)
 */
export function allInHomeBoard(board: BoardState, player: 'x' | 'o'): boolean {
  if (player === 'x') {
    // X's home board is points 1-6
    // Check bar first
    if (board[X_BAR] > 0) return false
    // Check outside home board
    for (let point = 7; point <= 24; point++) {
      if (board[point] > 0) return false
    }
    return true
  } else {
    // O's home board is points 19-24 (from X's perspective)
    // Check bar first
    if (board[O_BAR] < 0) return false
    // Check outside home board
    for (let point = 1; point <= 18; point++) {
      if (board[point] < 0) return false
    }
    return true
  }
}

/**
 * Count total checkers on board for a player
 */
export function countCheckers(board: BoardState, player: 'x' | 'o'): number {
  let count = 0

  if (player === 'x') {
    count += board[X_BAR]
    for (let point = 1; point <= 24; point++) {
      if (board[point] > 0) count += board[point]
    }
  } else {
    count += Math.abs(board[O_BAR])
    for (let point = 1; point <= 24; point++) {
      if (board[point] < 0) count += Math.abs(board[point])
    }
  }

  return count
}

/**
 * Convert point number from player's perspective to X's perspective
 * In JellyFish format, points are numbered from the moving player's perspective
 *
 * @param point - Point from player's perspective (1-24, 25=bar, 0=off)
 * @param player - 'x' or 'o'
 * @returns Point from X's perspective
 */
export function convertPointToXPerspective(point: number, player: 'x' | 'o'): number {
  if (player === 'x') {
    // For X, point 25 means X's bar (index 0)
    if (point === 25) return X_BAR
    if (point === 0) return 0 // Bear off
    return point // Points 1-24 stay as is
  }

  // O's perspective: O's point 1 = X's point 24, etc.
  if (point === 0) return 0 // Bear off stays 0
  if (point === 25) return O_BAR // O's bar
  return 25 - point // Flip 1-24
}

// =============================================================================
// MOVE APPLICATION
// =============================================================================

/**
 * Apply a single checker move to the board
 *
 * @param board - Board state (mutated)
 * @param move - Move to apply
 * @param player - Player making the move
 * @returns Updated board and any error
 */
export function applyMove(
  board: BoardState,
  move: MoveNotation,
  player: 'x' | 'o'
): { board: BoardState; error?: string } {
  // Convert from player's perspective to X's perspective
  const fromX = convertPointToXPerspective(move.from, player)
  const toX = convertPointToXPerspective(move.to, player)

  if (player === 'x') {
    // Handle bar entry
    if (fromX === X_BAR) {
      if (board[X_BAR] <= 0) {
        return { board, error: 'X has no checker on bar' }
      }
      board[X_BAR]--
    } else if (fromX >= 1 && fromX <= 24) {
      if (board[fromX] <= 0) {
        return { board, error: `X has no checker on point ${fromX}` }
      }
      board[fromX]--
    }

    // Handle destination
    if (toX === 0) {
      // Bearing off - checker removed from board
    } else if (toX >= 1 && toX <= 24) {
      // Check if hitting
      if (board[toX] === -1) {
        // Hit opponent's blot
        board[toX] = 1
        board[O_BAR]-- // O goes to bar
      } else if (board[toX] < -1) {
        return { board, error: `Point ${toX} is blocked by O` }
      } else {
        board[toX]++
      }
    }
  } else {
    // Player O
    // Handle bar entry
    if (move.from === 25) {
      if (board[O_BAR] >= 0) {
        return { board, error: 'O has no checker on bar' }
      }
      board[O_BAR]++
    } else {
      const fromAbsolute = convertPointToXPerspective(move.from, 'o')
      if (board[fromAbsolute] >= 0) {
        return { board, error: `O has no checker on point ${fromAbsolute}` }
      }
      board[fromAbsolute]++
    }

    // Handle destination
    if (toX === 0) {
      // Bearing off
    } else {
      const toAbsolute = convertPointToXPerspective(move.to, 'o')
      // Check if hitting
      if (board[toAbsolute] === 1) {
        // Hit opponent's blot
        board[toAbsolute] = -1
        board[X_BAR]++ // X goes to bar
      } else if (board[toAbsolute] > 1) {
        return { board, error: `Point ${toAbsolute} is blocked by X` }
      } else {
        board[toAbsolute]--
      }
    }
  }

  return { board }
}

/**
 * Apply all moves in a turn
 */
export function applyMoves(
  board: BoardState,
  moves: MoveNotation[],
  player: 'x' | 'o'
): { board: BoardState; errors: string[] } {
  const errors: string[] = []

  for (const move of moves) {
    const result = applyMove(board, move, player)
    if (result.error) {
      errors.push(result.error)
    }
  }

  return { board, errors }
}

// =============================================================================
// REPLAY ENGINE
// =============================================================================

/**
 * Replay an entire match and extract all positions
 *
 * @param match - Parsed match data
 * @returns All positions with metadata
 */
export function replayMatch(match: ParsedMatch): MatchReplayResult {
  const startTime = Date.now()
  const positions: ReplayedPosition[] = []
  const errors: ReplayError[] = []
  const stats: ReplayStats = {
    totalGames: 0,
    totalMoves: 0,
    totalPositions: 0,
    positionsByPhase: {
      OPENING: 0,
      EARLY: 0,
      MIDDLE: 0,
      BEAROFF: 0,
    },
    processingTimeMs: 0,
  }

  for (const game of match.games) {
    const gameResult = replayGame(game)

    positions.push(...gameResult.positions)
    errors.push(...gameResult.errors)

    stats.totalGames++
    stats.totalMoves += game.moves.length
    stats.totalPositions += gameResult.positions.length
  }

  stats.processingTimeMs = Date.now() - startTime

  return { positions, errors, stats }
}

/**
 * Replay a single game and extract positions
 *
 * @param game - Parsed game data
 * @returns Positions from the game
 */
export function replayGame(game: ParsedGame): {
  positions: ReplayedPosition[]
  errors: ReplayError[]
} {
  const positions: ReplayedPosition[] = []
  const errors: ReplayError[] = []

  // Start with initial position
  let board = cloneBoard(INITIAL_BOARD)

  for (const move of game.moves) {
    // Process player 1's move
    if (move.player1Dice && move.player1Moves) {
      // Capture position BEFORE the move (the decision point)
      const positionBefore: ReplayedPosition = {
        board: cloneBoard(board),
        dice: move.player1Dice,
        player: 'x',
        moveNumber: move.moveNumber,
        gameNumber: game.gameNumber,
        pipCountX: calculatePipCount(board, 'x'),
        pipCountO: calculatePipCount(board, 'o'),
      }
      positions.push(positionBefore)

      // Apply moves
      const result = applyMoves(board, move.player1Moves, 'x')
      if (result.errors.length > 0) {
        errors.push({
          gameNumber: game.gameNumber,
          moveNumber: move.moveNumber,
          message: `P1 move errors: ${result.errors.join(', ')}`,
          recoverable: true,
        })
      }
    }

    // Process player 2's move
    if (move.player2Dice && move.player2Moves) {
      // Capture position BEFORE the move
      const positionBefore: ReplayedPosition = {
        board: cloneBoard(board),
        dice: move.player2Dice,
        player: 'o',
        moveNumber: move.moveNumber,
        gameNumber: game.gameNumber,
        pipCountX: calculatePipCount(board, 'x'),
        pipCountO: calculatePipCount(board, 'o'),
      }
      positions.push(positionBefore)

      // Apply moves
      const result = applyMoves(board, move.player2Moves, 'o')
      if (result.errors.length > 0) {
        errors.push({
          gameNumber: game.gameNumber,
          moveNumber: move.moveNumber,
          message: `P2 move errors: ${result.errors.join(', ')}`,
          recoverable: true,
        })
      }
    }
  }

  return { positions, errors }
}

/**
 * Generate ASCII board representation for display
 */
export function generateAsciiBoard(board: BoardState): string {
  const lines: string[] = []

  // Top border with point numbers
  lines.push('+13-14-15-16-17-18------19-20-21-22-23-24-+')

  // Top half (points 13-24 for X, 1-12 for O)
  for (let row = 0; row < 5; row++) {
    let line = '|'
    for (let point = 13; point <= 18; point++) {
      const count = board[point]
      const char = getCheckerChar(count, row)
      line += ` ${char} `
    }
    line += '|   |' // Bar
    for (let point = 19; point <= 24; point++) {
      const count = board[point]
      const char = getCheckerChar(count, row)
      line += ` ${char} `
    }
    line += '|'
    lines.push(line)
  }

  // Middle divider with bar
  const xBar = board[X_BAR]
  const oBar = Math.abs(board[O_BAR])
  lines.push(`|                  |BAR|                  |`)

  // Bottom half (points 12-1 for X, 13-24 for O)
  for (let row = 4; row >= 0; row--) {
    let line = '|'
    for (let point = 12; point >= 7; point--) {
      const count = board[point]
      const char = getCheckerChar(count, row)
      line += ` ${char} `
    }
    line += '|   |' // Bar
    for (let point = 6; point >= 1; point--) {
      const count = board[point]
      const char = getCheckerChar(count, row)
      line += ` ${char} `
    }
    line += '|'
    lines.push(line)
  }

  // Bottom border with point numbers
  lines.push('+12-11-10--9--8--7-------6--5--4--3--2--1-+')

  return lines.join('\n')
}

/**
 * Get character to display for a stack of checkers at a row
 */
function getCheckerChar(count: number, row: number): string {
  const absCount = Math.abs(count)
  if (row < absCount) {
    return count > 0 ? 'X' : 'O'
  }
  return ' '
}

// =============================================================================
// POSITION ID GENERATION
// =============================================================================

/**
 * Generate a hash for position deduplication
 * Based on board state + dice + player to move
 */
export function generatePositionHash(position: ReplayedPosition): string {
  const boardStr = position.board.join(',')
  const diceStr = position.dice.sort().join('-')
  const playerStr = position.player
  return `${boardStr}|${diceStr}|${playerStr}`
}

/**
 * Generate a temporary position identifier for deduplication during import.
 *
 * Note: This generates a hash-based ID for internal deduplication.
 * The canonical GNUBG position ID (14-char Base64) will be obtained from
 * the GNUBG engine during the verification phase of the import pipeline.
 *
 * @param board - Board state array
 * @returns A temporary position identifier (not a true GNUBG position ID)
 */
export function boardToGnubgId(board: BoardState): string {
  // Generate a deterministic hash for deduplication
  // The actual GNUBG position ID will be obtained from the engine during verification
  const hash = generatePositionHash({
    board,
    dice: [0, 0],
    player: 'x',
    moveNumber: 0,
    gameNumber: 0,
    pipCountX: 0,
    pipCountO: 0,
  })

  // Create a short hash (first 14 chars of base64)
  const encoded = Buffer.from(hash).toString('base64')
  return encoded.substring(0, 14)
}

// =============================================================================
// BOARD FORMAT CONVERSION
// =============================================================================

/**
 * BoardPosition format for GNUBG MCP client
 * Matches the PlaysBoardConfig.board expected by the engine
 */
export interface BoardPosition {
  x: Record<string, number>  // X (White) checker positions
  o: Record<string, number>  // O (Black) checker positions
}

/**
 * Convert our internal BoardState array to MCP BoardPosition format.
 *
 * BoardState: 26-element array (index 0=X bar, 1-24=points, 25=O bar)
 *             Positive values = X checkers, Negative = O checkers
 *
 * BoardPosition: { x: { "point": count }, o: { "point": count } }
 *                Bar is represented as "bar", off is not included
 *
 * @param board - Internal board state array
 * @returns BoardPosition suitable for MCP client
 */
export function boardStateToMCPFormat(board: BoardState): BoardPosition {
  const x: Record<string, number> = {}
  const o: Record<string, number> = {}

  // X's bar (index 0)
  if (board[X_BAR] > 0) {
    x['bar'] = board[X_BAR]
  }

  // O's bar (index 25)
  if (board[O_BAR] < 0) {
    o['bar'] = Math.abs(board[O_BAR])
  }

  // Points 1-24
  for (let point = 1; point <= 24; point++) {
    const count = board[point]
    if (count > 0) {
      x[String(point)] = count
    } else if (count < 0) {
      o[String(point)] = Math.abs(count)
    }
  }

  return { x, o }
}

/**
 * Generate a deterministic position ID based on board state.
 * This creates a unique hash for deduplication purposes.
 *
 * @param board - Board state array
 * @param dice - Dice roll
 * @param player - Player to move
 * @returns 14-character position ID
 */
export function generatePositionIdFromBoard(
  board: BoardState,
  dice: [number, number],
  player: 'x' | 'o'
): string {
  const boardStr = board.join(',')
  const diceStr = [...dice].sort().join('-')
  const input = `${boardStr}|${diceStr}|${player}`
  const encoded = Buffer.from(input).toString('base64')
  return encoded.substring(0, 14).replace(/[/+=]/g, 'X')
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  ReplayedPosition,
  BoardState,
  MatchReplayResult,
  ReplayError,
  ReplayStats,
}
