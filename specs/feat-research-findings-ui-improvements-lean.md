# Research Findings UI Improvements

**Status:** Draft
**Authors:** Claude
**Date:** 2025-11-10

## Overview

Improve the Research Findings display on the research run detail page to make research summaries readable and accessible, and add clear explanations when no recommendations are generated.

## Problem Statement

Currently, research findings are displayed as a JSON dump in a code block, requiring horizontal scrolling to read. Users have reported two specific issues:

1. **Poor readability:** The summary field is truncated with "..." and requires horizontal scrolling within the JSON block
2. **Unclear empty recommendations:** When research completes but generates 0 recommendations, users don't understand why the system didn't find anything worth incorporating

These UX issues make it difficult for users to quickly review research results and understand system behavior.

## Goals

1. Display research summary in readable format with expand/collapse functionality
2. Provide access to full research report via modal
3. Explain why no recommendations were generated (when applicable)

## Non-Goals

- Redesigning the entire research detail page layout
- Adding filtering/search within research reports
- Implementing real-time streaming of research results
- Adding export functionality for reports
- Markdown rendering of reports (use plain text for MVP)
- Syntax highlighting or code formatting within reports
- Mobile-specific optimizations beyond responsive design

## Technical Approach

### Component Structure

Create a new client component `ResearchFindingsView` that replaces the current JSON dump:

```typescript
// components/research/ResearchFindingsView.tsx
'use client';

interface ResearchFindingsViewProps {
  researchData: any; // The full researchData JSON object
  recommendationCount: number;
}
```

### High-Level Implementation

1. **Summary Display Block:**
   - Extract `summary` field from researchData
   - Show first ~5 lines (approximately 300-400 characters)
   - "Show more" button to expand full summary inline
   - "Read full report" button to open modal

2. **Full Report Modal:**
   - Uses existing modal patterns from codebase (context layers, knowledge files)
   - Displays `fullReport` field from researchData
   - Shows full summary at top
   - Scrollable content area

3. **No Recommendations Explanation:**
   - Modify `corpusRecommendationGenerator.ts` to return explanation when empty array
   - Display explanation prominently in summary block
   - Use info/warning styling to draw attention

## Implementation Details

### 1. ResearchFindingsView Component

**Location:** `components/research/ResearchFindingsView.tsx`

**Key Features:**
- useState for expanded/collapsed summary
- Modal state management
- Responsive design (follows existing patterns)

**Props:**
```typescript
interface ResearchFindingsViewProps {
  researchData: {
    query: string;
    depth: string;
    summary: string;
    fullReport: string;
    sources: Array<{ url: string; title: string }>;
    sourcesAnalyzed: number;
    metadata: any;
    noRecommendationsReason?: string; // NEW FIELD
  };
  recommendationCount: number;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Research Summary                                │
│ ─────────────────────────────────────────────── │
│ First 5 lines of summary text...               │
│ (Collapsed state)                               │
│                                                 │
│ [Show more ▼]  [Read full report →]            │
└─────────────────────────────────────────────────┘

(When expanded)
┌─────────────────────────────────────────────────┐
│ Research Summary                                │
│ ─────────────────────────────────────────────── │
│ Full summary text here...                       │
│ Multiple paragraphs...                          │
│ All content visible...                          │
│                                                 │
│ [Show less ▲]  [Read full report →]            │
└─────────────────────────────────────────────────┘
```

### 2. Full Report Modal

**Component:** `components/research/FullReportModal.tsx`

**Features:**
- Backdrop overlay (similar to other modals in codebase)
- Close button in header
- Scrollable content area
- Shows:
  - Research query
  - Full summary (at top)
  - Full report text
  - Sources list (if available)

**Trigger:** "Read full report" button in ResearchFindingsView

### 3. No Recommendations Explanation

**Modify:** `lib/corpusRecommendationGenerator.ts`

**Change:** When OpenAI returns empty recommendations array, add explanation:

```typescript
const schema = z.object({
  recommendations: z.array(...),
  reasoning: z.string().optional(), // NEW: Explain why no recommendations
});
```

Update OpenAI prompt to request explanation when no recommendations:
```
"If you determine that no recommendations should be made, provide a clear
explanation in the 'reasoning' field explaining why the research findings
don't warrant any corpus changes."
```

**Display:** When `noRecommendationsReason` exists, show info box in summary:

```
┌─────────────────────────────────────────────────┐
│ ℹ️  No Recommendations Generated                │
│ ─────────────────────────────────────────────── │
│ The system analyzed the research findings and   │
│ determined no changes to the corpus are needed. │
│                                                 │
│ Reason: [explanation from AI]                   │
└─────────────────────────────────────────────────┘
```

