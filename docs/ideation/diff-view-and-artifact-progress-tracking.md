# Ideation: Diff View for EDIT Recommendations + Teaching Artifact Progress Tracking

**Created:** 2025-12-06
**Status:** Ready for Spec Creation

## User Request

> "When the proposed change is an edit, I want to be able to view a diff showing what's getting deleted and what's getting added. Ideally both the section showing the old text that's going to be removed and the new. Also, when generating the artifacts in the teaching pipeline, I want to apply a similar UI/UX pattern to what we do during research in terms of a visually trackable series of steps to give the user confidence that things are still happening. Right now we just have a loading animation and most of those things take a while to complete."

---

## Feature 1: Diff View for EDIT Recommendations

### Current State

**File:** `app/projects/[id]/research/[runId]/RecommendationsView.tsx` (lines 177-188)

Currently, when viewing an EDIT recommendation:
- Shows "View Full Proposed Changes" in a collapsible `<details>` element
- Displays the `fullContent` (the proposed new content) as raw monospace text
- **Does NOT show** the original content being replaced
- **No visual diff** highlighting additions vs. deletions

```tsx
// Current implementation (line 183-186)
<div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
    {rec.fullContent}
  </pre>
</div>
```

### Problem

Users cannot easily understand what changes an EDIT recommendation will make. They see the full new content but have no reference to compare against the original. For large documents, manually comparing is impractical.

### Proposed Solution

1. **Fetch original content** when an EDIT recommendation is expanded
   - For `targetType: "LAYER"` → fetch from `/api/context-layers/[contextLayerId]`
   - For `targetType: "KNOWLEDGE_FILE"` → fetch from `/api/knowledge-files/[knowledgeFileId]`

2. **Display a side-by-side or unified diff** using `react-diff-viewer` (already installed v3.1.1)

3. **UI Pattern:**
   - Toggle between "Unified View" and "Split View"
   - Red highlighting for removed lines
   - Green highlighting for added lines
   - Line numbers for reference

### Key Files to Modify

| File | Changes |
|------|---------|
| `RecommendationsView.tsx` | Add diff viewer component, fetch original content on expand |
| New: `components/recommendations/DiffViewer.tsx` | Reusable diff component wrapping react-diff-viewer |

### Technical Considerations

1. **Lazy Loading:** Only fetch original content when user expands the diff (not on initial page load)
2. **Caching:** Cache fetched original content in component state to avoid re-fetching
3. **Target Resolution:** Use `contextLayerId` or `knowledgeFileId` depending on `targetType`
4. **Error Handling:** Handle case where target was deleted before user views diff

### Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│ EDIT • LAYER • MEDIUM Impact • Confidence: 85%                 │
├─────────────────────────────────────────────────────────────────┤
│ Title: Improve Opening Roll Coverage                           │
│                                                                 │
│ Description: Adds detailed analysis for the 6-1 opening...     │
│                                                                 │
│ ▼ View Changes (diff)                                          │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │  [Split View] [Unified View]                                ││
│ │                                                             ││
│ │  Original                    │  Proposed                   ││
│ │  ─────────────────────────  │  ─────────────────────────  ││
│ │  1  Opening rolls are...    │  1  Opening rolls are...    ││
│ │  2  - For 3-1, run...       │  2  - For 3-1, run...       ││
│ │  3  - For 6-1, use the      │  3  - For 6-1, consider:    ││
│ │       slotting play.        │       • Slotting (24/18...)  ││
│ │                             │       • Running (24/18...)   ││
│ │                             │  4  - Each has tradeoffs...  ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Reasoning: The current coverage of 6-1 is too brief...         │
│                                                                 │
│ [Approve] [Reject]                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature 2: Visual Progress Tracking for Teaching Artifact Generation

### Current State

**File:** `components/guru/GuruTeachingManager.tsx` (lines 285-331)

Currently, when generating an artifact (Mental Model, Curriculum, or Drill Series):
- Shows a spinning icon with `animate-pulse`
- Displays static text: "Generating... This may take a few minutes."
- Polls every 3 seconds (line 100) for completion
- No visibility into which step is currently running

