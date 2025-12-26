# Task Breakdown: Teaching Artifacts Landing Page

**Generated**: 2025-12-21
**Source**: specs/teaching-artifacts-landing-page/02-specification.md
**Last Decompose**: 2025-12-21

---

## Overview

Create a teaching artifacts landing page at `/projects/[id]/artifacts/teaching` with a split-view layout. The landing page displays all artifact types (Mental Model, Curriculum, Drill Series) with their statuses in a left sidebar, and shows contextual details/actions in a right panel.

---

## Dependency Graph

```
Phase 0: Quick Fix (standalone, can start immediately)
└── Task 0.1: Fix NoArtifactPlaceholder button

Phase 1: Foundation Components (parallel execution possible)
├── Task 1.1: Breadcrumbs component ──────────────────────┐
├── Task 1.2: ArtifactListItem component ─────────────────┤
└── Task 1.3: ReadinessWarning component ─────────────────┤
                                                          │
Phase 2: Core UI (depends on Phase 1)                     │
├── Task 2.1: ArtifactListSidebar ←── depends on 1.2 ─────┤
├── Task 2.2: EmptyStateGuidance ←────────────────────────┤
├── Task 2.3: ArtifactDetailPanel ←── depends on 1.3 ─────┘
│
Phase 3: Integration (depends on Phase 2)
├── Task 3.1: TeachingArtifactsContent ←── depends on 2.1, 2.2, 2.3
└── Task 3.2: page.tsx rewrite ←── depends on 3.1, 1.1

Phase 4: Mobile & Polish (depends on Phase 3)
├── Task 4.1: Mobile drawer pattern
├── Task 4.2: E2E tests
└── Task 4.3: Add breadcrumbs to individual viewers
```

---

## Parallel Execution Analysis

### Wave 1 (Can run in parallel)
- **Task 0.1**: Fix NoArtifactPlaceholder (1-line change, standalone)
- **Task 1.1**: Breadcrumbs component (no dependencies)
- **Task 1.2**: ArtifactListItem component (no dependencies)
- **Task 1.3**: ReadinessWarning component (no dependencies)

### Wave 2 (After Wave 1 completes)
- **Task 2.1**: ArtifactListSidebar (depends on 1.2)
- **Task 2.2**: EmptyStateGuidance (no blocking dependencies)
- **Task 2.3**: ArtifactDetailPanel (depends on 1.3)

### Wave 3 (After Wave 2 completes)
- **Task 3.1**: TeachingArtifactsContent (depends on 2.1, 2.2, 2.3)
- **Task 3.2**: page.tsx rewrite (depends on 3.1, 1.1)

### Wave 4 (After Wave 3 completes)
- **Task 4.1**: Mobile drawer pattern
- **Task 4.2**: E2E tests
- **Task 4.3**: Breadcrumbs on individual viewers

---

## Phase 0: Quick Fix

### Task 0.1: Fix NoArtifactPlaceholder button link
**Description**: Fix the broken "Go to Teaching Dashboard" button that incorrectly links to `/projects/${projectId}` instead of `/projects/${projectId}/artifacts/teaching`
**Size**: Small (1-line change)
**Priority**: Critical
**Dependencies**: None
**Can run parallel with**: All Phase 1 tasks

**File**: `components/artifacts/NoArtifactPlaceholder.tsx`

**Implementation**:
```typescript
// Change line 27 from:
href={`/projects/${projectId}`}

// To:
href={`/projects/${projectId}/artifacts/teaching`}

// Also update button text from "Go to Teaching Dashboard" to "Go to Artifacts Dashboard"
```

**Acceptance Criteria**:
- [ ] Button links to `/projects/${projectId}/artifacts/teaching`
- [ ] Button text says "Go to Artifacts Dashboard"
- [ ] Clicking button from any individual artifact page navigates to landing page

---

## Phase 1: Foundation Components

### Task 1.1: Create Breadcrumbs component
**Description**: Create a reusable breadcrumb navigation component for the teaching artifacts section
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Tasks 1.2, 1.3, 0.1

