# Self-Play Position Generator - Technical Specification

**Slug:** self-play-position-generator
**Author:** Claude Code
**Date:** 2025-12-23
**Status:** Ready for Implementation
**Depends on:** Existing Position Library infrastructure

---

## 1. Overview

This specification describes a system that uses the GNUBG engine to simulate backgammon games and store the resulting positions in the Position Library. The system enables on-demand generation of diverse positions across all game phases (EARLY, MIDDLE, BEAROFF) for use in drill series and curriculum artifacts.

### 1.1 Goals

1. Generate authentic game positions via GNUBG self-play simulation
2. Store positions with full analysis data (best moves, equity, probabilities)
3. Automatically classify positions by game phase
4. Deduplicate against existing library entries
5. Provide admin UI for triggering generation and viewing results

### 1.2 User Stories

- **As an admin**, I can trigger self-play generation to add more positions to the library
- **As an admin**, I can specify how many games to simulate
- **As an admin**, I can view generation progress and results
- **As an admin**, I can see the distribution of generated positions by phase

---

## 2. Architecture

### 2.1 System Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        ADMIN UI                                   │
│  ┌─────────────────┐                                              │
│  │ Position Library │ → [Generate More Positions] → Config Modal  │
│  │ Dashboard        │                                              │
│  └─────────────────┘                                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     API LAYER                                     │
│  POST /api/position-library/self-play                            │
│  GET  /api/position-library/self-play/[batchId]                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   INNGEST BACKGROUND JOB                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ self-play-generation                                        │  │
│  │                                                             │  │
│  │  1. Create SelfPlayBatch record                            │  │
│  │  2. For each game:                                         │  │
│  │     a. Initialize board (INITIAL_BOARD)                    │  │
│  │     b. Loop until game over:                               │  │
│  │        - Roll dice                                         │  │
│  │        - Call GNUBG `plays` tool for best move             │  │
│  │        - Store position (if not duplicate)                 │  │
│  │        - Apply move to advance board                       │  │
│  │     c. Update batch progress                               │  │
│  │  3. Mark batch complete                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                     │
│  ┌─────────────────┐    ┌────────────────────┐                   │
│  │ SelfPlayBatch   │───▶│ PositionLibrary    │                   │
│  │ (tracking)      │    │ (sourceType:       │                   │
│  │                 │    │  SELF_PLAY)        │                   │
│  └─────────────────┘    └────────────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Self-Play Generator | `lib/positionLibrary/selfPlayGenerator.ts` | Core game simulation logic |
| Inngest Job | `lib/inngest-functions.ts` | Background job orchestration |
| API Routes | `app/api/position-library/self-play/` | REST endpoints |
| Batch Model | `prisma/schema.prisma` | Tracking table for batches |
| Admin UI | `app/admin/position-library/` | Dashboard for triggering/viewing |

---

## 3. Prerequisites

### 3.1 Admin Auth Helper

The API routes require admin authentication. Add these helpers to `lib/auth.ts`:

```typescript
/**
 * Check if current user is an admin (non-throwing)
 * Returns authorization status and user object for flexible API handling
 */
export async function checkAdminAuth(): Promise<{ authorized: boolean; user: User | null }> {
  const user = await getCurrentUser()
  if (!user) {
    return { authorized: false, user: null }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  if (!adminEmail) {
    console.warn('[Auth] ADMIN_EMAIL not configured')
    return { authorized: false, user }
  }

  const isAdmin = user.email.toLowerCase() === adminEmail
  return { authorized: isAdmin, user }
}

/**
 * Require admin user - throws if not authenticated or not admin
 * Consistent with requireUser() and requireProjectOwnership() patterns
 */
export async function requireAdmin(): Promise<User> {
  const { authorized, user } = await checkAdminAuth()
  if (!user) {
    throw new Error('Unauthorized')
  }
  if (!authorized) {
    throw new Error('Forbidden')
  }
  return user
}
```

**Why:** The existing auth module only has `requireUser()` and `requireProjectOwnership()`. Admin-only features need explicit admin email checking. We provide both patterns: `checkAdminAuth()` for API routes that need fine-grained HTTP status control, and `requireAdmin()` for consistent throwing behavior.

---

## 4. Database Schema

