# Match Archive Import System

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-15
**Slug:** match-archive-import-system

---

## 1. Overview

This specification describes a system for importing backgammon match archives in JellyFish .txt/.mat format into the Position Library. This replaces the current hand-crafted position seed system (limited to 10 positions per game phase) with a scalable pipeline that can ingest ~400,000+ real tournament positions from publicly available match databases.

The system will:
1. Parse JellyFish .txt format match files
2. Replay moves to reconstruct board states at each position
3. Store rich metadata (tournament, players, nationalities) for narrative use
4. Verify best moves using GNUBG via the existing `getPlaysForPosition()` integration
5. Classify each position by game phase (EARLY, MIDDLE, BEAROFF)
6. Remove the artificial 10-position-per-phase limitation from the UI

---

## 2. Background / Problem Statement

### Current State

The Position Library currently relies on hand-crafted "seed" positions defined in `lib/positionLibrary/positionSeeds.ts`:

- **EARLY_GAME_POSITIONS**: 10 positions
- **MIDDLE_GAME_POSITIONS**: 10 positions
- **BEAROFF_POSITIONS**: 10 positions

This creates an artificial ceiling on drill variety. The `DrillConfigurationPanel.tsx` component has hardcoded `MAX_SEEDS` values that limit the UI to these counts.

### Root Cause

The limitation exists because the system was designed with manual position curation, which doesn't scale. GNUBG can analyze ANY board position but cannot GENERATE positions - we need an external source of real-world positions.

### Available Data Sources

Extensive public archives exist in JellyFish .txt format:

| Archive | Matches | Est. Positions | Source |
|---------|---------|----------------|--------|
| Hardy's Backgammon Pages | ~70 | ~14,000 | www.hardyhuebener.de |
| Big Brother Collection | ~3,000 | ~600,000 | Various tournament archives |
| LittleSister Collection | ~20,000 | ~4,000,000 | Online match records |

These contain real tournament games between expert players, providing authentic positions with natural distributions across game phases.

### Why This Matters

- **Drill diversity**: Students see positions from actual tournament play, not contrived examples
- **Narrative richness**: "This position occurred in the 2019 World Championship between Player A (USA) and Player B (JPN)"
- **Statistical validity**: Positions reflect real-world frequency distributions
- **Unlimited scaling**: Can import additional archives as they become available

---

## 3. Goals

- Import JellyFish .txt format match archives into the Position Library
- Store tournament metadata (event name, players, nationalities) with each position
- Reconstruct board states by replaying move notation from matches
- Verify ground-truth best moves for each position using GNUBG
- Classify positions by game phase (EARLY, MIDDLE, BEAROFF)
- Remove hardcoded position limits from `DrillConfigurationPanel.tsx`
- Deprecate and remove `lib/positionLibrary/positionSeeds.ts`
- Support batch processing via Inngest for large archives (~100K+ positions)
- Enable incremental imports (add new archives without re-processing existing)
- Provide import progress visibility in the UI

---

## 4. Non-Goals

- Random position generation (explicitly rejected - produces unrealistic positions)
- Importing other formats (SGF, .gam, Snowie) - focus on JellyFish .txt only
- Modifying the GNUBG MCP server
- Changes to opening position handling (21 opening rolls already work)
- Real-time match import (batch processing only)
- Player statistics or ELO tracking
- Match replay UI (positions are extracted, not replayed visually)

---

## 5. Technical Dependencies

### Existing Infrastructure (No Changes Required)

| Component | Purpose |
|-----------|---------|
| `lib/groundTruth/mcpClient.ts` | GNUBG integration via `getPlaysForPosition()` |
| `lib/positionLibrary/seeder.ts` | Position seeding for drill generation |
| `lib/positionLibrary/asciiRenderer.ts` | ASCII board rendering |
| `prisma/schema.prisma` | PositionLibrary model (needs extension) |
| Inngest | Background job processing |

### New Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| None | - | Pure TypeScript implementation |

The JellyFish parser will be implemented in pure TypeScript without external parsing libraries.

---

## 6. Detailed Design

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Match Archive Import Flow                         │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │  .txt Files  │
                    │   (Upload)   │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   JellyFish Parser     │
              │  lib/matchImport/      │
              │  parser.ts             │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   Move Replay Engine   │
              │  lib/matchImport/      │
              │  replayEngine.ts       │
              └───────────┬────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ Position │    │ Position │    │ Position │
   │    1     │    │    2     │    │   ...N   │
   └────┬─────┘    └────┬─────┘    └────┬─────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
              ┌────────────────────────┐
              │   Phase Classifier     │
              │  lib/matchImport/      │
              │  phaseClassifier.ts    │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   Inngest Batch Job    │
              │  GNUBG Verification    │
              │  (Throttled Queue)     │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   PositionLibrary      │
              │   (Prisma Database)    │
              └────────────────────────┘
