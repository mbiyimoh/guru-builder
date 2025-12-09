# Teaching Artifact Viewer Pages - Phase 1: Basic Structure

## Status
Draft

## Authors
- Claude Code (AI Assistant)
- Date: 2025-12-08

## Overview

Replace the modal-based teaching artifact viewing experience with dedicated full-page viewers. This Phase 1 specification covers the basic page structure, navigation between artifact types, and migration from modal to page-based viewing.

## Background/Problem Statement

The current implementation displays teaching artifacts (Mental Model, Curriculum, Drill Series) in a modal dialog constrained to `max-w-4xl max-h-[70vh]` (~900×500px usable space). This creates several UX problems:

1. **Insufficient real estate**: Complex hierarchical content (curricula with modules→lessons, drill series with tiers→drills) is cramped
2. **No deep linking**: Users cannot share or bookmark a specific artifact view
3. **Poor navigation**: Long documents require scrolling through the entire modal
4. **Modal fatigue**: Repeated open/close cycles when reviewing multiple artifacts

### Current Implementation

**Data Flow (GuruTeachingManager.tsx)**:
```
User clicks "View" button (line 355-360)
  → onView() calls handleViewArtifact(artifactId) (lines 178, 189, 201)
  → Fetch from /api/projects/{id}/guru/artifacts/{artifactId}
  → setSelectedArtifact(data.artifact)
  → <ArtifactModal> renders (lines 241-246, 388-474)
```

**Modal Constraints**:
- Fixed width: `max-w-4xl` (~896px)
- Fixed height: `max-h-[70vh]`
- No URL state (can't bookmark or share)
- No navigation between artifact types without closing modal

## Goals

- Replace modal viewing with dedicated full-page artifact viewers
- Enable quick navigation between all 3 artifact types via side panel
- Preserve existing markdown rendering and prose styling
- Maintain deep-linkable URLs for each artifact type
- Show version badge (preparation for Phase 2 version history)
- Zero backend changes - use existing API endpoints

## Non-Goals (Phase 1)

- Version history browsing (Phase 2)
- Inline diff view between versions (Phase 2)
- Type-specific enhanced renderers (Phase 3)
- Table of contents navigation (Phase 3)
- Export functionality (deferred)
- Interactive drill mode (deferred)
- Corpus snapshot display (Phase 2)

## Technical Dependencies

- **Next.js 15** App Router (already in use)
- **React 19** (already in use)
- **Tailwind CSS** with prose classes (already configured)
- **react-markdown** with rehype-raw (already installed)
- **shadcn/ui** components (already installed)

No new dependencies required.

## Detailed Design

### Route Structure

```
app/projects/[id]/artifacts/teaching/
├── layout.tsx              # Shared layout with side panel
├── page.tsx                # Redirect to latest available artifact
├── mental-model/
│   └── page.tsx            # Mental Model viewer
├── curriculum/
│   └── page.tsx            # Curriculum viewer
└── drill-series/
    └── page.tsx            # Drill Series viewer
```

### URL Patterns

| URL | Purpose |
|-----|---------|
| `/projects/[id]/artifacts/teaching` | Landing - redirects to first available artifact |
| `/projects/[id]/artifacts/teaching/mental-model` | View latest Mental Model |
| `/projects/[id]/artifacts/teaching/curriculum` | View latest Curriculum |
| `/projects/[id]/artifacts/teaching/drill-series` | View latest Drill Series |

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ TeachingArtifactLayout (layout.tsx)                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────────────────────────────────────┐ │
│ │ ArtifactNav │ │ {children} - Page Content                       │ │
│ │             │ │                                                 │ │
│ │ ← Back      │ │  ┌─────────────────────────────────────────┐   │ │
│ │             │ │  │ ArtifactHeader                          │   │ │
│ │ ──────────  │ │  │ [Title] [v3] [JSON toggle] [Regenerate] │   │ │
│ │             │ │  └─────────────────────────────────────────┘   │ │
│ │ ● Mental    │ │                                                 │ │
│ │   Model     │ │  ┌─────────────────────────────────────────┐   │ │
│ │             │ │  │ ArtifactContent                         │   │ │
│ │ ○ Curriculum│ │  │                                         │   │ │
│ │             │ │  │ [Markdown rendered content with prose]  │   │ │
│ │ ○ Drill     │ │  │                                         │   │ │
│ │   Series    │ │  │                                         │   │ │
│ │             │ │  └─────────────────────────────────────────┘   │ │
│ └─────────────┘ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### New Components

#### 1. `components/artifacts/TeachingArtifactNav.tsx`

Side panel navigation component showing all 3 artifact types.

```typescript
interface TeachingArtifactNavProps {
  projectId: string;
  activeType: 'mental-model' | 'curriculum' | 'drill-series';
  artifacts: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  };
}
```

**Features**:
- Back button linking to `/projects/[id]` (teaching dashboard section)
- 3 artifact type buttons with icons
- Active state indicator (filled circle, highlighted background)
- Disabled state when artifact doesn't exist
- Version badge on each item (e.g., "v3")
- Status indicator (completed/generating/failed)

#### 2. `components/artifacts/ArtifactHeader.tsx`

Header bar for the artifact content area.

```typescript
interface ArtifactHeaderProps {
  artifact: ArtifactDetail;
  showJson: boolean;
  onToggleJson: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}
```

**Features**:
- Artifact type title (e.g., "Mental Model")
- Version badge (e.g., "v3")
- Generation timestamp
- "Show JSON" toggle checkbox
- "Regenerate" button (triggers POST to appropriate endpoint)

#### 3. `components/artifacts/ArtifactContent.tsx`

Main content display area (extracted from current ArtifactModal).

```typescript
interface ArtifactContentProps {
  artifact: ArtifactDetail;
  showJson: boolean;
}
```

**Features**:
- Markdown rendering with ReactMarkdown + rehype-raw
- Full prose styling (copied from current modal)
- JSON view toggle
- Full-height scrollable container

### Page Implementation

#### `app/projects/[id]/artifacts/teaching/layout.tsx`

```typescript
export default async function TeachingArtifactLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  // Fetch artifact summaries for navigation
  const artifactsRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${params.id}/guru/artifacts`,
    { cache: 'no-store' }
  );
  const data = await artifactsRes.json();

  return (
    <div className="flex h-screen">
      <TeachingArtifactNav
        projectId={params.id}
        artifacts={data.latest}
        activeType={/* determined by child route */}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

#### `app/projects/[id]/artifacts/teaching/mental-model/page.tsx`

```typescript
interface PageProps {
  params: { id: string };
}

export default async function MentalModelPage({ params }: PageProps) {
  // 1. Fetch artifact summaries to get latest mental model ID
  const summariesRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${params.id}/guru/artifacts`,
    { cache: 'no-store' }
  );
  const summaries = await summariesRes.json();

  const latestMentalModel = summaries.latest.mentalModel;

  if (!latestMentalModel) {
    return <NoArtifactPlaceholder type="mental-model" projectId={params.id} />;
  }

  // 2. Fetch full artifact content
  const artifactRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${params.id}/guru/artifacts/${latestMentalModel.id}`,
    { cache: 'no-store' }
  );
  const { artifact } = await artifactRes.json();

  return <ArtifactViewer artifact={artifact} projectId={params.id} />;
}
```

