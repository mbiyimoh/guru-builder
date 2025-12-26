# Task Breakdown: Unified Teaching Artifact Page

**Generated:** 2025-12-23
**Source:** specs/unified-teaching-artifact-page/02-specification.md
**Last Decompose:** 2025-12-23
**Mode:** Full

---

## Overview

This feature combines artifact generation and viewing into a single page per artifact type, with a clean "Simple Mode" default for non-technical users and an "Advanced Mode" toggle that reveals the full feature set.

**Key deliverables:**
- TeachingPageHeader component (back + advanced toggle)
- ArtifactTabBar component (horizontal tab navigation)
- ExpandableNotes component (collapsible generation notes)
- SimpleToolbar component (minimal controls for Simple Mode)
- UnifiedArtifactPage component (main container)
- Updated layout.tsx (remove sidebar, add header)
- Updated [type]/page.tsx (use UnifiedArtifactPage)

---

## Phase 1: Foundation (Route + Layout)

### Task 1.1: Create TeachingPageHeader Component

**Description:** Create the top header with back button and advanced mode toggle
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.2, 1.3

**Technical Requirements:**
- File location: `components/artifacts/TeachingPageHeader.tsx`
- Use shadcn/ui Switch component for toggle
- Back link navigates to `/projects/[id]`
- Toggle state passed via props (lifted to parent)
- Responsive: toggle label hidden on small screens

**Implementation:**
```typescript
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface TeachingPageHeaderProps {
  projectId: string;
  advancedMode: boolean;
  onAdvancedModeChange: (enabled: boolean) => void;
}

export function TeachingPageHeader({
  projectId,
  advancedMode,
  onAdvancedModeChange,
}: TeachingPageHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-background">
      <Link
        href={`/projects/${projectId}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Project</span>
      </Link>

      <div className="flex items-center gap-2">
        <Switch
          id="advanced-mode"
          checked={advancedMode}
          onCheckedChange={onAdvancedModeChange}
          data-testid="advanced-toggle"
        />
        <Label htmlFor="advanced-mode" className="text-sm cursor-pointer">
          Advanced
        </Label>
      </div>
    </header>
  );
}
```

**Acceptance Criteria:**
- [ ] Header renders with back link and toggle
- [ ] Back link navigates to project page
- [ ] Toggle calls onAdvancedModeChange with new value
- [ ] Toggle has data-testid="advanced-toggle" for E2E tests
- [ ] Styling matches existing app patterns

---

### Task 1.2: Update layout.tsx

**Description:** Remove TeachingArtifactNav sidebar and add flexible layout structure
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.3

**File:** `app/projects/[id]/artifacts/teaching/layout.tsx`

**Current Implementation:**
```tsx
<div className="h-screen flex bg-white dark:bg-background">
  <TeachingArtifactNav projectId={params.id} />
  <main className="flex-1 overflow-hidden">
    {children}
  </main>
