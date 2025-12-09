# Feature: Teaching Artifact Progress Tracking

**Status:** Draft
**Author:** Claude Code
**Created:** 2025-12-06
**Ideation Source:** `docs/ideation/diff-view-and-artifact-progress-tracking.md`

---

## 1. Overview

Add visual step-by-step progress tracking for teaching artifact generation (Mental Model, Curriculum, Drill Series) similar to the existing research workflow. Users will see which phase is currently executing, with simple time estimates, instead of just a generic spinning loader.

---

## 2. Background / Problem Statement

### Current State
When generating teaching artifacts (Mental Model, Curriculum, Drill Series):
- Users see only a spinning icon with "Generating... This may take a few minutes."
- No visibility into which step is currently running
- No indication of progress through the generation process
- Typical generation takes 30-120+ seconds

### Problem
Users have no feedback about what's happening during artifact generation:
- Creates anxiety about whether the process is stuck
- No way to gauge expected remaining time
- No transparency into the multi-step generation process

### Existing Pattern
The research workflow already has a solved pattern (`ResearchProgressTracker.tsx`) showing:
- 6-phase progress indicator with animated transitions
- Current phase highlighted with pulse animation
- Completed phases show checkmarks
- Text message showing current activity

---

## 3. Goals

- Display step-by-step progress for each artifact generation type
- Show which phase is currently executing with visual feedback
- Include simple time estimates per phase (e.g., "~30s")
- Follow existing `ResearchProgressTracker` pattern exactly
- Maintain backwards compatibility (fallback to spinner if progressStage is null)
- Update Inngest jobs to report progress stages during execution

---

## 4. Non-Goals

- Complex ETA calculations based on historical data
- Progress percentage within individual phases
- Pause/resume functionality
- Cancellation support (would require Inngest cancellation patterns)
- Per-corpus-size time estimates
- Detailed logging visible to users

---

## 5. Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Inngest | Latest | Background job orchestration with step progress |
| Prisma | 5.x | Database schema migration |
| Next.js | 15.x | App Router, client components |
| React | 19.x | Component framework |

---

## 6. Detailed Design

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ GuruTeachingManager.tsx                                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ArtifactCard (for each artifact type)                       ││
│  │                                                              ││
│  │  [If isGenerating && progressStage]                          ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ <TeachingProgressTracker>                               │││
│  │  │   ├─ Shows 5 phases with current highlighted            │││
│  │  │   ├─ Progress bar fills as phases complete              │││
│  │  │   ├─ Simple time estimates per phase                    │││
│  │  │   └─ Current activity message                           │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                              ││
│  │  [If isGenerating && !progressStage]                         ││
│  │  └─→ Fallback spinner (backwards compatible)                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Inngest Job (e.g., mentalModelGenerationJob)                     │
│                                                                  │
│  step.run('progress-composing', updateProgressStage(...))        │
│  step.run('fetch-project', ...)                                  │
│  step.run('progress-analyzing', updateProgressStage(...))        │
│  step.run('generate', ...)                                       │
│  step.run('progress-saving', updateProgressStage(...))           │
│  step.run('save-artifact', ...)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Database Schema Change

**File:** `prisma/schema.prisma`

```prisma
model GuruArtifact {
  // ... existing fields ...

  // NEW: Progress tracking (optional for backwards compatibility)
  progressStage  String?        // Current phase key (e.g., "COMPOSING_CORPUS")

  // ... rest of model ...
}
```

**Migration:**
```bash
npm run db:backup
npm run migrate:safe -- add-artifact-progress-stage
```

### 6.3 Phase Definitions

**File:** `lib/teaching/constants.ts`

