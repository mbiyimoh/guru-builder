# Specification: Expanded Progress Tracker with Sub-task Visibility

**Slug:** expanded-progress-tracker-subtasks
**Author:** Claude Code
**Date:** 2025-12-12
**Status:** Draft
**Branch:** feat/expanded-progress-tracker-subtasks

---

## 1. Overview

### Problem Statement
The current per-tile TeachingProgressTracker provides phase-level visibility but lacks detail for longer-running phases. The "Verifying" phase that checks content against the GNU Backgammon ground truth engine shows no sub-task progress, leaving users uncertain about what's happening. Additionally, verification currently shows "0 tool calls, 0 claims" suggesting the verification process may not be reporting correctly.

### Solution
Create a full-width `FullWidthProgressTracker` component that:
1. Spans beneath all three artifact tiles when any artifact is generating
2. Shows detailed sub-task progress for the verification phase
3. Displays claim-by-claim verification with engine query results
4. Tracks key sub-tasks in the database for accurate progress

### User Value
- Clear visibility into what the system is doing during artifact generation
- Confidence that verification is actually checking claims against the engine
- Better understanding of generation time expectations

---

## 2. Requirements

### Functional Requirements

#### FR1: Full-Width Progress Component
- **FR1.1**: Display tracker spanning full width beneath the 3-tile grid
- **FR1.2**: Show only when at least one artifact is actively generating
- **FR1.3**: Display which artifact type is currently generating (Mental Model, Curriculum, Drill Series)
- **FR1.4**: Show all phases with current phase highlighted/expanded
- **FR1.5**: Fade out with success summary after completion (3 second delay)

#### FR2: Phase Progress Display
- **FR2.1**: Show elapsed time vs estimated time for each phase
- **FR2.2**: Indicate completed phases with checkmark
- **FR2.3**: Indicate current phase with animated indicator
- **FR2.4**: Indicate pending phases with neutral styling

#### FR3: Verification Sub-task Visibility
- **FR3.1**: Track claim count in database during verification
- **FR3.2**: Display "Verifying claim X of Y" progress
- **FR3.3**: Show claim text being verified (truncated if long)
- **FR3.4**: Display engine response status (querying, match, mismatch)
- **FR3.5**: Expandable detail view showing completed claims with results

#### FR4: Database Tracking
- **FR4.1**: Add `subTaskProgress` JSON field to GuruArtifact model
- **FR4.2**: Store current phase, current/total counts, and detail text
- **FR4.3**: Update sub-task progress during verification loop
- **FR4.4**: Include sub-task data in API polling response

### Non-Functional Requirements

#### NFR1: Performance
- Polling interval remains 3 seconds (no increase in frequency)
- Sub-task DB updates batched to avoid excessive writes
- Component renders efficiently without layout thrash

#### NFR2: Compatibility
- Works with existing polling mechanism in GuruTeachingManager
- Graceful degradation for artifacts without sub-task data
- No changes to actual generation or verification logic

---

## 3. Technical Design

### 3.1 Database Schema Update

```prisma
model GuruArtifact {
  // ... existing fields

  // NEW: Sub-task progress for detailed tracking
  subTaskProgress Json?  // SubTaskProgress type
}
```

**SubTaskProgress Type:**
```typescript
interface SubTaskProgress {
  phase: string;           // Current phase name
  current: number;         // Current sub-task index
  total: number;           // Total sub-tasks in phase
  details: string;         // Human-readable detail (e.g., claim text)
  claims?: ClaimProgress[]; // Optional: All claim progress for verification
}

interface ClaimProgress {
  index: number;
  text: string;          // Truncated claim text
  status: 'pending' | 'querying' | 'verified' | 'failed';
  result?: string;       // Engine result summary
}
```

### 3.2 Component Architecture

```
GuruTeachingManager.tsx
├── ArtifactCard (Mental Model)
├── ArtifactCard (Curriculum)
├── ArtifactCard (Drill Series)
└── FullWidthProgressTracker (NEW)
    ├── PhaseTimeline
    │   ├── PhaseStep (completed)
    │   ├── PhaseStep (current, expanded)
    │   └── PhaseStep (pending)
    └── SubTaskDetail (for verification phase)
        ├── ClaimProgress (completed)
        ├── ClaimProgress (current, animated)
        └── ClaimProgress (pending, collapsed)
```

