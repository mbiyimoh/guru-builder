# Position Seeding for Scenario-Based Drills - Task Breakdown

**Slug:** scenario-based-drill-position-seeding
**Author:** Claude Code
**Date:** 2025-12-13
**Last Decompose:** 2025-12-13
**Estimated Effort:** 2-3 days (MVP)

---

## Overview

Transform drill generation from abstract concept questions to scenario-based drills by:
1. Populating a Position Library with all 21 opening roll positions from GNUBG
2. Seeding positions into the drill generation prompt
3. Adding an info modal to explain artifact creation to users

**MVP Scope:** Opening positions only. Phase 2 work (early/mid/bearoff) is in `04-phase2-extended-game-phases.md`.

---

## Phase 1: Database & Infrastructure

### Task 1.1: Database Schema Migration
**Description**: Add PositionLibrary model and supporting types to Prisma schema
**Size**: Medium
**Priority**: High (blocking)
**Dependencies**: None
**Can run parallel with**: None (blocking)

**File:** `prisma/schema.prisma`

**Technical Requirements**:
Add these Prisma definitions:

```prisma
enum GamePhase {
  OPENING    // First roll (move 1) - MVP
  EARLY      // Phase 2
  MIDDLE     // Phase 2
  BEAROFF    // Phase 2
}

enum PositionSource {
  OPENING_CATALOG  // The 21 standard openings
  SELF_PLAY        // Phase 2
  MATCH_MINING     // Phase 2
}

model PositionLibrary {
  id              String   @id @default(cuid())

  // Position identification
  positionId      String   @unique  // GNUBG 14-char Position ID or "opening-{dice}"

  // Game context
  gamePhase       GamePhase         // OPENING for MVP
  diceRoll        String            // e.g., "3-1", "6-6"

  // Engine analysis
  bestMove        String            // GNUBG notation e.g., "8/5 6/5"
  bestMoveEquity  Float             // Equity of best move
  secondBestMove  String?           // Alternative for distractors
  secondEquity    Float?
  thirdBestMove   String?
  thirdEquity     Float?

  // ASCII representation
  asciiBoard      String            // Pre-rendered ASCII board

  // Source tracking
  sourceType      PositionSource    // OPENING_CATALOG for MVP

  // Metadata
  createdAt       DateTime @default(now())

  // Engine reference
  engineId        String
  engine          GroundTruthEngine @relation(fields: [engineId], references: [id])

  @@index([gamePhase])
  @@index([engineId, gamePhase])
}
```

Also add to GuruArtifact:
```prisma
model GuruArtifact {
  // ... existing fields ...
  positionsUsed     String[]  // Array of positionId references
}
```

**Implementation Steps**:
1. Add `GamePhase` and `PositionSource` enums
2. Add `PositionLibrary` model with all fields
3. Add relation from PositionLibrary to GroundTruthEngine
4. Add `positionsUsed` field to `GuruArtifact`
5. Run `npm run db:backup` before migration
6. Run `npm run migrate:safe -- add-position-library`

**Acceptance Criteria**:
- [ ] `npx prisma migrate dev` succeeds without errors
- [ ] PositionLibrary table created in database
- [ ] GuruArtifact has positionsUsed column
- [ ] `npx prisma generate` runs successfully
- [ ] TypeScript types available for PositionLibrary

---

### Task 1.2: Position Library Types & Module Setup
**Description**: Create TypeScript types and module structure for Position Library
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Files:**
- `lib/positionLibrary/index.ts` (barrel export)
- `lib/positionLibrary/types.ts` (TypeScript types)

**Technical Requirements**:

Create `lib/positionLibrary/types.ts`:
```typescript
// lib/positionLibrary/types.ts

import { GamePhase, PositionSource } from '@prisma/client'

export type { GamePhase, PositionSource }

/**
 * Position data as stored in the database
 */
export interface PositionData {
  positionId: string
  gamePhase: GamePhase
  diceRoll: string
  bestMove: string
  bestMoveEquity: number
  secondBestMove?: string | null
  secondEquity?: number | null
  thirdBestMove?: string | null
  thirdEquity?: number | null
  asciiBoard: string
  sourceType: PositionSource
  engineId: string
}

/**
 * Position formatted for seeding into drill generation prompt
 */
export interface SeededPosition {
  positionId: string
  diceRoll: string
  bestMove: string
  bestMoveEquity: number
  alternatives: Array<{ move: string; equity: number }>
  asciiBoard: string
}

/**
 * Positions grouped by game phase for prompt seeding
 */
export interface SeededPositionsByPhase {
  OPENING: SeededPosition[]
  EARLY: SeededPosition[]    // Phase 2
  MIDDLE: SeededPosition[]   // Phase 2
  BEAROFF: SeededPosition[]  // Phase 2
}

/**
 * Result from position population
 */
export interface PopulationResult {
  populated: number
  errors: string[]
}
```

Create `lib/positionLibrary/index.ts`:
```typescript
// lib/positionLibrary/index.ts

// Types
export type {
  PositionData,
  SeededPosition,
  SeededPositionsByPhase,
  PopulationResult,
  GamePhase,
  PositionSource
} from './types'

// Functions (added by subsequent tasks)
export { OPENING_ROLLS, populateOpeningPositions } from './openings'
export { renderOpeningBoard, renderAsciiBoard } from './asciiRenderer'
export { seedOpeningPositions } from './seeder'
```