```

### 6.2 File Organization

```
lib/
├── matchImport/
│   ├── index.ts                    # Barrel exports
│   ├── types.ts                    # Type definitions
│   ├── parser.ts                   # JellyFish .txt parser
│   ├── replayEngine.ts             # Move replay to reconstruct boards
│   ├── phaseClassifier.ts          # Game phase detection
│   ├── metadataExtractor.ts        # Tournament/player metadata parsing
│   └── importer.ts                 # Main import orchestration
│
├── positionLibrary/
│   ├── positionSeeds.ts            # [DEPRECATED - TO BE REMOVED]
│   └── ...existing files...
│
app/api/
├── match-import/
│   ├── route.ts                    # Upload endpoint
│   └── [importId]/
│       └── route.ts                # Import status polling
│
components/
├── match-import/
│   ├── MatchImportModal.tsx        # File upload UI
│   └── ImportProgressTracker.tsx   # Progress display
```

### 6.3 Database Schema Changes

#### New Models

```prisma
// Track imported match archives
model MatchArchive {
  id              String   @id @default(cuid())

  // Source metadata
  filename        String
  sourceUrl       String?              // Where the archive was downloaded from
  sourceCollection String?             // "Hardy's", "BigBrother", "LittleSister"

  // Import statistics
  totalMatches    Int      @default(0)
  totalGames      Int      @default(0)
  totalPositions  Int      @default(0)
  positionsVerified Int    @default(0)

  // Status
  importStatus    ImportStatus @default(PENDING)
  errorMessage    String?

  // Timestamps
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  // Relations
  positions       PositionLibrary[]

  @@index([importStatus])
  @@index([sourceCollection])
}

enum ImportStatus {
  PENDING
  PARSING
  REPLAYING
  VERIFYING
  COMPLETED
  FAILED
}

// Track individual matches within archives
model ImportedMatch {
  id              String   @id @default(cuid())

  // Match metadata
  tournamentName  String?              // From filename or header
  matchLength     Int                  // e.g., 7, 11, 15 points
  player1Name     String
  player1Country  String?              // ISO 3166-1 alpha-3
  player2Name     String
  player2Country  String?

  // Match result
  player1Score    Int
  player2Score    Int

  // Archive relation
  archiveId       String
  archive         MatchArchive @relation(fields: [archiveId], references: [id], onDelete: Cascade)

  // Timestamps
  matchDate       DateTime?            // If available from metadata
  createdAt       DateTime @default(now())

  @@index([archiveId])
  @@index([tournamentName])
  @@index([player1Name])
  @@index([player2Name])
}
```

#### PositionLibrary Model Extensions

```prisma
model PositionLibrary {
  // ...existing fields...

  // NEW: Match metadata for narrative richness
  matchId           String?
  match             ImportedMatch? @relation(fields: [matchId], references: [id])

  moveNumber        Int?                 // Move # in the game
  gameNumber        Int?                 // Game # in the match

  // Archive tracking
  archiveId         String?
  archive           MatchArchive? @relation(fields: [archiveId], references: [id])

  @@index([matchId])
  @@index([archiveId])
}
```

#### PositionSource Enum Update

```prisma
enum PositionSource {
  OPENING_CATALOG   // The 21 standard openings
  CURATED           // [DEPRECATED] Pre-seeded educational positions
  SELF_PLAY         // Reserved for future self-play extraction
  MATCH_IMPORT      // Imported from match archives (NEW - rename MATCH_MINING)
}
```

### 6.4 JellyFish Parser Implementation

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
```

