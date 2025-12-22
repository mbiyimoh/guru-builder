# Drill Series Generation Developer Guide

**Created:** 2025-12-16
**Purpose:** Deep dive into the most complex teaching artifact generation

---

## Overview

Drill Series generation is the most technically complex part of the Teaching Pipeline:

1. **Dependencies**: Requires Curriculum artifact
2. **Position Seeding**: Uses Position Library for scenario-based exercises
3. **Ground Truth Verification**: Claims verified against external engine
4. **Dynamic Configuration**: Supports customizable drill count, phases, position limits

---

## Generation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DRILL SERIES GENERATION                          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   1. Load Curriculum   │
                    │   (dependency check)   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  2. Resolve Config     │
                    │  (drill count, phases) │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
    ┌─────────▼─────────┐       │       ┌─────────▼─────────┐
    │ 3a. Check Ground  │       │       │ 3b. Seed Positions │
    │     Truth Config  │       │       │   (if GT enabled)  │
    └─────────┬─────────┘       │       └─────────┬─────────┘
              │                 │                 │
              └─────────────────┼─────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   4. Generate Drills   │
                    │   (GPT-4o + positions) │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  5. Extract Claims     │
                    │  (if GT enabled)       │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  6. Verify Claims      │
                    │  (against GT engine)   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  7. Save Artifact +    │
                    │     Verification Status│
                    └───────────────────────┘
```

---

## Key Files

### Core Generation
- `lib/inngest-functions.ts:700-950` - Inngest job definition
- `lib/guruFunctions/generators/drillDesigner.ts` - Main generator
- `lib/guruFunctions/prompts/drillDesignerPrompt.ts` - Prompt construction
- `lib/guruFunctions/schemas/drillSeriesSchema.ts` - Zod schema

### Position Seeding
- `lib/positionLibrary/seeder.ts` - Position fetching and sampling
- `lib/positionLibrary/types.ts` - SeededPosition types
- `lib/positionLibrary/asciiRenderer.ts` - Board visualization

### Verification
- `lib/groundTruth/verification/` - Claim extraction and verification
- `lib/groundTruth/executor.ts` - Engine query execution

---

## Configuration

### DrillGenerationConfig

```typescript
// lib/guruFunctions/types.ts
export interface DrillGenerationConfig {
  /** Target number of drills to generate (default: 21) */
  targetDrillCount?: number;

  /** Game phases to include (default: all) */
  gamePhases?: GamePhase[];

  /** Max positions per non-OPENING phase (default: 25) */
  maxPositionsPerPhase?: number;
}

