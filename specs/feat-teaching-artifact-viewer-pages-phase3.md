# Teaching Artifact Viewer Pages - Phase 3: Enhanced Renderers

## Status
Ready for Execution

## Authors
- Claude Code (AI Assistant)
- Date: 2025-12-08

## Overview

Add type-specific enhanced renderers and table of contents navigation for each artifact type. This phase transforms the generic markdown view into structured, navigable displays optimized for each artifact's unique content structure.

## Background/Problem Statement

Phases 1-2 established the viewer infrastructure and version history. However, all artifact types currently render as generic markdown, which doesn't optimize for their distinct structures:

- **Mental Model**: Categories → Principles with interconnections
- **Curriculum**: Modules → Lessons with types (CONCEPT, EXAMPLE, CONTRAST, PRACTICE)
- **Drill Series**: Series → Drills with tiers (RECOGNITION, APPLICATION, TRANSFER)

Each type has a rich JSON structure that could be rendered in more intuitive, navigable ways.

## Goals

- Create type-specific renderers that leverage the JSON structure
- Add auto-generated table of contents for each artifact type
- Enable smooth scroll navigation to sections
- Highlight current section in TOC while scrolling
- Maintain view mode toggle (Rendered / Markdown / JSON)

## Non-Goals (Phase 3)

- Interactive drill answering
- User progress tracking
- Export functionality
- Editing/modification of artifacts
- AI-assisted content suggestions

## Technical Dependencies

- **Phase 1 & 2 completion** - Requires viewer pages and version history
- **No new npm packages** - Uses existing React, Tailwind, shadcn/ui

### Current Implementation State (Post-Phase 2)

The `ArtifactViewerWithVersions` component currently:
- Has a 2-mode toggle: JSON view vs Markdown/Diff view
- Uses `DiffContent` for markdown rendering (with optional diff highlighting)
- Located at: `components/artifacts/ArtifactViewerWithVersions.tsx`

**Phase 3 changes this to:**
- 3-mode toggle: **Rendered** (new) | Markdown | JSON
- "Rendered" mode shows type-specific structured view with TOC
- Markdown mode shows raw markdown (existing behavior)
- JSON mode shows raw JSON (existing behavior)

## Detailed Design

### Updated Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ArtifactContent (Updated)                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌────────────────────────────────────────────────────────┐ │
│ │ TableOfContents  │ │ TypeRenderer                                           │ │
│ │                  │ │                                                        │ │
│ │ Categories       │ │ ┌────────────────────────────────────────────────────┐ │ │
│ │ ├─ Foundations   │ │ │ MentalModelRenderer                                │ │ │
│ │ │  ├─ Principle1 │ │ │   OR                                               │ │ │
│ │ │  └─ Principle2 │ │ │ CurriculumRenderer                                 │ │ │
│ │ ├─ Strategy      │ │ │   OR                                               │ │ │
│ │ │  └─ Principle3 │ │ │ DrillSeriesRenderer                                │ │ │
│ │ └─ Advanced      │ │ │                                                    │ │ │
│ │                  │ │ │ [Structured content with sections]                 │ │ │
│ │ ● Current section│ │ │                                                    │ │ │
│ │   highlighted    │ │ └────────────────────────────────────────────────────┘ │ │
│ └──────────────────┘ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### View Mode Toggle

```typescript
type ViewMode = 'rendered' | 'markdown' | 'json';
```

- **Rendered** (default): Type-specific structured view
- **Markdown**: Raw markdown (existing behavior)
- **JSON**: Raw JSON structure (existing behavior)

### Type-Specific Renderers

#### 1. Mental Model Renderer

**Data Structure** (from `mentalModelSchema.ts`):
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

**Rendered Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ # Domain: Backgammon Strategy                               │
│ Teaching Approach: Progressive mastery through...            │
├─────────────────────────────────────────────────────────────┤
│ ## 1. Pedagogical Foundations                               │
│ "Mental Model: The roots of a tree - strong foundations..." │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Principle: Philosophical Alignment                       │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Essence: Choose teaching methods based on roots...       │ │
│ │                                                          │ │
│ │ Why It Matters                                           │ │
│ │ Aligning strategies with foundations ensures...          │ │
│ │                                                          │ │
│ │ Common Mistake                                           │ │
│ │ Ignoring historical context of methods...                │ │
│ │                                                          │ │
│ │ Recognition Pattern                                      │ │
│ │ When effectiveness is questioned, check alignment...     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Next principle card...]                                    │
├─────────────────────────────────────────────────────────────┤
│ ## Principle Connections                                    │
│ ┌───────────┐        ┌───────────┐                         │
│ │ Principle │───────▶│ Principle │                         │
│ │     A     │ builds │     B     │                         │
│ └───────────┘  on    └───────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

**Component**:
```typescript
// components/artifacts/renderers/MentalModelRenderer.tsx
interface MentalModelRendererProps {
  content: MentalModelOutput;
  onSectionVisible?: (sectionId: string) => void;
}
```