```typescript
export type ArtifactType = 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';

export interface TeachingPhase {
  key: string;
  label: string;
  icon: string;
  estimatedTime: string;  // Simple estimate like "~30s"
}

export const MENTAL_MODEL_PHASES: TeachingPhase[] = [
  { key: 'COMPOSING_CORPUS', label: 'Composing', icon: '1', estimatedTime: '~5s' },
  { key: 'ANALYZING_STRUCTURE', label: 'Analyzing', icon: '2', estimatedTime: '~20s' },
  { key: 'EXTRACTING_PRINCIPLES', label: 'Extracting', icon: '3', estimatedTime: '~30s' },
  { key: 'BUILDING_FRAMEWORK', label: 'Building', icon: '4', estimatedTime: '~20s' },
  { key: 'SAVING_ARTIFACT', label: 'Saving', icon: '5', estimatedTime: '~5s' },
];

export const CURRICULUM_PHASES: TeachingPhase[] = [
  { key: 'LOADING_PREREQUISITES', label: 'Loading', icon: '1', estimatedTime: '~5s' },
  { key: 'ANALYZING_MENTAL_MODEL', label: 'Analyzing', icon: '2', estimatedTime: '~15s' },
  { key: 'DESIGNING_PATH', label: 'Designing', icon: '3', estimatedTime: '~30s' },
  { key: 'STRUCTURING_MODULES', label: 'Structuring', icon: '4', estimatedTime: '~25s' },
  { key: 'SAVING_ARTIFACT', label: 'Saving', icon: '5', estimatedTime: '~5s' },
];

export const DRILL_SERIES_PHASES: TeachingPhase[] = [
  { key: 'LOADING_PREREQUISITES', label: 'Loading', icon: '1', estimatedTime: '~5s' },
  { key: 'ANALYZING_CURRICULUM', label: 'Analyzing', icon: '2', estimatedTime: '~15s' },
  { key: 'DESIGNING_EXERCISES', label: 'Designing', icon: '3', estimatedTime: '~40s' },
  { key: 'GENERATING_CONTENT', label: 'Generating', icon: '4', estimatedTime: '~30s' },
  { key: 'SAVING_ARTIFACT', label: 'Saving', icon: '5', estimatedTime: '~5s' },
];

export function getPhasesForArtifactType(type: ArtifactType): TeachingPhase[] {
  switch (type) {
    case 'MENTAL_MODEL': return MENTAL_MODEL_PHASES;
    case 'CURRICULUM': return CURRICULUM_PHASES;
    case 'DRILL_SERIES': return DRILL_SERIES_PHASES;
  }
}
```

### 6.4 New Component: TeachingProgressTracker

**File:** `components/guru/TeachingProgressTracker.tsx`

