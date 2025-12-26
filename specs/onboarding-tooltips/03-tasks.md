# Task Breakdown: Page-Specific Onboarding Tooltips

**Generated:** 2024-12-26
**Source:** specs/onboarding-tooltips/02-specification.md
**Last Decompose:** 2024-12-26

---

## Overview

Implement onboarding tooltip tours for 4 key pages using Driver.js. Tours auto-start on first visit, show numbered steps, and can be replayed via a persistent button.

## Execution Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1 | 2 | Setup & Core Infrastructure |
| Phase 2 | 4 | Page Integrations |
| **Total** | **6** | |

**Parallel Opportunities:**
- Phase 2 tasks (2.1-2.4) can all run in parallel after Phase 1 completes

---

## Phase 1: Setup & Core Infrastructure

### Task 1.1: Install Driver.js and Create Tour Definitions

**Description:** Install Driver.js package and create the tour configuration file with all step definitions
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None

**Implementation Steps:**

1. Install Driver.js:
```bash
npm install driver.js
```

2. Create `lib/onboarding/tours.ts`:
```typescript
import type { DriveStep } from 'driver.js';

export type TourId = 'dashboard' | 'research' | 'readiness' | 'artifacts';

export const TOURS: Record<TourId, DriveStep[]> = {
  dashboard: [
    {
      element: '[data-tour="getting-started"]',
      popover: {
        title: 'Your Progress Tracker',
        description: 'This checklist shows your setup progress. Complete each step to build your AI guru.',
      },
    },
    {
      element: '[data-tour="activity-tiles"]',
      popover: {
        title: 'Quick Stats',
        description: 'These tiles show your research runs, recommendations, artifacts, and profile status. Click any tile to dive deeper.',
      },
    },
    {
      element: '[data-tour="guru-profile"]',
      popover: {
        title: "Your Guru's Identity",
        description: "This is your guru's teaching persona. It defines the domain, audience, and teaching style.",
      },
    },
    {
      element: '[data-tour="recent-activity"]',
      popover: {
        title: 'Activity Feed',
        description: 'See your latest research runs and generated artifacts here. Click to view details.',
      },
    },
    {
      element: '[data-tour="readiness-summary"]',
      popover: {
        title: 'Ready to Create?',
        description: 'This shows if your knowledge base is ready for content generation. Address any gaps before generating artifacts.',
      },
    },
  ],

  research: [
    {
      element: '[data-tour="readiness-indicator"]',
      popover: {
        title: 'Knowledge Readiness',
        description: "This bar shows how complete your guru's knowledge is. Higher is better!",
      },
    },
    {
      element: '[data-tour="suggested-topics"]',
      popover: {
        title: 'What to Research',
        description: 'These are AI-detected gaps in your knowledge base. Red means critical, amber means suggested. Click any topic to start researching it.',
      },
    },
    {
      element: '[data-tour="research-assistant"]',
      popover: {
        title: 'AI Research Partner',
        description: 'Describe what you want to research, and the AI will search the web, analyze sources, and generate recommendations for your corpus.',
      },
    },
    {
      element: '[data-tour="research-history"]',
      popover: {
        title: 'Past Research',
        description: 'All your previous research runs appear here. Click to view findings and recommendations.',
      },
    },
  ],

  readiness: [
    {
      element: '[data-tour="overall-score"]',
      popover: {
        title: 'Your Readiness Score',
        description: "This percentage shows how prepared your guru is to create teaching content. 60%+ with no critical gaps means you're ready!",
      },
    },
    {
      element: '[data-tour="score-breakdown"]',
      popover: {
        title: 'Two Components',
        description: "Profile completeness measures your guru's identity setup. Knowledge coverage measures how well your corpus covers essential teaching dimensions.",
      },
    },
    {
      element: '[data-tour="critical-gaps"]',
      popover: {
        title: 'Must-Fix Gaps',
        description: 'These dimensions are essential for teaching but have low coverage. Research these topics before generating content.',
      },
    },
    {
      element: '[data-tour="dimension-coverage"]',
      popover: {
        title: 'Knowledge Breakdown',
        description: 'Each dimension represents an aspect of good teaching (foundations, progression, mistakes, etc.). Higher coverage = better teaching ability.',
      },
    },
    {
      element: '[data-tour="reassess-button"]',
      popover: {
        title: 'Refresh Score',
        description: 'After adding research, click this to re-analyze your corpus and update the readiness score.',
      },
    },
  ],

  artifacts: [
    {
      element: '[data-tour="artifact-tabs"]',
      popover: {
        title: 'Three Artifact Types',
        description: 'Mental Model = core concepts. Curriculum = structured lessons. Drills = practice exercises. Generate them in order for best results.',
      },
    },
    {
      element: '[data-tour="mode-toggle"]',
      popover: {
        title: 'Two Modes',
        description: 'Simple mode: one-click generation. Advanced mode: version history, prompts, and customization options.',
      },
    },
    {
      element: '[data-tour="generate-button"]',
      popover: {
        title: 'Create Your Content',
        description: 'Click Generate to create this artifact type. The AI uses your corpus and profile to build teaching content.',
      },
    },
    {
      element: '[data-tour="user-notes"]',
      popover: {
        title: 'Custom Instructions',
        description: 'Add notes here to guide generation. Example: "Focus on beginner mistakes" or "Include more examples".',
      },
    },
    {
      element: '[data-tour="artifact-content"]',
      popover: {
        title: 'Your Generated Content',
        description: 'After generation, your artifact appears here. Review it, then proceed to the next artifact type.',
      },
    },
  ],
};
```

