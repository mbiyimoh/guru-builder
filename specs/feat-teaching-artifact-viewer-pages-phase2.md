# Teaching Artifact Viewer Pages - Phase 2: Version History & Diff

## Status
Draft

## Authors
- Claude Code (AI Assistant)
- Date: 2025-12-08

## Overview

Add version history browsing and inline diff view to the teaching artifact viewer pages. This builds on Phase 1's basic viewer structure to enable users to see all versions of an artifact and compare changes between versions.

## Background/Problem Statement

Phase 1 established dedicated artifact viewer pages with navigation. However, users still cannot:

1. **Access previous versions** - Only the latest version is viewable
2. **See what changed** - No way to understand how content evolved across regenerations
3. **Understand corpus context** - No visibility into what corpus state produced each version

The database already stores all versions with `corpusHash` tracking. The API already returns grouped versions. This phase exposes that data in the UI.

## Goals

- Add version history sidebar showing all versions of current artifact type
- Enable clicking any version to view it (not just latest)
- Add toggle-able inline diff view (IDEE style) showing changes from previous version
- Show corpus hash as tooltip on version items (simple reference, not detailed view)
- Maintain URL-based state for version selection (deep linkable)

## Non-Goals (Phase 2)

- Side-by-side diff comparison (user chose inline diff)
- Version deletion or management
- Rollback/restore functionality
- Enhanced type-specific renderers (Phase 3)
- Table of contents navigation (Phase 3)

## Technical Dependencies

- **Phase 1 completion** - Requires artifact viewer pages to exist
- **diff library** - Need to add for inline diff generation
  - Package: `diff` (npm) - lightweight, well-maintained
  - Install: `npm install diff && npm install -D @types/diff`
- **ArtifactSummariesResponse type update** - Must extend `lib/teaching/artifactClient.ts` to include `grouped` and `artifacts` fields that API already returns

## Detailed Design

### URL Structure Update

```
/projects/[id]/artifacts/teaching/mental-model           # Latest version (default)
/projects/[id]/artifacts/teaching/mental-model?v=2       # Specific version
/projects/[id]/artifacts/teaching/mental-model?v=2&diff  # Version 2 with diff from v1
```

### Updated Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TeachingArtifactLayout                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────────────────────────────────────────────┐ │
│ │ ArtifactNav │ │ Content Area                                            │ │
│ │             │ │                                                         │ │
│ │ ← Back      │ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │             │ │ │ ArtifactHeader                                      │ │ │
│ │ ──────────  │ │ │ [Title] [v3 ▼] [☐ Show Diff] [JSON toggle]         │ │ │
│ │             │ │ └─────────────────────────────────────────────────────┘ │ │
│ │ ● Mental    │ │                                                         │ │
│ │   Model     │ │ ┌──────────────┐ ┌──────────────────────────────────┐   │ │
│ │             │ │ │ VersionPanel │ │ ArtifactContent                  │   │ │
│ │ ○ Curriculum│ │ │              │ │                                  │   │ │
│ │             │ │ │ ● v3 (latest)│ │ [Content with optional diff      │   │ │
│ │ ○ Drill     │ │ │   Dec 8      │ │  highlighting]                   │   │ │
│ │   Series    │ │ │   ▶ corpus   │ │                                  │   │ │
│ │             │ │ │              │ │                                  │   │ │
│ │             │ │ │ ○ v2         │ │                                  │   │ │
│ │             │ │ │   Dec 7      │ │                                  │   │ │
│ │             │ │ │   ▶ corpus   │ │                                  │   │ │
│ │             │ │ │              │ │                                  │   │ │
│ │             │ │ │ ○ v1         │ │                                  │   │ │
│ │             │ │ │   Dec 5      │ │                                  │   │ │
│ │             │ │ └──────────────┘ └──────────────────────────────────┘   │ │
│ └─────────────┘ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### New Components

#### 1. `components/artifacts/VersionHistoryPanel.tsx`

```typescript
interface VersionHistoryPanelProps {
  projectId: string;
  artifactType: 'mental-model' | 'curriculum' | 'drill-series';
  versions: ArtifactSummary[];  // All versions of this type
  currentVersion: number;
  onVersionSelect: (version: number) => void;
}
```

**Features**:
- List all versions in reverse chronological order
- Highlight currently selected version
- Show version number, generation date
- Inline corpus hash tooltip (hover to see truncated hash) - NOT a separate component
- "Latest" badge on most recent version

**Design Decision**: Corpus info is displayed as a simple tooltip on hover rather than a separate expandable component. This reduces complexity and matches actual user need (quick reference, not detailed exploration).

#### 2. `components/artifacts/DiffContent.tsx`

```typescript
interface DiffContentProps {
  currentContent: string;
  previousContent: string | null;
  showDiff: boolean;
}
```

