# Unified Teaching Artifact Page

**Slug:** unified-teaching-artifact-page
**Author:** Claude Code
**Date:** 2025-12-23
**Branch:** preflight/unified-teaching-artifact-page
**Related:** Screenshots provided by user showing current complex UI

---

## 1) Intent & Assumptions

### Task Brief
Simplify the teaching artifact experience by combining generation and viewing into a single page per artifact type. Currently users navigate between `/artifacts/teaching` (generation dashboard) and separate viewer pages (e.g., `/artifacts/teaching/mental-model`). The new design should provide a unified experience where users can both generate and view artifacts on the same page, with complexity hidden behind an "Advanced Mode" toggle.

### Assumptions
- Primary users are **non-technical educators** who find the current ~6 toggles/panels overwhelming
- The existing "Advanced Mode" toggle pattern from `ArtifactDetailPanel` should be extended
- Generation workflow (Mental Model → Curriculum → Drill Series) order should be preserved
- All existing advanced features must remain accessible, just hidden by default
- URL structure should support deep linking and browser navigation
- Mode preference should persist per-project (not globally)

### Out of Scope
- Changes to the artifact generation backend (Inngest jobs, API routes)
- Changes to artifact content structure or schemas
- Mobile-specific redesign (responsive improvements welcome, but not mobile-first)
- User roles/permissions system (no admin vs. user distinction beyond toggle)
- Changes to the project dashboard or corpus management pages

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `developer-guides/08-teaching-pipeline-guide.md` | Documents artifact generation flow and dependencies between artifact types |
| `.claude/CLAUDE.md` | Comprehensive system docs including Teaching Artifact Viewer section with view modes, renderers, TOC patterns |
| `components/artifacts/TeachingArtifactsContent.tsx` | Landing page container managing state for sidebar, detail panel, polling |
| `components/artifacts/ArtifactDetailPanel.tsx` | Has existing `advancedMode` toggle pattern we should extend |
| `components/artifacts/ArtifactViewerWithVersions.tsx` | Full viewer with header, view modes, version selection |
| `components/artifacts/ArtifactHeader.tsx` | Contains version dropdown, badges, view mode toggle, regenerate button |
| `components/artifacts/TeachingArtifactNav.tsx` | Left sidebar navigation (SIDEBAR #1 - source of duplication) |
| `components/artifacts/TableOfContents.tsx` | Document outline sidebar (SIDEBAR #2 - source of duplication) |
| `components/artifacts/renderers/TypeSpecificRenderer.tsx` | Routes to correct renderer, includes TOC in rendered view |
| `app/projects/[id]/artifacts/teaching/layout.tsx` | Layout that always renders TeachingArtifactNav |

---

## 3) Codebase Map

### Primary Components/Modules

| Component | Path | Role |
|-----------|------|------|
| **TeachingArtifactsContent** | `components/artifacts/TeachingArtifactsContent.tsx` | Landing page orchestrator |
| **ArtifactDetailPanel** | `components/artifacts/ArtifactDetailPanel.tsx` | Generation controls + status |
| **ArtifactViewerWithVersions** | `components/artifacts/ArtifactViewerWithVersions.tsx` | Full artifact viewer |
| **ArtifactHeader** | `components/artifacts/ArtifactHeader.tsx` | Metadata + controls bar |
| **TeachingArtifactNav** | `components/artifacts/TeachingArtifactNav.tsx` | Type navigation sidebar |
| **TableOfContents** | `components/artifacts/TableOfContents.tsx` | Document outline |
| **TypeSpecificRenderer** | `components/artifacts/renderers/TypeSpecificRenderer.tsx` | Content renderer router |
| **EmptyStateGuidance** | `components/artifacts/EmptyStateGuidance.tsx` | First-time generation UI |

### Shared Dependencies

| Type | Items |
|------|-------|
| **UI Components** | `@/components/ui/button`, `card`, `badge`, `switch`, `sheet` (shadcn/ui) |
| **Hooks** | `useDebugLogs`, `useActiveSection` (scroll tracking) |
| **Types** | `ArtifactSummariesResponse`, `PromptInfo`, `SubTaskProgress` |
| **Constants** | `ARTIFACT_TYPE_CONFIG`, `getArtifactTypeFromSlug` |
| **API Client** | `lib/teaching/artifactClient.ts` |

### Data Flow

```
TeachingArtifactsContent (state: selectedType, generating, advancedMode)
  └─► ArtifactDetailPanel (generation controls)
      └─► POST /api/projects/{id}/guru/{type}
          └─► Inngest job → artifact creation
              └─► Polling via GET /api/projects/{id}/guru/artifacts

ArtifactViewerWithVersions (state: viewMode, version)
  └─► fetchArtifactPageData (server) → artifact + versions + promptInfo
      └─► TypeSpecificRenderer → MentalModelRenderer | CurriculumRenderer | DrillRenderer
```

### Feature Flags/Config
- `advancedMode` boolean in `ArtifactDetailPanel` (not persisted currently)
- `process.env.NODE_ENV === 'development'` gates debug terminal

### Potential Blast Radius
- **High:** `app/projects/[id]/artifacts/teaching/` route structure changes
- **Medium:** `components/artifacts/` component consolidation
- **Low:** Existing renderers (no changes needed)
- **None:** Backend API routes, Inngest functions, database schema

---

## 4) Root Cause Analysis

### The Duplicate Sidebar Problem

**Repro Steps:**
1. Navigate to `/projects/{id}/artifacts/teaching`
2. Generate a Mental Model artifact
3. Click "View Full Artifact" button
4. Observe two left sidebars appear

**Observed vs Expected:**
- **Observed:** Two sidebars - TeachingArtifactNav (type selector) + TableOfContents (document outline)
- **Expected:** Single unified sidebar or clearly differentiated navigation

**Evidence:**

From `app/projects/[id]/artifacts/teaching/layout.tsx`:
```tsx
<div className="h-screen flex bg-white dark:bg-background">
  <TeachingArtifactNav projectId={params.id} />  {/* SIDEBAR #1 - ALWAYS renders */}
  <main className="flex-1 overflow-hidden">
    {children}
  </main>
</div>
```

From `components/artifacts/renderers/TypeSpecificRenderer.tsx`:
```tsx
<div className="flex gap-6">
  <TableOfContents items={tocItems} activeId={activeId} className="..." /> {/* SIDEBAR #2 */}
  <div className="flex-1 overflow-auto">
    {/* Content */}
  </div>
</div>
```

**Root Cause:** Layout.tsx unconditionally renders TeachingArtifactNav for ALL child pages, while TypeSpecificRenderer adds its own TableOfContents. When viewing a specific artifact type, both render simultaneously.

### The Complexity Problem

**Current Admin View Elements (Screenshot 1):**
1. Left sidebar #1: TeachingArtifactNav (artifact type selector)
2. Left sidebar #2: TableOfContents (section outline)
3. Header row: Version dropdown + badges + view mode toggle + buttons
4. Badges: "Custom Prompts", "Prompts Changed"
5. View modes: Rendered / Markdown / JSON tabs
6. Checkbox: "Show Diff"
7. Buttons: "View/Edit Prompts", "Regenerate"

**Current Simple View Elements (Screenshot 2):**
1. Left sidebar: ArtifactListSidebar (artifact type list)
2. Center panel: Status card + action buttons
3. Advanced toggle: Already exists but only shows drill config + prompts

**Gap:** No middle ground between "generate only" and "full admin viewer"

---

## 5) Research Findings

### Pattern Analysis

Based on research into Notion, Linear, Figma, Google Docs, and WordPress:

#### Progressive Disclosure (80/20 Rule)
- Show 20% of features initially, reveal 80% on demand
- Use contextual menus, accordions, hover states for advanced features
- **Application:** Default to simple view with one "Generate/Regenerate" button

#### Unified Toolbar-Above-Content
- Generation controls live directly above artifact content (like Google Docs toolbar)
- Contextual toolbars appear on selection
- Eliminates page navigation between generate and view
- **Application:** Sticky header with generation controls, scrollable content below

#### Simple/Advanced Mode Toggle
- Two-level settings approach works well
- Simple mode: Essential controls only (generate button + basic status)
- Advanced mode: Expands accordions for prompt config, version history, verification
- **Application:** Extend existing `advancedMode` toggle, persist per-project

#### URL-Based Tab Navigation
- Visual tabs that update URLs provide best UX
- Each artifact type gets unique shareable URL
- Browser back/forward works naturally
- **Application:** `/artifacts/teaching/mental-model`, `/artifacts/teaching/curriculum`, `/artifacts/teaching/drill-series`

#### Single Collapsible Sidebar
- Consolidate navigation + TOC into one sidebar with sections
- Auto-collapse on smaller screens
- Keyboard shortcut to toggle (e.g., `Cmd+\`)
- **Application:** One sidebar with "Artifacts" section (nav) + "Contents" section (TOC)

### Potential Solutions

#### Solution A: Unified Single-Page with Tabs
**Description:** Replace current two-page flow with a single page per artifact type. URL tabs at top switch between types. Generation controls in sticky header, artifact content scrolls below.

**Pros:**
- Eliminates navigation between pages
- Clear mental model for users
- Deep linkable URLs maintained
- Leverages existing component logic

**Cons:**
- Significant route restructuring
- Need to handle "no artifact" state inline
- May feel cramped on smaller screens

#### Solution B: Collapsible Panel Approach
**Description:** Keep current structure but make advanced features collapse into slide-out panels triggered by icons. Main view stays clean with just content + one "Generate" button.

**Pros:**
- Minimal route changes
- Familiar slide-out pattern (like Notion)
- Features discoverable via icon bar

**Cons:**
- Still two mental models (generate page vs. view page)
- Panel management adds complexity
- Doesn't address duplicate sidebar issue

#### Solution C: Modal-Based Advanced Features
**Description:** All advanced features (version history, prompt editing, verification details, view modes) accessible via modals from a simplified main interface. Main page shows only: tabs + generate button + rendered content.

**Pros:**
- Maximum simplicity for default view
- Modals are familiar pattern
- Easiest to implement incrementally

**Cons:**
- Many clicks to access features
- Modal fatigue for power users
- Context switching between modal and content

### Recommendation

**Solution A: Unified Single-Page with Tabs** is recommended because:

1. **Addresses core user complaint** - eliminates page hopping between generate and view
2. **Leverages existing patterns** - `advancedMode` toggle already exists
3. **Clean URL structure** - `/artifacts/teaching/[type]` with tabs visible
4. **Consolidates sidebars** - Single sidebar with collapsible sections
5. **Progressive disclosure** - Simple by default, advanced on toggle

---

## 6) Proposed Design

### URL Structure
```
/projects/[id]/artifacts/teaching                → Redirects to /mental-model
/projects/[id]/artifacts/teaching/mental-model   → Mental Model page
/projects/[id]/artifacts/teaching/curriculum     → Curriculum page
/projects/[id]/artifacts/teaching/drill-series   → Drill Series page
```

### Page Layout (Simple Mode - Default)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to Project    [Mental Model] [Curriculum] [Drill Series]  ⚙️ │  ← Tab bar + Advanced toggle
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🧠 Mental Model                              [🔄 Regenerate]    │ │  ← Sticky header
│ │ Version 1 • Generated just now • ✓ Completed                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │                                                           │     │
│   │              Rendered Artifact Content                    │     │  ← Scrollable
│   │                                                           │     │
│   │   (Full MentalModelRenderer output)                       │     │
│   │                                                           │     │
│   └───────────────────────────────────────────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Page Layout (Advanced Mode)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to Project    [Mental Model] [Curriculum] [Drill Series] [⚙️]│  ← Advanced toggle ON
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🧠 Mental Model  [v1 ▼]  🏷️ Custom  ⚠️ Prompts Changed         │ │  ← Full header
│ │ [Rendered] [Markdown] [JSON]  ☐ Show Diff  [Edit] [Regenerate]  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├───────────────┬─────────────────────────────────────────────────────┤
│ 📑 Contents   │                                                     │
│ ├── Section 1 │    Rendered Artifact Content                        │  ← TOC sidebar
│ │   └── 1.1   │                                                     │     (Advanced only)
│ ├── Section 2 │    (with scroll tracking)                           │
│ └── Section 3 │                                                     │
└───────────────┴─────────────────────────────────────────────────────┘
```

### State Management

```typescript
interface UnifiedArtifactPageState {
  // URL-derived
  selectedType: 'mental-model' | 'curriculum' | 'drill-series';
  selectedVersion: number | null; // null = latest
  showDiff: boolean;

  // User preferences (persisted per-project)
  advancedMode: boolean;
  viewMode: 'rendered' | 'markdown' | 'json';

  // Generation state
  isGenerating: boolean;
  generationProgress: SubTaskProgress | null;

  // Data
  artifact: GuruArtifact | null;
  versions: ArtifactVersion[];
  promptInfo: PromptInfo;
}
```

### Component Hierarchy

```
UnifiedArtifactPage (new - replaces layout.tsx children handling)
├── ArtifactTabBar (new - horizontal tabs for type selection)
├── ArtifactToolbar (refactored from ArtifactHeader)
│   ├── Simple: Icon + Title + Status + Regenerate button
│   └── Advanced: + Version dropdown + Badges + View modes + Diff toggle
├── GenerationProgress (reuse FullWidthProgressTracker)
├── ArtifactContent
│   ├── Simple: TypeSpecificRenderer (without TOC)
│   └── Advanced: Sidebar(TOC) + TypeSpecificRenderer
└── Modals
    ├── PromptEditorModal (existing)
    └── VerificationDetailsModal (existing)
```

---

## 7) Clarifications Needed

1. **Tab behavior when artifact doesn't exist:** Should clicking "Curriculum" tab when no curriculum exists show:
   - A) Empty state with "Generate Curriculum" button (recommended)
   - B) Disabled tab until prerequisite exists
   - C) Tab with warning that Mental Model is required first
   >> option A