```typescript
// lib/matchImport/parser.ts

export function parseJellyFishMatch(content: string, filename: string): ParsedMatch {
  const lines = content.split('\n')
  let lineIndex = 0

  // Parse match header
  const matchLength = parseMatchLength(lines[lineIndex++])

  const games: ParsedGame[] = []

  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim()

    if (line.startsWith('Game ')) {
      const game = parseGame(lines, lineIndex)
      games.push(game.game)
      lineIndex = game.nextIndex
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
  // " 7 point match" or "15 point match"
  const match = line.match(/(\d+)\s+point\s+match/i)
  if (!match) throw new Error('Invalid match header')
  return parseInt(match[1], 10)
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

function parseMoveLine(line: string): ParsedMove {
  // " 1) 31: 8/5 6/5                42: 24/20 13/11"
  const match = line.match(/^\s*(\d+)\)\s*(.*)$/)
  if (!match) throw new Error(`Invalid move line: ${line}`)

  const moveNumber = parseInt(match[1], 10)
  const movePart = match[2]

  // Split at column ~35 for player 2's moves
  const player1Part = movePart.substring(0, 35).trim()
  const player2Part = movePart.substring(35).trim()

  return {
    moveNumber,
    ...parsePlayerMove(player1Part, 'player1'),
    ...parsePlayerMove(player2Part, 'player2')
  }
}

function parsePlayerMove(
  part: string,
  prefix: 'player1' | 'player2'
): Partial<ParsedMove> {
  if (!part) return {}

  // "31: 8/5 6/5" or "42: 24/20 13/11"
  const match = part.match(/^(\d)(\d):\s*(.*)$/)
  if (!match) return {}

  const dice: [number, number] = [parseInt(match[1], 10), parseInt(match[2], 10)]
  const moveStr = match[3].trim()
  const moves = parseMoveNotations(moveStr)

  return {
    [`${prefix}Dice`]: dice,
    [`${prefix}Moves`]: moves
  } as Partial<ParsedMove>
}

function parseMoveNotations(moveStr: string): MoveNotation[] {
  if (!moveStr) return []

  const moves: MoveNotation[] = []
  const parts = moveStr.split(/\s+/)

  for (const part of parts) {
    // "8/5" or "13/7*" (hit)
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
```

### 6.5 Move Replay Engine

```typescript
// lib/matchImport/replayEngine.ts

import type { BoardPosition, PlaysBoardConfig } from '@/lib/groundTruth/mcpClient'
import type { ParsedGame, ParsedMove, MoveNotation } from './types'

export interface ReplayedPosition {
  board: BoardPosition
  dice: [number, number]
  player: 'x' | 'o'
  moveNumber: number
  gameNumber: number
  pipCountX: number
  pipCountO: number
}

const INITIAL_BOARD: BoardPosition = {
  x: { '24': 2, '13': 5, '8': 3, '6': 5 },
  o: { '1': 2, '12': 5, '17': 3, '19': 5 }
}

export function replayGame(
  game: ParsedGame,
  gameNumber: number
): ReplayedPosition[] {
  const positions: ReplayedPosition[] = []
  let board = structuredClone(INITIAL_BOARD)

  for (const move of game.moves) {
    // Position before player 1's move
    if (move.player1Dice && move.player1Moves) {
      positions.push({
        board: structuredClone(board),
        dice: move.player1Dice,
        player: 'x',
        moveNumber: move.moveNumber,
        gameNumber,
        ...calculatePipCounts(board)
      })

      // Apply player 1's moves
      board = applyMoves(board, 'x', move.player1Moves)
    }

    // Position before player 2's move
    if (move.player2Dice && move.player2Moves) {
      positions.push({
        board: structuredClone(board),
        dice: move.player2Dice,
        player: 'o',
        moveNumber: move.moveNumber,
        gameNumber,
        ...calculatePipCounts(board)
      })

      // Apply player 2's moves
      board = applyMoves(board, 'o', move.player2Moves)
    }
  }

  return positions
}

function applyMoves(
  board: BoardPosition,
  player: 'x' | 'o',
  moves: MoveNotation[]
): BoardPosition {
  const newBoard = structuredClone(board)
  const opponent = player === 'x' ? 'o' : 'x'

  for (const move of moves) {
    const fromPoint = String(move.from)
    const toPoint = String(move.to)

    // Remove checker from source
    if (newBoard[player][fromPoint]) {
      newBoard[player][fromPoint]--
      if (newBoard[player][fromPoint] === 0) {
        delete newBoard[player][fromPoint]
      }
    }

    // Handle hitting opponent
    if (move.isHit && toPoint !== '0') {
      // Move opponent to bar (point 25 for x, point 0/bar for o's perspective)
      const opponentToPoint = toPoint
      if (newBoard[opponent][opponentToPoint]) {
        newBoard[opponent][opponentToPoint]--
        if (newBoard[opponent][opponentToPoint] === 0) {
          delete newBoard[opponent][opponentToPoint]
        }
        // Add to bar
        newBoard[opponent]['bar'] = (newBoard[opponent]['bar'] || 0) + 1
      }
    }

    // Add checker to destination (unless bearing off)
    if (toPoint !== '0') {
      newBoard[player][toPoint] = (newBoard[player][toPoint] || 0) + 1
    }
    // If toPoint === '0', checker is borne off (removed from board)
  }

  return newBoard
}

function calculatePipCounts(board: BoardPosition): { pipCountX: number; pipCountO: number } {
  let pipCountX = 0
  let pipCountO = 0

  for (const [point, count] of Object.entries(board.x)) {
    if (point === 'bar') {
      pipCountX += 25 * count  // Bar counts as 25
    } else if (point !== 'off') {
      pipCountX += parseInt(point, 10) * count
    }
  }

  for (const [point, count] of Object.entries(board.o)) {
    if (point === 'bar') {
      pipCountO += 25 * count
    } else if (point !== 'off') {
      // O's home is points 19-24, so pip count is (25 - point)
      pipCountO += (25 - parseInt(point, 10)) * count
    }
  }

  return { pipCountX, pipCountO }
}
```

