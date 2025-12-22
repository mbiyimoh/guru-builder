# Ideation: Optimize Drill Generation

## Section 1: Intent & Assumptions

### What We're Building
Two optimizations to the drill series generation system:

1. **Dynamic Position Loading**: Instead of loading a fixed maximum of 96 positions (~27k tokens), calculate the minimum positions needed based on `targetDrillCount ÷ selectedPhases`. If user requests 20 drills across 2 phases, only load ~10 positions per phase (20 total + small buffer).

2. **Batched/Incremental Generation**: Instead of generating all drills in a single long GPT call that can fail and "corrupt" the entire artifact, generate drills in smaller batches that are individually resilient to failures.

### Why We're Building It
- **Token efficiency**: Currently loading 96 positions when user might only need 10-20 for their requested drill count wastes tokens and increases costs
- **Reliability**: Single monolithic generation can timeout (10 min limit) or fail, losing all progress
- **User experience**: Faster generation with visible incremental progress
- **Cost optimization**: Smaller prompts = lower API costs

### Assumptions
- Users typically request 10-30 drills per generation
- Position data is ~500 chars per position (~125 tokens)
- GPT-4o has practical limits around 30k tokens for input
- Inngest supports fan-out patterns with multiple events

---

## Section 2: Current State Analysis

### Current Flow
```
User triggers "Generate Drills"
    ↓
Inngest Job: drillSeriesGenerationJob
    ↓
Step 1: Load prerequisites (mental model, curriculum, profile)
    ↓
Step 2: Seed ALL positions (up to 96)
    ↓
Step 3-5: Progress updates
    ↓
Step 6: SINGLE GPT call with all positions → generates ALL drills
    ↓
Step 7: Verify claims (if ground truth enabled)
    ↓
Step 8: Save artifact
    ↓
Step 9: Populate Drill table
```

### Problems
1. Step 2 loads way more positions than needed
2. Step 6 is a single point of failure - if it times out, everything is lost
3. No incremental progress saving - partial results are discarded on failure

---

## Section 3: Codebase Map

### Primary Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `lib/inngest-functions.ts:850-1079` | Drill series generation job | Add dynamic position calculation, implement batching |
| `lib/positionLibrary/seeder.ts` | Position seeding | Add random sampling, accept calculated limit |
| `lib/guruFunctions/generators/drillDesigner.ts` | Drill generation | Support batch generation mode |
| `lib/guruFunctions/prompts/drillDesignerPrompt.ts` | Prompt building | Build smaller prompts for batches |
| `lib/drills/sync.ts` | Drill table sync | Support incremental writes |

### Supporting Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `lib/guruFunctions/types.ts` | DrillGenerationConfig | Already has `targetDrillCount` and `gamePhases` |
| `lib/guruFunctions/schemas/drillSeriesSchema.ts` | Output schema | May need batch-compatible variant |
| `app/api/projects/[id]/guru/drill-series/route.ts` | API endpoint | No changes needed |

### Existing Patterns to Leverage

| Pattern | Location | How to Use |
|---------|----------|------------|
| Batching with events | `inngest-functions.ts:1537-1555` | Fan-out pattern for parallel batch generation |
| Drill table sync | `lib/drills/sync.ts` | Already supports incremental writes |
| Position seeding | `lib/positionLibrary/seeder.ts` | Already accepts `maxPositionsPerPhase` parameter |

---

## Section 4: Root Cause Analysis

### Problem 1: Over-fetching Positions
- **Root cause**: `maxPositionsPerPhase` defaults to 25, applied regardless of `targetDrillCount`
- **Impact**: 96 positions loaded when user might only need 10-20
- **Fix complexity**: Low - simple calculation at call site

### Problem 2: Monolithic Generation
- **Root cause**: Architectural decision to generate all drills in single GPT call
- **Impact**: Timeout failures lose all work, no partial recovery
- **Fix complexity**: Medium-High - requires restructuring generation flow

---

## Section 5: Research Findings & Recommended Approach

### Phase 1: Dynamic Position Loading (Quick Win)

