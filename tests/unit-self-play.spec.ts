/**
 * Unit Tests for Self-Play Position Generator
 *
 * Tests the core game logic functions without requiring a live GNUBG engine.
 */

import { test, expect } from '@playwright/test'
import {
  rollDice,
  formatDiceRoll,
  isGameOver,
  applyGnubgMove,
} from '../lib/positionLibrary/selfPlayGenerator'
import { INITIAL_BOARD, cloneBoard } from '../lib/matchImport/replayEngine'
import type { BoardState } from '../lib/matchImport/types'

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create an empty board (no checkers)
 */
function createEmptyBoard(): BoardState {
  return Array(26).fill(0) as BoardState
}

/**
 * Create a board with specific checker positions
 */
function createBoard(
  xPositions: Record<number, number>,
  oPositions: Record<number, number>
): BoardState {
  const board = createEmptyBoard()

  // Place X checkers (positive values)
  for (const [point, count] of Object.entries(xPositions)) {
    board[parseInt(point)] = count
  }

  // Place O checkers (negative values)
  for (const [point, count] of Object.entries(oPositions)) {
    board[parseInt(point)] = -count
  }

  return board
}

// =============================================================================
// DICE TESTS
// =============================================================================

test.describe('rollDice', () => {
  test('returns values between 1 and 6 for both dice', () => {
    for (let i = 0; i < 100; i++) {
      const [d1, d2] = rollDice()
      expect(d1).toBeGreaterThanOrEqual(1)
      expect(d1).toBeLessThanOrEqual(6)
      expect(d2).toBeGreaterThanOrEqual(1)
      expect(d2).toBeLessThanOrEqual(6)
    }
  })

  test('returns integer values', () => {
    for (let i = 0; i < 50; i++) {
      const [d1, d2] = rollDice()
      expect(Number.isInteger(d1)).toBe(true)
      expect(Number.isInteger(d2)).toBe(true)
    }
  })
})

test.describe('formatDiceRoll', () => {
  test('puts larger die first', () => {
    expect(formatDiceRoll([4, 6])).toBe('6-4')
    expect(formatDiceRoll([6, 4])).toBe('6-4')
    expect(formatDiceRoll([1, 5])).toBe('5-1')
    expect(formatDiceRoll([5, 1])).toBe('5-1')
  })

  test('handles doubles correctly', () => {
    expect(formatDiceRoll([3, 3])).toBe('3-3')
    expect(formatDiceRoll([6, 6])).toBe('6-6')
    expect(formatDiceRoll([1, 1])).toBe('1-1')
  })

  test('handles equal dice', () => {
    expect(formatDiceRoll([2, 2])).toBe('2-2')
  })
})

// =============================================================================
// GAME OVER TESTS
// =============================================================================

test.describe('isGameOver', () => {
  test('returns false for starting position', () => {
    const result = isGameOver(INITIAL_BOARD)
    expect(result.over).toBe(false)
    expect(result.winner).toBeUndefined()
  })

  test('returns true with winner X when X has no checkers', () => {
    // Empty board for X = X has borne off all
    const board = createBoard({}, { 6: 2, 8: 3, 13: 5, 24: 5 })
    const result = isGameOver(board)
    expect(result.over).toBe(true)
    expect(result.winner).toBe('x')
  })

  test('returns true with winner O when O has no checkers', () => {
    // Empty board for O = O has borne off all
    const board = createBoard({ 1: 2, 6: 5, 8: 3, 13: 5 }, {})
    const result = isGameOver(board)
    expect(result.over).toBe(true)
    expect(result.winner).toBe('o')
  })

  test('counts bar checkers for X', () => {
    // X has 1 checker on bar (index 0), rest borne off
    const board = createEmptyBoard()
    board[0] = 1 // X on bar
    board[6] = -5 // Some O checkers
    const result = isGameOver(board)
    expect(result.over).toBe(false)
  })

  test('counts bar checkers for O', () => {
    // O has 1 checker on bar (index 25), rest borne off
    const board = createEmptyBoard()
    board[25] = -1 // O on bar (negative)
    board[6] = 5 // Some X checkers
    const result = isGameOver(board)
    expect(result.over).toBe(false)
  })

  test('returns false when both players have checkers', () => {
    const board = createBoard({ 6: 2, 13: 3 }, { 19: 2, 24: 3 })
    const result = isGameOver(board)
    expect(result.over).toBe(false)
  })
})

// =============================================================================
// MOVE APPLICATION TESTS
// =============================================================================

