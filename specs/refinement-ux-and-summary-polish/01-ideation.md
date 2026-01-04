# Refinement UX Enhancement & Research Summary Polish

**Slug:** refinement-ux-and-summary-polish
**Author:** Claude Code
**Date:** 2025-01-04
**Branch:** preflight/refinement-ux-and-summary-polish
**Related:** specs/recommendation-refinement/

---

## 1) Intent & Assumptions

**Task brief:** Two related UX improvements:
1. **Refinement UX Enhancement:** When clicking "Refine this recommendation", auto-expand the "View Full Proposed" content so users see what they're refining. After refinement, show an inline diff view (red strikethrough for removed text, green for added).
2. **Research Summary Bug Fix:** Fix raw markdown displaying in the Research Summary section. Implement proper markdown rendering and ensure summaries are never truncated (generate a proper summary with character limit rather than slicing the full report).

**Assumptions:**
- Users need to see the original content before refining
- Diff view should be inline (single view) not side-by-side
- Summary should be a standalone piece of content, not truncated from full report
- Existing `react-markdown` and `diff` libraries can be leveraged

**Out of scope:**
- Side-by-side diff view (user wants inline/single view)
- Editing the full report content
- Real-time collaborative editing

---

## 2) Pre-reading Log

- `components/recommendations/RefinementInput.tsx`: Current refinement UI with collapsible toggle, example prompts, character limits
- `components/recommendations/DiffViewer.tsx`: Existing side-by-side diff viewer, fetches original content lazily
- `components/artifacts/DiffContent.tsx`: **Inline diff pattern** - uses `diff` library with ReactMarkdown, red/strikethrough for deletions, green for additions
- `components/research/ResearchFindingsView.tsx`: Extracts "key takeaways" from summary via heuristics, renders as plain text (no markdown)
- `components/research/FullReportModal.tsx`: Renders summary and full report as plain text with `whitespace-pre-wrap`
- `lib/researchOrchestrator.ts:195`: **Root cause** - `summary = fullReport.slice(0, 500)` truncates raw markdown
- `app/projects/[id]/research/[runId]/RecommendationsView.tsx`: Parent component managing recommendations list, controls expansion state

---

## 3) Codebase Map

**Primary components/modules:**
- `components/recommendations/RefinementInput.tsx` - Will need to trigger expansion of parent details
- `components/recommendations/DiffViewer.tsx` - May need adaptation or new inline diff component
- `components/artifacts/DiffContent.tsx` - **Pattern to reuse** for inline diff
- `components/research/ResearchFindingsView.tsx` - Needs markdown rendering
- `app/projects/[id]/research/[runId]/RecommendationsView.tsx` - Orchestrates recommendation display

**Shared dependencies:**
- `diff@^8.0.2` - Already installed, `diffLines` function
- `react-markdown@^10.1.0` - Already installed
- `rehype-raw@^7.0.0` - For HTML support in markdown
- Existing prose styling from `ArtifactContent.tsx`

**Data flow (Refinement):**
1. User clicks "Refine this recommendation" → RefinementInput expands
2. **NEW:** Parent `<details>` for "View Full Proposed" auto-opens
3. User enters prompt → POST `/api/recommendations/{id}/refine`
4. API returns updated recommendation
5. **NEW:** Parent shows diff view (original vs refined) instead of just new content
6. User approves/rejects

**Data flow (Summary):**
1. Tavily search → GPT synthesis → `fullReport` (markdown)
2. **CURRENT BUG:** `summary = fullReport.slice(0, 500)` - raw truncation
3. **FIX:** GPT generates standalone summary with character limit
4. `ResearchFindingsView` displays summary with markdown rendering

**Potential blast radius:**
- Recommendation cards in `RecommendationsView.tsx`
- Research summary display in `ResearchFindingsView.tsx`
- Research orchestrator prompt/output schema
- No database schema changes needed

---

## 4) Root Cause Analysis

### Issue A: Refinement UX
- **Observed:** User clicks "Refine" but can't see what they're refining without manually expanding "View Full Proposed"
- **Expected:** Content auto-expands when refinement panel opens; after refinement shows diff
- **Evidence:** `RecommendationsView.tsx` lines 244-280 - `<details>` element is independent of RefinementInput
- **Root cause:** No coordination between RefinementInput expansion and content preview expansion

