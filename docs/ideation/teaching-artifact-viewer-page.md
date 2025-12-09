# Teaching Artifact Viewer Page

## Problem Statement

The current teaching content viewing experience uses modals (max-w-4xl, max-h-[70vh]) which constrains the available space for displaying complex, hierarchical content like curricula and drill series. Users also have no way to access previous versions of artifacts despite the database supporting full version history. The modal paradigm makes it difficult to:

1. **Visualize hierarchical content** - Curricula have modules → lessons → content, drills have series → drills → scenarios/options/feedback
2. **Compare versions** - No way to see how content evolved across regenerations
3. **Navigate within long documents** - Mental models and curricula can be lengthy; modals lack proper navigation
4. **See the big picture** - Small viewport prevents seeing overall structure

## Proposed Solution

Replace the modal-based viewing with a dedicated artifact viewer page at `/projects/[id]/teaching/[artifactType]` (or `/projects/[id]/artifacts/[type]`) that provides:

1. **Full-page real estate** for content display
2. **Version history sidebar** showing all versions with timestamps
3. **Type-specific renderers** optimized for each artifact's structure
4. **Table of contents / navigation** for long documents

## Current State Analysis

### Existing Data Model (schema.prisma:327-364)

```prisma
model GuruArtifact {
  id                  String
  projectId           String
  type                GuruArtifactType  // MENTAL_MODEL, CURRICULUM, DRILL_SERIES
  version             Int
  content             Json               // Structured data
  markdownContent     String?            // Human-readable
  corpusHash          String?            // Corpus state when generated
  generatedAt         DateTime
  dependsOnArtifactId String?            // Links curriculum → mental model, etc.
  status              ArtifactStatus
  errorMessage        String?
  progressStage       String?

  // Relations
  dependsOn           GuruArtifact?
  dependents          GuruArtifact[]
}
```

### Existing API Support

**`GET /api/projects/[id]/guru/artifacts`** already returns:
```typescript
{
  latest: { mentalModel, curriculum, drillSeries },
  grouped: {
    MENTAL_MODEL: ArtifactSummary[],   // All versions
    CURRICULUM: ArtifactSummary[],
    DRILL_SERIES: ArtifactSummary[]
  },
  counts: { ... }
}
```

**`GET /api/projects/[id]/guru/artifacts/[artifactId]`** returns:
```typescript
{
  artifact: {
    id, type, version, content, markdownContent,
    corpusHash, generatedAt, status,
    dependsOn: { id, type, version } | null,
    dependents: [{ id, type, version }]
  }
}
```

### Current UI Constraints (GuruTeachingManager.tsx)

- **Modal viewport**: `max-w-4xl max-h-[70vh]` (~900px × ~500px usable)
- **No version access**: UI only shows `latest.{type}` with version badge
- **Single view mode**: Markdown or JSON toggle, no specialized renderers
- **No navigation**: Long documents require scrolling through entire content

## Proposed Architecture

### Route Structure

```
/projects/[id]/teaching
├── page.tsx              # Teaching dashboard (current GuruTeachingManager)
├── mental-model/
│   └── page.tsx          # Mental model viewer with version history
├── curriculum/
│   └── page.tsx          # Curriculum viewer with module navigation
└── drill-series/
    └── page.tsx          # Drill series viewer with interactive drills
```

### Page Layout Concept

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Teaching   │   Mental Model   │   v3 ▼  │  🔄 Regen  │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│  VERSIONS      │              CONTENT AREA                      │
│                │                                                │
│  ● v3 (latest) │  [Table of Contents]  [Main Content Display]  │
│    Dec 8       │                                                │
│    ↑ corpus    │  # Domain: Backgammon Strategy                 │
│                │                                                │
│  ○ v2          │  ## 1. Pedagogical Foundations                 │
│    Dec 7       │      - Philosophical Alignment                 │
│    ↑ corpus    │      - Theory Integration                      │
│                │                                                │
│  ○ v1          │  ## 2. Opening Strategy                        │
│    Dec 5       │      - Slot and Split                          │
│    (initial)   │      ...                                       │
│                │                                                │
├────────────────┴────────────────────────────────────────────────┤
│ Depends on: Mental Model v2  │  Used by: Drill Series v1        │
└─────────────────────────────────────────────────────────────────┘
```

### Type-Specific Renderers

**Mental Model Renderer**
- Category accordion/tabs for grouping principles
- Principle cards with essence, why it matters, common mistakes
- Visual principle connection graph (optional enhancement)

**Curriculum Renderer**
- Module sidebar navigation
- Lesson cards with type badges (CONCEPT, EXAMPLE, CONTRAST, PRACTICE)
- Progress tracking (if user state is added later)
- Expandable/collapsible lesson content with `<details>`

**Drill Series Renderer**
- Interactive drill experience (one at a time or list view)
- Drill cards with scenario, options, feedback preview
- Tier badges (RECOGNITION, APPLICATION, TRANSFER)
- ASCII wireframe preview for UI concepts

## Key Features

### 1. Version History Panel

Left sidebar showing all versions:
- Version number and generation date
- Corpus hash indicator (shows if corpus changed)
- Quick preview tooltip on hover
- Click to load that version
- Visual indicator for "latest"
- "Compare" button to diff two versions (future)

### 2. Table of Contents

For long artifacts, auto-generated from:
- Mental Model: Categories → Principles
- Curriculum: Modules → Lessons
- Drill Series: Series → Individual drills

Sticky sidebar that highlights current section while scrolling.

### 3. Dependency Visualization

Show artifact relationships:
- "Built from Mental Model v2" link
- "Used to generate Drill Series v1" link
- Clickable to navigate between related artifacts

### 4. View Mode Toggle

- **Rendered** (default): Type-specific beautiful rendering
- **Markdown**: Raw markdown view (for debugging/export)
- **JSON**: Structured data view (for debugging/API consumers)

## Implementation Phases

### Phase 1: Basic Page Structure
- Create route structure `/projects/[id]/teaching/[type]`
- Move modal content to full page
- Add back navigation to teaching dashboard
- Update "View" buttons to navigate instead of opening modal

### Phase 2: Version History
- Add version sidebar component
- Fetch all versions from existing grouped API
- Allow switching between versions
- Show generation timestamps and corpus hash

### Phase 3: Enhanced Renderers
- Mental Model: Category-based layout with principle cards
- Curriculum: Module navigation sidebar with lesson expansion
- Drill Series: Drill cards with tier progression

### Phase 4: Navigation & Polish
- Add table of contents for each type
- Smooth scroll to sections
- Highlight current section in TOC
- Add dependency links between artifacts

## Open Questions

1. **URL structure**: Should it be `/teaching/mental-model` or `/artifacts/mental-model`?
2. **Version comparison**: Is side-by-side diff needed or just switching between versions?
3. **Drill interaction**: Should drills be fully interactive (answer them) or just viewable?
4. **Export**: Should there be export buttons (PDF, Markdown)?
5. **Corpus state**: Show what corpus looked like when artifact was generated?

## Dependencies

- Existing API endpoints (no backend changes needed for Phase 1-2)
- React components from shadcn/ui (already installed)
- Possibly: diff library for version comparison (Phase 4+)

## Out of Scope (Future)

- User progress tracking through curriculum
- Drill scoring and completion tracking
- AI-assisted content editing
- Corpus snapshot restoration from artifact