```typescript
'use client';

import { getPhasesForArtifactType, type ArtifactType, type TeachingPhase } from '@/lib/teaching/constants';

interface TeachingProgressTrackerProps {
  artifactType: ArtifactType;
  currentStage: string | null;
  isComplete?: boolean;
}

function getPhaseIndex(phases: TeachingPhase[], stageKey: string | null): number {
  if (!stageKey) return 0;
  const index = phases.findIndex(p => p.key === stageKey);
  return index === -1 ? 0 : index;
}

export function TeachingProgressTracker({
  artifactType,
  currentStage,
  isComplete = false
}: TeachingProgressTrackerProps) {
  const phases = getPhasesForArtifactType(artifactType);
  const currentIndex = isComplete ? phases.length : getPhaseIndex(phases, currentStage);

  return (
    <div className="w-full py-4">
      {/* Progress bar container */}
      <div className="relative">
        {/* Background track */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full" />

        {/* Completed track */}
        <div
          className="absolute top-5 left-0 h-1 bg-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{
            width: isComplete
              ? '100%'
              : `${(currentIndex / (phases.length - 1)) * 100}%`
          }}
        />

        {/* Phase indicators */}
        <div className="relative flex justify-between">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex || isComplete;
            const isCurrent = index === currentIndex && !isComplete;

            return (
              <div key={phase.key} className="flex flex-col items-center">
                {/* Circle indicator */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    text-sm font-semibold transition-all duration-300
                    ${isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                        ? 'bg-blue-100 text-blue-700 ring-4 ring-blue-200 animate-pulse'
                        : 'bg-gray-100 text-gray-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    phase.icon
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-2 text-xs font-medium text-center max-w-[70px]
                    ${isCompleted
                      ? 'text-blue-700'
                      : isCurrent
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-400'
                    }
                  `}
                >
                  {phase.label}
                </span>

                {/* Time estimate (only show for current phase) */}
                {isCurrent && (
                  <span className="mt-1 text-xs text-gray-500">
                    {phase.estimatedTime}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status message */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          {isComplete ? (
            <span className="text-green-600 font-medium">Generation complete!</span>
          ) : (
            <span className="text-blue-600">
              {phases[currentIndex]?.label || 'Starting...'}...
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
```

### 6.5 Modified Component: GuruTeachingManager

**File:** `components/guru/GuruTeachingManager.tsx`

Changes to integrate the progress tracker:

```typescript
// Add import
import { TeachingProgressTracker } from './TeachingProgressTracker';

// Update ArtifactSummary interface to include progressStage
interface ArtifactSummary {
  id: string;
  type: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  version: number;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  generatedAt: string;
  corpusHash: string | null;
  errorMessage: string | null;
  progressStage: string | null;  // NEW
}

// Update ArtifactCard to show progress tracker
function ArtifactCard({
  title,
  description,
  artifact,
  canGenerate,
  isGenerating,
  onGenerate,
  onView,
  prerequisite,
}: ArtifactCardProps) {
  const status = artifact?.status;
  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';
  const isInProgress = status === 'GENERATING' || isGenerating;

  return (
    <div className={`border rounded-lg p-5 ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
      {/* ... existing header ... */}

      <p className="text-sm text-gray-600 mb-4">{description}</p>

      {/* Error state */}
      {isFailed && artifact?.errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-4">
          Error: {artifact.errorMessage}
        </div>
      )}

      {/* Prerequisite warning */}
      {prerequisite && !canGenerate && (
        <p className="text-sm text-amber-600 mb-4">{prerequisite}</p>
      )}

      {/* NEW: Progress tracker (replaces simple "Generating..." message) */}
      {isInProgress && (
        <div className="mb-4">
          {artifact?.progressStage ? (
            <TeachingProgressTracker
              artifactType={artifact.type}
              currentStage={artifact.progressStage}
              isComplete={false}
            />
          ) : (
            // Fallback for backwards compatibility
            <div className="text-sm text-blue-600">
              Generating... This may take a few minutes.
            </div>
          )}
        </div>
      )}

      {/* ... rest of component ... */}
    </div>
  );
}
```

### 6.6 Updated Inngest Jobs

**File:** `lib/inngest-functions.ts`

Helper function for updating progress:

```typescript
async function updateArtifactProgress(artifactId: string, progressStage: string) {
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: { progressStage },
  });
}
```

Updated Mental Model job (similar pattern for Curriculum and Drill Series):

```typescript
export const mentalModelGenerationJob = inngest.createFunction(
  { id: 'generate-mental-model', name: 'Generate Mental Model' },
  { event: 'guru/generate-mental-model' },
  async ({ event, step }) => {
    const { projectId, artifactId, userNotes } = event.data;

    // Phase 1: Composing Corpus
    await step.run('progress-composing', async () => {
      await updateArtifactProgress(artifactId, 'COMPOSING_CORPUS');
    });

    const project = await step.run('fetch-project', async () => {
      return prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: 'asc' } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    if (!project) {
      await step.run('mark-failed-no-project', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', errorMessage: 'Project not found', progressStage: null },
        });
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    // Phase 2: Analyzing Structure
    await step.run('progress-analyzing', async () => {
      await updateArtifactProgress(artifactId, 'ANALYZING_STRUCTURE');
    });

    // Phase 3: Extracting Principles (main generation)
    await step.run('progress-extracting', async () => {
      await updateArtifactProgress(artifactId, 'EXTRACTING_PRINCIPLES');
    });

    const result = await step.run('generate-mental-model', async () => {
      return generateMentalModel({
        projectName: project.name,
        contextLayers: project.contextLayers,
        knowledgeFiles: project.knowledgeFiles,
        userNotes,
      });
    });

    // Phase 4: Building Framework
    await step.run('progress-building', async () => {
      await updateArtifactProgress(artifactId, 'BUILDING_FRAMEWORK');
    });

    // Phase 5: Saving Artifact
    await step.run('progress-saving', async () => {
      await updateArtifactProgress(artifactId, 'SAVING_ARTIFACT');
    });

    await step.run('save-artifact', async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result.content,
          markdownContent: result.markdownContent,
          corpusHash: result.corpusHash,
          status: 'COMPLETED',
          progressStage: null,  // Clear on completion
        },
      });
    });

    return { success: true, artifactId };
  }
);
```

### 6.7 Updated API Response

**File:** `app/api/projects/[id]/guru/artifacts/route.ts`

Ensure `progressStage` is included in the response:

```typescript
const artifacts = await prisma.guruArtifact.findMany({
  where: { projectId: id },
  select: {
    id: true,
    type: true,
    version: true,
    status: true,
    corpusHash: true,
    generatedAt: true,
    dependsOnArtifactId: true,
    errorMessage: true,
    progressStage: true,  // NEW
  },
  orderBy: [{ type: 'asc' }, { version: 'desc' }],
});
```

### 6.8 Data Flow

```
User clicks "Generate Mental Model"
    │
    ▼
POST /api/projects/{id}/guru/mental-model
    │ Creates GuruArtifact with status=GENERATING
    │ Fires Inngest event 'guru/generate-mental-model'
    ▼
Inngest Job starts → updates progressStage = 'COMPOSING_CORPUS'
    │
    ▼
GuruTeachingManager polls GET /api/projects/{id}/guru/artifacts
    │ Response includes progressStage: 'COMPOSING_CORPUS'
    ▼
TeachingProgressTracker renders Phase 1 highlighted
    │
    ▼
Inngest Job progresses → updates progressStage = 'ANALYZING_STRUCTURE'
    │
    ▼
Next poll → UI updates to show Phase 2
    │
    ▼
... (continues through all phases)
    │
    ▼
Inngest Job completes → status='COMPLETED', progressStage=null, corpusHash set
    │
    ▼
Poll detects status='COMPLETED' AND corpusHash != null → stops polling
    │
    ▼
ArtifactCard shows completed state with View button
```

---

## 7. User Experience

### 7.1 Generating an Artifact

1. User clicks "Generate" on an artifact card
2. Card immediately shows progress tracker at Phase 1
3. As backend progresses, phases complete with checkmarks
4. Current phase shows pulsing animation and time estimate
5. On completion, tracker disappears and View button appears

### 7.2 Time Estimates

Simple static estimates shown below current phase:
- "~5s", "~20s", "~30s" etc.
- Not dynamically calculated
- Provides rough expectation, not precise ETA

### 7.3 Fallback Behavior

If `progressStage` is null (e.g., artifact created before this feature):
- Shows original "Generating... This may take a few minutes." message
- Maintains backwards compatibility

---

## 8. Testing Strategy

### 8.1 Unit Tests

**File:** `lib/__tests__/TeachingProgressTracker.test.tsx`

```typescript
describe('TeachingProgressTracker', () => {
  // Purpose: Verify correct phases shown for each artifact type
  it('shows Mental Model phases for MENTAL_MODEL type', () => {
    render(<TeachingProgressTracker
      artifactType="MENTAL_MODEL"
      currentStage="ANALYZING_STRUCTURE"
    />);
    expect(screen.getByText('Composing')).toBeInTheDocument();
    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    expect(screen.getByText('Extracting')).toBeInTheDocument();
  });

  // Purpose: Verify current phase is highlighted
  it('highlights current phase with pulse animation', () => {
    const { container } = render(<TeachingProgressTracker
      artifactType="MENTAL_MODEL"
      currentStage="EXTRACTING_PRINCIPLES"
    />);
    const currentCircle = container.querySelector('.animate-pulse');
    expect(currentCircle).toBeInTheDocument();
  });

  // Purpose: Verify completed phases show checkmarks
  it('shows checkmarks for completed phases', () => {
    render(<TeachingProgressTracker
      artifactType="MENTAL_MODEL"
      currentStage="BUILDING_FRAMEWORK"
    />);
    // Phases 1-3 should be complete (indices 0-2)
    const checkmarks = screen.getAllByRole('img', { hidden: true }); // SVG checkmarks
    expect(checkmarks.length).toBeGreaterThanOrEqual(3);
  });

  // Purpose: Verify time estimate shown for current phase
  it('shows time estimate for current phase only', () => {
    render(<TeachingProgressTracker
      artifactType="CURRICULUM"
      currentStage="DESIGNING_PATH"
    />);
    expect(screen.getByText('~30s')).toBeInTheDocument();
  });

  // Purpose: Verify completion state
  it('shows completion message when isComplete is true', () => {
    render(<TeachingProgressTracker
      artifactType="DRILL_SERIES"
      currentStage={null}
      isComplete={true}
    />);
    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });
});
```

### 8.2 Integration Tests

**File:** `lib/__tests__/teaching-progress-integration.test.ts`

```typescript
describe('Teaching Progress Integration', () => {
  // Purpose: Verify Inngest job updates progressStage correctly
  it('updates progressStage through all phases', async () => {
    const artifactId = 'test-artifact-id';

    // Mock Inngest job execution
    await mentalModelGenerationJob.handler({
      event: { data: { projectId: 'test', artifactId, userNotes: '' } },
      step: mockStep,
    });

    // Verify progressStage was updated for each phase
    const updateCalls = prismaMock.guruArtifact.update.mock.calls;
    const progressUpdates = updateCalls
      .filter(call => call[0].data.progressStage)
      .map(call => call[0].data.progressStage);

    expect(progressUpdates).toContain('COMPOSING_CORPUS');
    expect(progressUpdates).toContain('ANALYZING_STRUCTURE');
    expect(progressUpdates).toContain('EXTRACTING_PRINCIPLES');
    expect(progressUpdates).toContain('BUILDING_FRAMEWORK');
    expect(progressUpdates).toContain('SAVING_ARTIFACT');
  });
});
```

### 8.3 E2E Tests

**File:** `tests/features/teaching-progress-tracking.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Teaching Artifact Progress Tracking', () => {
  // Purpose: Verify progress tracker appears during generation
  test('shows progress tracker when generating mental model', async ({ page }) => {
    await page.goto('/projects/test-project');

    // Click generate on Mental Model
    await page.click('button:has-text("Generate"):near(:text("Mental Model"))');

    // Wait for progress tracker to appear
    const progressTracker = page.locator('[data-testid="teaching-progress-tracker"]');
    await expect(progressTracker).toBeVisible({ timeout: 5000 });

    // Verify phases are shown
    await expect(progressTracker.locator('text=Composing')).toBeVisible();
    await expect(progressTracker.locator('text=Analyzing')).toBeVisible();
  });

  // Purpose: Verify fallback when progressStage is null
  test('shows fallback spinner for legacy artifacts', async ({ page }) => {
    // Navigate to project with legacy generating artifact (no progressStage)
    await page.goto('/projects/legacy-project');

    // Should show fallback message
    await expect(page.locator('text=Generating... This may take a few minutes.')).toBeVisible();
  });
});
```

---

## 9. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Additional DB writes | Only 5 extra updates per artifact (one per phase) - negligible |
| Polling frequency | Unchanged at 3 seconds - already optimized |
| Bundle size | New component is ~200 lines, minimal impact |
| Re-renders | Progress tracker only re-renders when progressStage changes |

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Progress injection | progressStage is server-controlled, not user input |
| Unauthorized access | Existing project ownership checks remain |
| Data exposure | progressStage reveals no sensitive information |

---

## 11. Documentation

### Updates Required

1. **Developer Guide:** Add section on teaching progress tracking
2. **CLAUDE.md:** Document Inngest progress update pattern

---

## 12. Implementation Phases

### Phase 1: Core Implementation (This Spec)

1. Add `progressStage` field to GuruArtifact schema
2. Create `lib/teaching/constants.ts` with phase definitions
3. Create `TeachingProgressTracker.tsx` component
4. Update `GuruTeachingManager.tsx` to use progress tracker
5. Update all three Inngest teaching jobs to report progress
6. Update artifacts API to return progressStage
7. Add unit tests
8. Manual testing with real artifact generation

### Phase 2: Future Enhancements (Out of Scope)

- Dynamic time estimates based on corpus size
- Progress history/timeline view
- Generation cancellation support

---

## 13. Open Questions

None - all decisions made:
- Simple static time estimates (per user preference)
- Follow ResearchProgressTracker pattern exactly
- Fallback to spinner for backwards compatibility

---

## 14. References

- **Ideation Document:** `docs/ideation/diff-view-and-artifact-progress-tracking.md`
- **Reference Component:** `components/research/ResearchProgressTracker.tsx`
- **Current Component:** `components/guru/GuruTeachingManager.tsx`
- **Inngest Jobs:** `lib/inngest-functions.ts:315-586`
- **Database Schema:** `prisma/schema.prisma` (GuruArtifact model)

---

## 15. Acceptance Criteria Checklist

- [ ] `progressStage` field added to GuruArtifact model
- [ ] TeachingProgressTracker component created
- [ ] Mental Model generation shows 5-phase progress
- [ ] Curriculum generation shows 5-phase progress
- [ ] Drill Series generation shows 5-phase progress
- [ ] Current phase shows pulse animation
- [ ] Completed phases show checkmarks
- [ ] Time estimates shown for current phase
- [ ] Fallback spinner shown when progressStage is null
- [ ] Progress resets on completion (progressStage = null)
- [ ] No regressions in artifact generation functionality