### Issue B: Research Summary Markdown
- **Observed:** Raw markdown symbols (`#`, `##`, `**`, `-`, `•`) display in summary
- **Expected:** Properly rendered markdown (headings, bold, bullets)
- **Evidence:** Screenshot shows `# Research Report: ...`, `## Executive Summary`, `- **Backgammo...`
- **Root cause #1:** `ResearchFindingsView.tsx` line 113 - plain text rendering `<span>{point}</span>`
- **Root cause #2:** `lib/researchOrchestrator.ts:195` - summary is truncated fullReport, not generated summary

---

## 5) Research

### Potential Solutions

#### Issue A: Refinement Auto-Expand + Diff View

**Solution A1: Lift state to parent + new InlineContentDiff component**
- Add `contentExpanded` state to RecommendationsView
- Pass `onExpand` callback to RefinementInput
- Create `InlineContentDiff` component based on `DiffContent.tsx` pattern
- Store `previousFullContent` when refinement starts
- Show diff after refinement completes

**Pros:**
- Clean separation of concerns
- Reuses existing `diff` library patterns
- No new dependencies

**Cons:**
- Requires state coordination across components
- Need to track "before" content for diff

**Solution A2: Store refinement history in state**
- Track `originalContent` before refinement
- Toggle between "diff view" and "normal view"

**Pros:**
- Simpler state management (local to recommendation card)
- User can toggle diff on/off

**Cons:**
- Extra memory for storing original
- More complex UI with toggle

**Recommendation:** Solution A1 - cleaner architecture, matches existing patterns

#### Issue B: Research Summary

**Solution B1: Generate standalone summary via GPT**
- Add separate GPT call for summary generation after full report
- Enforce character limit in prompt (e.g., 600 chars max)
- Summary is self-contained, never truncated

**Pros:**
- Summary is coherent, not mid-sentence truncation
- Can customize summary format for display
- No raw markdown issues (summary written for bullets)

**Cons:**
- Extra API call (cost/latency)
- Complexity in orchestrator

**Solution B2: Two-pass generation - summary first**
- Generate summary FIRST (structured format)
- Generate full report referencing summary
- Summary is primary output, report is expansion

**Pros:**
- Ensures summary is always coherent
- Natural flow for user (summary → details)
- Single prompt can request both with structure

**Cons:**
- Changes prompt engineering significantly

**Solution B3: Render existing summary with markdown + fix truncation**
- Just render current summary with `<ReactMarkdown>`
- Increase truncation to 800 chars to avoid mid-sentence
- Quick fix, minimal changes

**Pros:**
- Fastest to implement
- Minimal risk

**Cons:**
- Still truncates (could cut mid-word)
- Doesn't fix root cause

**Recommendation:** Solution B1 or B2 - Generate a proper standalone summary. The current truncation approach fundamentally cannot produce coherent summaries. B1 is simpler (add one more GPT call specifically for summary).

---

## 6) Clarifications

1. **Diff view persistence:** Should the diff view persist after page refresh, or reset to normal view?
   - Recommendation: Reset to normal view (diff is ephemeral, shows what just changed)
   >> your recommenedation is spot on

2. **Summary character limit:** What's the ideal summary length?
   - Recommendation: 500-600 chars max, enforced in GPT prompt, structured as 3-4 bullet points
   >> your recommenedation is spot on

3. **Summary format:** Should summary be bullets only, or include a brief intro sentence?
   - Recommendation: Brief intro (1 sentence) + 3-4 bullet points
   >> your recommenedation is spot on

4. **Diff view interaction:** Can user toggle between diff and normal view?
   - Recommendation: No toggle needed - diff shows only immediately after refinement, then reverts to normal view on next action (approve/reject/refresh)
   >> your recommenedation is spot on

5. **Summary regeneration:** Should existing research runs get their summaries regenerated?
   - Recommendation: No - only new research runs. Existing data is archived as-is.
   >> your recommenedation is spot on

---

## Implementation Approach

### Phase 1: Research Summary Fix (simpler, standalone)
1. Update `lib/researchOrchestrator.ts` to generate standalone summary via separate GPT call
2. Update prompt to request 3-4 bullet points, max 500 chars
3. Update `ResearchFindingsView.tsx` to render with ReactMarkdown
4. Update `FullReportModal.tsx` to render summary/report with ReactMarkdown

### Phase 2: Refinement UX Enhancement
1. Add `expandedContentId` state to track which recommendation has content expanded
2. Wire RefinementInput expansion to auto-expand content preview
3. Create `InlineContentDiff` component for post-refinement diff view
4. Track `preRefinementContent` when refinement starts
5. Show diff view after refinement, clear on approve/reject

### Estimated Complexity
- Phase 1: Low-Medium (prompt changes + UI rendering)
- Phase 2: Medium (state coordination + new component)