### 4.1 New Model: SelfPlayBatch

```prisma
model SelfPlayBatch {
  id            String   @id @default(cuid())
  engineId      String
  engine        GroundTruthEngine @relation(fields: [engineId], references: [id])

  // Configuration
  gamesRequested    Int        // How many games to simulate
  skipOpening       Boolean    @default(true)  // Don't store opening positions

  // Progress tracking
  status            SelfPlayStatus @default(PENDING)
  gamesCompleted    Int        @default(0)
  positionsStored   Int        @default(0)
  duplicatesSkipped Int        @default(0)

  // Results by phase
  openingCount      Int        @default(0)
  earlyCount        Int        @default(0)
  middleCount       Int        @default(0)
  bearoffCount      Int        @default(0)

  // Errors
  errors            String[]   @default([])

  // Timestamps
  startedAt         DateTime?
  completedAt       DateTime?
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  // Relations
  positions         PositionLibrary[]

  @@index([engineId])
  @@index([status])
}

enum SelfPlayStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

### 4.2 PositionLibrary Extensions

Add fields to existing `PositionLibrary` model:

```prisma
model PositionLibrary {
  // ... existing fields ...

  // Self-play tracking (new)
  selfPlayBatchId   String?
  selfPlayBatch     SelfPlayBatch? @relation(fields: [selfPlayBatchId], references: [id])
  selfPlayGameNum   Int?          // Game number within batch
  selfPlayMoveNum   Int?          // Move number within game

  @@index([selfPlayBatchId])
}
```

---

## 5. Core Implementation

### 5.1 Design Decisions

**Position Uniqueness:** A position is identified by board state + dice roll + player to move. The same board state with different dice is considered a different position (intentional - different dice lead to different decision-making scenarios).

**Move Format from GNUBG:** The MCP `plays` tool returns moves with point numbers from the moving player's perspective. For X, points are 1-24 (X's home = 1-6). For O, points are also 1-24 but from O's perspective (O's home = 1-6, which is X's 19-24). The `applyGnubgMove` function handles this conversion.

**No Legal Moves:** When a player has no legal moves (e.g., completely blocked), the position is NOT stored and the turn is skipped. These positions are rare and not educationally valuable for basic drills.

### 5.2 Self-Play Generator

```typescript
// lib/positionLibrary/selfPlayGenerator.ts

import { INITIAL_BOARD, cloneBoard, calculatePipCount, allInHomeBoard } from '../matchImport/replayEngine'
import { getPlaysForPosition, formatMove } from '../groundTruth/mcpClient'
import { classifyPhase } from '../matchImport/phaseClassifier'
import type { GroundTruthConfig } from '../groundTruth/types'
import type { BoardState, ReplayedPosition } from '../matchImport/types'

// =============================================================================
// TYPES
// =============================================================================

export interface SelfPlayConfig {
  gamesCount: number          // How many games to simulate
  skipOpening: boolean        // Skip opening positions (we have catalog)
  engineConfig: GroundTruthConfig
  batchId: string             // For tracking
  onProgress?: (progress: SelfPlayProgress) => Promise<void>
}

export interface SelfPlayProgress {
  gamesCompleted: number
  gamesTotal: number
  positionsStored: number
  duplicatesSkipped: number
  currentGameMoveNumber: number
}

export interface SelfPlayResult {
  success: boolean
  gamesPlayed: number
  positions: GeneratedPosition[]
  duplicatesSkipped: number
  errors: string[]
}

export interface GeneratedPosition {
  positionId: string
  gamePhase: 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF'
  diceRoll: string
  board: BoardState
  player: 'x' | 'o'
  bestMove: string
  bestMoveEquity: number
  secondBestMove?: string
  secondEquity?: number
  thirdBestMove?: string
  thirdEquity?: number
  probabilityBreakdown?: object
  asciiBoard: string
  gameNumber: number
  moveNumber: number
}

// =============================================================================
// DICE ROLLING
// =============================================================================

/**
 * Roll two fair dice (1-6)
 */
function rollDice(): [number, number] {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return [die1, die2]
}

/**
 * Format dice roll as string (e.g., "6-4")
 */