**Implementation Steps**:
1. Create `lib/positionLibrary/` directory
2. Create `types.ts` with all interfaces
3. Create `index.ts` barrel export (functions added later)
4. Ensure TypeScript compilation succeeds

**Acceptance Criteria**:
- [ ] Directory `lib/positionLibrary/` exists
- [ ] Types compile without errors
- [ ] Can import types: `import { SeededPosition } from '@/lib/positionLibrary'`

---

## Phase 2: Position Sourcing

### Task 2.1: Opening Positions Population
**Description**: Implement function to fetch all 21 opening roll positions from GNUBG
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: Task 2.2

**File:** `lib/positionLibrary/openings.ts`

**Technical Requirements**:

```typescript
// lib/positionLibrary/openings.ts

import { prisma } from '@/lib/prisma'
import { executeGroundTruthTool } from '@/lib/groundTruth/executor'
import { GroundTruthConfig } from '@/lib/groundTruth/config'
import { PopulationResult } from './types'
import { renderOpeningBoard } from './asciiRenderer'

/**
 * The 21 unique opening rolls in backgammon.
 * Non-doubles: 15 combinations (6-5 through 2-1)
 * Doubles: 6 combinations (6-6 through 1-1)
 */
export const OPENING_ROLLS = [
  // Non-doubles (15 combinations)
  '6-5', '6-4', '6-3', '6-2', '6-1',
  '5-4', '5-3', '5-2', '5-1',
  '4-3', '4-2', '4-1',
  '3-2', '3-1',
  '2-1',
  // Doubles (6 combinations)
  '6-6', '5-5', '4-4', '3-3', '2-2', '1-1'
] as const

export type OpeningRoll = typeof OPENING_ROLLS[number]

/**
 * Standard opening position identifier.
 * In GNUBG, the opening position is the default starting position.
 */
export const OPENING_POSITION_ID = 'opening'

/**
 * Populate the Position Library with all 21 opening roll positions.
 * Queries the GNUBG engine for best moves for each roll.
 *
 * @param engineConfig - Ground truth engine configuration
 * @returns Result with count of populated positions and any errors
 */
export async function populateOpeningPositions(
  engineConfig: GroundTruthConfig
): Promise<PopulationResult> {
  const errors: string[] = []
  let populated = 0

  console.log(`[PositionLibrary] Starting population of ${OPENING_ROLLS.length} opening positions`)

  for (const dice of OPENING_ROLLS) {
    try {
      console.log(`[PositionLibrary] Querying engine for opening roll: ${dice}`)

      // Query engine for best moves for this opening roll
      const result = await executeGroundTruthTool('get_best_moves', {
        position: OPENING_POSITION_ID,
        dice,
        count: 3  // Get top 3 moves for correct answer + distractors
      }, engineConfig)

      if (!result.success || !result.moves?.length) {
        const errorMsg = `Failed to get moves for ${dice}: ${result.error || 'No moves returned'}`
        console.error(`[PositionLibrary] ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }

      // Generate position ID for this opening roll
      const positionId = `opening-${dice}`

      // Upsert position to database
      await prisma.positionLibrary.upsert({
        where: { positionId },
        create: {
          positionId,
          gamePhase: 'OPENING',
          diceRoll: dice,
          bestMove: result.moves[0].move,
          bestMoveEquity: result.moves[0].equity,
          secondBestMove: result.moves[1]?.move ?? null,
          secondEquity: result.moves[1]?.equity ?? null,
          thirdBestMove: result.moves[2]?.move ?? null,
          thirdEquity: result.moves[2]?.equity ?? null,
          asciiBoard: renderOpeningBoard(dice),
          sourceType: 'OPENING_CATALOG',
          engineId: engineConfig.engineId
        },
        update: {
          bestMove: result.moves[0].move,
          bestMoveEquity: result.moves[0].equity,
          secondBestMove: result.moves[1]?.move ?? null,
          secondEquity: result.moves[1]?.equity ?? null,
          thirdBestMove: result.moves[2]?.move ?? null,
          thirdEquity: result.moves[2]?.equity ?? null,
          asciiBoard: renderOpeningBoard(dice)
        }
      })

      populated++
      console.log(`[PositionLibrary] Populated opening-${dice}: ${result.moves[0].move}`)

    } catch (error) {
      const errorMsg = `Error processing ${dice}: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(`[PositionLibrary] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  console.log(`[PositionLibrary] Population complete: ${populated}/${OPENING_ROLLS.length} positions`)

  return { populated, errors }
}
```

**Implementation Steps**:
1. Create `lib/positionLibrary/openings.ts`
2. Define `OPENING_ROLLS` constant with all 21 dice combinations
3. Implement `populateOpeningPositions()` function
4. Handle engine errors gracefully (continue to next roll)
5. Use upsert to avoid duplicates on re-run

**Acceptance Criteria**:
- [ ] OPENING_ROLLS contains exactly 21 unique rolls
- [ ] populateOpeningPositions() queries engine for each roll
- [ ] Top 3 moves stored for each position
- [ ] Upsert prevents duplicates on re-run
- [ ] Errors for individual rolls don't stop the entire process
- [ ] Returns accurate count of populated positions

---

### Task 2.2: ASCII Board Renderer
**Description**: Implement function to render the opening position as ASCII art
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 2.1

**File:** `lib/positionLibrary/asciiRenderer.ts`

**Technical Requirements**:

```typescript
// lib/positionLibrary/asciiRenderer.ts

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
┌─13─14─15─16─17─18─┬BAR┬─19─20─21─22─23─24─┐
│  O           O    │   │  O              X │
│  O           O    │   │  O              X │
│  O           O    │   │  O                │
│  O                │   │  O                │
│  O                │   │  O                │
│                   │   │                   │
│  X                │   │  X                │
│  X                │   │  X                │
│  X           X    │   │  X                │
│  X           X    │   │  X              O │
│  X           X    │   │  X              O │
└─12─11─10──9──8──7─┴───┴──6──5──4──3──2──1─┘

         Dice: ${diceRoll}    White (X) to move
