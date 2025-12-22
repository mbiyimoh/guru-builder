/**
 * JellyFish Match Format Parser
 *
 * Parses backgammon matches in JellyFish .txt/.mat format.
 * Format specification: specs/match-archive-import-system/jellyfish-format-research.md
 */

import type {
  ParsedMatch,
  ParsedGame,
  ParsedMove,
  PlayerInfo,
  MoveNotation,
  MatchMetadata,
  DiceRoll,
  ParserOptions,
  ParserResult,
  ParserError,
  ParserWarning,
} from './types'

// =============================================================================
// REGEX PATTERNS
// =============================================================================

/**
 * Match length header: " 7 point match" or "15 point match"
 */
const MATCH_LENGTH_PATTERN = /^\s*(\d+)\s+point\s+match/i

/**
 * Game header: "Game 1" or "Game 15" or " Game 1" (with optional leading space)
 */
const GAME_HEADER_PATTERN = /^\s*Game\s+(\d+)/i

/**
 * Player line with score: "PlayerName : 0" or "Player(USA) : 5"
 * Optional country code in parentheses
 * Single player format for separate lines
 */
const PLAYER_LINE_PATTERN = /^(.+?)(?:\(([A-Z]{2,3})\))?\s*:\s*(\d+)\s*$/

/**
 * Combined player line: "Player1_(USA) : 0     Player2_(ITA) : 0"
 *
 * Hardy's Backgammon Pages format where both players appear on a single line.
 *
 * Format characteristics:
 * - Names may use underscores as space separators (e.g., "Suzuki_Mochy")
 * - Names may contain hyphens (e.g., "Van-Der-Berg")
 * - Country codes in parentheses are optional
 * - Underscore before country code is optional
 * - Players separated by 2+ spaces
 *
 * Examples:
 *   "Koga_Mochy_(JPN) : 0     Falafel_(USA) : 0"
 *   "Smith_John : 1     Jones_Bob_(GBR) : 0"  (missing country for P1)
 *   "Van-Der-Berg(NED) : 2     Suzuki-Y(JPN) : 0"  (no underscore before country)
 */
const COMBINED_PLAYER_LINE_PATTERN = /^\s*([A-Za-z0-9_-]+)_?(?:\(([A-Z]{2,3})\))?\s*:\s*(\d+)\s{2,}([A-Za-z0-9_-]+)_?(?:\(([A-Z]{2,3})\))?\s*:\s*(\d+)\s*$/

/**
 * Move line: " 1) 31: 8/5 6/5                42: 13/9 13/8"
 * Captures: moveNumber, dice1+moves1, dice2+moves2 (split on column ~35)
 */
const MOVE_LINE_PATTERN = /^\s*(\d+)\)\s*(.+)$/

/**
 * Single dice roll + moves: "31: 8/5 6/5" or "66: 8/5(4)"
 */
const DICE_AND_MOVES_PATTERN = /^(\d{2}):\s*(.*)$/

/**
 * Individual move: "8/5" or "25/20" or "6/0" with optional hit marker
 * Point values: 1-24 board, 25=bar, 0=off
 */
const MOVE_PATTERN = /(\d+)\/(\d+)(\*)?/g

// =============================================================================
// PARSER IMPLEMENTATION
// =============================================================================

/**
 * Parse a JellyFish format match file
 *
 * @param content - Raw text content of the .mat/.txt file
 * @param options - Parser options
 * @returns Parser result with match data and any errors/warnings
 */