type GamePhase = 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF';
```

### Dynamic Position Calculation

Position limits are calculated dynamically to reduce token usage:

```typescript
// lib/inngest-functions.ts:865-884
const phasesCount = drillConfig?.gamePhases?.length ?? 1;
const targetDrills = drillConfig?.targetDrillCount ?? 21;
const positionsPerPhase = Math.ceil(targetDrills / phasesCount) + 2;
const dynamicLimit = Math.min(positionsPerPhase, drillConfig?.maxPositionsPerPhase ?? 25);
```

**Example:**
- 20 drills across 2 phases = ceil(20/2) + 2 = 12 positions per phase
- Compared to default 25, this saves ~50% in position tokens

---

## Position Seeding

### How It Works

1. **Fetch Positions**: Query Position Library for the configured phases
2. **Random Sampling**: Shuffle and take subset for variety
3. **Format for Prompt**: Convert to ASCII boards with analysis data
4. **Inject into Prompt**: Positions become scenario foundations for drills

### Position Seeding Code

```typescript
// lib/positionLibrary/seeder.ts
export async function seedPositionsForPhase(
  engineId: string,
  phase: GamePhase,
  maxPositionsPerPhase?: number
): Promise<SeededPosition[]> {
  // OPENING always gets all 21 positions (dice rolls)
  const limit = phase === 'OPENING' ? undefined : maxPositionsPerPhase ?? 25;

  // Fetch 2x for non-OPENING to enable random sampling
  const fetchLimit = phase === 'OPENING' ? undefined : (limit ? limit * 2 : undefined);

  const positions = await prisma.positionLibrary.findMany({
    where: { engineId, gamePhase: phase },
    orderBy: phase === 'OPENING' ? { diceRoll: 'asc' } : { createdAt: 'desc' },
    take: fetchLimit
  });

  // Shuffle for variety (except OPENING which preserves dice order)
  const positionsToProcess = phase === 'OPENING'
    ? positions
    : shuffleArray(positions).slice(0, limit);

  return positionsToProcess.map(p => ({
    positionId: p.positionId,
    diceRoll: p.diceRoll,
    bestMove: p.bestMove,
    bestMoveEquity: p.bestMoveEquity,
    alternatives: [...],
    asciiBoard: p.asciiBoard
  }));
}
```

### Seeded Position Format

```typescript
interface SeededPosition {
  positionId: string;          // Unique ID for tracking
  diceRoll: string;            // e.g., "6-5", "3-1"
  bestMove: string;            // e.g., "24/18 13/10"
  bestMoveEquity: number;      // e.g., 0.089
  bestMoveProbability?: number;
  alternatives: AlternativeMove[];
  asciiBoard: string;          // ASCII board representation
  metadata?: { name: string; description: string };
}
```

---

## Prompt Construction

### Prompt Sections

The drill designer prompt includes:

1. **Guru Profile** (if configured) - Personality and pedagogy
2. **Curriculum Context** - Learning objectives and modules
3. **Seeded Positions** - Scenario foundations with ASCII boards
4. **Generation Instructions** - How to create drills from positions

### Prompt Template

```typescript
// lib/guruFunctions/prompts/drillDesignerPrompt.ts
export function buildDrillDesignerPrompt(params: DrillDesignerPromptParams): string {
  const {
    domain,
    curriculum,
    seededPositions,
    drillConfig,
    guruProfile
  } = params;

  const guruSection = formatGuruProfileForPrompt(guruProfile);
  const positionsSection = formatPositionsForPrompt(seededPositions);

  return `
# TASK: Design Drill Series for ${domain}

${guruSection}

## CURRICULUM CONTEXT
${formatCurriculumContext(curriculum)}

## AVAILABLE POSITIONS
${positionsSection}

## GENERATION REQUIREMENTS
- Generate ${drillConfig?.targetDrillCount ?? 21} drills
- Focus on phases: ${drillConfig?.gamePhases?.join(', ') ?? 'All phases'}
- Each drill must reference a seeded position
- Include solution explanation and common mistakes
...
`;
}
```

---

## Ground Truth Verification

### When It Happens

Verification runs if:
1. Ground Truth is enabled for the project (`ProjectGroundTruthConfig.isEnabled`)
2. The ground truth engine is active and reachable

### Verification Flow

```typescript
// lib/inngest-functions.ts (simplified)
if (gtConfig?.enabled) {
  // Step: Extract claims from generated drills
  const claims = await step.run('extract-claims', async () => {
    return extractVerifiableClaimsFromDrills(result.data.drills);
  });

  // Step: Verify each claim
  const verificationResults = await step.run('verify-claims', async () => {
    const results = [];
    for (const claim of claims) {
      const verification = await verifyClaim(claim, gtConfig);
      results.push(verification);
    }
    return results;
  });

  // Calculate verification status
  const failedCount = verificationResults.filter(r => !r.passed).length;
  const status = failedCount === 0 ? 'VERIFIED'
    : failedCount / claims.length > 0.3 ? 'NEEDS_REVIEW'
    : 'VERIFIED';
}
```

### Claim Types

```typescript
interface VerifiableClaim {
  type: 'BEST_MOVE' | 'EQUITY_VALUE' | 'POSITION_EVALUATION';
  content: string;          // Human-readable claim
  extractedMove?: string;   // e.g., "24/18 13/10"
  extractedEquity?: number; // e.g., 0.089
  sourcePosition?: string;  // Position ID reference
}
```

### Verification Status

| Status | Meaning |
|--------|---------|
| `VERIFIED` | All claims passed verification |
| `NEEDS_REVIEW` | >30% of claims failed |
| `UNVERIFIED` | Verification was skipped (GT disabled) |
| `FAILED` | Verification process itself failed |

---

## Error Handling

### Common Failures

1. **ZodError - Schema Validation**
   ```
   Error: Expected string, received undefined at drills[0].explanation
   ```
   **Fix:** Check GPT response structure, add default values

2. **Position Seeding Failed**
   ```
   Error: No positions found for phase MIDDLE
   ```
   **Fix:** Populate Position Library for the phase

3. **Verification Timeout**
   ```
   Error: Engine query timed out after 10s
   ```
   **Fix:** Check engine URL, increase timeout

4. **Rate Limit (429)**
   ```
   Error: Rate limit exceeded (TPM)
   ```
   **Fix:** Wait and retry, Inngest handles automatically

### Debugging Steps

1. **Check Inngest Logs**
   ```bash
   ./scripts/inngest-monitor.sh 5
   ```

2. **Examine Step Details**
   - Open Inngest UI at http://localhost:8288
   - Find the failed run
   - Expand each step to see input/output

3. **Look for Specific Step**
   - `fetch-project` - Project data issues
   - `seed-positions` - Position library issues
   - `generate-drills` - GPT response issues
   - `verify-claims` - Ground truth issues

---

## Performance Optimization

### Token Usage (Phase 1 Optimization)

Dynamic position loading reduces token usage significantly:

| Request | Before | After | Savings |
|---------|--------|-------|---------|
| 20 drills, 2 phases | 96 positions (~27k tokens) | 24 positions (~6.8k tokens) | 75% |
| 10 drills, 1 phase | 25 positions (~7k tokens) | 12 positions (~3.4k tokens) | 51% |

### Future: Batched Generation (Phase 2)

Planned optimization to split large drill sets into batches:
- Generate 5-10 drills per batch
- Fan-out pattern for parallelization
- Reconstruct full artifact from Drill table
- See: `specs/optimize-drill-generation/02-specification.md`

---

## Testing

### Unit Testing

```typescript
// Testing position seeding
describe('seedPositionsForPhase', () => {
  it('returns all 21 opening positions', async () => {
    const positions = await seedPositionsForPhase(engineId, 'OPENING');
    expect(positions.length).toBe(21);
  });

  it('limits non-OPENING phases', async () => {
    const positions = await seedPositionsForPhase(engineId, 'MIDDLE', 10);
    expect(positions.length).toBeLessThanOrEqual(10);
  });
});
```

### E2E Testing

```bash
# Start servers
PORT=3002 npm run dev
npx inngest-cli dev