**Acceptance Criteria:**
- [ ] Driver.js installed and in package.json
- [ ] `lib/onboarding/tours.ts` created with all 4 tour definitions
- [ ] TypeScript types properly defined (TourId, DriveStep)
- [ ] All 19 tooltip steps defined (5+4+5+5)

---

### Task 1.2: Create usePageTour Hook and TourPageButton Component

**Description:** Create the React hook for tour management and the replay button component
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Implementation Steps:**

1. Create `lib/onboarding/usePageTour.ts`:
```typescript
'use client';

import { useEffect, useCallback, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { TOURS, type TourId } from './tours';

const MOBILE_BREAKPOINT = 768;

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function usePageTour(tourId: TourId) {
  const storageKey = `tour-seen-${tourId}`;
  const [hasSeen, setHasSeen] = useState(true); // Default true to prevent flash

  // Check localStorage on mount
  useEffect(() => {
    const seen = localStorage.getItem(storageKey) === 'true';
    setHasSeen(seen);
  }, [storageKey]);

  const markSeen = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setHasSeen(true);
  }, [storageKey]);

  const startTour = useCallback(() => {
    if (isMobile()) return;

    const steps = TOURS[tourId];
    if (!steps?.length) return;

    // Driver.js automatically skips steps where the target element doesn't exist
    // (e.g., "Getting Started" card hidden for non-new projects)
    const driverObj = driver({
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      onDestroyed: markSeen,
      steps,
    });

    driverObj.drive();
  }, [tourId, markSeen]);

  // Auto-start on first visit (non-mobile only)
  useEffect(() => {
    if (!hasSeen && !isMobile()) {
      // Small delay to ensure DOM elements are rendered
      const timer = setTimeout(startTour, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeen, startTour]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasSeen(false);
  }, [storageKey]);

  return { hasSeen, startTour, resetTour };
}
```

2. Create `lib/onboarding/TourPageButton.tsx`:
```typescript
'use client';

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageTour } from './usePageTour';
import type { TourId } from './tours';

interface TourPageButtonProps {
  tourId: TourId;
}

export function TourPageButton({ tourId }: TourPageButtonProps) {
  const { startTour } = usePageTour(tourId);

  // Use CSS to hide on mobile (avoids SSR hydration mismatch)
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={startTour}
      className="text-muted-foreground hover:text-foreground hidden md:inline-flex"
      title="Tour this page"
    >
      <HelpCircle className="h-4 w-4 mr-1" />
      Tour Page
    </Button>
  );
}
```

3. Create `lib/onboarding/index.ts` for clean exports:
```typescript
export { usePageTour } from './usePageTour';
export { TourPageButton } from './TourPageButton';
export { TOURS, type TourId } from './tours';
```

**Acceptance Criteria:**
- [ ] `usePageTour` hook handles auto-start, localStorage, and replay
- [ ] `TourPageButton` component renders with correct styling
- [ ] Mobile detection works (< 768px)
- [ ] Button hidden on mobile via CSS (no hydration mismatch)
- [ ] Tour auto-starts on first visit with 500ms delay
- [ ] Tour marked as seen on completion or exit

---

## Phase 2: Page Integrations

### Task 2.1: Integrate Tour into Dashboard

