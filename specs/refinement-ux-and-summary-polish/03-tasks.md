# Task Breakdown: Refinement UX Enhancement & Research Summary Polish

**Spec:** `specs/refinement-ux-and-summary-polish/02-specification.md`
**Created:** 2025-01-04

---

## Phase 1: Research Summary Fix

### Task 1.1: Add generateSummary() to Research Orchestrator
**File:** `lib/researchOrchestrator.ts`
**Status:** [ ] Pending

**Changes:**
1. Add `generateSummary(fullReport: string, query: string): Promise<string>` function
2. Replace `const summary = fullReport.slice(0, 500) + "..."` with `const summary = await generateSummary(fullReport, instructions)`

**Implementation:**
```typescript
async function generateSummary(fullReport: string, query: string): Promise<string> {
  const completion = await getOpenAI().chat.completions.create({
    model: RESEARCH_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a research summarizer. Create a brief, scannable summary of research findings.

Format Requirements:
- Start with ONE introductory sentence (max 100 chars)
- Follow with 3-4 bullet points of key findings
- Each bullet should be 60-100 chars
- Total output MUST be under 500 characters
- Use plain text, NO markdown formatting (no #, **, etc.)
- Write for quick scanning, not deep reading`
      },
      {
        role: "user",
        content: `Summarize this research report about "${query}":\n\n${fullReport.slice(0, 3000)}`
      }
    ],
    temperature: 0.5,
    max_tokens: 300,
  });

  return completion.choices[0]?.message?.content?.trim() ||
    "Research completed. See full report for details.";
}
```

**Acceptance Criteria:**
- [ ] Summary is generated via GPT call, not truncation
- [ ] Summary follows format: intro sentence + 3-4 bullets
- [ ] Summary is under 500 characters
- [ ] No raw markdown symbols in summary

---

### Task 1.2: Add Markdown Rendering to Full Report Modal (Optional)
**File:** `components/research/FullReportModal.tsx`
**Status:** [ ] Pending

**Changes:**
1. Import `ReactMarkdown` from 'react-markdown'
2. Wrap full report content in `<ReactMarkdown>` component with prose styling

**Implementation:**
```typescript
import ReactMarkdown from 'react-markdown';

// Replace plain text rendering with:
<div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
  <div className="prose prose-sm max-w-none">
    <ReactMarkdown>{fullReport}</ReactMarkdown>
  </div>
</div>
```

**Acceptance Criteria:**
- [ ] Full report renders markdown correctly (headers, bullets, bold)
- [ ] Report is scrollable within container

---

## Phase 2: Refinement UX Enhancement

### Task 2.1: Create InlineContentDiff Component
**File:** `components/recommendations/InlineContentDiff.tsx` (NEW)
**Status:** [ ] Pending

**Changes:**
1. Create new component using `diff` library's `diffLines` function
2. Render additions in green background, deletions in red with strikethrough
3. Add legend showing color meanings

**Implementation:**
See full component code in spec Section 2.3

**Acceptance Criteria:**
- [ ] Component renders diff with red strikethrough for removed
- [ ] Component renders diff with green highlight for added
- [ ] Legend shows color meanings
- [ ] Content is scrollable

---

### Task 2.2: Update RefinementInput Props
**File:** `components/recommendations/RefinementInput.tsx`
**Status:** [ ] Pending

**Changes:**
1. Add `currentContent: string` prop
2. Add `onRefinementStart?: (content: string) => void` callback
3. Call `onRefinementStart` at start of `handleRefine`

**Interface Update:**
```typescript
interface RefinementInputProps {
  recommendationId: string;
  currentContent: string;  // NEW
  disabled?: boolean;
  onRefinementStart?: (content: string) => void;  // NEW
  onRefinementComplete: () => void;
}
```

**Acceptance Criteria:**
- [ ] `onRefinementStart` called before API request
- [ ] `currentContent` passed through props

---

### Task 2.3: Wire Up RecommendationsView
**File:** `app/projects/[id]/research/[runId]/RecommendationsView.tsx`
**Status:** [ ] Pending

**Changes:**
1. Add `refinementExpandedId` state to track auto-expansion
2. Add `preRefinementContent` state to track content before refinement
3. Update `<details>` elements to use `open={refinementExpandedId === rec.id}`
4. Import and use `InlineContentDiff` when `preRefinementContent` exists
5. Clear state on approve/reject actions

**New State:**
```typescript
const [refinementExpandedId, setRefinementExpandedId] = useState<string | null>(null);
const [preRefinementContent, setPreRefinementContent] = useState<{
  id: string;
  fullContent: string;
} | null>(null);
```

**Acceptance Criteria:**
- [ ] Content auto-expands when refinement panel opens
- [ ] Diff view shows after refinement completes
- [ ] Diff clears on approve/reject
- [ ] State resets properly

---

## Implementation Order

1. **Task 1.1** - Research summary fix (standalone, no dependencies)
2. **Task 1.2** - Full report markdown (optional enhancement)
3. **Task 2.1** - Create InlineContentDiff component
4. **Task 2.2** - Update RefinementInput props
5. **Task 2.3** - Wire up RecommendationsView (depends on 2.1, 2.2)

---

## Testing Checklist

### Phase 1 Testing
- [ ] Run new research on a project
- [ ] Verify summary displays as intro + 3-4 bullets
- [ ] Verify no raw markdown symbols visible
- [ ] Verify full report modal renders markdown correctly

### Phase 2 Testing
- [ ] Click "Refine this recommendation" on PENDING recommendation
- [ ] Verify content auto-expands
- [ ] Enter refinement prompt and submit
- [ ] Verify diff view shows with red/green highlighting
- [ ] Click Approve - verify diff clears
- [ ] Click Reject - verify diff clears