`.trim()
}

/**
 * Render any arbitrary backgammon position as ASCII art.
 *
 * For MVP, only opening positions are supported.
 * Phase 2 will add support for parsing GNUBG Position IDs.
 *
 * @param positionId - GNUBG Position ID or "opening"/"opening-{dice}"
 * @param diceRoll - The dice roll for this position
 * @returns ASCII representation of the position
 * @throws Error if position is not an opening position (Phase 2)
 */
export function renderAsciiBoard(positionId: string, diceRoll: string): string {
  // For MVP, only opening positions are supported
  if (positionId === 'opening' || positionId.startsWith('opening-')) {
    return renderOpeningBoard(diceRoll)
  }

  // Phase 2: Parse GNUBG Position ID and render arbitrary position
  // See 04-phase2-extended-game-phases.md for implementation
  throw new Error(`Non-opening positions not yet supported: ${positionId}`)
}
```

**Implementation Steps**:
1. Create `lib/positionLibrary/asciiRenderer.ts`
2. Implement `renderOpeningBoard()` with hardcoded opening position
3. Implement `renderAsciiBoard()` wrapper that delegates to renderOpeningBoard for MVP
4. Add clear error message for non-opening positions (Phase 2)

**Acceptance Criteria**:
- [ ] renderOpeningBoard() returns valid ASCII art
- [ ] ASCII shows correct starting position (points 1-24)
- [ ] Dice roll is displayed in the output
- [ ] Player to move is indicated
- [ ] renderAsciiBoard() handles opening positions correctly
- [ ] Non-opening positions throw clear error

---

### Task 2.3: Position Population API
**Description**: Create API endpoint to trigger position population
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: None

**Files:**
- `app/api/position-library/populate/route.ts` (trigger population)
- `app/api/position-library/route.ts` (list positions)

**Technical Requirements**:

Create `app/api/position-library/populate/route.ts`:
```typescript
// app/api/position-library/populate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveGroundTruthConfig } from '@/lib/groundTruth/config'
import { populateOpeningPositions } from '@/lib/positionLibrary'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { engineId } = await request.json()

    if (!engineId) {
      return NextResponse.json({ error: 'engineId required' }, { status: 400 })
    }

    // Verify engine exists
    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId }
    })

    if (!engine) {
      return NextResponse.json({ error: 'Engine not found' }, { status: 404 })
    }

    // Get engine config
    const config = await resolveGroundTruthConfig(engine.projectId)
    if (!config) {
      return NextResponse.json({ error: 'Engine not configured' }, { status: 400 })
    }

    // Populate opening positions
    const result = await populateOpeningPositions(config)

    return NextResponse.json({
      success: true,
      populated: result.populated,
      errors: result.errors
    })

  } catch (error) {
    console.error('[API] Position population error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

Create `app/api/position-library/route.ts`:
```typescript
// app/api/position-library/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GamePhase } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const engineId = searchParams.get('engineId')
    const gamePhase = searchParams.get('gamePhase') as GamePhase | null

    const where: { engineId?: string; gamePhase?: GamePhase } = {}
    if (engineId) where.engineId = engineId
    if (gamePhase) where.gamePhase = gamePhase

    const positions = await prisma.positionLibrary.findMany({
      where,
      orderBy: { diceRoll: 'asc' }
    })

    return NextResponse.json({ positions })

  } catch (error) {
    console.error('[API] Position list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

**Implementation Steps**:
1. Create `app/api/position-library/` directory
2. Create `populate/route.ts` with POST handler
3. Create `route.ts` with GET handler for listing
4. Add authentication checks to both endpoints
5. Add error handling

**Acceptance Criteria**:
- [ ] POST /api/position-library/populate triggers population
- [ ] GET /api/position-library returns positions
- [ ] Can filter by engineId and gamePhase
- [ ] Returns proper error responses
- [ ] Authentication required for both endpoints

---

## Phase 3: Position Seeding Integration

### Task 3.1: Position Seeder Function
**Description**: Implement function to fetch opening positions for drill generation
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 3.5

**File:** `lib/positionLibrary/seeder.ts`

**Technical Requirements**:

```typescript
// lib/positionLibrary/seeder.ts

import { prisma } from '@/lib/prisma'
import { SeededPosition, SeededPositionsByPhase } from './types'

/**
 * Fetch all opening positions from the Position Library.
 * These positions will be seeded into the drill generation prompt.
 *
 * @param engineId - The ground truth engine ID
 * @returns Array of seeded positions ready for prompt injection
 */
export async function seedOpeningPositions(
  engineId: string
): Promise<SeededPosition[]> {
  // Fetch all opening positions for this engine
  const positions = await prisma.positionLibrary.findMany({
    where: {
      engineId,
      gamePhase: 'OPENING'
    },
    orderBy: { diceRoll: 'asc' }
  })

  return positions.map(p => ({
    positionId: p.positionId,
    diceRoll: p.diceRoll,
    bestMove: p.bestMove,
    bestMoveEquity: p.bestMoveEquity,
    alternatives: [
      p.secondBestMove && p.secondEquity !== null
        ? { move: p.secondBestMove, equity: p.secondEquity }
        : null,
      p.thirdBestMove && p.thirdEquity !== null
        ? { move: p.thirdBestMove, equity: p.thirdEquity }
        : null
    ].filter((a): a is { move: string; equity: number } => a !== null),
    asciiBoard: p.asciiBoard
  }))
}

/**
 * Seed positions by phase for drill generation.
 * MVP only populates OPENING phase.
 *
 * @param engineId - The ground truth engine ID
 * @returns Positions grouped by game phase
 */
export async function seedPositionsByPhase(
  engineId: string
): Promise<SeededPositionsByPhase | null> {
  const openingPositions = await seedOpeningPositions(engineId)

  // If no positions available, return null to trigger fallback
  if (openingPositions.length === 0) {
    console.warn('[Seeder] No opening positions found for engine:', engineId)
    return null
  }

  console.log(`[Seeder] Seeded ${openingPositions.length} opening positions`)

  return {
    OPENING: openingPositions,
    EARLY: [],    // Phase 2
    MIDDLE: [],   // Phase 2
    BEAROFF: []   // Phase 2
  }
}
```

**Implementation Steps**:
1. Create `lib/positionLibrary/seeder.ts`
2. Implement `seedOpeningPositions()` to fetch from database
3. Implement `seedPositionsByPhase()` wrapper
4. Map database rows to SeededPosition format
5. Handle empty library gracefully (return null)

**Acceptance Criteria**:
- [ ] seedOpeningPositions() returns all opening positions
- [ ] Alternatives array properly filters null values
- [ ] Returns null when no positions available
- [ ] Logging for debugging

---

### Task 3.2: Drill Designer Prompt Update
**Description**: Add seeded positions section to drill designer prompt
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: None

**File:** `lib/guruFunctions/prompts/drillDesignerPrompt.ts`

**Technical Requirements**:

Add to the existing prompt builder:

```typescript
// Add to drillDesignerPrompt.ts

import { SeededPositionsByPhase, SeededPosition } from '@/lib/positionLibrary'

// Add to DrillDesignerPromptParams interface:
interface DrillDesignerPromptParams {
  // ... existing fields ...
  seededPositions?: SeededPositionsByPhase | null
}

/**
 * Format a single position for prompt injection
 */
function formatPositionForPrompt(position: SeededPosition, index: number): string {
  const alternatives = position.alternatives.length > 0
    ? position.alternatives.map(a => `${a.move} (${a.equity.toFixed(3)})`).join(', ')
    : 'None close'

  return `
### Opening ${index + 1}: Dice ${position.diceRoll}

\`\`\`
${position.asciiBoard}
\`\`\`

- **Best move:** ${position.bestMove} (Equity: ${position.bestMoveEquity.toFixed(3)})
- **Alternatives:** ${alternatives}
`
}

/**
 * Build the seeded positions section for the prompt
 */
function buildPositionsSection(seededPositions: SeededPositionsByPhase): string {
  if (!seededPositions.OPENING.length) {
    return ''
  }

  const formattedPositions = seededPositions.OPENING
    .map((p, i) => formatPositionForPrompt(p, i))
    .join('\n')

  return `
---

## REQUIRED POSITIONS - OPENING ROLLS

**CRITICAL: You MUST create drills using these pre-verified opening positions.**

These are the 21 possible first rolls in backgammon, with engine-verified best moves.
Create a drill for each opening roll. Each drill should test the learner's understanding
of the correct opening move.

${formattedPositions}

**Instructions for using these positions:**
1. Each drill scenario.setup MUST describe this opening position
2. The asciiWireframe MUST use the provided ASCII board
3. The correct answer MUST match the bestMove
4. Use the alternative moves as plausible wrong options (distractors)
5. Reference the dice roll in the question (e.g., "You rolled 3-1")
6. In the feedback, explain WHY the best move is correct

---
`
}

// Modify buildDrillDesignerPrompt to include positions:
export function buildDrillDesignerPrompt(params: DrillDesignerPromptParams): string {
  const {
    domain,
    corpusSummary,
    mentalModel,
    curriculum,
    userNotes,
    seededPositions  // NEW
  } = params

  // Build positions section if provided
  const positionsSection = seededPositions
    ? buildPositionsSection(seededPositions)
    : ''

  return `
# TASK: Design Practice Drills for ${domain}

${positionsSection}

... rest of existing prompt ...
`
}
```

**Implementation Steps**:
1. Add `seededPositions` to DrillDesignerPromptParams
2. Implement `formatPositionForPrompt()` helper
3. Implement `buildPositionsSection()` to format all positions
4. Insert positions section at the top of the drill prompt
5. Clear instructions for AI on how to use positions

**Acceptance Criteria**:
- [ ] Positions section included when seededPositions provided
- [ ] Each position shows ASCII board, best move, alternatives
- [ ] Clear instructions for using positions
- [ ] No positions section when seededPositions is null

---

### Task 3.3: Inngest Job Update - Position Seeding Step
**Description**: Add position seeding step to drill generation Inngest job
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1, Task 3.2
**Can run parallel with**: None

**File:** `lib/inngest-functions.ts`

**Technical Requirements**:

Add to the drill series generation job (around line 900+):

```typescript
// In drillSeriesGenerationJob

// Add new progress stage (find existing ProgressStage type):
// SEEDING_POSITIONS = 'SEEDING_POSITIONS'

// Add new step BEFORE drill generation:
const seededPositions = await step.run('seed-positions', async () => {
  // Check if ground truth is enabled
  const gtConfig = await resolveGroundTruthConfig(projectId)

  if (!gtConfig?.enabled) {
    console.log('[DrillSeries] Ground truth not enabled, skipping position seeding')
    return null
  }

  // Update progress
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: { progressStage: 'SEEDING_POSITIONS' }
  })

  // Fetch all opening positions from the Position Library
  const { seedPositionsByPhase } = await import('@/lib/positionLibrary')
  const positions = await seedPositionsByPhase(gtConfig.engineId)

  if (!positions) {
    console.warn('[DrillSeries] No positions found, falling back to non-seeded generation')
    return null
  }

  console.log(`[DrillSeries] Seeded ${positions.OPENING.length} opening positions`)

  return positions
})