### Updates to Existing Code

#### GuruTeachingManager.tsx Changes

**Before (lines 355-360)**:
```typescript
<button
  onClick={onView}
  className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
>
  View
</button>
```

**After**:
```typescript
<Link
  href={`/projects/${projectId}/artifacts/teaching/${typeToSlug(artifact.type)}`}
  className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 text-center"
>
  View
</Link>
```

**Helper function**:
```typescript
function typeToSlug(type: string): string {
  const slugMap: Record<string, string> = {
    'MENTAL_MODEL': 'mental-model',
    'CURRICULUM': 'curriculum',
    'DRILL_SERIES': 'drill-series',
  };
  return slugMap[type] || type.toLowerCase().replace('_', '-');
}
```

**Removals**:
- Remove `handleViewArtifact` function (lines 131-141)
- Remove `selectedArtifact` state (line 43-48)
- Remove `<ArtifactModal>` component and conditional render (lines 241-246, 388-474)
- Keep `ArtifactModal` code in a separate file for reference during migration

### File Organization

```
components/
├── artifacts/
│   ├── TeachingArtifactNav.tsx      # NEW - Side panel navigation
│   ├── ArtifactHeader.tsx           # NEW - Content header bar
│   ├── ArtifactContent.tsx          # NEW - Markdown/JSON display
│   ├── ArtifactViewer.tsx           # NEW - Combines header + content
│   └── NoArtifactPlaceholder.tsx    # NEW - Empty state
└── guru/
    └── GuruTeachingManager.tsx      # MODIFIED - Remove modal, add Link

app/projects/[id]/artifacts/teaching/
├── layout.tsx                       # NEW - Shared layout
├── page.tsx                         # NEW - Redirect logic
├── mental-model/
│   └── page.tsx                     # NEW
├── curriculum/
│   └── page.tsx                     # NEW
└── drill-series/
    └── page.tsx                     # NEW
```

