# Teaching Artifacts Landing Page

## Status
**Validated** - Ready for implementation

## Authors
- Claude Code
- Date: 2025-12-21

## Related Documents
- `specs/teaching-artifacts-landing-page/01-ideation.md` - Ideation and research
- `specs/wizard-dashboard-integration/02-specification.md` - Dashboard integration context
- `developer-guides/08-teaching-pipeline-guide.md` - Artifact generation workflow

---

## Overview

Create a teaching artifacts landing page at `/projects/[id]/artifacts/teaching` with a split-view layout that replaces the current auto-redirect behavior. The landing page displays all artifact types (Mental Model, Curriculum, Drill Series) with their statuses in a left sidebar, and shows contextual details/actions in a right panel. This fixes the broken navigation loop where users clicking the Artifacts tile are redirected to individual artifact pages showing "Not Generated" with a button that incorrectly navigates to the main dashboard.

---

## Background / Problem Statement

### Current State

The teaching artifacts system has a critical navigation problem:

1. **Dashboard Artifacts Tile**: Links correctly to `/projects/[id]/artifacts/teaching`
2. **Landing Page Auto-Redirect**: `page.tsx` immediately redirects to the first available artifact (or mental-model if none exist)
3. **Empty Artifact Page**: Shows `NoArtifactPlaceholder` with "Go to Teaching Dashboard" button
4. **Broken Button**: The button links to `/projects/[id]` (main project dashboard) which has no artifact generation controls
5. **Result**: Users are stuck in a navigation loop with no path to generate artifacts

### Root Cause

The `GuruTeachingManager` component (which contains all generation controls) is only used on the admin page (`/projects/[id]/admin`), making it inaccessible to regular users navigating from the main dashboard flow.

### User Impact

- Users cannot generate teaching artifacts from the primary dashboard navigation
- The "Getting Started" workflow is broken at the "Generate Teaching Content" step
- Existing artifacts are accessible only by direct URL or through the admin page

---

## Goals

- Replace the auto-redirect with a proper landing page that serves as a hub for artifact management
- Display all three artifact types with clear status indicators
- Provide generation controls accessible to regular users (not just admin page)
- Fix the broken "Go to Teaching Dashboard" button in NoArtifactPlaceholder
- Add consistent breadcrumb navigation throughout the teaching artifacts section
- Support mobile devices with responsive layout (drawer pattern)
- Offer simplified UI by default with advanced options available via toggle

---

## Non-Goals

- Changes to individual artifact viewer pages (mental-model, curriculum, drill-series)
- Modifications to artifact generation API endpoints or Inngest jobs
- Publishing functionality (remains "Coming Soon")
- Real-time collaboration features
- Artifact comparison/diff view on landing page (exists on individual artifact pages)
- Changes to the GuruTeachingManager generation flow itself (reuse as-is)
- Preview thumbnails or rich artifact visualizations (future enhancement)

---

## Technical Dependencies

### Framework & Libraries
- **Next.js 15**: App Router with dynamic route segments
- **React 19**: Client/Server component patterns
- **Tailwind CSS**: Responsive layout utilities (flex, grid, breakpoints)
- **shadcn/ui**: Card, Button, Badge, Progress, Sheet (for mobile drawer)
- **Lucide React**: Icons (ChevronRight, Brain, BookOpen, Target, Settings, etc.)

### Existing Components to Reuse

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| `GuruTeachingManager` | `components/guru/GuruTeachingManager.tsx` | Adapt with simplified/advanced toggle |
| `FullWidthProgressTracker` | `components/guru/FullWidthProgressTracker.tsx` | Direct import for generation progress |
| `DrillConfigurationPanel` | `components/guru/DrillConfigurationPanel.tsx` | Use in advanced mode for drill series |
| `PromptEditorModal` | `components/guru/PromptEditorModal.tsx` | Use in advanced mode |
| `ArtifactInfoModal` | `components/artifacts/ArtifactInfoModal.tsx` | Display artifact metadata |
| `TeachingArtifactNav` | `components/artifacts/TeachingArtifactNav.tsx` | Reference for sidebar patterns |

