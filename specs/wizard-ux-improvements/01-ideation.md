# Wizard UX Improvements - Ideation Document

## Executive Summary

This document addresses three interconnected UX issues in the Guru Builder wizard flow:

1. **Layout Width**: Narrow `max-w-4xl` constraints waste horizontal screen space
2. **Research Plan Bug**: Plans never appear after chat conversation due to prompt design
3. **Linear vs Dashboard UX**: Post-profile flow should shift from linear wizard to dashboard-centric iteration

---

## Issue 1: Layout Width Underutilization

### Problem Statement

The wizard pages (profile, research, readiness) use `max-w-4xl` (896px) constraint, wasting 40-60% of available screen space on desktop displays. The screenshot shows large white margins on both sides.

### Root Cause Analysis

**Files affected:**
- `app/projects/new/research/page.tsx:341,401` - Uses `max-w-4xl mx-auto`
- `app/projects/new/profile/page.tsx:95` - Uses `max-w-5xl mx-auto` (slightly wider but still constrained)

**Existing pattern in codebase:**
- `app/projects/[id]/page.tsx:68` - Uses `max-w-7xl mx-auto` (full dashboard width)

### Proposed Solution

Adopt the existing dashboard pattern (`max-w-7xl`) for all post-profile wizard pages. The ResearchChatAssistant already has a two-column layout (`grid-cols-2`) that would benefit from more width.

```
Current:    max-w-4xl (896px)  → ~40% of 1920px screen
Proposed:   max-w-7xl (1280px) → ~67% of 1920px screen
```

### Risk Assessment

**Low risk** - CSS-only change, no logic changes required.

---

## Issue 2: Research Plan Never Appears After Chat

### Problem Statement

User reported: "Everything worked pretty well all the way up until I was trying to get the research assistant to create a research plan for me. It went back-and-forth with me in the chat, but no research plan ever appeared."

### Root Cause Analysis

**File:** `app/api/research/refine-plan/route.ts:64-68`

```typescript
// System prompt tells GPT-4o:
Output format (JSON):
{
  "reply": "Your conversational response...",
  "updatedPlan": { ... } or null if no changes
}
```

**The bug:** The prompt instructs GPT to return `null` for `updatedPlan` "if no changes" are needed. On the **first user message**, there's no existing plan to "change," so GPT interprets this as "no changes needed" and returns `null`.

**Flow:**
1. User sends first message describing what they want to research
2. API sends to GPT with `currentPlan: null`
3. GPT sees "updatedPlan: null if no changes" → interprets as "don't create initial plan"
4. Returns `{ reply: "...", updatedPlan: null }`
5. Frontend shows chat reply but no plan appears

### Proposed Solution

**Option A: Modify prompt to generate initial plan (Recommended)**

Change the system prompt from:
```
"updatedPlan": { ... } or null if no changes
```

To:
```
"updatedPlan": Always provide a complete research plan. Include the full plan structure
even if confirming no changes are needed. Only use null if the user explicitly
indicates they don't want a plan.
```

**Option B: Seed with default plan**

Pre-populate `currentPlan` with a skeleton plan so GPT always has something to "modify."

**Option C: Two-stage approach**

First message triggers plan generation, subsequent messages refine it. Requires prompt logic changes.

### Risk Assessment

**Medium risk** - Prompt changes can have unpredictable effects on GPT behavior. Recommend testing with multiple conversation scenarios.

---

## Issue 3: Linear Wizard vs Dashboard-Centric UX

### Problem Statement

After creating a guru profile, the user is forced through a linear wizard:
```
Define Guru → Build Knowledge → Readiness Check → Create Content
```

But the desired UX is cyclical/dashboard-centric:
- View full profile at any time
- Run research iteratively
- Check readiness scores
- Generate content
- Return to any activity

### Current Flow Analysis

```
/projects/new/profile      → Creates project + profile
           ↓
/projects/new/research     → Linear step (no dashboard view)
           ↓
/projects/new/readiness    → Linear step (no dashboard view)
           ↓
/projects/new/create       → Linear step (no dashboard view)
```

**Missing capability:** No way to access project dashboard (`/projects/[id]`) from wizard flow, and no "View Full Profile" action.

### Existing Dashboard Infrastructure

The admin view at `/projects/[id]/page.tsx` already has all the components:
- `GuruProfileSection` - Full profile viewer/editor
- `GuruTeachingManager` - Content generation pipeline
- `ProjectAssessmentManager` - Readiness/assessment UI
- `GroundTruthEngineManager` - Ground truth configuration
- Research run list with "Start New Research" button

### Proposed Solution: Hybrid Model

After profile creation, redirect to a **simplified dashboard** (not admin view) that provides:

1. **Profile Summary Card** - Expandable view of full profile
2. **Activity Tiles** - Research, Readiness, Create Content (not linear steps)
3. **Guided Prompts** - Suggestions based on readiness gaps
4. **Status Indicators** - Visual progress without forced sequence

### ASCII Wireframes

#### Current Linear Wizard (Problem)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ○───○───○───○  Step 2 of 4                      │
│                 Define  Build  Ready  Create                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│         ┌─────────────────────────────────────────┐                 │
│         │                                         │                 │
│         │     Research Knowledge                  │                 │
│         │                                         │                 │
│         │     [narrow content - max-w-4xl]        │                 │
│         │                                         │                 │
│         │     Chat  |  Research Plan              │                 │
│         │     ...   |  (never appears!)           │                 │
│         │                                         │                 │
│         │                                         │                 │
│         └─────────────────────────────────────────┘                 │
│                                                                     │
│         [← Back to Profile]        [Continue to Readiness →]        │
│                                                                     │
│    ~~~~~~ 40% wasted space ~~~~~~~    ~~~~~~ 40% wasted ~~~~~       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Proposed Dashboard-Centric View (After Profile Creation)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Projects                                      [Guru Builder]        [User ▾]     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Backgammon Strategy Guru                                              [Edit Profile]│   │
│  │  ─────────────────────────────────────────────────────────────────────────────────── │   │
│  │  Domain: Backgammon Strategy                                                         │   │
│  │  Audience: Intermediate players aspiring to competitive levels                       │   │
│  │  Style: Analytical, explains "why" behind moves                                      │   │
│  │                                                          [▼ Expand Full Profile]     │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────── Readiness Score ──────┐                                                          │
│  │                              │                                                          │
│  │     ████████░░  78%          │    Critical Gaps:  ⚠ Foundations  ⚠ Common Mistakes      │
│  │     Ready to Create          │    Suggested:      💡 Examples    💡 Practice            │
│  │                              │                                                          │
│  └──────────────────────────────┘                                                          │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                       │ │
│  │  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐              │ │
│  │  │  📚 Research       │  │  📊 Readiness      │  │  ✨ Create         │              │ │
│  │  │                    │  │                    │  │                    │              │ │
│  │  │  5 sessions        │  │  78% score         │  │  3 artifacts       │              │ │
│  │  │  Last: 2 days ago  │  │  2 critical gaps   │  │  Mental Model ✓    │              │ │
│  │  │                    │  │                    │  │  Curriculum ✓      │              │ │
│  │  │  [Run Research]    │  │  [View Details]    │  │  [Generate More]   │              │ │
│  │  └────────────────────┘  └────────────────────┘  └────────────────────┘              │ │
│  │                                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  💡 Recommended Next Steps                                                          │   │
│  │  ───────────────────────────────────────────────────────────────────────────────── │   │
│  │  1. Address "Foundations" gap → [Research This]                                     │   │
│  │  2. Address "Common Mistakes" gap → [Research This]                                 │   │
│  │  3. Generate Drill Series for practice → [Create Drills]                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Recent Activity                                                                     │   │
│  │  • Research: "Opening principles" - 12 recommendations - 2 days ago                  │   │
│  │  • Created: Mental Model v1.2 - VERIFIED - 3 days ago                                │   │
│  │  • Research: "Checker play decisions" - 8 recommendations - 5 days ago               │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Research Modal/Panel (Opens from Dashboard)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  Research Knowledge                                                          [✕ Close]     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────┐  ┌─────────────────────────────────────────────┐│
│  │  Research Assistant                   │  │  Research Plan                              ││
│  │  ───────────────────────────────────  │  │  ─────────────────────────────────────────  ││
│  │                                       │  │                                             ││
│  │  🤖 Hello! What would you like your  │  │  Title: Opening Principles Research         ││
│  │     guru to learn about?             │  │                                             ││
│  │                                       │  │  Objective: Discover best practices for     ││
│  │  👤 I want to research opening       │  │  backgammon opening moves                   ││
│  │     principles and first-move        │  │                                             ││
│  │     decisions in backgammon.         │  │  Queries:                                   ││
│  │                                       │  │  • Opening roll best plays                 ││
│  │  🤖 Great! I've created a research   │  │  • Point-making priorities                  ││
│  │     plan for opening principles.     │  │  • Tempo vs structure tradeoffs             ││
│  │     The plan includes queries for... │  │                                             ││
│  │                                       │  │  Depth: MODERATE (~5-7 min)                 ││
│  │                                       │  │                                             ││
│  │  [Type your message...]      [Send]  │  │  [Edit Plan]    [▶ Execute Research]        ││
│  └───────────────────────────────────────┘  └─────────────────────────────────────────────┘│
│                                                                                             │
│  Suggested Topics (from readiness gaps):                                                    │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐                   │
│  │ ⚠ Foundations      │ │ ⚠ Common Mistakes   │ │ 💡 Examples         │                   │
│  │ [Research This →]   │ │ [Research This →]   │ │ [Research This →]   │                   │
│  └─────────────────────┘ └─────────────────────┘ └─────────────────────┘                   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Approach Options