function formatDiceRoll(dice: [number, number]): string {
  const [d1, d2] = dice
  // Always put larger die first for consistency
  return d1 >= d2 ? `${d1}-${d2}` : `${d2}-${d1}`
}

// =============================================================================
// GAME LOGIC
// =============================================================================

/**
 * Check if the game is over (one player has borne off all checkers)
 */
function isGameOver(board: BoardState): { over: boolean; winner?: 'x' | 'o' } {
  // Count checkers remaining for each player
  let xCheckers = 0
  let oCheckers = 0

  // X's bar
  xCheckers += board[0]

  // O's bar
  oCheckers += Math.abs(board[25])

  // Points 1-24
  for (let point = 1; point <= 24; point++) {
    if (board[point] > 0) xCheckers += board[point]
    if (board[point] < 0) oCheckers += Math.abs(board[point])
  }

  if (xCheckers === 0) return { over: true, winner: 'x' }
  if (oCheckers === 0) return { over: true, winner: 'o' }

  return { over: false }
}

/**
 * Apply a move returned by GNUBG to the board
 * Move format from GNUBG: [{ from: "24", to: "20" }, { from: "13", to: "9" }]
 */
function applyGnubgMove(
  board: BoardState,
  play: Array<{ from: string; to: string }>,
  player: 'x' | 'o'
): BoardState {
  const newBoard = cloneBoard(board)

  for (const move of play) {
    const from = move.from === 'bar' ? (player === 'x' ? 0 : 25) : parseInt(move.from)
    const to = move.to === 'off' ? -1 : parseInt(move.to)

    if (player === 'x') {
      // Remove from source
      if (from === 0) {
        newBoard[0]-- // X's bar
      } else {
        newBoard[from]--
      }

      // Add to destination (unless bearing off)
      if (to !== -1) {
        // Check for hit
        if (newBoard[to] === -1) {
          newBoard[to] = 1 // Replace O's blot with X
          newBoard[25]--   // O goes to bar
        } else {
          newBoard[to]++
        }
      }
    } else {
      // O player - points are from O's perspective in GNUBG
      const fromAbs = from === 25 ? 25 : (from === 0 ? 25 : 25 - from)
      const toAbs = to === -1 ? -1 : 25 - to

      // Remove from source
      if (fromAbs === 25) {
        newBoard[25]++ // O's bar (negative, so ++)
      } else {
        newBoard[fromAbs]++
      }

      // Add to destination
      if (toAbs !== -1) {
        // Check for hit
        if (newBoard[toAbs] === 1) {
          newBoard[toAbs] = -1 // Replace X's blot with O
          newBoard[0]++        // X goes to bar
        } else {
          newBoard[toAbs]--
        }
      }
    }
  }

  return newBoard
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Simulate a single game and collect all positions
 */
export async function simulateSingleGame(
  engineConfig: GroundTruthConfig,
  gameNumber: number,
  skipOpening: boolean = true
): Promise<{ positions: GeneratedPosition[]; errors: string[] }> {
  const positions: GeneratedPosition[] = []
  const errors: string[] = []

  let board = cloneBoard(INITIAL_BOARD)
  let moveNumber = 0
  let player: 'x' | 'o' = 'x' // X always moves first

  const MAX_MOVES = 200 // Safety limit

  while (moveNumber < MAX_MOVES) {
    const gameStatus = isGameOver(board)
    if (gameStatus.over) break

    const dice = rollDice()
    moveNumber++

    try {
      // Build board config for GNUBG
      const boardConfig = {
        board: boardStateToMCPFormat(board),
        cubeful: false, // Money play, no cube
        dice: dice,
        player: player,
        'max-moves': 3,
        'score-moves': true
      }

      // Get best moves from GNUBG
      const moves = await getPlaysForPosition(boardConfig, engineConfig)

      if (moves.length === 0) {
        // No legal moves (e.g., all blocked) - skip turn
        player = player === 'x' ? 'o' : 'x'
        continue
      }

      const bestMove = moves[0]
      const secondBest = moves[1]
      const thirdBest = moves[2]

      // Classify phase
      const replayedPos: ReplayedPosition = {
        board: cloneBoard(board),
        dice: dice,
        player: player,
        moveNumber: moveNumber,
        gameNumber: gameNumber,
        pipCountX: calculatePipCount(board, 'x'),
        pipCountO: calculatePipCount(board, 'o'),
      }
      const phase = classifyPhase(replayedPos)

      // Decide whether to store this position
      const shouldStore = !skipOpening || phase.phase !== 'OPENING'

      if (shouldStore) {
        const positionId = generatePositionIdFromBoard(board, dice, player)

        positions.push({
          positionId,
          gamePhase: phase.phase,
          diceRoll: formatDiceRoll(dice),
          board: cloneBoard(board),
          player,
          bestMove: formatMove(bestMove.play),
          bestMoveEquity: bestMove.evaluation.eq,
          secondBestMove: secondBest ? formatMove(secondBest.play) : undefined,
          secondEquity: secondBest?.evaluation.eq,
          thirdBestMove: thirdBest ? formatMove(thirdBest.play) : undefined,
          thirdEquity: thirdBest?.evaluation.eq,
          probabilityBreakdown: {
            best: bestMove.evaluation.probability,
            second: secondBest?.evaluation.probability,
            third: thirdBest?.evaluation.probability,
          },
          asciiBoard: generateAsciiBoard(board),
          gameNumber,
          moveNumber,
        })
      }

      // Apply the best move to advance the game
      board = applyGnubgMove(board, bestMove.play, player)

      // Switch player
      player = player === 'x' ? 'o' : 'x'

    } catch (error) {
      errors.push(`Game ${gameNumber}, Move ${moveNumber}: ${error instanceof Error ? error.message : String(error)}`)
      // Continue with next move
      player = player === 'x' ? 'o' : 'x'
    }
  }

  return { positions, errors }
}

/**
 * Run full self-play generation batch
 */
export async function runSelfPlayBatch(
  config: SelfPlayConfig
): Promise<SelfPlayResult> {
  const allPositions: GeneratedPosition[] = []
  const allErrors: string[] = []
  let duplicatesSkipped = 0

  // Track seen position IDs within this batch
  const seenPositionIds = new Set<string>()

  for (let gameNum = 1; gameNum <= config.gamesCount; gameNum++) {
    const gameResult = await simulateSingleGame(
      config.engineConfig,
      gameNum,
      config.skipOpening
    )

    // Deduplicate within batch
    for (const pos of gameResult.positions) {
      if (seenPositionIds.has(pos.positionId)) {
        duplicatesSkipped++
      } else {
        seenPositionIds.add(pos.positionId)
        allPositions.push(pos)
      }
    }

    allErrors.push(...gameResult.errors)

    // Report progress
    if (config.onProgress) {
      await config.onProgress({
        gamesCompleted: gameNum,
        gamesTotal: config.gamesCount,
        positionsStored: allPositions.length,
        duplicatesSkipped,
        currentGameMoveNumber: 0,
      })
    }
  }

  return {
    success: allErrors.length === 0,
    gamesPlayed: config.gamesCount,
    positions: allPositions,
    duplicatesSkipped,
    errors: allErrors,
  }
}

// =============================================================================
// HELPERS (imported from replayEngine but included for clarity)
// =============================================================================

import { generateAsciiBoard, generatePositionIdFromBoard, boardStateToMCPFormat } from '../matchImport/replayEngine'
```

### 5.3 Inngest Job

```typescript
// Add to lib/inngest-functions.ts

/**
 * Self-play position generation job
 */
export const selfPlayGenerationJob = inngest.createFunction(
  {
    id: 'self-play-generation',
    name: 'Self-Play Position Generation',
    concurrency: { limit: 1 }, // Only one self-play at a time
    retries: 2,
  },
  { event: 'position-library/self-play.started' },
  async ({ event, step }) => {
    const { batchId, engineId, gamesCount, skipOpening } = event.data

    // Step 1: Update batch status to RUNNING
    await step.run('update-status-running', async () => {
      await prisma.selfPlayBatch.update({
        where: { id: batchId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })
    })

    // Step 2: Get engine config
    const engineConfig = await step.run('get-engine-config', async () => {
      const engine = await prisma.groundTruthEngine.findUnique({
        where: { id: engineId },
      })
      if (!engine || !engine.enabled) {
        throw new Error('Engine not found or not enabled')
      }
      return {
        engineId: engine.id,
        engineUrl: engine.url,
        domain: engine.domain,
        enabled: true,
      } as GroundTruthConfig
    })

    // Step 3: Simulate games and collect positions
    const result = await step.run('simulate-games', async () => {
      const { runSelfPlayBatch } = await import('./positionLibrary/selfPlayGenerator')

      return runSelfPlayBatch({
        gamesCount,
        skipOpening,
        engineConfig,
        batchId,
        onProgress: async (progress) => {
          // Update batch with progress periodically
          if (progress.gamesCompleted % 5 === 0) {
            await prisma.selfPlayBatch.update({
              where: { id: batchId },
              data: {
                gamesCompleted: progress.gamesCompleted,
                positionsStored: progress.positionsStored,
                duplicatesSkipped: progress.duplicatesSkipped,
              },
            })
          }
        },
      })
    })

    // Step 4: Check for existing positions and filter duplicates
    const uniquePositions = await step.run('filter-existing', async () => {
      const existingIds = await prisma.positionLibrary.findMany({
        where: {
          positionId: { in: result.positions.map(p => p.positionId) },
          engineId,
        },
        select: { positionId: true },
      })

      const existingSet = new Set(existingIds.map(p => p.positionId))
      const dbDuplicates = result.positions.filter(p => existingSet.has(p.positionId)).length

      return {
        positions: result.positions.filter(p => !existingSet.has(p.positionId)),
        dbDuplicatesSkipped: dbDuplicates,
      }
    })

    // Step 5: Store positions in database
    const stored = await step.run('store-positions', async () => {
      const phaseCounts = { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 }

      for (const pos of uniquePositions.positions) {
        await prisma.positionLibrary.create({
          data: {
            positionId: pos.positionId,
            engineId,
            gamePhase: pos.gamePhase,
            diceRoll: pos.diceRoll,
            bestMove: pos.bestMove,
            bestMoveEquity: pos.bestMoveEquity,
            secondBestMove: pos.secondBestMove,
            secondEquity: pos.secondEquity,
            thirdBestMove: pos.thirdBestMove,
            thirdEquity: pos.thirdEquity,
            probabilityBreakdown: pos.probabilityBreakdown,
            asciiBoard: pos.asciiBoard,
            sourceType: 'SELF_PLAY',
            selfPlayBatchId: batchId,
            selfPlayGameNum: pos.gameNumber,
            selfPlayMoveNum: pos.moveNumber,
          },
        })
        phaseCounts[pos.gamePhase]++
      }

      return { count: uniquePositions.positions.length, phaseCounts }
    })

    // Step 6: Update batch as complete
    await step.run('mark-complete', async () => {
      const totalDuplicates = result.duplicatesSkipped + uniquePositions.dbDuplicatesSkipped

      await prisma.selfPlayBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          gamesCompleted: gamesCount,
          positionsStored: stored.count,
          duplicatesSkipped: totalDuplicates,
          openingCount: stored.phaseCounts.OPENING,
          earlyCount: stored.phaseCounts.EARLY,
          middleCount: stored.phaseCounts.MIDDLE,
          bearoffCount: stored.phaseCounts.BEAROFF,
          errors: result.errors,
          completedAt: new Date(),
        },
      })
    })

    return {
      success: true,
      batchId,
      gamesPlayed: gamesCount,
      positionsStored: stored.count,
      duplicatesSkipped: result.duplicatesSkipped + uniquePositions.dbDuplicatesSkipped,
      byPhase: stored.phaseCounts,
    }
  }
)
```

---

## 6. API Routes

### 6.1 Start Self-Play Generation

**POST** `/api/position-library/self-play`

```typescript
// app/api/position-library/self-play/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest'
import { checkAdminAuth } from '@/lib/auth'