export function parseJellyFishMatch(
  content: string,
  options: ParserOptions = {}
): ParserResult {
  const errors: ParserError[] = []
  const warnings: ParserWarning[] = []

  const lines = content.split(/\r?\n/)
  let lineIndex = 0

  // Skip empty lines at start
  while (lineIndex < lines.length && lines[lineIndex].trim() === '') {
    lineIndex++
  }

  if (lineIndex >= lines.length) {
    return {
      success: false,
      errors: [{ line: 1, message: 'Empty file' }],
      warnings: [],
    }
  }

  // Parse match length header
  const matchLengthMatch = lines[lineIndex].match(MATCH_LENGTH_PATTERN)
  if (!matchLengthMatch) {
    return {
      success: false,
      errors: [{
        line: lineIndex + 1,
        message: 'Invalid match header format',
        content: lines[lineIndex],
      }],
      warnings: [],
    }
  }

  const matchLength = parseInt(matchLengthMatch[1], 10)
  lineIndex++

  const games: ParsedGame[] = []
  let currentGame: ParsedGame | null = null

  // Parse games
  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const trimmedLine = line.trim()

    // Skip empty lines
    if (trimmedLine === '') {
      lineIndex++
      continue
    }

    // Check for game header
    const gameMatch = trimmedLine.match(GAME_HEADER_PATTERN)
    if (gameMatch) {
      // Save previous game
      if (currentGame) {
        games.push(currentGame)
        if (options.maxGames && games.length >= options.maxGames) {
          currentGame = null // Don't leave a partial game
          break
        }
      }

      const gameNumber = parseInt(gameMatch[1], 10)
      lineIndex++

      // Try combined player line first (Hardy's format)
      const combinedMatch = lines[lineIndex]?.match(COMBINED_PLAYER_LINE_PATTERN)
      let player1Result: PlayerInfo | null = null
      let player2Result: PlayerInfo | null = null

      if (combinedMatch) {
        // Hardy's format: both players on one line
        player1Result = {
          name: combinedMatch[1].replace(/[_-]/g, ' ').trim(),
          country: combinedMatch[2] || undefined,
          score: parseInt(combinedMatch[3], 10),
        }
        player2Result = {
          name: combinedMatch[4].replace(/[_-]/g, ' ').trim(),
          country: combinedMatch[5] || undefined,
          score: parseInt(combinedMatch[6], 10),
        }
        lineIndex++
      } else {
        // Check if line looks like a combined format we don't understand
        const currentLine = lines[lineIndex] || ''
        const colonCount = (currentLine.match(/:/g) || []).length
        const numberCount = (currentLine.match(/\d+/g) || []).length

        if (colonCount >= 2 && numberCount >= 2) {
          // Looks like combined format but pattern didn't match - warn
          warnings.push({
            line: lineIndex + 1,
            message: `Line appears to be combined player format but doesn't match expected pattern: "${currentLine.substring(0, 60)}..."`,
          })
        }

        // Standard format: players on separate lines
        player1Result = parsePlayerLine(lines[lineIndex], lineIndex + 1, errors)
        lineIndex++
        player2Result = parsePlayerLine(lines[lineIndex], lineIndex + 1, errors)
        lineIndex++
      }

      if (!player1Result || !player2Result) {
        if (options.strict) {
          return { success: false, errors, warnings }
        }
        // Skip this game if not strict
        warnings.push({
          line: lineIndex,
          message: `Skipping game ${gameNumber} due to invalid player headers`,
        })
        currentGame = null
        continue
      }

      currentGame = {
        gameNumber,
        player1: player1Result,
        player2: player2Result,
        moves: [],
      }
      continue
    }

    // Check for move line
    const moveMatch = trimmedLine.match(MOVE_LINE_PATTERN)
    if (moveMatch && currentGame) {
      const parsedMove = parseMoveLine(
        line, // Use original line to preserve spacing
        parseInt(moveMatch[1], 10),
        lineIndex + 1,
        errors,
        warnings,
        options.strict
      )
      if (parsedMove) {
        currentGame.moves.push(parsedMove)
      }
      lineIndex++
      continue
    }

    // Unrecognized line
    if (options.strict && trimmedLine !== '') {
      warnings.push({
        line: lineIndex + 1,
        message: `Unrecognized line format: "${trimmedLine.substring(0, 50)}..."`,
      })
    }
    lineIndex++
  }

  // Save last game
  if (currentGame) {
    games.push(currentGame)
  }

  if (games.length === 0) {
    return {
      success: false,
      errors: [{ line: 1, message: 'No valid games found' }],
      warnings,
    }
  }

  const metadata: MatchMetadata = {
    filename: '',
  }

  return {
    match: {
      matchLength,
      games,
      metadata,
    },
    success: true,
    errors,
    warnings,
  }
}

/**
 * Parse a player line: "PlayerName(USA) : 5"
 */
