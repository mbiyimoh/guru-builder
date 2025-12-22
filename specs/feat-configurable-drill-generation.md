# Configurable Drill Generation with Position Library Integration

## Status
**Draft** | Created: 2025-12-15

## Authors
- Claude (AI Assistant)

---

## Overview

Add a configuration UI and backend support for controlling drill series generation. Users can specify target drill count, select game phases, manage the Position Library, and control the mix between direct "best move" drills and principle-focused conceptual drills.

---

## Background / Problem Statement

### Current State
The drill generation system produces approximately 3 drills regardless of how many verified positions are available. This happens because:

1. **Prompt-driven, not position-driven**: The prompt instructs GPT to "create 3+ drills per principle" (drillDesignerPrompt.ts:349)
2. **Schema is principle-first**: Drills are nested under `series[].drills[]` organized by principle, not position
3. **No configuration surface**: API only accepts `userNotes` - no parameters for count, phases, or drill type
4. **Position injection is guidance only**: The "CRITICAL: Create a drill for each opening roll" instruction is not enforced

### Impact
- Users with 21 verified opening positions can only practice ~3 scenarios
- No way to focus practice on specific game phases (OPENING vs BEAROFF)
- No control over learning style (recall vs understanding)
- Position Library accumulates positions that go unused

### Root Cause
The generation flow was designed for principle coverage, not position coverage. Configuration was deferred to "userNotes" free-text, which GPT interprets inconsistently.

---

## Goals

- **G1**: Users can specify exact drill count (5-50 range) with defaults based on available positions
- **G2**: Users can select which game phase(s) to generate drills for
- **G3**: Users can control the mix between direct drills (best move) and principle-focused drills
- **G4**: Position Library displays counts per phase and allows fetching new positions
- **G5**: Configuration persists sensible defaults per project
- **G6**: Generated drills match the requested configuration (enforced, not just requested)

---

## Non-Goals

- **NG1**: Automatic position fetching during generation (user must explicitly fetch)
- **NG2**: EARLY/MIDDLE/BEAROFF position population (Phase 2 - requires XGID queries)
- **NG3**: Per-position drill customization (e.g., "skip this position")
- **NG4**: Real-time position generation from self-play or match mining
- **NG5**: Drill difficulty adjustment beyond the existing tier system

---

## Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | API routes, React Server Components |
| Prisma | 6.x | Database ORM for PositionLibrary |
| Zod | 3.x | Schema validation for API parameters |
| shadcn/ui | latest | Slider, Select, Tabs components |
| Inngest | 3.x | Background job orchestration |
| OpenAI | 4.x | GPT-4o for drill generation |

**Existing Infrastructure Used:**
- `PositionLibrary` model (prisma/schema.prisma:638-668)
- `seedPositionsByPhase()` (lib/positionLibrary/seeder.ts)
- `populateOpeningPositions()` (lib/positionLibrary/openings.ts)
- Ground Truth MCP client (lib/groundTruth/mcpClient.ts)

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              DrillConfigurationPanel                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │   │
│  │  │ Phase Select│  │ Drill Count │  │ Type Mix Slider  │    │   │
│  │  │ [OPENING ✓] │  │ [===●===] 21│  │ Direct ◀━●━▶ Prin│    │   │
│  │  │ [EARLY    ] │  │             │  │     70%    30%   │    │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │
│  │  │ Position Library: 21 OPENING | 0 EARLY | 0 MIDDLE      │   │
│  │  │ [Fetch More Positions]                                  │   │
│  │  └─────────────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────┬────────────────────────────┘
                                         │ POST /api/.../drill-series
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                   │
│  generateDrillSeriesSchema + DrillGenerationConfig                  │
│  - Validate config parameters                                       │
│  - Trigger Inngest job with config                                  │
└────────────────────────────────────────┬────────────────────────────┘
                                         │ guru/generate-drill-series
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       INNGEST JOB                                   │
│  1. Fetch positions for selected phases                             │
│  2. Filter/limit positions to targetDrillCount                      │
│  3. Build prompt with enforced drill requirements                   │
│  4. Generate drills                                                 │
│  5. Validate output matches config                                  │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PROMPT ENGINEERING                               │
│  - Position-first mode: "Generate exactly N drills"                 │
│  - Enforce drill type ratio in prompt                               │
│  - Post-generation validation step                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Model Changes

