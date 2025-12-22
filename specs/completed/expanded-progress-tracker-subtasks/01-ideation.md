# Expanded Artifact Generation Progress Tracker with Sub-task Visibility

**Slug:** expanded-progress-tracker-subtasks
**Author:** Claude Code
**Date:** 2025-12-12
**Branch:** feat/expanded-progress-tracker-subtasks
**Related:** Ground Truth verification system, TeachingProgressTracker component

---

## 1) Intent & Assumptions

- **Task brief:** Redesign the artifact generation progress tracker to be a full-width shared component that spans beneath all three artifact tiles (Mental Model, Curriculum, Drill Series). The tracker should show detailed sub-task visibility for longer-running phases, particularly the "Verifying" phase that checks content against the GNU Backgammon ground truth engine. Currently, verification shows 0 tool calls and 0 claims, suggesting the verification process may not be running or reporting correctly.

- **Assumptions:**
  - The full-width tracker will only appear when an artifact is actively generating
  - Key sub-tasks (like verification claims) will be tracked in the database
  - Other sub-tasks will be estimated client-side based on elapsed time
  - High-detail view will show each claim being verified with engine responses
  - Ground Truth verification is the primary phase needing sub-task visibility
  - The existing polling mechanism (3-second interval) can be extended for sub-task updates

- **Out of scope:**
  - Changing the actual generation logic or prompts
  - Modifying Ground Truth verification algorithms
  - Adding progress tracking to phases that complete in <5 seconds
  - Historical progress replay (only show active generation)

---

## 2) Pre-reading Log

- `components/guru/TeachingProgressTracker.tsx`: Current 5-6 phase tracker with animated progress bar, shows phase names and time estimates, but no sub-task visibility
- `components/guru/GuruTeachingManager.tsx`: Contains ArtifactCard component that renders inline TeachingProgressTracker for each tile when generating
- `lib/teaching/constants.ts`: Phase definitions - Mental Model (5 phases), Curriculum/Drill Series (6 phases including VERIFYING_CONTENT)
- `lib/inngest-functions.ts`: Background job orchestration with `updateArtifactProgress()` helper, verification happens at lines 581-636 (curriculum) and 805-874 (drill series)
- `lib/groundTruth/verification/batchVerifier.ts`: Main verification function `verifyClaimsAgainstGroundTruth()` - this is where claims are checked against GNU engine
- `prisma/schema.prisma`: GuruArtifact model with `progressStage`, `verificationStatus`, and `verificationDetails` fields
- `app/api/projects/[id]/guru/artifacts/route.ts`: API returns progressStage in response, polled every 3 seconds

---

## 3) Codebase Map

### Primary Components/Modules

| File | Role |
|------|------|
| `components/guru/TeachingProgressTracker.tsx` | Current phase-based progress display (lines 1-113) |
| `components/guru/GuruTeachingManager.tsx` | Artifact tile grid + polling logic (lines 104-142 for polling, 388-547 for ArtifactCard) |
| `lib/inngest-functions.ts` | Background job progress updates (lines 309-315 for helper, 466-673 for curriculum, 678-904 for drill series) |
| `lib/groundTruth/verification/batchVerifier.ts` | Claim verification against GT engine (line 66+) |
| `lib/teaching/constants.ts` | Phase definitions and time estimates (lines 64-123) |

### Shared Dependencies

- `lib/utils.ts` - `cn()` utility for Tailwind class merging
- `@/components/ui/*` - shadcn/ui components
- Prisma client for database updates
- Inngest step functions for background job orchestration

### Data Flow

```
User clicks Generate
    ↓
POST /api/projects/[id]/guru/{type}
    ↓
Create GuruArtifact (status=GENERATING)
    ↓
Fire Inngest event
    ↓
Inngest job runs with progress updates:
    updateArtifactProgress(artifactId, 'VERIFYING_CONTENT')
    ↓
For each claim in content:
    → Extract claim text
    → Query Ground Truth engine
    → Store result
    → [NEW] Update sub-task progress in DB
    ↓
GuruTeachingManager polls every 3s
    ↓
API returns progressStage + [NEW] subTaskProgress
    ↓
[NEW] FullWidthProgressTracker renders with detailed sub-tasks
```

### Potential Blast Radius

- **Components to modify:** GuruTeachingManager.tsx, TeachingProgressTracker.tsx (or new component)
- **Database changes:** New fields on GuruArtifact for sub-task tracking
- **Inngest functions:** Add sub-task progress updates during verification
- **API changes:** Include sub-task data in artifacts response
- **Types:** New interfaces for sub-task progress

---

## 4) Root Cause Analysis

**N/A** - This is a feature enhancement, not a bug fix.

However, the user noted that verification shows 0 tool calls and 0 claims. Investigation:
- The `verificationDetails` field stores `{ toolCalls: [], claims: [], summary: {...} }`
- If these are empty, either:
  1. Ground Truth was not enabled during generation
  2. Verification was skipped due to missing config
  3. The verification function encountered an error and returned empty results

This may be a separate issue to investigate if verification isn't running when expected.

---

## 5) Research

### Potential Solutions

#### 1. Full-Width Shared Progress Component (Recommended)

