# Task Breakdown: Expanded Progress Tracker with Sub-task Visibility

**Generated:** 2025-12-12
**Source:** specs/expanded-progress-tracker-subtasks/02-spec.md
**Last Decompose:** 2025-12-12

---

## Overview

This task breakdown implements a full-width progress tracker component that displays beneath the artifact tiles during generation, showing detailed sub-task progress especially for the verification phase.

## Phase 1: Database & Types

### Task 1.1: Add subTaskProgress field to GuruArtifact schema

**Description:** Add JSON field to store sub-task progress during artifact generation
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (foundation task)

**Technical Requirements:**
- Add `subTaskProgress Json?` field to GuruArtifact model
- Run database migration safely with backup

**Implementation:**

```prisma
model GuruArtifact {
  // ... existing fields

  // Sub-task progress for detailed tracking during generation
  subTaskProgress Json?  // Stores SubTaskProgress object
}
```

**Migration steps:**
1. Run `npm run db:backup` first
2. Add field to schema.prisma
3. Run `npm run migrate:safe -- add-subtask-progress`
4. Regenerate Prisma client

**Acceptance Criteria:**
- [ ] subTaskProgress field added to GuruArtifact model
- [ ] Migration runs without data loss
- [ ] Prisma client regenerated successfully
- [ ] Existing artifacts unaffected (field is optional)

---

### Task 1.2: Create SubTaskProgress TypeScript interfaces

**Description:** Define TypeScript types for sub-task progress tracking
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1

**Technical Requirements:**
- Create interfaces in `lib/teaching/types.ts`
- Keep types simple per validation recommendations (no claims array)

**Implementation:**

```typescript
// lib/teaching/types.ts - Add these interfaces

/**
 * Progress tracking for sub-tasks during artifact generation.
 * Used primarily for verification phase visibility.
 */
export interface SubTaskProgress {
  /** Current phase name (e.g., 'VERIFYING_CONTENT') */
  phase: string;
  /** Current sub-task index (1-based for display) */
  current: number;
  /** Total sub-tasks in this phase */
  total: number;
  /** Human-readable detail of current sub-task */
  currentClaimText?: string;
  /** Timestamp when this progress was updated */
  updatedAt?: string;
}

/**
 * Extended artifact data including sub-task progress.
 * Used in API responses during polling.
 */
export interface ArtifactWithProgress {
  id: string;
  type: string;
  status: string;
  progressStage: string | null;
  subTaskProgress: SubTaskProgress | null;
}
```

**Acceptance Criteria:**
- [ ] SubTaskProgress interface defined
- [ ] ArtifactWithProgress interface defined
- [ ] Types exported from lib/teaching/types.ts
- [ ] No TypeScript errors

---

## Phase 2: Backend Updates

### Task 2.1: Add updateSubTaskProgress helper to Inngest functions

**Description:** Create helper function for updating sub-task progress in database
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2
**Can run parallel with:** Task 2.2 (after dependencies met)

**Technical Requirements:**
- Add helper function in lib/inngest-functions.ts
- Handle Prisma JSON type correctly
- Batch updates every 3 claims to reduce DB writes

**Implementation:**

```typescript
// lib/inngest-functions.ts - Add near other helper functions

import type { SubTaskProgress } from '@/lib/teaching/types';
import type { Prisma } from '@prisma/client';

/**
 * Updates sub-task progress for an artifact during generation.
 * Used to provide detailed visibility into verification phase.
 */
async function updateSubTaskProgress(
  artifactId: string,
  progress: SubTaskProgress
): Promise<void> {
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: {
      subTaskProgress: {
        ...progress,
        updatedAt: new Date().toISOString()
      } as Prisma.JsonObject
    }
  });
}
```

**Acceptance Criteria:**
- [ ] Helper function added to inngest-functions.ts
- [ ] Function correctly updates subTaskProgress JSON field
- [ ] TypeScript types work correctly with Prisma.JsonObject
- [ ] No runtime errors when called

---

### Task 2.2: Integrate sub-task progress into curriculum verification loop

**Description:** Update curriculum generation to emit sub-task progress during verification
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.3

**Technical Requirements:**
- Modify curriculum verification section (~line 590-640 in inngest-functions.ts)
- Update progress every 3 claims to reduce DB writes
- Show current claim text (truncated to 60 chars)

**Implementation:**

Find the curriculum verification section and modify:

