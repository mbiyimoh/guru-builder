/**
 * Move Extraction and Position Detection for Backgammon
 *
 * Additional move extraction utilities that complement the core verification
 * functions in ./verification/moveExtractor.ts and ./verification/positionDetector.ts
 */

import { normalizeMove, BACKGAMMON_MOVE_PATTERNS } from './verification/moveExtractor'

/**
 * Extract all backgammon moves from text (returns normalized moves)
 *
 * This differs from extractAllMoves in that it normalizes each move
 * using the standard normalization function.
 */
export function extractBackgammonMoves(text: string): string[] {
  const moves: string[] = []
  const matches = text.matchAll(BACKGAMMON_MOVE_PATTERNS.FULL_MOVE)

  for (const match of matches) {
    moves.push(normalizeMove(match[0]))
  }

  return [...new Set(moves)] // Deduplicate
}

/**
 * Check if a move contains a hit
 */
export function moveContainsHit(move: string): boolean {
  return move.includes('*')
}

/**
 * Position types in backgammon
 */
export type PositionType =
  | 'opening'      // First few moves, standard starting position
  | 'midgame'      // General middle game position
  | 'bearing-off'  // At least one checker in home board ready to bear off
  | 'bar'          // At least one checker on the bar
  | 'race'         // Pure race, no contact
  | 'holding'      // Holding game pattern
  | 'priming'      // Building a prime
  | 'unknown'

/**
 * Position identifier with context
 */
export interface PositionIdentifier {
  type: PositionType
  confidence: number  // 0-1
  indicators: string[]  // What triggered this detection
  gnubgId?: string  // GNUBG position ID if available
}

/**
 * Detect position type from text context
 */
export function detectPositionType(text: string): PositionIdentifier {
  const lowered = text.toLowerCase()
  const indicators: string[] = []

  // Check for GNUBG position ID
  const gnubgMatch = text.match(/[A-Za-z0-9+/]{14,}={0,2}/)

  // Opening detection
  if (lowered.includes('opening') ||
      lowered.includes('first move') ||
      lowered.includes('initial position')) {
    indicators.push('opening keyword')
    return { type: 'opening', confidence: 0.9, indicators, gnubgId: gnubgMatch?.[0] }
  }

  // Bearing off detection
  if (lowered.includes('bear off') ||
      lowered.includes('bearing off') ||
      lowered.includes('bear-off')) {
    indicators.push('bearing off keyword')
    return { type: 'bearing-off', confidence: 0.9, indicators, gnubgId: gnubgMatch?.[0] }
  }

  // Bar detection
  if (lowered.includes('on the bar') ||
      lowered.includes('from the bar') ||
      lowered.includes('bar/')) {
    indicators.push('bar keyword or notation')
    return { type: 'bar', confidence: 0.85, indicators, gnubgId: gnubgMatch?.[0] }
  }

  // Race detection
  if (lowered.includes('pure race') ||
      lowered.includes('racing') ||
      lowered.includes('pip count')) {
    indicators.push('race keyword')
    return { type: 'race', confidence: 0.8, indicators, gnubgId: gnubgMatch?.[0] }
  }

  // Priming detection
  if (lowered.includes('prime') ||
      lowered.includes('priming')) {
    indicators.push('prime keyword')
    return { type: 'priming', confidence: 0.8, indicators, gnubgId: gnubgMatch?.[0] }
  }

  // Holding detection
  if (lowered.includes('holding') ||
      lowered.includes('anchor')) {
    indicators.push('holding keyword')
    return { type: 'holding', confidence: 0.75, indicators, gnubgId: gnubgMatch?.[0] }
  }

  // Default to midgame
  return { type: 'midgame', confidence: 0.5, indicators: ['default'], gnubgId: gnubgMatch?.[0] }
}