### 3.3 Data Flow

```
1. User clicks Generate (Curriculum/Drill Series)
   ↓
2. API creates GuruArtifact (status=GENERATING, progressStage=LOADING)
   ↓
3. Inngest job starts, updates progressStage through phases
   ↓
4. On VERIFYING_CONTENT phase:
   a. Count total claims to verify
   b. For each claim:
      - Update subTaskProgress with current claim index/text
      - Query Ground Truth engine
      - Update claim status in subTaskProgress
   ↓
5. GuruTeachingManager polls every 3s
   ↓
6. API returns progressStage + subTaskProgress
   ↓
7. FullWidthProgressTracker renders with detailed view
   ↓
8. On completion, show success summary for 3s, then fade out
```

### 3.4 API Response Enhancement

**Current response:**
```json
{
  "artifacts": [{
    "id": "...",
    "type": "CURRICULUM",
    "status": "GENERATING",
    "progressStage": "VERIFYING_CONTENT"
  }]
}
```

**Enhanced response:**
```json
{
  "artifacts": [{
    "id": "...",
    "type": "CURRICULUM",
    "status": "GENERATING",
    "progressStage": "VERIFYING_CONTENT",
    "subTaskProgress": {
      "phase": "VERIFYING_CONTENT",
      "current": 3,
      "total": 12,
      "details": "Anchor on 20-point with 52",
      "claims": [
        { "index": 0, "text": "Opening roll 31...", "status": "verified", "result": "MATCH" },
        { "index": 1, "text": "Double shot with 64...", "status": "verified", "result": "MATCH" },
        { "index": 2, "text": "Anchor on 20-point...", "status": "querying" }
      ]
    }
  }]
}
```

### 3.5 Inngest Job Modifications

**Location:** `lib/inngest-functions.ts`

Add helper function:
```typescript
async function updateSubTaskProgress(
  artifactId: string,
  progress: SubTaskProgress
): Promise<void> {
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: { subTaskProgress: progress as Prisma.JsonObject }
  });
}
```

Modify verification loop (curriculum ~line 600, drill series ~line 850):
```typescript
// Before verification loop
const claims = extractClaims(content);
await updateSubTaskProgress(artifactId, {
  phase: 'VERIFYING_CONTENT',
  current: 0,
  total: claims.length,
  details: 'Starting verification...',
  claims: claims.map((c, i) => ({
    index: i,
    text: c.text.slice(0, 50),
    status: 'pending'
  }))
});

// Inside verification loop
for (let i = 0; i < claims.length; i++) {
  await updateSubTaskProgress(artifactId, {
    phase: 'VERIFYING_CONTENT',
    current: i + 1,
    total: claims.length,
    details: claims[i].text.slice(0, 50),
    claims: claims.map((c, j) => ({
      index: j,
      text: c.text.slice(0, 50),
      status: j < i ? 'verified' : j === i ? 'querying' : 'pending',
      result: j < i ? results[j].status : undefined
    }))
  });

  // ... existing verification logic
}
```

---

## 4. UI Design

### 4.1 Visual Layout

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
│ Generating Curriculum                                              2:34 ⏱   │
│                                                                              │
│  ✓ Loading     ✓ Analyzing    ✓ Designing    ● Verifying    ○ Saving       │
│     0:12          0:45           1:02           1:15+                        │
│  [================================================================●    ]    │
│                                                                              │
│  ▼ Verifying Content (3/12 claims)                               [Collapse] │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Opening roll 31 - Best play: 8/5, 6/5                             │   │
│  │   └─ Engine: MATCH (equity: +0.04)                                  │   │
│  │                                                                       │   │
│  │ ✓ Double shot with 64 from bar                                       │   │
│  │   └─ Engine: MATCH (equity: -0.12)                                  │   │
│  │                                                                       │   │
│  │ ● Anchor on 20-point with 52                                         │   │
│  │   └─ Querying GNU Backgammon...                                     │   │
│  │                                                                       │   │
│  │ ○ Prime building with 65                                             │   │
│  │ ○ Backgame timing                                                    │   │
│  │ ○ ... (7 more pending)                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component States

