# Task Breakdown: Drill Series UX Improvements

**Generated:** 2025-12-24
**Source:** specs/drill-series-ux-improvements/02-specification.md
**Last Decompose:** 2025-12-24

## Overview

Three targeted fixes to improve drill series generation UX:
1. Add simplified drill configuration to Simple Mode
2. Fix error blocking on artifact load failure
3. Add granular drill count progress during generation

## Phase 1: Drill Configuration UI

### Task 1.1: Add drillConfig state to UnifiedArtifactPage
**Description:** Add state management for drill configuration in the unified artifact page
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 2.1, 2.2, 2.3

**File:** `components/artifacts/UnifiedArtifactPage.tsx`

**Implementation:**
```typescript
import { DrillGenerationConfig, DEFAULT_DRILL_CONFIG } from '@/lib/guruFunctions/types';

// Add state near other state declarations
const [drillConfig, setDrillConfig] = useState<DrillGenerationConfig>({
  ...DEFAULT_DRILL_CONFIG,
  gamePhases: ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'], // All phases checked by default
  targetDrillCount: 25,
});
const [engineId, setEngineId] = useState<string | null>(null);

// Fetch engineId on mount (add to existing useEffect or create new one)
useEffect(() => {
  if (artifactType === 'drill-series') {
    fetch(`/api/projects/${projectId}/ground-truth`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setEngineId(data?.engineId ?? null))
      .catch(() => setEngineId(null));
  }
}, [projectId, artifactType]);
```

**Acceptance Criteria:**
- [ ] drillConfig state initialized with all phases checked
- [ ] engineId fetched from GT config on mount for drill-series
- [ ] State updates properly when config changes

---

### Task 1.2: Update handleGenerate to pass drillConfig
**Description:** Modify the generation handler to include drill configuration in API request
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1

**File:** `components/artifacts/UnifiedArtifactPage.tsx`

**Implementation:**
Find `handleGenerate` callback (~line 206) and update the fetch body:
```typescript
const handleGenerate = useCallback(async () => {
  setError(null);
  setIsGenerating(true);

  try {
    const res = await fetch(`/api/projects/${projectId}/guru/${artifactType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        userNotes,
        // Only pass drillConfig for drill-series
        ...(artifactType === 'drill-series' && { drillConfig }),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Generation failed');
    }
  } catch (err) {
    setIsGenerating(false);
    setError(classifyError(err));
  }
}, [projectId, artifactType, userNotes, drillConfig]); // Add drillConfig to deps
```

**Acceptance Criteria:**
- [ ] drillConfig included in POST body for drill-series only
- [ ] Other artifact types not affected
- [ ] drillConfig in useCallback dependency array

---

### Task 1.3: Pass drillConfig props to SimpleToolbar
**Description:** Thread drill configuration props down to SimpleToolbar component
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1

**File:** `components/artifacts/UnifiedArtifactPage.tsx`

**Implementation:**
Find SimpleToolbar usage (~line 323) and add props:
```tsx
<SimpleToolbar
  artifactType={artifactType}
  artifact={artifact}
  isGenerating={isGenerating}
  onGenerate={handleGenerate}
  onRegenerate={handleGenerate}
  userNotes={userNotes}
  onUserNotesChange={setUserNotes}
  notesExpanded={notesExpanded}
  onNotesExpandedChange={setNotesExpanded}
  // New props for drill-series config
  drillConfig={drillConfig}
  onDrillConfigChange={setDrillConfig}
  engineId={engineId}
