# Page-Specific Onboarding Tooltips

## Status
Approved

## Authors
Claude Code | 2024-12-26

## Overview

Add step-by-step onboarding tooltip tours to 4 key pages using Driver.js. Tours auto-start on first visit, show numbered steps (1 of N), and can be replayed via a persistent "Tour Page" button. Disabled on mobile.

## Problem Statement

First-time users land on complex pages (dashboard, research, readiness, artifacts) without understanding what the UI elements do or how to use them. This creates confusion and slows adoption. Users need contextual guidance that orients them to each page's purpose and interactions.

## Goals

- Auto-start tooltip tour on first visit to each of 4 pages
- Show numbered steps (e.g., "1 of 5") so users know tour length
- Provide "Next" and "Exit" buttons on each tooltip
- Persist "seen" state in localStorage (per-page, per-user)
- Add persistent "Tour Page" button for replay (non-intrusive)
- Disable tours on mobile (< 768px width)

## Non-Goals

- Cross-page tour continuity or prompts
- Video/media content in tooltips
- Backend persistence of tour state
- Analytics tracking of tooltip views
- Mobile-optimized tooltip positioning
- Admin-configurable tooltip content
- Comprehensive app-wide onboarding wizard

---

## Technical Approach

### Library: Driver.js

- **Bundle:** ~5kb gzipped
- **Compatibility:** React 19 + Next.js 15 (framework-agnostic)
- **License:** MIT

### Architecture

```
lib/onboarding/
├── tours.ts           # Tour definitions (steps per page)
├── usePageTour.ts     # Hook: auto-start, localStorage, replay
└── TourPageButton.tsx # Persistent replay button component
```

### Key Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `driver.js` dependency |
| `components/dashboard/SimplifiedDashboard.tsx` | Add `data-tour` attributes, integrate hook |
| `app/projects/[id]/research/ResearchPageContent.tsx` | Add `data-tour` attributes, integrate hook |
| `app/projects/[id]/readiness/ReadinessPageContent.tsx` | Add `data-tour` attributes, integrate hook |
| `components/artifacts/UnifiedArtifactPage.tsx` | Add `data-tour` attributes, integrate hook |

---

## Implementation Details

### 1. Install Driver.js

```bash
npm install driver.js
```

### 2. Tour Definitions

```typescript
// lib/onboarding/tours.ts
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

### 3. Page Tour Hook

```typescript
// lib/onboarding/usePageTour.ts
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
      showProgress: true,        // Shows "1 of 5" etc.
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      onDestroyed: markSeen,     // Mark seen when tour completes or exits
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

### 4. Tour Page Button Component

```typescript
// lib/onboarding/TourPageButton.tsx
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

### 5. Integration Example (Dashboard)

```typescript
// components/dashboard/SimplifiedDashboard.tsx
import { TourPageButton } from '@/lib/onboarding/TourPageButton';

export function SimplifiedDashboard({ project, isNewProject }: SimplifiedDashboardProps) {
  // TourPageButton handles tour initialization internally via usePageTour hook
  // No need to call usePageTour separately - this avoids duplicate initialization

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Header with Tour Button */}
      <div className="flex ... justify-between gap-4">
        <div>
          <h1 ...>{project.name}</h1>
          ...
        </div>
        <div className="flex gap-2">
          <TourPageButton tourId="dashboard" />
          {/* existing buttons */}
        </div>
      </div>

      {/* Getting Started - add data-tour attribute */}
      {isNewProject && (
        <Card data-tour="getting-started" className="...">
          ...
        </Card>
      )}

      {/* Activity Tiles - add data-tour attribute */}
      <div data-tour="activity-tiles" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ...
      </div>

      {/* Profile Summary - add data-tour attribute */}
      <Card data-tour="guru-profile">
        ...
      </Card>

      {/* Recent Activity - add data-tour attribute */}
      <Card data-tour="recent-activity">
        ...
      </Card>

      {/* Readiness Summary - add data-tour attribute */}
      {hasProfile && (
        <div data-tour="readiness-summary">
          <ReadinessSummary projectId={project.id} />
        </div>
      )}
    </div>
  );
}
```

### 6. Driver.js CSS Customization (Optional)

```css
/* Add to globals.css if custom styling needed */
.driver-popover {
  /* Match shadcn/ui styling */
  --driver-popover-bg: hsl(var(--popover));
  --driver-popover-color: hsl(var(--popover-foreground));
}
```

---

## User Experience

### Tour Flow
1. User navigates to page for first time
2. Tour auto-starts after 500ms (allows DOM to render)
3. First tooltip appears with highlight on target element
4. User sees "1 of 5" progress indicator
5. User clicks "Next" to advance or "Exit" to dismiss
6. On completion/exit, tour is marked as seen
7. "Tour Page" button remains visible for replay

### Button Placement
The "Tour Page" button appears in the page header, alongside existing action buttons. It's styled as a ghost button with a help icon to be visible but non-intrusive.

### Mobile Behavior
- Tours disabled entirely on screens < 768px
- "Tour Page" button hidden on mobile
- No fallback needed (desktop-only feature for now)

---

## Testing Approach

### Manual Verification
1. **Auto-start:** Visit dashboard → tour starts automatically
2. **Progress:** Verify "1 of 5" format appears correctly
3. **Navigation:** Click Next/Back to move through steps
4. **Exit:** Click outside or press Escape to exit early
5. **Persistence:** Refresh page → tour should NOT restart
6. **Replay:** Click "Tour Page" → tour restarts
7. **Mobile:** Resize to mobile width → no tour, no button

### Key Scenarios
- Tour targets element that doesn't exist (e.g., Getting Started hidden) → skip gracefully
- User exits mid-tour → marked as seen (no re-trigger)
- Clear localStorage → tour triggers again on next visit

---

## Open Questions

None - all clarifications resolved.

---

## Future Improvements and Enhancements

**OUT OF SCOPE for initial implementation:**

- **Analytics:** Track tour completion rates, drop-off points
- **Mobile support:** Adapt tooltip positioning for small screens
- **Conditional steps:** Show/hide steps based on page state (e.g., skip "Getting Started" step if card not visible)
- **Tour segmentation:** Different tours for new vs. returning users
- **Keyboard navigation:** Full keyboard support within tooltips
- **Custom styling:** Match tooltips exactly to shadcn/ui design system
- **Spotlight-only mode:** Highlight elements without tooltips for power users
- **Tour chaining:** Suggest next page's tour after completing current
- **A/B testing:** Test different tooltip copy for effectiveness
- **Admin configuration:** Allow admins to edit tooltip content without code changes

---

## References

- [Driver.js Documentation](https://driverjs.com/)
- [Driver.js GitHub](https://github.com/kamranahmedse/driver.js)
- Ideation document: `specs/onboarding-tooltips/01-ideation.md`