**Approach:** Create new `FullWidthProgressTracker` component that:
- Renders below the 3-tile grid when any artifact is generating
- Shows which artifact type is being generated
- Displays all phases with current phase expanded
- Shows real-time sub-task progress for verification phase

**Pros:**
- Clean visual hierarchy - detail below overview
- Shared component reduces code duplication
- More screen real estate for detailed information
- Clear visual indication of what's happening

**Cons:**
- Requires layout restructuring
- May feel disconnected from the specific tile
- More complex state management

#### 2. Database-Tracked Sub-task Progress

**Approach:** Add new field to GuruArtifact:
```prisma
model GuruArtifact {
  // ... existing fields
  subTaskProgress Json?  // { phase: string, current: number, total: number, details: string }
}
```

Update Inngest jobs to call:
```typescript
await updateArtifactSubTask(artifactId, {
  phase: 'VERIFYING_CONTENT',
  current: 3,
  total: 12,
  details: 'Verifying checker play position: 24/20, 13/9'
})
```

**Pros:**
- Accurate real-time progress
- Persisted for debugging
- Can show exact claim being verified

**Cons:**
- More database writes (but small updates)
- Requires schema migration
- More complex Inngest job logic

#### 3. Hybrid Approach (Selected based on user input)

**Approach:**
- Track key sub-tasks in DB (verification claim progress)
- Estimate other sub-tasks client-side (corpus composition, structure analysis)
- Show high-detail view for verification with claim text and engine responses

**Implementation:**
1. Add `subTaskProgress` JSON field to GuruArtifact
2. Update batchVerifier to emit progress during claim verification
3. Update Inngest jobs to persist sub-task progress
4. Create FullWidthProgressTracker with expandable phase detail
5. Show claim-by-claim verification progress with engine query details

### Recommendation

**Implement Hybrid Approach with Full-Width Component:**
- Create `FullWidthProgressTracker.tsx` component
- Add `subTaskProgress` JSON field to schema
- Modify `verifyClaimsAgainstGroundTruth()` to accept progress callback
- Update Inngest jobs to persist sub-task progress during verification
- Show detailed verification view: "Verifying claim 3/12: Double shot with 64 - Expected: Correct, Engine: MATCH"

---

## 6) Clarifications (Resolved)

1. **Sub-task tracking:** Hybrid - Track key sub-tasks in DB (verification claims), estimate others client-side
2. **Tracker visibility:** Active only - Show full-width tracker only when artifact is generating
3. **Verification detail level:** High detail - Show each claim being verified with engine responses

---

## 7) Proposed UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Guru Teaching Pipeline                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ Mental Model │  │  Curriculum  │  │ Drill Series │                       │
│  │   ✓ Ready    │  │  Generating  │  │  Not Ready   │                       │
│  │   [View]     │  │     ●●●      │  │  [Generate]  │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Generating Curriculum...                                            2:34    │
│                                                                              │
│  ○ Loading    ○ Analyzing    ○ Designing    ● Verifying    ○ Saving        │
│  [============================================●                     ]       │
│                                                                              │
│  ▼ Verifying Content (3/12 claims)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Claim 1: Opening roll 31 - Best play: 8/5, 6/5                    │   │
│  │   Engine: MATCH (equity: +0.04)                                      │   │
│  │                                                                       │   │
│  │ ✓ Claim 2: Double shot with 64 from bar                              │   │
│  │   Engine: MATCH (equity: -0.12)                                      │   │
│  │                                                                       │   │
│  │ ● Claim 3: Anchor on 20-point with 52                                │   │
│  │   Querying GNU Backgammon...                                         │   │
│  │                                                                       │   │
│  │ ○ Claim 4: Prime building with 65                                    │   │
│  │ ○ Claim 5: Backgame timing                                           │   │
│  │ ... (7 more)                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8) Technical Implementation Outline

### Phase 1: Database Schema Update
- Add `subTaskProgress` JSON field to GuruArtifact
- Run migration

### Phase 2: Inngest Job Updates
- Modify `verifyClaimsAgainstGroundTruth()` to accept progress callback
- Add sub-task progress updates in curriculum/drill series jobs
- Persist claim-by-claim progress during verification

### Phase 3: API Updates
- Include `subTaskProgress` in artifacts API response
- Ensure no-cache headers for polling freshness

### Phase 4: UI Components
- Create `FullWidthProgressTracker.tsx` component
- Refactor `GuruTeachingManager.tsx` layout to place tracker below tiles
- Add expandable claim verification detail view
- Style with existing Tailwind/shadcn patterns

### Phase 5: Testing & Polish
- Test with actual Ground Truth verification
- Verify polling updates in real-time
- Add loading states and error handling

---

## 9) Open Questions

1. Should we also investigate why verification currently shows 0 claims/tool calls?
2. Should the tracker collapse after generation completes, or fade out with a summary?
3. For non-verification phases (Analyzing, Designing), should we show elapsed time vs estimated, or just a spinner?

---

## Next Steps

1. Create specification document (`02-spec.md`)
2. Break into implementation tasks (`03-tasks.md`)
3. Begin Phase 1: Database schema update