**No Generation Active:**
- FullWidthProgressTracker not rendered (hidden)

**Generation In Progress (non-verification phase):**
- Show phase timeline with elapsed times
- Current phase expanded showing "Processing..." or similar
- Progress bar based on phase index

**Generation In Progress (verification phase):**
- Phase timeline visible
- Verification phase expanded with claim list
- Animated indicator on current claim
- Scrollable list if many claims

**Generation Complete:**
- Show success state with total time
- Summary: "Curriculum generated in 3:45 - 12/12 claims verified"
- Fade out after 3 seconds

---

## 5. Implementation Plan

### Phase 1: Database Schema (30 min)
- [ ] Add `subTaskProgress` field to GuruArtifact in schema.prisma
- [ ] Create and run migration
- [ ] Update Prisma types

### Phase 2: Inngest Job Updates (2 hours)
- [ ] Add `updateSubTaskProgress()` helper function
- [ ] Modify curriculum verification loop to emit progress
- [ ] Modify drill series verification loop to emit progress
- [ ] Test with local Inngest dev server

### Phase 3: API Enhancement (30 min)
- [ ] Include `subTaskProgress` in artifacts API response
- [ ] Ensure no-cache headers for polling freshness
- [ ] Add TypeScript types for API response

### Phase 4: UI Components (3 hours)
- [ ] Create `FullWidthProgressTracker.tsx` component
- [ ] Create `PhaseTimeline.tsx` sub-component
- [ ] Create `ClaimProgressList.tsx` sub-component
- [ ] Integrate into `GuruTeachingManager.tsx` layout
- [ ] Style with Tailwind/shadcn patterns
- [ ] Add fade-out animation on completion

### Phase 5: Testing (1 hour)
- [ ] Manual test with curriculum generation
- [ ] Manual test with drill series generation
- [ ] Verify polling updates in real-time
- [ ] Test completion fade-out behavior
- [ ] Handle edge cases (no claims, verification skipped)

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `subTaskProgress Json?` field |
| `lib/inngest-functions.ts` | Add progress updates in verification loops |
| `app/api/projects/[id]/guru/artifacts/route.ts` | Include subTaskProgress in response |
| `components/guru/GuruTeachingManager.tsx` | Add FullWidthProgressTracker below tiles |
| `components/guru/FullWidthProgressTracker.tsx` | NEW: Main progress component |
| `components/guru/PhaseTimeline.tsx` | NEW: Phase step visualization |
| `components/guru/ClaimProgressList.tsx` | NEW: Claim-by-claim detail view |
| `lib/teaching/types.ts` | Add SubTaskProgress interfaces |

---

## 7. Dependencies

- Existing polling mechanism (3-second interval)
- Ground Truth verification system (batchVerifier.ts)
- shadcn/ui components (Progress, Collapsible)
- Tailwind CSS animations

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Excessive DB writes during verification | Batch updates, only update every N claims or on status change |
| Verification not running (0 claims shown) | Separate investigation - this spec adds visibility, doesn't fix underlying issue |
| Performance impact on polling | No frequency increase, same 3s interval |
| Layout shift when tracker appears/disappears | Use fixed height container, smooth transitions |

---

## 9. Success Criteria

- [ ] FullWidthProgressTracker renders when any artifact is generating
- [ ] All 5/6 phases visible with elapsed time tracking
- [ ] Verification phase shows claim-by-claim progress
- [ ] Each claim shows text and engine response
- [ ] Tracker fades out 3 seconds after completion
- [ ] No increase in polling frequency
- [ ] Works for both Curriculum and Drill Series

---

## 10. Open Investigation (Separate Task)

**Why verification shows 0 claims/tool calls:**
This is flagged as a separate investigation. Possible causes:
1. Ground Truth not enabled for project
2. Verification skipped due to missing config
3. Verification function erroring silently
4. Claims not being extracted from content

The progress tracker enhancement will provide visibility to help diagnose this issue.