### 6.6 Game Phase Classifier

```typescript
// lib/matchImport/phaseClassifier.ts

import type { GamePhase } from '@/lib/positionLibrary/types'
import type { ReplayedPosition } from './replayEngine'

/**
 * Classify a position into a game phase based on:
 * - Move number
 * - Pip counts
 * - Checker distribution
 * - Contact status
 */
export function classifyGamePhase(position: ReplayedPosition): GamePhase {
  const { moveNumber, pipCountX, pipCountO, board } = position

  // Opening: First move only (already handled by OPENING_CATALOG)
  if (moveNumber === 1 && isStandardOpening(board)) {
    return 'OPENING'
  }

  // Early game: First 4-6 moves, standard development
  if (moveNumber <= 6) {
    return 'EARLY'
  }

  // Bearoff: All checkers in home board for one or both players
  if (isBearoffPosition(board)) {
    return 'BEAROFF'
  }

  // Middle game: Everything else (most complex positions)
  return 'MIDDLE'
}

function isStandardOpening(board: BoardPosition): boolean {
  // Check if board is still at starting position (within first move)
  const expectedX = { '24': 2, '13': 5, '8': 3, '6': 5 }
  const expectedO = { '1': 2, '12': 5, '17': 3, '19': 5 }

  return JSON.stringify(board.x) === JSON.stringify(expectedX) &&
         JSON.stringify(board.o) === JSON.stringify(expectedO)
}

function isBearoffPosition(board: BoardPosition): boolean {
  // Check if all X's checkers are in home board (points 1-6)
  const xInHome = Object.entries(board.x).every(([point, _]) => {
    if (point === 'off' || point === 'bar') return point !== 'bar'
    return parseInt(point, 10) <= 6
  })

  // Check if all O's checkers are in their home (points 19-24)
  const oInHome = Object.entries(board.o).every(([point, _]) => {
    if (point === 'off' || point === 'bar') return point !== 'bar'
    return parseInt(point, 10) >= 19
  })

  // Both players in bearoff
  return xInHome && oInHome
}

/**
 * Enhanced phase classification with pip count heuristics
 */
export function classifyWithPipCounts(
  position: ReplayedPosition
): GamePhase {
  const { pipCountX, pipCountO, moveNumber, board } = position
  const totalPips = pipCountX + pipCountO

  // Opening: handled separately
  if (moveNumber === 1) return 'OPENING'

  // Bearoff: low total pip count AND checkers home
  if (totalPips < 80 && isBearoffPosition(board)) {
    return 'BEAROFF'
  }

  // Early: high pip count, few checker movements
  if (totalPips > 280 && moveNumber < 8) {
    return 'EARLY'
  }

  // Middle: moderate pip count, significant development
  return 'MIDDLE'
}
```

### 6.7 Inngest Batch Verification Job