**File**: `components/artifacts/Breadcrumbs.tsx`

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Component renders breadcrumb items with chevron separators
- [ ] Items with `href` are clickable links
- [ ] Items without `href` (current page) render as non-clickable text with font-medium
- [ ] Proper hover states on links

---

### Task 1.2: Create ArtifactListItem component
**Description**: Create a component for rendering individual artifact items in the sidebar with status indicators
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Tasks 1.1, 1.3, 0.1

**File**: `components/artifacts/ArtifactListItem.tsx`

**Implementation**:
```typescript
// components/artifacts/ArtifactListItem.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ArtifactSummary } from '@/lib/teaching/artifactClient';

interface ArtifactTypeConfig {
  key: 'mental-model' | 'curriculum' | 'drill-series';
  label: string;
  icon: LucideIcon;
  apiKey: 'mentalModel' | 'curriculum' | 'drillSeries';
  description: string;
}

interface Props {
  type: ArtifactTypeConfig;
  artifact: ArtifactSummary | null;
  isSelected: boolean;
  isGenerating: boolean;
  onClick: () => void;
}

export function ArtifactListItem({
  type,
  artifact,
  isSelected,
  isGenerating,
  onClick,
}: Props) {
  const hasArtifact = !!artifact;
  const Icon = type.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-lg text-left transition-colors
        ${isSelected
          ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 border'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }
      `}
      data-testid={`artifact-item-${type.key}`}
    >
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${hasArtifact
            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
          }
        `}>
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{type.label}</span>
            {isGenerating ? (
              <Badge variant="secondary" className="text-xs">Generating...</Badge>
            ) : hasArtifact ? (
              <Badge variant="default" className="text-xs">v{artifact.version}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Not Generated</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {type.description}
          </p>
        </div>
      </div>
    </button>
  );
}
```

**Acceptance Criteria**:
- [ ] Displays artifact type with icon, label, and description
- [ ] Shows status badge: "v{version}" for generated, "Not Generated" for missing, "Generating..." during generation
- [ ] Selected state has blue background/border
- [ ] Generating state shows spinner icon
- [ ] Has `data-testid` for E2E testing

---

### Task 1.3: Create ReadinessWarning component
**Description**: Create a warning banner component that displays when project readiness score is below 60
**Size**: Small
**Priority**: Medium
**Dependencies**: None
**Can run parallel with**: Tasks 1.1, 1.2, 0.1

**File**: `components/artifacts/ReadinessWarning.tsx`

**Implementation**:
```typescript
// components/artifacts/ReadinessWarning.tsx
'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  projectId: string;
  score: number;
}

export function ReadinessWarning({ projectId, score }: Props) {
  return (
    <div className="mx-6 mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-amber-800 dark:text-amber-200">
            Low Readiness Score ({score}%)
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Your project's readiness score is below 60%. Generated artifacts may lack depth.
            Consider adding more research before generating.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/readiness`}>
                View Readiness Details
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Displays warning with amber styling
- [ ] Shows current readiness score
- [ ] Links to readiness page
- [ ] Only visible when score < 60

---

## Phase 2: Core UI Components

### Task 2.1: Create ArtifactListSidebar component
**Description**: Create the left sidebar that displays all three artifact types with their statuses
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2 (ArtifactListItem)
**Can run parallel with**: Tasks 2.2, 2.3

**File**: `components/artifacts/ArtifactListSidebar.tsx`

**Implementation**:
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900" data-testid="artifact-list-sidebar">
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

**Acceptance Criteria**:
- [ ] Displays header with artifact count
- [ ] Renders all three artifact types using ArtifactListItem
- [ ] Tracks selected state correctly
- [ ] Passes generating state to items
- [ ] Has data-testid for E2E testing

---

### Task 2.2: Create EmptyStateGuidance component
**Description**: Create wizard-style empty state with step-by-step guidance for generating artifacts
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Tasks 2.1, 2.3