function parsePlayerLine(
  line: string | undefined,
  lineNum: number,
  errors: ParserError[]
): PlayerInfo | null {
  if (!line) {
    errors.push({ line: lineNum, message: 'Missing player line' })
    return null
  }

  const match = line.trim().match(PLAYER_LINE_PATTERN)
  if (!match) {
    errors.push({
      line: lineNum,
      message: 'Invalid player line format',
      content: line,
    })
    return null
  }

  return {
    name: match[1].trim(),
    country: match[2] || undefined,
    score: parseInt(match[3], 10),
  }
}

/**
 * Parse a move line: " 1) 31: 8/5 6/5                42: 13/9 13/8"
 *
 * JellyFish format puts player 2's moves starting around column 35.
 * We split on a long run of whitespace to separate P1 and P2 moves.
 */
function parseMoveLine(
  line: string,
  moveNumber: number,
  lineNum: number,
  errors: ParserError[],
  warnings: ParserWarning[],
  strict?: boolean
): ParsedMove | null {
  // Remove the move number prefix
  const afterNumber = line.replace(/^\s*\d+\)\s*/, '')

  // Split into P1 and P2 sections
  // Look for 3+ spaces or column position ~35
  const colonPos = afterNumber.indexOf(':')
  if (colonPos === -1) {
    // No dice roll found - might be cube action or resignation
    warnings.push({
      line: lineNum,
      message: `No dice roll found, skipping: "${line.trim()}"`,
    })
    return null
  }

  // Try to split on multiple spaces (P2 usually starts around col 35)
  // Pattern: P1's dice:moves   spaces   P2's dice:moves
  const splitMatch = afterNumber.match(/^(.+?\d+\/\d+\*?\s*)\s{3,}(.+)$/)

  let player1Section: string
  let player2Section: string | undefined

  if (splitMatch) {
    player1Section = splitMatch[1].trim()
    player2Section = splitMatch[2].trim()
  } else {
    // Check if there's a second dice roll (indicates P2 section)
    // Count colons after dice patterns
    const dicePattern = /\d{2}:/g
    const diceMatches = afterNumber.match(dicePattern)

    if (diceMatches && diceMatches.length >= 2) {
      // Find the second dice roll position
      let firstEnd = afterNumber.indexOf(':') + 1
      // Skip the moves after first dice
      const secondDiceStart = afterNumber.indexOf(diceMatches[1], firstEnd)
      if (secondDiceStart > 0) {
        player1Section = afterNumber.substring(0, secondDiceStart).trim()
        player2Section = afterNumber.substring(secondDiceStart).trim()
      } else {
        player1Section = afterNumber.trim()
      }
    } else {
      // Only P1 moved (P2 might have been on bar and couldn't enter)
      player1Section = afterNumber.trim()
    }
  }

  // Parse each section
  const player1Parsed = parseDiceAndMoves(player1Section, lineNum, errors, warnings)
  const player2Parsed = player2Section
    ? parseDiceAndMoves(player2Section, lineNum, errors, warnings)
    : undefined

  return {
    moveNumber,
    player1Dice: player1Parsed?.dice,
    player1Moves: player1Parsed?.moves,
    player2Dice: player2Parsed?.dice,
    player2Moves: player2Parsed?.moves,
  }
}

/**
 * Parse dice roll and moves section: "31: 8/5 6/5"
 */