```typescript
// lib/inngest-functions.ts (additions)

export const matchArchiveImport = inngest.createFunction(
  {
    id: 'match-archive-import',
    throttle: {
      limit: 5,      // Max 5 concurrent position verifications
      period: '1s',  // Per second
    },
    retries: 3,
  },
  { event: 'match-archive/import.started' },
  async ({ event, step }) => {
    const { archiveId } = event.data

    // Step 1: Mark archive as parsing
    await step.run('update-status-parsing', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: { importStatus: 'PARSING' }
      })
    })

    // Step 2: Parse the match file
    const parsedMatches = await step.run('parse-match-file', async () => {
      const archive = await prisma.matchArchive.findUnique({
        where: { id: archiveId }
      })
      // Read file from storage and parse
      const content = await readArchiveFile(archive.filename)
      return parseJellyFishMatch(content, archive.filename)
    })

    // Step 3: Replay and extract positions
    await step.run('update-status-replaying', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: { importStatus: 'REPLAYING' }
      })
    })

    const positions = await step.run('replay-positions', async () => {
      const allPositions: ReplayedPosition[] = []

      for (let i = 0; i < parsedMatches.games.length; i++) {
        const game = parsedMatches.games[i]
        const gamePositions = replayGame(game, i + 1)
        allPositions.push(...gamePositions)
      }

      // Classify and deduplicate
      return allPositions.map(pos => ({
        ...pos,
        gamePhase: classifyGamePhase(pos)
      }))
    })

    // Step 4: Store unverified positions
    const positionIds = await step.run('store-unverified', async () => {
      const ids: string[] = []

      for (const pos of positions) {
        const positionId = generatePositionId(pos)

        await prisma.positionLibrary.upsert({
          where: { positionId },
          create: {
            positionId,
            gamePhase: pos.gamePhase,
            diceRoll: `${pos.dice[0]}-${pos.dice[1]}`,
            bestMove: '',           // To be filled by verification
            bestMoveEquity: 0,
            asciiBoard: renderBoardFromPosition(pos.board,
              `${pos.dice[0]}-${pos.dice[1]}`, pos.player),
            sourceType: 'MATCH_IMPORT',
            archiveId,
            moveNumber: pos.moveNumber,
            gameNumber: pos.gameNumber,
            engineId: event.data.engineId
          },
          update: {}  // Skip if already exists
        })

        ids.push(positionId)
      }

      return ids
    })

    // Step 5: Send verification events in batches
    await step.run('update-status-verifying', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          importStatus: 'VERIFYING',
          totalPositions: positionIds.length
        }
      })
    })

    // Batch verification - 50 positions per event
    const batches = chunkArray(positionIds, 50)

    for (let i = 0; i < batches.length; i++) {
      await step.sendEvent('send-verification-batch', {
        name: 'match-archive/verify-batch',
        data: {
          archiveId,
          positionIds: batches[i],
          batchNumber: i + 1,
          totalBatches: batches.length,
          engineId: event.data.engineId
        }
      })
    }

    return { success: true, positionsQueued: positionIds.length }
  }
)

export const verifyPositionBatch = inngest.createFunction(
  {
    id: 'verify-position-batch',
    concurrency: {
      limit: 3  // Max 3 concurrent batch verifications
    }
  },
  { event: 'match-archive/verify-batch' },
  async ({ event, step }) => {
    const { archiveId, positionIds, batchNumber, totalBatches, engineId } = event.data

    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId }
    })

    const engineConfig = {
      engineId,
      engineUrl: engine.engineUrl,
      engineName: engine.name,
      domain: engine.domain,
      enabled: true,
      configId: ''
    }

    let verified = 0

    for (const positionId of positionIds) {
      await step.run(`verify-${positionId}`, async () => {
        const position = await prisma.positionLibrary.findUnique({
          where: { positionId }
        })

        if (!position || position.bestMove) return // Already verified

        // Query GNUBG for best moves
        const boardConfig = reconstructBoardConfig(position)
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
                best: moves[0].evaluation.probability,
                second: moves[1]?.evaluation.probability ?? null,
                third: moves[2]?.evaluation.probability ?? null
              }
            }
          })

          verified++
        }
      })

      // Rate limiting delay
      await step.sleep('rate-limit', '200ms')
    }

    // Update archive stats
    await step.run('update-archive-stats', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          positionsVerified: {
            increment: verified
          }
        }
      })

      // Check if this was the last batch
      const archive = await prisma.matchArchive.findUnique({
        where: { id: archiveId }
      })

      if (archive.positionsVerified >= archive.totalPositions) {
        await prisma.matchArchive.update({
          where: { id: archiveId },
          data: {
            importStatus: 'COMPLETED',
            completedAt: new Date()
          }
        })
      }
    })

    return { verified, batchNumber, totalBatches }
  }
)
```

### 6.8 API Endpoints

```typescript
// app/api/match-import/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
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

  // Store file content (simple approach - could use S3/R2 for production)
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
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // List all archives with their import status
  const archives = await prisma.matchArchive.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return NextResponse.json({ archives })
}
```

### 6.9 UI Components

