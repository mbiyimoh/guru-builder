/**
 * Position Detection for Backgammon Verification
 *
 * Detects and classifies backgammon positions from text content.
 * Identifies opening positions, XGIDs, and position types.
 */

export interface PositionIdentifier {
  type: 'opening' | 'midgame' | 'bearing_off' | 'bar' | 'unknown'
  diceRoll?: string
  xgid?: string
  description?: string
}

/**
 * Opening position patterns
 */
const OPENING_PATTERNS = [
  /opening\s+roll/i,
  /first\s+move/i,
  /initial\s+position/i,
  /starting\s+position/i,
]

/**
 * Standard opening positions by dice roll
 *
 * XGIDs for common opening positions. These represent
 * the canonical XGID for each opening roll.
 *
 * Format: XGID=-a-B--E-C---eE---c-e----B-:0:0:1:DD:0:0:0:0:10
 * where DD is the dice roll (31, 42, etc.)
 */
export const STANDARD_OPENINGS: Record<string, string> = {
  // Common opening rolls with standard XGIDs
  '3-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:31:0:0:0:0:10',
  '4-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:42:0:0:0:0:10',
  '5-3': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:53:0:0:0:0:10',
  '6-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:61:0:0:0:0:10',
  '5-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:51:0:0:0:0:10',
  '6-5': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:65:0:0:0:0:10',
  '4-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:41:0:0:0:0:10',
  '3-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:32:0:0:0:0:10',
  '2-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:21:0:0:0:0:10',
  '6-4': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:64:0:0:0:0:10',
  '6-3': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:63:0:0:0:0:10',
  '6-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:62:0:0:0:0:10',
  '5-4': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:54:0:0:0:0:10',
  '5-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:52:0:0:0:0:10',
  '4-3': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:43:0:0:0:0:10',

  // Doubles (rare as opening rolls, but included for completeness)
  '1-1': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:11:0:0:0:0:10',
  '2-2': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:22:0:0:0:0:10',
  '3-3': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:33:0:0:0:0:10',
  '4-4': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:44:0:0:0:0:10',
  '5-5': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:55:0:0:0:0:10',
  '6-6': 'XGID=-a-B--E-C---eE---c-e----B-:0:0:1:66:0:0:0:0:10',
}

/**
 * Detect position type from content
 *
 * Analyzes text content to determine what type of position
 * is being discussed. Checks for:
 * - XGID strings (most specific)
 * - Opening position indicators
 * - Bearing off positions
 * - Bar positions
 *
 * @param content - Text content to analyze
 * @returns Position identifier with type and metadata
 *
 * @example
 * detectPositionType("XGID=-a-B--E-C---eE---c-e----B-:0:0:1:31:0:0:0:0:10")
 * // Returns: { type: 'midgame', xgid: 'XGID=...' }
 *
 * @example
 * detectPositionType("Opening roll 3-1")
 * // Returns: { type: 'opening', diceRoll: '3-1', description: 'Opening position' }
 */
export function detectPositionType(content: string): PositionIdentifier {
  // Check for XGID (most specific position identifier)
  const xgidMatch = content.match(/XGID[=:][A-Za-z0-9+\-:]+/i)
  if (xgidMatch) {
    return {
      type: 'midgame',
      xgid: xgidMatch[0]
    }
  }

  // Check for opening patterns
  for (const pattern of OPENING_PATTERNS) {
    if (pattern.test(content)) {
      const diceMatch = content.match(/\b([1-6])-([1-6])\b/)
      return {
        type: 'opening',
        diceRoll: diceMatch ? `${diceMatch[1]}-${diceMatch[2]}` : undefined,
        description: 'Opening position'
      }
    }
  }

  // Check for bearing off
  if (/bear(?:ing)?\s*off/i.test(content) || /\d+\/off\b/i.test(content)) {
    return { type: 'bearing_off', description: 'Bearing off position' }
  }

  // Check for bar
  if (/\bbar\b/i.test(content) || /checker[s]?\s+on\s+the\s+bar/i.test(content)) {
    return { type: 'bar', description: 'Position with checker(s) on bar' }
  }

  return { type: 'unknown' }
}

/**
 * Get XGID for standard opening
 *
 * Returns the canonical XGID for a given opening dice roll.
 * Only works for standard opening positions.
 *
 * @param diceRoll - Dice roll in format "3-1" or "1-3"
 * @returns XGID string, or null if not a standard opening
 *
 * @example
 * getOpeningXGID("3-1")
 * // Returns: "XGID=-a-B--E-C---eE---c-e----B-:0:0:1:31:0:0:0:0:10"
 *
 * @example
 * getOpeningXGID("1-3") // Dice order normalized
 * // Returns: "XGID=-a-B--E-C---eE---c-e----B-:0:0:1:31:0:0:0:0:10"
 */
export function getOpeningXGID(diceRoll: string): string | null {
  // Normalize dice order (3-1 and 1-3 are the same roll)
  const [d1, d2] = diceRoll.split('-').map(Number)
  const normalized = d1 > d2 ? `${d1}-${d2}` : `${d2}-${d1}`

  return STANDARD_OPENINGS[normalized] || null
}