**Description:** Add tour integration to SimplifiedDashboard component
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Tasks 2.2, 2.3, 2.4

**Files to modify:** `components/dashboard/SimplifiedDashboard.tsx`

**Implementation Steps:**

1. Add imports:
```typescript
import { TourPageButton } from '@/lib/onboarding/TourPageButton';
```

2. Add TourPageButton to header (after existing buttons):
```typescript
<div className="flex gap-2">
  <TourPageButton tourId="dashboard" />
  <Button asChild variant="outline" size="sm">
    ...
  </Button>
</div>
```

3. Add `data-tour` attributes to target elements:
```typescript
// Getting Started card
{isNewProject && (
  <Card data-tour="getting-started" className="border-blue-200 bg-blue-50 ...">
    ...
  </Card>
)}

// Activity Tiles grid
<div data-tour="activity-tiles" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  ...
</div>

// Guru Profile card
<Card data-tour="guru-profile">
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      <User className="w-5 h-5" />
      Guru Profile
    </CardTitle>
  </CardHeader>
  ...
</Card>

// Recent Activity card
<Card data-tour="recent-activity">
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      <Target className="w-5 h-5" />
      Recent Activity
    </CardTitle>
  </CardHeader>
  ...
</Card>

// Readiness Summary wrapper
{hasProfile && (
  <div data-tour="readiness-summary">
    <ReadinessSummary projectId={project.id} />
  </div>
)}
```

**Acceptance Criteria:**
- [ ] TourPageButton visible in dashboard header
- [ ] All 5 dashboard elements have `data-tour` attributes
- [ ] Tour auto-starts on first visit
- [ ] "Tour Page" button triggers replay
- [ ] Tour skips "Getting Started" when not visible

---

### Task 2.2: Integrate Tour into Research Page

**Description:** Add tour integration to ResearchPageContent component
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Tasks 2.1, 2.3, 2.4

**Files to modify:** `app/projects/[id]/research/ResearchPageContent.tsx`

**Implementation Steps:**

1. Add imports:
```typescript
import { TourPageButton } from '@/lib/onboarding/TourPageButton';
```

2. Add TourPageButton (create header section if needed):
```typescript
<div className="flex justify-between items-center mb-6">
  <h1 className="text-2xl font-bold">Research</h1>
  <TourPageButton tourId="research" />
</div>
```

3. Add `data-tour` attributes:
```typescript
// Inline Readiness Indicator
<div data-tour="readiness-indicator">
  <InlineReadinessIndicator
    projectId={projectId}
    refreshTrigger={readinessRefreshTrigger}
  />
</div>

// Suggested Research Topics card
{readiness && (...) && (
  <Card data-tour="suggested-topics">
    <CardHeader>
      <CardTitle className="text-lg">Suggested Research Topics</CardTitle>
    </CardHeader>
    ...
  </Card>
)}

// Research Assistant card
<Card data-tour="research-assistant">
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      <Search className="w-5 h-5" />
      Research Assistant
    </CardTitle>
  </CardHeader>
  ...
</Card>

// Research History section
{researchRuns.length > 0 && (
  <Card data-tour="research-history">
    <CardHeader>
      <CardTitle className="text-lg">Research History</CardTitle>
    </CardHeader>
    ...
  </Card>
)}
```

**Acceptance Criteria:**
- [ ] TourPageButton visible on research page
- [ ] All 4 research elements have `data-tour` attributes
- [ ] Tour auto-starts on first visit
- [ ] Tour skips missing sections gracefully

---

### Task 2.3: Integrate Tour into Readiness Page

**Description:** Add tour integration to ReadinessPageContent component
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Tasks 2.1, 2.2, 2.4

**Files to modify:** `app/projects/[id]/readiness/ReadinessPageContent.tsx`

**Implementation Steps:**

1. Add imports:
```typescript
import { TourPageButton } from '@/lib/onboarding/TourPageButton';
```

2. Add TourPageButton (create header if needed):
```typescript
<div className="flex justify-between items-center mb-6">
  <h1 className="text-2xl font-bold">Readiness Score</h1>
  <TourPageButton tourId="readiness" />
</div>
```

