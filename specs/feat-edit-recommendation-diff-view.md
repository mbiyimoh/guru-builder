# Feature: Unified Diff View for EDIT Recommendations

**Status:** Draft
**Author:** Claude Code
**Created:** 2025-12-06
**Ideation Source:** `docs/ideation/diff-view-and-artifact-progress-tracking.md`

---

## 1. Overview

Add a unified diff view for EDIT recommendations that visually shows what content is being removed (red) and added (green) when a recommendation proposes changes to an existing context layer or knowledge file.

---

## 2. Background / Problem Statement

### Current State
When reviewing EDIT recommendations, users see:
- The full proposed content (`fullContent`) in a monospace `<pre>` block
- No reference to the original content being replaced
- No visual indication of what changed

### Problem
Users cannot effectively evaluate EDIT recommendations because:
1. They must manually open the original layer/file in another tab
2. They must visually compare two large text blocks
3. For substantial documents, this is impractical and error-prone

### User Impact
- Slower review process
- Higher cognitive load
- Increased risk of approving unintended changes

---

## 3. Goals

- Display a unified diff comparing original content to proposed content for EDIT recommendations
- Highlight removed lines in red and added lines in green
- Lazy-load original content only when user expands the diff (performance)
- Handle edge cases gracefully (deleted target, loading states, errors)
- Maintain current behavior for ADD and DELETE recommendations

---

## 4. Non-Goals

- Split view mode (may add later, but unified is default per user preference)
- Inline editing of diff content
- Diff for DELETE recommendations (just show what will be deleted)
- Word-level diff highlighting (line-level is sufficient for v1)
- Persisting user view preferences

---

## 5. Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `react-diff-viewer` | ^3.1.1 | Render unified diff view |
| Next.js | 15.x | App Router, client components |
| React | 19.x | Component framework |

**Library Documentation:** https://github.com/praneshr/react-diff-viewer

---

## 6. Detailed Design

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ RecommendationsView.tsx                                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ RecommendationCard (for each rec)                       ││
│  │                                                         ││
│  │  [If action === 'EDIT']                                 ││
│  │  ┌───────────────────────────────────────────────────┐ ││
│  │  │ <details> View Changes (diff)                     │ ││
│  │  │   └─→ <DiffViewer>                                │ ││
│  │  │         ├─ Fetches original content on expand     │ ││
│  │  │         ├─ Renders unified diff                   │ ││
│  │  │         └─ Shows loading/error states             │ ││
│  │  └───────────────────────────────────────────────────┘ ││
│  │                                                         ││
│  │  [If action === 'ADD' or 'DELETE']                      ││
│  │  └─→ Current behavior (show fullContent as-is)          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 6.2 New Component: DiffViewer

**File:** `components/recommendations/DiffViewer.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer';

interface DiffViewerProps {
  targetType: 'LAYER' | 'KNOWLEDGE_FILE';
  targetId: string;           // contextLayerId or knowledgeFileId
  proposedContent: string;    // rec.fullContent
  isExpanded: boolean;        // Controlled by parent <details> open state
}

export function DiffViewer({
  targetType,
  targetId,
  proposedContent,
  isExpanded
}: DiffViewerProps) {
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch when expanded and not already loaded
    if (!isExpanded || originalContent !== null || isLoading) return;

    async function fetchOriginal() {
      setIsLoading(true);
      setError(null);

      try {
        const endpoint = targetType === 'LAYER'
          ? `/api/context-layers/${targetId}`
          : `/api/knowledge-files/${targetId}`;

        const res = await fetch(endpoint);

        if (!res.ok) {
          if (res.status === 404) {
            setError('Original content no longer exists (may have been deleted)');
          } else {
            setError('Failed to load original content');
          }
          return;
        }

        const data = await res.json();
        const content = targetType === 'LAYER'
          ? data.layer.content
          : data.file.content;

        setOriginalContent(content);
      } catch (err) {
        setError('Network error loading original content');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOriginal();
  }, [isExpanded, targetType, targetId, originalContent, isLoading]);

  if (!isExpanded) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading original content...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 px-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
        {error}
        <div className="mt-2 text-gray-600">
          Showing proposed content only:
        </div>
        <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">
          {proposedContent}
        </pre>
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <ReactDiffViewer
        oldValue={originalContent || ''}
        newValue={proposedContent}
        splitView={false}           // Unified view per user preference
        useDarkTheme={false}
        showDiffOnly={false}        // Show full context
        hideLineNumbers={false}
        compareMethod={DiffMethod.LINES}
        styles={{
          variables: {
            light: {
              diffViewerBackground: '#f9fafb',
              addedBackground: '#dcfce7',
              addedColor: '#166534',
              removedBackground: '#fee2e2',
              removedColor: '#991b1b',
              wordAddedBackground: '#bbf7d0',
              wordRemovedBackground: '#fecaca',
            },
          },
          contentText: {
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}
```

### 6.3 Modified Component: RecommendationsView

**File:** `app/projects/[id]/research/[runId]/RecommendationsView.tsx`

