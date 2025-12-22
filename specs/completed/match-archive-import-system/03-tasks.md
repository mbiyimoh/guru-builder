# Task Breakdown: Match Archive Import System

**Generated:** 2025-12-15
**Source:** specs/match-archive-import-system/01-specification.md
**Slug:** match-archive-import-system
**Last Decompose:** 2025-12-15

---

## Overview

This task breakdown implements a system to import JellyFish .txt format backgammon match archives, replacing the current 10-position-per-phase hand-crafted limitation with ~400K+ real tournament positions.

**Total Tasks:** 20
**Phases:** 4

---

## Phase 1: Core Parser and Replay Engine (6 tasks)

Foundation work: types, parser, replay engine, phase classifier, and unit tests.

### Task 1.1: Create matchImport types module
**Description:** Define TypeScript types for the match import system
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.2

**Technical Requirements:**
- Create `lib/matchImport/types.ts`
- Define all interfaces for parsed data structures

**Implementation:**
```typescript
// lib/matchImport/types.ts

export interface ParsedMatch {
  matchLength: number
  games: ParsedGame[]
  metadata: MatchMetadata
}

export interface ParsedGame {
  gameNumber: number
  player1: PlayerInfo
  player2: PlayerInfo
  moves: ParsedMove[]
}

export interface PlayerInfo {
  name: string
  country?: string  // ISO 3166-1 alpha-3
  score: number
}

export interface ParsedMove {
  moveNumber: number
  player1Dice?: [number, number]
  player1Moves?: MoveNotation[]
  player2Dice?: [number, number]
  player2Moves?: MoveNotation[]
}

export interface MoveNotation {
  from: number  // 1-24, 25 for bar
  to: number    // 1-24, 0 for off
  isHit: boolean
}

export interface MatchMetadata {
  tournamentName?: string
  filename: string
  annotator?: string
  date?: Date
}

export interface ReplayedPosition {
  board: BoardPosition
  dice: [number, number]
  player: 'x' | 'o'
  moveNumber: number
  gameNumber: number
  pipCountX: number
  pipCountO: number
}

// Re-export BoardPosition from mcpClient
export type { BoardPosition } from '@/lib/groundTruth/mcpClient'
```

**Acceptance Criteria:**
- [ ] All interfaces defined with proper JSDoc comments
- [ ] Types exported and importable from `lib/matchImport`
- [ ] No TypeScript errors

---

### Task 1.2: Create database schema migrations
**Description:** Add MatchArchive, ImportedMatch models and extend PositionLibrary
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1

**Technical Requirements:**
- Add MatchArchive model with import tracking fields
- Add ImportedMatch model for match metadata
- Extend PositionLibrary with match metadata fields
- Add ImportStatus enum
- Update PositionSource enum (rename MATCH_MINING to MATCH_IMPORT)

**Implementation (prisma/schema.prisma additions):**
```prisma
enum ImportStatus {
  PENDING
  PARSING
  REPLAYING
  VERIFYING
  COMPLETED
  FAILED
}

model MatchArchive {
  id              String   @id @default(cuid())
  filename        String
  sourceUrl       String?
  sourceCollection String?
  totalMatches    Int      @default(0)
  totalGames      Int      @default(0)
  totalPositions  Int      @default(0)
  positionsVerified Int    @default(0)
  importStatus    ImportStatus @default(PENDING)
  errorMessage    String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  positions       PositionLibrary[]
  matches         ImportedMatch[]

  @@index([importStatus])
  @@index([sourceCollection])
}

model ImportedMatch {
  id              String   @id @default(cuid())
  tournamentName  String?
  matchLength     Int
  player1Name     String
  player1Country  String?
  player2Name     String
  player2Country  String?
  player1Score    Int
  player2Score    Int
  archiveId       String
  archive         MatchArchive @relation(fields: [archiveId], references: [id], onDelete: Cascade)
  matchDate       DateTime?
  createdAt       DateTime @default(now())
  positions       PositionLibrary[]

  @@index([archiveId])
  @@index([tournamentName])
  @@index([player1Name])
  @@index([player2Name])
}

// Update PositionLibrary model - add these fields:
// matchId           String?
// match             ImportedMatch? @relation(fields: [matchId], references: [id])
// moveNumber        Int?
// gameNumber        Int?
// archiveId         String?
// archive           MatchArchive? @relation(fields: [archiveId], references: [id])
// @@index([matchId])
// @@index([archiveId])
```

**Acceptance Criteria:**
- [ ] Database migration created with `npm run migrate:safe -- add-match-archive-models`
- [ ] All new models have proper indexes
- [ ] Relations correctly set up
- [ ] Prisma client regenerated

---

### Task 1.3: Implement JellyFish parser
**Description:** Parse JellyFish .txt/.mat format match files
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.1

**Technical Requirements:**
- Parse match header (match length)
- Parse game headers (player names, countries, scores)
- Parse move notation lines (dice + moves for both players)
- Handle hit notation (asterisk)
- Handle bar entry (25/) and bear off (X/0)
- Extract tournament name from filename