**Features**:
- When diff disabled: render normal markdown
- When diff enabled: render with inline additions/deletions highlighted
- Green background for additions
- Red background with strikethrough for deletions
- IDEE-style single-column diff (not side-by-side)

**Design Decision**: The diff toggle checkbox is integrated directly into `ArtifactHeader` rather than being a separate component. This avoids over-engineering for a simple checkbox that manages URL state.

### API Enhancement (Optional)

The existing API returns all versions via `grouped` response. However, fetching full content for diff requires 2 API calls (current + previous).

**Option A (Simpler)**: Make 2 fetches client-side
- Fetch current version content
- If diff enabled, fetch previous version content
- Compute diff client-side

**Option B (Optimized)**: Add API parameter
```
GET /api/projects/[id]/guru/artifacts/[artifactId]?includePrevious=true
```
Returns both current and previous version content.

**Recommendation**: Start with Option A for simplicity. Optimize to Option B if performance becomes an issue.

### Diff Algorithm

Using the `diff` npm package:

```typescript
import { diffLines } from 'diff';

function computeInlineDiff(oldText: string, newText: string): DiffSegment[] {
  const changes = diffLines(oldText, newText);
  return changes.map(change => ({
    value: change.value,
    type: change.added ? 'addition' : change.removed ? 'deletion' : 'unchanged'
  }));
}
```

### State Management

Version selection uses URL query parameters for deep linking:

```typescript
// In page component
const searchParams = useSearchParams();
const selectedVersion = searchParams.get('v') ? parseInt(searchParams.get('v')!) : null;
const showDiff = searchParams.has('diff');

// Version selection handler
function handleVersionSelect(version: number) {
  const params = new URLSearchParams(searchParams);
  if (version === latestVersion) {
    params.delete('v');  // Latest doesn't need explicit version
  } else {
    params.set('v', version.toString());
  }
  router.push(`?${params.toString()}`);
}
```

### Updated Page Implementation

**IMPORTANT**: Next.js 15 uses Promise-based params and searchParams. Must await them before use.

```typescript
// app/projects/[id]/artifacts/teaching/mental-model/page.tsx

import { ArtifactViewerWithVersions } from '@/components/artifacts/ArtifactViewerWithVersions';
import NoArtifactPlaceholder from '@/components/artifacts/NoArtifactPlaceholder';
import { getArtifactSummariesWithVersions, getArtifactContent } from '@/lib/teaching/artifactClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; diff?: string }>;
}

export default async function MentalModelPage({ params, searchParams }: PageProps) {
  // Await both params (Next.js 15 requirement)
  const { id: projectId } = await params;
  const { v, diff } = await searchParams;

  // 1. Fetch all versions for this artifact type
  const summaries = await getArtifactSummariesWithVersions(projectId);

  // NOTE: API returns camelCase keys - grouped.mentalModels, NOT grouped.MENTAL_MODEL
  const mentalModelVersions = summaries.grouped.mentalModels;
  const latestVersion = summaries.latest.mentalModel;

  // 2. Determine which version to show
  const requestedVersion = v ? parseInt(v) : null;
  const targetArtifact = requestedVersion
    ? mentalModelVersions.find((ver) => ver.version === requestedVersion)
    : latestVersion;

  if (!targetArtifact) {
    return <NoArtifactPlaceholder type="mental-model" projectId={projectId} />;
  }

  // 3. Fetch full content for target version
  const { artifact } = await getArtifactContent(projectId, targetArtifact.id);

  // 4. If diff requested and not v1, fetch previous version
  let previousArtifact = null;
  if (diff !== undefined && artifact.version > 1) {
    const prevVersion = mentalModelVersions.find((ver) => ver.version === artifact.version - 1);
    if (prevVersion) {
      const prevData = await getArtifactContent(projectId, prevVersion.id);
      previousArtifact = prevData.artifact;
    }
  }

  return (
    <ArtifactViewerWithVersions
      artifact={artifact}
      previousArtifact={previousArtifact}
      allVersions={mentalModelVersions}
      projectId={projectId}
      showDiff={diff !== undefined}
    />
  );
}
```

**Key differences from Phase 1 pages**:
- Uses `searchParams` for version selection (`v`) and diff toggle (`diff`)
- Fetches all versions via extended `getArtifactSummariesWithVersions` helper
- Conditionally fetches previous version content for diff comparison

## User Experience

### Version Selection Flow

1. User views artifact page (shows latest by default)
2. Version panel on left shows all versions
3. User clicks older version (e.g., v2)
4. URL updates to `?v=2`, content refreshes to v2
5. User clicks "Show Diff" toggle
6. URL updates to `?v=2&diff`, diff highlights appear
7. User can share URL - recipient sees same version with diff

### Diff Display