// Then pass seededPositions to the drill generation step:
const drillResult = await step.run('generate-drill-series', async () => {
  // ... existing code ...

  return generateDrillSeries({
    projectId,
    mentalModel,
    curriculum,
    systemPrompt,
    userPromptTemplate,
    customNotes,
    seededPositions,  // NEW - pass seeded positions
    // ... other options
  })
})

// After generation, update artifact with positions used:
await step.run('save-positions-used', async () => {
  if (seededPositions?.OPENING?.length) {
    const positionIds = seededPositions.OPENING.map(p => p.positionId)
    await prisma.guruArtifact.update({
      where: { id: artifactId },
      data: { positionsUsed: positionIds }
    })
  }
})
```

**Implementation Steps**:
1. Add 'SEEDING_POSITIONS' to progress stages
2. Add 'seed-positions' step before drill generation
3. Check if ground truth is enabled
4. Fetch positions using seedPositionsByPhase()
5. Pass positions to drill generation step
6. Save positionsUsed to artifact after generation

**Acceptance Criteria**:
- [ ] seed-positions step runs when ground truth enabled
- [ ] Skips gracefully when ground truth disabled
- [ ] Falls back to non-seeded generation when no positions
- [ ] Positions passed to drill generator
- [ ] positionsUsed saved to artifact

---

### Task 3.4: Drill Generator Update
**Description**: Update drill generator to accept seeded positions
**Size**: Small
**Priority**: High
**Dependencies**: Task 3.2, Task 3.3
**Can run parallel with**: None

**File:** `lib/guruFunctions/generators/drillDesigner.ts`

**Technical Requirements**:

```typescript
// Add to DrillDesignerOptions interface:
interface DrillDesignerOptions {
  // ... existing fields ...
  seededPositions?: SeededPositionsByPhase | null
}

// Update generateDrillSeries function:
export async function generateDrillSeries(
  options: DrillDesignerOptions
): Promise<GenerationResult<DrillSeriesOutput>> {
  const {
    projectId,
    mentalModel,
    curriculum,
    systemPrompt,
    userPromptTemplate,
    customNotes,
    seededPositions,  // NEW
    // ... other options
  } = options

  // Pass seeded positions to prompt builder
  const userPrompt = buildDrillDesignerPrompt({
    domain: mentalModel.domain,
    corpusSummary: curriculum.corpusSummary,
    mentalModel,
    curriculum,
    userNotes: customNotes,
    seededPositions  // NEW - pass to prompt builder
  })

  // Rest of generation logic unchanged...
  // The prompt now includes the seeded positions as requirements
}
```

**Implementation Steps**:
1. Add `seededPositions` to DrillDesignerOptions
2. Pass seededPositions to buildDrillDesignerPrompt()
3. Ensure backward compatibility (seededPositions is optional)

**Acceptance Criteria**:
- [ ] DrillDesignerOptions includes seededPositions
- [ ] seededPositions passed to prompt builder
- [ ] Works with and without seeded positions
- [ ] No breaking changes to existing flow

---

### Task 3.5: Drill Schema Update
**Description**: Add position fields to drill schema
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.2
**Can run parallel with**: Task 3.1

**File:** `lib/guruFunctions/schemas/drillSeriesSchema.ts`

**Technical Requirements**:

```typescript
// Add to drillSchema in drillSeriesSchema.ts:

export const drillSchema = z.object({
  drillId: z.string(),
  tier: z.enum(['RECOGNITION', 'APPLICATION', 'TRANSFER']),
  methodology: z.string().nullable().optional(),

  // NEW: Position reference for scenario-based drills
  positionId: z.string().nullable().optional(),  // e.g., "opening-3-1"
  gamePhase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']).nullable().optional(),

  scenario: drillScenarioSchema,
  options: z.array(drillOptionSchema),
  correctAnswer: z.string(),
  feedback: drillFeedbackSchema,
  asciiWireframe: z.string().nullable().optional(),
  metadata: drillMetadataSchema,
})
```

**Implementation Steps**:
1. Add `positionId` field (optional string)
2. Add `gamePhase` field (optional enum matching GamePhase)
3. Mark both as nullable().optional() for OpenAI structured outputs
4. Verify schema compiles

**Acceptance Criteria**:
- [ ] Schema includes positionId field
- [ ] Schema includes gamePhase field
- [ ] Both fields are properly optional
- [ ] Schema validates correctly

---

## Phase 4: Artifact Info Modal

### Task 4.1: Info Content Definition
**Description**: Define content for artifact creation explanation modal
**Size**: Medium
**Priority**: Medium
**Dependencies**: None
**Can run parallel with**: Any

**File:** `lib/teaching/artifactInfoContent.ts`

**Technical Requirements**:

```typescript
// lib/teaching/artifactInfoContent.ts

import { Brain, BookOpen, Target, FileText, Settings, MessageSquare, User, CheckCircle, Layout, LucideIcon } from 'lucide-react'

interface Step {
  title: string
  description: string
}

interface Influence {
  icon: LucideIcon
  name: string
  description: string
  whereToChange: string
}

interface ArtifactInfo {
  icon: LucideIcon
  title: string
  overview: string
  steps: Step[]
  influences: Influence[]
}

export const ARTIFACT_CREATION_INFO: Record<'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES', ArtifactInfo> = {
  MENTAL_MODEL: {
    icon: Brain,
    title: 'Mental Model',
    overview: 'The Mental Model is the foundation of your guru. It extracts the core principles and concepts from your knowledge corpus that learners need to master.',
    steps: [
      {
        title: 'Corpus Composition',
        description: 'All your context layers and knowledge files are combined into a single knowledge base.'
      },
      {
        title: 'Structure Analysis',
        description: 'AI analyzes the corpus to identify major themes, categories, and relationships.'
      },
      {
        title: 'Principle Extraction',
        description: 'Core principles are extracted - each with its essence, why it matters, common mistakes, and recognition patterns.'
      },
      {
        title: 'Framework Building',
        description: 'Principles are organized into a teachable framework with connections between related concepts.'
      }
    ],
    influences: [
      {
        icon: FileText,
        name: 'Your Corpus',
        description: 'The content in your context layers and knowledge files directly determines what principles are extracted.',
        whereToChange: 'Add or edit content in the Corpus tab'
      },
      {
        icon: Settings,
        name: 'System Prompt',
        description: "Controls the AI's teaching persona and approach to organizing knowledge.",
        whereToChange: 'Edit in Prompt Settings (View/Edit Prompts button)'
      },
      {
        icon: MessageSquare,
        name: 'User Notes',
        description: 'Your guidance when generating (e.g., "focus on beginner concepts") influences what\'s emphasized.',
        whereToChange: 'Add notes when clicking Generate'
      },
      {
        icon: User,
        name: 'Guru Profile',
        description: "If set, the guru's teaching style and target audience are considered.",
        whereToChange: 'Edit in Guru Profile settings'
      }
    ]
  },

  CURRICULUM: {
    icon: BookOpen,
    title: 'Curriculum',
    overview: 'The Curriculum creates a structured learning path based on your Mental Model. It organizes principles into modules with lessons that build on each other.',
    steps: [
      {
        title: 'Load Mental Model',
        description: "The curriculum is built on top of your Mental Model's principles and framework."
      },
      {
        title: 'Path Design',
        description: 'AI designs a progression from foundational to advanced concepts, ensuring prerequisites come first.'
      },
      {
        title: 'Module Structure',
        description: 'Principles are grouped into modules. Each module contains lessons of four types: Concept, Example, Exercise, and Assessment.'
      },
      {
        title: 'Content Verification',
        description: 'If enabled, claims in the curriculum are verified against the ground truth engine for accuracy.'
      }
    ],
    influences: [
      {
        icon: Brain,
        name: 'Mental Model',
        description: "The principles and structure from your Mental Model directly shape what's taught.",
        whereToChange: 'Regenerate the Mental Model or adjust your corpus'
      },
      {
        icon: Settings,
        name: 'System & User Prompts',
        description: 'Control how lessons are structured and what teaching approaches are used.',
        whereToChange: 'Edit in Prompt Settings'
      },
      {
        icon: CheckCircle,
        name: 'Ground Truth Engine',
        description: 'When enabled, factual claims are verified for accuracy.',
        whereToChange: 'Configure in Ground Truth settings'
      }
    ]
  },

  DRILL_SERIES: {
    icon: Target,
    title: 'Drill Series',
    overview: 'Drills are scenario-based practice exercises. Each drill presents a real game situation and asks the learner to apply the principles they\'ve learned.',
    steps: [
      {
        title: 'Load Prerequisites',
        description: 'Both the Mental Model (for principles) and Curriculum (for structure) are loaded.'
      },
      {
        title: 'Position Seeding',
        description: 'Real game positions are fetched from the backgammon engine. Currently includes all 21 opening rolls.'
      },
      {
        title: 'Drill Design',
        description: 'AI creates drills around the seeded positions, using various teaching methodologies (case analysis, error detection, etc.).'
      },
      {
        title: 'Answer Verification',
        description: "Each drill's correct answer is verified against the engine to ensure accuracy."
      },
      {
        title: 'Feedback Generation',
        description: 'Helpful feedback is generated for both correct and incorrect answers, reinforcing the underlying principles.'
      }
    ],
    influences: [
      {
        icon: Layout,
        name: 'Position Library',
        description: 'The game positions used come from the engine. Different positions teach different concepts.',
        whereToChange: 'Positions are auto-populated from the backgammon engine'
      },
      {
        icon: Brain,
        name: 'Mental Model Principles',
        description: 'Drills are designed to reinforce specific principles from your Mental Model.',
        whereToChange: 'Regenerate Mental Model to change which principles are taught'
      },
      {
        icon: BookOpen,
        name: 'Curriculum Structure',
        description: 'The curriculum determines how drills progress in difficulty.',
        whereToChange: 'Regenerate Curriculum to change drill progression'
      },
      {
        icon: Settings,
        name: 'Drill Prompt',
        description: 'Controls drill format, methodology mix, and pedagogical approach.',
        whereToChange: 'Edit in Prompt Settings'
      }
    ]
  }
}
```

**Implementation Steps**:
1. Create `lib/teaching/artifactInfoContent.ts`
2. Define interfaces for Step, Influence, ArtifactInfo
3. Define MENTAL_MODEL content
4. Define CURRICULUM content
5. Define DRILL_SERIES content (including position seeding)
6. Use plain, non-technical language

**Acceptance Criteria**:
- [ ] Content defined for all three artifact types
- [ ] Each type has overview, steps, and influences
- [ ] Language is clear for non-technical users
- [ ] Icons specified for each influence

---

### Task 4.2: ArtifactInfoModal Component
**Description**: Create modal component to display artifact creation info
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 4.1
**Can run parallel with**: None

**File:** `components/artifacts/ArtifactInfoModal.tsx`

**Technical Requirements**:

```typescript
// components/artifacts/ArtifactInfoModal.tsx

