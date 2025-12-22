// lib/positionLibrary/asciiRenderer.ts
// ASCII board rendering for backgammon positions

import type { BoardPosition } from '@/lib/groundTruth/mcpClient'

/**
 * Render the standard backgammon opening position as ASCII art.
 *
 * The opening position is always the same board state; only the dice vary.
 * X = White (player to move), O = Black (opponent)
 * Points numbered from White's perspective (1 = White's home, 24 = Black's home)
 *
 * Starting position:
 * - White (X): 2 on point 24, 5 on point 13, 3 on point 8, 5 on point 6
 * - Black (O): 2 on point 1, 5 on point 12, 3 on point 17, 5 on point 19
 *
 * @param diceRoll - The dice roll (e.g., "3-1", "6-6")
 * @returns ASCII representation of the opening position
 */
export function renderOpeningBoard(diceRoll: string): string {
  return `
+13-14-15-16-17-18-+BAR+19-20-21-22-23-24-+
| O           O    |   | O              X |
| O           O    |   | O              X |
| O           O    |   | O                |
| O                |   | O                |
| O                |   | O                |
|                  |   |                  |
| X                |   | X                |
| X                |   | X                |
| X           X    |   | X                |
| X           X    |   | X              O |
| X           X    |   | X              O |
+12-11-10--9--8--7-+---+-6--5--4--3--2--1-+

         Dice: ${diceRoll}    White (X) to move
`.trim()
}

/**
 * Render any arbitrary backgammon position as ASCII art.
 *
 * @param positionId - Position identifier
 * @param diceRoll - The dice roll for this position
 * @returns ASCII representation of the position
 */
export function renderAsciiBoard(positionId: string, diceRoll: string): string {
  // For opening positions, use the static renderer
  if (positionId === 'opening' || positionId.startsWith('opening-')) {
    return renderOpeningBoard(diceRoll)
  }

  // For other positions, return a generic template
  // The actual board state is stored in the database as JSON
  return `
+13-14-15-16-17-18-+BAR+19-20-21-22-23-24-+
|                  |   |                  |
|   (see board     |   |   description)   |
|                  |   |                  |
|                  |   |                  |
|                  |   |                  |
|                  |   |                  |
|                  |   |                  |
|                  |   |                  |
|                  |   |                  |
|                  |   |                  |
|                  |   |                  |
+12-11-10--9--8--7-+---+-6--5--4--3--2--1-+

         Dice: ${diceRoll}
`.trim()
}

/**
 * Render a full ASCII board from a BoardPosition structure.
 *
 * @param board - The board position with x and o checker locations
 * @param diceRoll - The dice roll
 * @param player - Who is to move ('x' or 'o')
 * @returns ASCII representation
 */
export function renderBoardFromPosition(
  board: BoardPosition,
  diceRoll: string,
  player: 'x' | 'o'
): string {
  // Create a 2D array for the board display
  // Top half: points 13-24, Bottom half: points 12-1
  const topPoints = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
  const bottomPoints = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

  // Helper to get checker at point
  const getChecker = (point: number): { player: 'x' | 'o' | null; count: number } => {
    const xCount = board.x[point.toString()] || 0
    const oCount = board.o[point.toString()] || 0
    if (xCount > 0) return { player: 'x', count: xCount }
    if (oCount > 0) return { player: 'o', count: oCount }
    return { player: null, count: 0 }
  }

  // Build row strings for each point (5 rows max display per point)
  const buildColumn = (point: number, fromTop: boolean): string[] => {
    const { player: p, count } = getChecker(point)
    const rows: string[] = []
    const symbol = p === 'x' ? 'X' : p === 'o' ? 'O' : ' '

    for (let i = 0; i < 5; i++) {
      if (fromTop) {
        rows.push(i < count ? symbol : ' ')
      } else {
        rows.push(i < count ? symbol : ' ')
      }
    }
    return fromTop ? rows : rows.reverse()
  }

  // Build each row of the board
  const rows: string[] = []

  // Header
  rows.push('+13-14-15-16-17-18-+BAR+19-20-21-22-23-24-+')

  // Top half (5 rows)
  for (let row = 0; row < 5; row++) {
    let line = '|'
    for (let i = 0; i < 6; i++) {
      const col = buildColumn(topPoints[i], true)
      line += ` ${col[row]}`
    }
    line += '    |'
    // Bar
    const xBar = board.x['bar'] || 0
    const oBar = board.o['bar'] || 0
    line += row < Math.min(xBar, 5) ? 'X' : row < Math.min(oBar, 5) ? 'O' : ' '
    line += '  |'
    for (let i = 6; i < 12; i++) {
      const col = buildColumn(topPoints[i], true)
      line += ` ${col[row]}`
    }
    line += ' |'
    rows.push(line)
  }

  // Middle separator
  rows.push('|                  |   |                  |')

  // Bottom half (5 rows)
  for (let row = 4; row >= 0; row--) {
    let line = '|'
    for (let i = 0; i < 6; i++) {
      const col = buildColumn(bottomPoints[i], false)
      line += ` ${col[row]}`
    }
    line += '    |   |'
    for (let i = 6; i < 12; i++) {
      const col = buildColumn(bottomPoints[i], false)
      line += ` ${col[row]}`
    }
    line += ' |'
    rows.push(line)
  }

  // Footer
  rows.push('+12-11-10--9--8--7-+---+-6--5--4--3--2--1-+')
  rows.push('')
  rows.push(`         Dice: ${diceRoll}    ${player === 'x' ? 'White (X)' : 'Black (O)'} to move`)

  return rows.join('\n')
}
