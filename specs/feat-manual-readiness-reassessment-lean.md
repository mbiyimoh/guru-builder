# Manual Readiness Re-Assessment

## Status
Draft

## Authors
Claude | 2025-12-21

## Overview
Add a "Re-assess Readiness" button to the readiness page that manually triggers dimension tagging on all existing corpus items and recalculates the readiness score.

## Problem Statement
Corpus content added before the auto-tagging fix (or via indirect research) lacks dimension tags. Users see stale readiness scores with "0 confirmed items" even when their corpus contains relevant content. There's no way to trigger a fresh assessment without applying new recommendations.

## Goals
- Allow users to manually trigger a full corpus re-assessment
- Re-tag all context layers and knowledge files with dimension suggestions
- Recalculate and display the updated readiness score

## Non-Goals
- Automatic/scheduled re-tagging
- Background job processing (blocking request is acceptable for MVP)
- Progress tracking for individual items
- Partial re-assessment (only untagged items)
- Changing the underlying tagging or scoring algorithms

## Technical Approach

### Files to Modify
1. `app/api/projects/[id]/readiness/route.ts` - Add POST handler
2. `app/projects/[id]/readiness/ReadinessPageContent.tsx` - Add button with loading state

### Implementation Details

#### 1. API Endpoint (POST /api/projects/[id]/readiness)

```typescript
// app/api/projects/[id]/readiness/route.ts

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  // Auth check
  const authError = await withProjectAuth(projectId);
  if (authError) return authError;

  // Fetch all corpus items
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      contextLayers: { select: { id: true, title: true, content: true } },
      knowledgeFiles: { select: { id: true, title: true, content: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Build items list for batch tagging
  const items: AutoTagParams[] = [
    ...project.contextLayers.map(layer => ({
      projectId,
      itemId: layer.id,
      itemType: 'layer' as const,
      content: layer.content,
      title: layer.title,
    })),
    ...project.knowledgeFiles.map(file => ({
      projectId,
      itemId: file.id,
      itemType: 'file' as const,
      content: file.content,
      title: file.title,
    })),
  ];

  // Run batch tagging
  await autoTagCorpusItems(items);

  // Calculate fresh score
  const { score, dimensions } = await calculateReadinessScore(projectId);

  return NextResponse.json({
    success: true,
    itemsProcessed: items.length,
    score,
    dimensions,
  });
}
```

#### 2. UI Button

Add to `ReadinessPageContent.tsx` in the actions section:

```tsx
const [reassessing, setReassessing] = useState(false);

const handleReassess = async () => {
  setReassessing(true);
  try {
    const res = await fetch(`/api/projects/${projectId}/readiness`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setScore(data.score);
      setDimensions(data.dimensions);
    }
  } catch (err) {
    console.error('Re-assessment failed:', err);
  } finally {
    setReassessing(false);
  }
};

// In the actions section:
<Button
  variant="outline"
  onClick={handleReassess}
  disabled={reassessing}
>
  {reassessing ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Re-assessing...
    </>
  ) : (
    <>
      <RefreshCw className="w-4 h-4 mr-2" />
      Re-assess Readiness
    </>
  )}
</Button>
```

## Testing Approach

### Key Scenarios
1. Click "Re-assess" button → shows loading state → updates score display
2. Empty corpus (no layers/files) → completes without error, score remains low
3. Auth error → returns 401/403

### Manual Verification
- Add content via research
- Click "Re-assess Readiness"
- Verify dimension tags created (check console logs)
- Verify score updates in UI

## Open Questions
- Should we add a toast notification on success/failure? (Probably yes for UX, but not strictly required)

## Future Improvements and Enhancements

**Out of scope for initial implementation:**

- **Background job processing**: For large corpora (50+ items), could use Inngest to process in background with progress updates
- **Selective re-tagging**: Only process items without existing tags, or items modified since last assessment
- **Rate limiting**: Prevent spamming the button (currently not needed given visible loading state)
- **Detailed progress UI**: Show which items are being processed, estimated time remaining
- **Comparison view**: Show before/after score change animation
- **Automatic re-assessment triggers**: E.g., after research completes, after manual corpus edits

## References
- Related fix: Auto-tagging system refactor (same session)
- `lib/dimensions/autoTag.ts` - Batch tagging function
- `lib/readiness/scoring.ts` - Score calculation