/>
```

**Acceptance Criteria:**
- [ ] drillConfig, onDrillConfigChange, engineId props passed to SimpleToolbar
- [ ] No TypeScript errors

---

### Task 1.4: Add drill config UI to SimpleToolbar
**Description:** Add collapsible drill configuration section for drill-series artifact type
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.3

**File:** `components/artifacts/SimpleToolbar.tsx`

**Implementation:**

1. Update imports:
```typescript
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { DrillGenerationConfig, GamePhase } from '@/lib/guruFunctions/types';
```

2. Update props interface:
```typescript
interface SimpleToolbarProps {
  artifactType: ArtifactType;
  artifact: ArtifactSummary | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
  notesExpanded: boolean;
  onNotesExpandedChange: (expanded: boolean) => void;
  // New drill config props
  drillConfig?: DrillGenerationConfig;
  onDrillConfigChange?: (config: DrillGenerationConfig) => void;
  engineId?: string | null;
}
```

3. Add state for config panel expansion:
```typescript
const [configExpanded, setConfigExpanded] = useState(true);
```

4. Add drill config UI (before ExpandableNotes, only when no artifact exists):
```tsx
{/* Drill Configuration (only for drill-series, pre-generation) */}
{artifactType === 'drill-series' && !artifact && drillConfig && onDrillConfigChange && (
  <div className="mt-4 border rounded-lg overflow-hidden">
    <button
      onClick={() => setConfigExpanded(!configExpanded)}
      className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
      disabled={isGenerating}
    >
      <span className="text-sm font-medium">Drill Configuration</span>
      {configExpanded ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )}
    </button>

    {configExpanded && (
      <div className="p-4 space-y-4">
        {/* Drill Count Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="drill-count" className="text-sm">
              Number of Drills
            </Label>
            <span className="text-sm font-medium">{drillConfig.targetDrillCount}</span>
          </div>
          <Slider
            id="drill-count"
            min={5}
            max={50}
            step={1}
            value={[drillConfig.targetDrillCount]}
            onValueChange={([value]) => onDrillConfigChange({
              ...drillConfig,
              targetDrillCount: value,
            })}
            disabled={isGenerating}
          />
          <p className="text-xs text-muted-foreground">
            Minimum 5, maximum 50 drills
          </p>
        </div>

        {/* Game Phases Checkboxes */}
        <div className="space-y-2">
          <Label className="text-sm">Game Phases</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as GamePhase[]).map((phase) => (
              <div key={phase} className="flex items-center space-x-2">
                <Checkbox
                  id={`phase-${phase}`}
                  checked={drillConfig.gamePhases.includes(phase)}
                  onCheckedChange={(checked) => {
                    const newPhases = checked
                      ? [...drillConfig.gamePhases, phase]
                      : drillConfig.gamePhases.filter(p => p !== phase);
                    // Ensure at least one phase is selected
                    if (newPhases.length > 0) {
                      onDrillConfigChange({
                        ...drillConfig,
                        gamePhases: newPhases,
                      });
                    }
                  }}
                  disabled={isGenerating}
                />
                <Label
                  htmlFor={`phase-${phase}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {phase === 'OPENING' ? 'Opening' :
                   phase === 'EARLY' ? 'Early Game' :
                   phase === 'MIDDLE' ? 'Middle Game' :
                   'Bear-Off'}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            At least one phase must be selected
          </p>
        </div>
      </div>
    )}
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Config section only shows for drill-series type
- [ ] Config section only shows when no artifact exists (pre-generation)
- [ ] Drill count slider works (5-50 range)
- [ ] Phase checkboxes toggle properly
- [ ] At least one phase must remain selected
- [ ] Config disabled while generating
- [ ] Section is collapsible

---

## Phase 2: Error Handling Fixes

### Task 2.1: Fix alert() in ArtifactHeader
**Description:** Replace blocking alert() with onError callback in ArtifactHeader component
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 2.2, 2.3, 1.1

**File:** `components/artifacts/ArtifactHeader.tsx`

**Implementation:**

1. Add onError prop:
```typescript
interface ArtifactHeaderProps {
  // ... existing props
  onError?: (message: string) => void;
}
```

2. Find line 90 and replace:
```typescript
// Before:
alert('Failed to regenerate artifact. Please try again.');

// After:
onError?.('Failed to regenerate artifact. Please try again.') ??
  console.error('Failed to regenerate artifact');
```

3. Update component signature to include onError prop

**Acceptance Criteria:**
- [ ] No alert() calls in component
- [ ] onError callback invoked on failure
- [ ] Falls back to console.error if no onError provided

---

### Task 2.2: Fix alert() in ArtifactDetailPanel
**Description:** Replace blocking alert() calls with onError callback in ArtifactDetailPanel
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 2.1, 2.3

**File:** `components/artifacts/ArtifactDetailPanel.tsx`

**Implementation:**

1. Add onError prop to interface:
```typescript
interface ArtifactDetailPanelProps {
  // ... existing props
  onError?: (message: string) => void;
}
```

2. Find lines 285 and 289, replace both:
```typescript
// Line 285, Before:
alert(`Generation failed: ${errorText}`);
// After:
onError?.(`Generation failed: ${errorText}`) ?? console.error(`Generation failed: ${errorText}`);

// Line 289, Before:
alert('Generation failed. Please try again.');
// After:
onError?.('Generation failed. Please try again.') ?? console.error('Generation failed');
```

**Acceptance Criteria:**
- [ ] No alert() calls in component (2 removed)
- [ ] onError callback invoked on failure
- [ ] Falls back to console.error if no onError provided

---

### Task 2.3: Fix alert() in EmptyStateGuidance
**Description:** Replace blocking alert() calls with onError callback in EmptyStateGuidance
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 2.1, 2.2

**File:** `components/artifacts/EmptyStateGuidance.tsx`

**Implementation:**

1. Add onError prop to interface:
```typescript
interface EmptyStateGuidanceProps {
  // ... existing props
  onError?: (message: string) => void;
}
```

2. Find lines 77 and 82, replace both:
```typescript
// Line 77, Before:
alert(`Generation failed: ${errorText}`);
// After:
onError?.(`Generation failed: ${errorText}`) ?? console.error(`Generation failed: ${errorText}`);

// Line 82, Before:
alert('Generation failed. Please try again.');
// After:
onError?.('Generation failed. Please try again.') ?? console.error('Generation failed');
```

**Acceptance Criteria:**
- [ ] No alert() calls in component (2 removed)
- [ ] onError callback invoked on failure
- [ ] Falls back to console.error if no onError provided

---

### Task 2.4: Wire onError callbacks in parent components
**Description:** Pass onError callbacks from UnifiedArtifactPage to child components
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1, 2.2, 2.3

**File:** `components/artifacts/UnifiedArtifactPage.tsx`

**Implementation:**

Add error handler and pass to child components:
```typescript
// Create error handler
const handleError = useCallback((message: string) => {
  setError({ type: 'generation', message });
}, []);

// Pass to EmptyStateGuidance (if used)
<EmptyStateGuidance
  projectId={projectId}
  onGenerate={(type) => { ... }}
  onError={handleError}
/>

// Pass to ArtifactHeader (if used)
// Pass to ArtifactDetailPanel (if used)
```

**Acceptance Criteria:**
- [ ] onError handler created using classifyError pattern
- [ ] Error handler passed to all child components that need it
- [ ] Errors display in inline banner, not popup

---

## Phase 3: Progress Tracking

### Task 3.1: Add generation progress tracking to Inngest
**Description:** Update Inngest drill series job to report drill count progress during generation
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 3.2

**File:** `lib/inngest-functions.ts`

**Implementation:**

Find the drill series generation function and add progress tracking around the generation step:

1. Before `generate-drill-series` step (after line ~908):
```typescript
// Initialize sub-task progress for generation phase
await step.run('init-generation-progress', async () => {
  await updateSubTaskProgress(artifactId, {
    phase: 'GENERATING_CONTENT',
    current: 0,
    total: drillConfig.targetDrillCount,
    currentClaimText: `Generating ${drillConfig.targetDrillCount} drills...`
  });
});
```

2. After generation completes successfully (after `result` is available, ~line 936):
```typescript
// Calculate actual drill count from result
const actualDrillCount = result.content.phases?.reduce(
  (sum, phase) => sum + phase.principleGroups.reduce(
    (groupSum, group) => groupSum + group.drills.length, 0
  ), 0
) || 0;

await step.run('complete-generation-progress', async () => {
  await updateSubTaskProgress(artifactId, {
    phase: 'GENERATING_CONTENT',
    current: actualDrillCount,
    total: drillConfig.targetDrillCount,
    currentClaimText: `Generated ${actualDrillCount} drills`
  });
});
```

**Acceptance Criteria:**
- [ ] subTaskProgress initialized before generation with target count
- [ ] subTaskProgress updated after generation with actual count
- [ ] Progress visible in database during generation
- [ ] No breaking changes to existing flow

---

### Task 3.2: Display generation progress in FullWidthProgressTracker
**Description:** Show drill count progress during GENERATING_CONTENT phase
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 3.1

**File:** `components/guru/FullWidthProgressTracker.tsx`

**Implementation:**

1. Add isGenerating check (~line 54):
```typescript
const isVerifying = currentStage === 'VERIFYING_CONTENT';
const isValidating = currentStage === 'VALIDATING_OUTPUT';
const isGeneratingContent = currentStage === 'GENERATING_CONTENT'; // ADD THIS
```

2. Add rendering block for generation progress (after isValidating block, ~line 173):
```tsx
{/* Sub-task detail for generation phase */}
{isGeneratingContent && subTaskProgress && !isComplete && (
  <div className="mt-4 p-3 bg-background rounded border">
    <div className="flex items-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      <span className="text-muted-foreground">Progress:</span>
      <span className="font-medium">
        {subTaskProgress.currentClaimText || `Generating ${subTaskProgress.total} drills...`}
      </span>
    </div>
    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-600 transition-all duration-300"
        style={{ width: `${subTaskProgress.total > 0 ? (subTaskProgress.current / subTaskProgress.total) * 100 : 0}%` }}
      />
    </div>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Progress bar shows during GENERATING_CONTENT phase
- [ ] Shows target drill count from subTaskProgress
- [ ] Progress bar updates when generation completes
- [ ] Styling consistent with verification progress

---

## Execution Strategy

### Parallel Execution Groups

**Group A (can run in parallel):**
- Task 1.1: Add drillConfig state
- Task 2.1: Fix ArtifactHeader alert
- Task 2.2: Fix ArtifactDetailPanel alerts
- Task 2.3: Fix EmptyStateGuidance alerts
- Task 3.1: Inngest progress tracking
- Task 3.2: FullWidthProgressTracker UI

**Group B (depends on Group A):**
- Task 1.2: Update handleGenerate (depends on 1.1)
- Task 1.3: Pass props to SimpleToolbar (depends on 1.1)
- Task 2.4: Wire onError callbacks (depends on 2.1, 2.2, 2.3)

**Group C (depends on Group B):**
- Task 1.4: SimpleToolbar config UI (depends on 1.3)

### Recommended Order

1. Start with all Group A tasks in parallel
2. Complete Group B tasks
3. Complete Task 1.4 (largest task, depends on earlier work)
4. Manual testing per spec testing checklist

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Drill Config UI | 4 tasks | High |
| Phase 2: Error Handling | 4 tasks | High |
| Phase 3: Progress Tracking | 2 tasks | High |
| **Total** | **10 tasks** | |

**Critical Path:** Task 1.1 → 1.2 → 1.3 → 1.4 (Config UI flow)

**High Parallelization:** 6 tasks can run in parallel (Group A)
