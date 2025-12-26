# Onboarding Tooltips for Key Pages

**Slug:** onboarding-tooltips
**Author:** Claude Code
**Date:** 2024-12-26
**Branch:** preflight/onboarding-tooltips
**Related:** N/A (new feature)

---

## 1) Intent & Assumptions

- **Task brief:** Design page-by-page onboarding tooltips for first-time visitors on 4 key pages: project dashboard, research page, readiness score page, and artifacts page. Tooltips should explain what UI elements are and how to use them.

- **Assumptions:**
  - Tooltips appear once per page, per user (localStorage persistence)
  - Tooltips are sequential (step-by-step tour, not all visible at once)
  - User can skip/dismiss the tour at any time
  - Tours are page-specific (entering a page triggers its tour if not seen)
  - No backend changes needed (client-side state only)

- **Out of scope:**
  - Video tutorials or embedded media
  - Full product onboarding wizard (multi-page flow)
  - Admin-configurable tooltip content
  - Analytics tracking of tooltip views
  - Mobile-specific tour variations

---

## 2) Pre-reading Log

- `components/dashboard/SimplifiedDashboard.tsx`: Main dashboard with Getting Started checklist, Activity Tiles (Research Runs, Recommendations, Artifacts, Profile), Profile Summary, Recent Activity, Readiness Summary, GT Status Indicator
- `app/projects/[id]/research/ResearchPageContent.tsx`: Inline Readiness Indicator, Suggested Research Topics (Critical Gaps, Recommended Areas), Research Assistant chat, Research History
- `app/projects/[id]/readiness/ReadinessPageContent.tsx`: Overall Score card with Profile/Knowledge breakdown, GT Status, Critical Gaps list, Dimension Coverage grid, Re-assess button
- `components/artifacts/UnifiedArtifactPage.tsx`: Tab bar (Mental Model, Curriculum, Drills), Simple/Advanced mode toggle, Generation progress tracker, Artifact renderers

---

## 3) Codebase Map

- **Primary components/modules:**
  - `components/dashboard/SimplifiedDashboard.tsx` - Dashboard orchestrator
  - `components/dashboard/ActivityTile.tsx` - Clickable stat tiles
  - `components/dashboard/ReadinessSummary.tsx` - Readiness preview card
  - `app/projects/[id]/research/ResearchPageContent.tsx` - Research page
  - `app/projects/[id]/readiness/ReadinessPageContent.tsx` - Readiness page
  - `components/artifacts/UnifiedArtifactPage.tsx` - Artifacts page

- **Shared dependencies:**
  - `components/ui/` - shadcn components (Button, Card, Badge, Progress)
  - `lucide-react` - Icons

- **Data flow:**
  - Tour state: localStorage → React state → render tooltips
  - No server interaction needed

- **Feature flags/config:**
  - None currently; could add `NEXT_PUBLIC_ENABLE_ONBOARDING_TOURS`

- **Potential blast radius:**
  - Low - tooltips are overlay UI, no functional changes
  - CSS z-index considerations for tooltip visibility

---

## 4) Root Cause Analysis

*N/A - This is a new feature, not a bug fix.*

---

## 5) Research

### Potential Solutions

| Library | Bundle Size | React 19 | Next.js 15 | Tailwind | Maintained | License |
|---------|-------------|----------|------------|----------|------------|---------|
| **Driver.js** | ~5kb gzip | ✅ | ✅ | ✅ | ✅ (Dec 2024) | MIT |
| **Onborda** | ~15-20kb | ✅ | ✅ (native) | ✅ (native) | ✅ | MIT |
| react-joyride | ~12kb | ❌ (broken) | ❌ | ⚠️ | ✅ | MIT |
| reactour | ~10kb | ❌ (broken) | ❌ | ⚠️ | ⚠️ | MIT |
| Intro.js | ~15kb | ✅ | ✅ | ⚠️ | ✅ | AGPL* |
| Shepherd.js | ~25kb | ⚠️ | ⚠️ | ⚠️ | ❌ (archived) | MIT |
| Custom (Radix) | ~2kb+ | ✅ | ✅ | ✅ | N/A | N/A |

*Intro.js requires commercial license ($9.99+) for non-AGPL use.

### Detailed Analysis

**1. Driver.js** (Recommended)
- **Pros:** Lightest bundle, zero dependencies, framework-agnostic (no React 19 issues), excellent docs, active maintenance
- **Cons:** Not React-native (imperative API), requires manual element selection

**2. Onborda**
- **Pros:** Built for Next.js + Tailwind + Framer Motion, shadcn-native, declarative API
- **Cons:** Larger bundle, adds Framer Motion dependency if not already used

**3. Custom Solution (Radix Tooltip + State)**
- **Pros:** Zero new dependencies, full control, matches existing shadcn patterns
- **Cons:** More implementation effort, need to build step sequencing

### Recommendation

**Driver.js** is the best choice for this project because:
1. Smallest bundle size (~5kb)
2. Confirmed React 19 + Next.js 15 compatible
3. No dependency conflicts (framework-agnostic)
4. Simple API for step-by-step tours
5. Built-in highlight/overlay functionality
6. MIT license

---

## 6) Proposed Tooltips Per Page

### Page 1: Project Dashboard (`SimplifiedDashboard.tsx`)

**Tour: "dashboard-intro"** (5 steps)