3. Add `data-tour` attributes:
```typescript
// Overall Score card
<Card data-tour="overall-score" className={isReady ? 'border-green-200' : 'border-amber-200'}>
  ...
</Card>

// Score breakdown (Profile/Knowledge) - wrap the grid
<div data-tour="score-breakdown" className="grid md:grid-cols-2 gap-6">
  <div>
    <div className="text-sm font-medium text-muted-foreground mb-2">Profile Completeness</div>
    ...
  </div>
  <div>
    <div className="text-sm font-medium text-muted-foreground mb-2">Knowledge Coverage</div>
    ...
  </div>
</div>

// Critical Gaps card
{score.criticalGaps.length > 0 && (
  <Card data-tour="critical-gaps" className="border-red-200">
    ...
  </Card>
)}

// Dimension Coverage card
<Card data-tour="dimension-coverage">
  <CardHeader>
    <CardTitle className="text-lg">Dimension Coverage</CardTitle>
  </CardHeader>
  ...
</Card>

// Re-assess button - wrap in span or div
<Button
  data-tour="reassess-button"
  variant="outline"
  onClick={handleReassess}
  disabled={reassessing}
>
  ...
</Button>
```

**Acceptance Criteria:**
- [ ] TourPageButton visible on readiness page
- [ ] All 5 readiness elements have `data-tour` attributes
- [ ] Tour auto-starts on first visit
- [ ] Tour skips "Critical Gaps" when none exist

---

### Task 2.4: Integrate Tour into Artifacts Page

**Description:** Add tour integration to UnifiedArtifactPage component
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Tasks 2.1, 2.2, 2.3

**Files to modify:** `components/artifacts/UnifiedArtifactPage.tsx`

**Implementation Steps:**

1. Add imports:
```typescript
import { TourPageButton } from '@/lib/onboarding/TourPageButton';
```

2. Add TourPageButton to TeachingPageHeader or create space for it:
```typescript
// In the header area
<div className="flex justify-end mb-2">
  <TourPageButton tourId="artifacts" />
</div>
```

3. Add `data-tour` attributes:
```typescript
// Artifact Tab Bar
<div data-tour="artifact-tabs">
  <ArtifactTabBar
    projectId={projectId}
    artifactsSummary={allArtifactsSummary}
  />
</div>

// Mode toggle (in TeachingPageHeader)
<div data-tour="mode-toggle">
  {/* Simple/Advanced toggle */}
</div>

// Generate button (in SimpleToolbar)
<div data-tour="generate-button">
  {/* Generate button area */}
</div>

// User notes field (in SimpleToolbar)
<div data-tour="user-notes">
  {/* Notes textarea */}
</div>

// Artifact content area
<div data-tour="artifact-content">
  {artifact && artifact.status === 'COMPLETED' && hasValidContent(artifact) && (
    <TypeSpecificRenderer
      artifact={artifact}
      projectId={projectId}
      showTOC={advancedMode}
    />
  )}
</div>
```

**Note:** May need to add `data-tour` attributes to child components (TeachingPageHeader, SimpleToolbar) or wrap elements with divs.

**Acceptance Criteria:**
- [ ] TourPageButton visible on artifacts page
- [ ] All 5 artifacts elements have `data-tour` attributes
- [ ] Tour auto-starts on first visit
- [ ] Tour works in both Simple and Advanced modes

---

## Dependency Graph

```
Task 1.1 (Install & Tours)
    ↓
Task 1.2 (Hook & Button)
    ↓
    ├── Task 2.1 (Dashboard) ─┐
    ├── Task 2.2 (Research)  ─┼── Can run in parallel
    ├── Task 2.3 (Readiness) ─┤
    └── Task 2.4 (Artifacts) ─┘
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Driver.js missing element handling | Low | Low | Driver.js handles this gracefully by default |
| SSR hydration mismatch | Medium | Low | Using CSS `hidden md:inline-flex` pattern |
| Tour interfering with page interactions | Low | Medium | `onDestroyed` callback properly marks seen |
| localStorage not available | Very Low | Low | Hook defaults to `hasSeen: true` |

## Manual Testing Checklist

After implementation, verify:
- [ ] Dashboard tour: 5 steps, all visible
- [ ] Research tour: 4 steps, handles missing sections
- [ ] Readiness tour: 5 steps, handles missing Critical Gaps
- [ ] Artifacts tour: 5 steps, works in Simple/Advanced mode
- [ ] Persistence: refresh page, tour doesn't restart
- [ ] Replay: "Tour Page" button restarts tour
- [ ] Mobile: no tour, no button (< 768px)
- [ ] Exit: clicking outside or Escape exits and marks seen
