# Task Breakdown: Teaching Artifact Viewer Pages - Phase 2
Generated: 2025-12-08
Source: specs/feat-teaching-artifact-viewer-pages-phase2.md

## Overview

Add version history browsing and inline diff view to teaching artifact viewer pages. Users can select any version, view changes between versions with inline diff highlighting, and see corpus hash via tooltips.

## Phase 1: Prerequisites & Type Updates

### Task 1.1: Install diff Package
**Description**: Install the `diff` npm package and TypeScript types for computing text differences
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (must complete first)

**Implementation**:
```bash
npm install diff && npm install -D @types/diff
```

**Verification**:
```typescript
// Test import works
import { diffLines } from 'diff';
const result = diffLines('old', 'new');
console.log(result); // Should show diff array
```

**Acceptance Criteria**:
- [ ] `diff` package installed in dependencies
- [ ] `@types/diff` installed in devDependencies
- [ ] Import statement works without errors

---

### Task 1.2: Extend ArtifactSummariesResponse Type
**Description**: Update the ArtifactSummariesResponse type in artifactClient.ts to include `grouped` and `artifacts` fields that the API already returns
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**File**: `lib/teaching/artifactClient.ts`

**Current Type** (incomplete):
```typescript
export interface ArtifactSummariesResponse {
  latest: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  };
  counts: {
    total: number;
    mentalModels: number;
    curricula: number;
    drillSeries: number;
  };
}
```

**Updated Type** (complete):
```typescript
export interface ArtifactSummariesResponse {
  artifacts: ArtifactSummary[];
  grouped: {
    mentalModels: ArtifactSummary[];
    curricula: ArtifactSummary[];
    drillSeries: ArtifactSummary[];
  };
  latest: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  };
  counts: {
    total: number;
    mentalModels: number;
    curricula: number;
    drillSeries: number;
  };
}
```

**Acceptance Criteria**:
- [ ] Type includes `artifacts: ArtifactSummary[]`
- [ ] Type includes `grouped` with mentalModels, curricula, drillSeries arrays
- [ ] No TypeScript errors in existing code

---

### Task 1.3: Add getArtifactSummariesWithVersions Helper
**Description**: Create a helper function that returns the full API response including grouped versions
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**File**: `lib/teaching/artifactClient.ts`

**Implementation**:
```typescript
/**
 * Fetch artifact summaries with all versions grouped by type
 * Use this when you need access to version history
 */
export async function getArtifactSummariesWithVersions(
  projectId: string
): Promise<ArtifactSummariesResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/guru/artifacts`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      artifacts: [],
      grouped: { mentalModels: [], curricula: [], drillSeries: [] },
      latest: { mentalModel: null, curriculum: null, drillSeries: null },
      counts: { total: 0, mentalModels: 0, curricula: 0, drillSeries: 0 },
    };
  }

  return res.json();
}
```

**Acceptance Criteria**:
- [ ] Function exported from artifactClient.ts
- [ ] Returns full response including `grouped` and `artifacts`
- [ ] Handles API errors gracefully with empty defaults

---

## Phase 2: Components

### Task 2.1: Create VersionHistoryPanel Component
**Description**: Create version history sidebar component showing all versions with selection and corpus tooltip
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2, Task 1.3
**Can run parallel with**: Task 2.2

**File**: `components/artifacts/VersionHistoryPanel.tsx`

**Interface**:
```typescript
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArtifactSummary } from '@/lib/teaching/artifactClient';