### 4. Page Integration

**Modify:** `app/projects/[id]/research/[runId]/page.tsx`

Replace lines 102-111 (current JSON dump) with:

```typescript
{run.status === 'COMPLETED' && run.researchData && (
  <ResearchFindingsView
    researchData={run.researchData}
    recommendationCount={run.recommendations.length}
  />
)}
```

## Testing Approach

### Manual Testing Scenarios

1. **Happy path - with recommendations:**
   - Run research that generates recommendations
   - Verify summary displays properly (first 5 lines)
   - Click "Show more" → Full summary appears
   - Click "Read full report" → Modal opens with full report
   - Verify modal scrolls if report is long
   - Close modal → Returns to page

2. **No recommendations path:**
   - Run research that generates 0 recommendations
   - Verify info box appears explaining why
   - Verify reasoning is clear and helpful
   - Summary and full report still accessible

3. **Edge cases:**
   - Very short summary (< 5 lines) → No "Show more" button
   - Very long summary (> 1000 lines) → Verify expand/collapse works
   - Report with special characters → No rendering issues
   - Empty sources array → Doesn't break display

### Browser Testing

- Chrome (primary)
- Safari (secondary)
- Firefox (secondary)
- Mobile responsive (iOS Safari, Chrome Android)

## Open Questions

1. **Line count vs character count:** Should we show exactly 5 lines or approximately 300-400 characters?
   - **Decision:** Use character count (~400 chars) as it's more predictable across screen sizes

2. **Markdown in reports:** Should we render markdown formatting in the fullReport?
   - **Decision:** No for MVP - plain text is sufficient. Move to Future Improvements.

3. **Sources display:** Should sources be shown in the summary block or only in modal?
   - **Decision:** Only in modal to keep summary block focused

## User Experience

### Before (Current State)
```
Research Findings
┌────────────────────────────────────┐
│ {                                  │
│   "query": "...",                  │
│   "summary": "Advanced Backgammon Opening Strategies for Modern Tournament Play\n\n## Introduction\n\nBackgammon, one of the oldest known board games, has evolved significantly in its strategic complexity, especia...│
│ }                                  │
└────────────────────────────────────┘
// User must scroll horizontally to read
```

### After (Proposed State)
```
Research Summary
────────────────────────────────────
Advanced Backgammon Opening Strategies for Modern Tournament Play

Introduction

Backgammon, one of the oldest known board games, has evolved significantly
in its strategic complexity, especially in the context of modern tournament
play. The opening phase...

[Show more ▼]  [Read full report →]

ℹ️  No Recommendations Generated
────────────────────────────────────
The system analyzed the research findings and determined no changes
to the corpus are needed.

Reason: The research covered advanced tournament strategies that are
beyond the current scope of the beginner-focused knowledge base. The
existing context layers already address the fundamentals adequately.
```

## Future Improvements

These enhancements are valuable but out of scope for initial implementation:

### Enhanced Display Features
- **Markdown rendering:** Render markdown formatting in full report modal for better readability
- **Syntax highlighting:** If report contains code blocks, syntax highlight them
- **Table of contents:** For long reports, generate clickable TOC
- **Print view:** Dedicated print-friendly layout for reports
- **PDF export:** Export full report as PDF

### Search and Navigation
- **In-report search:** Find text within full report modal
- **Highlight keywords:** Highlight key terms from original instructions
- **Jump to sections:** Quick navigation within long reports

### Recommendations Integration
- **Inline recommendation preview:** Show which parts of report led to specific recommendations
- **Diff view:** Compare report findings to existing corpus content
- **Recommendation confidence:** Show which research sections support each recommendation

### Performance Optimizations
- **Progressive loading:** Load summary first, full report on demand
- **Virtual scrolling:** For very long reports (> 10,000 lines)
- **Client-side caching:** Cache opened reports to avoid re-fetching

### AI Enhancements
- **Better explanations:** More detailed reasoning when no recommendations
- **Alternative suggestions:** Suggest related research topics when no recommendations
- **Quality scores:** Show AI confidence in research quality

### Collaboration Features
- **Comments on report:** Allow users to annotate research findings
- **Share research:** Generate shareable links to specific research runs
- **Comparison view:** Compare multiple research runs side-by-side

## References

- User feedback: "I just tested a research run and got the following findings..."
- Existing modal patterns: `components/context-layers/ContextLayerModal.tsx`, `components/knowledge-files/KnowledgeFileModal.tsx`
- Current implementation: `app/projects/[id]/research/[runId]/page.tsx:102-111`
- Recommendation generator: `lib/corpusRecommendationGenerator.ts`