**File**: `components/artifacts/EmptyStateGuidance.tsx`

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Displays three steps in wizard format
- [ ] Shows prerequisites for steps 2 and 3
- [ ] Only first step button is enabled initially
- [ ] Calls onGenerate with correct type when clicked
- [ ] Gradient background styling

---

### Task 2.3: Create ArtifactDetailPanel component
**Description**: Create the right panel that shows artifact details, generation controls, and progress
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.3 (ReadinessWarning)
**Can run parallel with**: Tasks 2.1, 2.2

**File**: `components/artifacts/ArtifactDetailPanel.tsx`

**Implementation**:
```typescript
// components/artifacts/ArtifactDetailPanel.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Eye, RefreshCw, Sparkles, Settings } from 'lucide-react';
import { EmptyStateGuidance } from './EmptyStateGuidance';
import { FullWidthProgressTracker } from '@/components/guru/FullWidthProgressTracker';
import { DrillConfigurationPanel } from '@/components/guru/DrillConfigurationPanel';
import { PromptEditorModal } from '@/components/guru/PromptEditorModal';
import { ARTIFACT_TYPE_CONFIG, getArtifactTypeFromSlug } from '@/lib/teaching/constants';
import type { ArtifactSummariesResponse } from '@/lib/teaching/artifactClient';

type ArtifactTypeSlug = 'mental-model' | 'curriculum' | 'drill-series';

interface Props {
  projectId: string;
  artifacts: ArtifactSummariesResponse;
  selectedType: ArtifactTypeSlug | null;
  generating: string | null;
  onGenerate: (type: ArtifactTypeSlug) => void;
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
  const [promptModalType, setPromptModalType] = useState<'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'>('MENTAL_MODEL');
  const [userNotes, setUserNotes] = useState('');

  // Show empty state guidance when nothing selected and no artifacts
  if (!selectedType && artifacts.counts.total === 0) {
    return <EmptyStateGuidance projectId={projectId} onGenerate={onGenerate} />;
  }

  // Show generation progress
  if (generating) {
    const artifactType = getArtifactTypeFromSlug(generating as ArtifactTypeSlug);
    return (
      <div className="flex-1 p-6" data-testid="progress-tracker">
        <FullWidthProgressTracker
          projectId={projectId}
          artifactType={artifactType}
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

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onGenerate(selectedType);
        setUserNotes('');
      } else {
        console.error('Generation failed:', await res.text());
      }
    } catch (error) {
      console.error('Generation error:', error);
    }
  };

  const openPromptEditor = () => {
    setPromptModalType(artifactType);
    setPromptModalOpen(true);
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
                    <Button variant="ghost" onClick={openPromptEditor}>
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
              className="w-full p-3 border rounded-md resize-none h-24 bg-background"
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
          artifactType={promptModalType}
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
```

**Acceptance Criteria**:
- [ ] Shows EmptyStateGuidance when no artifacts and nothing selected
- [ ] Shows progress tracker during generation
- [ ] Shows "Select an Artifact" prompt when artifacts exist but none selected
- [ ] Displays artifact details when selected (version, date, status)
- [ ] View/Regenerate buttons work correctly
- [ ] Advanced mode toggle shows DrillConfigurationPanel and Edit Prompts button
- [ ] User notes textarea available
- [ ] PromptEditorModal opens in advanced mode

---

## Phase 3: Integration

### Task 3.1: Create TeachingArtifactsContent component
**Description**: Create the main client component that manages state and orchestrates all child components
**Size**: Large
**Priority**: High
**Dependencies**: Tasks 2.1, 2.2, 2.3
**Can run parallel with**: None (must wait for Phase 2)

**File**: `components/artifacts/TeachingArtifactsContent.tsx`