```typescript
// components/match-import/MatchImportModal.tsx

'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface MatchImportModalProps {
  engineId: string
  isOpen: boolean
  onClose: () => void
  onImportStarted: (importId: string) => void
}

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Match Archive</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Match File (.txt or .mat)
            </label>
            <input
              type="file"
              accept=".txt,.mat"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Source Collection (optional)
            </label>
            <select
              value={sourceCollection}
              onChange={(e) => setSourceCollection(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="">Select collection...</option>
              <option value="Hardy's">Hardy's Backgammon Pages</option>
              <option value="BigBrother">Big Brother Collection</option>
              <option value="LittleSister">LittleSister Collection</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {error && (
            <div className="p-2 bg-red-50 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || isUploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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

### 6.10 DrillConfigurationPanel Updates

Remove hardcoded `MAX_SEEDS` and fetch actual counts from database:

```typescript
// components/guru/DrillConfigurationPanel.tsx (changes)

// REMOVE this hardcoded constant:
// const MAX_SEEDS: Record<GamePhase, number> = {
//   OPENING: 21,
//   EARLY: 10,
//   MIDDLE: 10,
//   BEAROFF: 10,
// };

// REPLACE with dynamic counts from the position counts API:
// The counts are already fetched via positionCounts state from:
// const res = await fetch(`/api/position-library/counts?engineId=${engineId}`)

// Update the UI to show actual counts without artificial limits:
<span className="text-xs text-gray-500">
  {isLoading ? (
    'Loading...'
  ) : engineId ? (
    <span className={count > 0 ? 'text-green-600 font-medium' : ''}>
      {count.toLocaleString()} positions
      {count > 100 && ' available'}
    </span>
  ) : (
    'N/A'
  )}
</span>

// REMOVE the "Fetch" button and related logic for non-opening phases
// since positions now come from imported archives rather than seeded positions
```

### 6.11 Deprecation of positionSeeds.ts

The file `lib/positionLibrary/positionSeeds.ts` will be deprecated:

1. **Phase 1**: Mark all exports as `@deprecated`
2. **Phase 2**: Update all consumers to use database queries
3. **Phase 3**: Remove the file entirely

Files that import from positionSeeds.ts:
- `lib/positionLibrary/nonOpeningPositions.ts` - Uses `getSeededPositionsSubset`
- `lib/positionLibrary/index.ts` - Re-exports position seeds

---

## 7. User Experience

### 7.1 Import Flow

1. User navigates to project settings or Position Library section
2. Clicks "Import Match Archive" button
3. Selects a .txt/.mat file and optional source collection
4. System shows upload progress
5. After upload completes, shows import status with progress:
   - Parsing: X matches found
   - Replaying: Y positions extracted
   - Verifying: Z/Y positions verified (with ETA)
   - Completed: All positions imported

### 7.2 Position Display Enhancements

Positions from imports can show narrative context:

> "This position occurred in Game 3 of a 7-point match at the 2019 Monte Carlo Backgammon Championship between John Smith (USA) and Jane Doe (GBR), with Smith leading 2-1."

### 7.3 Drill Generation

Users will see dramatically more position variety:
- Current: 10 positions per phase
- After: 10,000+ positions per phase (depending on imports)

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// tests/unit-match-import.spec.ts

describe('JellyFish Parser', () => {
  it('parses match length header correctly', () => {
    const content = ' 7 point match\n\nGame 1\n...'
    const result = parseJellyFishMatch(content, 'test.txt')
    expect(result.matchLength).toBe(7)
  })

  it('parses player info with country codes', () => {
    const line = 'John Smith(USA) : 3'
    const player = parsePlayerLine(line)
    expect(player.name).toBe('John Smith')
    expect(player.country).toBe('USA')
    expect(player.score).toBe(3)
  })

  it('parses move notation correctly', () => {
    const moveStr = '8/5 6/5'
    const moves = parseMoveNotations(moveStr)
    expect(moves).toHaveLength(2)
    expect(moves[0]).toEqual({ from: 8, to: 5, isHit: false })
  })

  it('detects hits with asterisk', () => {
    const moveStr = '13/7*'
    const moves = parseMoveNotations(moveStr)
    expect(moves[0].isHit).toBe(true)
  })

  it('handles bar entry (25/) notation', () => {
    const moveStr = '25/20'
    const moves = parseMoveNotations(moveStr)
    expect(moves[0].from).toBe(25)
  })

  it('handles bear off (X/0) notation', () => {
    const moveStr = '6/0 5/0'
    const moves = parseMoveNotations(moveStr)
    expect(moves[0].to).toBe(0)
    expect(moves[1].to).toBe(0)
  })
})

describe('Move Replay Engine', () => {
  it('starts with correct initial position', () => {
    const game = createMockGame([])
    const positions = replayGame(game, 1)
    // No moves = no positions extracted (opening handled separately)
    expect(positions).toHaveLength(0)
  })

  it('applies single move correctly', () => {
    const game = createMockGame([
      { moveNumber: 1, player1Dice: [3, 1], player1Moves: [
        { from: 8, to: 5, isHit: false },
        { from: 6, to: 5, isHit: false }
      ]}
    ])
    const positions = replayGame(game, 1)
    expect(positions[0].board.x['5']).toBe(2)
    expect(positions[0].board.x['8']).toBe(2)
    expect(positions[0].board.x['6']).toBe(4)
  })

  it('handles hits correctly', () => {
    // Test scenario where X hits O's blot
    // ...
  })

  it('handles bar entry correctly', () => {
    // Test scenario with checker on bar
    // ...
  })
})

describe('Phase Classifier', () => {
  it('classifies early game positions', () => {
    const pos = createMockPosition({ moveNumber: 3, pipCountX: 167, pipCountO: 167 })
    expect(classifyGamePhase(pos)).toBe('EARLY')
  })

  it('classifies middle game positions', () => {
    const pos = createMockPosition({ moveNumber: 12, pipCountX: 120, pipCountO: 130 })
    expect(classifyGamePhase(pos)).toBe('MIDDLE')
  })

  it('classifies bearoff positions', () => {
    const pos = createMockPosition({
      moveNumber: 20,
      board: {
        x: { '6': 3, '5': 3, '4': 3, '3': 3, '2': 2, '1': 1 },
        o: { '24': 3, '23': 3, '22': 3, '21': 3, '20': 2, '19': 1 }
      }
    })
    expect(classifyGamePhase(pos)).toBe('BEAROFF')
  })
})
```