export async function POST(request: Request) {
  // Admin only
  const auth = await checkAdminAuth()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { engineId, gamesCount = 20, skipOpening = true } = body

  // Validate
  if (!engineId) {
    return NextResponse.json({ error: 'engineId required' }, { status: 400 })
  }
  if (gamesCount < 1 || gamesCount > 100) {
    return NextResponse.json({ error: 'gamesCount must be 1-100' }, { status: 400 })
  }

  // Verify engine exists
  const engine = await prisma.groundTruthEngine.findUnique({
    where: { id: engineId },
  })
  if (!engine || !engine.enabled) {
    return NextResponse.json({ error: 'Engine not found or disabled' }, { status: 404 })
  }

  // Create batch record
  const batch = await prisma.selfPlayBatch.create({
    data: {
      engineId,
      gamesRequested: gamesCount,
      skipOpening,
      status: 'PENDING',
    },
  })

  // Trigger Inngest job
  await inngest.send({
    name: 'position-library/self-play.started',
    data: {
      batchId: batch.id,
      engineId,
      gamesCount,
      skipOpening,
    },
  })

  return NextResponse.json({
    batchId: batch.id,
    status: 'PENDING',
    message: `Started self-play generation of ${gamesCount} games`,
  })
}

export async function GET(request: Request) {
  // List recent batches
  const auth = await checkAdminAuth()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batches = await prisma.selfPlayBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      engine: { select: { name: true } },
    },
  })

  return NextResponse.json({ batches })
}
```

### 6.2 Get Batch Status

**GET** `/api/position-library/self-play/[batchId]`

```typescript
// app/api/position-library/self-play/[batchId]/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAdminAuth } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: { batchId: string } }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batch = await prisma.selfPlayBatch.findUnique({
    where: { id: params.batchId },
    include: {
      engine: { select: { name: true } },
      _count: { select: { positions: true } },
    },
  })

  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  return NextResponse.json({
    batch: {
      ...batch,
      positionCount: batch._count.positions,
    },
  })
}
```

---

## 7. Admin UI

### 7.1 Position Library Dashboard Extension

Add a "Generate Positions" section to the existing Position Library page:

```tsx
// components/admin/SelfPlayGenerator.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