### API Endpoints (No Changes Required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects/[id]/guru/artifacts` | GET | Fetch artifact summaries |
| `/api/projects/[id]/guru/mental-model` | POST | Trigger mental model generation |
| `/api/projects/[id]/guru/curriculum` | POST | Trigger curriculum generation |
| `/api/projects/[id]/guru/drill-series` | POST | Trigger drill series generation |
| `/api/projects/[id]/guru/prompts` | GET/PUT | Fetch/update prompt configurations |
| `/api/projects/[id]/readiness` | GET | Fetch readiness score for validation |

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ /projects/[id]/artifacts/teaching                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Breadcrumbs: Projects > {Project Name} > Teaching Artifacts │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────┬──────────────────────────────────────────┐   │
│  │                  │                                          │   │
│  │  ArtifactList    │  ArtifactDetailPanel                     │   │
│  │  Sidebar         │                                          │   │
│  │  (35-40%)        │  (60-65%)                                │   │
│  │                  │                                          │   │
│  │  - Mental Model  │  Shows one of:                           │   │
│  │  - Curriculum    │  1. Empty state with guidance            │   │
│  │  - Drill Series  │  2. Selected artifact details + actions  │   │
│  │                  │  3. Generation progress tracker          │   │
│  │                  │                                          │   │
│  └──────────────────┴──────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
TeachingArtifactsLandingPage (page.tsx - Server Component)
├── Breadcrumbs
├── TeachingArtifactsContent (Client Component)
│   ├── ArtifactListSidebar
│   │   ├── ArtifactListItem (Mental Model)
│   │   ├── ArtifactListItem (Curriculum)
│   │   └── ArtifactListItem (Drill Series)
│   │
│   ├── ArtifactDetailPanel
│   │   ├── EmptyStateGuidance (when no selection + no artifacts)
│   │   ├── ArtifactDetails (when artifact selected)
│   │   │   ├── Status/Version info
│   │   │   ├── Action buttons (View, Generate, Regenerate)
│   │   │   └── Advanced controls (toggle-able)
│   │   └── FullWidthProgressTracker (when generating)
│   │
│   └── ReadinessWarning (when readiness < 60)
│
└── MobileDrawer (Sheet component, mobile only)
    └── ArtifactListSidebar (same component, different container)
```

### File Structure

```
app/projects/[id]/artifacts/teaching/
├── page.tsx                    # MODIFY: Server component, renders landing page
└── layout.tsx                  # KEEP: Existing layout (may need minor adjustments)

