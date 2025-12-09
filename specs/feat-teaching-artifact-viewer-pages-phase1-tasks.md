# Task Breakdown: Teaching Artifact Viewer Pages - Phase 1

Generated: 2025-12-08
Source: specs/feat-teaching-artifact-viewer-pages-phase1.md

## Overview

Replace modal-based teaching artifact viewing with dedicated full-page viewers. Create route structure at `/projects/[id]/artifacts/teaching/[type]` with side panel navigation between Mental Model, Curriculum, and Drill Series artifacts.

## Dependency Graph

```
[Task 1.1] Directory Setup ─────────────────────────────┐
                                                        │
[Task 1.2] TeachingArtifactNav ──────────┐              │
                                         │              │
[Task 1.3] ArtifactHeader ───────────────┼──────────────┤
                                         │              │
[Task 1.4] ArtifactContent ──────────────┤              │
                                         │              │
[Task 1.5] NoArtifactPlaceholder ────────┤              │
                                         ▼              ▼
                              [Task 2.1] ArtifactViewer ─┐
                                                         │
                              [Task 2.2] Layout.tsx ─────┼─────────┐
                                                         │         │
                              [Task 2.3] Landing Page ───┤         │
                                                         │         │
                              [Task 2.4] 3 Type Pages ───┘         │
                                                                   │
                                    [Task 3.1] Update GuruTeachingManager
                                                                   │
                                    [Task 3.2] E2E Tests ──────────┘
```

## Phase 1: Foundation Components

### Task 1.1: Create Directory Structure
**Description**: Set up the directory structure for artifact viewer components and routes
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (must be first)

**Implementation Steps**:
1. Create `components/artifacts/` directory
2. Create `app/projects/[id]/artifacts/teaching/` directory structure
3. Create nested directories for each artifact type

**Commands to run**:
```bash
mkdir -p components/artifacts
mkdir -p "app/projects/[id]/artifacts/teaching/mental-model"
mkdir -p "app/projects/[id]/artifacts/teaching/curriculum"
mkdir -p "app/projects/[id]/artifacts/teaching/drill-series"
```

**Acceptance Criteria**:
- [ ] Directory structure exists as specified
- [ ] All directories are git-tracked with placeholder files if needed

---

### Task 1.2: Implement TeachingArtifactNav Component
**Description**: Create the side panel navigation component for switching between artifact types
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.3, 1.4, 1.5

**File**: `components/artifacts/TeachingArtifactNav.tsx`