# Monitor generation
./scripts/inngest-monitor.sh 1

# Watch for all steps completing
```

---

## Database Schema

### GuruArtifact Fields for Drills

```prisma
model GuruArtifact {
  // ... common fields ...

  // Drill-specific fields
  positionsUsed     String[]   // Position IDs used in generation
  verificationStatus String?    // VERIFIED, NEEDS_REVIEW, UNVERIFIED, FAILED
  verificationDetails Json?     // Detailed verification results
  subTaskProgress   Json?       // Progress during verification
}
```

### Drill Table (Normalized Storage)

```prisma
model Drill {
  id              String       @id @default(cuid())
  artifactId      String
  sequenceNumber  Int          // Order within series
  title           String
  scenario        String       @db.Text
  question        String       @db.Text
  correctAnswer   String       @db.Text
  explanation     String       @db.Text
  difficulty      String       // BEGINNER, INTERMEDIATE, ADVANCED
  gamePhase       GamePhase?
  positionId      String?      // Link to Position Library

  artifact        GuruArtifact @relation(fields: [artifactId], references: [id])
}
```

---

## Related Documentation

- `developer-guides/08-teaching-pipeline-guide.md` - Overall pipeline
- `developer-guides/10-position-library-guide.md` - Position seeding details
- `developer-guides/11-ground-truth-engine-guide.md` - Verification system
- `developer-guides/07-inngest-monitoring-protocol.md` - Debugging jobs
- `specs/optimize-drill-generation/` - Optimization specs