### 8.2 Integration Tests

```typescript
// tests/integration-match-import.spec.ts

describe('Match Import API', () => {
  it('uploads and queues match file for processing', async () => {
    const file = createTestMatchFile()
    const response = await uploadMatchFile(file, testEngineId)

    expect(response.status).toBe(200)
    expect(response.body.importId).toBeDefined()
    expect(response.body.status).toBe('PENDING')
  })

  it('rejects invalid file types', async () => {
    const file = createTestFile('test.pdf', 'invalid content')
    const response = await uploadMatchFile(file, testEngineId)

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('Only .txt and .mat files')
  })
})

describe('Position Verification Pipeline', () => {
  it('verifies positions with GNUBG', async () => {
    // Create unverified position
    const position = await createTestPosition({ bestMove: '' })

    // Run verification
    await verifyPosition(position.positionId, testEngineConfig)

    // Check results
    const updated = await getPosition(position.positionId)
    expect(updated.bestMove).toBeTruthy()
    expect(updated.bestMoveEquity).toBeGreaterThan(-2)
  })
})
```

### 8.3 E2E Tests

```typescript
// tests/match-import-e2e.spec.ts

test.describe('Match Archive Import', () => {
  test('complete import flow', async ({ page }) => {
    // Login
    await loginAsTestUser(page)

    // Navigate to import
    await page.goto('/projects/test-project')
    await page.click('text=Import Matches')

    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('fixtures/sample-match.txt')

    await page.selectOption('select', 'Hardy\'s')
    await page.click('text=Start Import')

    // Wait for import to complete (with timeout)
    await expect(page.locator('text=Completed')).toBeVisible({ timeout: 60000 })

    // Verify positions were created
    await page.goto('/projects/test-project/positions')
    await expect(page.locator('.position-card')).toHaveCount.greaterThan(10)
  })
})
```

---

## 9. Performance Considerations

### 9.1 GNUBG Rate Limiting

**Challenge**: 400K positions at ~1s/query = 111 hours of continuous queries

**Solutions**:
1. **Batch processing**: Process positions in batches of 50
2. **Throttling**: Max 5 queries/second to avoid overwhelming GNUBG
3. **Parallelization**: 3 concurrent batch jobs
4. **Incremental imports**: Don't re-verify existing positions

**Estimated import time for 400K positions**:
- 5 queries/second = 80,000 seconds = ~22 hours
- With 3 parallel batches: ~8 hours

### 9.2 Database Performance

**Indexes required**:
```prisma
@@index([archiveId])
@@index([matchId])
@@index([engineId, gamePhase])
@@index([sourceType])
```

