# Task Breakdown: Configurable Drill Generation with Position Library Integration

**Generated**: 2025-12-15
**Source**: specs/feat-configurable-drill-generation.md
**Last Decompose**: 2025-12-15

---

## Overview

This task breakdown implements Phase 1 (Core Configuration MVP) of the configurable drill generation feature. Users will be able to:
- Select game phases with position counts displayed
- Set target drill count (5-50)
- Control drill type mix (direct vs principle-focused)
- Fetch positions for empty phases

---

## Phase 1: Foundation (3 tasks)

### Task 1.1: Add DrillGenerationConfig type
**Description**: Define the core configuration type for drill generation
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2, 1.3

**File**: `lib/guruFunctions/types.ts`

**Implementation**:
```typescript
/**
 * Configuration for drill series generation
 * Controls count, phases, and drill type distribution
 */
export interface DrillGenerationConfig {
  /** Which game phases to include (default: ['OPENING']) */
  gamePhases: GamePhase[]

  /** Target number of drills to generate (5-50, default: available positions) */
  targetDrillCount: number

  /** Proportion of "best move" drills vs principle-focused (0.0-1.0, default: 0.7) */
  directDrillRatio: number

  /** Whether to use stored positions from Position Library (default: true) */
  useExistingPositions: boolean

  /** If fetching new positions, how many to fetch (optional) */
  fetchNewPositionCount?: number
}

/** Game phases supported by the drill generation system */
export type GamePhase = 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF'

/** Default configuration for drill generation */
export const DEFAULT_DRILL_CONFIG: DrillGenerationConfig = {
  gamePhases: ['OPENING'],
  targetDrillCount: 21,
  directDrillRatio: 0.7,
  useExistingPositions: true,
}
```

**Acceptance Criteria**:
- [ ] DrillGenerationConfig interface exported from types.ts
- [ ] GamePhase type exported
- [ ] DEFAULT_DRILL_CONFIG constant exported
- [ ] Types compile without errors
- [ ] Existing imports in codebase still work

---

### Task 1.2: Create position counts API endpoint
**Description**: API endpoint to get position counts by game phase
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1, 1.3

