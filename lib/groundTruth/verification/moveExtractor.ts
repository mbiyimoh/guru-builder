/**
 * Move Extraction for Backgammon Verification
 *
 * Extracts and normalizes backgammon moves from text content.
 * Supports various move notations: 8/5, 8-5, bar/22, 6/off
 */

/**
 * Backgammon move patterns for extraction
 */
export const BACKGAMMON_MOVE_PATTERNS = {
  // Single checker movement: "8/5", "bar/22", "6/off"
  SINGLE_MOVE: /\b(bar|\d{1,2})[\/-](\d{1,2}|off)\*?\b/gi,

  // Full move with multiple checkers: "8/5 6/5", "24/21 13/10"
  FULL_MOVE: /\b(?:bar|\d{1,2})[\/-](?:\d{1,2}|off)\*?(?:\s*,?\s*(?:bar|\d{1,2})[\/-](?:\d{1,2}|off)\*?){0,3}\b/gi,

  // Dice roll format: "3-1", "6-6"
  DICE_ROLL: /\b([1-6])-([1-6])\b/,
} as const

/**
 * Extract backgammon move from text content
 *
 * @param text - Content to search for moves
 * @returns First move found, or null if none found
 *
 * @example
 * extractBackgammonMove("The best play is 8/5 6/5")
 * // Returns: "8/5 6/5"
 */
export function extractBackgammonMove(text: string): string | null {
  const matches = text.match(BACKGAMMON_MOVE_PATTERNS.FULL_MOVE)
  return matches ? matches[0] : null
}

/**
 * Extract all moves from content
 *
 * @param content - Content to search for moves
 * @returns Array of unique moves found
 *
 * @example
 * extractAllMoves("Try 8/5 6/5 or 13/10 8/7")
 * // Returns: ["8/5 6/5", "13/10 8/7"]
 */
export function extractAllMoves(content: string): string[] {
  const matches = content.match(BACKGAMMON_MOVE_PATTERNS.FULL_MOVE)
  return matches ? [...new Set(matches)] : []
}

/**
 * Extract dice roll from text
 *
 * @param text - Content to search for dice roll
 * @returns Dice values, or null if not found
 *
 * @example
 * extractDiceRoll("You rolled 3-1")
 * // Returns: { die1: 3, die2: 1 }
 */
export function extractDiceRoll(text: string): { die1: number, die2: number } | null {
  const match = text.match(BACKGAMMON_MOVE_PATTERNS.DICE_ROLL)
  if (!match) return null
  return { die1: parseInt(match[1]), die2: parseInt(match[2]) }
}

/**
 * Normalize move to standard format
 *
 * Converts various notations to standard format:
 * - Replaces commas with spaces
 * - Standardizes to forward slash
 * - Normalizes whitespace
 * - Converts to lowercase
 *
 * @param move - Move in any supported format
 * @returns Normalized move string
 *
 * @example
 * normalizeMove("8-5, 6-5")
 * // Returns: "8/5 6/5"
 */
export function normalizeMove(move: string): string {
  return move
    .replace(/,\s*/g, ' ')      // Replace commas with spaces
    .replace(/-/g, '/')          // Standardize to forward slash
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim()
    .toLowerCase()
}

/**
 * Compare two moves for equivalence
 *
 * Normalizes both moves and compares them component-wise.
 * Order of checker movements doesn't matter (8/5 6/5 === 6/5 8/5)
 *
 * @param move1 - First move to compare
 * @param move2 - Second move to compare
 * @returns True if moves are equivalent
 *
 * @example
 * movesAreEquivalent("8/5 6/5", "6-5, 8-5")
 * // Returns: true
 */
export function movesAreEquivalent(move1: string, move2: string): boolean {
  const norm1 = normalizeMove(move1)
  const norm2 = normalizeMove(move2)

  // Split into individual checker movements and sort
  const parts1 = norm1.split(' ').sort()
  const parts2 = norm2.split(' ').sort()

  return JSON.stringify(parts1) === JSON.stringify(parts2)
}