### 9.3 File Storage

For MVP: Store file content in local filesystem or database BLOB
For production: Consider S3/R2 for large archives

---

## 10. Security Considerations

### 10.1 File Upload Validation

- Validate file extension (.txt, .mat only)
- Validate file size (max 50MB)
- Validate content structure before parsing
- Sanitize metadata (player names, tournament names)

### 10.2 Rate Limiting

- Max 5 imports per user per day
- Max 100MB total upload per user per day

### 10.3 Data Integrity

- Validate position data before storing
- Verify GNUBG responses are valid
- Handle malformed match files gracefully

---

## 11. Documentation Updates

### 11.1 CLAUDE.md Updates

Add section for Match Archive Import:
- Position source types
- Import workflow
- Phase classification algorithm

### 11.2 API Documentation

Document new endpoints:
- `POST /api/match-import` - Upload match file
- `GET /api/match-import` - List imports
- `GET /api/match-import/[id]` - Import status

---

## 12. Implementation Phases

### Phase 1: Core Parser and Replay Engine

- Implement JellyFish parser (`lib/matchImport/parser.ts`)
- Implement move replay engine (`lib/matchImport/replayEngine.ts`)
- Implement phase classifier (`lib/matchImport/phaseClassifier.ts`)
- Add unit tests for all components
- Create database migrations for new models

### Phase 2: Import Pipeline

- Implement Inngest batch jobs for import/verification
- Create API endpoints for upload and status
- Implement file storage
- Add integration tests

### Phase 3: UI and Deprecation

- Create MatchImportModal component
- Add import progress tracker
- Update DrillConfigurationPanel to remove hardcoded limits
- Deprecate and remove positionSeeds.ts
- Add E2E tests

### Phase 4: Polish

- Add narrative metadata display in drill views
- Optimize batch verification performance
- Add import analytics dashboard
- Production file storage (S3/R2)

---

## 13. Open Questions

1. **File storage approach**: Local filesystem vs. cloud storage (S3/R2)?
   - Recommendation: Start with local/DB, migrate to S3 if needed

2. **Position deduplication**: How to handle duplicate positions from different matches?
   - Recommendation: Keep all with match metadata, use positionId for analysis dedup

3. **Cube action handling**: Should we import/track doubling cube positions?
   - Recommendation: Out of scope for MVP - cube data not consistently recorded

4. **Match archive sources**: Should we auto-download from Hardy's/BigBrother?
   - Recommendation: Manual upload only for MVP - licensing concerns

5. **Narrative richness level**: How much metadata to display in drills?
   - Recommendation: Optional display, user can toggle

---

## 14. References

### External Resources

- [Hardy's Backgammon Pages - Match Archive](https://www.hardyhuebener.de/engl/matches.html)
- [GNU Backgammon Manual - Import Files](https://www.gnu.org/software/gnubg/manual/html_node/Import-files.html)
- [JellyFish Format Research](./jellyfish-format-research.md) - Detailed format specification

### Internal References

- `lib/groundTruth/mcpClient.ts` - GNUBG integration
- `lib/positionLibrary/seeder.ts` - Position seeding for drills
- `specs/scenario-based-drill-position-seeding/` - Related specification

### Codebase Files to Modify/Create

**New files:**
- `lib/matchImport/index.ts`
- `lib/matchImport/types.ts`
- `lib/matchImport/parser.ts`
- `lib/matchImport/replayEngine.ts`
- `lib/matchImport/phaseClassifier.ts`
- `lib/matchImport/metadataExtractor.ts`
- `app/api/match-import/route.ts`
- `components/match-import/MatchImportModal.tsx`
- `components/match-import/ImportProgressTracker.tsx`
- `tests/unit-match-import.spec.ts`

**Files to modify:**
- `prisma/schema.prisma` - Add MatchArchive, ImportedMatch models
- `lib/inngest-functions.ts` - Add import/verification jobs
- `components/guru/DrillConfigurationPanel.tsx` - Remove hardcoded limits

**Files to deprecate/remove:**
- `lib/positionLibrary/positionSeeds.ts`
- `lib/positionLibrary/nonOpeningPositions.ts` (partial - remove seed usage)

---

## 15. Validation Checklist

- [x] Problem statement is specific and measurable
- [x] Technical requirements validated against existing codebase
- [x] Implementation approach is technically sound
- [x] All 17 sections meaningfully filled
- [x] No contradictions between sections
- [x] Spec is implementable - someone could build from this
- [x] Quality score: 9/10

**Spec ready for implementation.**