## User Experience

### Navigation Flow

1. User views project page with GuruTeachingManager
2. Clicks "View" on Mental Model card
3. Navigates to `/projects/[id]/artifacts/teaching/mental-model`
4. Full-page viewer loads with:
   - Side panel showing all 3 artifact types (Mental Model highlighted)
   - Header with title, version badge, JSON toggle
   - Scrollable markdown content area
5. User clicks "Curriculum" in side panel
6. Navigates to `/projects/[id]/artifacts/teaching/curriculum`
7. User clicks "← Back" in side panel
8. Returns to `/projects/[id]` (project overview with teaching dashboard)

### Empty States

When an artifact type doesn't exist yet:
- Show placeholder with artifact type name
- "Not yet generated" message
- "Generate" button linking to teaching dashboard
- Still show side panel with other available artifacts

### Loading States

- Side panel: Skeleton loaders for artifact summaries
- Content area: Skeleton loader matching content structure
- Use Suspense boundaries for streaming

## Testing Strategy

### Unit Tests

**TeachingArtifactNav.test.tsx**
```typescript
// Purpose: Verify navigation panel renders correctly and indicates active state
describe('TeachingArtifactNav', () => {
  it('highlights the currently active artifact type');
  it('disables navigation items for non-existent artifacts');
  it('shows version badge when artifact exists');
  it('renders back button with correct href');
});
```

**ArtifactContent.test.tsx**
```typescript
// Purpose: Verify markdown rendering and JSON toggle work correctly
describe('ArtifactContent', () => {
  it('renders markdown content with prose styling');
  it('renders JSON when showJson is true');
  it('handles null markdownContent by falling back to JSON');
  it('renders HTML elements via rehype-raw');
});
```

### Integration Tests

**artifact-viewer-navigation.test.tsx**
```typescript
// Purpose: Verify page navigation works end-to-end
describe('Artifact Viewer Navigation', () => {
  it('navigates from teaching dashboard to artifact page');
  it('switches between artifact types via side panel');
  it('returns to project page via back button');
  it('preserves project context across navigation');
});
```

### E2E Tests (Playwright)

**teaching-artifact-viewer.spec.ts**
```typescript
// Purpose: Validate complete user flow from dashboard to viewer and back
test.describe('Teaching Artifact Viewer', () => {
  test('can view mental model from teaching dashboard', async ({ page }) => {
    // 1. Navigate to project with completed mental model
    // 2. Click View on Mental Model card
    // 3. Verify URL is /projects/[id]/artifacts/teaching/mental-model
    // 4. Verify content displays
    // 5. Verify side panel shows Mental Model as active
  });

  test('can switch between artifact types', async ({ page }) => {
    // 1. Start on mental-model page
    // 2. Click Curriculum in side panel
    // 3. Verify URL changes
    // 4. Verify content changes
    // 5. Verify active indicator moves
  });

  test('shows placeholder for missing artifacts', async ({ page }) => {
    // 1. Navigate to project with only mental model (no curriculum)
    // 2. Click Curriculum in side panel
    // 3. Verify placeholder message displays
    // 4. Verify "Generate" button appears
  });

  test('back button returns to project page', async ({ page }) => {
    // 1. Navigate to artifact viewer
    // 2. Click back button
    // 3. Verify returns to /projects/[id]
    // 4. Verify teaching section is visible
  });
});
```

## Performance Considerations

### Server Components

All pages use React Server Components for:
- Direct database/API access without client-side fetch waterfalls
- Streaming HTML for fast initial paint
- Reduced JavaScript bundle size

### Data Fetching Strategy

1. **Layout** fetches artifact summaries (lightweight, for nav)
2. **Page** fetches full artifact content (only for active type)
3. Use `cache: 'no-store'` to prevent stale data after regeneration

### Bundle Impact

- New components add ~5-10KB to the bundle (minimal)
- Markdown rendering already included (no additional cost)
- No new external dependencies

## Security Considerations

### Authorization

- Pages must verify user owns the project (existing middleware handles this)
- API endpoints already have project ownership checks
- No new attack surface introduced