**Interface**:
```typescript
interface ArtifactSummary {
  id: string;
  type: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  version: number;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  generatedAt: string;
}

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

**Full Implementation**:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ArtifactSummary {
  id: string;
  type: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  version: number;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  generatedAt: string;
}

interface TeachingArtifactNavProps {
  projectId: string;
  artifacts: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  };
}

const artifactTypes = [
  { key: 'mental-model', label: 'Mental Model', icon: '🧠', propKey: 'mentalModel' },
  { key: 'curriculum', label: 'Curriculum', icon: '📚', propKey: 'curriculum' },
  { key: 'drill-series', label: 'Drill Series', icon: '🎯', propKey: 'drillSeries' },
] as const;

export function TeachingArtifactNav({ projectId, artifacts }: TeachingArtifactNavProps) {
  const pathname = usePathname();

  // Determine active type from pathname
  const activeType = artifactTypes.find(t => pathname.includes(t.key))?.key || 'mental-model';

  return (
    <nav className="w-64 bg-gray-50 border-r border-gray-200 h-full flex flex-col">
      {/* Back button */}
      <div className="p-4 border-b border-gray-200">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Project
        </Link>
      </div>

      {/* Artifact type navigation */}
      <div className="flex-1 p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Teaching Artifacts
        </h3>
        <div className="space-y-1">
          {artifactTypes.map(({ key, label, icon, propKey }) => {
            const artifact = artifacts[propKey as keyof typeof artifacts];
            const isActive = activeType === key;
            const hasArtifact = artifact !== null;
            const isCompleted = artifact?.status === 'COMPLETED';
            const isGenerating = artifact?.status === 'GENERATING';
            const isFailed = artifact?.status === 'FAILED';

            return (
              <Link
                key={key}
                href={`/projects/${projectId}/artifacts/teaching/${key}`}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${isActive
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                  ${!hasArtifact ? 'opacity-50' : ''}
                `}
              >
                {/* Status indicator */}
                <span className={`
                  w-2 h-2 rounded-full flex-shrink-0
                  ${isActive ? 'bg-blue-600' : ''}
                  ${!isActive && isCompleted ? 'bg-green-500' : ''}
                  ${!isActive && isGenerating ? 'bg-yellow-500 animate-pulse' : ''}
                  ${!isActive && isFailed ? 'bg-red-500' : ''}
                  ${!isActive && !hasArtifact ? 'bg-gray-300' : ''}
                `} />

                {/* Icon and label */}
                <span className="flex-1 flex items-center gap-2">
                  <span>{icon}</span>
                  <span>{label}</span>
                </span>

                {/* Version badge */}
                {artifact && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                    v{artifact.version}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
```

**Acceptance Criteria**:
- [ ] Component renders with back button linking to `/projects/[id]`
- [ ] Shows all 3 artifact types with icons
- [ ] Highlights currently active type based on URL
- [ ] Shows version badge when artifact exists
- [ ] Shows status indicator (green=complete, yellow=generating, red=failed, gray=none)
- [ ] Disabled/muted appearance for non-existent artifacts

---

### Task 1.3: Implement ArtifactHeader Component
**Description**: Create the header bar showing artifact title, version, and controls
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, 1.4, 1.5

**File**: `components/artifacts/ArtifactHeader.tsx`

**Full Implementation**:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ArtifactDetail {
  id: string;
  type: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  version: number;
  generatedAt: string;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
}

interface ArtifactHeaderProps {
  artifact: ArtifactDetail;
  projectId: string;
  showJson: boolean;
  onToggleJson: () => void;
}

const typeLabels: Record<string, string> = {
  MENTAL_MODEL: 'Mental Model',
  CURRICULUM: 'Curriculum',
  DRILL_SERIES: 'Drill Series',
};

const typeEndpoints: Record<string, string> = {
  MENTAL_MODEL: 'mental-model',
  CURRICULUM: 'curriculum',
  DRILL_SERIES: 'drill-series',
};

export function ArtifactHeader({ artifact, projectId, showJson, onToggleJson }: ArtifactHeaderProps) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const endpoint = typeEndpoints[artifact.type];
      const res = await fetch(`/api/projects/${projectId}/guru/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to start regeneration');
      }

      // Navigate back to teaching dashboard to see generation progress
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Failed to regenerate:', error);
      alert(error instanceof Error ? error.message : 'Failed to start regeneration');
      setIsRegenerating(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {typeLabels[artifact.type] || artifact.type}
        </h1>
        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
          v{artifact.version}
        </span>
        <span className="text-sm text-gray-500">
          Generated {new Date(artifact.generatedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* JSON toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showJson}
            onChange={() => onToggleJson()}
            className="rounded border-gray-300"
          />
          Show JSON
        </label>

        {/* Regenerate button */}
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className={`
            px-4 py-2 text-sm font-medium rounded-md
            ${isRegenerating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          {isRegenerating ? 'Starting...' : 'Regenerate'}
        </button>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Shows artifact type title (Mental Model, Curriculum, Drill Series)
- [ ] Shows version badge (e.g., "v3")
- [ ] Shows generation date in readable format
- [ ] JSON toggle checkbox works
- [ ] Regenerate button triggers POST and navigates to dashboard
- [ ] Regenerate button shows loading state while processing

---

### Task 1.4: Implement ArtifactContent Component
**Description**: Create the main content display with markdown rendering and JSON view
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, 1.3, 1.5

**File**: `components/artifacts/ArtifactContent.tsx`

**Full Implementation**:
```typescript
'use client';

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface ArtifactContentProps {
  content: unknown;
  markdownContent: string | null;
  showJson: boolean;
}

const proseClasses = `prose prose-slate max-w-none
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
`;

export function ArtifactContent({ content, markdownContent, showJson }: ArtifactContentProps) {
  if (showJson) {
    return (
      <div className="p-6 bg-gray-50 h-full overflow-auto">
        <pre className="text-xs bg-white p-4 rounded-lg overflow-x-auto border font-mono">
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  }

  if (markdownContent) {
    return (
      <div className="p-6 bg-gray-50 h-full overflow-auto">
        <div className={proseClasses}>
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{markdownContent}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // Fallback to JSON if no markdown
  return (
    <div className="p-6 bg-gray-50 h-full overflow-auto">
      <pre className="text-xs bg-white p-4 rounded-lg overflow-x-auto border font-mono">
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders markdown content with full prose styling
- [ ] Renders JSON when showJson is true
- [ ] Falls back to JSON when markdownContent is null
- [ ] HTML elements render correctly via rehype-raw (e.g., `<details>`)
- [ ] Content area is scrollable with proper padding
- [ ] Preserves all prose styling from original modal

---

### Task 1.5: Implement NoArtifactPlaceholder Component
**Description**: Create the empty state placeholder for when an artifact doesn't exist
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, 1.3, 1.4

**File**: `components/artifacts/NoArtifactPlaceholder.tsx`

**Full Implementation**:
```typescript
import Link from 'next/link';

interface NoArtifactPlaceholderProps {
  type: 'mental-model' | 'curriculum' | 'drill-series';
  projectId: string;
}

const typeLabels: Record<string, string> = {
  'mental-model': 'Mental Model',
  'curriculum': 'Curriculum',
  'drill-series': 'Drill Series',
};

const typeIcons: Record<string, string> = {
  'mental-model': '🧠',
  'curriculum': '📚',
  'drill-series': '🎯',
};

export function NoArtifactPlaceholder({ type, projectId }: NoArtifactPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">{typeIcons[type]}</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {typeLabels[type]} Not Generated
        </h2>
        <p className="text-gray-600 mb-6">
          This artifact hasn't been generated yet. Generate it from the teaching dashboard to view it here.
        </p>
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Go to Teaching Dashboard
        </Link>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Shows artifact type name and icon
- [ ] Shows "Not Generated" message
- [ ] Shows helpful explanation text
- [ ] "Go to Teaching Dashboard" button links to `/projects/[id]`
- [ ] Centered layout with proper spacing

---

## Phase 2: Route Structure & Pages

### Task 2.1: Implement ArtifactViewer Wrapper Component
**Description**: Create the wrapper component that combines header and content
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.3, 1.4
**Can run parallel with**: None

**File**: `components/artifacts/ArtifactViewer.tsx`

**Full Implementation**:
```typescript
'use client';

import { useState } from 'react';
import { ArtifactHeader } from './ArtifactHeader';
import { ArtifactContent } from './ArtifactContent';

interface ArtifactDetail {
  id: string;
  type: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  version: number;
  content: unknown;
  markdownContent: string | null;
  generatedAt: string;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
}

interface ArtifactViewerProps {
  artifact: ArtifactDetail;
  projectId: string;
}

export function ArtifactViewer({ artifact, projectId }: ArtifactViewerProps) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <ArtifactHeader
        artifact={artifact}
        projectId={projectId}
        showJson={showJson}
        onToggleJson={() => setShowJson(!showJson)}
      />
      <div className="flex-1 overflow-hidden">
        <ArtifactContent
          content={artifact.content}
          markdownContent={artifact.markdownContent}
          showJson={showJson}
        />
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Combines ArtifactHeader and ArtifactContent
- [ ] Manages showJson state
- [ ] Fills available height
- [ ] Passes all required props correctly

---

### Task 2.2: Implement Layout with Side Panel
**Description**: Create the shared layout that wraps all artifact pages with navigation
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2, 2.1
**Can run parallel with**: None

**File**: `app/projects/[id]/artifacts/teaching/layout.tsx`

**Full Implementation**:
```typescript
import { TeachingArtifactNav } from '@/components/artifacts/TeachingArtifactNav';

interface LayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

async function getArtifactSummaries(projectId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/guru/artifacts`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch artifacts');
  }

  return res.json();
}

export default async function TeachingArtifactLayout({ children, params }: LayoutProps) {
  const { id: projectId } = params;

  let artifacts = { mentalModel: null, curriculum: null, drillSeries: null };

  try {
    const data = await getArtifactSummaries(projectId);
    artifacts = data.latest;
  } catch (error) {
    console.error('Failed to fetch artifact summaries:', error);
  }

  return (
    <div className="flex h-screen bg-white">
      <TeachingArtifactNav
        projectId={projectId}
        artifacts={artifacts}
      />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Fetches artifact summaries for navigation
- [ ] Renders TeachingArtifactNav in side panel
- [ ] Main content area takes remaining space
- [ ] Handles fetch errors gracefully
- [ ] Uses `cache: 'no-store'` for fresh data

---

### Task 2.3: Implement Landing Page with Redirect
**Description**: Create the landing page that redirects to first available artifact
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: Task 2.4

**File**: `app/projects/[id]/artifacts/teaching/page.tsx`

**Full Implementation**:
```typescript
import { redirect } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

async function getArtifactSummaries(projectId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/guru/artifacts`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return { latest: { mentalModel: null, curriculum: null, drillSeries: null } };
  }

  return res.json();
}

export default async function TeachingArtifactsLandingPage({ params }: PageProps) {
  const { id: projectId } = params;
  const data = await getArtifactSummaries(projectId);
  const { mentalModel, curriculum, drillSeries } = data.latest;

  // Redirect to first available artifact in priority order
  if (mentalModel) {
    redirect(`/projects/${projectId}/artifacts/teaching/mental-model`);
  }
  if (curriculum) {
    redirect(`/projects/${projectId}/artifacts/teaching/curriculum`);
  }
  if (drillSeries) {
    redirect(`/projects/${projectId}/artifacts/teaching/drill-series`);
  }

  // If no artifacts exist, redirect to mental model page (shows placeholder)
  redirect(`/projects/${projectId}/artifacts/teaching/mental-model`);
}
```

**Acceptance Criteria**:
- [ ] Redirects to mental model if it exists
- [ ] Falls back to curriculum, then drill series
- [ ] Redirects to mental-model page (with placeholder) if none exist
- [ ] No visible content (just redirects)

---

### Task 2.4: Implement 3 Artifact Type Pages
**Description**: Create the individual pages for mental-model, curriculum, and drill-series
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, 2.2
**Can run parallel with**: Task 2.3

**Files**:
- `app/projects/[id]/artifacts/teaching/mental-model/page.tsx`
- `app/projects/[id]/artifacts/teaching/curriculum/page.tsx`
- `app/projects/[id]/artifacts/teaching/drill-series/page.tsx`

**Implementation Template** (same pattern for all 3):
```typescript
// app/projects/[id]/artifacts/teaching/mental-model/page.tsx
import { ArtifactViewer } from '@/components/artifacts/ArtifactViewer';
import { NoArtifactPlaceholder } from '@/components/artifacts/NoArtifactPlaceholder';

interface PageProps {
  params: { id: string };
}

async function getArtifactSummaries(projectId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/guru/artifacts`, {
    cache: 'no-store',
  });
  if (!res.ok) return { latest: { mentalModel: null } };
  return res.json();
}

async function getArtifactContent(projectId: string, artifactId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/guru/artifacts/${artifactId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch artifact');
  return res.json();
}

export default async function MentalModelPage({ params }: PageProps) {
  const { id: projectId } = params;

  // Get artifact summaries
  const summaries = await getArtifactSummaries(projectId);
  const latestArtifact = summaries.latest.mentalModel;

  // Show placeholder if no artifact exists
  if (!latestArtifact) {
    return <NoArtifactPlaceholder type="mental-model" projectId={projectId} />;
  }

  // Fetch full artifact content
  const { artifact } = await getArtifactContent(projectId, latestArtifact.id);

  return <ArtifactViewer artifact={artifact} projectId={projectId} />;
}
```

**For curriculum/page.tsx**: Replace `mentalModel` with `curriculum` and `"mental-model"` with `"curriculum"`

**For drill-series/page.tsx**: Replace `mentalModel` with `drillSeries` and `"mental-model"` with `"drill-series"`

**Acceptance Criteria**:
- [ ] Mental model page fetches and displays mental model artifact
- [ ] Curriculum page fetches and displays curriculum artifact
- [ ] Drill series page fetches and displays drill series artifact
- [ ] All pages show NoArtifactPlaceholder when artifact doesn't exist
- [ ] All pages use cache: 'no-store' for fresh data

---

## Phase 3: Integration & Testing

### Task 3.1: Update GuruTeachingManager to Use Links
**Description**: Modify the existing component to navigate instead of opening modal
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: None

**File**: `components/guru/GuruTeachingManager.tsx`

**Changes Required**:

1. **Add Link import** at top of file:
```typescript
import Link from 'next/link';
```

2. **Add helper function** (after imports):
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

3. **Remove state** (delete lines 43-48):
```typescript
// DELETE:
const [selectedArtifact, setSelectedArtifact] = useState<{
  id: string;
  type: string;
  content: unknown;
  markdownContent: string | null;
} | null>(null);
```

4. **Remove handleViewArtifact function** (delete lines 131-141):
```typescript
// DELETE entire function:
async function handleViewArtifact(artifactId: string) {
  // ...
}
```

5. **Update ArtifactCard onView prop** - In ArtifactCard interface and usage, replace button with Link.

In ArtifactCard component (around line 354-360), replace:
```typescript
// BEFORE:
{isCompleted && (
  <button
    onClick={onView}
    className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
  >
    View
  </button>
)}
```

With:
```typescript
// AFTER:
{isCompleted && artifact && (
  <Link
    href={`/projects/${projectId}/artifacts/teaching/${typeToSlug(artifact.type)}`}
    className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 text-center"
  >
    View
  </Link>
)}
```

6. **Update ArtifactCard props** - Need to pass projectId and artifact.type. Update interface:
```typescript
interface ArtifactCardProps {
  title: string;
  description: string;
  artifact: ArtifactSummary | null | undefined;
  projectId: string;  // ADD THIS
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  // Remove: onView: () => void;
  prerequisite?: string;
}
```

7. **Remove ArtifactModal render** (delete lines 241-246):
```typescript
// DELETE:
{selectedArtifact && (
  <ArtifactModal
    artifact={selectedArtifact}
    onClose={() => setSelectedArtifact(null)}
  />
)}
```

8. **Remove ArtifactModal component** (delete lines 378-474) - the entire function

9. **Update ArtifactCard usage** to pass projectId:
```typescript
<ArtifactCard
  title="Mental Model"
  description="Core principles and frameworks extracted from your corpus"
  artifact={latest?.mentalModel}
  projectId={projectId}  // ADD THIS
  canGenerate={hasCorpus}
  isGenerating={generating === 'mental-model'}
  onGenerate={() => handleGenerate('mental-model')}
  // Remove: onView={() => latest?.mentalModel && handleViewArtifact(latest.mentalModel.id)}
/>
```

**Acceptance Criteria**:
- [ ] "View" buttons are Links navigating to artifact viewer pages
- [ ] Modal code completely removed
- [ ] handleViewArtifact function removed
- [ ] selectedArtifact state removed
- [ ] Component still handles generation correctly
- [ ] No TypeScript errors

---

### Task 3.2: Write E2E Tests for Navigation Flow
**Description**: Create Playwright tests validating the complete user flow
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: None

**File**: `e2e/teaching-artifact-viewer.spec.ts`

**Full Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Teaching Artifact Viewer', () => {
  // Assumes a test project exists with at least mental model generated
  const testProjectId = process.env.TEST_PROJECT_ID || 'test-project-id';

  test.beforeEach(async ({ page }) => {
    // Navigate to project page
    await page.goto(`/projects/${testProjectId}`);
    // Wait for teaching section to load
    await page.waitForSelector('text=Guru Teaching Pipeline');
  });

  test('can view mental model from teaching dashboard', async ({ page }) => {
    // Click View on Mental Model card
    const viewButton = page.locator('text=Mental Model').locator('..').locator('text=View');
    await viewButton.click();

    // Verify URL changed
    await expect(page).toHaveURL(new RegExp(`/projects/${testProjectId}/artifacts/teaching/mental-model`));

    // Verify content displays
    await expect(page.locator('h1')).toContainText('Mental Model');

    // Verify side panel shows Mental Model as active
    const activeNav = page.locator('nav a.bg-blue-100');
    await expect(activeNav).toContainText('Mental Model');
  });

  test('can switch between artifact types via side panel', async ({ page }) => {
    // Start on mental model page
    await page.goto(`/projects/${testProjectId}/artifacts/teaching/mental-model`);
    await expect(page.locator('h1')).toContainText('Mental Model');

    // Click Curriculum in side panel
    await page.locator('nav').locator('text=Curriculum').click();

    // Verify URL changes
    await expect(page).toHaveURL(new RegExp(`/artifacts/teaching/curriculum`));

    // Verify active indicator moved
    const activeNav = page.locator('nav a.bg-blue-100');
    await expect(activeNav).toContainText('Curriculum');
  });

  test('shows placeholder for missing artifacts', async ({ page }) => {
    // Navigate directly to an artifact that might not exist
    await page.goto(`/projects/${testProjectId}/artifacts/teaching/drill-series`);

    // Check if placeholder or content shows
    const hasContent = await page.locator('h1:has-text("Drill Series")').count() > 0;
    const hasPlaceholder = await page.locator('text=Not Generated').count() > 0;

    // Either content or placeholder should be visible
    expect(hasContent || hasPlaceholder).toBeTruthy();
  });

  test('back button returns to project page', async ({ page }) => {
    // Navigate to artifact viewer
    await page.goto(`/projects/${testProjectId}/artifacts/teaching/mental-model`);

    // Click back button
    await page.locator('text=Back to Project').click();

    // Verify returns to project page
    await expect(page).toHaveURL(new RegExp(`/projects/${testProjectId}$`));

    // Verify teaching section is visible
    await expect(page.locator('text=Guru Teaching Pipeline')).toBeVisible();
  });

  test('URL is deep-linkable', async ({ page }) => {
    // Navigate directly to curriculum page
    await page.goto(`/projects/${testProjectId}/artifacts/teaching/curriculum`);

    // Should load correctly without going through dashboard
    await expect(page.locator('nav')).toBeVisible();
    const activeNav = page.locator('nav a.bg-blue-100');
    await expect(activeNav).toContainText('Curriculum');
  });
});
```

**Acceptance Criteria**:
- [ ] Test file created in e2e/ directory
- [ ] Tests cover: dashboard to viewer, switching types, placeholder, back button, deep linking
- [ ] Tests use appropriate selectors and waits
- [ ] Tests pass when run against development server

---

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| **Phase 1: Foundation** | 5 tasks | None |
| **Phase 2: Routes** | 4 tasks | Phase 1 |
| **Phase 3: Integration** | 2 tasks | Phase 2 |

**Total**: 11 tasks

**Parallel Execution Opportunities**:
- Tasks 1.2, 1.3, 1.4, 1.5 can run in parallel
- Tasks 2.3 and 2.4 can run in parallel

**Critical Path**: 1.1 → 1.2 → 2.2 → 2.4 → 3.1 → 3.2

**Estimated Complexity**: Medium (primarily UI work, no backend changes)