```typescript
// Inside curriculum generation function, in the verification section
// After: await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.VERIFYING_CONTENT);

if (gtConfig?.enabled) {
  await step.run('progress-verifying', async () => {
    await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.VERIFYING_CONTENT);
  });

  try {
    const claims = await step.run('extract-curriculum-claims', async () => {
      // ... existing claim extraction
    });

    // NEW: Initialize sub-task progress
    const totalClaims = claims.length;
    await updateSubTaskProgress(artifactId, {
      phase: 'VERIFYING_CONTENT',
      current: 0,
      total: totalClaims,
      currentClaimText: 'Starting verification...'
    });

    // Inside the verification loop
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];

      // Update progress every 3 claims or on first/last
      if (i === 0 || i === claims.length - 1 || i % 3 === 0) {
        await updateSubTaskProgress(artifactId, {
          phase: 'VERIFYING_CONTENT',
          current: i + 1,
          total: totalClaims,
          currentClaimText: (claim.content || claim.extractedMove || '').slice(0, 60)
        });
      }

      // ... existing verification logic
    }

    // Clear sub-task progress when done
    await updateSubTaskProgress(artifactId, {
      phase: 'VERIFYING_CONTENT',
      current: totalClaims,
      total: totalClaims,
      currentClaimText: 'Verification complete'
    });

  } catch (error) {
    // ... existing error handling
  }
}
```

**Acceptance Criteria:**
- [ ] Sub-task progress updates during curriculum verification
- [ ] Updates batched every 3 claims
- [ ] Claim text truncated to 60 characters
- [ ] Progress cleared when verification completes
- [ ] No performance degradation

---

### Task 2.3: Integrate sub-task progress into drill series verification loop

**Description:** Update drill series generation to emit sub-task progress during verification
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 2.2

**Technical Requirements:**
- Modify drill series verification section (~line 808-870 in inngest-functions.ts)
- Same pattern as curriculum verification
- Update progress every 3 claims

**Implementation:**

Same pattern as Task 2.2, applied to drill series section:

```typescript
// Inside drill series generation function, in the verification section
// After: await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.VERIFYING_CONTENT);

if (gtConfig?.enabled) {
  await step.run('progress-verifying', async () => {
    await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.VERIFYING_CONTENT);
  });

  try {
    const claims = await step.run('extract-claims', async () => {
      // ... existing claim extraction
    });

    // NEW: Initialize sub-task progress
    const totalClaims = claims.length;
    await updateSubTaskProgress(artifactId, {
      phase: 'VERIFYING_CONTENT',
      current: 0,
      total: totalClaims,
      currentClaimText: 'Starting verification...'
    });

    // Inside verification loop - update every 3 claims
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];

      if (i === 0 || i === claims.length - 1 || i % 3 === 0) {
        await updateSubTaskProgress(artifactId, {
          phase: 'VERIFYING_CONTENT',
          current: i + 1,
          total: totalClaims,
          currentClaimText: (claim.content || claim.extractedMove || '').slice(0, 60)
        });
      }

      // ... existing verification logic
    }

    // Clear when done
    await updateSubTaskProgress(artifactId, {
      phase: 'VERIFYING_CONTENT',
      current: totalClaims,
      total: totalClaims,
      currentClaimText: 'Verification complete'
    });

  } catch (error) {
    // ... existing error handling
  }
}
```

**Acceptance Criteria:**
- [ ] Sub-task progress updates during drill series verification
- [ ] Same batching pattern as curriculum (every 3 claims)
- [ ] Claim text truncated to 60 characters
- [ ] Works correctly with Inngest step functions

---

### Task 2.4: Include subTaskProgress in artifacts API response

**Description:** Update artifacts API to return sub-task progress for polling
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** Task 2.1, 2.2, 2.3

**Technical Requirements:**
- Modify `app/api/projects/[id]/guru/artifacts/route.ts`
- Add subTaskProgress to select clause
- Ensure no-cache headers are present (already there)

**Implementation:**

```typescript
// app/api/projects/[id]/guru/artifacts/route.ts
// Update the select clause in findMany

const artifacts = await prisma.guruArtifact.findMany({
  where: { projectId },
  orderBy: [{ type: "asc" }, { version: "desc" }],
  select: {
    id: true,
    type: true,
    version: true,
    status: true,
    corpusHash: true,
    generatedAt: true,
    dependsOnArtifactId: true,
    errorMessage: true,
    progressStage: true,
    subTaskProgress: true,  // ADD THIS LINE
  },
});
```

**Acceptance Criteria:**
- [ ] subTaskProgress included in API response
- [ ] Response structure unchanged except for new field
- [ ] No-cache headers still present
- [ ] No TypeScript errors

---

## Phase 3: UI Component