#### New Type: DrillGenerationConfig

```typescript
// lib/guruFunctions/types.ts

export interface DrillGenerationConfig {
  // Phase selection
  gamePhases: GamePhase[]           // Which phases to include (default: ['OPENING'])

  // Drill count
  targetDrillCount: number          // Target number of drills (5-50, default: available positions)

  // Drill type mix
  directDrillRatio: number          // 0.0-1.0, proportion of "best move" drills (default: 0.7)

  // Position source
  useExistingPositions: boolean     // Use stored positions (default: true)
  fetchNewPositionCount?: number    // If fetching new, how many (optional)
}

export type GamePhase = 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF'
```

#### API Schema Extension

```typescript
// app/api/projects/[id]/guru/drill-series/route.ts

const generateDrillSeriesSchema = z.object({
  mentalModelArtifactId: z.string().optional(),
  curriculumArtifactId: z.string().optional(),
  userNotes: z.string().optional(),

  // NEW: Drill configuration
  drillConfig: z.object({
    gamePhases: z.array(z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']))
      .min(1)
      .default(['OPENING']),
    targetDrillCount: z.number().min(5).max(50).default(21),
    directDrillRatio: z.number().min(0).max(1).default(0.7),
    useExistingPositions: z.boolean().default(true),
    fetchNewPositionCount: z.number().min(1).max(50).optional(),
  }).optional(),
})
```

#### Position Library Count API

```typescript
// NEW: app/api/position-library/counts/route.ts

// GET /api/position-library/counts?engineId=xxx
// Returns: { OPENING: 21, EARLY: 0, MIDDLE: 0, BEAROFF: 0 }

export async function GET(request: NextRequest) {
  const engineId = request.nextUrl.searchParams.get('engineId')

  const counts = await prisma.positionLibrary.groupBy({
    by: ['gamePhase'],
    where: { engineId: engineId || undefined },
    _count: { id: true }
  })

  return Response.json({
    OPENING: counts.find(c => c.gamePhase === 'OPENING')?._count.id ?? 0,
    EARLY: counts.find(c => c.gamePhase === 'EARLY')?._count.id ?? 0,
    MIDDLE: counts.find(c => c.gamePhase === 'MIDDLE')?._count.id ?? 0,
    BEAROFF: counts.find(c => c.gamePhase === 'BEAROFF')?._count.id ?? 0,
  })
}
```

#### Position Fetch API

```typescript
// NEW: app/api/position-library/fetch/route.ts

// POST /api/position-library/fetch
// Body: { engineId: string, phase: GamePhase, count: number }
// Returns: { fetched: number, errors: string[] }

const fetchPositionsSchema = z.object({
  engineId: z.string(),
  phase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']),
  count: z.number().min(1).max(50).default(10),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { engineId, phase, count } = fetchPositionsSchema.parse(body)

  // Fetch engine config
  const engine = await prisma.groundTruthEngine.findUnique({
    where: { id: engineId }
  })
  if (!engine) {
    return Response.json({ error: 'Engine not found' }, { status: 404 })
  }

  // For OPENING phase, use existing populateOpeningPositions
  // For other phases, return error until Phase 2 implementation
  if (phase === 'OPENING') {
    const result = await populateOpeningPositions({
      engineId,
      engineUrl: engine.engineUrl,
      engineName: engine.name,
      domain: engine.domain,
      enabled: true,
      configId: '',
    })
    return Response.json({ fetched: result.populated, errors: result.errors })
  }

  // Phase 2: EARLY, MIDDLE, BEAROFF
  return Response.json({
    error: `Position fetching for ${phase} phase is not yet implemented`,
  }, { status: 501 })
}
```

### Code Structure