interface VersionHistoryPanelProps {
  projectId: string;
  artifactType: 'mental-model' | 'curriculum' | 'drill-series';
  versions: ArtifactSummary[];
  currentVersion: number;
}
```

**Implementation**:
```typescript
export default function VersionHistoryPanel({
  projectId,
  artifactType,
  versions,
  currentVersion,
}: VersionHistoryPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sort versions in reverse chronological order (newest first)
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
  const latestVersion = sortedVersions[0]?.version || 0;

  function handleVersionSelect(version: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (version === latestVersion) {
      params.delete('v'); // Latest doesn't need explicit version
    } else {
      params.set('v', version.toString());
    }
    // Preserve diff param if present
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : window.location.pathname);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function truncateHash(hash: string | null): string {
    if (!hash) return 'No hash';
    return hash.slice(0, 8) + '...';
  }

  return (
    <div className="w-48 border-r border-gray-200 bg-gray-50 p-3">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Versions</h3>
      <div className="space-y-2">
        {sortedVersions.map((version) => (
          <button
            key={version.id}
            onClick={() => handleVersionSelect(version.version)}
            className={`w-full text-left p-2 rounded-md transition-colors ${
              version.version === currentVersion
                ? 'bg-blue-100 border border-blue-300'
                : 'hover:bg-gray-100'
            }`}
            data-testid={`version-${version.version}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">
                v{version.version}
                {version.version === latestVersion && (
                  <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">
                    Latest
                  </span>
                )}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(version.generatedAt)}
            </div>
            {/* Corpus hash tooltip */}
            <div
              className="text-xs text-gray-400 mt-1 cursor-help"
              title={`Corpus: ${version.corpusHash || 'Unknown'}`}
            >
              {truncateHash(version.corpusHash)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders all versions in reverse chronological order
- [ ] Highlights currently selected version with blue background
- [ ] Shows "Latest" badge on most recent version
- [ ] Clicking version updates URL with `?v=N`
- [ ] Shows corpus hash in tooltip on hover
- [ ] Preserves `diff` param when switching versions
- [ ] Has data-testid attributes for testing

---

### Task 2.2: Create DiffContent Component
**Description**: Create component that renders content with optional inline diff highlighting
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.1

**File**: `components/artifacts/DiffContent.tsx`

**Interface**:
```typescript
import { diffLines, Change } from 'diff';

interface DiffContentProps {
  currentContent: string;
  previousContent: string | null;
  showDiff: boolean;
}

interface DiffSegment {
  value: string;
  type: 'addition' | 'deletion' | 'unchanged';
}
```

**Implementation**:
```typescript
'use client';

import { diffLines, Change } from 'diff';
import ReactMarkdown from 'react-markdown';

interface DiffContentProps {
  currentContent: string;
  previousContent: string | null;
  showDiff: boolean;
}

interface DiffSegment {
  value: string;
  type: 'addition' | 'deletion' | 'unchanged';
}

function computeInlineDiff(oldText: string, newText: string): DiffSegment[] {
  const changes: Change[] = diffLines(oldText, newText);
  return changes.map((change) => ({
    value: change.value,
    type: change.added ? 'addition' : change.removed ? 'deletion' : 'unchanged',
  }));
}

export default function DiffContent({
  currentContent,
  previousContent,
  showDiff,
}: DiffContentProps) {
  // If not showing diff or no previous content, render normal markdown
  if (!showDiff || !previousContent) {
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{currentContent}</ReactMarkdown>
      </div>
    );
  }

  // Compute diff
  const diffSegments = computeInlineDiff(previousContent, currentContent);

  return (
    <div className="prose prose-sm max-w-none">
      {diffSegments.map((segment, index) => {
        if (segment.type === 'unchanged') {
          return (
            <span key={index} className="diff-unchanged">
              <ReactMarkdown>{segment.value}</ReactMarkdown>
            </span>
          );
        }

        if (segment.type === 'addition') {
          return (
            <span
              key={index}
              className="bg-green-100 border-l-4 border-green-500 pl-2 block my-1"
              data-diff-type="addition"
            >
              <ReactMarkdown>{segment.value}</ReactMarkdown>
            </span>
          );
        }

        if (segment.type === 'deletion') {
          return (
            <span
              key={index}
              className="bg-red-100 border-l-4 border-red-500 pl-2 block my-1 line-through opacity-70"
              data-diff-type="deletion"
            >
              <ReactMarkdown>{segment.value}</ReactMarkdown>
            </span>
          );
        }

        return null;
      })}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders normal markdown when `showDiff` is false
- [ ] Renders normal markdown when `previousContent` is null
- [ ] Shows additions with green background and left border
- [ ] Shows deletions with red background, strikethrough, and reduced opacity
- [ ] Uses `diffLines` from `diff` package for line-by-line comparison
- [ ] Has data-diff-type attributes for testing

---

### Task 2.3: Enhance ArtifactHeader with Diff Toggle
**Description**: Add diff toggle checkbox to ArtifactHeader component
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.1, Task 2.2

**File**: `components/artifacts/ArtifactHeader.tsx`

**Changes to add**:
1. Accept new props: `version`, `showDiff`, `canShowDiff`
2. Add checkbox for diff toggle that updates URL

**Updated Interface**:
```typescript
interface ArtifactHeaderProps {
  artifact: {
    type: GuruArtifactType;
    version: number;
    generatedAt: string;
    status: ArtifactStatus;
  };
  showJson: boolean;
  onToggleJson: () => void;
  // New props for Phase 2
  showDiff?: boolean;
  canShowDiff?: boolean; // false for v1
}
```

**Implementation to add** (inside the header, after JSON toggle):
```typescript
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

// Inside component:
const router = useRouter();
const searchParams = useSearchParams();

function handleDiffToggle() {
  const params = new URLSearchParams(searchParams.toString());
  if (params.has('diff')) {
    params.delete('diff');
  } else {
    params.set('diff', '');
  }
  const queryString = params.toString();
  router.push(queryString ? `?${queryString}` : window.location.pathname);
}

// In JSX, after JSON toggle:
{canShowDiff !== false && (
  <label className="flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={showDiff || false}
      onChange={handleDiffToggle}
      disabled={!canShowDiff}
      className="rounded border-gray-300"
      data-testid="diff-toggle"
    />
    <span className={!canShowDiff ? 'text-gray-400' : ''}>
      Show Diff
    </span>
  </label>
)}
```

**Acceptance Criteria**:
- [ ] Checkbox appears when `canShowDiff` is true or undefined
- [ ] Checkbox is disabled when `canShowDiff` is false (v1)
- [ ] Checking adds `&diff` to URL
- [ ] Unchecking removes `&diff` from URL
- [ ] Preserves other URL params (like `v`)
- [ ] Has data-testid for testing

---

### Task 2.4: Create ArtifactViewerWithVersions Wrapper
**Description**: Create wrapper component that composes VersionHistoryPanel, ArtifactHeader, and DiffContent
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2, Task 2.3
**Can run parallel with**: None

**File**: `components/artifacts/ArtifactViewerWithVersions.tsx`

**Interface**:
```typescript
import { ArtifactDetail, ArtifactSummary } from '@/lib/teaching/artifactClient';

interface ArtifactViewerWithVersionsProps {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  projectId: string;
  showDiff: boolean;
}
```

**Implementation**:
```typescript
'use client';

import { useState } from 'react';
import { ArtifactDetail, ArtifactSummary } from '@/lib/teaching/artifactClient';
import { getArtifactSlug } from '@/lib/teaching/constants';
import ArtifactHeader from './ArtifactHeader';
import VersionHistoryPanel from './VersionHistoryPanel';
import DiffContent from './DiffContent';

interface ArtifactViewerWithVersionsProps {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  projectId: string;
  showDiff: boolean;
}

export function ArtifactViewerWithVersions({
  artifact,
  previousArtifact,
  allVersions,
  projectId,
  showDiff,
}: ArtifactViewerWithVersionsProps) {
  const [showJson, setShowJson] = useState(false);

  const artifactSlug = getArtifactSlug(artifact.type);
  const canShowDiff = artifact.version > 1;

  // Get content as string for diff
  const currentContent = artifact.markdownContent || JSON.stringify(artifact.content, null, 2);
  const previousContent = previousArtifact?.markdownContent ||
    (previousArtifact ? JSON.stringify(previousArtifact.content, null, 2) : null);

  return (
    <div className="flex h-full" data-testid="artifact-viewer-with-versions">
      {/* Version History Panel */}
      <VersionHistoryPanel
        projectId={projectId}
        artifactType={artifactSlug}
        versions={allVersions}
        currentVersion={artifact.version}
      />

      {/* Main Content Area */}
      <div className="flex-1 p-4 overflow-auto">
        <ArtifactHeader
          artifact={artifact}
          showJson={showJson}
          onToggleJson={() => setShowJson(!showJson)}
          showDiff={showDiff}
          canShowDiff={canShowDiff}
        />

        <div className="mt-4">
          {showJson ? (
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(artifact.content, null, 2)}
            </pre>
          ) : (
            <DiffContent
              currentContent={currentContent}
              previousContent={previousContent}
              showDiff={showDiff && canShowDiff}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders VersionHistoryPanel on the left
- [ ] Renders ArtifactHeader with diff toggle
- [ ] Renders DiffContent or JSON based on toggle
- [ ] Passes correct props to all child components
- [ ] Handles missing previousArtifact gracefully
- [ ] Has data-testid for testing

---

## Phase 3: Page Updates

### Task 3.1: Update Mental Model Page with Version Support
**Description**: Update mental-model page to accept searchParams and support version selection
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: Task 3.2, Task 3.3

**File**: `app/projects/[id]/artifacts/teaching/mental-model/page.tsx`

**Full Implementation**:
```typescript
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

  // API returns camelCase keys
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

**Acceptance Criteria**:
- [ ] Accepts `searchParams` with Promise type
- [ ] Defaults to latest version when no `v` param
- [ ] Shows specific version when `v=N` provided
- [ ] Fetches previous version when `diff` param present
- [ ] Shows placeholder when no artifact exists
- [ ] Has `export const dynamic = 'force-dynamic'`

---

### Task 3.2: Update Curriculum Page with Version Support
**Description**: Update curriculum page to accept searchParams and support version selection
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: Task 3.1, Task 3.3

**File**: `app/projects/[id]/artifacts/teaching/curriculum/page.tsx`

**Full Implementation** (same pattern as mental-model, different artifact type):
```typescript
import { ArtifactViewerWithVersions } from '@/components/artifacts/ArtifactViewerWithVersions';
import NoArtifactPlaceholder from '@/components/artifacts/NoArtifactPlaceholder';
import { getArtifactSummariesWithVersions, getArtifactContent } from '@/lib/teaching/artifactClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; diff?: string }>;
}

export default async function CurriculumPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const { v, diff } = await searchParams;

  const summaries = await getArtifactSummariesWithVersions(projectId);

  const curriculumVersions = summaries.grouped.curricula;
  const latestVersion = summaries.latest.curriculum;

  const requestedVersion = v ? parseInt(v) : null;
  const targetArtifact = requestedVersion
    ? curriculumVersions.find((ver) => ver.version === requestedVersion)
    : latestVersion;

  if (!targetArtifact) {
    return <NoArtifactPlaceholder type="curriculum" projectId={projectId} />;
  }

  const { artifact } = await getArtifactContent(projectId, targetArtifact.id);

  let previousArtifact = null;
  if (diff !== undefined && artifact.version > 1) {
    const prevVersion = curriculumVersions.find((ver) => ver.version === artifact.version - 1);
    if (prevVersion) {
      const prevData = await getArtifactContent(projectId, prevVersion.id);
      previousArtifact = prevData.artifact;
    }
  }

  return (
    <ArtifactViewerWithVersions
      artifact={artifact}
      previousArtifact={previousArtifact}
      allVersions={curriculumVersions}
      projectId={projectId}
      showDiff={diff !== undefined}
    />
  );
}
```

**Acceptance Criteria**:
- [ ] Same criteria as Task 3.1, but for curriculum artifact type

---

### Task 3.3: Update Drill Series Page with Version Support
**Description**: Update drill-series page to accept searchParams and support version selection
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: Task 3.1, Task 3.2

**File**: `app/projects/[id]/artifacts/teaching/drill-series/page.tsx`

**Full Implementation** (same pattern as mental-model, different artifact type):
```typescript
import { ArtifactViewerWithVersions } from '@/components/artifacts/ArtifactViewerWithVersions';
import NoArtifactPlaceholder from '@/components/artifacts/NoArtifactPlaceholder';
import { getArtifactSummariesWithVersions, getArtifactContent } from '@/lib/teaching/artifactClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; diff?: string }>;
}

export default async function DrillSeriesPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const { v, diff } = await searchParams;

  const summaries = await getArtifactSummariesWithVersions(projectId);

  const drillSeriesVersions = summaries.grouped.drillSeries;
  const latestVersion = summaries.latest.drillSeries;

  const requestedVersion = v ? parseInt(v) : null;
  const targetArtifact = requestedVersion
    ? drillSeriesVersions.find((ver) => ver.version === requestedVersion)
    : latestVersion;

  if (!targetArtifact) {
    return <NoArtifactPlaceholder type="drill-series" projectId={projectId} />;
  }

  const { artifact } = await getArtifactContent(projectId, targetArtifact.id);

  let previousArtifact = null;
  if (diff !== undefined && artifact.version > 1) {
    const prevVersion = drillSeriesVersions.find((ver) => ver.version === artifact.version - 1);
    if (prevVersion) {
      const prevData = await getArtifactContent(projectId, prevVersion.id);
      previousArtifact = prevData.artifact;
    }
  }

  return (
    <ArtifactViewerWithVersions
      artifact={artifact}
      previousArtifact={previousArtifact}
      allVersions={drillSeriesVersions}
      projectId={projectId}
      showDiff={diff !== undefined}
    />
  );
}
```

**Acceptance Criteria**:
- [ ] Same criteria as Task 3.1, but for drill-series artifact type

---

## Phase 4: Testing

### Task 4.1: Write E2E Tests for Version History
**Description**: Create Playwright E2E tests for version switching and diff view functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1, Task 3.2, Task 3.3
**Can run parallel with**: None

**File**: `e2e/version-history.spec.ts`

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Version History', () => {
  // Note: These tests require a project with multiple artifact versions
  // May need to create test data or mock API responses

  test('displays version history panel with all versions', async ({ page }) => {
    // Navigate to artifact page
    await page.goto('/projects/test-project/artifacts/teaching/mental-model');

    // Verify version panel exists
    const versionPanel = page.locator('[data-testid="version-panel"]');
    await expect(versionPanel).toBeVisible();

    // Should show at least one version
    const versions = page.locator('[data-testid^="version-"]');
    await expect(versions.first()).toBeVisible();
  });

  test('can switch between versions via panel', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/mental-model');

    // Click on v2 if it exists
    const v2Button = page.locator('[data-testid="version-2"]');
    if (await v2Button.isVisible()) {
      await v2Button.click();

      // Verify URL updates
      await expect(page).toHaveURL(/\?v=2/);
    }
  });

  test('shows latest badge on most recent version', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/mental-model');

    // Find the "Latest" badge
    const latestBadge = page.getByText('Latest');
    await expect(latestBadge).toBeVisible();
  });

  test('diff toggle is disabled for v1', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/mental-model?v=1');

    const diffToggle = page.locator('[data-testid="diff-toggle"]');
    await expect(diffToggle).toBeDisabled();
  });

  test('can enable diff view', async ({ page }) => {
    // Navigate to v2 or later
    await page.goto('/projects/test-project/artifacts/teaching/mental-model?v=2');

    const diffToggle = page.locator('[data-testid="diff-toggle"]');
    if (await diffToggle.isEnabled()) {
      await diffToggle.click();

      // Verify URL updates
      await expect(page).toHaveURL(/diff/);

      // Verify diff styling appears
      const additions = page.locator('[data-diff-type="addition"]');
      const deletions = page.locator('[data-diff-type="deletion"]');

      // At least one of these should be visible if there are changes
      const hasChanges = await additions.count() > 0 || await deletions.count() > 0;
      // Note: May not have changes if v2 is same as v1
    }
  });

  test('version URL is shareable', async ({ page }) => {
    // Navigate directly to specific version with diff
    await page.goto('/projects/test-project/artifacts/teaching/mental-model?v=2&diff');

    // Verify viewer loads with versions component
    const viewer = page.locator('[data-testid="artifact-viewer-with-versions"]');
    await expect(viewer).toBeVisible();
  });

  test('shows corpus hash in tooltip', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/mental-model');

    // Hover over a version to see tooltip
    const versionButton = page.locator('[data-testid^="version-"]').first();
    await versionButton.hover();

    // Tooltip should show corpus hash
    const tooltip = page.locator('[title^="Corpus:"]');
    await expect(tooltip).toBeVisible();
  });
});
```

**Acceptance Criteria**:
- [ ] Tests for version panel display
- [ ] Tests for version switching
- [ ] Tests for "Latest" badge
- [ ] Tests for disabled diff on v1
- [ ] Tests for enabling diff view
- [ ] Tests for shareable URLs
- [ ] Tests for corpus tooltip

---

## Summary

| Phase | Tasks | Size | Can Parallelize |
|-------|-------|------|-----------------|
| Phase 1: Prerequisites | 3 | Small | Task 1.1 + 1.2 |
| Phase 2: Components | 4 | Medium | Task 2.1 + 2.2 + 2.3 |
| Phase 3: Page Updates | 3 | Medium | All 3 |
| Phase 4: Testing | 1 | Medium | After all |

**Total Tasks**: 11
**Critical Path**: 1.1 → 1.2 → 1.3 → 2.4 → 3.x → 4.1

**Parallel Execution Opportunities**:
- Phase 1: Task 1.1 and 1.2 can run together
- Phase 2: Task 2.1, 2.2, 2.3 can run together (after Phase 1)
- Phase 3: All 3 page updates can run together (after Task 2.4)