</div>
```

**New Implementation:**
```tsx
export default async function TeachingArtifactsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-background">
      {/* Header now lives in UnifiedArtifactPage - layout is just the container */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

**Note:** TeachingPageHeader will be rendered by UnifiedArtifactPage because it needs access to advancedMode state.

**Acceptance Criteria:**
- [ ] TeachingArtifactNav import and usage removed
- [ ] Layout is flex-col instead of flex
- [ ] Children render full width
- [ ] No duplicate sidebars when viewing artifacts

---

### Task 1.3: Update /teaching/page.tsx with Redirect

**Description:** Redirect base /teaching route to /teaching/mental-model
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.2

**File:** `app/projects/[id]/artifacts/teaching/page.tsx`

**Implementation:**
```tsx
import { redirect } from 'next/navigation';

export default async function TeachingArtifactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/artifacts/teaching/mental-model`);
}
```

**Acceptance Criteria:**
- [ ] Navigating to /artifacts/teaching redirects to /artifacts/teaching/mental-model
- [ ] Redirect is server-side (no flash)
- [ ] Project ID preserved in redirect URL

---

### Task 1.4: Create ArtifactTabBar Component

**Description:** Horizontal tab navigation between artifact types with badges
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.2, 1.3

**File:** `components/artifacts/ArtifactTabBar.tsx`

**Technical Requirements:**
- Three tabs: Mental Model, Curriculum, Drill Series
- Each tab shows icon, label, and version badge
- Active tab visually highlighted
- Uses Next.js Link for client-side navigation
- Shows "Not Generated" badge if no artifact

**Implementation:**
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, BookOpen, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactSummariesResponse } from '@/lib/teaching/types';

interface ArtifactTabBarProps {
  projectId: string;
  artifactsSummary: ArtifactSummariesResponse;
}

const TABS = [
  {
    type: 'mental-model',
    slug: 'mental-model',
    label: 'Mental Model',
    icon: Brain,
  },
  {
    type: 'curriculum',
    slug: 'curriculum',
    label: 'Curriculum',
    icon: BookOpen,
  },
  {
    type: 'drill-series',
    slug: 'drill-series',
    label: 'Drill Series',
    icon: Target,
  },
] as const;

export function ArtifactTabBar({ projectId, artifactsSummary }: ArtifactTabBarProps) {
  const pathname = usePathname();

  const getArtifactForType = (type: string) => {
    return artifactsSummary.artifacts.find(a => a.type === type);
  };

  return (
    <nav className="border-b bg-background">
      <div className="flex gap-1 px-4">
        {TABS.map(({ type, slug, label, icon: Icon }) => {
          const artifact = getArtifactForType(type);
          const isActive = pathname.includes(`/teaching/${slug}`);

          return (
            <Link
              key={type}
              href={`/projects/${projectId}/artifacts/teaching/${slug}`}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              )}
              role="tab"
              aria-selected={isActive}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {artifact ? (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-muted">
                  v{artifact.version}
                </span>
              ) : (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                  —
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Acceptance Criteria:**
- [ ] All three tabs render with icons
- [ ] Active tab has primary color and border
- [ ] Version badge shows for existing artifacts
- [ ] "—" shows for artifacts not yet generated
- [ ] Clicking tab navigates without full page reload
- [ ] Works with keyboard navigation (a11y)

---

## Phase 2: Simple Mode Components

### Task 2.1: Create ExpandableNotes Component

**Description:** Collapsible generation notes textarea
**Size:** Small
**Priority:** Medium
**Dependencies:** None
**Can run parallel with:** Task 2.2

**File:** `components/artifacts/ExpandableNotes.tsx`

**Technical Requirements:**
- Collapsed: clickable "Add generation notes..." text
- Expanded: header + textarea
- Textarea has placeholder text
- Disabled state during generation

**Implementation:**
```typescript
'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ExpandableNotesProps {
  value: string;
  onChange: (value: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  disabled?: boolean;
}