```
lib/
├── guruFunctions/
│   ├── types.ts                    # Add DrillGenerationConfig
│   ├── generators/
│   │   └── drillDesigner.ts        # Accept drillConfig parameter
│   └── prompts/
│       └── drillDesignerPrompt.ts  # Add buildDrillConfigSection()
├── positionLibrary/
│   ├── seeder.ts                   # Add phase filtering, count limiting
│   └── index.ts                    # Export new functions

app/
├── api/
│   ├── position-library/
│   │   ├── counts/
│   │   │   └── route.ts            # NEW: Position count endpoint
│   │   └── fetch/
│   │       └── route.ts            # NEW: Trigger position fetching
│   └── projects/[id]/guru/
│       └── drill-series/
│           └── route.ts            # Extend schema with drillConfig

components/
├── guru/
│   ├── DrillConfigurationPanel.tsx # NEW: Main config UI (includes position counts inline)
│   └── GuruTeachingManager.tsx     # Integrate config panel
```

### Prompt Engineering Changes

#### New Config Section (drillDesignerPrompt.ts)

```typescript
function buildDrillConfigSection(config: DrillGenerationConfig): string {
  const directCount = Math.round(config.targetDrillCount * config.directDrillRatio)
  const principleCount = config.targetDrillCount - directCount

  return `
---

## DRILL GENERATION REQUIREMENTS (MANDATORY)

**CRITICAL: You MUST follow these exact requirements. Generation will be rejected if not met.**

### Drill Count
- Generate EXACTLY ${config.targetDrillCount} drills total
- Do NOT generate fewer or more drills

### Drill Type Distribution
- **Direct Drills (${directCount})**: Ask "What is the best move?"
  - Tests move recall and execution
  - Correct answer is the engine-verified best move
  - Feedback explains WHY it's best

- **Principle-Focused Drills (${principleCount})**: Ask "Which principle applies here?"
  - Tests understanding of WHY moves are good
  - Still uses a board position as the scenario
  - Options are principles, not moves
  - Feedback connects the position to the principle

### Game Phases Included
- Only use positions from these phases: ${config.gamePhases.join(', ')}

---
`
}
```

#### Position Injection Enhancement

```typescript
function buildPositionsSection(
  seededPositions: SeededPositionsByPhase,
  config: DrillGenerationConfig
): string {
  // Filter positions by selected phases
  const selectedPositions = config.gamePhases.flatMap(
    phase => seededPositions[phase] || []
  )

  // Limit to target count
  const limitedPositions = selectedPositions.slice(0, config.targetDrillCount)

  return `
---

## POSITIONS TO USE (${limitedPositions.length} total)

${limitedPositions.map((p, i) => formatPositionForPrompt(p, i)).join('\n')}

**IMPORTANT**: Create ONE drill for EACH position listed above.

---
`
}
```

### Inngest Job Changes

```typescript
// lib/inngest-functions.ts - drillSeriesGenerationJob

// In step 'seed-positions':
const seededPositions = await step.run('seed-positions', async () => {
  const gtConfig = await resolveGroundTruthConfig(projectId)
  if (!gtConfig?.enabled) return null

  // Apply phase filter from config
  const positions = await seedPositionsByPhase(
    gtConfig.engineId,
    drillConfig?.gamePhases  // NEW: Pass phase filter
  )

  // Limit positions to target count
  if (drillConfig?.targetDrillCount && positions) {
    const allPositions = [
      ...positions.OPENING,
      ...positions.EARLY,
      ...positions.MIDDLE,
      ...positions.BEAROFF,
    ]
    const limited = allPositions.slice(0, drillConfig.targetDrillCount)
    // Redistribute back to phases...
  }

  return positions
})

// In step 'generate-drill-series':
result = await step.run('generate-drill-series', async () => {
  return await generateDrillSeries({
    // ... existing params
    drillConfig,  // NEW: Pass config to generator
  })
})

// NEW: Post-generation validation step
await step.run('validate-drill-count', async () => {
  const drillCount = result.content.series.reduce(
    (sum, s) => sum + s.drills.length, 0
  )

  if (drillConfig?.targetDrillCount &&
      drillCount < drillConfig.targetDrillCount * 0.9) {
    // Log warning but don't fail - GPT compliance varies
    console.warn(`Generated ${drillCount} drills, target was ${drillConfig.targetDrillCount}`)
  }
})
```

### UI Component Design

#### DrillConfigurationPanel

