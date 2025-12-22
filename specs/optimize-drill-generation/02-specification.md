# Specification: Optimize Drill Generation

## Overview

This specification covers two optimizations to the drill series generation system:

1. **Phase 1: Dynamic Position Loading** - Calculate minimum positions needed based on `targetDrillCount / selectedPhases` instead of loading a fixed maximum
2. **Phase 2: Batched Incremental Generation** - Generate drills in smaller batches (5 at a time) that are individually resilient to failures

## User Decisions

Based on interactive clarification, the following decisions guide this implementation:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Batch Size | 5 drills per batch | Balance between isolation and API overhead |
| Failure Handling | Retry up to 3 times, then continue | Resilient without blocking entire generation |
| Cross-batch Coherence | Independent batches | Drills are already principle-grouped; simpler implementation |
| Position Sampling | Random selection | Provides variety across regenerations |
| Progress UI | Show "Generated X/Y drills..." | Best UX for incremental feedback |

---

## Phase 1: Dynamic Position Loading

### Goal
Reduce token usage by loading only the positions needed for the requested drill count, instead of a fixed maximum of 96 positions.

### Current Behavior
```typescript
// lib/inngest-functions.ts:866-870
const positions = await seedPositionsByPhase(
  gtConfig.engineId,
  drillConfig?.gamePhases,
  drillConfig?.maxPositionsPerPhase  // Defaults to 25 if not specified
);
```

With default settings (25 per phase × 4 phases = 100 max, capped at 96), this loads ~27k tokens of position data regardless of whether the user requests 10 drills or 50.

### Proposed Change

Calculate `maxPositionsPerPhase` dynamically based on the drill request:

```typescript
// Calculate positions needed per phase
const phasesCount = drillConfig?.gamePhases?.length ?? 1;
const targetDrills = drillConfig?.targetDrillCount ?? 21;
const positionsPerPhase = Math.ceil(targetDrills / phasesCount) + 2; // +2 buffer for variety

// Cap at reasonable limits
const dynamicLimit = Math.min(
  positionsPerPhase,
  drillConfig?.maxPositionsPerPhase ?? 25
);

const positions = await seedPositionsByPhase(
  gtConfig.engineId,
  drillConfig?.gamePhases,
  dynamicLimit
);
```

### Token Savings Examples

| Request | Current | Optimized | Savings |
|---------|---------|-----------|---------|
| 20 drills, 2 phases | 96 positions (~27k tokens) | 24 positions (~6.8k tokens) | 75% |
| 10 drills, 1 phase | 25 positions (~7k tokens) | 12 positions (~3.4k tokens) | 51% |
| 30 drills, 3 phases | 96 positions (~27k tokens) | 36 positions (~10k tokens) | 63% |

### Files to Modify

| File | Change |
|------|--------|
| `lib/inngest-functions.ts:858-879` | Add dynamic calculation before `seedPositionsByPhase` call |

### Random Sampling Enhancement

Currently, positions are ordered by `createdAt DESC`. Add random sampling for variety:

```typescript
// lib/positionLibrary/seeder.ts - In seedPositionsForPhase
const positions = await prisma.positionLibrary.findMany({
  where: { engineId, gamePhase: phase },
  // Remove orderBy for non-OPENING phases to enable random sampling
  orderBy: phase === 'OPENING' ? { diceRoll: 'asc' } : undefined,
  take: limit
});

// For non-OPENING phases, shuffle results
if (phase !== 'OPENING') {
  return shuffleArray(positions.map(p => formatPosition(p)));
}
```

### Success Criteria

- [ ] Position count calculated from `Math.ceil(targetDrillCount / phasesCount) + 2`
- [ ] Token usage reduced by 50%+ for typical requests (10-30 drills)
- [ ] No regression in drill quality
- [ ] Random sampling provides variety across regenerations
- [ ] OPENING phase always returns all 21 positions (no shuffling)

---

## Phase 2: Batched Incremental Generation

### Goal
Generate drills in smaller batches (5 drills per batch) to:
- Prevent timeouts from failing the entire generation
- Enable incremental progress visibility
- Allow partial completion on failures

### Architecture: Fan-out with Inngest Events

```
drillSeriesGenerationJob (Parent)
    ├── Load prerequisites (mental model, curriculum, profile)
    ├── Calculate batches (ceil(targetDrills / 5))
    ├── Dispatch N "drill-series/generate-batch" events
    └── Wait for completion (via step.waitForEvent or polling)

drillBatchGenerationJob (Child - runs in parallel)
    ├── Receive: batchIndex, positionSubset, drillIndices, context
    ├── Generate 5 drills
    ├── Write directly to Drill table
    └── Report completion (emit drill-series/batch-completed)

drillSeriesGenerationJob (Continuation)
    ├── Reconstruct artifact JSON from Drill table
    ├── Run verification (if enabled)
    └── Mark complete
```