function parseDiceAndMoves(
  section: string,
  lineNum: number,
  errors: ParserError[],
  warnings: ParserWarning[]
): { dice: DiceRoll; moves: MoveNotation[] } | null {
  if (!section || section.trim() === '') {
    return null
  }

  const match = section.match(DICE_AND_MOVES_PATTERN)
  if (!match) {
    warnings.push({
      line: lineNum,
      message: `Invalid dice/moves format: "${section}"`,
    })
    return null
  }

  const diceStr = match[1]
  const movesStr = match[2]

  // Parse dice (e.g., "31" -> [3, 1])
  const dice: DiceRoll = [
    parseInt(diceStr[0], 10),
    parseInt(diceStr[1], 10),
  ]

  // Parse moves
  const moves: MoveNotation[] = []
  let moveMatch: RegExpExecArray | null

  // Reset regex state
  MOVE_PATTERN.lastIndex = 0

  while ((moveMatch = MOVE_PATTERN.exec(movesStr)) !== null) {
    moves.push({
      from: parseInt(moveMatch[1], 10),
      to: parseInt(moveMatch[2], 10),
      isHit: moveMatch[3] === '*',
    })
  }

  // Handle shorthand notation like "8/5(2)" - expand to two moves
  // Note: JellyFish format shouldn't have this, but some exports do
  const shorthandMatch = movesStr.match(/(\d+)\/(\d+)(\*?)\((\d)\)/g)
  if (shorthandMatch) {
    warnings.push({
      line: lineNum,
      message: `Shorthand notation detected (not standard JellyFish): "${movesStr}"`,
      autoFixed: true,
    })
    // Re-parse with shorthand expansion
    moves.length = 0
    MOVE_PATTERN.lastIndex = 0
    const expandedMoves = expandShorthandMoves(movesStr)
    while ((moveMatch = MOVE_PATTERN.exec(expandedMoves)) !== null) {
      moves.push({
        from: parseInt(moveMatch[1], 10),
        to: parseInt(moveMatch[2], 10),
        isHit: moveMatch[3] === '*',
      })
    }
  }

  return { dice, moves }
}

/**
 * Expand shorthand move notation: "8/5(2)" -> "8/5 8/5"
 */
function expandShorthandMoves(movesStr: string): string {
  return movesStr.replace(/(\d+)\/(\d+)(\*?)\((\d)\)/g, (_match, from, to, hit, count) => {
    const singleMove = `${from}/${to}${hit || ''}`
    return Array(parseInt(count, 10)).fill(singleMove).join(' ')
  })
}

/**
 * Add metadata to a parsed match (filename, tournament, etc.)
 */
export function enrichMatchMetadata(
  match: ParsedMatch,
  filename: string,
  sourceCollection?: string
): ParsedMatch {
  // Extract tournament name from filename if possible
  // Common patterns: "tournament_player1-vs-player2.mat"
  let tournamentName: string | undefined

  // Try to extract tournament from filename
  const underscoreIndex = filename.indexOf('_')
  if (underscoreIndex > 0) {
    tournamentName = filename.substring(0, underscoreIndex).replace(/[-_]/g, ' ')
  }

  return {
    ...match,
    metadata: {
      ...match.metadata,
      filename,
      tournamentName,
      sourceCollection,
    },
  }
}

/**
 * Validate parsed match for completeness
 */
export function validateParsedMatch(match: ParsedMatch): ParserError[] {
  const errors: ParserError[] = []

  if (match.matchLength < 1 || match.matchLength > 25) {
    errors.push({
      line: 1,
      message: `Invalid match length: ${match.matchLength}`,
    })
  }

  if (match.games.length === 0) {
    errors.push({
      line: 1,
      message: 'No games found in match',
    })
  }

  for (const game of match.games) {
    if (game.moves.length === 0) {
      errors.push({
        line: 0,
        message: `Game ${game.gameNumber} has no moves`,
      })
    }

    // Check for invalid point numbers
    for (const move of game.moves) {
      const allMoves = [
        ...(move.player1Moves || []),
        ...(move.player2Moves || []),
      ]
      for (const m of allMoves) {
        if (m.from < 0 || m.from > 25) {
          errors.push({
            line: 0,
            message: `Invalid from point ${m.from} in game ${game.gameNumber}, move ${move.moveNumber}`,
          })
        }
        if (m.to < 0 || m.to > 24) {
          errors.push({
            line: 0,
            message: `Invalid to point ${m.to} in game ${game.gameNumber}, move ${move.moveNumber}`,
          })
        }
      }
    }
  }

  return errors
}

/**
 * Count total positions that will be generated from a match
 */
export function countExpectedPositions(match: ParsedMatch): number {
  let count = 0
  for (const game of match.games) {
    for (const move of game.moves) {
      // Each dice roll creates a position
      if (move.player1Dice) count++
      if (move.player2Dice) count++
    }
  }
  return count
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  ParsedMatch,
  ParsedGame,
  ParsedMove,
  PlayerInfo,
  MoveNotation,
  MatchMetadata,
  ParserOptions,
  ParserResult,
  ParserError,
  ParserWarning,
}