```tsx
// components/guru/DrillConfigurationPanel.tsx

interface DrillConfigurationPanelProps {
  projectId: string
  engineId: string | null
  onGenerate: (config: DrillGenerationConfig) => void
  isGenerating: boolean
}

export function DrillConfigurationPanel({
  projectId,
  engineId,
  onGenerate,
  isGenerating,
}: DrillConfigurationPanelProps) {
  // Fetch position counts
  const { data: counts, mutate: refreshCounts } = useSWR(
    engineId ? `/api/position-library/counts?engineId=${engineId}` : null
  )

  // Config state
  const [phases, setPhases] = useState<GamePhase[]>(['OPENING'])
  const [drillCount, setDrillCount] = useState(21)
  const [directRatio, setDirectRatio] = useState(0.7)

  // Fetch positions state
  const [fetchingPhase, setFetchingPhase] = useState<GamePhase | null>(null)
  const [fetchCount, setFetchCount] = useState(10)

  // Calculate available positions for selected phases
  const availablePositions = phases.reduce(
    (sum, phase) => sum + (counts?.[phase] ?? 0), 0
  )

  // Handle fetching new positions for a phase
  async function handleFetchPositions(phase: GamePhase) {
    setFetchingPhase(phase)
    try {
      await fetch('/api/position-library/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          phase,
          count: fetchCount
        })
      })
      refreshCounts() // Refresh counts after fetching
    } finally {
      setFetchingPhase(null)
    }
  }

  return (
    <div className="space-y-6 p-4 border rounded-lg">
      <h3 className="font-semibold">Drill Configuration</h3>

      {/* Phase Selection with Position Counts */}
      <div>
        <Label>Game Phases</Label>
        <div className="space-y-2 mt-2">
          {(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as const).map(phase => {
            const phaseCount = counts?.[phase] ?? 0
            const isSelected = phases.includes(phase)

            return (
              <div key={phase} className="flex items-center justify-between">
                <Badge
                  variant={isSelected ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => togglePhase(phase)}
                >
                  {phase} ({phaseCount})
                </Badge>

                {/* Fetch Positions button for phases with 0 positions */}
                {phaseCount === 0 && engineId && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={fetchCount.toString()}
                      onValueChange={(v) => setFetchCount(parseInt(v))}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50].map(n => (
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
                      {fetchingPhase === phase ? 'Fetching...' : 'Fetch Positions'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Drill Count */}
      <div>
        <Label>Target Drill Count: {drillCount}</Label>
        <Slider
          value={[drillCount]}
          onValueChange={([v]) => setDrillCount(v)}
          min={5}
          max={Math.min(50, Math.max(5, availablePositions))}
          step={1}
          className="mt-2"
        />
        <p className="text-sm text-muted-foreground mt-1">
          {availablePositions} positions available for selected phases
        </p>
      </div>

      {/* Drill Type Mix */}
      <div>
        <Label>Drill Type Mix</Label>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm">Direct ({Math.round(directRatio * 100)}%)</span>
          <Slider
            value={[directRatio * 100]}
            onValueChange={([v]) => setDirectRatio(v / 100)}
            min={0}
            max={100}
            step={10}
            className="flex-1"
          />
          <span className="text-sm">Principle ({Math.round((1 - directRatio) * 100)}%)</span>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={() => onGenerate({
          gamePhases: phases,
          targetDrillCount: drillCount,
          directDrillRatio: directRatio,
          useExistingPositions: true,
        })}
        disabled={isGenerating || availablePositions === 0}
        className="w-full"
      >
        {isGenerating ? 'Generating...' : `Generate ${drillCount} Drills`}
      </Button>
    </div>
  )
}
```

---

## User Experience

### User Journey

1. **Access**: User navigates to project page, sees "Teaching Artifacts" section
2. **Trigger**: User clicks "Generate" on Drill Series card
3. **Configure**: Modal shows DrillConfigurationPanel with:
   - Phase selector showing position counts
   - Drill count slider (defaults to available positions)
   - Type mix slider (defaults to 70% direct)
4. **Generate**: User clicks "Generate N Drills"
5. **Progress**: Progress tracker shows generation status
6. **Result**: Drill series with exact configuration is displayed