**Implementation (lib/matchImport/parser.ts):**
```typescript
import type { ParsedMatch, ParsedGame, ParsedMove, MoveNotation, PlayerInfo, MatchMetadata } from './types'

/**
 * Parse a JellyFish .txt/.mat format match file
 */
export function parseJellyFishMatch(content: string, filename: string): ParsedMatch {
  const lines = content.split('\n')
  let lineIndex = 0

  // Skip empty lines at start
  while (lineIndex < lines.length && !lines[lineIndex].trim()) {
    lineIndex++
  }

  // Parse match header: " 7 point match"
  const matchLength = parseMatchLength(lines[lineIndex++])

  const games: ParsedGame[] = []

  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim()

    if (line.startsWith('Game ')) {
      const result = parseGame(lines, lineIndex)
      games.push(result.game)
      lineIndex = result.nextIndex
    } else {
      lineIndex++
    }
  }

  return {
    matchLength,
    games,
    metadata: {
      filename,
      tournamentName: extractTournamentFromFilename(filename)
    }
  }
}

function parseMatchLength(line: string): number {
  const match = line.match(/(\d+)\s+point\s+match/i)
  if (!match) throw new Error(`Invalid match header: ${line}`)
  return parseInt(match[1], 10)
}

function parseGame(lines: string[], startIndex: number): { game: ParsedGame; nextIndex: number } {
  let index = startIndex

  // Parse "Game N"
  const gameMatch = lines[index].match(/Game\s+(\d+)/i)
  if (!gameMatch) throw new Error(`Invalid game header: ${lines[index]}`)
  const gameNumber = parseInt(gameMatch[1], 10)
  index++

  // Parse player 1
  const player1 = parsePlayerLine(lines[index++])
  // Parse player 2
  const player2 = parsePlayerLine(lines[index++])

  // Parse moves until next game or end
  const moves: ParsedMove[] = []
  while (index < lines.length) {
    const line = lines[index].trim()

    // Check for next game or empty line (game end)
    if (line.startsWith('Game ') || !line) {
      break
    }

    // Check if this is a move line (starts with number and parenthesis)
    if (/^\s*\d+\)/.test(lines[index])) {
      const move = parseMoveLine(lines[index])
      if (move) moves.push(move)
    }
    index++
  }

  return {
    game: { gameNumber, player1, player2, moves },
    nextIndex: index
  }
}

function parsePlayerLine(line: string): PlayerInfo {
  // "John Smith(USA) : 3" or "Jane Doe : 0"
  const match = line.match(/^(.+?)(?:\(([A-Z]{2,3})\))?\s*:\s*(\d+)$/)
  if (!match) throw new Error(`Invalid player line: ${line}`)

  return {
    name: match[1].trim(),
    country: match[2] || undefined,
    score: parseInt(match[3], 10)
  }
}

function parseMoveLine(line: string): ParsedMove | null {
  // " 1) 31: 8/5 6/5                42: 24/20 13/11"
  const match = line.match(/^\s*(\d+)\)\s*(.*)$/)
  if (!match) return null

  const moveNumber = parseInt(match[1], 10)
  const movePart = match[2]

  // Split at approximately column 35 for player 2's moves
  // Find the second dice pattern after some whitespace
  const dicePattern = /(\d)(\d):/g
  const diceMatches = [...movePart.matchAll(dicePattern)]

  let player1Part = ''
  let player2Part = ''

  if (diceMatches.length >= 2) {
    const secondDiceIndex = diceMatches[1].index!
    player1Part = movePart.substring(0, secondDiceIndex).trim()
    player2Part = movePart.substring(secondDiceIndex).trim()
  } else if (diceMatches.length === 1) {
    // Only player 1 moved (player 2 might be on bar with no entry)
    player1Part = movePart.trim()
  }

  return {
    moveNumber,
    ...parsePlayerMove(player1Part),
    ...parsePlayerMove(player2Part, 'player2')
  }
}

function parsePlayerMove(
  part: string,
  prefix: 'player1' | 'player2' = 'player1'
): Partial<ParsedMove> {
  if (!part) return {}

  const match = part.match(/^(\d)(\d):\s*(.*)$/)
  if (!match) return {}

  const dice: [number, number] = [parseInt(match[1], 10), parseInt(match[2], 10)]
  const moveStr = match[3].trim()
  const moves = parseMoveNotations(moveStr)

  if (prefix === 'player1') {
    return { player1Dice: dice, player1Moves: moves }
  } else {
    return { player2Dice: dice, player2Moves: moves }
  }
}

function parseMoveNotations(moveStr: string): MoveNotation[] {
  if (!moveStr) return []

  const moves: MoveNotation[] = []
  const parts = moveStr.split(/\s+/)

  for (const part of parts) {
    // "8/5" or "13/7*" (hit) or "25/20" (bar) or "6/0" (off)
    const match = part.match(/^(\d+)\/(\d+)(\*)?$/)
    if (match) {
      moves.push({
        from: parseInt(match[1], 10),
        to: parseInt(match[2], 10),
        isHit: !!match[3]
      })
    }
  }

  return moves
}

function extractTournamentFromFilename(filename: string): string | undefined {
  // Remove extension and try to extract tournament name
  const baseName = filename.replace(/\.(txt|mat)$/i, '')

  // Common patterns: "Tournament_Player1-vs-Player2" or "Tournament-Event"
  const parts = baseName.split(/[_-]/)
  if (parts.length > 1) {
    return parts[0].replace(/([A-Z])/g, ' $1').trim()
  }
  return undefined
}

export { parseMatchLength, parsePlayerLine, parseMoveLine, parseMoveNotations }
```

**Acceptance Criteria:**
- [ ] Parses match length from header
- [ ] Parses player names with optional country codes
- [ ] Parses player scores
- [ ] Parses dice rolls (two-digit format)
- [ ] Parses move notation (from/to format)
- [ ] Handles hit notation with asterisk
- [ ] Handles bar (25) and bearing off (0)
- [ ] Extracts tournament from filename
- [ ] Unit tests for all parsing functions

---

### Task 1.4: Implement move replay engine
**Description:** Reconstruct board states by replaying parsed moves
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.1, Task 1.3

**Technical Requirements:**
- Start from standard opening position
- Apply moves sequentially
- Handle hits (move opponent to bar)
- Track pip counts for phase classification
- Generate positions at each decision point