#### Option A: New Simplified Dashboard Route (Recommended)

Create `/projects/[id]/dashboard` as a simplified view that:
- Reuses existing components from admin view
- Hides advanced features (corpus management, ground truth config)
- Focuses on workflow activities (research, readiness, create)
- Links to existing admin view for "Advanced Settings"

**Pros:** Clean separation, user-friendly
**Cons:** Another route to maintain

#### Option B: Redirect to Existing Admin View

After profile creation, redirect to `/projects/[id]` (existing admin view).

**Pros:** Zero new code
**Cons:** Overwhelming for new users, exposes advanced features too early

#### Option C: Wizard with Dashboard Tab

Keep wizard structure but add "Dashboard" tab that shows summary view.

**Pros:** Keeps wizard navigation familiar
**Cons:** Awkward UX, wizard pattern implies linear flow

---

## Clarification Questions

Before proceeding to specification, please clarify:

1. **Layout width preference:** Should we use `max-w-7xl` (1280px) or go even wider with `max-w-full` (with padding)?
>> lets go with just the regular max for now. we can always go wider later

2. **Research plan fix approach:**
   - Option A (modify prompt to always generate plan)
   - Option B (seed with default skeleton)
   - Option C (two-stage with explicit "generate plan" action)
>> option A

3. **Dashboard navigation:**
   - Should users be able to access the admin view (`/projects/[id]`) from the simplified dashboard?
   - Or should the simplified dashboard fully replace the admin view for typical users?
  >> no, this new experience is going to become the standard experience for typical users going forward. I may expose the admin layer to certain people, but that would be on a manual basis for just a handful of folks.

4. **First-time user guidance:**
   - Should the dashboard show a "getting started" checklist for new projects?
   - Should we keep the wizard stepper visible but as a reference, not a forced path?
  >> yes to the first, not sure about the second because again even if you've done everything once that's not really meaningful. If you can figure out some way of indicating that while still somehow indicating that your system might still need more work, even if it's done all of the steps, then I'm open to it.

5. **Mobile responsiveness:**
   - The wireframes show desktop layout. What are the mobile requirements?
   - Should research chat collapse to full-width single column on mobile?
  >> we'll figure out mobile later just focus on desktop. To the extent you have to think about the mobile with, just take whatever practical, basic approaches you think are reasonable to serve as the MVP approach for mobile, and if we really care to optimize it later, we can

---

## Files Requiring Changes

### Issue 1 (Layout Width)
- `app/projects/new/research/page.tsx` - Change `max-w-4xl` to `max-w-7xl`
- `app/projects/new/readiness/page.tsx` - Same change (if exists)

### Issue 2 (Research Plan Bug)
- `app/api/research/refine-plan/route.ts:41-68` - Modify SYSTEM_PROMPT

### Issue 3 (Dashboard UX)
- `app/projects/[id]/dashboard/page.tsx` - New simplified dashboard (Option A)
- `app/projects/new/profile/page.tsx:86` - Change redirect target
- `components/guru/SimplifiedDashboard.tsx` - New component (Option A)
- `components/wizard/WizardNavigation.tsx` - May need updates

---

## Technical Considerations

### Reusable Components (Already Exist)
- `GuruProfileSection` - Profile viewer with expand/collapse
- `ProjectAssessmentManager` - Readiness scoring
- `GuruTeachingManager` - Content generation pipeline
- `ResearchChatAssistant` - Research chat interface

### New Components Needed
- `DashboardActivityTiles` - Grid of Research/Readiness/Create tiles
- `RecommendedNextSteps` - Intelligent suggestions based on readiness
- `SimplifiedProfileCard` - Compact profile summary with expand

### API Changes
- None required for Issues 1 and 2
- Issue 3 may need `/api/projects/[id]/summary` endpoint for dashboard data

---

## Next Steps

1. Gather answers to clarification questions
2. Create `02-specification.md` with detailed implementation plan
3. Prioritize: Issue 2 (bug fix) → Issue 1 (quick win) → Issue 3 (larger UX change)

---

*Generated: 2025-12-19*
*Author: Claude Code*
*Status: IDEATION - Awaiting Clarification*