2. **Version history in Advanced Mode:** Should version history be:
   - A) Dropdown in header (current pattern)
   - B) Expandable panel/accordion
   - C) Separate modal for browsing all versions
   >> lets do as little as possible re: changing the advanced view UX — we can optimize that later, the goal right now is to create a clean "simple" view for the 95% of users who wont need to view advanced mode ever, so option A (current pattern)

3. **TOC sidebar visibility:** In Advanced Mode, should TOC sidebar be:
   - A) Always visible for rendered view (current pattern)
   - B) Collapsible via icon button
   - C) Only visible on larger screens (responsive hide)
   >> similar to my answer to #2, option A (leave advanced mode as unchanged as possible)

4. **Persist mode preference:** Should `advancedMode` be stored:
   - A) Per-project in database (recommended - ProjectSettings table)
   - B) Per-user in localStorage
   - C) Per-session only (reset on page refresh)
   >> option C (which is simplest I assume)

5. **Generation notes:** Should the "Generation Notes" textarea be:
   - A) Visible in Simple Mode (always available)
   - B) Hidden until Advanced Mode is enabled
   - C) Accessible via expandable section ("Add notes...")
   >> option C

6. **Empty state handling:** When no artifacts exist, should the page show:
   - A) EmptyStateGuidance component (existing) with step-by-step flow
   - B) Simplified "Generate Mental Model" single button
   - C) Both: simplified button by default, full guidance in Advanced Mode
   >> C sounds fine