**Implementation (lib/matchImport/replayEngine.ts):**
```typescript
import type { BoardPosition } from '@/lib/groundTruth/mcpClient'
import type { ParsedGame, ParsedMove, MoveNotation, ReplayedPosition } from './types'

const INITIAL_BOARD: BoardPosition = {
  x: { '24': 2, '13': 5, '8': 3, '6': 5 },
  o: { '1': 2, '12': 5, '17': 3, '19': 5 }
}

/**
 * Replay a game and extract all positions with dice rolls
 */
export function replayGame(
  game: ParsedGame,
  gameNumber: number
): ReplayedPosition[] {
  const positions: ReplayedPosition[] = []
  let board = structuredClone(INITIAL_BOARD)

  for (const move of game.moves) {
    // Position before player 1's move (X)
    if (move.player1Dice && move.player1Moves && move.player1Moves.length > 0) {
      const pipCounts = calculatePipCounts(board)
      positions.push({
        board: structuredClone(board),
        dice: move.player1Dice,
        player: 'x',
        moveNumber: move.moveNumber,
        gameNumber,
        ...pipCounts
      })

      // Apply player 1's moves
      board = applyMoves(board, 'x', move.player1Moves)
    }

    // Position before player 2's move (O)
    if (move.player2Dice && move.player2Moves && move.player2Moves.length > 0) {
      const pipCounts = calculatePipCounts(board)
      positions.push({
        board: structuredClone(board),
        dice: move.player2Dice,
        player: 'o',
        moveNumber: move.moveNumber,
        gameNumber,
        ...pipCounts
      })

      // Apply player 2's moves
      board = applyMoves(board, 'o', move.player2Moves)
    }
  }

  return positions
}

/**
 * Apply a set of moves to a board position
 */
export function applyMoves(
  board: BoardPosition,
  player: 'x' | 'o',
  moves: MoveNotation[]
): BoardPosition {
  const newBoard = structuredClone(board)
  const opponent = player === 'x' ? 'o' : 'x'

  for (const move of moves) {
    const fromPoint = String(move.from)
    const toPoint = String(move.to)

    // Convert bar notation
    const fromKey = move.from === 25 ? 'bar' : fromPoint
    const toKey = move.to === 0 ? 'off' : toPoint

    // Remove checker from source
    if (newBoard[player][fromKey]) {
      newBoard[player][fromKey]--
      if (newBoard[player][fromKey] === 0) {
        delete newBoard[player][fromKey]
      }
    }

    // Handle hitting opponent (only if not bearing off)
    if (move.isHit && toKey !== 'off') {
      if (newBoard[opponent][toKey]) {
        newBoard[opponent][toKey]--
        if (newBoard[opponent][toKey] === 0) {
          delete newBoard[opponent][toKey]
        }
        // Add opponent checker to bar
        newBoard[opponent]['bar'] = (newBoard[opponent]['bar'] || 0) + 1
      }
    }

    // Add checker to destination (unless bearing off)
    if (toKey !== 'off') {
      newBoard[player][toKey] = (newBoard[player][toKey] || 0) + 1
    }
  }

  return newBoard
}

/**
 * Calculate pip counts for both players
 */
export function calculatePipCounts(board: BoardPosition): { pipCountX: number; pipCountO: number } {
  let pipCountX = 0
  let pipCountO = 0

  // X moves from 24 to 1, bar counts as 25
  for (const [point, count] of Object.entries(board.x)) {
    if (point === 'bar') {
      pipCountX += 25 * count
    } else if (point !== 'off') {
      pipCountX += parseInt(point, 10) * count
    }
  }

  // O moves from 1 to 24 (their perspective), so pip count is (25 - point)
  for (const [point, count] of Object.entries(board.o)) {
    if (point === 'bar') {
      pipCountO += 25 * count
    } else if (point !== 'off') {
      pipCountO += (25 - parseInt(point, 10)) * count
    }
  }

  return { pipCountX, pipCountO }
}

/**
 * Replay all games in a match
 */
export function replayMatch(games: ParsedGame[]): ReplayedPosition[] {
  const positions: ReplayedPosition[] = []

  for (let i = 0; i < games.length; i++) {
    const gamePositions = replayGame(games[i], i + 1)
    positions.push(...gamePositions)
  }

  return positions
}

export { INITIAL_BOARD }
```

**Acceptance Criteria:**
- [ ] Starts from correct initial position
- [ ] Applies single moves correctly
- [ ] Handles multiple moves per turn
- [ ] Handles hits and moves opponent to bar
- [ ] Handles bar entry (25/X)
- [ ] Handles bearing off (X/0)
- [ ] Calculates pip counts accurately
- [ ] Unit tests for all move scenarios

---

### Task 1.5: Implement game phase classifier
**Description:** Classify positions into OPENING, EARLY, MIDDLE, BEAROFF phases
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.4

**Technical Requirements:**
- Skip opening positions (move 1 from standard position)
- Classify based on move number, pip counts, and board state
- EARLY: moves 2-6 with high pip counts
- BEAROFF: all checkers in home board
- MIDDLE: everything else

**Implementation (lib/matchImport/phaseClassifier.ts):**
```typescript
import type { GamePhase } from '@/lib/positionLibrary/types'
import type { BoardPosition } from '@/lib/groundTruth/mcpClient'
import type { ReplayedPosition } from './types'
import { INITIAL_BOARD } from './replayEngine'

/**
 * Classify a position into a game phase
 */
export function classifyGamePhase(position: ReplayedPosition): GamePhase {
  const { moveNumber, pipCountX, pipCountO, board } = position

  // Skip first move from standard position (handled by OPENING_CATALOG)
  if (moveNumber === 1 && isStandardOpening(board)) {
    return 'OPENING'
  }

  // Bearoff: all checkers in home board for the player to move
  if (isBearoffPosition(board, position.player)) {
    return 'BEAROFF'
  }

  // Early game: first 6 moves, standard development
  if (moveNumber <= 6) {
    return 'EARLY'
  }

  // Middle game: everything else (most complex positions)
  return 'MIDDLE'
}

/**
 * Check if board is at standard opening position
 */
function isStandardOpening(board: BoardPosition): boolean {
  const initialX = INITIAL_BOARD.x
  const initialO = INITIAL_BOARD.o

  // Check X's checkers
  for (const [point, count] of Object.entries(initialX)) {
    if ((board.x[point] || 0) !== count) return false
  }
  for (const [point, count] of Object.entries(board.x)) {
    if ((initialX[point] || 0) !== count) return false
  }

  // Check O's checkers
  for (const [point, count] of Object.entries(initialO)) {
    if ((board.o[point] || 0) !== count) return false
  }
  for (const [point, count] of Object.entries(board.o)) {
    if ((initialO[point] || 0) !== count) return false
  }

  return true
}

/**
 * Check if this is a bearoff position for the given player
 */
function isBearoffPosition(board: BoardPosition, player: 'x' | 'o'): boolean {
  const checkers = board[player]

  // X's home is points 1-6, O's home is points 19-24
  const homeStart = player === 'x' ? 1 : 19
  const homeEnd = player === 'x' ? 6 : 24

  for (const [point, count] of Object.entries(checkers)) {
    if (point === 'off') continue  // Already borne off
    if (point === 'bar') return false  // Can't bear off with checker on bar

    const pointNum = parseInt(point, 10)
    if (player === 'x') {
      if (pointNum > 6) return false  // X has checker outside home
    } else {
      if (pointNum < 19) return false  // O has checker outside home
    }
  }

  return true
}

/**
 * Enhanced classification using pip counts
 */
export function classifyWithPipCounts(position: ReplayedPosition): GamePhase {
  const { pipCountX, pipCountO, moveNumber, board, player } = position
  const totalPips = pipCountX + pipCountO

  // Opening: handled by opening catalog
  if (moveNumber === 1 && isStandardOpening(board)) {
    return 'OPENING'
  }

  // Bearoff: low total pip count AND checkers in home
  if (totalPips < 60 && isBearoffPosition(board, player)) {
    return 'BEAROFF'
  }

  // Early: first few moves, high pip count
  if (totalPips > 280 && moveNumber <= 6) {
    return 'EARLY'
  }

  // Default to middle game
  return 'MIDDLE'
}

export { isStandardOpening, isBearoffPosition }
```