interface SelfPlayBatch {
  id: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  gamesRequested: number
  gamesCompleted: number
  positionsStored: number
  duplicatesSkipped: number
  earlyCount: number
  middleCount: number
  bearoffCount: number
  createdAt: string
  completedAt?: string
  errors: string[]
}

export function SelfPlayGenerator({ engineId }: { engineId: string }) {
  const [gamesCount, setGamesCount] = useState(20)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeBatch, setActiveBatch] = useState<SelfPlayBatch | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function startGeneration() {
    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/position-library/self-play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineId, gamesCount, skipOpening: true }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start generation')
      }

      const data = await res.json()
      setActiveBatch({ id: data.batchId, status: 'PENDING', ...data })

      // Start polling for status
      pollStatus(data.batchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsGenerating(false)
    }
  }

  async function pollStatus(batchId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/position-library/self-play/${batchId}`)
        const { batch } = await res.json()

        setActiveBatch(batch)

        if (batch.status === 'COMPLETED' || batch.status === 'FAILED') {
          clearInterval(interval)
          setIsGenerating(false)
        }
      } catch {
        clearInterval(interval)
        setIsGenerating(false)
      }
    }, 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Self-Play Position Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isGenerating && !activeBatch && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="gamesCount">Number of games to simulate</Label>
              <Input
                id="gamesCount"
                type="number"
                min={1}
                max={100}
                value={gamesCount}
                onChange={(e) => setGamesCount(parseInt(e.target.value) || 20)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Each game produces ~30-60 positions. Duplicates are automatically skipped.
              </p>
            </div>
            <Button onClick={startGeneration}>
              Generate Positions
            </Button>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {activeBatch && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Status: {activeBatch.status}</span>
              <span>
                {activeBatch.gamesCompleted}/{activeBatch.gamesRequested} games
              </span>
            </div>

            <Progress
              value={(activeBatch.gamesCompleted / activeBatch.gamesRequested) * 100}
            />

            {activeBatch.status === 'COMPLETED' && (
              <div className="bg-green-50 p-4 rounded space-y-2">
                <p className="font-medium text-green-800">Generation Complete!</p>
                <ul className="text-sm text-green-700">
                  <li>Positions stored: {activeBatch.positionsStored}</li>
                  <li>Duplicates skipped: {activeBatch.duplicatesSkipped}</li>
                  <li>By phase:</li>
                  <ul className="ml-4">
                    <li>Early: +{activeBatch.earlyCount}</li>
                    <li>Middle: +{activeBatch.middleCount}</li>
                    <li>Bearoff: +{activeBatch.bearoffCount}</li>
                  </ul>
                </ul>
                <Button variant="outline" onClick={() => setActiveBatch(null)}>
                  Generate More
                </Button>
              </div>
            )}

            {activeBatch.errors.length > 0 && (
              <div className="bg-yellow-50 p-3 rounded">
                <p className="text-sm font-medium text-yellow-800">
                  {activeBatch.errors.length} warnings during generation
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 8. Performance Considerations

### 8.1 API Call Volume

Each game requires approximately 30-60 API calls to GNUBG (one per move). For 20 games:
- Minimum: 20 × 30 = 600 calls
- Maximum: 20 × 60 = 1,200 calls

**Mitigation:**
- Concurrency limit of 1 ensures sequential processing
- Rate limiting built into MCP client
- Inngest handles long-running jobs gracefully

### 8.2 Database Operations

Positions are inserted one at a time for simplicity and error isolation.

**Future optimization:** Batch inserts using `createMany` for faster storage.

### 8.3 Memory Usage

Positions are processed and stored incrementally. No full game history kept in memory.

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// tests/unit-self-play.spec.ts

describe('Self-Play Generator', () => {
  describe('isGameOver', () => {
    it('returns false for starting position', () => {
      expect(isGameOver(INITIAL_BOARD).over).toBe(false)
    })

    it('returns true when X has borne off all', () => {
      const board = createEmptyBoard()
      // X has no checkers anywhere
      expect(isGameOver(board)).toEqual({ over: true, winner: 'x' })
    })
  })

  describe('applyGnubgMove', () => {
    it('handles simple move from point to point', () => {
      // ...
    })

    it('handles bar entry', () => {
      // ...
    })

    it('handles hitting a blot', () => {
      // ...
    })

    it('handles bearing off', () => {
      // ...
    })
  })

  describe('rollDice', () => {
    it('returns values 1-6', () => {
      for (let i = 0; i < 100; i++) {
        const [d1, d2] = rollDice()
        expect(d1).toBeGreaterThanOrEqual(1)
        expect(d1).toBeLessThanOrEqual(6)
        expect(d2).toBeGreaterThanOrEqual(1)
        expect(d2).toBeLessThanOrEqual(6)
      }
    })
  })
})
```

### 9.2 Integration Tests

```typescript
// tests/integration-self-play.spec.ts

describe('Self-Play Integration', () => {
  it('generates positions from a single game', async () => {
    // Requires live GNUBG engine
    const result = await simulateSingleGame(testEngineConfig, 1, true)

    expect(result.positions.length).toBeGreaterThan(0)
    expect(result.positions.length).toBeLessThan(100)

    // Verify position structure
    const pos = result.positions[0]
    expect(pos.positionId).toBeDefined()
    expect(pos.gamePhase).toMatch(/EARLY|MIDDLE|BEAROFF/)
    expect(pos.bestMove).toBeDefined()
    expect(pos.bestMoveEquity).toBeDefined()
  })
})
```

---

## 10. Migration Plan

### 10.1 Database Migration

```bash
# Generate migration
npm run migrate:safe -- add-self-play-batch

# Migration SQL (auto-generated, review before applying)
-- CreateEnum
CREATE TYPE "SelfPlayStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SelfPlayBatch" (
    "id" TEXT NOT NULL,
    "engineId" TEXT NOT NULL,
    "gamesRequested" INTEGER NOT NULL,
    "skipOpening" BOOLEAN NOT NULL DEFAULT true,
    "status" "SelfPlayStatus" NOT NULL DEFAULT 'PENDING',
    "gamesCompleted" INTEGER NOT NULL DEFAULT 0,
    "positionsStored" INTEGER NOT NULL DEFAULT 0,
    "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "openingCount" INTEGER NOT NULL DEFAULT 0,
    "earlyCount" INTEGER NOT NULL DEFAULT 0,
    "middleCount" INTEGER NOT NULL DEFAULT 0,
    "bearoffCount" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfPlayBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PositionLibrary" ADD COLUMN "selfPlayBatchId" TEXT,
ADD COLUMN "selfPlayGameNum" INTEGER,
ADD COLUMN "selfPlayMoveNum" INTEGER;

-- CreateIndex
CREATE INDEX "SelfPlayBatch_engineId_idx" ON "SelfPlayBatch"("engineId");
CREATE INDEX "SelfPlayBatch_status_idx" ON "SelfPlayBatch"("status");
CREATE INDEX "PositionLibrary_selfPlayBatchId_idx" ON "PositionLibrary"("selfPlayBatchId");

-- AddForeignKey
ALTER TABLE "SelfPlayBatch" ADD CONSTRAINT "SelfPlayBatch_engineId_fkey"
  FOREIGN KEY ("engineId") REFERENCES "GroundTruthEngine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PositionLibrary" ADD CONSTRAINT "PositionLibrary_selfPlayBatchId_fkey"
  FOREIGN KEY ("selfPlayBatchId") REFERENCES "SelfPlayBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## 11. Implementation Checklist

### Phase 0: Prerequisites
- [ ] Add `checkAdminAuth()` and `requireAdmin()` helpers to `lib/auth.ts`

### Phase 1: Database Schema
- [ ] Add `SelfPlayBatch` model to `prisma/schema.prisma`
- [ ] Add `SelfPlayStatus` enum to `prisma/schema.prisma`
- [ ] Add self-play fields to `PositionLibrary` model
- [ ] Run `npm run migrate:safe -- add-self-play-batch`
- [ ] Verify schema with `npx prisma studio`

### Phase 2: Self-Play Generator Core
- [ ] Create `lib/positionLibrary/selfPlayGenerator.ts`
- [ ] Implement `rollDice()` and `formatDiceRoll()`
- [ ] Implement `isGameOver()`
- [ ] Implement `applyGnubgMove()`
- [ ] Implement `simulateSingleGame()`
- [ ] Implement `runSelfPlayBatch()`
- [ ] Export from `lib/positionLibrary/index.ts`

### Phase 3: Unit Tests
- [ ] Create `tests/unit-self-play.spec.ts`
- [ ] Test `rollDice()` returns values 1-6
- [ ] Test `isGameOver()` for starting position
- [ ] Test `isGameOver()` for won position
- [ ] Test `applyGnubgMove()` for simple moves
- [ ] Test `applyGnubgMove()` for bar entry
- [ ] Test `applyGnubgMove()` for hitting blots
- [ ] Test `applyGnubgMove()` for bearing off

### Phase 4: Inngest Background Job
- [ ] Add `selfPlayGenerationJob` to `lib/inngest-functions.ts`
- [ ] Register job in Inngest serve function
- [ ] Test job execution via Inngest dev UI (http://localhost:8288)

### Phase 5: API Routes
- [ ] Create `app/api/position-library/self-play/route.ts` (POST + GET)
- [ ] Create `app/api/position-library/self-play/[batchId]/route.ts` (GET)
- [ ] Test endpoints with curl/Postman

### Phase 6: Admin UI
- [ ] Create `components/admin/SelfPlayGenerator.tsx`
- [ ] Add polling for batch status updates
- [ ] Integrate into Position Library dashboard page
- [ ] Test full flow: trigger → progress → completion

### Phase 7: Integration Testing & Documentation
- [ ] Test single game simulation with live GNUBG engine
- [ ] Test full 20-game batch
- [ ] Verify positions stored correctly in database
- [ ] Update `developer-guides/10-position-library-guide.md`
- [ ] Add self-play section to `CLAUDE.md`

---

## 12. Success Criteria

1. **Functional:**
   - Admin can trigger self-play generation via UI
   - Positions are correctly stored with `sourceType: 'SELF_PLAY'`
   - Duplicates are properly detected and skipped
   - Phase classification matches expected distribution

2. **Performance:**
   - 20-game batch completes within 10 minutes
   - No memory leaks during long batches

3. **Quality:**
   - Generated positions are valid (verified by GNUBG)
   - All positions have complete analysis data

---

## 13. Future Enhancements

1. **Doubling cube support:** Add cube decisions for more realistic match play
2. **Target phase quotas:** Stop generating when target per phase reached
3. **Instructive filtering:** Filter by equity swing to prioritize educational positions
4. **Parallel games:** Run multiple games concurrently for faster generation
5. **Position diversity scoring:** Prefer positions that differ from existing library
