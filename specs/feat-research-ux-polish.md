# Research UX Polish - Lean Spec

## Overview

Two focused improvements to the research workflow UX:
1. **Auto-growing textarea** in research chat input
2. **Proper research summary** with bulleted key takeaways

---

## Problem 1: Fixed-Height Textarea

**Current State:**
`ResearchChatAssistant.tsx:215-223` - Textarea has fixed height (`min-h-[60px] sm:min-h-[80px]`) with `resize-none`. Multi-line messages are cramped and hard to compose.

**Desired:**
Textarea grows with content up to 4-5 lines (~120-150px), then becomes scrollable. User can see their full message while typing.

### Implementation

Modify `ResearchChatAssistant.tsx`:

```tsx
// Add auto-resize effect
useEffect(() => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  // Reset height to auto to get accurate scrollHeight
  textarea.style.height = 'auto';

  // Calculate new height (min 60px, max ~150px for ~5 lines)
  const lineHeight = 24; // ~text-sm line height
  const maxLines = 5;
  const maxHeight = lineHeight * maxLines + 16; // + padding
  const newHeight = Math.min(textarea.scrollHeight, maxHeight);

  textarea.style.height = `${Math.max(60, newHeight)}px`;
}, [inputMessage]);

// Update Textarea component
<Textarea
  ref={textareaRef}
  value={inputMessage}
  onChange={(e) => setInputMessage(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
  className="resize-none text-sm overflow-y-auto"
  style={{ minHeight: '60px', maxHeight: '150px' }}
  disabled={isRefining}
/>
```

**Files:** `components/wizard/research/ResearchChatAssistant.tsx`

---

## Problem 2: Truncated Summary Display

**Current State:**
`ResearchFindingsView.tsx:16-21` - Shows first 400 characters of `researchData.summary` with "..." truncation. This is just the first paragraph, not a proper summary. Not glance-able.

**Desired:**
- Bulleted key takeaways at the top (3-5 points)
- Sources count
- "Read full report" CTA below
- Entire summary easily scannable

### Approach

The `summary` field from research contains the AI-generated summary text. Two options:

**Option A (Recommended):** Parse and format existing summary
- Split summary into sentences/paragraphs
- Extract first 3-5 key points as bullets
- Show remaining as condensed paragraph if needed

**Option B:** Generate dedicated takeaways at research time
- Requires modifying Inngest research job
- More work, deferred to later

### Implementation (Option A)

Modify `ResearchFindingsView.tsx`:

```tsx
// Helper to extract key points from summary
function extractKeyTakeaways(summary: string, maxPoints: number = 4): string[] {
  // Try to find existing bullet points
  const bulletMatch = summary.match(/^[-•*]\s+.+$/gm);
  if (bulletMatch && bulletMatch.length >= 2) {
    return bulletMatch.slice(0, maxPoints).map(b => b.replace(/^[-•*]\s+/, ''));
  }

  // Fall back to sentences
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 20)
    .slice(0, maxPoints);

  return sentences;
}

// Updated component structure
<div className="bg-white rounded-lg border p-6 mb-6">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">Research Summary</h2>

  {/* Key Takeaways */}
  <div className="mb-4">
    <h3 className="text-sm font-medium text-gray-700 mb-2">Key Findings</h3>
    <ul className="space-y-2">
      {extractKeyTakeaways(researchData.summary).map((point, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <span className="text-blue-500 mt-0.5">•</span>
          <span>{point}</span>
        </li>
      ))}
    </ul>
  </div>

  {/* Sources */}
  {researchData.sourcesAnalyzed > 0 && (
    <p className="text-sm text-gray-500 mb-4">
      Based on {researchData.sourcesAnalyzed} sources analyzed
    </p>
  )}

  {/* CTA */}
  <Button onClick={() => setShowModal(true)} className="...">
    Read full report
    <ArrowRight className="ml-2 h-4 w-4" />
  </Button>
</div>
```

**Files:** `components/research/ResearchFindingsView.tsx`

---

## Tasks

1. [ ] Add auto-resize effect to `ResearchChatAssistant.tsx`
2. [ ] Update Textarea styling to support dynamic height
3. [ ] Create `extractKeyTakeaways()` helper function
4. [ ] Refactor `ResearchFindingsView.tsx` with bulleted summary layout
5. [ ] Test with various summary lengths and formats
6. [ ] Verify mobile responsiveness

---

## Out of Scope

- Modifying research Inngest job to generate structured takeaways
- Changes to FullReportModal
- Research plan display changes

---

## Acceptance Criteria

**Textarea:**
- [ ] Grows from 1 line to 5 lines as user types
- [ ] Becomes scrollable after 5 lines
- [ ] Shrinks back when text is deleted
- [ ] Works on mobile and desktop

**Summary:**
- [ ] Shows 3-5 bulleted key findings
- [ ] Displays sources count
- [ ] "Read full report" CTA is prominent
- [ ] Scannable in <5 seconds