| Step | Target Element | Title | Description |
|------|----------------|-------|-------------|
| 1 | Getting Started card | **Your Progress Tracker** | This checklist shows your setup progress. Complete each step to build your AI guru. |
| 2 | Activity Tiles grid | **Quick Stats** | These tiles show your research runs, recommendations, artifacts, and profile status. Click any tile to dive deeper. |
| 3 | Guru Profile card | **Your Guru's Identity** | This is your guru's teaching persona. It defines the domain, audience, and teaching style. |
| 4 | Recent Activity card | **Activity Feed** | See your latest research runs and generated artifacts here. Click to view details. |
| 5 | Readiness Summary card | **Ready to Create?** | This shows if your knowledge base is ready for content generation. Address any gaps before generating artifacts. |

---

### Page 2: Research Page (`ResearchPageContent.tsx`)

**Tour: "research-intro"** (4 steps)

| Step | Target Element | Title | Description |
|------|----------------|-------|-------------|
| 1 | Inline Readiness Indicator | **Knowledge Readiness** | This bar shows how complete your guru's knowledge is. Higher is better! |
| 2 | Suggested Research Topics card | **What to Research** | These are AI-detected gaps in your knowledge base. Red means critical, amber means suggested. Click any topic to start researching it. |
| 3 | Research Assistant card | **AI Research Partner** | Describe what you want to research, and the AI will search the web, analyze sources, and generate recommendations for your corpus. |
| 4 | Research History section | **Past Research** | All your previous research runs appear here. Click to view findings and recommendations. |

---

### Page 3: Readiness Score Page (`ReadinessPageContent.tsx`)

**Tour: "readiness-intro"** (5 steps)

| Step | Target Element | Title | Description |
|------|----------------|-------|-------------|
| 1 | Overall Readiness card | **Your Readiness Score** | This percentage shows how prepared your guru is to create teaching content. 60%+ with no critical gaps means you're ready! |
| 2 | Profile/Knowledge breakdown | **Two Components** | Profile completeness measures your guru's identity setup. Knowledge coverage measures how well your corpus covers essential teaching dimensions. |
| 3 | Critical Gaps card | **Must-Fix Gaps** | These dimensions are essential for teaching but have low coverage. Research these topics before generating content. |
| 4 | Dimension Coverage grid | **Knowledge Breakdown** | Each dimension represents an aspect of good teaching (foundations, progression, mistakes, etc.). Higher coverage = better teaching ability. |
| 5 | Re-assess Readiness button | **Refresh Score** | After adding research, click this to re-analyze your corpus and update the readiness score. |

---

### Page 4: Artifacts Page (`UnifiedArtifactPage.tsx`)

**Tour: "artifacts-intro"** (5 steps)

| Step | Target Element | Title | Description |
|------|----------------|-------|-------------|
| 1 | Artifact Tab Bar | **Three Artifact Types** | Mental Model = core concepts. Curriculum = structured lessons. Drills = practice exercises. Generate them in order for best results. |
| 2 | Simple/Advanced toggle | **Two Modes** | Simple mode: one-click generation. Advanced mode: version history, prompts, and customization options. |
| 3 | Generate button (SimpleToolbar) | **Create Your Content** | Click Generate to create this artifact type. The AI uses your corpus and profile to build teaching content. |
| 4 | User Notes field | **Custom Instructions** | Add notes here to guide generation. Example: "Focus on beginner mistakes" or "Include more examples". |
| 5 | Artifact content area | **Your Generated Content** | After generation, your artifact appears here. Review it, then proceed to the next artifact type. |

---

## 7) Clarifications

1. **Tour Trigger Timing:** Should the tour auto-start on first page visit, or require user to click "Take Tour" button?

2. **Skip Behavior:** Should "Skip Tour" skip just the current step, or dismiss the entire tour for that page?

3. **Re-trigger Option:** Should there be a "Replay Tour" option in the UI for users who want to see it again?

4. **Cross-Page Continuity:** If a user completes the dashboard tour, should we prompt them to take the research tour when they navigate there, or let them discover it naturally?

5. **Mobile Behavior:** Should tooltips be disabled on mobile (small screens), or adapt to mobile-friendly positioning?

---

## 8) Implementation Approach (Preview)

```typescript
// lib/onboarding/tours.ts
export const TOURS = {
  'dashboard-intro': [
    { element: '[data-tour="getting-started"]', title: 'Your Progress Tracker', ... },
    { element: '[data-tour="activity-tiles"]', title: 'Quick Stats', ... },
    // ...
  ],
  'research-intro': [...],
  'readiness-intro': [...],
  'artifacts-intro': [...],
};

// hooks/useOnboardingTour.ts
export function useOnboardingTour(tourId: string) {
  const [hasSeenTour, setHasSeenTour] = useLocalStorage(`tour-${tourId}`, false);

  const startTour = useCallback(() => {
    if (hasSeenTour) return;

    const driver = window.driver.js.driver({
      steps: TOURS[tourId],
      onDestroyed: () => setHasSeenTour(true),
    });
    driver.drive();
  }, [tourId, hasSeenTour]);

  return { hasSeenTour, startTour, resetTour: () => setHasSeenTour(false) };
}
```

---

## Next Steps

1. **User to review proposed tooltips** and provide feedback on content/ordering
2. Clarify the 5 questions above
3. Create lean spec with final tooltip content
4. Implement with Driver.js