**Inline diff styling (IDEE style)**:
```css
.diff-addition {
  background-color: #d4edda;  /* Light green */
  text-decoration: none;
}

.diff-deletion {
  background-color: #f8d7da;  /* Light red */
  text-decoration: line-through;
}
```

### Corpus Hash Display

Corpus hash is shown as a tooltip on hover in the version panel:
```
┌─────────────────────────────────┐
│ ○ v2                            │
│   Dec 7, 2024                   │
│   [hover] → "Corpus: abc123..." │
└─────────────────────────────────┘
```

This is simpler than an expandable section and provides the reference users need without UI complexity.

## Testing Strategy

### Unit Tests

**VersionHistoryPanel.test.tsx**
```typescript
// Purpose: Verify version list renders and selection works
describe('VersionHistoryPanel', () => {
  it('renders all versions in reverse chronological order');
  it('highlights the currently selected version');
  it('shows "Latest" badge on most recent version');
  it('calls onVersionSelect when version clicked');
  it('shows corpus hash in tooltip on hover');
});
```

**DiffContent.test.tsx**
```typescript
// Purpose: Verify diff computation and rendering
describe('DiffContent', () => {
  it('renders normal content when showDiff is false');
  it('highlights additions in green when showDiff is true');
  it('shows deletions with strikethrough when showDiff is true');
  it('handles empty previous content gracefully');
  it('preserves markdown formatting in diff view');
});
```

**ArtifactHeader.test.tsx** (enhancement tests)
```typescript
// Purpose: Verify diff toggle integration
describe('ArtifactHeader diff toggle', () => {
  it('shows diff checkbox when version > 1');
  it('hides diff checkbox when version === 1');
  it('updates URL with &diff when checkbox checked');
  it('removes &diff from URL when checkbox unchecked');
});
```

### E2E Tests

**version-history.spec.ts**
```typescript
test.describe('Version History', () => {
  test('can switch between versions via panel', async ({ page }) => {
    // 1. Navigate to artifact with multiple versions
    // 2. Verify latest version shown by default
    // 3. Click v2 in version panel
    // 4. Verify URL updates to ?v=2
    // 5. Verify content changes to v2
  });

  test('can enable diff view', async ({ page }) => {
    // 1. Navigate to artifact v3
    // 2. Click "Show Diff" toggle
    // 3. Verify URL updates to include &diff
    // 4. Verify diff highlighting appears
  });

  test('diff is disabled for v1', async ({ page }) => {
    // 1. Navigate to artifact v1
    // 2. Verify "Show Diff" toggle is disabled
  });

  test('version URL is shareable', async ({ page }) => {
    // 1. Navigate directly to ?v=2&diff
    // 2. Verify correct version loads
    // 3. Verify diff is shown
  });
});
```

## Performance Considerations

### Caching Strategy

- Version list: No-store (needs fresh data after regeneration)
- Individual artifacts: Could cache with version in key, but keeping no-store for simplicity

### Diff Computation

- Diff computed client-side after both versions fetched
- For large artifacts, consider:
  - Showing loading state during diff computation
  - Using web worker for diff (if needed)
  - Limiting diff to first N lines with "show more"

## Implementation Tasks

### Prerequisites
1. Install `diff` npm package: `npm install diff && npm install -D @types/diff`
2. Extend `ArtifactSummariesResponse` type in `lib/teaching/artifactClient.ts` to include:
   - `grouped: { mentalModels: ArtifactSummary[]; curricula: ArtifactSummary[]; drillSeries: ArtifactSummary[] }`
   - `artifacts: ArtifactSummary[]` (flat array)
3. Add `getArtifactSummariesWithVersions()` helper function that returns full response

### Components (2 new components, 1 enhancement)
4. Create `VersionHistoryPanel` component with inline corpus tooltip
5. Create `DiffContent` component with inline diff rendering
6. Enhance `ArtifactHeader` to include diff toggle checkbox (not a separate component)

### Page Updates
7. Update all 3 artifact pages to accept `searchParams` (Promise-based, Next.js 15 pattern)
8. Implement version selection with URL state (`?v=N`)
9. Implement diff fetching logic (`&diff` parameter)

### Styling & Polish
10. Add diff styling (green additions, red deletions with Tailwind classes)
11. Create `ArtifactViewerWithVersions` wrapper to compose components

### Testing
12. Write E2E tests for version switching and diff view

## Open Questions

1. **Diff granularity**: Should diff be line-by-line or word-by-word?
   - **Recommendation**: Line-by-line for markdown content (cleaner)

2. **Large diffs**: What if diff is very large (complete rewrite)?
   - **Recommendation**: Show full diff with scroll, maybe add "X lines changed" summary

## References

- Phase 1 Spec: `specs/feat-teaching-artifact-viewer-pages-phase1.md`
- Ideation Document: `docs/ideation/teaching-artifact-viewer-page.md`
- diff library: https://www.npmjs.com/package/diff