**Acceptance Criteria:**
- [ ] Correctly identifies opening positions (skips them)
- [ ] Classifies early game positions (moves 2-6)
- [ ] Classifies bearoff when all checkers in home
- [ ] Classifies middle game for complex contact positions
- [ ] Unit tests for each phase classification

---

### Task 1.6: Create barrel exports and unit tests
**Description:** Create index.ts barrel exports and comprehensive unit tests
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1, Task 1.3, Task 1.4, Task 1.5

**Implementation (lib/matchImport/index.ts):**
```typescript
// lib/matchImport/index.ts
// Barrel exports for Match Import module

export type {
  ParsedMatch,
  ParsedGame,
  PlayerInfo,
  ParsedMove,
  MoveNotation,
  MatchMetadata,
  ReplayedPosition
} from './types'

export {
  parseJellyFishMatch,
  parseMatchLength,
  parsePlayerLine,
  parseMoveLine,
  parseMoveNotations
} from './parser'

export {
  replayGame,
  replayMatch,
  applyMoves,
  calculatePipCounts,
  INITIAL_BOARD
} from './replayEngine'

export {
  classifyGamePhase,
  classifyWithPipCounts,
  isStandardOpening,
  isBearoffPosition
} from './phaseClassifier'
```

**Unit Test File (tests/unit-match-import.spec.ts):**
```typescript
import { test, expect, describe } from '@playwright/test'

// Import functions to test
import {
  parseJellyFishMatch,
  parseMatchLength,
  parsePlayerLine,
  parseMoveNotations,
  replayGame,
  applyMoves,
  calculatePipCounts,
  classifyGamePhase,
  INITIAL_BOARD
} from '@/lib/matchImport'

describe('JellyFish Parser', () => {
  test('parses match length from header', () => {
    expect(parseMatchLength(' 7 point match')).toBe(7)
    expect(parseMatchLength('15 point match')).toBe(15)
  })

  test('parses player with country code', () => {
    const player = parsePlayerLine('John Smith(USA) : 3')
    expect(player.name).toBe('John Smith')
    expect(player.country).toBe('USA')
    expect(player.score).toBe(3)
  })

  test('parses player without country', () => {
    const player = parsePlayerLine('Jane Doe : 0')
    expect(player.name).toBe('Jane Doe')
    expect(player.country).toBeUndefined()
    expect(player.score).toBe(0)
  })

  test('parses basic move notation', () => {
    const moves = parseMoveNotations('8/5 6/5')
    expect(moves).toHaveLength(2)
    expect(moves[0]).toEqual({ from: 8, to: 5, isHit: false })
    expect(moves[1]).toEqual({ from: 6, to: 5, isHit: false })
  })

  test('parses hit notation with asterisk', () => {
    const moves = parseMoveNotations('13/7*')
    expect(moves[0].isHit).toBe(true)
  })

  test('parses bar entry', () => {
    const moves = parseMoveNotations('25/20')
    expect(moves[0]).toEqual({ from: 25, to: 20, isHit: false })
  })

  test('parses bearing off', () => {
    const moves = parseMoveNotations('6/0 5/0')
    expect(moves[0].to).toBe(0)
    expect(moves[1].to).toBe(0)
  })
})

describe('Move Replay Engine', () => {
  test('calculates initial pip counts correctly', () => {
    const pips = calculatePipCounts(INITIAL_BOARD)
    expect(pips.pipCountX).toBe(167) // Standard pip count
    expect(pips.pipCountO).toBe(167)
  })

  test('applies simple move correctly', () => {
    const newBoard = applyMoves(
      structuredClone(INITIAL_BOARD),
      'x',
      [{ from: 8, to: 5, isHit: false }, { from: 6, to: 5, isHit: false }]
    )
    expect(newBoard.x['5']).toBe(2)
    expect(newBoard.x['8']).toBe(2)  // 3 - 1
    expect(newBoard.x['6']).toBe(4)  // 5 - 1
  })

  test('handles hit correctly', () => {
    // Set up a position with O blot on point 5
    const board = structuredClone(INITIAL_BOARD)
    board.o['5'] = 1

    const newBoard = applyMoves(board, 'x', [{ from: 8, to: 5, isHit: true }])

    expect(newBoard.x['5']).toBe(1)
    expect(newBoard.o['5']).toBeUndefined()
    expect(newBoard.o['bar']).toBe(1)
  })
})

describe('Phase Classifier', () => {
  test('classifies early game position', () => {
    const position = {
      board: INITIAL_BOARD,
      dice: [3, 1] as [number, number],
      player: 'x' as const,
      moveNumber: 3,
      gameNumber: 1,
      pipCountX: 160,
      pipCountO: 165
    }
    expect(classifyGamePhase(position)).toBe('EARLY')
  })
})
```

**Acceptance Criteria:**
- [ ] All exports work from barrel file
- [ ] Unit tests pass for parser
- [ ] Unit tests pass for replay engine
- [ ] Unit tests pass for phase classifier
- [ ] Test coverage > 80%

---

## Phase 2: Import Pipeline (5 tasks)

Background job processing with Inngest, file storage, and verification.

### Task 2.1: Implement file storage utility
**Description:** Create utility for storing/retrieving uploaded match files
**Size:** Small
**Priority:** High
**Dependencies:** None

**Technical Requirements:**
- Store file content by archive ID
- Retrieve file content for processing
- Simple filesystem storage for MVP (can upgrade to S3 later)