---

## 8) Implementation Phases (Preliminary)

### Phase 1: Route Restructuring
- Remove TeachingArtifactNav from layout.tsx
- Create new tab-based navigation component
- Update routes to handle unified page pattern
- Redirect `/artifacts/teaching` → `/artifacts/teaching/mental-model`

### Phase 2: Component Consolidation
- Create `UnifiedArtifactPage` combining generation + viewing
- Refactor `ArtifactHeader` into `ArtifactToolbar` with simple/advanced modes
- Extract TOC into conditionally-rendered sidebar

### Phase 3: State Management
- Implement `advancedMode` persistence (per-project)
- Handle generation-in-progress state inline
- Preserve URL params for version/diff selection

### Phase 4: Polish
- Animation for mode transitions
- Responsive behavior for TOC sidebar
- Keyboard shortcuts (toggle advanced mode, sidebar collapse)
- E2E test updates

---

## 9) Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing deep links | Medium | High | Implement redirects from old URLs |
| Regression in generation flow | Low | High | Reuse existing EmptyStateGuidance + progress components |
| Performance with large artifacts | Low | Medium | Maintain current virtualization patterns |
| User confusion during transition | Medium | Medium | Consider feature flag for gradual rollout |

---

## 10) Success Metrics

1. **Reduced navigation:** Users should not need to click "View Full Artifact" → content visible immediately
2. **Simplified default view:** < 5 interactive elements visible in Simple Mode
3. **Feature discoverability:** All current features accessible within 2 clicks from Advanced Mode
4. **No functionality loss:** All existing features remain available
5. **URL stability:** All artifact URLs remain shareable and bookmarkable