Changes to the existing component:

```typescript
// Add import at top
import { DiffViewer } from '@/components/recommendations/DiffViewer';

// Add state for tracking expanded details
const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

// Replace the details block for EDIT recommendations (lines 177-188)
// OLD:
<details className="mb-3">
  <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-sm">
    View Full {rec.action === 'EDIT' ? 'Proposed Changes' : 'Content'}
  </summary>
  <div className="mt-3 p-4 bg-gray-50 rounded-md ...">
    <pre className="whitespace-pre-wrap ...">{rec.fullContent}</pre>
  </div>
</details>

// NEW:
{rec.action === 'EDIT' && (rec.contextLayerId || rec.knowledgeFileId) ? (
  <details
    className="mb-3"
    onToggle={(e) => {
      const isOpen = (e.target as HTMLDetailsElement).open;
      setExpandedDiffs(prev => {
        const next = new Set(prev);
        if (isOpen) next.add(rec.id);
        else next.delete(rec.id);
        return next;
      });
    }}
  >
    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-sm">
      View Changes ({Math.ceil(rec.fullContent.length / 1000)}k characters)
    </summary>
    <div className="mt-3">
      <DiffViewer
        targetType={rec.targetType as 'LAYER' | 'KNOWLEDGE_FILE'}
        targetId={(rec.contextLayerId || rec.knowledgeFileId)!}
        proposedContent={rec.fullContent}
        isExpanded={expandedDiffs.has(rec.id)}
      />
    </div>
  </details>
) : (
  // Original behavior for ADD/DELETE or EDIT without target
  <details className="mb-3">
    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-sm">
      View Full {rec.action === 'ADD' ? 'Proposed' : rec.action === 'DELETE' ? 'Content to Delete' : 'Content'}
      {' '}({Math.ceil(rec.fullContent.length / 1000)}k characters)
    </summary>
    <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
        {rec.fullContent}
      </pre>
    </div>
  </details>
)}
```

### 6.4 Data Flow

```
User clicks "View Changes" on EDIT recommendation
    │
    ▼
<details> onToggle fires → adds rec.id to expandedDiffs Set
    │
    ▼
DiffViewer receives isExpanded=true
    │
    ▼
useEffect triggers → fetches original content
    │
    ├─→ GET /api/context-layers/[contextLayerId]  (if targetType=LAYER)
    │
    └─→ GET /api/knowledge-files/[knowledgeFileId]  (if targetType=KNOWLEDGE_FILE)
    │
    ▼
Response received → extracts .content field
    │
    ▼
ReactDiffViewer renders unified diff
    │
    ├─→ Red lines: content in original but not in proposed
    └─→ Green lines: content in proposed but not in original
```

---

## 7. User Experience

### 7.1 Viewing an EDIT Recommendation

1. User sees recommendation card with EDIT badge
2. Clicks "View Changes (Xk characters)"
3. Brief loading spinner appears
4. Unified diff renders showing:
   - Removed lines in red background
   - Added lines in green background
   - Line numbers for reference
   - Full context (unchanged lines visible)

### 7.2 Error States

| Scenario | User Sees |
|----------|-----------|
| Loading | Spinner with "Loading original content..." |
| Target deleted | Amber warning + proposed content fallback |
| Network error | Error message + proposed content fallback |

### 7.3 ADD/DELETE Recommendations

Unchanged behavior:
- ADD: Shows "View Full Proposed" with raw content
- DELETE: Shows "View Content to Delete" with raw content

---

## 8. Testing Strategy

### 8.1 Unit Tests

**File:** `lib/__tests__/DiffViewer.test.tsx`

```typescript
describe('DiffViewer', () => {
  // Purpose: Verify component renders nothing when collapsed
  it('renders nothing when isExpanded is false', () => {
    render(<DiffViewer
      targetType="LAYER"
      targetId="layer-1"
      proposedContent="new content"
      isExpanded={false}
    />);
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });

  // Purpose: Verify loading state appears during fetch
  it('shows loading state when expanded and fetching', async () => {
    // Mock fetch to delay
    global.fetch = jest.fn(() => new Promise(() => {}));

    render(<DiffViewer
      targetType="LAYER"
      targetId="layer-1"
      proposedContent="new content"
      isExpanded={true}
    />);

    expect(screen.getByText(/Loading original content/)).toBeInTheDocument();
  });

  // Purpose: Verify diff renders after successful fetch
  it('renders diff after loading original content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ layer: { content: 'old content' } }),
    });

    render(<DiffViewer
      targetType="LAYER"
      targetId="layer-1"
      proposedContent="new content"
      isExpanded={true}
    />);

    await waitFor(() => {
      // ReactDiffViewer renders with role or specific elements
      expect(screen.getByText('old content')).toBeInTheDocument();
      expect(screen.getByText('new content')).toBeInTheDocument();
    });
  });

  // Purpose: Verify 404 handling shows appropriate message
  it('shows error when target is deleted (404)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    render(<DiffViewer
      targetType="KNOWLEDGE_FILE"
      targetId="file-1"
      proposedContent="new content"
      isExpanded={true}
    />);

    await waitFor(() => {
      expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
    });
  });

  // Purpose: Verify correct endpoint is called based on targetType
  it('fetches from correct endpoint based on targetType', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ file: { content: 'file content' } }),
    });

    render(<DiffViewer
      targetType="KNOWLEDGE_FILE"
      targetId="file-123"
      proposedContent="new"
      isExpanded={true}
    />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/knowledge-files/file-123');
    });
  });

  // Purpose: Verify fetch only happens once per expansion
  it('does not re-fetch when already loaded', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ layer: { content: 'old' } }),
    });

    const { rerender } = render(<DiffViewer
      targetType="LAYER"
      targetId="layer-1"
      proposedContent="new"
      isExpanded={true}
    />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Collapse and expand again
    rerender(<DiffViewer
      targetType="LAYER"
      targetId="layer-1"
      proposedContent="new"
      isExpanded={false}
    />);
    rerender(<DiffViewer
      targetType="LAYER"
      targetId="layer-1"
      proposedContent="new"
      isExpanded={true}
    />);

    // Should still be 1 because content was cached
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
```