**File**: `app/api/position-library/counts/route.ts` (NEW)

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/position-library/counts
 * Query params: engineId (required)
 * Returns position counts grouped by game phase
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const engineId = request.nextUrl.searchParams.get('engineId')
    if (!engineId) {
      return NextResponse.json(
        { error: 'engineId query parameter is required' },
        { status: 400 }
      )
    }

    // Query position counts grouped by phase
    const counts = await prisma.positionLibrary.groupBy({
      by: ['gamePhase'],
      where: { engineId },
      _count: { id: true }
    })

    // Transform to expected format
    const result = {
      OPENING: counts.find(c => c.gamePhase === 'OPENING')?._count.id ?? 0,
      EARLY: counts.find(c => c.gamePhase === 'EARLY')?._count.id ?? 0,
      MIDDLE: counts.find(c => c.gamePhase === 'MIDDLE')?._count.id ?? 0,
      BEAROFF: counts.find(c => c.gamePhase === 'BEAROFF')?._count.id ?? 0,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Position Counts API]', error)
    return NextResponse.json(
      { error: 'Failed to fetch position counts' },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria**:
- [ ] GET /api/position-library/counts?engineId=xxx returns counts
- [ ] Response format: `{ OPENING: number, EARLY: number, MIDDLE: number, BEAROFF: number }`
- [ ] Returns 401 if not authenticated
- [ ] Returns 400 if engineId missing
- [ ] Returns 0 for phases with no positions

---

### Task 1.3: Create position fetch API endpoint
**Description**: API endpoint to trigger fetching positions from ground truth engine
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1, 1.2

**File**: `app/api/position-library/fetch/route.ts` (NEW)

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from '@/lib/auth'
import { z } from 'zod'
import { populateOpeningPositions } from '@/lib/positionLibrary/openings'

export const dynamic = 'force-dynamic'

const fetchPositionsSchema = z.object({
  engineId: z.string().min(1, 'engineId is required'),
  phase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']),
  count: z.number().min(1).max(50).default(10),
})

/**
 * POST /api/position-library/fetch
 * Triggers fetching positions from ground truth engine
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = fetchPositionsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { engineId, phase, count } = parsed.data

    // Fetch engine configuration
    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId }
    })

    if (!engine) {
      return NextResponse.json(
        { error: 'Engine not found' },
        { status: 404 }
      )
    }

    // For OPENING phase, use existing populateOpeningPositions
    if (phase === 'OPENING') {
      const result = await populateOpeningPositions({
        engineId,
        engineUrl: engine.engineUrl,
        engineName: engine.name,
        domain: engine.domain,
        enabled: true,
        configId: '',
      })

      return NextResponse.json({
        fetched: result.populated,
        errors: result.errors,
        phase,
      })
    }

    // Phase 2: EARLY, MIDDLE, BEAROFF not yet implemented
    return NextResponse.json(
      { error: `Position fetching for ${phase} phase is not yet implemented` },
      { status: 501 }
    )
  } catch (error) {
    console.error('[Position Fetch API]', error)
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria**:
- [ ] POST /api/position-library/fetch with valid body triggers fetch
- [ ] Returns `{ fetched: number, errors: string[], phase: string }`
- [ ] OPENING phase uses populateOpeningPositions()
- [ ] Other phases return 501 Not Implemented
- [ ] Returns 401 if not authenticated
- [ ] Validates request body with Zod

---

## Phase 2: API Layer (1 task)

### Task 2.1: Extend drill-series API schema
**Description**: Add drillConfig parameter to drill series generation endpoint
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (types)
**Can run parallel with**: Task 2.2, 2.3

**File**: `app/api/projects/[id]/guru/drill-series/route.ts`

**Changes to existing schema**:
```typescript
import { z } from 'zod'
import type { DrillGenerationConfig, GamePhase } from '@/lib/guruFunctions/types'

// Extend existing schema
const generateDrillSeriesSchema = z.object({
  mentalModelArtifactId: z.string().optional(),
  curriculumArtifactId: z.string().optional(),
  userNotes: z.string().optional(),

  // NEW: Drill configuration
  drillConfig: z.object({
    gamePhases: z.array(z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']))
      .min(1, 'At least one game phase must be selected')
      .default(['OPENING']),
    targetDrillCount: z.number()
      .min(5, 'Minimum 5 drills')
      .max(50, 'Maximum 50 drills')
      .default(21),
    directDrillRatio: z.number()
      .min(0, 'Ratio must be between 0 and 1')
      .max(1, 'Ratio must be between 0 and 1')
      .default(0.7),
    useExistingPositions: z.boolean().default(true),
    fetchNewPositionCount: z.number().min(1).max(50).optional(),
  }).optional(),
})

// In POST handler, pass config to Inngest job
await inngest.send({
  name: 'guru/generate-drill-series',
  data: {
    projectId,
    userId: session.user.id,
    mentalModelArtifactId: parsed.data.mentalModelArtifactId,
    curriculumArtifactId: parsed.data.curriculumArtifactId,
    userNotes: parsed.data.userNotes,
    drillConfig: parsed.data.drillConfig, // NEW: Pass config
  },
})
```

**Acceptance Criteria**:
- [ ] Schema accepts drillConfig object
- [ ] All drillConfig fields have proper validation
- [ ] Default values applied when drillConfig not provided
- [ ] Config passed to Inngest job
- [ ] Existing callers without drillConfig still work

---

## Phase 3: Prompt Engineering (2 tasks)

### Task 2.2: Create buildDrillConfigSection() prompt function
**Description**: Build prompt section that enforces drill configuration requirements
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (types)
**Can run parallel with**: Task 2.1, 2.3

**File**: `lib/guruFunctions/prompts/drillDesignerPrompt.ts`

**Implementation**:
```typescript
import type { DrillGenerationConfig } from '../types'

/**
 * Build prompt section enforcing drill generation requirements
 *
 * This section is MANDATORY and instructs GPT to follow exact counts
 * and type distributions.
 */
export function buildDrillConfigSection(config: DrillGenerationConfig): string {
  const directCount = Math.round(config.targetDrillCount * config.directDrillRatio)
  const principleCount = config.targetDrillCount - directCount

  return `
---

## DRILL GENERATION REQUIREMENTS (MANDATORY)

**CRITICAL: You MUST follow these exact requirements. Generation will be rejected if not met.**

### Drill Count
- Generate EXACTLY ${config.targetDrillCount} drills total
- Do NOT generate fewer or more drills
- Each drill MUST use a unique position from the POSITIONS section below

### Drill Type Distribution
- **Direct Drills (${directCount} total)**: Ask "What is the best move?"
  - Tests move recall and execution
  - Correct answer is the engine-verified best move
  - Feedback explains WHY it's best using strategic principles
  - Options should include the best move and 2-3 plausible alternatives

- **Principle-Focused Drills (${principleCount} total)**: Ask "Which principle applies here?"
  - Tests understanding of WHY moves are good
  - Uses a board position as the scenario context
  - Options are strategic principles, not moves
  - Feedback connects the position characteristics to the principle

### Game Phases Included
- Only use positions from these phases: ${config.gamePhases.join(', ')}
- Do NOT invent positions - use ONLY the positions provided below

### Output Validation
Your output will be validated against these requirements:
1. Total drill count == ${config.targetDrillCount}
2. Direct drill count ~= ${directCount} (±1 allowed)
3. All positions used come from the provided list
4. Each drill has exactly 4 options (one correct)

---
`
}
```

**Acceptance Criteria**:
- [ ] Function calculates correct direct/principle counts
- [ ] Prompt includes all game phases
- [ ] MANDATORY requirements clearly stated
- [ ] Validation criteria documented in prompt
- [ ] Function exported from drillDesignerPrompt.ts

---

### Task 2.3: Enhance buildPositionsSection() for config filtering
**Description**: Filter and limit positions based on drill configuration
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (types)
**Can run parallel with**: Task 2.1, 2.2

**File**: `lib/guruFunctions/prompts/drillDesignerPrompt.ts`

**Implementation**:
```typescript
import type { DrillGenerationConfig } from '../types'
import type { SeededPositionsByPhase, SeededPosition } from '@/lib/positionLibrary/types'

/**
 * Build positions section with filtering based on config
 *
 * Filters positions by selected phases and limits to target count.
 */
export function buildPositionsSection(
  seededPositions: SeededPositionsByPhase | null,
  config: DrillGenerationConfig
): string {
  if (!seededPositions) {
    return `
---

## POSITIONS

No verified positions available. Generate drills using conceptual scenarios.

---
`
  }

  // Filter positions by selected phases
  const selectedPositions: SeededPosition[] = config.gamePhases.flatMap(
    phase => seededPositions[phase] || []
  )

  // Limit to target count
  const limitedPositions = selectedPositions.slice(0, config.targetDrillCount)

  if (limitedPositions.length === 0) {
    return `
---

## POSITIONS

No positions available for selected phases (${config.gamePhases.join(', ')}).
Generate drills using conceptual scenarios.

---
`
  }

  // Format each position for the prompt
  const positionEntries = limitedPositions.map((pos, index) => {
    const altMoves = pos.alternatives
      .map(a => `  - ${a.move} (equity: ${a.equity.toFixed(3)})`)
      .join('\n')

    return `### Position ${index + 1}: ${pos.positionId}
**Dice**: ${pos.diceRoll}
**Best Move**: ${pos.bestMove} (equity: ${pos.bestMoveEquity.toFixed(3)})
**Alternatives**:
${altMoves || '  None available'}
${pos.asciiBoard ? `\n**Board**:\n\`\`\`\n${pos.asciiBoard}\n\`\`\`` : ''}`
  }).join('\n\n')

  return `
---

## POSITIONS TO USE (${limitedPositions.length} total)

**IMPORTANT**: Create ONE drill for EACH position listed below.
Use the exact position IDs as positionId in your drill output.

${positionEntries}

---
`
}
```

**Acceptance Criteria**:
- [ ] Filters positions by config.gamePhases
- [ ] Limits positions to config.targetDrillCount
- [ ] Handles empty positions gracefully
- [ ] Includes ASCII board when available
- [ ] Position IDs included for tracking

---

## Phase 4: Inngest Integration (2 tasks)

### Task 3.1: Pass drillConfig through Inngest job
**Description**: Update Inngest job to accept and use drill configuration
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1 (API), Task 2.2, Task 2.3 (prompt functions)
**Can run parallel with**: Task 3.2

**File**: `lib/inngest-functions.ts`

**Changes to drillSeriesGenerationJob**:
```typescript
import type { DrillGenerationConfig } from './guruFunctions/types'
import { DEFAULT_DRILL_CONFIG } from './guruFunctions/types'
import { buildDrillConfigSection, buildPositionsSection } from './guruFunctions/prompts/drillDesignerPrompt'

// Update event type
interface DrillSeriesGenerationEvent {
  data: {
    projectId: string
    userId: string
    mentalModelArtifactId?: string
    curriculumArtifactId?: string
    userNotes?: string
    drillConfig?: DrillGenerationConfig  // NEW
  }
}

// In the job handler:
const drillSeriesGenerationJob = inngest.createFunction(
  { id: 'drill-series-generation', name: 'Generate Drill Series' },
  { event: 'guru/generate-drill-series' },
  async ({ event, step }) => {
    const { projectId, userId, drillConfig: inputConfig } = event.data

    // Merge with defaults
    const drillConfig: DrillGenerationConfig = {
      ...DEFAULT_DRILL_CONFIG,
      ...inputConfig,
    }

    // In 'seed-positions' step, apply phase filter:
    const seededPositions = await step.run('seed-positions', async () => {
      const gtConfig = await resolveGroundTruthConfig(projectId)
      if (!gtConfig?.enabled) return null

      const allPositions = await seedPositionsByPhase(gtConfig.engineId)
      if (!allPositions) return null

      // Filter by selected phases
      return {
        OPENING: drillConfig.gamePhases.includes('OPENING') ? allPositions.OPENING : [],
        EARLY: drillConfig.gamePhases.includes('EARLY') ? allPositions.EARLY : [],
        MIDDLE: drillConfig.gamePhases.includes('MIDDLE') ? allPositions.MIDDLE : [],
        BEAROFF: drillConfig.gamePhases.includes('BEAROFF') ? allPositions.BEAROFF : [],
      }
    })

    // In prompt building, include config section:
    const configSection = buildDrillConfigSection(drillConfig)
    const positionsSection = buildPositionsSection(seededPositions, drillConfig)

    // Add to system prompt
    const systemPrompt = `
${baseSystemPrompt}

${configSection}

${positionsSection}
`
    // ... rest of generation
  }
)
```

**Acceptance Criteria**:
- [ ] drillConfig accepted from event data
- [ ] Default values merged when config partially provided
- [ ] Positions filtered by selected phases
- [ ] Config section included in prompt
- [ ] Positions section uses config for filtering

---

### Task 3.2: Add post-generation validation step
**Description**: Validate generated drills match configuration requirements
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.1
**Can run parallel with**: None

**File**: `lib/inngest-functions.ts`

**Implementation**:
```typescript
// Add after drill generation step, before artifact save:
const validationResult = await step.run('validate-drill-count', async () => {
  if (!result?.content?.series) {
    return { valid: false, reason: 'No drill series in result' }
  }

  const actualDrillCount = result.content.series.reduce(
    (sum: number, series: { drills: unknown[] }) => sum + series.drills.length,
    0
  )

  const targetCount = drillConfig.targetDrillCount
  const tolerance = 0.1 // 10% tolerance
  const minAcceptable = Math.floor(targetCount * (1 - tolerance))

  if (actualDrillCount < minAcceptable) {
    console.warn(
      `[DrillGeneration] Count mismatch: generated ${actualDrillCount}, target was ${targetCount} (min ${minAcceptable})`
    )
    return {
      valid: false,
      reason: `Generated ${actualDrillCount} drills, target was ${targetCount}`,
      actualCount: actualDrillCount,
      targetCount,
    }
  }

  return {
    valid: true,
    actualCount: actualDrillCount,
    targetCount,
  }
})

// Store validation result in artifact metadata
await prisma.guruArtifact.update({
  where: { id: artifactId },
  data: {
    metadata: {
      ...(existingMetadata || {}),
      drillConfig,
      validation: validationResult,
    }
  }
})
```

**Acceptance Criteria**:
- [ ] Validates drill count against target
- [ ] Allows 10% tolerance for GPT variance
- [ ] Logs warning on count mismatch
- [ ] Stores validation result in artifact metadata
- [ ] Does not fail generation on mismatch (graceful)

---

## Phase 5: UI Components (2 tasks)

### Task 4.1: Create DrillConfigurationPanel component
**Description**: Build the main UI component for drill configuration
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.2 (counts API), Task 1.3 (fetch API)
**Can run parallel with**: None

**File**: `components/guru/DrillConfigurationPanel.tsx` (NEW)

**Implementation**:
```tsx
'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DrillGenerationConfig, GamePhase } from '@/lib/guruFunctions/types'

const GAME_PHASES: GamePhase[] = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']
const FETCH_COUNT_OPTIONS = [5, 10, 20, 50]

interface PositionCounts {
  OPENING: number
  EARLY: number
  MIDDLE: number
  BEAROFF: number
}

interface DrillConfigurationPanelProps {
  projectId: string
  engineId: string | null
  onGenerate: (config: DrillGenerationConfig) => void
  isGenerating: boolean
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function DrillConfigurationPanel({
  projectId,
  engineId,
  onGenerate,
  isGenerating,
}: DrillConfigurationPanelProps) {
  // Fetch position counts
  const { data: counts, mutate: refreshCounts, isLoading: countsLoading } = useSWR<PositionCounts>(
    engineId ? `/api/position-library/counts?engineId=${engineId}` : null,
    fetcher
  )

  // Config state
  const [selectedPhases, setSelectedPhases] = useState<GamePhase[]>(['OPENING'])
  const [targetDrillCount, setTargetDrillCount] = useState(21)
  const [directDrillRatio, setDirectDrillRatio] = useState(0.7)

  // Fetch positions state
  const [fetchingPhase, setFetchingPhase] = useState<GamePhase | null>(null)
  const [fetchCount, setFetchCount] = useState<Record<GamePhase, number>>({
    OPENING: 10,
    EARLY: 10,
    MIDDLE: 10,
    BEAROFF: 10,
  })

  // Calculate available positions for selected phases
  const availablePositions = useMemo(() => {
    if (!counts) return 0
    return selectedPhases.reduce((sum, phase) => sum + (counts[phase] ?? 0), 0)
  }, [counts, selectedPhases])

  // Toggle phase selection
  const togglePhase = (phase: GamePhase) => {
    setSelectedPhases(prev => {
      if (prev.includes(phase)) {
        // Don't allow deselecting the last phase
        if (prev.length === 1) return prev
        return prev.filter(p => p !== phase)
      }
      return [...prev, phase]
    })
  }

  // Handle fetching positions for a phase
  const handleFetchPositions = async (phase: GamePhase) => {
    if (!engineId || fetchingPhase) return

    setFetchingPhase(phase)
    try {
      const response = await fetch('/api/position-library/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          phase,
          count: fetchCount[phase],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Fetch positions failed:', error)
        // TODO: Show toast error
        return
      }

      // Refresh counts after successful fetch
      await refreshCounts()
    } catch (error) {
      console.error('Fetch positions error:', error)
    } finally {
      setFetchingPhase(null)
    }
  }

  // Handle generate click
  const handleGenerate = () => {
    onGenerate({
      gamePhases: selectedPhases,
      targetDrillCount,
      directDrillRatio,
      useExistingPositions: true,
    })
  }

  // Calculate drill type counts for display
  const directDrillCount = Math.round(targetDrillCount * directDrillRatio)
  const principleDrillCount = targetDrillCount - directDrillCount

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-lg">Drill Configuration</h3>

      {/* Phase Selection with Position Counts */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Game Phases</Label>
        <div className="space-y-2">
          {GAME_PHASES.map(phase => {
            const phaseCount = counts?.[phase] ?? 0
            const isSelected = selectedPhases.includes(phase)
            const hasPositions = phaseCount > 0

            return (
              <div key={phase} className="flex items-center justify-between gap-4">
                <Badge
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer transition-colors ${
                    !hasPositions && !isSelected ? 'opacity-50' : ''
                  }`}
                  onClick={() => togglePhase(phase)}
                >
                  {phase} ({countsLoading ? '...' : phaseCount})
                </Badge>

                {/* Fetch Positions button for phases with 0 positions */}
                {phaseCount === 0 && engineId && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={fetchCount[phase].toString()}
                      onValueChange={(v) => setFetchCount(prev => ({
                        ...prev,
                        [phase]: parseInt(v)
                      }))}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FETCH_COUNT_OPTIONS.map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFetchPositions(phase)}
                      disabled={fetchingPhase !== null}
                    >
                      {fetchingPhase === phase ? 'Fetching...' : 'Fetch'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Click phases to select/deselect. Fetch positions for empty phases.
        </p>
      </div>

      {/* Drill Count Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Target Drill Count</Label>
          <span className="text-sm font-mono">{targetDrillCount}</span>
        </div>
        <Slider
          value={[targetDrillCount]}
          onValueChange={([v]) => setTargetDrillCount(v)}
          min={5}
          max={Math.max(5, Math.min(50, availablePositions || 50))}
          step={1}
          disabled={availablePositions === 0}
        />
        <p className="text-xs text-muted-foreground">
          {availablePositions > 0
            ? `${availablePositions} positions available for selected phases`
            : 'No positions available - fetch some first'}
        </p>
      </div>

      {/* Drill Type Mix Slider */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Drill Type Mix</Label>
        <div className="flex items-center gap-4">
          <span className="text-xs w-24">
            Direct ({directDrillCount})
          </span>
          <Slider
            value={[directDrillRatio * 100]}
            onValueChange={([v]) => setDirectDrillRatio(v / 100)}
            min={0}
            max={100}
            step={10}
            className="flex-1"
          />
          <span className="text-xs w-24 text-right">
            Principle ({principleDrillCount})
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Direct drills test &quot;best move&quot;. Principle drills test strategic understanding.
        </p>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || availablePositions === 0}
        className="w-full"
        size="lg"
      >
        {isGenerating
          ? 'Generating...'
          : availablePositions === 0
            ? 'Fetch Positions First'
            : `Generate ${targetDrillCount} Drills`}
      </Button>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Shows all 4 game phases with position counts
- [ ] Phases are toggleable (badge click)
- [ ] Fetch button appears for phases with 0 positions
- [ ] Count selector for fetch operation (5, 10, 20, 50)
- [ ] Drill count slider respects available positions
- [ ] Type mix slider shows calculated counts
- [ ] Generate button disabled when no positions
- [ ] Loading states shown appropriately

---

### Task 4.2: Integrate DrillConfigurationPanel into GuruTeachingManager
**Description**: Connect the configuration panel to the existing teaching manager
**Size**: Medium
**Priority**: High
**Dependencies**: Task 4.1
**Can run parallel with**: None

**File**: `components/guru/GuruTeachingManager.tsx`

**Changes**:
```tsx
import { DrillConfigurationPanel } from './DrillConfigurationPanel'
import type { DrillGenerationConfig } from '@/lib/guruFunctions/types'

// In the component, add state for showing config panel:
const [showDrillConfig, setShowDrillConfig] = useState(false)

// Add handler for drill generation with config:
const handleGenerateDrillsWithConfig = async (config: DrillGenerationConfig) => {
  setIsGenerating(true)
  setShowDrillConfig(false)

  try {
    const response = await fetch(`/api/projects/${projectId}/guru/drill-series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mentalModelArtifactId: mentalModelArtifact?.id,
        curriculumArtifactId: curriculumArtifact?.id,
        userNotes,
        drillConfig: config,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to start drill generation')
    }

    // Start polling for status
    pollForArtifactStatus('DRILL_SERIES')
  } catch (error) {
    console.error('Drill generation error:', error)
    // TODO: Show toast error
  }
}