**Implementation (lib/matchImport/fileStorage.ts):**
```typescript
import fs from 'fs/promises'
import path from 'path'

const STORAGE_DIR = process.env.MATCH_ARCHIVE_STORAGE || './data/match-archives'

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

/**
 * Store archive file content
 */
export async function storeArchiveFile(archiveId: string, content: string): Promise<void> {
  await ensureStorageDir()
  const filePath = path.join(STORAGE_DIR, `${archiveId}.txt`)
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Read archive file content
 */
export async function readArchiveFile(archiveId: string): Promise<string> {
  const filePath = path.join(STORAGE_DIR, `${archiveId}.txt`)
  return fs.readFile(filePath, 'utf-8')
}

/**
 * Delete archive file
 */
export async function deleteArchiveFile(archiveId: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, `${archiveId}.txt`)
  try {
    await fs.unlink(filePath)
  } catch (error) {
    // Ignore if file doesn't exist
  }
}
```

**Acceptance Criteria:**
- [ ] Can store file content
- [ ] Can retrieve file content
- [ ] Creates storage directory if missing
- [ ] Handles missing files gracefully

---

### Task 2.2: Create match import API endpoint
**Description:** POST endpoint for uploading match files
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2, Task 2.1

**Implementation (app/api/match-import/route.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'
import { storeArchiveFile } from '@/lib/matchImport/fileStorage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const engineId = formData.get('engineId') as string
    const sourceCollection = formData.get('sourceCollection') as string

    if (!file || !engineId) {
      return NextResponse.json(
        { error: 'File and engineId required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.mat')) {
      return NextResponse.json(
        { error: 'Only .txt and .mat files supported' },
        { status: 400 }
      )
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 50MB)' },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()

    // Create archive record
    const archive = await prisma.matchArchive.create({
      data: {
        filename: file.name,
        sourceCollection: sourceCollection || null,
        importStatus: 'PENDING'
      }
    })

    // Store file content
    await storeArchiveFile(archive.id, content)

    // Trigger Inngest job
    await inngest.send({
      name: 'match-archive/import.started',
      data: {
        archiveId: archive.id,
        engineId
      }
    })

    return NextResponse.json({
      importId: archive.id,
      status: 'PENDING',
      filename: file.name
    })
  } catch (error) {
    console.error('[Match Import API]', error)
    return NextResponse.json(
      { error: 'Failed to start import' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const archives = await prisma.matchArchive.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ archives })
  } catch (error) {
    console.error('[Match Import API]', error)
    return NextResponse.json(
      { error: 'Failed to fetch archives' },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria:**
- [ ] Accepts multipart form data with file
- [ ] Validates file type (.txt, .mat)
- [ ] Validates file size (max 50MB)
- [ ] Creates archive record in database
- [ ] Triggers Inngest job
- [ ] Returns import ID and status

---

### Task 2.3: Implement match archive import Inngest function
**Description:** Background job to parse, replay, and store positions
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.3, Task 1.4, Task 1.5, Task 2.1, Task 2.2

**Implementation (additions to lib/inngest-functions.ts):**
```typescript
import { parseJellyFishMatch, replayMatch, classifyGamePhase } from '@/lib/matchImport'
import { readArchiveFile } from '@/lib/matchImport/fileStorage'
import { renderBoardFromPosition } from '@/lib/positionLibrary/asciiRenderer'
import crypto from 'crypto'

/**
 * Generate unique position ID from board state and dice
 */
function generatePositionId(position: ReplayedPosition): string {
  const boardStr = JSON.stringify(position.board) + position.dice.join('-') + position.player
  return crypto.createHash('md5').update(boardStr).digest('hex').substring(0, 14)
}

export const matchArchiveImport = inngest.createFunction(
  {
    id: 'match-archive-import',
    retries: 3,
  },
  { event: 'match-archive/import.started' },
  async ({ event, step }) => {
    const { archiveId, engineId } = event.data

    // Step 1: Update status to parsing
    await step.run('update-status-parsing', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: { importStatus: 'PARSING' }
      })
    })

    // Step 2: Parse the match file
    const parsedMatch = await step.run('parse-match-file', async () => {
      const archive = await prisma.matchArchive.findUnique({
        where: { id: archiveId }
      })
      if (!archive) throw new Error('Archive not found')

      const content = await readArchiveFile(archiveId)
      return parseJellyFishMatch(content, archive.filename)
    })

    // Step 3: Create ImportedMatch records
    await step.run('create-match-records', async () => {
      const archive = await prisma.matchArchive.findUnique({
        where: { id: archiveId }
      })

      for (const game of parsedMatch.games) {
        if (game.gameNumber === 1) {
          // Create one ImportedMatch per actual match (first game)
          await prisma.importedMatch.create({
            data: {
              archiveId,
              tournamentName: parsedMatch.metadata.tournamentName,
              matchLength: parsedMatch.matchLength,
              player1Name: game.player1.name,
              player1Country: game.player1.country,
              player2Name: game.player2.name,
              player2Country: game.player2.country,
              player1Score: game.player1.score,
              player2Score: game.player2.score
            }
          })
        }
      }

      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          totalMatches: 1,
          totalGames: parsedMatch.games.length
        }
      })
    })

    // Step 4: Replay and extract positions
    await step.run('update-status-replaying', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: { importStatus: 'REPLAYING' }
      })
    })

    const positions = await step.run('replay-positions', async () => {
      const allPositions = replayMatch(parsedMatch.games)

      // Classify and filter (skip OPENING - handled by opening catalog)
      return allPositions
        .map(pos => ({
          ...pos,
          gamePhase: classifyGamePhase(pos)
        }))
        .filter(pos => pos.gamePhase !== 'OPENING')
    })

    // Step 5: Store unverified positions
    const positionIds = await step.run('store-unverified-positions', async () => {
      const ids: string[] = []

      for (const pos of positions) {
        const positionId = generatePositionId(pos)
        const diceRoll = `${pos.dice[0]}-${pos.dice[1]}`

        try {
          await prisma.positionLibrary.upsert({
            where: { positionId },
            create: {
              positionId,
              gamePhase: pos.gamePhase,
              diceRoll,
              bestMove: '',
              bestMoveEquity: 0,
              asciiBoard: renderBoardFromPosition(pos.board, diceRoll, pos.player),
              sourceType: 'MATCH_IMPORT',
              archiveId,
              moveNumber: pos.moveNumber,
              gameNumber: pos.gameNumber,
              engineId
            },
            update: {}  // Skip if already exists
          })
          ids.push(positionId)
        } catch (error) {
          console.error(`Failed to store position ${positionId}:`, error)
        }
      }

      return ids
    })

    // Step 6: Update status and queue verification
    await step.run('update-status-verifying', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          importStatus: 'VERIFYING',
          totalPositions: positionIds.length
        }
      })
    })

    // Step 7: Send verification events in batches
    const BATCH_SIZE = 50
    const batches = []
    for (let i = 0; i < positionIds.length; i += BATCH_SIZE) {
      batches.push(positionIds.slice(i, i + BATCH_SIZE))
    }

    for (let i = 0; i < batches.length; i++) {
      await step.sendEvent(`send-verification-batch-${i}`, {
        name: 'match-archive/verify-batch',
        data: {
          archiveId,
          positionIds: batches[i],
          batchNumber: i + 1,
          totalBatches: batches.length,
          engineId
        }
      })
    }

    return {
      success: true,
      archiveId,
      positionsQueued: positionIds.length,
      batches: batches.length
    }
  }
)
```

**Acceptance Criteria:**
- [ ] Parses uploaded match file
- [ ] Creates ImportedMatch records with metadata
- [ ] Replays all games and extracts positions
- [ ] Filters out opening positions
- [ ] Stores unverified positions in database
- [ ] Queues verification batches
- [ ] Updates archive status at each step

---

### Task 2.4: Implement batch verification Inngest function
**Description:** Verify positions against GNUBG in throttled batches
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.3

**Implementation (additions to lib/inngest-functions.ts):**
```typescript
import { getPlaysForPosition, formatMove } from '@/lib/groundTruth/mcpClient'
import type { PlaysBoardConfig } from '@/lib/groundTruth/mcpClient'

/**
 * Reconstruct PlaysBoardConfig from stored position
 */
function reconstructBoardConfig(position: any): PlaysBoardConfig {
  // Parse the stored probabilityBreakdown for board data if available
  // Otherwise reconstruct from ASCII board (more complex)
  const probBreakdown = position.probabilityBreakdown as any

  if (probBreakdown?.metadata?.board) {
    return {
      board: probBreakdown.metadata.board,
      cubeful: false,
      dice: probBreakdown.metadata.dice || parseDiceRoll(position.diceRoll),
      player: probBreakdown.metadata.player || 'x',
      'max-moves': 3
    }
  }

  // Fallback: this shouldn't happen for newly imported positions
  throw new Error(`Cannot reconstruct board config for position ${position.positionId}`)
}

function parseDiceRoll(diceStr: string): [number, number] {
  const [d1, d2] = diceStr.split('-').map(Number)
  return [d1, d2]
}

export const verifyPositionBatch = inngest.createFunction(
  {
    id: 'verify-position-batch',
    concurrency: {
      limit: 3  // Max 3 concurrent batch verifications
    },
    throttle: {
      limit: 5,      // Max 5 positions per second
      period: '1s'
    }
  },
  { event: 'match-archive/verify-batch' },
  async ({ event, step }) => {
    const { archiveId, positionIds, batchNumber, totalBatches, engineId } = event.data

    // Get engine config
    const engine = await step.run('get-engine', async () => {
      return prisma.groundTruthEngine.findUnique({
        where: { id: engineId }
      })
    })

    if (!engine) {
      throw new Error(`Engine not found: ${engineId}`)
    }

    const engineConfig = {
      engineId,
      engineUrl: engine.engineUrl,
      engineName: engine.name,
      domain: engine.domain,
      enabled: true,
      configId: ''
    }

    let verified = 0
    let errors = 0

    // Verify each position
    for (const positionId of positionIds) {
      await step.run(`verify-${positionId}`, async () => {
        try {
          const position = await prisma.positionLibrary.findUnique({
            where: { positionId }
          })

          if (!position || position.bestMove) {
            return // Already verified or not found
          }

          // Reconstruct board config
          const boardConfig = reconstructBoardConfig(position)

          // Query GNUBG
          const moves = await getPlaysForPosition(boardConfig, engineConfig)

          if (moves && moves.length > 0) {
            await prisma.positionLibrary.update({
              where: { positionId },
              data: {
                bestMove: formatMove(moves[0].play),
                bestMoveEquity: moves[0].evaluation.eq,
                secondBestMove: moves[1] ? formatMove(moves[1].play) : null,
                secondEquity: moves[1]?.evaluation.eq ?? null,
                thirdBestMove: moves[2] ? formatMove(moves[2].play) : null,
                thirdEquity: moves[2]?.evaluation.eq ?? null,
                probabilityBreakdown: {
                  ...position.probabilityBreakdown as object,
                  best: moves[0].evaluation.probability,
                  second: moves[1]?.evaluation.probability ?? null,
                  third: moves[2]?.evaluation.probability ?? null
                }
              }
            })
            verified++
          }
        } catch (error) {
          console.error(`Failed to verify ${positionId}:`, error)
          errors++
        }
      })

      // Small delay between verifications
      await step.sleep(`delay-${positionId}`, '200ms')
    }

    // Update archive stats
    await step.run('update-archive-stats', async () => {
      const archive = await prisma.matchArchive.findUnique({
        where: { id: archiveId }
      })

      if (!archive) return

      const newVerified = archive.positionsVerified + verified

      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          positionsVerified: newVerified
        }
      })

      // Check if all batches are done
      if (batchNumber === totalBatches) {
        // Final batch - check if we're done
        const finalArchive = await prisma.matchArchive.findUnique({
          where: { id: archiveId }
        })

        if (finalArchive && finalArchive.positionsVerified >= finalArchive.totalPositions * 0.95) {
          // 95%+ verified = complete
          await prisma.matchArchive.update({
            where: { id: archiveId },
            data: {
              importStatus: 'COMPLETED',
              completedAt: new Date()
            }
          })
        }
      }
    })

    return {
      batchNumber,
      totalBatches,
      verified,
      errors
    }
  }
)
```

**Acceptance Criteria:**
- [ ] Processes positions in batches
- [ ] Throttles GNUBG queries (5/second max)
- [ ] Updates position with best moves
- [ ] Handles verification errors gracefully
- [ ] Updates archive verification count
- [ ] Marks archive complete when done

---

### Task 2.5: Create import status API endpoint
**Description:** Endpoint to poll import progress
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 2.2

**Implementation (app/api/match-import/[importId]/route.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { importId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const archive = await prisma.matchArchive.findUnique({
      where: { id: params.importId },
      include: {
        matches: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!archive) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: archive.id,
      status: archive.importStatus,
      filename: archive.filename,
      sourceCollection: archive.sourceCollection,
      totalMatches: archive.totalMatches,
      totalGames: archive.totalGames,
      totalPositions: archive.totalPositions,
      positionsVerified: archive.positionsVerified,
      progress: archive.totalPositions > 0
        ? Math.round((archive.positionsVerified / archive.totalPositions) * 100)
        : 0,
      errorMessage: archive.errorMessage,
      createdAt: archive.createdAt,
      completedAt: archive.completedAt,
      matches: archive.matches
    })
  } catch (error) {
    console.error('[Import Status API]', error)
    return NextResponse.json(
      { error: 'Failed to fetch import status' },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria:**
- [ ] Returns import status and progress
- [ ] Includes match metadata
- [ ] Calculates progress percentage
- [ ] Handles not found gracefully

---

## Phase 3: UI and Deprecation (5 tasks)

User interface components and removal of old code.

### Task 3.1: Create MatchImportModal component
**Description:** Modal for uploading match archive files
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2

**Implementation (components/match-import/MatchImportModal.tsx):**
```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'

interface MatchImportModalProps {
  engineId: string
  isOpen: boolean
  onClose: () => void
  onImportStarted: (importId: string) => void
}

const SOURCE_COLLECTIONS = [
  { value: '', label: 'Select collection...' },
  { value: 'Hardy\'s', label: 'Hardy\'s Backgammon Pages' },
  { value: 'BigBrother', label: 'Big Brother Collection' },
  { value: 'LittleSister', label: 'LittleSister Collection' },
  { value: 'Other', label: 'Other' }
]

export function MatchImportModal({
  engineId,
  isOpen,
  onClose,
  onImportStarted
}: MatchImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sourceCollection, setSourceCollection] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.txt') && !selectedFile.name.endsWith('.mat')) {
        setError('Only .txt and .mat files are supported')
        return
      }
      // Validate file size
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File too large (max 50MB)')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('engineId', engineId)
      formData.append('sourceCollection', sourceCollection)

      const res = await fetch('/api/match-import', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import failed')
      }

      const data = await res.json()
      onImportStarted(data.importId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setSourceCollection('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Match Archive</DialogTitle>
          <DialogDescription>
            Upload a JellyFish .txt or .mat file to import positions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Match File
            </label>
            <input
              type="file"
              accept=".txt,.mat"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Source Collection
            </label>
            <select
              value={sourceCollection}
              onChange={(e) => setSourceCollection(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {SOURCE_COLLECTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || isUploading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Start Import'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Acceptance Criteria:**
- [ ] File picker for .txt/.mat files
- [ ] File validation (type, size)
- [ ] Source collection dropdown
- [ ] Upload progress indicator
- [ ] Error display
- [ ] Triggers import on submit

---

### Task 3.2: Create ImportProgressTracker component
**Description:** Component to show import progress and status
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.5

**Implementation (components/match-import/ImportProgressTracker.tsx):**
```typescript
'use client'

import { useState, useEffect } from 'react'

interface ImportProgress {
  id: string
  status: string
  filename: string
  totalPositions: number
  positionsVerified: number
  progress: number
  errorMessage?: string
}

interface ImportProgressTrackerProps {
  importId: string
  onComplete?: () => void
}

export function ImportProgressTracker({ importId, onComplete }: ImportProgressTrackerProps) {
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const pollProgress = async () => {
      try {
        const res = await fetch(`/api/match-import/${importId}`)
        if (!res.ok) throw new Error('Failed to fetch progress')

        const data = await res.json()
        setProgress(data)

        if (data.status === 'COMPLETED') {
          onComplete?.()
        } else if (data.status === 'FAILED') {
          setError(data.errorMessage || 'Import failed')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch progress')
      }
    }

    // Initial fetch
    pollProgress()

    // Poll every 2 seconds while in progress
    const interval = setInterval(() => {
      if (progress?.status === 'COMPLETED' || progress?.status === 'FAILED') {
        clearInterval(interval)
      } else {
        pollProgress()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [importId, onComplete, progress?.status])

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-medium">Import Failed</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      </div>
    )
  }

  const statusLabels: Record<string, string> = {
    PENDING: 'Queued',
    PARSING: 'Parsing match file...',
    REPLAYING: 'Extracting positions...',
    VERIFYING: 'Verifying with GNUBG...',
    COMPLETED: 'Complete!',
    FAILED: 'Failed'
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{progress.filename}</span>
        <span className={`text-sm px-2 py-1 rounded ${
          progress.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
          progress.status === 'FAILED' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {statusLabels[progress.status] || progress.status}
        </span>
      </div>

      {progress.status === 'VERIFYING' && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {progress.positionsVerified.toLocaleString()} / {progress.totalPositions.toLocaleString()} positions verified ({progress.progress}%)
          </p>
        </>
      )}

      {progress.status === 'COMPLETED' && (
        <p className="text-sm text-green-600">
          Successfully imported {progress.positionsVerified.toLocaleString()} positions!
        </p>
      )}
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Polls for progress updates
- [ ] Shows status with visual indicator
- [ ] Progress bar during verification
- [ ] Handles completion callback
- [ ] Shows error state

---

### Task 3.3: Update DrillConfigurationPanel to remove hardcoded limits
**Description:** Remove MAX_SEEDS constant and update UI for dynamic counts
**Size:** Small
**Priority:** High
**Dependencies:** Phase 2 complete

**Changes to components/guru/DrillConfigurationPanel.tsx:**

```typescript
// REMOVE this entire constant:
// const MAX_SEEDS: Record<GamePhase, number> = {
//   OPENING: 21,
//   EARLY: 10,
//   MIDDLE: 10,
//   BEAROFF: 10,
// };

// UPDATE the phase card rendering to remove the artificial limit display:
// BEFORE:
// <span className={count >= maxSeeds ? 'text-green-600 font-medium' : ''}>
//   {count}/{maxSeeds} positions
//   {count >= maxSeeds && ' ✓'}
// </span>

// AFTER:
<span className={count > 0 ? 'text-green-600' : 'text-gray-500'}>
  {count.toLocaleString()} positions
</span>

// REMOVE the Fetch button section for non-opening phases
// (positions now come from imported archives)

// REMOVE the fetchCount state and handleFetchPositions function
// since we no longer fetch from seeded positions
```

**Acceptance Criteria:**
- [ ] MAX_SEEDS constant removed
- [ ] Position counts display actual database counts
- [ ] No artificial limits shown
- [ ] Fetch button removed (replaced by import modal)
- [ ] UI displays large numbers with formatting

---

### Task 3.4: Add Import button to project page
**Description:** Add button to trigger match import from project dashboard
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 3.1, Task 3.2

**Changes needed:**
1. Add "Import Matches" button near Position Library section
2. Wire up MatchImportModal
3. Show active imports with ImportProgressTracker

**Acceptance Criteria:**
- [ ] Import button visible on project page
- [ ] Opens MatchImportModal on click
- [ ] Shows progress for active imports
- [ ] Refreshes position counts after import

---

### Task 3.5: Deprecate and remove positionSeeds.ts
**Description:** Remove hand-crafted position seeds and update consumers
**Size:** Medium
**Priority:** Medium
**Dependencies:** Phase 2 complete, Task 3.3

**Files to modify:**
1. `lib/positionLibrary/positionSeeds.ts` - DELETE
2. `lib/positionLibrary/index.ts` - Remove exports
3. `lib/positionLibrary/nonOpeningPositions.ts` - Remove seed imports
4. `app/api/position-library/fetch/route.ts` - Update or remove

**Steps:**
1. Remove all exports from positionSeeds.ts from barrel file
2. Update nonOpeningPositions.ts to remove `getSeededPositionsSubset` usage
3. Update or remove the fetch API endpoint that relied on seeds
4. Delete positionSeeds.ts
5. Run tests to verify nothing breaks

**Acceptance Criteria:**
- [ ] positionSeeds.ts deleted
- [ ] No import errors in codebase
- [ ] Tests still pass
- [ ] Position library works with imported data

---

## Phase 4: Polish (4 tasks)

Final enhancements, testing, and documentation.

### Task 4.1: Add narrative metadata display
**Description:** Show match/tournament context in drill views
**Size:** Medium
**Priority:** Low
**Dependencies:** Phase 2, Phase 3 complete

**Enhancement to drill display:**
```typescript
// When displaying a position in a drill, show narrative context:
// "This position occurred in Game 3 of a 7-point match between
//  John Smith (USA) and Jane Doe (GBR), with Smith leading 2-1."
```

**Acceptance Criteria:**
- [ ] Match metadata displayed with drills
- [ ] Player names and countries shown
- [ ] Game number and score context
- [ ] Optional toggle to hide narrative

---

### Task 4.2: Add integration tests
**Description:** Integration tests for import pipeline
**Size:** Medium
**Priority:** High
**Dependencies:** Phase 2 complete

**Test file: tests/integration-match-import.spec.ts**

**Test scenarios:**
1. Upload valid match file
2. Reject invalid file types
3. Parse and extract positions
4. Verify positions with GNUBG
5. Check import completion

**Acceptance Criteria:**
- [ ] All integration tests pass
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests are not flaky

---

### Task 4.3: Add E2E test
**Description:** End-to-end test for complete import flow
**Size:** Medium
**Priority:** Medium
**Dependencies:** Phase 3 complete

**Test file: tests/match-import-e2e.spec.ts**

**Test scenario:**
1. Login as test user
2. Navigate to project
3. Click Import Matches
4. Upload test match file
5. Wait for import to complete
6. Verify positions were created

**Acceptance Criteria:**
- [ ] E2E test passes
- [ ] Uses test fixtures
- [ ] Cleans up after itself
- [ ] Reasonable timeout handling

---

### Task 4.4: Update documentation
**Description:** Update CLAUDE.md and create user guide
**Size:** Small
**Priority:** Low
**Dependencies:** All phases complete

**Documentation updates:**
1. Add Match Archive Import section to CLAUDE.md
2. Document new API endpoints
3. Document JellyFish format support
4. Add troubleshooting guide

**Acceptance Criteria:**
- [ ] CLAUDE.md updated
- [ ] API endpoints documented
- [ ] Import workflow documented
- [ ] Troubleshooting section added

---

## Dependency Graph

```
Phase 1 (Foundation):
  1.1 Types ─────────────────┬─> 1.3 Parser ─┬─> 1.4 Replay ─┬─> 1.5 Classifier ─> 1.6 Tests
  1.2 Database Schema ──────┘               │               │
                                             │               │
Phase 2 (Pipeline):                          │               │
  2.1 File Storage ─────────┬─> 2.2 API ────┴─> 2.3 Import ─┴─> 2.4 Verification
                            │       │                                    │
                            │       └──────────> 2.5 Status API <────────┘
                            │
Phase 3 (UI):               │
  3.1 Import Modal ─────────┴─> 3.2 Progress Tracker
  3.3 Remove Limits ────────────> 3.4 Add Import Button
  3.5 Deprecate Seeds ──────────────────────────────────────────────────────────
                                                                                │
Phase 4 (Polish):                                                               │
  4.1 Narrative Display <───────────────────────────────────────────────────────┘
  4.2 Integration Tests
  4.3 E2E Test
  4.4 Documentation
```

## Parallel Execution Opportunities

**Can run in parallel:**
- Task 1.1 + Task 1.2 (Types and Schema)
- Task 2.1 + Task 3.1 (File Storage and Import Modal - after their deps)
- Task 4.1 + Task 4.2 + Task 4.3 + Task 4.4 (All Phase 4 tasks)

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Foundation | 6 | High |
| Phase 2: Pipeline | 5 | High |
| Phase 3: UI/Deprecation | 5 | High/Medium |
| Phase 4: Polish | 4 | Medium/Low |
| **Total** | **20** | |