### Database Changes

Add batch tracking fields to `Drill` model:

```prisma
model Drill {
  // ... existing fields
  batchIndex      Int?      // Which batch generated this drill
  batchStatus     String?   // PENDING, GENERATING, COMPLETED, FAILED
}
```

Add batch tracking to `GuruArtifact`:

```prisma
model GuruArtifact {
  // ... existing fields
  batchProgress   Json?     // { completed: number, total: number, failed: number[] }
}
```

### Event Definitions

#### Parent → Child (Dispatch)
```typescript
{
  name: 'drill-series/generate-batch',
  data: {
    artifactId: string;
    projectId: string;
    batchIndex: number;
    totalBatches: number;
    drillIndices: number[];  // e.g., [0, 1, 2, 3, 4] for batch 0
    positions: SeededPosition[];  // Subset of positions for this batch
    context: {
      mentalModel: MentalModelOutput;
      curriculum: CurriculumOutput;
      guruProfile?: GuruProfileOutput;
      prompts: { systemPrompt: string; userPromptTemplate: string };
    };
  }
}
```

#### Child → Parent (Completion)
```typescript
{
  name: 'drill-series/batch-completed',
  data: {
    artifactId: string;
    batchIndex: number;
    success: boolean;
    drillsGenerated: number;
    error?: string;
    retryCount: number;
  }
}
```

### Batch Job Implementation

```typescript
export const drillBatchGenerationJob = inngest.createFunction(
  {
    id: 'drill-batch-generation',
    name: 'Generate Drill Batch',
    retries: 3,  // Built-in retry with exponential backoff
  },
  { event: 'drill-series/generate-batch' },
  async ({ event, step }) => {
    const { artifactId, batchIndex, drillIndices, positions, context } = event.data;

    try {
      // Generate batch of drills
      const drills = await step.run('generate-batch', async () => {
        return await generateDrillBatch({
          positions,
          drillIndices,
          ...context,
        });
      });

      // Write directly to Drill table
      await step.run('save-drills', async () => {
        await prisma.drill.createMany({
          data: drills.map((drill, i) => ({
            artifactId,
            index: drillIndices[i],
            batchIndex,
            batchStatus: 'COMPLETED',
            ...drill,
          })),
        });
      });

      // Update artifact batch progress
      await step.run('update-progress', async () => {
        await updateBatchProgress(artifactId, batchIndex, 'COMPLETED');
      });

      // Emit completion event
      await step.sendEvent('batch-completed', {
        name: 'drill-series/batch-completed',
        data: {
          artifactId,
          batchIndex,
          success: true,
          drillsGenerated: drills.length,
          retryCount: 0,
        },
      });

      return { success: true };
    } catch (error) {
      // Mark batch as failed after retries exhausted
      await step.run('mark-failed', async () => {
        await updateBatchProgress(artifactId, batchIndex, 'FAILED');
      });

      await step.sendEvent('batch-failed', {
        name: 'drill-series/batch-completed',
        data: {
          artifactId,
          batchIndex,
          success: false,
          drillsGenerated: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: 3,
        },
      });

      // Don't throw - let parent handle partial completion
      return { success: false, error };
    }
  }
);
```

### Parent Job Modifications

```typescript
// In drillSeriesGenerationJob, replace single generation step:

// Calculate batches
const batches = await step.run('calculate-batches', async () => {
  const targetDrills = drillConfig?.targetDrillCount ?? 21;
  const batchSize = 5;
  const batchCount = Math.ceil(targetDrills / batchSize);

  return Array.from({ length: batchCount }, (_, i) => ({
    batchIndex: i,
    drillIndices: Array.from(
      { length: Math.min(batchSize, targetDrills - i * batchSize) },
      (_, j) => i * batchSize + j
    ),
    positions: distributePositions(seededPositions, i, batchCount),
  }));
});

// Dispatch all batch events
await step.run('dispatch-batches', async () => {
  const events = batches.map(batch => ({
    name: 'drill-series/generate-batch' as const,
    data: {
      artifactId,
      projectId,
      batchIndex: batch.batchIndex,
      totalBatches: batches.length,
      drillIndices: batch.drillIndices,
      positions: batch.positions,
      context: {
        mentalModel: mentalModelArtifact.content,
        curriculum: curriculumArtifact.content,
        guruProfile,
        prompts,
      },
    },
  }));

  await inngest.send(events);
});

// Initialize batch tracking
await step.run('init-batch-progress', async () => {
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: {
      batchProgress: {
        completed: 0,
        total: batches.length,
        failed: [],
      },
    },
  });
});

// Wait for all batches (with timeout)
const batchResults = await step.waitForEvent('wait-for-batches', {
  event: 'drill-series/batch-completed',
  match: 'data.artifactId',
  timeout: '8m',  // Leave 2 min buffer before Inngest timeout
  count: batches.length,
});

// Analyze results
const successfulBatches = batchResults.filter(r => r.data.success).length;
const failedBatches = batchResults.filter(r => !r.data.success);

if (failedBatches.length > 0) {
  console.warn(
    `[Drill Series ${artifactId}] ${failedBatches.length}/${batches.length} batches failed`
  );
}

// Reconstruct artifact from Drill table
const drills = await step.run('reconstruct-artifact', async () => {
  return await prisma.drill.findMany({
    where: { artifactId, batchStatus: 'COMPLETED' },
    orderBy: { index: 'asc' },
  });
});

// Continue with verification and save...
```