// In the render, show config panel instead of direct generate:
{showDrillConfig ? (
  <DrillConfigurationPanel
    projectId={projectId}
    engineId={groundTruthConfig?.engineId ?? null}
    onGenerate={handleGenerateDrillsWithConfig}
    isGenerating={isGenerating}
  />
) : (
  <Button
    onClick={() => setShowDrillConfig(true)}
    disabled={!canGenerateDrills}
  >
    Configure & Generate Drills
  </Button>
)}
```

**Acceptance Criteria**:
- [ ] "Configure & Generate Drills" button shows config panel
- [ ] Panel receives correct projectId and engineId
- [ ] Config passed to API on generate
- [ ] Panel hidden after generation starts
- [ ] Existing functionality preserved

---

## Execution Order

### Parallel Group 1 (Foundation)
- Task 1.1: Add DrillGenerationConfig type
- Task 1.2: Create position counts API endpoint
- Task 1.3: Create position fetch API endpoint

### Parallel Group 2 (API + Prompts)
After Group 1:
- Task 2.1: Extend drill-series API schema
- Task 2.2: Create buildDrillConfigSection() prompt function
- Task 2.3: Enhance buildPositionsSection() for config filtering

### Sequential Group 3 (Inngest)
After Group 2:
- Task 3.1: Pass drillConfig through Inngest job
- Task 3.2: Add post-generation validation step

### Sequential Group 4 (UI)
After Groups 1 and 3:
- Task 4.1: Create DrillConfigurationPanel component
- Task 4.2: Integrate into GuruTeachingManager

---

## Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|----------------------|
| Foundation | 3 | All 3 can run in parallel |
| API Layer | 1 | Can parallel with Phase 3 |
| Prompt Engineering | 2 | Both can run in parallel |
| Inngest Integration | 2 | Sequential |
| UI Components | 2 | Sequential |
| **Total** | **10** | |

**Critical Path**: 1.1 → 2.1 → 3.1 → 3.2 → 4.1 → 4.2

**Estimated Effort**: Medium (10 tasks, well-defined scope)
