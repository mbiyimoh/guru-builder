import { BackgammonMove } from './types'

/**
 * Check if the guru's response mentions the best move from the engine
 *
 * This is a simple string-matching approach that looks for the move notation
 * in the guru's response. It handles variations like:
 * - "13/10" (standard notation)
 * - "13-10" (dash separator)
 * - "13 to 10" (natural language)
 *
 * @param guruResponse - The text response from the guru
 * @param bestMoves - Array of moves ranked by equity from the engine
 * @returns boolean indicating if the guru mentioned the best move
 */
export function checkGuruMatchedBest(guruResponse: string, bestMoves: BackgammonMove[]): boolean {
  if (!bestMoves.length || !guruResponse) return false

  // Get the best move notation (first ranked move)
  const bestMove = bestMoves[0].move.toLowerCase()

  // Normalize the guru response
  const normalizedResponse = guruResponse.toLowerCase()

  // Check if the best move is mentioned in the response
  // Handle variations like "13/10", "13-10", "13 to 10"
  const movePattern = bestMove.replace(/\//g, '[/-]?\\s*(?:to\\s*)?')
  const regex = new RegExp(movePattern, 'i')

  return regex.test(normalizedResponse) || normalizedResponse.includes(bestMove)
}

/**
 * Calculate match statistics for a set of results
 *
 * @param results - Array of assessment results
 * @returns Object containing match count and percentage
 */
export function calculateMatchStats(
  results: Array<{ guruMatchedBest: boolean | null }>
): { matched: number; total: number; percentage: number } {
  const validResults = results.filter((r) => r.guruMatchedBest !== null)
  const matched = validResults.filter((r) => r.guruMatchedBest === true).length

  return {
    matched,
    total: validResults.length,
    percentage: validResults.length > 0 ? (matched / validResults.length) * 100 : 0,
  }
}