**Implementation**:
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
        if (!data) return;

        // Check if generation completed
        const apiKeyMap: Record<string, 'mentalModel' | 'curriculum' | 'drillSeries'> = {
          'mental-model': 'mentalModel',
          'curriculum': 'curriculum',
          'drill-series': 'drillSeries',
        };
        const apiKey = apiKeyMap[generating];
        const artifact = data?.latest?.[apiKey];

        if (artifact?.status === 'COMPLETED' || artifact?.status === 'FAILED') {
          setGenerating(null);
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [generating, fetchArtifacts]);

  const handleGenerate = (type: ArtifactTypeKey) => {
    if (!type) return;
    setGenerating(type);
    setSelectedType(type);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg" data-testid="mobile-menu-button">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0" data-testid="mobile-drawer">
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

**Acceptance Criteria**:
- [ ] Manages selectedType, generating, and advancedMode state
- [ ] Polls for updates during generation (3-second interval)
- [ ] Stops polling when generation completes or fails
- [ ] Cleans up polling interval on unmount
- [ ] Shows ReadinessWarning when score < 60
- [ ] Desktop sidebar visible on lg+ breakpoints
- [ ] Mobile drawer accessible on smaller screens

---

### Task 3.2: Rewrite page.tsx as landing page
**Description**: Replace the auto-redirect in page.tsx with a proper landing page that renders TeachingArtifactsContent
**Size**: Medium
**Priority**: High
**Dependencies**: Tasks 3.1, 1.1
**Can run parallel with**: None (final integration)

**File**: `app/projects/[id]/artifacts/teaching/page.tsx`

**Implementation**:
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

  // Fetch readiness score (internal call, not HTTP)
  let readinessScore: number | undefined;
  try {
    const { calculateReadinessScore } = await import('@/lib/readiness/scoring');
    const { score } = await calculateReadinessScore(projectId);
    readinessScore = score.overall;
  } catch (error) {
    console.error('Failed to fetch readiness:', error);
  }

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
        readinessScore={readinessScore}
      />
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] No longer redirects to individual artifact pages
- [ ] Renders Breadcrumbs with correct navigation
- [ ] Fetches artifact summaries server-side
- [ ] Fetches readiness score server-side (internal call, not HTTP)
- [ ] Passes data to TeachingArtifactsContent
- [ ] Uses `export const dynamic = 'force-dynamic'`

---

## Phase 4: Mobile & Polish

### Task 4.1: Implement mobile drawer pattern
**Description**: Ensure mobile drawer works correctly with Sheet component
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.1
**Can run parallel with**: Tasks 4.2, 4.3

**Technical Requirements**:
- Mobile drawer uses shadcn/ui Sheet component (already in Task 3.1)
- Verify responsive breakpoints (lg: for desktop sidebar)
- Test drawer open/close behavior
- Ensure drawer closes when artifact selected

**Acceptance Criteria**:
- [ ] Mobile menu button visible only on screens < lg
- [ ] Drawer slides in from left on tap
- [ ] Selecting artifact closes drawer
- [ ] Drawer has proper z-index above content

---

### Task 4.2: Create E2E tests
**Description**: Create Playwright E2E tests for the teaching artifacts landing page
**Size**: Medium
**Priority**: Medium
**Dependencies**: Tasks 3.1, 3.2
**Can run parallel with**: Tasks 4.1, 4.3

**File**: `tests/teaching-artifacts-landing.spec.ts`