### Progress Tracking

Update `updateArtifactProgress` to support granular drill counts:

```typescript
// New sub-task progress format for batched generation
interface BatchSubTaskProgress {
  phase: 'GENERATING_CONTENT';
  current: number;  // Drills generated so far
  total: number;    // Total drills requested
  currentBatch: number;
  totalBatches: number;
}

// UI displays: "Generated 15/25 drills (Batch 3/5)"
```

### Files to Modify

| File | Change |
|------|--------|
| `lib/inngest-functions.ts` | Add `drillBatchGenerationJob`, modify parent job for fan-out |
| `lib/inngest.ts` | Register new event types and batch job |
| `lib/guruFunctions/generators/drillDesigner.ts` | Add `generateDrillBatch()` function for smaller batches |
| `lib/drills/sync.ts` | Support incremental writes from batch jobs |
| `prisma/schema.prisma` | Add `batchIndex`, `batchStatus` to Drill model |
| `lib/teaching/constants.ts` | Add batch-related progress phases |

### Prompt Modifications for Batched Generation

The batch prompt should:
- Include only the subset of positions assigned to this batch
- Request exactly `drillIndices.length` drills (e.g., 5)
- Not reference drills from other batches (independent generation)

```typescript
// In drillDesignerPrompt.ts, add batch variant
export function buildBatchDrillPrompt(
  options: DrillBatchOptions
): { systemPrompt: string; userPrompt: string } {
  // ... build prompt for batch of 5 drills
  // Include: curriculum context, mental model summary, positions subset
  // Exclude: references to other batches, full position library
}
```

### Error Handling

| Scenario | Handling |
|----------|----------|
| Batch times out | Inngest retries up to 3 times automatically |
| All retries fail | Mark batch as FAILED, continue with others |
| Partial completion | Artifact marked COMPLETED with warning |
| All batches fail | Artifact marked FAILED |

### Success Criteria

- [ ] Drills generated in configurable batch sizes (default: 5)
- [ ] Failed batches don't corrupt successful batches
- [ ] UI shows granular progress: "Generated X/Y drills (Batch A/B)"
- [ ] Total generation time comparable or better than current
- [ ] Artifact reconstructable from Drill table records
- [ ] Verification runs on fully reconstructed artifact

---

## Implementation Order

### Phase 1: Dynamic Position Loading (Effort: 1-2 hours)
1. Calculate dynamic limit in `inngest-functions.ts`
2. Add shuffle utility for random sampling
3. Modify `seedPositionsForPhase` to use random ordering for non-OPENING
4. Test with various drill count / phase combinations

### Phase 2: Batched Generation (Effort: 4-6 hours)
1. Add schema changes (batchIndex, batchStatus)
2. Create `drillBatchGenerationJob` function
3. Create `generateDrillBatch()` in drill designer
4. Modify parent job for fan-out pattern
5. Update progress tracking for batch visibility
6. Implement artifact reconstruction from Drill table
7. Test failure scenarios and partial completion

---

## Testing Plan

### Phase 1 Tests
- [ ] Dynamic limit calculation: 20 drills / 2 phases = 12 positions per phase
- [ ] Random sampling produces different positions across regenerations
- [ ] OPENING phase always returns all 21 positions (not shuffled)
- [ ] Token count reduced in logs

### Phase 2 Tests
- [ ] 25 drills → 5 batches of 5 drills each
- [ ] Single batch failure → other 4 complete successfully
- [ ] All batches timeout → artifact marked FAILED
- [ ] Progress shows "Generated 10/25 drills" incrementally
- [ ] Verification runs on reconstructed artifact
- [ ] Drill table correctly populated from batches

---

## Rollback Plan

### Phase 1
- Revert dynamic limit calculation
- Keep `maxPositionsPerPhase` defaulting to 25
- No database changes to revert

### Phase 2
- Feature flag: `ENABLE_BATCH_DRILL_GENERATION=false`
- If disabled, use original single-call generation
- Schema additions are additive (no data loss on rollback)
