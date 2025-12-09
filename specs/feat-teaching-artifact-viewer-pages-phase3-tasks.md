# Task Breakdown: Teaching Artifact Viewer Pages - Phase 3

Generated: 2025-12-08
Source: specs/feat-teaching-artifact-viewer-pages-phase3.md

## Overview

Phase 3 adds type-specific enhanced renderers and table of contents navigation for teaching artifacts (Mental Model, Curriculum, Drill Series). This transforms the generic markdown view into structured, navigable displays optimized for each artifact's unique content structure.

**Key deliverables:**
- ViewModeToggle component (Rendered/Markdown/JSON)
- TableOfContents component with scroll tracking
- 3 type-specific renderers (MentalModel, Curriculum, DrillSeries)
- Shared card components (PrincipleCard, LessonCard, DrillCard)
- Badge components for types and tiers
- E2E tests for navigation and view modes

---

## Phase 3.1: View Mode Infrastructure

### Task 3.1.1: Create ViewModeToggle Component

**Description**: Create a 3-mode toggle component to switch between Rendered, Markdown, and JSON views
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3.1.3

**Technical Requirements**:
- Three view modes: 'rendered' | 'markdown' | 'json'
- Toggle UI with clear visual indication of active mode
- Callback when mode changes
- Default to 'rendered' mode

**Implementation**:
```typescript
// components/artifacts/ViewModeToggle.tsx
'use client';

import { cn } from '@/lib/utils';

export type ViewMode = 'rendered' | 'markdown' | 'json';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

const modes: { value: ViewMode; label: string }[] = [
  { value: 'rendered', label: 'Rendered' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
];

export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  return (
    <div className={cn('flex rounded-lg bg-gray-100 p-1', className)} role="tablist">
      {modes.map(({ value, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            mode === value
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
          data-testid={`view-mode-${value}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Toggle renders with three buttons: Rendered, Markdown, JSON
- [ ] Active mode has distinct visual styling (white bg, blue text)
- [ ] Clicking a mode triggers onChange callback
- [ ] Component has proper aria attributes for accessibility
- [ ] data-testid attributes present for E2E testing

---

### Task 3.1.2: Update ArtifactViewerWithVersions for ViewModeToggle

**Description**: Replace current JSON checkbox toggle with ViewModeToggle in ArtifactViewerWithVersions
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1.1
**Can run parallel with**: None

**Technical Requirements**:
- Replace `showJson` boolean state with `viewMode: ViewMode` state
- Integrate ViewModeToggle in the header area
- Update content rendering logic to handle all three modes
- Preserve diff functionality for markdown mode

**Implementation**:
```typescript
// Update components/artifacts/ArtifactViewerWithVersions.tsx
'use client';

import { useState } from 'react';
import { ArtifactDetail, ArtifactSummary } from '@/lib/teaching/artifactClient';
import { getArtifactSlug } from '@/lib/teaching/constants';
import { ArtifactHeader } from './ArtifactHeader';
import VersionHistoryPanel from './VersionHistoryPanel';
import DiffContent from './DiffContent';
import { ViewModeToggle, ViewMode } from './ViewModeToggle';
import { TypeSpecificRenderer } from './renderers/TypeSpecificRenderer';

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
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');

  const artifactSlug = getArtifactSlug(artifact.type);
  const canShowDiff = artifact.version > 1;

  const currentContent = artifact.markdownContent || JSON.stringify(artifact.content, null, 2);
  const previousContent = previousArtifact?.markdownContent ||
    (previousArtifact ? JSON.stringify(previousArtifact.content, null, 2) : null);

  return (
    <div className="flex h-full" data-testid="artifact-viewer-with-versions">
      <VersionHistoryPanel
        projectId={projectId}
        artifactType={artifactSlug}
        versions={allVersions}
        currentVersion={artifact.version}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ArtifactHeader
          artifact={artifact}
          projectId={projectId}
          showDiff={showDiff}
          canShowDiff={canShowDiff}
        >
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </ArtifactHeader>

        <div className="flex-1 overflow-hidden">
          {viewMode === 'json' && (
            <div className="h-full p-4 overflow-auto">
              <pre className="bg-gray-100 p-4 rounded-lg text-sm">
                {JSON.stringify(artifact.content, null, 2)}
              </pre>
            </div>
          )}
          {viewMode === 'markdown' && (
            <div className="h-full p-4 overflow-auto">
              <DiffContent
                currentContent={currentContent}
                previousContent={previousContent}
                showDiff={showDiff && canShowDiff}
              />
            </div>
          )}
          {viewMode === 'rendered' && (
            <TypeSpecificRenderer
              artifact={artifact}
              className="h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

**ArtifactHeader update** - Add children prop for ViewModeToggle:
```typescript
// Update components/artifacts/ArtifactHeader.tsx
interface ArtifactHeaderProps {
  artifact: ArtifactDetail;
  projectId: string;
  showDiff: boolean;
  canShowDiff: boolean;
  children?: React.ReactNode;  // Add this for ViewModeToggle slot
}