**Implementation**:
```typescript
// tests/teaching-artifacts-landing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Teaching Artifacts Landing Page', () => {
  // Purpose: Verify complete navigation flow from dashboard
  test('navigates from dashboard artifacts tile to landing page', async ({ page }) => {
    // Login and navigate to a test project
    await page.goto('/projects');
    // Find a test project and click Artifacts tile
    await page.click('[data-testid="artifacts-tile"]');
    await expect(page).toHaveURL(/\/artifacts\/teaching$/);
    await expect(page.locator('[data-testid="artifact-list-sidebar"]')).toBeVisible();
  });

  // Purpose: Verify empty state shows guidance
  test('shows wizard guidance when no artifacts exist', async ({ page }) => {
    // Navigate to a project with no artifacts
    await page.goto('/projects/[empty-project-id]/artifacts/teaching');
    await expect(page.locator('text=Create Your Teaching Artifacts')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Mental Model")')).toBeEnabled();
  });

  // Purpose: Verify artifact selection updates detail panel
  test('selecting artifact shows details in panel', async ({ page }) => {
    await page.goto('/projects/[test-project-id]/artifacts/teaching');
    await page.click('[data-testid="artifact-item-mental-model"]');
    await expect(page.locator('h2:has-text("Mental Model")')).toBeVisible();
  });

  // Purpose: Verify NoArtifactPlaceholder button fix
  test('NoArtifactPlaceholder button navigates to landing page', async ({ page }) => {
    // Go to individual artifact page that doesn't exist
    await page.goto('/projects/[test-project-id]/artifacts/teaching/curriculum');
    await page.click('text=Go to Artifacts Dashboard');
    await expect(page).toHaveURL(/\/artifacts\/teaching$/);
  });

  // Purpose: Verify mobile drawer functionality
  test('mobile drawer opens and closes correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/projects/[test-project-id]/artifacts/teaching');
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-drawer"]')).toBeVisible();
    await page.click('[data-testid="artifact-item-mental-model"]');
    await expect(page.locator('[data-testid="mobile-drawer"]')).not.toBeVisible();
  });

  // Purpose: Verify breadcrumb navigation
  test('breadcrumbs navigate correctly', async ({ page }) => {
    await page.goto('/projects/[test-project-id]/artifacts/teaching');
    await page.click('text=Projects');
    await expect(page).toHaveURL('/projects');
  });
});
```

**Acceptance Criteria**:
- [ ] All 6 test cases pass
- [ ] Tests use data-testid selectors where available
- [ ] Mobile viewport test works correctly

---

### Task 4.3: Add breadcrumbs to individual artifact viewers
**Description**: Add consistent breadcrumb navigation to mental-model, curriculum, and drill-series viewer pages
**Size**: Small
**Priority**: Low
**Dependencies**: Task 1.1 (Breadcrumbs component)
**Can run parallel with**: Tasks 4.1, 4.2

**Files to modify**:
- `app/projects/[id]/artifacts/teaching/mental-model/page.tsx`
- `app/projects/[id]/artifacts/teaching/curriculum/page.tsx`
- `app/projects/[id]/artifacts/teaching/drill-series/page.tsx`

**Implementation pattern** (apply to each page):
```typescript
import { Breadcrumbs } from '@/components/artifacts/Breadcrumbs';

// In the component:
<Breadcrumbs
  items={[
    { label: 'Projects', href: '/projects' },
    { label: project?.name || 'Project', href: `/projects/${projectId}` },
    { label: 'Teaching Artifacts', href: `/projects/${projectId}/artifacts/teaching` },
    { label: 'Mental Model', href: null }, // Current page
  ]}
/>
```

**Acceptance Criteria**:
- [ ] All three artifact viewer pages have breadcrumbs
- [ ] "Teaching Artifacts" breadcrumb links back to landing page
- [ ] Current artifact name shown as non-clickable final breadcrumb

---

## Summary

| Phase | Tasks | Parallel Groups | Total Effort |
|-------|-------|-----------------|--------------|
| Phase 0 | 1 | Wave 1 | Small |
| Phase 1 | 3 | Wave 1 | Small-Medium |
| Phase 2 | 3 | Wave 2 | Medium-Large |
| Phase 3 | 2 | Wave 3 | Large |
| Phase 4 | 3 | Wave 4 | Small-Medium |

**Total Tasks**: 12
**Critical Path**: 0.1 → 1.2 → 2.1 → 3.1 → 3.2

**Parallel Execution Strategy**:
1. Start Wave 1 immediately (4 tasks in parallel)
2. When Wave 1 completes, start Wave 2 (3 tasks in parallel)
3. When Wave 2 completes, start Wave 3 (2 tasks, some parallel opportunity)
4. When Wave 3 completes, start Wave 4 (3 tasks in parallel)