components/artifacts/
├── TeachingArtifactsContent.tsx    # NEW: Main client component
├── ArtifactListSidebar.tsx         # NEW: Left sidebar with artifact list
├── ArtifactListItem.tsx            # NEW: Individual artifact row in sidebar
├── ArtifactDetailPanel.tsx         # NEW: Right panel with details/actions
├── EmptyStateGuidance.tsx          # NEW: Wizard-style empty state
├── ReadinessWarning.tsx            # NEW: Warning banner for low readiness
├── NoArtifactPlaceholder.tsx       # MODIFY: Fix button link
└── Breadcrumbs.tsx                 # NEW: Reusable breadcrumb component
```

### Implementation Details

#### 1. Landing Page (`page.tsx`)

Replace the auto-redirect with a proper landing page:

```typescript
// app/projects/[id]/artifacts/teaching/page.tsx
import { getArtifactSummaries } from '@/lib/teaching/artifactClient';
import { prisma } from '@/lib/db';
import { requireProjectOwnership } from '@/lib/auth';
import { TeachingArtifactsContent } from '@/components/artifacts/TeachingArtifactsContent';
import { Breadcrumbs } from '@/components/artifacts/Breadcrumbs';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeachingArtifactsLandingPage({ params }: PageProps) {
  const { id: projectId } = await params;

  // Auth check
  await requireProjectOwnership(projectId);

  // Fetch project name for breadcrumbs
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  // Fetch artifact summaries
  const artifactData = await getArtifactSummaries(projectId);

  // Fetch readiness score
  const readinessRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${projectId}/readiness`,
    { cache: 'no-store' }
  );
  const readiness = readinessRes.ok ? await readinessRes.json() : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            { label: project?.name || 'Project', href: `/projects/${projectId}` },
            { label: 'Teaching Artifacts', href: null },
          ]}
        />
      </div>

      <TeachingArtifactsContent
        projectId={projectId}
        initialArtifacts={artifactData}
        readinessScore={readiness?.score?.overall}
      />
    </div>
  );
}
```

#### 2. Main Content Component (`TeachingArtifactsContent.tsx`)

Client component managing state and layout:

```typescript
// components/artifacts/TeachingArtifactsContent.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { ArtifactListSidebar } from './ArtifactListSidebar';
import { ArtifactDetailPanel } from './ArtifactDetailPanel';
import { ReadinessWarning } from './ReadinessWarning';
import type { ArtifactSummariesResponse } from '@/lib/teaching/artifactClient';

type ArtifactTypeKey = 'mental-model' | 'curriculum' | 'drill-series' | null;

interface Props {
  projectId: string;
  initialArtifacts: ArtifactSummariesResponse;
  readinessScore?: number;
}

export function TeachingArtifactsContent({
  projectId,
  initialArtifacts,
  readinessScore
}: Props) {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [selectedType, setSelectedType] = useState<ArtifactTypeKey>(null);
  const [generating, setGenerating] = useState<ArtifactTypeKey>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Polling for generation updates
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchArtifacts = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/guru/artifacts`);
    if (res.ok) {
      const data = await res.json();
      setArtifacts(data);
      return data;
    }
    return null;
  }, [projectId]);

  // Poll while generating
  useEffect(() => {
    if (generating) {
      pollingRef.current = setInterval(async () => {
        const data = await fetchArtifacts();
        // Check if generation completed
        const artifact = data?.latest?.[getApiKey(generating)];
        if (artifact?.status === 'COMPLETED' || artifact?.status === 'FAILED') {
          setGenerating(null);
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [generating, fetchArtifacts]);

  const handleGenerate = async (type: ArtifactTypeKey) => {
    if (!type) return;
    setGenerating(type);
    // Generation API call handled by detail panel
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <ArtifactListSidebar
              artifacts={artifacts}
              selectedType={selectedType}
              onSelect={(type) => {
                setSelectedType(type);
                setMobileDrawerOpen(false);
              }}
              generating={generating}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-80 border-r flex-shrink-0">
        <ArtifactListSidebar
          artifacts={artifacts}
          selectedType={selectedType}
          onSelect={setSelectedType}
          generating={generating}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {readinessScore !== undefined && readinessScore < 60 && (
          <ReadinessWarning projectId={projectId} score={readinessScore} />
        )}

        <ArtifactDetailPanel
          projectId={projectId}
          artifacts={artifacts}
          selectedType={selectedType}
          generating={generating}
          onGenerate={handleGenerate}
          advancedMode={advancedMode}
          onAdvancedModeChange={setAdvancedMode}
          onRefresh={fetchArtifacts}
        />
      </div>
    </div>
  );
}
```

#### 3. Sidebar Component (`ArtifactListSidebar.tsx`)

```typescript
// components/artifacts/ArtifactListSidebar.tsx
'use client';

import { Brain, BookOpen, Target } from 'lucide-react';
import { ArtifactListItem } from './ArtifactListItem';
import type { ArtifactSummariesResponse } from '@/lib/teaching/artifactClient';

interface Props {
  artifacts: ArtifactSummariesResponse;
  selectedType: string | null;
  onSelect: (type: 'mental-model' | 'curriculum' | 'drill-series') => void;
  generating: string | null;
}

const ARTIFACT_TYPES = [
  {
    key: 'mental-model' as const,
    label: 'Mental Model',
    icon: Brain,
    apiKey: 'mentalModel' as const,
    description: 'Core concepts and principles',
  },
  {
    key: 'curriculum' as const,
    label: 'Curriculum',
    icon: BookOpen,
    apiKey: 'curriculum' as const,
    description: 'Structured learning path',
  },
  {
    key: 'drill-series' as const,
    label: 'Drill Series',
    icon: Target,
    apiKey: 'drillSeries' as const,
    description: 'Practice exercises',
  },
];

export function ArtifactListSidebar({
  artifacts,
  selectedType,
  onSelect,
  generating
}: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Teaching Artifacts</h2>
        <p className="text-sm text-muted-foreground">
          {artifacts.counts.total} artifact{artifacts.counts.total !== 1 ? 's' : ''} generated
        </p>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {ARTIFACT_TYPES.map((type) => {
          const artifact = artifacts.latest[type.apiKey];
          const isGenerating = generating === type.key;

          return (
            <ArtifactListItem
              key={type.key}
              type={type}
              artifact={artifact}
              isSelected={selectedType === type.key}
              isGenerating={isGenerating}
              onClick={() => onSelect(type.key)}
            />
          );
        })}
      </div>
    </div>
  );
}
```

#### 4. Detail Panel Component (`ArtifactDetailPanel.tsx`)

```typescript
// components/artifacts/ArtifactDetailPanel.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Eye,
  RefreshCw,
  Sparkles,
  Settings,
  ChevronRight
} from 'lucide-react';
import { EmptyStateGuidance } from './EmptyStateGuidance';
import { FullWidthProgressTracker } from '@/components/guru/FullWidthProgressTracker';
import { DrillConfigurationPanel } from '@/components/guru/DrillConfigurationPanel';
import { PromptEditorModal } from '@/components/guru/PromptEditorModal';
import { ARTIFACT_TYPE_CONFIG, getArtifactTypeFromSlug } from '@/lib/teaching/constants';
import type { ArtifactSummariesResponse, ArtifactSummary } from '@/lib/teaching/artifactClient';

interface Props {
  projectId: string;
  artifacts: ArtifactSummariesResponse;
  selectedType: 'mental-model' | 'curriculum' | 'drill-series' | null;
  generating: string | null;
  onGenerate: (type: 'mental-model' | 'curriculum' | 'drill-series') => void;
  advancedMode: boolean;
  onAdvancedModeChange: (value: boolean) => void;
  onRefresh: () => Promise<void>;
}

export function ArtifactDetailPanel({
  projectId,
  artifacts,
  selectedType,
  generating,
  onGenerate,
  advancedMode,
  onAdvancedModeChange,
  onRefresh,
}: Props) {
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [userNotes, setUserNotes] = useState('');

  // Show empty state guidance when nothing selected and no artifacts
  if (!selectedType && artifacts.counts.total === 0) {
    return <EmptyStateGuidance projectId={projectId} onGenerate={onGenerate} />;
  }

  // Show generation progress
  if (generating) {
    const generatingArtifact = artifacts.latest[getApiKey(generating)];
    return (
      <div className="flex-1 p-6">
        <FullWidthProgressTracker
          projectId={projectId}
          artifact={generatingArtifact}
          artifactType={generating}
        />
      </div>
    );
  }

  // Show selection prompt if nothing selected but artifacts exist
  if (!selectedType) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Select an Artifact</h3>
          <p className="text-muted-foreground">
            Choose an artifact from the sidebar to view details or generate new content.
          </p>
        </div>
      </div>
    );
  }

  // Get selected artifact details
  const artifactType = getArtifactTypeFromSlug(selectedType);
  const config = ARTIFACT_TYPE_CONFIG[artifactType];
  const artifact = artifacts.latest[config.apiKey];
  const hasArtifact = !!artifact;

  const handleGenerate = async () => {
    const endpoint = `/api/projects/${projectId}/guru/${selectedType}`;
    const body: Record<string, unknown> = { userNotes };

    // Add drill config if applicable
    if (selectedType === 'drill-series' && advancedMode) {
      // Drill config would be passed here
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onGenerate(selectedType);
      setUserNotes('');
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.icon}</span>
            <div>
              <h2 className="text-2xl font-bold">{config.label}</h2>
              {hasArtifact && (
                <p className="text-sm text-muted-foreground">
                  Version {artifact.version} • Generated {formatDate(artifact.generatedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Advanced mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Advanced</span>
            <Switch
              checked={advancedMode}
              onCheckedChange={onAdvancedModeChange}
            />
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Status
              {hasArtifact && (
                <Badge variant={artifact.status === 'COMPLETED' ? 'default' : 'secondary'}>
                  {artifact.status}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasArtifact ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <span className="ml-2 font-medium">{artifact.version}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Generated:</span>
                    <span className="ml-2 font-medium">{formatDate(artifact.generatedAt)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <Button asChild>
                    <Link href={`/projects/${projectId}/artifacts/teaching/${selectedType}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Full Artifact
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={handleGenerate}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  {advancedMode && (
                    <Button variant="ghost" onClick={() => setPromptModalOpen(true)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Prompts
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  This artifact hasn't been generated yet.
                </p>
                <Button onClick={handleGenerate}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate {config.label}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced: Drill Configuration (for drill-series only) */}
        {advancedMode && selectedType === 'drill-series' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Drill Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <DrillConfigurationPanel
                projectId={projectId}
                onChange={() => {}}
                onValidationChange={() => {}}
              />
            </CardContent>
          </Card>
        )}

        {/* User Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generation Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full p-3 border rounded-md resize-none h-24"
              placeholder="Optional notes to guide generation..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Prompt Editor Modal */}
      {promptModalOpen && (
        <PromptEditorModal
          projectId={projectId}
          artifactType={artifactType}
          onClose={() => setPromptModalOpen(false)}
        />
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 48) return 'Yesterday';
  return date.toLocaleDateString();
}

function getApiKey(type: string): 'mentalModel' | 'curriculum' | 'drillSeries' {
  const map: Record<string, 'mentalModel' | 'curriculum' | 'drillSeries'> = {
    'mental-model': 'mentalModel',
    'curriculum': 'curriculum',
    'drill-series': 'drillSeries',
  };
  return map[type] || 'mentalModel';
}
```

#### 5. Empty State Guidance (`EmptyStateGuidance.tsx`)

```typescript
// components/artifacts/EmptyStateGuidance.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, BookOpen, Target, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  projectId: string;
  onGenerate: (type: 'mental-model' | 'curriculum' | 'drill-series') => void;
}

const STEPS = [
  {
    number: 1,
    type: 'mental-model' as const,
    icon: Brain,
    title: 'Mental Model',
    description: 'Start with the foundational concepts and principles that form the core of your teaching domain.',
    action: 'Generate Mental Model',
  },
  {
    number: 2,
    type: 'curriculum' as const,
    icon: BookOpen,
    title: 'Curriculum',
    description: 'Create a structured learning path that builds on the mental model with progressive lessons.',
    action: 'Generate Curriculum',
    requires: 'Mental Model',
  },
  {
    number: 3,
    type: 'drill-series' as const,
    icon: Target,
    title: 'Drill Series',
    description: 'Design practice exercises that reinforce concepts and develop practical skills.',
    action: 'Generate Drills',
    requires: 'Curriculum',
  },
];

export function EmptyStateGuidance({ projectId, onGenerate }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
            <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Create Your Teaching Artifacts</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Generate AI-powered learning materials for your guru. Start with the Mental Model,
            then build upon it with Curriculum and Drills.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map((step, index) => (
            <Card key={step.type} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                    {step.number}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <step.icon className="w-5 h-5 text-muted-foreground" />
                      <h3 className="font-semibold">{step.title}</h3>
                      {step.requires && (
                        <span className="text-xs text-muted-foreground">
                          (requires {step.requires})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>

                  <Button
                    onClick={() => onGenerate(step.type)}
                    disabled={index > 0} // Only first step enabled initially
                    className="flex-shrink-0"
                  >
                    {step.action}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 6. NoArtifactPlaceholder Fix

```typescript
// components/artifacts/NoArtifactPlaceholder.tsx
// Change line 26-31:

<Link
  href={`/projects/${projectId}/artifacts/teaching`}  // FIXED: Was /projects/${projectId}
  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
>
  Go to Artifacts Dashboard
</Link>
```

#### 7. Breadcrumbs Component

```typescript
// components/artifacts/Breadcrumbs.tsx
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string | null;
}

interface Props {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: Props) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
```

---

## User Experience

### User Journeys

#### Journey 1: First-Time User (No Artifacts)
1. User navigates to project dashboard
2. Clicks "Artifacts" tile or "Generate Teaching Content" in Getting Started
3. Lands on Teaching Artifacts landing page
4. Sees empty state with wizard-style guidance
5. Clicks "Generate Mental Model" to start
6. Sees progress tracker during generation
7. On completion, artifact appears in sidebar with "View Full Artifact" option

#### Journey 2: Returning User (Some Artifacts Exist)
1. User navigates to `/projects/[id]/artifacts/teaching`
2. Sees sidebar with artifact list (statuses visible at a glance)
3. Clicks on an artifact to see details
4. Can "View Full Artifact" to go to individual viewer
5. Can "Regenerate" with optional user notes
6. Can toggle "Advanced" for prompt editing and drill configuration

#### Journey 3: Mobile User
1. User navigates to landing page on mobile
2. Sees full-width detail panel (or empty state)
3. Taps floating menu button
4. Slide-in drawer shows artifact list
5. Taps artifact to select, drawer closes
6. Selected artifact details now visible in main area

### Visual States

| State | Left Sidebar | Right Panel |
|-------|--------------|-------------|
| No artifacts, nothing selected | All types show "Not Generated" | Empty state guidance with step-by-step |
| Has artifacts, nothing selected | Status badges for each | "Select an artifact" prompt |
| Artifact selected, exists | Selected item highlighted | Details + View/Regenerate buttons |
| Artifact selected, not exists | Selected item highlighted | "Not generated" + Generate button |
| Generation in progress | Generating badge on item | FullWidthProgressTracker |

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/components/artifacts/ArtifactListSidebar.test.tsx
describe('ArtifactListSidebar', () => {
  // Purpose: Verify sidebar renders all artifact types with correct status
  it('displays all three artifact types', () => {
    // Test that Mental Model, Curriculum, and Drill Series appear
  });

  // Purpose: Verify status badges reflect artifact state
  it('shows correct status for generated vs not generated artifacts', () => {
    // Test Badge content matches artifact.status
  });

  // Purpose: Verify selection callback fires correctly
  it('calls onSelect when artifact item is clicked', () => {
    // Test click handler invocation
  });

  // Purpose: Verify generating state is visually distinct
  it('shows loading indicator when artifact is generating', () => {
    // Test generating prop causes visual change
  });
});
```

```typescript
// __tests__/components/artifacts/EmptyStateGuidance.test.tsx
describe('EmptyStateGuidance', () => {
  // Purpose: Verify wizard steps render in correct order
  it('displays three steps in order: Mental Model, Curriculum, Drill Series', () => {
    // Test step order and content
  });

  // Purpose: Verify only first step is actionable initially
  it('only enables the first step button initially', () => {
    // First button enabled, others disabled
  });

  // Purpose: Verify generate callback fires with correct type
  it('calls onGenerate with correct artifact type when button clicked', () => {
    // Test callback receives 'mental-model'
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/teaching-artifacts-landing.test.tsx
describe('Teaching Artifacts Landing Page Integration', () => {
  // Purpose: Verify page renders without redirect
  it('renders landing page content instead of redirecting', async () => {
    // Navigate to /projects/[id]/artifacts/teaching
    // Assert page contains TeachingArtifactsContent
    // Assert no redirect occurred
  });

  // Purpose: Verify data fetching integration
  it('fetches and displays artifact data from API', async () => {
    // Mock API response
    // Verify artifacts appear in sidebar
  });

  // Purpose: Verify sidebar-panel interaction
  it('updates detail panel when sidebar item is selected', async () => {
    // Click sidebar item
    // Assert panel content updates
  });
});
```

### E2E Tests

```typescript
// tests/teaching-artifacts-landing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Teaching Artifacts Landing Page', () => {
  // Purpose: Verify complete navigation flow from dashboard
  test('navigates from dashboard artifacts tile to landing page', async ({ page }) => {
    await page.goto('/projects/test-project-id');
    await page.click('[data-testid="artifacts-tile"]');
    await expect(page).toHaveURL(/\/artifacts\/teaching$/);
    await expect(page.locator('[data-testid="artifact-list-sidebar"]')).toBeVisible();
  });

  // Purpose: Verify empty state shows guidance
  test('shows wizard guidance when no artifacts exist', async ({ page }) => {
    // Setup: project with no artifacts
    await page.goto('/projects/empty-project/artifacts/teaching');
    await expect(page.locator('text=Create Your Teaching Artifacts')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Mental Model")')).toBeEnabled();
  });

  // Purpose: Verify generation can be triggered
  test('can trigger artifact generation from landing page', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching');
    await page.click('[data-testid="artifact-item-mental-model"]');
    await page.click('button:has-text("Generate")');
    await expect(page.locator('[data-testid="progress-tracker"]')).toBeVisible();
  });

  // Purpose: Verify NoArtifactPlaceholder button fix
  test('NoArtifactPlaceholder button navigates to landing page', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/curriculum');
    // Assuming curriculum doesn't exist
    await page.click('text=Go to Artifacts Dashboard');
    await expect(page).toHaveURL(/\/artifacts\/teaching$/);
  });

  // Purpose: Verify mobile drawer functionality
  test('mobile drawer opens and closes correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/projects/test-project/artifacts/teaching');
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-drawer"]')).toBeVisible();
    await page.click('[data-testid="artifact-item-mental-model"]');
    await expect(page.locator('[data-testid="mobile-drawer"]')).not.toBeVisible();
  });
});
```

---

## Performance Considerations

### Data Fetching
- Server-side data fetching for initial render (no client-side loading state on first paint)
- Client-side polling only when generation in progress (3-second interval)
- Polling automatically stops when generation completes or fails

### Bundle Size
- Reuse existing components (GuruTeachingManager dependencies already in bundle)
- Lazy-load advanced mode components (DrillConfigurationPanel, PromptEditorModal)
- Sheet component from shadcn/ui already available

### Rendering
- Split view uses CSS Flexbox (hardware-accelerated)
- Mobile drawer uses CSS transforms for smooth animation
- Artifact list items use virtualization if list grows (future consideration)

---

## Security Considerations

### Authentication
- Server-side page uses `requireProjectOwnership()` to verify user access
- All API endpoints already enforce project ownership
- No new attack vectors introduced

### Data Validation
- User notes input sanitized before sending to API
- Artifact type validated against known types before API call
- No direct database access from client components

---

## Documentation

### To Create
- [ ] Update `developer-guides/08-teaching-pipeline-guide.md` with landing page architecture
- [ ] Add Teaching Artifacts Landing Page section to CLAUDE.md

### To Update
- [ ] Update Getting Started flow documentation if affected
- [ ] Update any navigation diagrams in existing docs

---

## Implementation Phases

### Phase 1: Core Landing Page (MVP)
- [ ] Rewrite `page.tsx` to render landing page instead of redirect
- [ ] Create `TeachingArtifactsContent` client component
- [ ] Create `ArtifactListSidebar` with artifact items
- [ ] Create `ArtifactDetailPanel` with basic functionality
- [ ] Fix `NoArtifactPlaceholder` button link
- [ ] Add breadcrumb navigation

### Phase 2: Empty State & Guidance
- [ ] Create `EmptyStateGuidance` component with wizard steps
- [ ] Create `ReadinessWarning` component
- [ ] Integrate readiness score fetching
- [ ] Add prerequisite validation (curriculum needs mental model, etc.)

### Phase 3: Advanced Mode & Generation
- [ ] Add advanced mode toggle
- [ ] Integrate `DrillConfigurationPanel` for drill-series
- [ ] Integrate `PromptEditorModal` for prompt editing
- [ ] Integrate `FullWidthProgressTracker` for generation progress
- [ ] Add polling logic for generation status updates

### Phase 4: Mobile & Polish
- [ ] Implement mobile drawer pattern with Sheet component
- [ ] Add responsive breakpoints and mobile-specific UI
- [ ] Add E2E tests
- [ ] Update documentation

---

## Decisions (Resolved)

1. **Breadcrumb in Individual Viewers**
   - **Decision:** Yes, add breadcrumbs to existing individual artifact viewer pages for consistency.
   - Low effort addition, extends scope slightly but improves overall UX.

2. **Session Persistence for Advanced Mode**
   - **Decision:** Session-only for MVP.
   - No localStorage or URL params needed initially. Simple React state.

3. **Prerequisite Enforcement**
   - **Decision:** Yes, match existing GuruTeachingManager behavior.
   - Disable Curriculum button until Mental Model exists, disable Drill Series until Curriculum exists.
   - Visual indicators (grayed out + tooltip) for disabled state.

---

## References

- [Ideation Document](./01-ideation.md) - Research and user decisions
- [Wizard Dashboard Integration Spec](../wizard-dashboard-integration/02-specification.md) - Dashboard context
- [Teaching Pipeline Guide](../../developer-guides/08-teaching-pipeline-guide.md) - Generation workflow
- [AWS Cloudscape Split View Pattern](https://cloudscape.design/patterns/resource-management/view/split-view/) - UI pattern reference
