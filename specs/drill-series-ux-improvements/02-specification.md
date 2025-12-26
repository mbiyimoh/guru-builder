# Specification: Drill Series UX Improvements

**Created:** 2025-12-24
**Status:** Ready for Implementation
**Ideation:** specs/drill-series-ux-improvements/01-ideation.md

## Summary

Three targeted fixes to improve drill series generation UX:
1. Add simplified drill configuration to Simple Mode
2. Fix error blocking on artifact load failure
3. Add granular drill count progress during generation

## Changes

### 1. Simplified Drill Configuration in Simple Mode

**File:** `components/artifacts/SimpleToolbar.tsx`

Add a collapsible drill config section when `artifactType === 'drill-series'`:
- Drill count slider (5-50, default 25)
- Phase checkboxes (OPENING, EARLY, MIDDLE, BEAROFF - all checked by default)
- Only shows when no artifact exists (pre-generation state)

**Note on defaults:** The API currently defaults to `['OPENING']` only (line 29 of route.ts), but users expect full game coverage. The UI should default to all phases checked, which will be passed explicitly to the API.

**Props to add:**
```typescript
interface SimpleToolbarProps {
  // ... existing props
  drillConfig?: DrillGenerationConfig;
  onDrillConfigChange?: (config: DrillGenerationConfig) => void;
  engineId?: string | null;  // Needed for position library validation
}
```

**File:** `components/artifacts/UnifiedArtifactPage.tsx`

- Add `drillConfig` state with default from `DEFAULT_DRILL_CONFIG`
- Fetch engineId from GT config on mount
- Pass config to `/api/projects/${projectId}/guru/drill-series` POST body
- Pass props down to SimpleToolbar

**File:** `app/api/projects/[id]/guru/drill-series/route.ts`

- Accept optional `drillConfig` in request body
- Merge with defaults, pass to Inngest event

### 2. Error Handling - Non-Blocking Navigation

**File:** `app/projects/[id]/artifacts/teaching/drill-series/page.tsx`

Already handles errors gracefully (`.catch(() => null)`). The blocking popups are in other components.

**Files with blocking `alert()` calls to fix:**
- `components/artifacts/ArtifactHeader.tsx:90` - Regenerate failure
- `components/artifacts/ArtifactDetailPanel.tsx:285,289` - Generation failure
- `components/artifacts/EmptyStateGuidance.tsx:77,82` - Generation failure

Replace each `alert()` call with proper error state handling. For components that don't have error state, add `onError` callback prop or use toast notifications.

**Pattern for inline error display:**
```tsx
{error && (
  <Alert variant="destructive" className="mb-4">
    <AlertDescription className="flex justify-between items-center">
      <span>{error.message}</span>
      <Button variant="ghost" size="sm" onClick={() => setError(null)}>
        Dismiss
      </Button>
    </AlertDescription>
  </Alert>
)}
```

**Pattern for callback-based error handling:**
```tsx
// In component props
onError?: (message: string) => void;

// Instead of alert()
onError?.(errorText) ?? console.error(errorText);
```

### 3. Granular Drill Progress During Generation

**File:** `lib/inngest-functions.ts`

The drill series generation happens in a single `generateDrillSeriesWithValidation()` call. To show per-drill progress, we need to:

Option A (Minimal - Recommended): Show target count in UI
- Before generation, set `subTaskProgress.total = drillConfig.targetDrillCount`
- UI shows "Generating 0/25 drills..." during GENERATING_CONTENT phase
- After generation, update to actual count

Option B (Invasive - Not Recommended): Stream drill progress
- Would require refactoring `generateDrillSeriesWithValidation` to yield progress
- High complexity, breaks Inngest step isolation

**Implementation (Option A):**

In `lib/inngest-functions.ts`, before `generate-drill-series` step:
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

After generation completes:
```typescript
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

**File:** `components/guru/FullWidthProgressTracker.tsx`

Add GENERATING_CONTENT to the phases that show subTaskProgress:
```typescript
const isGenerating = currentStage === 'GENERATING_CONTENT';

// In the render, add alongside isVerifying:
{subTaskProgress && isGenerating && !isComplete && (
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

## Files to Modify

| File | Change |
|------|--------|
| `components/artifacts/SimpleToolbar.tsx` | Add drill config UI for drill-series type |
| `components/artifacts/UnifiedArtifactPage.tsx` | Add drillConfig state, fetch engineId, pass to API |
| `app/api/projects/[id]/guru/drill-series/route.ts` | Already accepts drillConfig - no changes needed |
| `lib/inngest-functions.ts` | Add subTaskProgress updates during GENERATING_CONTENT |
| `components/guru/FullWidthProgressTracker.tsx` | Display progress during GENERATING_CONTENT phase |
| `components/artifacts/ArtifactHeader.tsx` | Replace alert() with onError callback |
| `components/artifacts/ArtifactDetailPanel.tsx` | Replace alert() with onError callback |
| `components/artifacts/EmptyStateGuidance.tsx` | Replace alert() with onError callback |

## Testing

- [ ] Generate drill-series and see config options before clicking Generate
- [ ] Verify drill count slider works (5-50 range)
- [ ] Verify phase checkboxes toggle properly
- [ ] Start generation and see "Generating X/Y drills..." progress
- [ ] Force error by disconnecting network mid-load → should show dismissible banner, not popup
- [ ] Navigate back to teaching landing page after error