### Task 3.1: Create FullWidthProgressTracker component

**Description:** Build the main progress tracker component with phase timeline and sub-task visibility
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.2, Task 2.4
**Can run parallel with:** None (main deliverable)

**Technical Requirements:**
- Single component file (not split into sub-components per validation)
- Show phase timeline with current phase highlighted
- Show sub-task progress for verification phase
- Fade out with success message after completion (3 second delay)
- Use existing shadcn/ui and Tailwind patterns

**Implementation:**

```typescript
// components/guru/FullWidthProgressTracker.tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPhasesForArtifactType, type ArtifactType, type TeachingPhase } from '@/lib/teaching/constants';
import type { SubTaskProgress } from '@/lib/teaching/types';

interface FullWidthProgressTrackerProps {
  artifactType: ArtifactType;
  currentStage: string | null;
  subTaskProgress: SubTaskProgress | null;
  isComplete: boolean;
  onFadeComplete?: () => void;
}

export function FullWidthProgressTracker({
  artifactType,
  currentStage,
  subTaskProgress,
  isComplete,
  onFadeComplete
}: FullWidthProgressTrackerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showingSummary, setShowingSummary] = useState(false);
  const phases = getPhasesForArtifactType(artifactType);

  const currentIndex = isComplete
    ? phases.length
    : phases.findIndex(p => p.key === currentStage);

  // Handle completion fade-out
  useEffect(() => {
    if (isComplete && !showingSummary) {
      setShowingSummary(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onFadeComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, showingSummary, onFadeComplete]);

  if (!isVisible) return null;

  const isVerifying = currentStage === 'VERIFYING_CONTENT';
  const artifactLabel = artifactType === 'MENTAL_MODEL' ? 'Mental Model'
    : artifactType === 'CURRICULUM' ? 'Curriculum'
    : 'Drill Series';

  return (
    <div className={cn(
      "w-full mt-6 p-6 bg-muted/50 rounded-lg border transition-opacity duration-500",
      showingSummary && "opacity-50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          )}
          <span className="font-medium">
            {isComplete ? `${artifactLabel} Generated` : `Generating ${artifactLabel}...`}
          </span>
        </div>
        {subTaskProgress && isVerifying && !isComplete && (
          <span className="text-sm text-muted-foreground">
            Claim {subTaskProgress.current}/{subTaskProgress.total}
          </span>
        )}
      </div>

      {/* Phase Timeline */}
      <div className="relative mb-4">
        {/* Progress bar background */}
        <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded-full" />
        {/* Progress bar filled */}
        <div
          className="absolute top-4 left-0 h-1 bg-blue-600 rounded-full transition-all duration-500"
          style={{
            width: isComplete
              ? '100%'
              : `${Math.max(0, (currentIndex / (phases.length - 1)) * 100)}%`
          }}
        />

        {/* Phase indicators */}
        <div className="relative flex justify-between">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex || isComplete;
            const isCurrent = index === currentIndex && !isComplete;

            return (
              <div key={phase.key} className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                  isCompleted && "bg-blue-600 text-white",
                  isCurrent && "bg-blue-100 text-blue-700 ring-2 ring-blue-300 animate-pulse",
                  !isCompleted && !isCurrent && "bg-gray-100 text-gray-400"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    phase.icon
                  )}
                </div>
                <span className={cn(
                  "mt-2 text-xs text-center",
                  isCompleted && "text-blue-700 font-medium",
                  isCurrent && "text-blue-600 font-semibold",
                  !isCompleted && !isCurrent && "text-gray-400"
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-task detail for verification phase */}
      {isVerifying && subTaskProgress && !isComplete && (
        <div className="mt-4 p-3 bg-background rounded border">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-muted-foreground">Verifying:</span>
            <span className="font-mono text-xs truncate flex-1">
              {subTaskProgress.currentClaimText || 'Processing...'}
            </span>
          </div>
          {/* Mini progress bar for claims */}
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(subTaskProgress.current / subTaskProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Completion summary */}
      {isComplete && showingSummary && (
        <div className="text-center text-sm text-green-600 font-medium">
          {subTaskProgress
            ? `Verified ${subTaskProgress.total} claims successfully`
            : 'Generation complete'
          }
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Component renders when artifact is generating
- [ ] Phase timeline shows all phases with correct styling
- [ ] Current phase highlighted with animation
- [ ] Verification sub-task progress visible when in VERIFYING_CONTENT phase
- [ ] Shows claim text and X/Y progress
- [ ] Fades out 3 seconds after completion
- [ ] Success message shown before fade
- [ ] No layout shift on appear/disappear

---

### Task 3.2: Integrate FullWidthProgressTracker into GuruTeachingManager

**Description:** Add the progress tracker below the artifact tiles
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.1
**Can run parallel with:** None

**Technical Requirements:**
- Import and render FullWidthProgressTracker in GuruTeachingManager
- Show only when at least one artifact is GENERATING
- Pass correct props from polling data

**Implementation:**

```typescript
// components/guru/GuruTeachingManager.tsx