export function ExpandableNotes({
  value,
  onChange,
  expanded,
  onExpandedChange,
  disabled = false,
}: ExpandableNotesProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className={cn(
          'flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={disabled}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span>{expanded ? 'Generation notes' : 'Add generation notes...'}</span>
      </button>

      {expanded && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Optional notes to guide generation..."
          className="min-h-[80px] resize-none"
          disabled={disabled}
          data-testid="generation-notes"
        />
      )}
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Collapsed state shows chevron-right and "Add generation notes..."
- [ ] Expanded state shows chevron-down and "Generation notes"
- [ ] Textarea appears only when expanded
- [ ] Disabled prop prevents interaction
- [ ] data-testid for E2E tests

---

### Task 2.2: Create SimpleToolbar Component

**Description:** Minimal controls for Simple Mode showing title, status, and generate button
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1 (ExpandableNotes)
**Can run parallel with:** None (depends on 2.1)

**File:** `components/artifacts/SimpleToolbar.tsx`

**Technical Requirements:**
- Shows icon + title (e.g., "🧠 Mental Model")
- Status line: "Version X • Generated [date] • [status]"
- Generate button (if no artifact)
- Regenerate button (if artifact exists)
- Integrates ExpandableNotes

**Implementation:**
```typescript
'use client';

import { Brain, BookOpen, Target, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExpandableNotes } from './ExpandableNotes';
import { formatDistanceToNow } from 'date-fns';
import type { GuruArtifact } from '@prisma/client';

type ArtifactType = 'mental-model' | 'curriculum' | 'drill-series';

interface SimpleToolbarProps {
  artifactType: ArtifactType;
  artifact: GuruArtifact | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
  notesExpanded: boolean;
  onNotesExpandedChange: (expanded: boolean) => void;
}

const TYPE_CONFIG = {
  'mental-model': { icon: Brain, label: 'Mental Model' },
  'curriculum': { icon: BookOpen, label: 'Curriculum' },
  'drill-series': { icon: Target, label: 'Drill Series' },
};

export function SimpleToolbar({
  artifactType,
  artifact,
  isGenerating,
  onGenerate,
  onRegenerate,
  userNotes,
  onUserNotesChange,
  notesExpanded,
  onNotesExpandedChange,
}: SimpleToolbarProps) {
  const config = TYPE_CONFIG[artifactType];
  const Icon = config.icon;

  const getStatusBadge = () => {
    if (!artifact) return null;
    switch (artifact.status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'GENERATING':
        return <Badge variant="secondary">Generating...</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card" data-testid="simple-toolbar">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{config.label}</h2>
          </div>

          {artifact ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Version {artifact.version}</span>
              <span>•</span>
              <span>Generated {formatDistanceToNow(new Date(artifact.createdAt), { addSuffix: true })}</span>
              <span>•</span>
              {getStatusBadge()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No {config.label.toLowerCase()} generated yet.
            </p>
          )}
        </div>

        <div className="flex-shrink-0">
          {artifact ? (
            <Button
              onClick={onRegenerate}
              disabled={isGenerating}
              variant="outline"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {config.label}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ExpandableNotes
          value={userNotes}
          onChange={onUserNotesChange}
          expanded={notesExpanded}
          onExpandedChange={onNotesExpandedChange}
          disabled={isGenerating}
        />
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Shows correct icon and label for each artifact type
- [ ] Status line shows version, date, and status badge
- [ ] Generate button shown when no artifact
- [ ] Regenerate button shown when artifact exists
- [ ] Buttons disabled during generation
- [ ] ExpandableNotes integrated
- [ ] data-testid="simple-toolbar" for E2E

---

### Task 2.3: Create UnifiedArtifactPage Component (Core Logic)

**Description:** Main container component orchestrating Simple/Advanced modes
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.1, 1.4, 2.1, 2.2
**Can run parallel with:** None

**File:** `components/artifacts/UnifiedArtifactPage.tsx`

**Technical Requirements:**
- State management for advancedMode, viewMode, isGenerating, etc.
- Polling logic for generation progress
- Conditional rendering of Simple vs Advanced UI
- Integration with existing ArtifactHeader for Advanced mode
- Race condition handling (corpusHash check)

**Implementation:**
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TeachingPageHeader } from './TeachingPageHeader';
import { ArtifactTabBar } from './ArtifactTabBar';
import { SimpleToolbar } from './SimpleToolbar';
import { ArtifactHeader } from './ArtifactHeader';
import { TypeSpecificRenderer } from './renderers/TypeSpecificRenderer';
import { FullWidthProgressTracker } from '@/components/guru/FullWidthProgressTracker';
import { EmptyStateGuidance } from './EmptyStateGuidance';
import type { GuruArtifact } from '@prisma/client';
import type { ArtifactSummariesResponse, PromptInfo, SubTaskProgress, ViewMode } from '@/lib/teaching/types';

type ArtifactType = 'mental-model' | 'curriculum' | 'drill-series';

interface UnifiedArtifactPageProps {
  projectId: string;
  artifactType: ArtifactType;
  initialArtifact: GuruArtifact | null;
  initialPromptInfo: PromptInfo;
  allArtifactsSummary: ArtifactSummariesResponse;
}

export function UnifiedArtifactPage({
  projectId,
  artifactType,
  initialArtifact,
  initialPromptInfo,
  allArtifactsSummary,
}: UnifiedArtifactPageProps) {
  const router = useRouter();

  // State
  const [advancedMode, setAdvancedMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<SubTaskProgress | null>(null);
  const [userNotes, setUserNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [artifact, setArtifact] = useState<GuruArtifact | null>(initialArtifact);
  const [error, setError] = useState<string | null>(null);

  // Check if any artifact is generating on mount
  useEffect(() => {
    const currentArtifact = allArtifactsSummary.artifacts.find(a => a.type === artifactType);
    if (currentArtifact?.status === 'GENERATING') {
      setIsGenerating(true);
    }
  }, [allArtifactsSummary, artifactType]);

  // Polling for generation status
  useEffect(() => {
    if (!isGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/guru/artifacts`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;

        const data: ArtifactSummariesResponse = await res.json();
        const currentArtifact = data.artifacts.find(a => a.type === artifactType);

        // Update progress if available
        if (data.generatingArtifact?.progress) {
          setGenerationProgress(data.generatingArtifact.progress);
        }

        // CRITICAL: Race condition check - wait for BOTH completed status AND corpusHash
        if (currentArtifact?.status === 'COMPLETED' && currentArtifact.corpusHash) {
          setIsGenerating(false);
          setGenerationProgress(null);
          router.refresh(); // Reload server data
        } else if (currentArtifact?.status === 'FAILED') {
          setIsGenerating(false);
          setGenerationProgress(null);
          setError('Generation failed. Please try again.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isGenerating, projectId, artifactType, router]);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/guru/${artifactType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userNotes }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Generation failed');
      }

      // Success - polling will pick up the progress
    } catch (err) {
      setIsGenerating(false);
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    }
  }, [projectId, artifactType, userNotes]);

  // Check if we should show full empty state guidance
  const hasNoArtifacts = allArtifactsSummary.artifacts.length === 0;
  const showEmptyGuidance = advancedMode && hasNoArtifacts;

  return (
    <div className="h-full flex flex-col">
      <TeachingPageHeader
        projectId={projectId}
        advancedMode={advancedMode}
        onAdvancedModeChange={setAdvancedMode}
      />

      <ArtifactTabBar
        projectId={projectId}
        artifactsSummary={allArtifactsSummary}
      />

      <div className="flex-1 overflow-auto">
        {isGenerating && generationProgress ? (
          <div className="p-6">
            <FullWidthProgressTracker progress={generationProgress} />
          </div>
        ) : showEmptyGuidance ? (
          <EmptyStateGuidance
            projectId={projectId}
            onGenerate={() => {
              // Switch to the appropriate tab and generate
              handleGenerate();
            }}
          />
        ) : (
          <div className="p-6 space-y-6">
            {/* Error display */}
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Simple Mode UI */}
            {!advancedMode && (
              <SimpleToolbar
                artifactType={artifactType}
                artifact={artifact}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                onRegenerate={handleGenerate}
                userNotes={userNotes}
                onUserNotesChange={setUserNotes}
                notesExpanded={notesExpanded}
                onNotesExpandedChange={setNotesExpanded}
              />
            )}

            {/* Advanced Mode UI */}
            {advancedMode && artifact && (
              <ArtifactHeader
                artifact={artifact}
                promptInfo={initialPromptInfo}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onRegenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            )}

            {/* Artifact Content */}
            {artifact && (
              <TypeSpecificRenderer
                artifact={artifact}
                showTOC={advancedMode}
              />
            )}

            {/* Simple mode - no artifact */}
            {!advancedMode && !artifact && !isGenerating && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Click "Generate" above to create your first artifact.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Renders TeachingPageHeader with working toggle
- [ ] Renders ArtifactTabBar with correct active state
- [ ] Simple mode shows SimpleToolbar + content (no TOC)
- [ ] Advanced mode shows ArtifactHeader + TOC sidebar
- [ ] Generation triggers correctly with userNotes
- [ ] Polling updates progress and completes correctly
- [ ] Race condition handled (corpusHash check)
- [ ] Error states displayed with retry option

---

## Phase 3: Integration

### Task 3.1: Update [type]/page.tsx Server Component

**Description:** Update the dynamic route page to fetch data and render UnifiedArtifactPage
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** Task 3.2

**File:** `app/projects/[id]/artifacts/teaching/[type]/page.tsx`

**Implementation:**
```typescript
import { notFound } from 'next/navigation';
import { UnifiedArtifactPage } from '@/components/artifacts/UnifiedArtifactPage';
import { getArtifactSummaries } from '@/lib/teaching/artifactClient';
import { fetchArtifactPageData } from '@/lib/teaching/artifactPageData';

type ArtifactType = 'mental-model' | 'curriculum' | 'drill-series';

const VALID_TYPES: ArtifactType[] = ['mental-model', 'curriculum', 'drill-series'];

interface PageProps {
  params: Promise<{ id: string; type: string }>;
}

export default async function UnifiedArtifactTypePage({ params }: PageProps) {
  const { id: projectId, type } = await params;

  // Validate artifact type
  if (!VALID_TYPES.includes(type as ArtifactType)) {
    notFound();
  }

  const artifactType = type as ArtifactType;

  // Fetch all data in parallel
  const [summaries, pageData] = await Promise.all([
    getArtifactSummaries(projectId),
    fetchArtifactPageData(projectId, artifactType),
  ]);

  return (
    <UnifiedArtifactPage
      projectId={projectId}
      artifactType={artifactType}
      initialArtifact={pageData.artifact}
      initialPromptInfo={pageData.promptInfo}
      allArtifactsSummary={summaries}
    />
  );
}

// Generate static params for the three artifact types
export function generateStaticParams() {
  return VALID_TYPES.map(type => ({ type }));
}
```

**Acceptance Criteria:**
- [ ] Page fetches artifact summaries and page data
- [ ] Invalid types return 404
- [ ] Data passed to UnifiedArtifactPage correctly
- [ ] generateStaticParams optimizes build

---

### Task 3.2: Update TypeSpecificRenderer with showTOC Prop

**Description:** Add conditional TOC rendering to TypeSpecificRenderer
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 3.1

**File:** `components/artifacts/renderers/TypeSpecificRenderer.tsx`

**Changes:**
- Add `showTOC?: boolean` prop (default: true for backward compat)
- Conditionally render TableOfContents based on prop
- Keep scroll tracking active regardless

**Implementation (partial - showing changes):**
```typescript
interface TypeSpecificRendererProps {
  artifact: GuruArtifact;
  showTOC?: boolean; // NEW: defaults to true
}

export function TypeSpecificRenderer({
  artifact,
  showTOC = true
}: TypeSpecificRendererProps) {
  // ... existing TOC generation logic ...

  return (
    <div className="flex gap-6">
      {showTOC && (
        <TableOfContents
          items={tocItems}
          activeId={activeId}
          className="hidden lg:block w-64 flex-shrink-0 sticky top-0 max-h-screen overflow-auto"
        />
      )}
      <div className={cn("flex-1 overflow-auto", !showTOC && "max-w-4xl mx-auto")}>
        {/* Content renderer based on artifact type */}
        {artifact.type === 'mental-model' && <MentalModelRenderer content={artifact.content} />}
        {artifact.type === 'curriculum' && <CurriculumRenderer content={artifact.content} />}
        {artifact.type === 'drill-series' && <DrillSeriesRenderer content={artifact.content} />}
      </div>
    </div>
  );
}
```

**Note:** Drill Series uses phase-organized schema (`phases[].principleGroups[].drills[]`)

**Acceptance Criteria:**
- [ ] showTOC prop added with default true
- [ ] TOC hidden when showTOC=false
- [ ] Content centered when TOC hidden
- [ ] Existing behavior unchanged when prop not provided

---

### Task 3.3: Wire Advanced Mode Features

**Description:** Ensure Advanced mode integrates existing ArtifactHeader functionality
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.3, 3.1, 3.2
**Can run parallel with:** None

**Technical Requirements:**
- ArtifactHeader already has: version dropdown, badges, view modes, diff toggle
- Connect viewMode state to content display
- Handle version selection via URL params
- Prompt editing modal integration

**Implementation Notes:**
- ArtifactHeader component exists and works
- May need to pass additional props for version control
- PromptEditorModal already exists

**Acceptance Criteria:**
- [ ] Version dropdown works in Advanced mode
- [ ] View mode toggle switches between rendered/markdown/json
- [ ] Show Diff checkbox works
- [ ] Edit Prompts button opens modal
- [ ] Custom Prompts badge displays correctly
- [ ] Prompts Changed warning badge displays when applicable

---

## Phase 4: Polish

### Task 4.1: Simple Mode Empty State

**Description:** Clean empty state for Simple mode when no artifact exists
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 2.2
**Can run parallel with:** Task 4.2

**Changes in SimpleToolbar:**
Already handled - shows "No [artifact] generated yet" text and Generate button.

**Additional Enhancement:**
Add a subtle illustration or hint about what the artifact will provide.

**Acceptance Criteria:**
- [ ] Empty state clearly indicates what to do
- [ ] Generate button is prominent
- [ ] Message varies by artifact type

---

### Task 4.2: Error State Handling

**Description:** Comprehensive error states for generation failures
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 2.3
**Can run parallel with:** Task 4.1

**Error States to Handle:**
1. Network error during generation
2. API error (4xx/5xx)
3. Timeout
4. Generation failure (returned by backend)

**Implementation in UnifiedArtifactPage:**
Already partially handled. Enhance with:
```typescript
// Add error type distinction
interface GenerationError {
  type: 'network' | 'api' | 'timeout' | 'generation';
  message: string;
}

const getErrorMessage = (error: GenerationError) => {
  switch (error.type) {
    case 'network':
      return 'Network error. Check your connection and try again.';
    case 'timeout':
      return 'Generation timed out. Please try again.';
    case 'api':
      return `Server error: ${error.message}`;
    case 'generation':
      return 'Generation failed. Please try again.';
  }
};
```

**Acceptance Criteria:**
- [ ] Network errors show appropriate message
- [ ] API errors show server message
- [ ] Timeout errors handled gracefully
- [ ] All error states allow retry without page refresh

---

### Task 4.3: Update E2E Tests

**Description:** Update Playwright tests for new unified page structure
**Size:** Medium
**Priority:** High
**Dependencies:** All previous tasks
**Can run parallel with:** None

**File:** `tests/teaching-artifacts.spec.ts` (or similar)

**Test Scenarios:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Unified Teaching Artifact Page', () => {
  test('simple mode shows minimal UI', async ({ page }) => {
    await page.goto('/projects/xxx/artifacts/teaching/mental-model');
    await expect(page.getByTestId('simple-toolbar')).toBeVisible();
    await expect(page.getByTestId('toc-sidebar')).not.toBeVisible();
    await expect(page.getByTestId('view-mode-toggle')).not.toBeVisible();
  });

  test('advanced mode shows full UI', async ({ page }) => {
    await page.goto('/projects/xxx/artifacts/teaching/mental-model');
    await page.getByTestId('advanced-toggle').click();
    await expect(page.getByTestId('toc-sidebar')).toBeVisible();
    await expect(page.getByTestId('view-mode-toggle')).toBeVisible();
  });

  test('tab navigation works', async ({ page }) => {
    await page.goto('/projects/xxx/artifacts/teaching/mental-model');
    await page.getByRole('tab', { name: /curriculum/i }).click();
    await expect(page).toHaveURL(/curriculum/);
  });

  test('base route redirects to mental-model', async ({ page }) => {
    await page.goto('/projects/xxx/artifacts/teaching');
    await expect(page).toHaveURL(/mental-model/);
  });

  test('generation flow works', async ({ page }) => {
    await page.goto('/projects/xxx/artifacts/teaching/mental-model');
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByTestId('progress-tracker')).toBeVisible();
    // Wait for completion
    await expect(page.getByTestId('simple-toolbar')).toContainText(/completed/i, { timeout: 120000 });
  });
});
```

**Acceptance Criteria:**
- [ ] All new UI elements have test coverage
- [ ] Mode toggle tested
- [ ] Tab navigation tested
- [ ] Generation flow tested
- [ ] Error states tested

---

## Summary

| Phase | Tasks | Priority | Parallel Work |
|-------|-------|----------|---------------|
| Phase 1 | 1.1, 1.2, 1.3, 1.4 | High | 1.1, 1.2, 1.3 can run parallel |
| Phase 2 | 2.1, 2.2, 2.3 | High | 2.1 parallel until 2.2 needs it |
| Phase 3 | 3.1, 3.2, 3.3 | High | 3.1, 3.2 can run parallel |
| Phase 4 | 4.1, 4.2, 4.3 | Medium | 4.1, 4.2 can run parallel |

**Total Tasks:** 11
**Estimated Phases:** 4
**Critical Path:** 1.1 → 2.2 → 2.3 → 3.1 → 3.3 → 4.3