#### 2. Curriculum Renderer

**Data Structure** (from `curriculumSchema.ts`):
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
    recommended: string[];  // Module IDs in recommended order
  };
}
```

**Rendered Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ # Curriculum: Backgammon Mastery                            │
│ Target: Intermediate players | Duration: ~4 hours           │
├─────────────────────────────────────────────────────────────┤
│ ## Module 1: Pedagogical Foundations                        │
│ Subtitle here...                                            │
│                                                             │
│ Learning Objectives:                                        │
│ • Understand philosophical alignment                         │
│ • Integrate multiple theories                                │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [CONCEPT] Philosophical Alignment in Teaching           │ │
│ │ FOUNDATION | ~15 min                                    │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Headline: Align methods with their philosophical roots  │ │
│ │                                                          │ │
│ │ ▼ Learn more...                                          │ │
│ │ [Expandable content]                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [EXAMPLE] Case Study: Constructivist Approach           │ │
│ │ FOUNDATION | ~20 min                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Lesson Type Badges**:
- CONCEPT: Blue badge
- EXAMPLE: Green badge
- CONTRAST: Orange badge
- PRACTICE: Purple badge

**Difficulty Tier Indicators**:
- FOUNDATION: Beginner-friendly icon
- EXPANSION: Intermediate icon
- MASTERY: Advanced icon

#### 3. Drill Series Renderer

**Data Structure** (from `drillSeriesSchema.ts`):
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
  practiceSequences?: Array<{  // Optional curated drill sequences
    name: string;
    description: string;
    drillIds: string[];
  }> | null;
}
```

**Rendered Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ # Drill Series: Backgammon Fundamentals                     │
│ 15 drills | ~45 min total                                   │
├─────────────────────────────────────────────────────────────┤
│ ## Series: Philosophical Alignment                          │
│ Practice recognizing when methods align with principles     │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Drill 1 of 5                              [RECOGNITION] │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Scenario:                                               │ │
│ │ A teacher is choosing between two approaches...         │ │
│ │                                                          │ │
│ │ Question: Which approach better aligns with...?         │ │
│ │                                                          │ │
│ │ Options:                                                 │ │
│ │ A) Approach A - focuses on memorization                 │ │
│ │ B) Approach B - emphasizes understanding  ✓             │ │
│ │ C) Approach C - uses repetition                         │ │
│ │ D) Approach D - relies on testing                       │ │
│ │                                                          │ │
│ │ ▼ Show Feedback                                          │ │
│ │ ┌───────────────────────────────────────────────────┐   │ │
│ │ │ Correct: Understanding-focused approaches...       │   │ │
│ │ │ Principle: Philosophical alignment means...        │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Next drill...]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tier Badges**:
- RECOGNITION: Yellow - "Identify patterns"
- APPLICATION: Blue - "Apply concepts"
- TRANSFER: Green - "Generalize learning"

### Table of Contents Component

```typescript
// components/artifacts/TableOfContents.tsx

interface TOCItem {
  id: string;
  label: string;
  level: number;  // 1 = section, 2 = subsection
  children?: TOCItem[];
}

interface TableOfContentsProps {
  items: TOCItem[];
  activeId: string | null;
  onItemClick: (id: string) => void;
}
```

**Auto-generation by type**:

```typescript
function generateTOC(artifact: ArtifactDetail): TOCItem[] {
  switch (artifact.type) {
    case 'MENTAL_MODEL':
      return artifact.content.categories.map(cat => ({
        id: `category-${cat.id}`,
        label: cat.name,
        level: 1,
        children: cat.principles.map(p => ({
          id: `principle-${p.id}`,
          label: p.name,
          level: 2,
        })),
      }));

    case 'CURRICULUM':
      return artifact.content.modules.map(mod => ({
        id: `module-${mod.moduleId}`,
        label: mod.title,
        level: 1,
        children: mod.lessons.map(l => ({
          id: `lesson-${l.lessonId}`,
          label: l.title,
          level: 2,
        })),
      }));

    case 'DRILL_SERIES':
      return artifact.content.series.map(s => ({
        id: `series-${s.seriesId}`,
        label: s.principleName,
        level: 1,
        children: s.drills.map((d, i) => ({
          id: `drill-${d.drillId}`,
          label: `Drill ${i + 1}`,
          level: 2,
        })),
      }));
  }
}
```

### Scroll Tracking

Use Intersection Observer to track which section is visible:

```typescript
function useActiveSection(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }  // Trigger when section is in top 20%
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}
```

### Smooth Scroll Navigation

```typescript
function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
```

## User Experience

### Navigation Flow

1. User opens artifact in "Rendered" view (default)
2. TOC on left shows all sections/subsections
3. As user scrolls, current section highlights in TOC
4. User clicks TOC item → smooth scroll to that section
5. User can switch to Markdown or JSON view anytime

### View Mode Switching