// Add import at top
import { FullWidthProgressTracker } from './FullWidthProgressTracker';
import type { SubTaskProgress } from '@/lib/teaching/types';

// Inside the component, find the generating artifact
// Add this logic after the artifact tiles section

// Find the generating artifact (if any)
const generatingArtifact = [
  latestArtifacts.mentalModel,
  latestArtifacts.curriculum,
  latestArtifacts.drillSeries
].find(a => a?.status === 'GENERATING');

// In the JSX, after the 3-tile grid and before the closing container:
{generatingArtifact && (
  <FullWidthProgressTracker
    artifactType={generatingArtifact.type}
    currentStage={generatingArtifact.progressStage}
    subTaskProgress={generatingArtifact.subTaskProgress as SubTaskProgress | null}
    isComplete={false}
  />
)}
```

**Acceptance Criteria:**
- [ ] Progress tracker appears below tiles when generating
- [ ] Correct artifact type passed to tracker
- [ ] Sub-task progress data flows through correctly
- [ ] Tracker hidden when no artifact generating
- [ ] Polling updates reflected in tracker

---

## Phase 4: Testing & Polish

### Task 4.1: Manual E2E testing of progress tracker

**Description:** Verify the complete flow works end-to-end
**Size:** Medium
**Priority:** High
**Dependencies:** All previous tasks
**Can run parallel with:** Task 4.2

**Test scenarios:**

1. **Curriculum generation with Ground Truth enabled:**
   - Navigate to project with GT enabled
   - Click "Regenerate" on Curriculum
   - Verify progress tracker appears below tiles
   - Watch for phase progression
   - Confirm sub-task visibility during VERIFYING_CONTENT
   - Verify claim X/Y counter updates
   - Confirm fade-out after completion

2. **Drill Series generation with Ground Truth enabled:**
   - Same flow as curriculum
   - Verify both artifact types work

3. **Generation without Ground Truth:**
   - Use project without GT enabled
   - Verify phases progress without sub-task detail
   - Verify no errors when subTaskProgress is null

4. **Edge cases:**
   - Refresh during generation - tracker should reappear
   - Multiple browser tabs - no conflicts
   - Very fast completion - fade still works

**Acceptance Criteria:**
- [ ] Curriculum generation shows sub-task progress
- [ ] Drill series generation shows sub-task progress
- [ ] Generation without GT works without errors
- [ ] Refresh during generation recovers state
- [ ] Fade-out works correctly

---

### Task 4.2: Handle edge cases and error states

**Description:** Ensure graceful handling of edge cases
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 3.1, Task 3.2
**Can run parallel with:** Task 4.1

**Edge cases to handle:**

1. **No subTaskProgress data:**
   - Show phases without claim detail section
   - No errors in console

2. **Verification skipped (GT disabled):**
   - Phase progresses but no sub-task detail
   - Works smoothly

3. **Error during verification:**
   - Progress tracker shows error state
   - Doesn't hang

4. **Very long claim text:**
   - Truncated with ellipsis
   - No layout break

**Implementation notes:**
- Add null checks for subTaskProgress
- Truncate claim text in component (already done in component)
- Add error boundary if needed

**Acceptance Criteria:**
- [ ] Null subTaskProgress handled gracefully
- [ ] Long claim text truncated properly
- [ ] No console errors in any scenario
- [ ] Error states don't break UI

---

## Summary

| Phase | Tasks | Size |
|-------|-------|------|
| Phase 1: Database & Types | 2 | Small |
| Phase 2: Backend Updates | 4 | Medium |
| Phase 3: UI Component | 2 | Large + Medium |
| Phase 4: Testing | 2 | Medium + Small |

**Total Tasks:** 10
**Critical Path:** 1.1 → 2.1 → 2.2/2.3 → 2.4 → 3.1 → 3.2 → 4.1

**Parallel Opportunities:**
- Task 1.1 and 1.2 can run in parallel
- Task 2.2 and 2.3 can run in parallel (after 2.1)
- Task 2.4 can run in parallel with 2.1-2.3 (only needs 1.1)
- Task 4.1 and 4.2 can run in parallel
