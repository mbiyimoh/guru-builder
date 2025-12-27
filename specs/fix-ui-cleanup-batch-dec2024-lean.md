# UI Cleanup Fixes - December 2024 Batch

## Status
Draft

## Authors
Claude | 2024-12-26

## Overview
Four discrete UI cleanup fixes addressing vestigial elements, tooltip positioning issues, and missing navigation CTAs. All are small, isolated changes with no database or API impact.

## Problem Statement
1. **Vestigial progress bar**: The wizard flow at `/projects/new/*` shows an old 4-phase progress bar that no longer matches the simplified flow
2. **Tooltip button text overlap**: Onboarding tooltips show both "X of Y" progress AND Back/Done buttons, creating visual clutter
3. **Missing CTA after recommendations**: After applying research recommendations, users see "X gaps remaining" but can't click to navigate back to address them
4. **Tooltip highlights wrong area**: "Two Modes" tooltip highlights the entire header instead of just the Advanced toggle

## Goals
- Remove the vestigial progress bar from wizard pages
- Clean up tooltip button area to remove redundant text
- Add clickable "X gaps remaining →" CTA linking back to research page
- Fix tooltip to highlight only the Advanced toggle, not the full header

## Non-Goals
- Redesigning the wizard flow
- Adding new onboarding tours
- Changing readiness calculation logic
- Adding new tooltip steps

---

## Technical Approach

### Fix 1: Remove Wizard Progress Bar

**File:** `app/projects/new/layout.tsx`

**Change:** Remove or hide the phases section from WizardNavigation. Two options:
- **Option A (Recommended):** Add a prop to WizardNavigation to hide phases, keeping "← Back to Projects" link
- **Option B:** Remove WizardNavigation entirely and add a simple back link

```tsx
// Option A: app/projects/new/layout.tsx
export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <WizardNavigation hidePhases />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

// components/wizard/WizardNavigation.tsx - add prop
interface WizardNavigationProps {
  hidePhases?: boolean;
}

export function WizardNavigation({ hidePhases = false }: WizardNavigationProps) {
  // ... existing code ...
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Back to Projects Link - always shown */}
        <div className={cn("mb-4 sm:mb-6", hidePhases && "mb-0")}>
          <Link href="/projects" className="...">
            ← Back to Projects
          </Link>
        </div>

        {/* Phase Navigation - conditionally hidden */}
        {!hidePhases && (
          <div className="flex items-center justify-between">
            {/* existing phases code */}
          </div>
        )}
      </div>
    </nav>
  );
}
```

---

### Fix 2: Fix Tooltip Button Text

**File:** `lib/onboarding/usePageTour.ts`

**Issue:** The Driver.js config shows `progressText: '{{current}} of {{total}}'` on a separate line above buttons, creating visual clutter.

**Change:** Remove the progress text since Back/Next/Done already provide navigation context, OR hide it via CSS.

```tsx
// lib/onboarding/usePageTour.ts
const driverObj = driver({
  showProgress: false,  // Changed from true - removes "X of Y" text
  // progressText: '{{current}} of {{total}}',  // Remove this line
  nextBtnText: 'Next',
  prevBtnText: 'Back',
  doneBtnText: 'Done',
  onDestroyed: markSeen,
  allowKeyboardControl: true,
  steps,
});
```

---

### Fix 3: Add Clickable "Gaps Remaining" CTA

**File:** `app/projects/[id]/research/[runId]/RecommendationsView.tsx`

**Change:** Convert the existing "X critical gaps remaining" text to a clickable Link that navigates to the research page.

```tsx
// Around line 176-181, change from:
{readinessResult.criticalGaps.length > 0 && (
  <span className="flex items-center text-sm text-amber-600">
    <AlertCircle className="w-4 h-4 mr-1" />
    {readinessResult.criticalGaps.length} critical gap{readinessResult.criticalGaps.length !== 1 ? 's' : ''} remaining
  </span>
)}

// To:
{readinessResult.criticalGaps.length > 0 && (
  <Link
    href={`/projects/${projectId}/research`}
    className="flex items-center text-sm text-amber-600 hover:text-amber-700 hover:underline transition-colors"
  >
    <AlertCircle className="w-4 h-4 mr-1" />
    {readinessResult.criticalGaps.length} gap{readinessResult.criticalGaps.length !== 1 ? 's' : ''} remaining →
  </Link>
)}
```

**Note:** Need to ensure `projectId` is available in this component (extract from URL params or pass as prop).

---

### Fix 4: Fix "Two Modes" Tooltip Position

**File:** `components/artifacts/UnifiedArtifactPage.tsx`

**Issue:** `data-tour="mode-toggle"` wraps the entire `TeachingPageHeader` which spans the full width. The tooltip highlights the left side but the toggle is on the right.

**Change:** Move `data-tour="mode-toggle"` to wrap only the toggle switch in `TeachingPageHeader.tsx`.

```tsx
// components/artifacts/TeachingPageHeader.tsx - around line 29-39
// Add data-tour to the toggle wrapper div:
<div className="flex items-center gap-2" data-tour="mode-toggle">
  <Switch
    id="advanced-mode"
    checked={advancedMode}
    onCheckedChange={onAdvancedModeChange}
    data-testid="advanced-toggle"
  />
  <Label htmlFor="advanced-mode" className="text-sm cursor-pointer">
    Advanced
  </Label>
</div>

// components/artifacts/UnifiedArtifactPage.tsx - line 387
// Remove data-tour from the header wrapper:
<TeachingPageHeader
  // Remove: data-tour="mode-toggle"
  advancedMode={advancedMode}
  onAdvancedModeChange={setAdvancedMode}
/>
```

---

## Testing Approach

Manual verification for each fix:

1. **Progress bar removal**: Navigate to `/projects/new/profile` and confirm:
   - "← Back to Projects" link is visible
   - 4-phase progress indicator is NOT visible

2. **Tooltip cleanup**: Trigger the onboarding tour on artifacts page:
   - "X of Y" progress text should NOT appear
   - Back/Next/Done buttons should be the only navigation

3. **Gaps CTA**: Apply recommendations on a research run, then:
   - "X gaps remaining →" should appear (if gaps exist)
   - Clicking it should navigate to `/projects/{id}/research`

4. **Tooltip position**: Trigger artifacts tour, step 2 "Two Modes":
   - Highlight should surround ONLY the Advanced toggle on the right
   - NOT highlight the entire header/left side

---

## Open Questions

1. **Fix 1**: Should we completely remove WizardNavigation or just hide phases? (Recommended: hide phases, keep back link)
2. **Fix 3**: Is `projectId` already available in RecommendationsView, or does it need to be extracted from URL?

---

## Future Improvements

- Add E2E tests for onboarding tours
- Consider adding tooltip progress dots instead of text (more compact)
- Add keyboard navigation hint in tooltips
- Consider animating the "gaps remaining" CTA to draw attention

---

## References

- Onboarding tooltips spec: `specs/onboarding-tooltips/`
- Driver.js documentation: https://driverjs.com/docs/configuration