export function ArtifactHeader({
  artifact,
  projectId,
  showDiff,
  canShowDiff,
  children,  // Add this
}: ArtifactHeaderProps) {
  // ... existing code
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          {/* ... existing title/version info */}
        </div>
        <div className="flex items-center gap-4">
          {children}  {/* ViewModeToggle slot */}
          {canShowDiff && (
            <label className="flex items-center gap-2 text-sm">
              {/* ... diff checkbox */}
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] ViewModeToggle appears in header next to diff checkbox
- [ ] Default view mode is 'rendered'
- [ ] JSON mode shows formatted JSON content
- [ ] Markdown mode shows DiffContent (with diff if enabled)
- [ ] Rendered mode shows TypeSpecificRenderer (placeholder initially)
- [ ] View mode persists while navigating versions

---

### Task 3.1.3: Create useActiveSection Hook

**Description**: Create hook to track which section is visible using IntersectionObserver
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3.1.1

**Technical Requirements**:
- Uses IntersectionObserver API for scroll tracking
- Tracks multiple sections by ID
- Returns currently active section ID
- Configurable threshold for "active" detection

**Implementation**:
```typescript
// lib/teaching/hooks/useActiveSection.ts
'use client';

import { useState, useEffect, useRef } from 'react';

interface UseActiveSectionOptions {
  rootMargin?: string;
  threshold?: number | number[];
}

export function useActiveSection(
  sectionIds: string[],
  options: UseActiveSectionOptions = {}
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Don't observe if no sections
    if (sectionIds.length === 0) {
      setActiveId(null);
      return;
    }

    const { rootMargin = '-20% 0px -80% 0px', threshold = 0 } = options;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry
        const intersecting = entries.find((entry) => entry.isIntersecting);
        if (intersecting) {
          setActiveId(intersecting.target.id);
        }
      },
      { rootMargin, threshold }
    );

    // Observe all sections
    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sectionIds, options.rootMargin, options.threshold]);

  return activeId;
}
```

**Helper for smooth scrolling**:
```typescript
// lib/teaching/hooks/useScrollToSection.ts
'use client';

export function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth'): void {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior, block: 'start' });
  }
}
```

**Acceptance Criteria**:
- [ ] Hook returns null when no sections visible
- [ ] Hook returns correct section ID when scrolling
- [ ] Observer cleans up on unmount
- [ ] Works with dynamic section IDs (re-observes when IDs change)
- [ ] scrollToSection smoothly scrolls to target element

---

### Task 3.1.4: Create TableOfContents Component

**Description**: Create hierarchical table of contents component with active section highlighting
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1.3
**Can run parallel with**: None

**Technical Requirements**:
- Renders hierarchical list (sections with nested subsections)
- Highlights currently active section
- Click navigates to section with smooth scroll
- Sticky positioning within scroll container

**Data Types**:
```typescript
// lib/teaching/types/toc.ts
export interface TOCItem {
  id: string;
  label: string;
  level: number;  // 1 = section, 2 = subsection
  children?: TOCItem[];
}
```

**Implementation**:
```typescript
// components/artifacts/TableOfContents.tsx
'use client';

import { cn } from '@/lib/utils';
import { scrollToSection } from '@/lib/teaching/hooks/useScrollToSection';
import { TOCItem } from '@/lib/teaching/types/toc';

interface TableOfContentsProps {
  items: TOCItem[];
  activeId: string | null;
  className?: string;
}

export function TableOfContents({ items, activeId, className }: TableOfContentsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn('w-56 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto', className)}
      aria-label="Table of contents"
      data-testid="table-of-contents"
    >
      <div className="sticky top-0 p-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Contents</h2>
        <ul className="space-y-1">
          {items.map((item) => (
            <TOCItemComponent
              key={item.id}
              item={item}
              activeId={activeId}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}

interface TOCItemComponentProps {
  item: TOCItem;
  activeId: string | null;
}

function TOCItemComponent({ item, activeId }: TOCItemComponentProps) {
  const isActive = item.id === activeId;
  const hasActiveChild = item.children?.some(
    (child) => child.id === activeId || child.children?.some((gc) => gc.id === activeId)
  );

  return (
    <li>
      <button
        onClick={() => scrollToSection(item.id)}
        className={cn(
          'w-full text-left text-sm py-1.5 px-2 rounded transition-colors',
          item.level === 1 ? 'font-medium' : 'pl-4 text-gray-600',
          isActive
            ? 'bg-blue-100 text-blue-800'
            : hasActiveChild
              ? 'text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
        )}
        data-testid={`toc-item-${item.id}`}
      >
        {item.label}
      </button>
      {item.children && item.children.length > 0 && (
        <ul className="ml-2 space-y-0.5">
          {item.children.map((child) => (
            <TOCItemComponent
              key={child.id}
              item={child}
              activeId={activeId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders hierarchical list with proper indentation
- [ ] Active section has blue background highlight
- [ ] Parent of active child shows blue text
- [ ] Clicking item scrolls to section smoothly
- [ ] Returns null when items array is empty
- [ ] Proper aria-label for accessibility

---

## Phase 3.2: Type-Specific Renderers

### Task 3.2.1: Create MentalModelRenderer Component

**Description**: Create structured renderer for Mental Model artifacts showing categories, principles, and connections
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.1.4
**Can run parallel with**: Task 3.2.2, Task 3.2.3

**Technical Requirements**:
- Render domain title and teaching approach header
- Render categories sorted by orderInLearningPath
- Each category shows name, description, metaphor (if present)
- Principles rendered as cards within categories
- Principle connections shown at bottom

**Data Types** (from mentalModelSchema.ts):
```typescript
interface MentalModelOutput {
  domainTitle: string;
  teachingApproach: string;
  categories: Array<{
    id: string;
    name: string;
    description: string;
    mentalModelMetaphor: string | null;
    principles: Array<{
      id: string;
      name: string;
      essence: string;
      whyItMatters: string;
      commonMistake: string;
      recognitionPattern: string;
    }>;
    orderInLearningPath: number;
  }>;
  principleConnections: Array<{
    fromPrinciple: string;
    toPrinciple: string;
    relationship: string;
  }>;
  masterySummary: string;
}
```

**Implementation**:
```typescript
// components/artifacts/renderers/MentalModelRenderer.tsx
'use client';

import { MentalModelOutput } from '@/lib/guruFunctions/schemas/mentalModelSchema';
import { PrincipleCard } from './cards/PrincipleCard';
import { TOCItem } from '@/lib/teaching/types/toc';

interface MentalModelRendererProps {
  content: MentalModelOutput;
  className?: string;
}

export function MentalModelRenderer({ content, className }: MentalModelRendererProps) {
  const sortedCategories = [...content.categories].sort(
    (a, b) => a.orderInLearningPath - b.orderInLearningPath
  );

  return (
    <div className={className} data-testid="mental-model-renderer">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.domainTitle}
        </h1>
        <p className="text-gray-600 leading-relaxed">
          {content.teachingApproach}
        </p>
      </header>

      {/* Categories */}
      {sortedCategories.map((category, index) => (
        <section
          key={category.id}
          id={`category-${category.id}`}
          className="mb-12"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white bg-blue-700 px-4 py-3 rounded-r-lg border-l-8 border-blue-900 -ml-4">
              {index + 1}. {category.name}
            </h2>
            <p className="text-gray-700 mt-3 px-4">{category.description}</p>
            {category.mentalModelMetaphor && (
              <blockquote className="mt-3 mx-4 px-4 py-2 bg-blue-50 border-l-4 border-blue-300 text-blue-800 italic rounded-r">
                "{category.mentalModelMetaphor}"
              </blockquote>
            )}
          </div>

          {/* Principles within category */}
          <div className="space-y-4 px-4">
            {category.principles.map((principle) => (
              <PrincipleCard
                key={principle.id}
                id={`principle-${principle.id}`}
                principle={principle}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Principle Connections */}
      {content.principleConnections.length > 0 && (
        <section id="connections" className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Principle Connections
          </h2>
          <ul className="space-y-2">
            {content.principleConnections.map((conn, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 text-gray-700 p-2 bg-gray-50 rounded"
              >
                <span className="font-medium">{conn.fromPrinciple}</span>
                <span className="text-gray-400">→</span>
                <span className="text-sm text-gray-500 italic">{conn.relationship}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{conn.toPrinciple}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mastery Summary */}
      <section id="mastery-summary" className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h2 className="text-lg font-semibold text-green-800 mb-2">Mastery Summary</h2>
        <p className="text-green-700">{content.masterySummary}</p>
      </section>
    </div>
  );
}

/**
 * Generate TOC items for mental model
 */
export function generateMentalModelTOC(content: MentalModelOutput): TOCItem[] {
  const sortedCategories = [...content.categories].sort(
    (a, b) => a.orderInLearningPath - b.orderInLearningPath
  );

  const items: TOCItem[] = sortedCategories.map((cat) => ({
    id: `category-${cat.id}`,
    label: cat.name,
    level: 1,
    children: cat.principles.map((p) => ({
      id: `principle-${p.id}`,
      label: p.name,
      level: 2,
    })),
  }));

  if (content.principleConnections.length > 0) {
    items.push({ id: 'connections', label: 'Connections', level: 1 });
  }
  items.push({ id: 'mastery-summary', label: 'Mastery Summary', level: 1 });

  return items;
}
```

**PrincipleCard Implementation**:
```typescript
// components/artifacts/renderers/cards/PrincipleCard.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Principle {
  id: string;
  name: string;
  essence: string;
  whyItMatters: string;
  commonMistake: string;
  recognitionPattern: string;
}

interface PrincipleCardProps {
  id: string;
  principle: Principle;
}

export function PrincipleCard({ id, principle }: PrincipleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`principle-card-${principle.id}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start justify-between hover:bg-gray-50 transition-colors"
      >
        <div>
          <h3 className="font-semibold text-gray-900">{principle.name}</h3>
          <p className="text-gray-600 mt-1">{principle.essence}</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          <div>
            <h4 className="text-sm font-medium text-blue-700 mb-1">Why It Matters</h4>
            <p className="text-gray-700 text-sm">{principle.whyItMatters}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-orange-700 mb-1">Common Mistake</h4>
            <p className="text-gray-700 text-sm">{principle.commonMistake}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-1">Recognition Pattern</h4>
            <p className="text-gray-700 text-sm">{principle.recognitionPattern}</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders domain title and teaching approach
- [ ] Categories sorted by orderInLearningPath
- [ ] Category headers have styled banner appearance
- [ ] Metaphor shown as blockquote if present
- [ ] PrincipleCard is collapsible (starts collapsed)
- [ ] Expanded card shows whyItMatters, commonMistake, recognitionPattern
- [ ] Connections section rendered if present
- [ ] Mastery summary shown at bottom
- [ ] All sections have proper id attributes for TOC navigation
- [ ] generateMentalModelTOC produces correct hierarchy

---

### Task 3.2.2: Create CurriculumRenderer Component

**Description**: Create structured renderer for Curriculum artifacts showing modules and lessons
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.1.4
**Can run parallel with**: Task 3.2.1, Task 3.2.3

**Technical Requirements**:
- Render curriculum header (title, audience, duration)
- Render modules with learning objectives and prerequisites
- Lessons rendered as cards with type badges
- Difficulty tier indicators
- Expandable lesson content

**Data Types** (from curriculumSchema.ts):
```typescript
interface CurriculumOutput {
  curriculumTitle: string;
  targetAudience: string;
  estimatedDuration: string;
  modules: Array<{
    moduleId: string;
    categoryId: string;
    title: string;
    subtitle: string;
    learningObjectives: string[];
    prerequisites: string[];
    lessons: Array<{
      lessonId: string;
      principleId: string;
      type: 'CONCEPT' | 'EXAMPLE' | 'CONTRAST' | 'PRACTICE';
      title: string;
      content: {
        headline: string;
        essence: string;
        expandedContent: string;
      };
      metadata: {
        difficultyTier: 'FOUNDATION' | 'EXPANSION' | 'MASTERY';
        estimatedMinutes: number;
      };
    }>;
  }>;
  learningPath: {
    recommended: string[];
  };
}
```

**Implementation**:
```typescript
// components/artifacts/renderers/CurriculumRenderer.tsx
'use client';

import { CurriculumOutput } from '@/lib/guruFunctions/schemas/curriculumSchema';
import { LessonCard } from './cards/LessonCard';
import { LessonTypeBadge, DifficultyBadge } from './badges';
import { TOCItem } from '@/lib/teaching/types/toc';

interface CurriculumRendererProps {
  content: CurriculumOutput;
  className?: string;
}

export function CurriculumRenderer({ content, className }: CurriculumRendererProps) {
  return (
    <div className={className} data-testid="curriculum-renderer">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.curriculumTitle}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            <strong>Target:</strong> {content.targetAudience}
          </span>
          <span>
            <strong>Duration:</strong> {content.estimatedDuration}
          </span>
        </div>
      </header>

      {/* Modules */}
      {content.modules.map((module, index) => (
        <section
          key={module.moduleId}
          id={`module-${module.moduleId}`}
          className="mb-12"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white bg-blue-700 px-4 py-3 rounded-r-lg border-l-8 border-blue-900 -ml-4">
              Module {index + 1}: {module.title}
            </h2>
            <p className="text-gray-600 mt-2 px-4">{module.subtitle}</p>

            {/* Learning Objectives */}
            {module.learningObjectives.length > 0 && (
              <div className="mt-4 px-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Learning Objectives
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm">
                  {module.learningObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prerequisites */}
            {module.prerequisites.length > 0 && (
              <div className="mt-3 px-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Prerequisites
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-500 text-sm">
                  {module.prerequisites.map((prereq, i) => (
                    <li key={i}>{prereq}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Lessons */}
          <div className="space-y-4 px-4">
            {module.lessons.map((lesson) => (
              <LessonCard
                key={lesson.lessonId}
                id={`lesson-${lesson.lessonId}`}
                lesson={lesson}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Learning Path */}
      {content.learningPath.recommended.length > 0 && (
        <section id="learning-path" className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            Recommended Learning Path
          </h2>
          <ol className="list-decimal list-inside text-blue-700 text-sm space-y-1">
            {content.learningPath.recommended.map((moduleId, i) => (
              <li key={i}>{moduleId}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export function generateCurriculumTOC(content: CurriculumOutput): TOCItem[] {
  const items: TOCItem[] = content.modules.map((mod) => ({
    id: `module-${mod.moduleId}`,
    label: mod.title,
    level: 1,
    children: mod.lessons.map((l) => ({
      id: `lesson-${l.lessonId}`,
      label: l.title,
      level: 2,
    })),
  }));

  if (content.learningPath.recommended.length > 0) {
    items.push({ id: 'learning-path', label: 'Learning Path', level: 1 });
  }

  return items;
}
```

**LessonCard Implementation**:
```typescript
// components/artifacts/renderers/cards/LessonCard.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { LessonTypeBadge, DifficultyBadge } from '../badges';
import { Lesson } from '@/lib/guruFunctions/schemas/curriculumSchema';

interface LessonCardProps {
  id: string;
  lesson: Lesson;
}

export function LessonCard({ id, lesson }: LessonCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`lesson-card-${lesson.lessonId}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <LessonTypeBadge type={lesson.type} />
              <DifficultyBadge tier={lesson.metadata.difficultyTier} />
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {lesson.metadata.estimatedMinutes} min
              </span>
            </div>
            <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
            <p className="text-gray-600 text-sm mt-1">{lesson.content.headline}</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Essence</h4>
            <p className="text-gray-600 text-sm">{lesson.content.essence}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Details</h4>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">
              {lesson.content.expandedContent}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders curriculum title, audience, and duration
- [ ] Modules have numbered headers with styled banners
- [ ] Learning objectives shown as bullet list
- [ ] Prerequisites shown if present
- [ ] LessonCard shows type badge, difficulty badge, time estimate
- [ ] Expanded lesson shows essence and expandedContent
- [ ] Learning path section shown if present
- [ ] All sections have proper id attributes for TOC navigation
- [ ] generateCurriculumTOC produces correct hierarchy

---

### Task 3.2.3: Create DrillSeriesRenderer Component

**Description**: Create structured renderer for Drill Series artifacts showing series and drills
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.1.4
**Can run parallel with**: Task 3.2.1, Task 3.2.2

**Technical Requirements**:
- Render series header (title, total drills, estimated time)
- Render series grouped by principle
- Drills rendered as cards with tier badges
- Show scenario, question, options, and feedback
- Expandable feedback section

**Data Types** (from drillSeriesSchema.ts):
```typescript
interface DrillSeriesOutput {
  drillSeriesTitle: string;
  targetPrinciples: string[];
  totalDrills: number;
  estimatedCompletionMinutes: number;
  series: Array<{
    seriesId: string;
    principleId: string;
    principleName: string;
    seriesDescription: string;
    drills: Array<{
      drillId: string;
      tier: 'RECOGNITION' | 'APPLICATION' | 'TRANSFER';
      scenario: {
        setup: string;
        visual: string | null;
        question: string;
      };
      options: Array<{
        id: string;
        text: string;
        isCorrect: boolean;
        commonMistake: string | null;
      }>;
      correctAnswer: string;
      feedback: {
        correct: { brief: string; principleReinforcement: string; expanded: string | null };
        incorrect: { brief: string; principleReminder: string; commonMistakeAddress: string; tryAgainHint: string };
      };
      asciiWireframe: string | null;
      metadata: { estimatedSeconds: number; prerequisiteDrills: string[]; tags: string[] };
    }>;
  }>;
  practiceSequences?: Array<{
    name: string;
    description: string;
    drillIds: string[];
  }> | null;
}
```

**Implementation**:
```typescript
// components/artifacts/renderers/DrillSeriesRenderer.tsx
'use client';

import { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema';
import { DrillCard } from './cards/DrillCard';
import { TOCItem } from '@/lib/teaching/types/toc';

interface DrillSeriesRendererProps {
  content: DrillSeriesOutput;
  className?: string;
}

export function DrillSeriesRenderer({ content, className }: DrillSeriesRendererProps) {
  return (
    <div className={className} data-testid="drill-series-renderer">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.drillSeriesTitle}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            <strong>{content.totalDrills}</strong> drills
          </span>
          <span>
            ~<strong>{content.estimatedCompletionMinutes}</strong> min total
          </span>
        </div>
        {content.targetPrinciples.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {content.targetPrinciples.map((principle, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
              >
                {principle}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Series */}
      {content.series.map((series) => (
        <section
          key={series.seriesId}
          id={`series-${series.seriesId}`}
          className="mb-12"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white bg-blue-700 px-4 py-3 rounded-r-lg border-l-8 border-blue-900 -ml-4">
              {series.principleName}
            </h2>
            <p className="text-gray-600 mt-2 px-4">{series.seriesDescription}</p>
          </div>

          {/* Drills */}
          <div className="space-y-4 px-4">
            {series.drills.map((drill, index) => (
              <DrillCard
                key={drill.drillId}
                id={`drill-${drill.drillId}`}
                drill={drill}
                drillNumber={index + 1}
                totalDrills={series.drills.length}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Practice Sequences */}
      {content.practiceSequences && content.practiceSequences.length > 0 && (
        <section id="practice-sequences" className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h2 className="text-lg font-semibold text-purple-800 mb-3">
            Practice Sequences
          </h2>
          <div className="space-y-3">
            {content.practiceSequences.map((seq, i) => (
              <div key={i} className="bg-white p-3 rounded border border-purple-100">
                <h3 className="font-medium text-purple-700">{seq.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{seq.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Drills: {seq.drillIds.join(' → ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function generateDrillSeriesToc(content: DrillSeriesOutput): TOCItem[] {
  const items: TOCItem[] = content.series.map((s) => ({
    id: `series-${s.seriesId}`,
    label: s.principleName,
    level: 1,
    children: s.drills.map((d, i) => ({
      id: `drill-${d.drillId}`,
      label: `Drill ${i + 1}`,
      level: 2,
    })),
  }));

  if (content.practiceSequences && content.practiceSequences.length > 0) {
    items.push({ id: 'practice-sequences', label: 'Practice Sequences', level: 1 });
  }

  return items;
}
```

**DrillCard Implementation**:
```typescript
// components/artifacts/renderers/cards/DrillCard.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { TierBadge } from '../badges';
import { Drill } from '@/lib/guruFunctions/schemas/drillSeriesSchema';

interface DrillCardProps {
  id: string;
  drill: Drill;
  drillNumber: number;
  totalDrills: number;
}

export function DrillCard({ id, drill, drillNumber, totalDrills }: DrillCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const correctOption = drill.options.find((o) => o.isCorrect);

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`drill-card-${drill.drillId}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">
            Drill {drillNumber} of {totalDrills}
          </span>
          <TierBadge tier={drill.tier} />
        </div>

        {/* Scenario */}
        <div className="mb-4">
          <p className="text-gray-700">{drill.scenario.setup}</p>
          {drill.asciiWireframe && (
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-x-auto">
              {drill.asciiWireframe}
            </pre>
          )}
        </div>

        {/* Question */}
        <p className="font-medium text-gray-900">{drill.scenario.question}</p>
      </div>

      {/* Options */}
      <div className="p-4 space-y-2">
        {drill.options.map((option) => (
          <div
            key={option.id}
            className={`p-3 rounded border ${
              option.isCorrect
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="font-medium text-gray-600 shrink-0">
                {option.id})
              </span>
              <span className={option.isCorrect ? 'text-green-800' : 'text-gray-700'}>
                {option.text}
              </span>
              {option.isCorrect && (
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0 ml-auto" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Feedback Toggle */}
      <button
        onClick={() => setShowFeedback(!showFeedback)}
        className="w-full p-3 text-left text-sm text-blue-700 hover:bg-blue-50 border-t border-gray-100 flex items-center justify-between"
      >
        {showFeedback ? 'Hide Feedback' : 'Show Feedback'}
        {showFeedback ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Feedback */}
      {showFeedback && (
        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-1">
              ✓ Correct Answer Feedback
            </h4>
            <p className="text-gray-700 text-sm">{drill.feedback.correct.brief}</p>
            <p className="text-gray-600 text-sm mt-1">
              <strong>Principle:</strong> {drill.feedback.correct.principleReinforcement}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-1">
              ✗ Incorrect Answer Guidance
            </h4>
            <p className="text-gray-700 text-sm">{drill.feedback.incorrect.brief}</p>
            <p className="text-gray-600 text-sm mt-1">
              <strong>Reminder:</strong> {drill.feedback.incorrect.principleReminder}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              <strong>Hint:</strong> {drill.feedback.incorrect.tryAgainHint}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Renders series title, total drills, and estimated time
- [ ] Target principles shown as tags
- [ ] Series grouped by principle with styled headers
- [ ] DrillCard shows drill number, tier badge
- [ ] Scenario and ASCII wireframe (if present) rendered
- [ ] Options listed with correct answer highlighted
- [ ] Feedback section expandable
- [ ] Practice sequences shown if present
- [ ] All sections have proper id attributes for TOC navigation
- [ ] generateDrillSeriesToc produces correct hierarchy

---

### Task 3.2.4: Create Badge Components

**Description**: Create reusable badge components for lesson types, difficulty tiers, and drill tiers
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3.2.1, Task 3.2.2, Task 3.2.3

**Implementation**:
```typescript
// components/artifacts/renderers/badges.tsx
import { cn } from '@/lib/utils';

// Lesson Type Badge
type LessonType = 'CONCEPT' | 'EXAMPLE' | 'CONTRAST' | 'PRACTICE';

const lessonTypeStyles: Record<LessonType, string> = {
  CONCEPT: 'bg-blue-100 text-blue-800',
  EXAMPLE: 'bg-green-100 text-green-800',
  CONTRAST: 'bg-orange-100 text-orange-800',
  PRACTICE: 'bg-purple-100 text-purple-800',
};

export function LessonTypeBadge({ type }: { type: LessonType }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 text-xs font-medium rounded',
        lessonTypeStyles[type]
      )}
      data-testid={`lesson-type-${type.toLowerCase()}`}
    >
      {type}
    </span>
  );
}

// Difficulty Tier Badge
type DifficultyTier = 'FOUNDATION' | 'EXPANSION' | 'MASTERY';

const difficultyStyles: Record<DifficultyTier, { bg: string; icon: string }> = {
  FOUNDATION: { bg: 'bg-emerald-100 text-emerald-800', icon: '🌱' },
  EXPANSION: { bg: 'bg-amber-100 text-amber-800', icon: '🌿' },
  MASTERY: { bg: 'bg-red-100 text-red-800', icon: '🌳' },
};

export function DifficultyBadge({ tier }: { tier: DifficultyTier }) {
  const style = difficultyStyles[tier];
  return (
    <span
      className={cn('px-2 py-0.5 text-xs font-medium rounded', style.bg)}
      data-testid={`difficulty-${tier.toLowerCase()}`}
    >
      {style.icon} {tier}
    </span>
  );
}

// Drill Tier Badge
type DrillTier = 'RECOGNITION' | 'APPLICATION' | 'TRANSFER';

const tierStyles: Record<DrillTier, { bg: string; label: string }> = {
  RECOGNITION: { bg: 'bg-yellow-100 text-yellow-800', label: 'Recognize' },
  APPLICATION: { bg: 'bg-blue-100 text-blue-800', label: 'Apply' },
  TRANSFER: { bg: 'bg-green-100 text-green-800', label: 'Transfer' },
};

export function TierBadge({ tier }: { tier: DrillTier }) {
  const style = tierStyles[tier];
  return (
    <span
      className={cn('px-2 py-0.5 text-xs font-medium rounded', style.bg)}
      data-testid={`tier-${tier.toLowerCase()}`}
    >
      {style.label}
    </span>
  );
}
```

**Acceptance Criteria**:
- [ ] LessonTypeBadge renders with correct colors for each type
- [ ] DifficultyBadge shows icon and tier name
- [ ] TierBadge renders with correct colors and friendly labels
- [ ] All badges have data-testid attributes
- [ ] Badges use consistent sizing and styling

---

## Phase 3.3: Integration

### Task 3.3.1: Create TypeSpecificRenderer Wrapper

**Description**: Create wrapper component that routes to correct renderer based on artifact type
**Size**: Medium
**Priority**: High
**Dependencies**: Tasks 3.2.1, 3.2.2, 3.2.3
**Can run parallel with**: None

**Implementation**:
```typescript
// components/artifacts/renderers/TypeSpecificRenderer.tsx
'use client';

import { useMemo } from 'react';
import { ArtifactDetail } from '@/lib/teaching/artifactClient';
import { MentalModelRenderer, generateMentalModelTOC } from './MentalModelRenderer';
import { CurriculumRenderer, generateCurriculumTOC } from './CurriculumRenderer';
import { DrillSeriesRenderer, generateDrillSeriesToc } from './DrillSeriesRenderer';
import { TableOfContents } from '../TableOfContents';
import { useActiveSection } from '@/lib/teaching/hooks/useActiveSection';
import { TOCItem } from '@/lib/teaching/types/toc';
import { MentalModelOutput } from '@/lib/guruFunctions/schemas/mentalModelSchema';
import { CurriculumOutput } from '@/lib/guruFunctions/schemas/curriculumSchema';
import { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema';

interface TypeSpecificRendererProps {
  artifact: ArtifactDetail;
  className?: string;
}

export function TypeSpecificRenderer({ artifact, className }: TypeSpecificRendererProps) {
  // Generate TOC based on artifact type
  const tocItems = useMemo<TOCItem[]>(() => {
    switch (artifact.type) {
      case 'MENTAL_MODEL':
        return generateMentalModelTOC(artifact.content as MentalModelOutput);
      case 'CURRICULUM':
        return generateCurriculumTOC(artifact.content as CurriculumOutput);
      case 'DRILL_SERIES':
        return generateDrillSeriesToc(artifact.content as DrillSeriesOutput);
      default:
        return [];
    }
  }, [artifact.type, artifact.content]);

  // Extract all section IDs for scroll tracking
  const sectionIds = useMemo(() => {
    const ids: string[] = [];
    function extractIds(items: TOCItem[]) {
      items.forEach((item) => {
        ids.push(item.id);
        if (item.children) extractIds(item.children);
      });
    }
    extractIds(tocItems);
    return ids;
  }, [tocItems]);

  const activeId = useActiveSection(sectionIds);

  return (
    <div className={`flex ${className}`} data-testid="type-specific-renderer">
      {/* Table of Contents */}
      <TableOfContents items={tocItems} activeId={activeId} />

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-y-auto" id="artifact-content-scroll">
        {artifact.type === 'MENTAL_MODEL' && (
          <MentalModelRenderer content={artifact.content as MentalModelOutput} />
        )}
        {artifact.type === 'CURRICULUM' && (
          <CurriculumRenderer content={artifact.content as CurriculumOutput} />
        )}
        {artifact.type === 'DRILL_SERIES' && (
          <DrillSeriesRenderer content={artifact.content as DrillSeriesOutput} />
        )}
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Routes to correct renderer based on artifact.type
- [ ] Generates TOC items for current artifact type
- [ ] Extracts all section IDs for scroll tracking
- [ ] Passes activeId to TableOfContents
- [ ] Content area has proper scrolling
- [ ] Layout shows TOC on left, content on right

---

### Task 3.3.2: Final Integration and Polish

**Description**: Wire up scroll navigation and ensure all components work together seamlessly
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.3.1, Task 3.1.2
**Can run parallel with**: None

**Technical Requirements**:
- Verify TOC click → smooth scroll works
- Verify scroll → TOC highlight works
- Ensure diff toggle still works in markdown mode
- Test all view modes switch correctly
- Fix any styling inconsistencies

**Testing Checklist**:
1. Open Mental Model artifact
   - Default view is "Rendered"
   - TOC shows categories and principles
   - Clicking TOC item scrolls to section
   - Scrolling updates TOC highlight
   - Switching to Markdown shows DiffContent
   - Switching to JSON shows raw JSON

2. Open Curriculum artifact
   - TOC shows modules and lessons
   - Lessons expand/collapse properly
   - Badges display correctly

3. Open Drill Series artifact
   - TOC shows series and drills
   - Options show correct answer
   - Feedback expands/collapses

4. Version switching
   - Changing version preserves view mode
   - Diff mode works when switching to version > 1

**Acceptance Criteria**:
- [ ] All three artifact types render correctly
- [ ] TOC navigation works (click to scroll)
- [ ] Scroll spy works (scroll to highlight)
- [ ] View mode toggle works for all modes
- [ ] Diff functionality preserved in markdown mode
- [ ] Version switching works with all view modes
- [ ] No console errors or warnings

---

## Phase 3.4: Testing

### Task 3.4.1: E2E Tests for View Mode Switching

**Description**: Create E2E tests for view mode toggle functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.3.2
**Can run parallel with**: Task 3.4.2, Task 3.4.3

**Implementation**:
```typescript
// e2e/enhanced-renderers.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Enhanced Renderers - View Modes', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a project with generated artifacts
    // This assumes test data exists - may need seeding
    await page.goto('/projects/test-project/artifacts/teaching/mental-model');
    await page.waitForSelector('[data-testid="artifact-viewer-with-versions"]');
  });

  test('defaults to Rendered view mode', async ({ page }) => {
    await expect(page.getByTestId('view-mode-rendered')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('type-specific-renderer')).toBeVisible();
  });

  test('can switch to Markdown view', async ({ page }) => {
    await page.getByTestId('view-mode-markdown').click();
    await expect(page.getByTestId('view-mode-markdown')).toHaveAttribute('aria-selected', 'true');
    // Should show DiffContent
    await expect(page.locator('.prose')).toBeVisible();
  });

  test('can switch to JSON view', async ({ page }) => {
    await page.getByTestId('view-mode-json').click();
    await expect(page.getByTestId('view-mode-json')).toHaveAttribute('aria-selected', 'true');
    // Should show pre element with JSON
    await expect(page.locator('pre')).toContainText('{');
  });

  test('view mode persists when changing versions', async ({ page }) => {
    // Switch to JSON mode
    await page.getByTestId('view-mode-json').click();

    // Click on a different version (if available)
    const version1 = page.getByTestId('version-1');
    if (await version1.isVisible()) {
      await version1.click();
      await page.waitForURL(/\?v=1/);
      // JSON mode should still be selected
      await expect(page.getByTestId('view-mode-json')).toHaveAttribute('aria-selected', 'true');
    }
  });
});
```

**Acceptance Criteria**:
- [ ] Tests verify default Rendered mode
- [ ] Tests verify Markdown mode switch
- [ ] Tests verify JSON mode switch
- [ ] Tests verify view mode persists across version changes
- [ ] All tests pass

---

### Task 3.4.2: E2E Tests for TOC Navigation

**Description**: Create E2E tests for table of contents click navigation
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.3.2
**Can run parallel with**: Task 3.4.1, Task 3.4.3

**Implementation**:
```typescript
// e2e/toc-navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('TOC Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/curriculum');
    await page.waitForSelector('[data-testid="type-specific-renderer"]');
  });

  test('displays table of contents', async ({ page }) => {
    await expect(page.getByTestId('table-of-contents')).toBeVisible();
    // Should have at least one TOC item
    await expect(page.locator('[data-testid^="toc-item-"]').first()).toBeVisible();
  });

  test('clicking TOC item scrolls to section', async ({ page }) => {
    // Get the first module TOC item
    const tocItem = page.locator('[data-testid^="toc-item-module-"]').first();
    const moduleId = await tocItem.getAttribute('data-testid');
    const sectionId = moduleId?.replace('toc-item-', '');

    // Click the TOC item
    await tocItem.click();

    // Wait for scroll animation
    await page.waitForTimeout(500);

    // The section should be near the top of the viewport
    const section = page.locator(`#${sectionId}`);
    const boundingBox = await section.boundingBox();
    expect(boundingBox?.y).toBeLessThan(200); // Within 200px of top
  });

  test('TOC shows hierarchical structure', async ({ page }) => {
    // Check for nested items (lessons under modules)
    const moduleItem = page.locator('[data-testid^="toc-item-module-"]').first();
    await expect(moduleItem).toBeVisible();

    // Check for nested lesson items
    const lessonItems = page.locator('[data-testid^="toc-item-lesson-"]');
    await expect(lessonItems.first()).toBeVisible();
  });
});
```

**Acceptance Criteria**:
- [ ] Tests verify TOC is rendered
- [ ] Tests verify clicking TOC item scrolls content
- [ ] Tests verify hierarchical TOC structure
- [ ] All tests pass

---

### Task 3.4.3: E2E Tests for Scroll Spy

**Description**: Create E2E tests for scroll-spy TOC highlighting
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 3.3.2
**Can run parallel with**: Task 3.4.1, Task 3.4.2

**Implementation**:
```typescript
// e2e/scroll-spy.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scroll Spy TOC Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/drill-series');
    await page.waitForSelector('[data-testid="type-specific-renderer"]');
  });

  test('highlights first section on initial load', async ({ page }) => {
    // First TOC item should be highlighted (have bg-blue-100)
    const firstTocItem = page.locator('[data-testid^="toc-item-series-"]').first();
    await expect(firstTocItem).toHaveClass(/bg-blue-100/);
  });

  test('updates highlight when scrolling to new section', async ({ page }) => {
    // Scroll to a later section
    const laterSection = page.locator('[id^="series-"]').nth(1);
    await laterSection.scrollIntoViewIfNeeded();

    // Wait for intersection observer to fire
    await page.waitForTimeout(300);

    // The corresponding TOC item should now be highlighted
    const laterTocItem = page.locator('[data-testid^="toc-item-series-"]').nth(1);
    await expect(laterTocItem).toHaveClass(/bg-blue-100/);
  });

  test('only one section highlighted at a time', async ({ page }) => {
    // Count items with bg-blue-100
    const highlightedItems = page.locator('[data-testid^="toc-item-"] .bg-blue-100');
    await expect(highlightedItems).toHaveCount(1);
  });
});
```

**Acceptance Criteria**:
- [ ] Tests verify initial section highlight
- [ ] Tests verify highlight updates on scroll
- [ ] Tests verify only one section highlighted at a time
- [ ] All tests pass

---

## Summary

| Phase | Tasks | Size | Parallel Opportunities |
|-------|-------|------|------------------------|
| 3.1 | 4 tasks | S-M | Tasks 3.1.1 + 3.1.3 can run in parallel |
| 3.2 | 4 tasks | S-L | Tasks 3.2.1-3.2.4 can ALL run in parallel |
| 3.3 | 2 tasks | M | Sequential |
| 3.4 | 3 tasks | M | All 3 can run in parallel |

**Total: 13 tasks**

**Critical Path**: 3.1.1 → 3.1.2 → 3.3.1 → 3.3.2 → 3.4.x

**Parallel Execution Strategy**:
1. Start Phase 3.1 with tasks 3.1.1 and 3.1.3 in parallel
2. Task 3.1.4 depends on 3.1.3, task 3.1.2 depends on 3.1.1
3. Phase 3.2 all 4 tasks can run in parallel
4. Phase 3.3 is sequential (integration)
5. Phase 3.4 all 3 test tasks can run in parallel