```tsx
// Current implementation (lines 328-331)
{isInProgress && (
  <div className="text-sm text-blue-600 mb-4">
    Generating... This may take a few minutes.
  </div>
)}
```

### Problem

Users have no feedback about what's happening during the 30-120+ seconds of artifact generation. This creates anxiety and makes them wonder if the process is stuck.

### Existing Pattern to Replicate

**File:** `components/research/ResearchProgressTracker.tsx`

The research workflow shows a 6-phase progress tracker:
1. Starting
2. Searching
3. Synthesizing
4. Saving Research
5. Generating Recs
6. Saving Recs

Features:
- Animated progress bar filling left-to-right
- Numbered circles that turn to checkmarks when complete
- Current phase has pulsing ring animation
- Text label updates to show current phase name

### Proposed Solution

1. **Create `TeachingProgressTracker.tsx`** mirroring ResearchProgressTracker pattern

2. **Define phases for each artifact type:**

   **Mental Model Generation:**
   - Composing Corpus
   - Analyzing Structure
   - Extracting Principles
   - Building Framework
   - Saving Artifact

   **Curriculum Generation:**
   - Loading Prerequisites
   - Analyzing Mental Model
   - Designing Learning Path
   - Structuring Modules
   - Saving Artifact

   **Drill Series Generation:**
   - Loading Prerequisites
   - Analyzing Curriculum
   - Designing Exercises
   - Generating Content
   - Saving Artifact

3. **Update Inngest jobs** to report progress stages (similar to research job)

4. **Add progress endpoint** or use existing artifact endpoint with `progressStage` field

### Key Files to Modify

| File | Changes |
|------|---------|
| New: `components/guru/TeachingProgressTracker.tsx` | Progress tracker component |
| `GuruTeachingManager.tsx` | Replace spinner with progress tracker |
| `lib/inngest-functions.ts` | Update teaching jobs to report progress stages |
| `prisma/schema.prisma` | Add `progressStage` field to GuruArtifact model |
| Teaching artifact API routes | Return progressStage in polling responses |

### Technical Considerations

1. **Progress Stage Storage:** Add `progressStage` column to `GuruArtifact` table
2. **Callback Pattern:** Inngest jobs need to update progress stage during execution (like research job)
3. **Polling Efficiency:** Poll returns progressStage so UI can update without additional API calls
4. **Fallback:** If progressStage is null, show generic "Generating..." (backwards compatible)

### Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│ Mental Model                                                     │
│ Core principles and frameworks extracted from your corpus        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ✓         ✓         ○         ○         ○                    │
│    │─────────│─────────│─────────│─────────│                    │
│  Compose  Analyze  Extract   Build    Save                      │
│  Corpus   Structure Principles Framework Artifact               │
│                                                                  │
│              ↑ Extracting core principles...                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Feature | Complexity | User Value | Recommendation |
|---------|------------|------------|----------------|
| Diff View for EDIT | Medium | High | Implement first - directly addresses confusion |
| Progress Tracking | Medium-High | High | Implement second - requires backend changes |

---

## Dependencies & Risks

### Feature 1 (Diff View)
- **Dependency:** `react-diff-viewer` v3.1.1 (already installed)
- **Risk:** Large content may slow down diff rendering → Mitigate with virtualization or truncation

### Feature 2 (Progress Tracking)
- **Dependency:** Database schema change (add progressStage to GuruArtifact)
- **Risk:** Existing generating artifacts won't have progress → Fallback to generic message
- **Risk:** Inngest function changes need server restart → Document in deployment

---

## Questions for User

1. **Diff View:** Prefer split view (side-by-side) or unified view (inline) as the default?
2. **Progress Tracking:** Should we show estimated time remaining, or just the current phase?

---

## Next Steps

1. Create lean spec: `/spec:create-lean` for each feature
2. Implement Feature 1 (Diff View) - frontend only, no backend changes
3. Implement Feature 2 (Progress Tracking) - includes backend schema change
4. Test both features with real recommendation and artifact generation flows