**Recommended approach:**
```typescript
// Calculate positions needed per phase
const phasesCount = drillConfig?.gamePhases?.length ?? 1;
const targetDrills = drillConfig?.targetDrillCount ?? 21;
const positionsPerPhase = Math.ceil(targetDrills / phasesCount) + 2; // +2 buffer for variety

// Cap at reasonable max to prevent abuse
const dynamicLimit = Math.min(positionsPerPhase, 25);

const positions = await seedPositionsByPhase(
  gtConfig.engineId,
  drillConfig?.gamePhases,
  dynamicLimit
);
```

**Benefits:**
- 20 drills across 2 phases → 12 positions per phase → 24 total (vs 96 currently)
- Token savings: ~75% reduction in position tokens
- Implementation time: ~30 minutes

**Additional improvement - Random sampling:**
Currently positions are ordered by `createdAt DESC`. For variety, should randomly sample from available positions.

### Phase 2: Batched Generation (Larger Effort)

**Two viable approaches:**

#### Option A: Sequential Batches in Same Job
```
For each batch (5-10 drills):
    1. Build prompt with subset of positions
    2. Generate batch of drills
    3. Save drills to Drill table immediately
    4. On failure: log error, continue with next batch
    5. At end: reconstruct artifact JSON from Drill table
```

**Pros:**
- Simpler implementation
- Single job to monitor
- Shared context across batches

**Cons:**
- Still single point of timeout risk (though mitigated)
- Sequential execution (slower total time)

#### Option B: Fan-out with Inngest Events (Recommended)
```
Parent job:
    1. Load prerequisites
    2. Calculate batches (e.g., 5 drills per batch)
    3. Dispatch N "drill-series/generate-batch" events
    4. Wait for all batches (or use step.waitForEvent)

Batch job:
    1. Receive batch config (positions subset, drill indices)
    2. Generate 5 drills
    3. Write directly to Drill table
    4. Report completion

Parent job (continuation):
    1. Reconstruct artifact JSON from Drill table
    2. Run verification
    3. Mark complete
```

**Pros:**
- True isolation - batch failures don't affect others
- Parallel execution possible (faster total time)
- Individual batch retries
- Incremental progress visible in UI

**Cons:**
- More complex orchestration
- Need to handle batch coordination
- Potential for consistency issues if batches reference each other

**Recommendation:** Option B for maximum resilience, but Option A is acceptable MVP.

---

## Section 6: Clarifications Needed

1. **Batch Size**: How many drills per batch?
   - Option A: 1 drill per batch (maximum isolation, most overhead)
   - Option B: 5 drills per batch (balanced)
   - Option C: 10 drills per batch (fewer API calls, less isolation)
   - Recommendation: Option B (5 drills)

2. **Failure Handling**: What happens if some batches fail?
   - Option A: Fail entire generation if any batch fails
   - Option B: Continue with successful batches, mark artifact as partial
   - Option C: Retry failed batches up to N times, then continue
   - Recommendation: Option C (retry then continue)

3. **Cross-Drill Coherence**: Should batches share context about other drills?
   - Option A: No sharing - each batch independent
   - Option B: Pass summary of generated drills to subsequent batches
   - Option C: Generate drill "skeleton" first, then fill in batches
   - Recommendation: Option A for simplicity (drills are already principle-grouped)

4. **Position Sampling**: Should positions be randomly sampled or ordered?
   - Option A: Keep current ordering (createdAt DESC)
   - Option B: Random sampling from available positions
   - Recommendation: Option B for variety

5. **Progress Granularity**: How should UI show batch progress?
   - Option A: Single "Generating..." status
   - Option B: "Generating batch 3/5..."
   - Option C: "Generated 15/25 drills..."
   - Recommendation: Option C for best UX

---

## Section 7: Implementation Phases

### Phase 1: Dynamic Position Loading
- Estimated effort: 30 minutes
- Files: `lib/inngest-functions.ts`
- Risk: Low
- Dependencies: None

### Phase 2: Batched Generation
- Estimated effort: 4-6 hours
- Files: Multiple (see Section 3)
- Risk: Medium
- Dependencies: Phase 1

---

## Section 8: Success Criteria

### Phase 1
- [ ] Position count dynamically calculated from `targetDrillCount / phases`
- [ ] Token usage reduced by 50%+ for typical requests
- [ ] No regression in drill quality

### Phase 2
- [ ] Drills generated in configurable batch sizes
- [ ] Failed batches don't corrupt successful batches
- [ ] UI shows granular progress
- [ ] Total generation time comparable or better
- [ ] Artifact reconstructable from Drill table records