```
┌─────────────────────────────────────────────┐
│ [Rendered ●] [Markdown ○] [JSON ○]          │
└─────────────────────────────────────────────┘
```

- Rendered: Type-specific structured view with TOC
- Markdown: Raw markdown (TOC hidden)
- JSON: Raw JSON tree (TOC hidden)

## Testing Strategy

### Unit Tests

**MentalModelRenderer.test.tsx**
```typescript
// Purpose: Verify mental model renders with correct structure
describe('MentalModelRenderer', () => {
  it('renders domain title and teaching approach');
  it('renders all categories in order');
  it('renders principle cards within categories');
  it('shows principle connections section');
  it('calls onSectionVisible when sections scroll into view');
});
```

**CurriculumRenderer.test.tsx**
```typescript
// Purpose: Verify curriculum renders with modules and lessons
describe('CurriculumRenderer', () => {
  it('renders curriculum metadata (audience, duration)');
  it('renders modules with learning objectives');
  it('renders lessons with type badges');
  it('shows difficulty tier indicators');
  it('expands/collapses lesson content');
});
```

**DrillSeriesRenderer.test.tsx**
```typescript
// Purpose: Verify drill series renders with tiers and feedback
describe('DrillSeriesRenderer', () => {
  it('renders series with drill counts');
  it('renders drills with tier badges');
  it('shows scenario and question');
  it('displays options with correct answer marked');
  it('expands/collapses feedback section');
});
```

**TableOfContents.test.tsx**
```typescript
// Purpose: Verify TOC renders and handles interactions
describe('TableOfContents', () => {
  it('renders hierarchical items');
  it('highlights active section');
  it('calls onItemClick when item clicked');
  it('renders nested children with indentation');
});
```

### E2E Tests

**enhanced-renderers.spec.ts**
```typescript
test.describe('Enhanced Renderers', () => {
  test('mental model renders with category sections', async ({ page }) => {
    // 1. Navigate to mental model viewer
    // 2. Verify categories render as sections
    // 3. Verify principle cards within categories
    // 4. Verify TOC matches content structure
  });

  test('TOC highlights current section on scroll', async ({ page }) => {
    // 1. Navigate to curriculum viewer
    // 2. Scroll to module 2
    // 3. Verify TOC highlights module 2
  });

  test('TOC click scrolls to section', async ({ page }) => {
    // 1. Navigate to drill series viewer
    // 2. Click on Series 3 in TOC
    // 3. Verify page scrolls to Series 3
  });

  test('can switch between view modes', async ({ page }) => {
    // 1. Start in Rendered view
    // 2. Click Markdown tab
    // 3. Verify raw markdown shows
    // 4. Click JSON tab
    // 5. Verify JSON structure shows
  });
});
```

## Implementation Tasks

### Phase 3.1: View Mode Infrastructure
1. Create `ViewModeToggle` component with 3 modes (Rendered/Markdown/JSON)
2. Update `ArtifactViewerWithVersions` to use `ViewModeToggle` instead of JSON checkbox
3. Create `useActiveSection` hook for scroll tracking with IntersectionObserver
4. Create `TableOfContents` component with hierarchy support

### Phase 3.2: Type-Specific Renderers
5. Create `MentalModelRenderer` component with category/principle structure
6. Create `CurriculumRenderer` component with module/lesson structure
7. Create `DrillSeriesRenderer` component with series/drill structure
8. Create shared card components: `PrincipleCard`, `LessonCard`, `DrillCard`
9. Create badge components: `LessonTypeBadge`, `TierBadge`, `DifficultyBadge`

### Phase 3.3: Integration
10. Create `TypeSpecificRenderer` wrapper that routes to correct renderer by type
11. Update `ArtifactViewerWithVersions` to compose TOC + TypeSpecificRenderer in "Rendered" mode
12. Wire up scroll navigation (TOC click → smooth scroll to section)
13. Wire up scroll spy (section visibility → TOC highlight update)

### Phase 3.4: Testing
14. Write E2E tests for view mode switching
15. Write E2E tests for TOC navigation
16. Write E2E tests for scroll-spy highlighting

## Performance Considerations

- Renderers should virtualize long lists (many drills) if needed
- Intersection Observer is lightweight and passive
- TOC re-renders only on activeId change (memoize items)

## Open Questions

1. **Card expansion**: Should cards be expanded by default or collapsed?
   - **Recommendation**: Collapsed with "expand all" option

2. **Principle connections**: Render as text list or visual graph?
   - **Recommendation**: Text list for Phase 3, visual graph could be Phase 4

## References

- Phase 1 Spec: `specs/feat-teaching-artifact-viewer-pages-phase1.md`
- Phase 2 Spec: `specs/feat-teaching-artifact-viewer-pages-phase2.md`
- Schema definitions: `lib/guruFunctions/schemas/`
- Ideation Document: `docs/ideation/teaching-artifact-viewer-page.md`