### Data Exposure

- Artifact content is already exposed via existing API
- No sensitive data in new routes
- URLs don't expose artifact IDs (use type slugs instead)

## Documentation

### Updates Required

1. **CLAUDE.md**: Add new route structure to Critical Directories section
2. **Developer Guide**: Document artifact viewer component architecture
3. **User Guide** (if exists): Document new viewing experience

## Implementation Phases

### Phase 1 Tasks (This Spec)

1. Create `components/artifacts/` directory structure
2. Implement `TeachingArtifactNav` component
3. Implement `ArtifactHeader` component
4. Extract `ArtifactContent` from modal
5. Implement `ArtifactViewer` wrapper component
6. Implement `NoArtifactPlaceholder` component
7. Create route structure under `app/projects/[id]/artifacts/teaching/`
8. Implement layout with side panel
9. Implement 3 artifact type pages
10. Update `GuruTeachingManager` to use Link instead of modal
11. Remove modal code from `GuruTeachingManager`
12. Write unit tests for new components
13. Write E2E test for navigation flow

### Future Phases (Out of Scope)

- **Phase 2**: Version history sidebar, inline diff view, corpus snapshot display
- **Phase 3**: Type-specific enhanced renderers, table of contents navigation

## Open Questions

1. **Regenerate UX**: Should "Regenerate" button in header navigate back to teaching dashboard, or trigger generation inline with polling?
   - **Recommendation**: Navigate to teaching dashboard to maintain consistent generation UX

2. **Loading indicator**: Show loading spinner in side panel while artifact loads, or use full-page skeleton?
   - **Recommendation**: Full-page skeleton for content, instant nav highlight

## References

- Ideation Document: `docs/ideation/teaching-artifact-viewer-page.md`
- Current Modal Implementation: `components/guru/GuruTeachingManager.tsx:388-474`
- API Endpoints: `app/api/projects/[id]/guru/artifacts/`
- Teaching Functions Spec: `specs/feat-guru-teaching-functions.md`
- Next.js App Router Docs: https://nextjs.org/docs/app/building-your-application/routing

## Appendix: Prose Styling Reference

Current prose classes from ArtifactModal (to be preserved in ArtifactContent):

```typescript
className="prose prose-slate max-w-none
  prose-headings:font-semibold
  prose-h1:text-2xl prose-h1:border-b-2 prose-h1:border-blue-600 prose-h1:pb-3 prose-h1:mb-8
  prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-white prose-h2:bg-blue-700 prose-h2:border-l-8 prose-h2:border-blue-900 prose-h2:pl-6 prose-h2:py-3 prose-h2:rounded-r-lg prose-h2:-ml-6 prose-h2:shadow-md
  prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-gray-800 prose-h3:pl-8 prose-h3:border-l-4 prose-h3:border-blue-300 prose-h3:bg-blue-50 prose-h3:py-2 prose-h3:rounded-r
  prose-h4:text-base prose-h4:mt-6 prose-h4:mb-3 prose-h4:text-gray-700 prose-h4:font-medium prose-h4:pl-12 prose-h4:border-l-2 prose-h4:border-gray-300
  prose-p:text-gray-700 prose-p:leading-relaxed prose-p:pl-8
  prose-strong:text-gray-900
  prose-blockquote:border-l-4 prose-blockquote:border-blue-300 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r prose-blockquote:not-italic prose-blockquote:ml-8
  prose-ul:my-4 prose-ul:pl-16 prose-li:my-2
  prose-ol:my-4 prose-ol:pl-16
  prose-hr:my-12 prose-hr:border-t-4 prose-hr:border-blue-200 prose-hr:rounded
  prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:ml-8
  prose-em:text-gray-600
  [&_details]:my-6 [&_details]:ml-8 [&_details]:bg-gray-100 [&_details]:rounded-lg [&_details]:border [&_details]:border-gray-200 [&_details]:shadow-sm
  [&_details_summary]:cursor-pointer [&_details_summary]:px-5 [&_details_summary]:py-3 [&_details_summary]:font-medium [&_details_summary]:text-blue-700 [&_details_summary]:hover:bg-gray-200 [&_details_summary]:rounded-lg [&_details_summary]:select-none
  [&_details[open]_summary]:rounded-b-none [&_details[open]_summary]:border-b [&_details[open]_summary]:border-gray-200
  [&_details>*:not(summary)]:px-5 [&_details>*:not(summary)]:pb-3
"
```