### Error States

| State | User Feedback |
|-------|---------------|
| No positions for phase | Badge shows "0", phase disabled |
| Engine unavailable | "Position fetching unavailable" message |
| Generation fails | Error toast with retry option |
| Count mismatch | Warning badge "Generated X of Y requested" |

### Empty State

When no positions exist for selected phases:
```
No positions available for selected phases.
[Fetch Opening Positions] ← Only shown if ground truth enabled
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/drillConfig.test.ts

describe('buildDrillConfigSection', () => {
  it('calculates correct drill type counts', () => {
    const config = { targetDrillCount: 20, directDrillRatio: 0.7 }
    const section = buildDrillConfigSection(config)
    expect(section).toContain('Direct Drills (14)')
    expect(section).toContain('Principle-Focused Drills (6)')
  })

  it('includes all selected phases', () => {
    const config = { gamePhases: ['OPENING', 'EARLY'] }
    const section = buildDrillConfigSection(config)
    expect(section).toContain('OPENING, EARLY')
  })
})

describe('seedPositionsByPhase with filter', () => {
  it('returns only positions for selected phases', async () => {
    const positions = await seedPositionsByPhase(engineId, ['OPENING'])
    expect(positions.EARLY).toHaveLength(0)
    expect(positions.OPENING.length).toBeGreaterThan(0)
  })

  it('respects count limit', async () => {
    const positions = await seedPositionsByPhase(engineId, ['OPENING'], 5)
    const total = positions.OPENING.length
    expect(total).toBeLessThanOrEqual(5)
  })
})
```

### Integration Tests

```typescript
// __tests__/drillGeneration.integration.test.ts

describe('Drill Generation API', () => {
  it('accepts drill configuration parameters', async () => {
    const response = await fetch('/api/projects/xxx/guru/drill-series', {
      method: 'POST',
      body: JSON.stringify({
        drillConfig: {
          gamePhases: ['OPENING'],
          targetDrillCount: 10,
          directDrillRatio: 0.8,
        }
      })
    })
    expect(response.ok).toBe(true)
  })

  it('rejects invalid drill count', async () => {
    const response = await fetch('/api/projects/xxx/guru/drill-series', {
      method: 'POST',
      body: JSON.stringify({
        drillConfig: { targetDrillCount: 100 } // Over max
      })
    })
    expect(response.status).toBe(400)
  })
})
```

### E2E Tests

```typescript
// tests/drill-configuration.spec.ts

test('user can configure and generate drills', async ({ page }) => {
  await page.goto('/projects/test-project')

  // Open drill generation
  await page.click('[data-testid="generate-drills-button"]')

  // Configure
  await page.click('[data-testid="phase-OPENING"]')
  await page.fill('[data-testid="drill-count-input"]', '15')
  await page.locator('[data-testid="type-mix-slider"]').fill('60')

  // Generate
  await page.click('[data-testid="generate-button"]')

  // Wait for completion
  await expect(page.locator('[data-testid="drill-series-status"]'))
    .toHaveText('COMPLETED', { timeout: 120000 })

  // Verify count (approximate due to GPT variance)
  const drillCount = await page.locator('[data-testid="drill-item"]').count()
  expect(drillCount).toBeGreaterThanOrEqual(12) // 80% of 15
})
```

---

## Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Position count query | Add database index on `(engineId, gamePhase)` |
| Large prompt size | 50 positions ≈ 15K tokens, within GPT-4o context |
| Generation time | Already async via Inngest, no change |
| Position fetching | User-initiated, shows progress indicator |

### Token Budget Analysis

```
Base prompt:           ~8,000 tokens
50 positions:         ~15,000 tokens
Mental model:          ~2,000 tokens
Curriculum:            ~3,000 tokens
─────────────────────────────────
Total input:          ~28,000 tokens (within 128K context)

50 drills output:     ~30,000 tokens (within output limits)
```

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Unauthorized position fetching | Requires project ownership + ground truth enabled |
| Invalid config injection | Zod schema validation before processing |
| Rate limiting | Existing API rate limits apply |
| Resource exhaustion | Max 50 drills, max 50 position fetch |