'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ARTIFACT_CREATION_INFO } from '@/lib/teaching/artifactInfoContent'

interface ArtifactInfoModalProps {
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'
  isOpen: boolean
  onClose: () => void
}

export function ArtifactInfoModal({ artifactType, isOpen, onClose }: ArtifactInfoModalProps) {
  const info = ARTIFACT_CREATION_INFO[artifactType]
  const Icon = info.icon

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            How {info.title} is Created
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Overview */}
          <section>
            <h3 className="font-semibold text-lg mb-2">What is this?</h3>
            <p className="text-muted-foreground">{info.overview}</p>
          </section>

          {/* Step-by-step process */}
          <section>
            <h3 className="font-semibold text-lg mb-3">Creation Process</h3>
            <ol className="space-y-4">
              {info.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* What influences the output */}
          <section>
            <h3 className="font-semibold text-lg mb-3">What Affects the Output?</h3>
            <div className="grid gap-3">
              {info.influences.map((influence, i) => {
                const InfluenceIcon = influence.icon
                return (
                  <div key={i} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                    <InfluenceIcon className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-medium">{influence.name}</p>
                      <p className="text-sm text-muted-foreground">{influence.description}</p>
                      <p className="text-sm text-primary mt-1">→ {influence.whereToChange}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Implementation Steps**:
1. Create `components/artifacts/ArtifactInfoModal.tsx`
2. Import Dialog components from shadcn
3. Import ARTIFACT_CREATION_INFO
4. Render overview section
5. Render numbered step-by-step process
6. Render influences with icons
7. Add scroll handling for long content

**Acceptance Criteria**:
- [ ] Modal displays correctly for each artifact type
- [ ] Overview section shows description
- [ ] Steps are numbered and clear
- [ ] Influences show icons and action links
- [ ] Modal is scrollable for long content
- [ ] Close button/outside click works

---

### Task 4.3: Integrate Info Icon in Artifact Tiles
**Description**: Add info icon button to artifact tile headers
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 4.2
**Can run parallel with**: None

**File:** `components/guru/GuruTeachingManager.tsx`

**Technical Requirements**:

```typescript
// Add to GuruTeachingManager.tsx

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArtifactInfoModal } from '@/components/artifacts/ArtifactInfoModal'
import { useState } from 'react'

// In the component, add state for each tile:
const [infoModalType, setInfoModalType] = useState<'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES' | null>(null)

// In the artifact card header (find the existing card header rendering):
<div className="flex items-center justify-between">
  <h3 className="font-semibold">{getArtifactTitle(artifact.type)}</h3>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation()  // Prevent card click
          setInfoModalType(artifact.type as 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES')
        }}
        className="h-6 w-6 opacity-60 hover:opacity-100"
      >
        <Info className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>How this is created</p>
    </TooltipContent>
  </Tooltip>
</div>

// Render the modal (outside the map, once per component):
<ArtifactInfoModal
  artifactType={infoModalType!}
  isOpen={infoModalType !== null}
  onClose={() => setInfoModalType(null)}
/>
```

**Implementation Steps**:
1. Import Info icon, Button, Tooltip, ArtifactInfoModal
2. Add state for tracking which modal is open
3. Add info button to each artifact tile header
4. Style button to be subtle but discoverable
5. Add tooltip "How this is created"
6. Render single ArtifactInfoModal controlled by state

**Acceptance Criteria**:
- [ ] Info icon appears on each artifact tile
- [ ] Icon is subtle but visible
- [ ] Tooltip shows on hover
- [ ] Clicking icon opens correct modal
- [ ] Card click doesn't trigger info modal
- [ ] Modal closes properly

---

## Phase 5: Testing & Documentation

### Task 5.1: Unit Tests
**Description**: Write unit tests for position library functions
**Size**: Medium
**Priority**: Medium
**Dependencies**: Phase 2 complete
**Can run parallel with**: Task 5.2

**Files:** `__tests__/positionLibrary/*.test.ts`

**Technical Requirements**:

```typescript
// __tests__/positionLibrary/asciiRenderer.test.ts

import { renderOpeningBoard, renderAsciiBoard } from '@/lib/positionLibrary'

describe('renderOpeningBoard', () => {
  it('should render ASCII board with dice roll', () => {
    const result = renderOpeningBoard('3-1')
    expect(result).toContain('Dice: 3-1')
    expect(result).toContain('White (X) to move')
  })

  it('should show correct starting position', () => {
    const result = renderOpeningBoard('6-5')
    // Check for X on point 6 (5 checkers)
    expect(result).toContain('X')
    // Check for O on point 19 (5 checkers)
    expect(result).toContain('O')
  })
})

describe('renderAsciiBoard', () => {
  it('should handle opening positions', () => {
    expect(() => renderAsciiBoard('opening-3-1', '3-1')).not.toThrow()
    expect(() => renderAsciiBoard('opening', '4-2')).not.toThrow()
  })

  it('should throw for non-opening positions', () => {
    expect(() => renderAsciiBoard('4HPwATDgc/ABMA', '3-1')).toThrow('Non-opening positions not yet supported')
  })
})
```

```typescript
// __tests__/positionLibrary/openings.test.ts

import { OPENING_ROLLS } from '@/lib/positionLibrary'

describe('OPENING_ROLLS', () => {
  it('should have exactly 21 rolls', () => {
    expect(OPENING_ROLLS).toHaveLength(21)
  })

  it('should have 15 non-doubles', () => {
    const nonDoubles = OPENING_ROLLS.filter(r => r[0] !== r[2])
    expect(nonDoubles).toHaveLength(15)
  })

  it('should have 6 doubles', () => {
    const doubles = OPENING_ROLLS.filter(r => r[0] === r[2])
    expect(doubles).toHaveLength(6)
  })
})
```

**Acceptance Criteria**:
- [ ] ASCII renderer tests pass
- [ ] Opening rolls constant tests pass
- [ ] All 21 rolls accounted for

---

### Task 5.2: Integration Tests
**Description**: Write integration tests for position population and seeding
**Size**: Medium
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 5.1

**Files:** `__tests__/integration/positionLibrary.test.ts`

**Technical Requirements**:
- Test position population with mocked engine
- Test seeding returns correct format
- Test drill generation with seeded positions

**Acceptance Criteria**:
- [ ] Population test passes with mocked engine
- [ ] Seeding test returns SeededPosition format
- [ ] Drill generation includes positions in prompt

---

### Task 5.3: E2E Tests
**Description**: Write E2E tests for drill generation with positions
**Size**: Medium
**Priority**: Medium
**Dependencies**: Phase 4 complete
**Can run parallel with**: None

**File:** `tests/drill-generation-positions.spec.ts`

**Technical Requirements**:
- Test generating drill series with ground truth enabled
- Verify drills reference seeded positions
- Test info modal opens and closes

**Acceptance Criteria**:
- [ ] Drill generation test passes
- [ ] Info modal test passes
- [ ] Tests run in CI

---

### Task 5.4: Documentation
**Description**: Document Position Library in CLAUDE.md
**Size**: Small
**Priority**: Low
**Dependencies**: All implementation complete
**Can run parallel with**: None

**Files:**
- `.claude/CLAUDE.md` - Add Position Library section

**Technical Requirements**:
Add section covering:
- Position Library architecture
- How to populate positions
- How position seeding works
- Troubleshooting guide

**Acceptance Criteria**:
- [ ] CLAUDE.md updated with Position Library section
- [ ] Clear documentation for future developers

---

## Task Dependencies Graph

```
Phase 1: Infrastructure
1.1 Schema ──▶ 1.2 Types

Phase 2: Position Sourcing
                 ┌──▶ 2.1 Openings ──┐
1.1 Schema ──────┤                   ├──▶ 2.3 API
                 └──▶ 2.2 ASCII ─────┘

Phase 3: Seeding Integration
2.1 + 2.2 ──▶ 3.1 Seeder ──▶ 3.2 Prompt ──┬──▶ 3.4 Generator
                                          │
                              3.3 Inngest ─┘
                                   │
                              3.5 Schema (parallel with 3.1)

Phase 4: Info Modal
4.1 Content ──▶ 4.2 Modal ──▶ 4.3 Integration

Phase 5: Testing
All phases ──▶ 5.1-5.4 Testing & Docs
```

---

## Success Criteria

- [ ] All 21 opening rolls populated in Position Library
- [ ] Drills generated using seeded positions (not invented)
- [ ] Correct answers match engine's bestMove
- [ ] Info modal explains creation process clearly
- [ ] Graceful fallback when engine unavailable
- [ ] Generation time < 3 minutes with position seeding

---

## Rollout Plan

1. **Run migration** to add PositionLibrary table
2. **Populate positions** for existing backgammon engine
3. **Test drill generation** with a single project
4. **Verify drills** reference real opening positions
5. **Monitor** token usage and generation times