test.describe('applyGnubgMove', () => {
  test.describe('X moves', () => {
    test('handles simple point to point move', () => {
      const board = cloneBoard(INITIAL_BOARD)
      // X has 2 checkers on point 24, move one to point 20
      const newBoard = applyGnubgMove(board, [{ from: '24', to: '20' }], 'x')

      expect(newBoard[24]).toBe(1) // One checker left
      expect(newBoard[20]).toBe(1) // One checker arrived
    })

    test('handles bar entry', () => {
      const board = createEmptyBoard()
      board[0] = 1 // X on bar
      board[20] = 0 // Empty destination

      const newBoard = applyGnubgMove(board, [{ from: 'bar', to: '20' }], 'x')

      expect(newBoard[0]).toBe(0) // Bar empty
      expect(newBoard[20]).toBe(1) // Checker on point 20
    })

    test('handles bearing off', () => {
      const board = createEmptyBoard()
      board[3] = 2 // X has 2 checkers on point 3

      const newBoard = applyGnubgMove(board, [{ from: '3', to: 'off' }], 'x')

      expect(newBoard[3]).toBe(1) // One checker left
    })

    test('handles hitting O blot', () => {
      const board = createEmptyBoard()
      board[13] = 1 // X checker
      board[9] = -1 // O blot (single checker)

      const newBoard = applyGnubgMove(board, [{ from: '13', to: '9' }], 'x')

      expect(newBoard[13]).toBe(0) // X left
      expect(newBoard[9]).toBe(1) // X landed
      expect(newBoard[25]).toBe(-1) // O on bar
    })

    test('handles multiple checker moves in sequence', () => {
      const board = cloneBoard(INITIAL_BOARD)
      // Move 8/5 6/5 (making the 5-point)
      const newBoard = applyGnubgMove(
        board,
        [
          { from: '8', to: '5' },
          { from: '6', to: '5' },
        ],
        'x'
      )

      expect(newBoard[8]).toBe(2) // Was 3, now 2
      expect(newBoard[6]).toBe(4) // Was 5, now 4
      expect(newBoard[5]).toBe(2) // Was 0, now 2
    })
  })

  test.describe('O moves', () => {
    test('handles simple point to point move', () => {
      const board = createEmptyBoard()
      // O has checkers on point 19 (from X's view)
      // In O's view, this is point 6 (25-19=6)
      board[19] = -2

      // O moves from their point 6 to point 2 (which is X's point 23)
      const newBoard = applyGnubgMove(board, [{ from: '6', to: '2' }], 'o')

      expect(newBoard[19]).toBe(-1) // One O left on point 19
      expect(newBoard[23]).toBe(-1) // One O on point 23
    })

    test('handles bar entry', () => {
      const board = createEmptyBoard()
      board[25] = -1 // O on bar

      // O enters from bar to their point 20 (X's point 5)
      const newBoard = applyGnubgMove(board, [{ from: 'bar', to: '20' }], 'o')

      expect(newBoard[25]).toBe(0) // Bar empty
      expect(newBoard[5]).toBe(-1) // O on X's point 5
    })

    test('handles bearing off', () => {
      const board = createEmptyBoard()
      board[22] = -2 // O on X's point 22 (O's point 3)

      const newBoard = applyGnubgMove(board, [{ from: '3', to: 'off' }], 'o')

      expect(newBoard[22]).toBe(-1) // One O left
    })

    test('handles hitting X blot', () => {
      const board = createEmptyBoard()
      board[19] = -1 // O checker on X's 19 (O's 6)
      board[23] = 1 // X blot on X's 23 (O's 2)

      // O moves from their 6 to 2, hitting X
      const newBoard = applyGnubgMove(board, [{ from: '6', to: '2' }], 'o')

      expect(newBoard[19]).toBe(0) // O left
      expect(newBoard[23]).toBe(-1) // O landed
      expect(newBoard[0]).toBe(1) // X on bar
    })
  })

  test('does not mutate original board', () => {
    const original = cloneBoard(INITIAL_BOARD)
    const originalCopy = cloneBoard(original)

    applyGnubgMove(original, [{ from: '24', to: '20' }], 'x')

    // Original should be unchanged
    expect(original).toEqual(originalCopy)
  })
})

// =============================================================================
// INTEGRATION SANITY CHECKS
// =============================================================================

test.describe('integration sanity checks', () => {
  test('INITIAL_BOARD has 15 checkers per player', () => {
    let xCount = 0
    let oCount = 0

    xCount += INITIAL_BOARD[0] // X bar
    oCount += Math.abs(INITIAL_BOARD[25]) // O bar

    for (let i = 1; i <= 24; i++) {
      if (INITIAL_BOARD[i] > 0) xCount += INITIAL_BOARD[i]
      if (INITIAL_BOARD[i] < 0) oCount += Math.abs(INITIAL_BOARD[i])
    }

    expect(xCount).toBe(15)
    expect(oCount).toBe(15)
  })

  test('INITIAL_BOARD is valid starting position', () => {
    // X: 2 on 24, 5 on 13, 3 on 8, 5 on 6
    expect(INITIAL_BOARD[24]).toBe(2)
    expect(INITIAL_BOARD[13]).toBe(5)
    expect(INITIAL_BOARD[8]).toBe(3)
    expect(INITIAL_BOARD[6]).toBe(5)

    // O: 2 on 1, 5 on 12, 3 on 17, 5 on 19
    expect(INITIAL_BOARD[1]).toBe(-2)
    expect(INITIAL_BOARD[12]).toBe(-5)
    expect(INITIAL_BOARD[17]).toBe(-3)
    expect(INITIAL_BOARD[19]).toBe(-5)
  })
})