### 8.2 E2E Tests

**File:** `tests/features/recommendation-diff-view.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Recommendation Diff View', () => {
  // Purpose: Verify diff view appears for EDIT recommendations
  test('shows diff view for EDIT recommendations', async ({ page }) => {
    // Navigate to a research run with EDIT recommendations
    await page.goto('/projects/test-project/research/test-run');

    // Find an EDIT recommendation
    const editRec = page.locator('[data-action="EDIT"]').first();
    await expect(editRec).toBeVisible();

    // Click to expand diff
    await editRec.locator('summary:has-text("View Changes")').click();

    // Verify diff viewer appears with colored lines
    const diffViewer = editRec.locator('.react-diff-viewer');
    await expect(diffViewer).toBeVisible();

    // Check for diff highlighting (removed and added backgrounds)
    const removedLine = diffViewer.locator('[class*="removed"]').first();
    const addedLine = diffViewer.locator('[class*="added"]').first();

    // At least one of these should exist in a real diff
    const hasChanges = await removedLine.isVisible() || await addedLine.isVisible();
    expect(hasChanges).toBe(true);
  });

  // Purpose: Verify ADD recommendations still show raw content
  test('shows raw content for ADD recommendations', async ({ page }) => {
    await page.goto('/projects/test-project/research/test-run');

    const addRec = page.locator('[data-action="ADD"]').first();
    await addRec.locator('summary:has-text("View Full")').click();

    // Should show pre-formatted content, not diff viewer
    const preContent = addRec.locator('pre');
    await expect(preContent).toBeVisible();

    const diffViewer = addRec.locator('.react-diff-viewer');
    await expect(diffViewer).not.toBeVisible();
  });
});
```

---

## 9. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Large content diffs | Lazy-load only when expanded; react-diff-viewer handles efficiently |
| Multiple concurrent fetches | Each DiffViewer manages its own fetch; cached after first load |
| Re-renders | Use React state correctly; diff only re-renders when content changes |
| Bundle size | react-diff-viewer already installed, no additional bundle impact |

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Content injection | react-diff-viewer escapes HTML by default |
| Unauthorized access | Existing API endpoints verify project ownership |
| Data exposure | Only fetches content user already has access to |

---

## 11. Documentation

### Updates Required

1. **Developer Guide:** Add section on DiffViewer component usage
2. **CLAUDE.md:** No changes needed (no new patterns)

---

## 12. Implementation Phases

### Phase 1: Core Implementation (This Spec)

1. Create `DiffViewer.tsx` component
2. Modify `RecommendationsView.tsx` to use DiffViewer for EDIT actions
3. Add unit tests
4. Manual testing with real recommendations

### Phase 2: Future Enhancements (Out of Scope)

- Toggle between unified and split view
- Word-level diff highlighting
- Collapsible unchanged sections
- Copy buttons for each side

---

## 13. Open Questions

None - all decisions made:
- Unified view as default (per user preference)
- Line-level diff (word-level deferred)
- No persistence of view preferences

---

## 14. References

- **Ideation Document:** `docs/ideation/diff-view-and-artifact-progress-tracking.md`
- **react-diff-viewer:** https://github.com/praneshr/react-diff-viewer
- **Related Component:** `RecommendationsView.tsx:177-188`
- **API Endpoints:** `/api/context-layers/[id]`, `/api/knowledge-files/[id]`

---

## 15. Acceptance Criteria Checklist

- [ ] EDIT recommendations show "View Changes" link
- [ ] Clicking expands to show unified diff
- [ ] Red highlighting for removed lines
- [ ] Green highlighting for added lines
- [ ] Loading state while fetching original content
- [ ] Error message if original target was deleted
- [ ] ADD recommendations show raw proposed content (unchanged)
- [ ] DELETE recommendations show raw content to delete (unchanged)
- [ ] No regressions in approve/reject functionality