---

## Documentation Updates

1. **CLAUDE.md**: Add "Drill Configuration" section under "Position Library" documentation
2. **Developer Guide**: Document DrillGenerationConfig type and prompt injection pattern
3. **API Reference**: Update drill-series endpoint documentation with new parameters

---

## Implementation Phases

### Phase 1: Core Configuration (MVP)

**Goal**: Complete configuration UI with position fetching for all phases

1. Add `DrillGenerationConfig` type
2. Extend API schema with `drillConfig` parameter
3. Create `buildDrillConfigSection()` prompt function
4. Pass config through Inngest job
5. Create `DrillConfigurationPanel` component (with inline position counts)
6. Add position counts API endpoint (`/api/position-library/counts`)
7. Add position fetch API endpoint (`/api/position-library/fetch`)
8. Integrate panel into GuruTeachingManager
9. Show "Fetch Positions" button + count selector for phases with 0 positions

**Deliverables**:
- Users can set target drill count
- Users can set type mix ratio
- Phase selector shows all phases with counts
- Users can fetch positions for empty phases (with count selector)
- Position library grows over time as users fetch

### Phase 2: Enhanced Position Management

**Goal**: Multi-phase position generation (beyond OPENING)

1. Implement XGID-based position queries for EARLY/MIDDLE phases
2. Implement bearoff position generation
3. Add position cache warming on project load
4. Prepare seeder for non-OPENING phases

**Deliverables**:
- EARLY/MIDDLE/BEAROFF position fetching works
- Infrastructure ready for full game coverage

### Phase 3: Multi-Phase Support (Future)

**Goal**: Enable EARLY, MIDDLE, BEAROFF phases

1. Implement XGID-based position queries for midgame
2. Implement bearoff position generation
3. Add match context (score-based) positions
4. Enable multi-phase selection in UI

**Deliverables**:
- Full game phase coverage
- Rich position variety

---

## Open Questions

1. **Position reuse**: If targetDrillCount > availablePositions, should we reuse positions with different drill types, or cap at available count?
   - **Decision**: Cap at available, show warning

2. **Default ratio**: Is 70/30 direct/principle the right default?
   - **Decision**: Start with 70/30, gather user feedback

3. **Config persistence**: Should drill config be saved per-project as defaults?
   - **Decision**: Phase 2 - start with session-only

4. **Regeneration**: When regenerating, should previous config be remembered?
   - **Decision**: Yes, pre-populate from last generation

5. **Empty phase handling**: What should happen when a phase has 0 positions?
   - **Decision**: Show a prominent "Fetch Positions" button with count selector (e.g., "Fetch 10 positions from engine")

---

## References

### Related Specs
- `specs/scenario-based-drill-position-seeding/` - Position Library architecture
- `specs/feat-ground-truth-content-validation/` - Ground truth integration

### Key Files
- `lib/guruFunctions/prompts/drillDesignerPrompt.ts` - Prompt construction
- `lib/guruFunctions/generators/drillDesigner.ts` - Generation logic
- `lib/positionLibrary/seeder.ts` - Position seeding
- `lib/inngest-functions.ts:720-960` - Drill generation job
- `app/api/projects/[id]/guru/drill-series/route.ts` - API endpoint
- `components/guru/GuruTeachingManager.tsx` - UI integration point

### Existing Patterns
- Prompt customization: `lib/teaching/promptUtils.ts`
- Configuration modals: `components/guru/PromptEditorModal.tsx`
- Ground truth config: `lib/groundTruth/config.ts`

---

## Validation Checklist

- [x] Problem statement is specific and measurable
- [x] Technical requirements reference existing code
- [x] Implementation approach is technically sound
- [x] Testing strategy covers unit, integration, E2E
- [x] All 17 sections meaningfully filled
- [x] No contradictions between sections
- [x] Someone could build this from the spec
- [x] Open questions resolved with decisions
- [x] Position fetching included in Phase 1

**Quality Score**: 9/10

**Confidence Level**: High - architecture is well-understood, existing patterns available

**Last Updated**: 2025-12-15 (incorporated user feedback on Phase 1 scope)
