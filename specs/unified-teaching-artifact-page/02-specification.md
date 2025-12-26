# Unified Teaching Artifact Page - Specification

**Slug:** unified-teaching-artifact-page
**Author:** Claude Code
**Date:** 2025-12-23
**Status:** Ready for Implementation
**Ideation:** `specs/unified-teaching-artifact-page/01-ideation.md`

---

## 1) Overview

### Goal
Combine artifact generation and viewing into a single page per artifact type, with a clean "Simple Mode" default for non-technical users and an "Advanced Mode" toggle that reveals the full feature set.

### Design Decisions (from ideation clarifications)
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tab behavior (no artifact) | Empty state + Generate button | Keeps all tabs accessible |
| Version history | Dropdown in header (unchanged) | Minimize Advanced Mode changes |
| TOC sidebar | Always visible in Advanced (unchanged) | Minimize Advanced Mode changes |
| Mode persistence | Session only (state, no storage) | Simplest implementation |
| Generation notes | Expandable "Add notes..." section | Clean default, accessible when needed |
| Empty state | Simplified button (Simple) / Full guidance (Advanced) | Best of both worlds |

---

## 2) URL Structure

### Routes
```
/projects/[id]/artifacts/teaching                 → Redirect to /mental-model
/projects/[id]/artifacts/teaching/mental-model    → Mental Model unified page
/projects/[id]/artifacts/teaching/curriculum      → Curriculum unified page
/projects/[id]/artifacts/teaching/drill-series    → Drill Series unified page
```

### Query Parameters (Advanced Mode only)
| Param | Type | Description |
|-------|------|-------------|
| `v` | number | Version to display (default: latest) |
| `diff` | boolean | Show diff view against previous version |

---

## 3) Page Layout

### Simple Mode (Default)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back to Project                                            [Advanced] │
├─────────────────────────────────────────────────────────────────────────┤
│  [🧠 Mental Model]  [📚 Curriculum]  [🎯 Drill Series]                  │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  🧠 Mental Model                                                    │ │
│ │  Version 1 • Generated Dec 23, 2025 • ✓ Completed   [🔄 Regenerate] │ │
│ │                                                                     │ │
│ │  ▸ Add generation notes...                                          │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    [Rendered Artifact Content]                          │
│                                                                         │
│                    - No sidebars                                        │
│                    - Full width content                                 │
│                    - Clean reading experience                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Simple Mode - No Artifact State

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back to Project                                            [Advanced] │
├─────────────────────────────────────────────────────────────────────────┤
│  [🧠 Mental Model]  [📚 Curriculum]  [🎯 Drill Series]                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         🧠 Mental Model                                 │
│                                                                         │
│                    No mental model generated yet.                       │
│                                                                         │
│                      [✨ Generate Mental Model]                         │
│                                                                         │
│                    ▸ Add generation notes...                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Simple Mode - Generation In Progress

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back to Project                                            [Advanced] │
├─────────────────────────────────────────────────────────────────────────┤
│  [🧠 Mental Model]  [📚 Curriculum]  [🎯 Drill Series]                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ┌─────────────────────────────┐                      │
│                    │   FullWidthProgressTracker  │                      │
│                    │                             │                      │
│                    │   ● Composing corpus...     │                      │
│                    │   ○ Analyzing structure     │                      │
│                    │   ○ Extracting principles   │                      │
│                    │   ○ Building framework      │                      │
│                    │   ○ Saving artifact         │                      │
│                    └─────────────────────────────┘                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Advanced Mode

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back to Project                                         [✓ Advanced] │
├─────────────────────────────────────────────────────────────────────────┤
│  [🧠 Mental Model]  [📚 Curriculum]  [🎯 Drill Series]                  │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🧠 Mental Model  [v1 ▼]  🏷️Custom  ⚠️Prompts Changed               │ │
│ │                                                                     │ │
│ │ [Rendered] [Markdown] [JSON]  ☐ Show Diff  [✏️ Edit] [🔄 Regenerate]│ │
│ │                                                                     │ │
│ │ ▾ Generation notes                                                  │ │
│ │ ┌───────────────────────────────────────────────────────────────┐   │ │
│ │ │ Optional notes to guide generation...                         │   │ │
│ │ └───────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├───────────────┬─────────────────────────────────────────────────────────┤
│ 📑 Contents   │                                                         │
│               │                                                         │
│ ├── Sect 1    │        [Rendered Artifact Content]                      │
│ │   └── 1.1   │                                                         │
│ ├── Sect 2    │        - With TOC sidebar                               │
│ │   └── 2.1   │        - Scroll tracking active                         │
│ └── Sect 3    │        - All current features                           │
│               │                                                         │
└───────────────┴─────────────────────────────────────────────────────────┘
```

### Advanced Mode - No Artifact (Full Guidance)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Back to Project                                         [✓ Advanced] │
├─────────────────────────────────────────────────────────────────────────┤
│  [🧠 Mental Model]  [📚 Curriculum]  [🎯 Drill Series]                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│              ┌──────────────────────────────────────────┐               │
│              │      ✨ Create Your Teaching Artifacts   │               │
│              │                                          │               │
│              │  ┌────────────────────────────────────┐  │               │
│              │  │ 1. 🧠 Mental Model        [Generate]│  │               │
│              │  │    Core concepts...                │  │               │
│              │  └────────────────────────────────────┘  │               │
│              │  ┌────────────────────────────────────┐  │               │
│              │  │ 2. 📚 Curriculum   (requires MM)   │  │               │
│              │  │    Structured path...              │  │               │
│              │  └────────────────────────────────────┘  │               │
│              │  ┌────────────────────────────────────┐  │               │
│              │  │ 3. 🎯 Drill Series (requires Curr) │  │               │
│              │  │    Practice exercises...           │  │               │
│              │  └────────────────────────────────────┘  │               │
│              └──────────────────────────────────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4) Component Architecture

### New Components

#### `UnifiedArtifactPage`
**Location:** `components/artifacts/UnifiedArtifactPage.tsx`
**Purpose:** Main container component for the unified artifact experience

```typescript
interface UnifiedArtifactPageProps {
  projectId: string;
  artifactType: 'mental-model' | 'curriculum' | 'drill-series';
  initialArtifact: GuruArtifact | null;
  initialVersions: ArtifactVersion[];
  initialPromptInfo: PromptInfo;
  allArtifactsSummary: ArtifactSummariesResponse;
}

// State
interface UnifiedArtifactPageState {
  advancedMode: boolean;
  viewMode: 'rendered' | 'markdown' | 'json';
  isGenerating: boolean;
  generationProgress: SubTaskProgress | null;
  userNotes: string;
  notesExpanded: boolean;
  artifact: GuruArtifact | null;
}
```

#### `ArtifactTabBar`
**Location:** `components/artifacts/ArtifactTabBar.tsx`
**Purpose:** Horizontal tab navigation between artifact types

```typescript
interface ArtifactTabBarProps {
  projectId: string;
  activeType: 'mental-model' | 'curriculum' | 'drill-series';
  artifactsSummary: ArtifactSummariesResponse;
}
```

**Behavior:**
- Visual tabs with icons: 🧠 Mental Model, 📚 Curriculum, 🎯 Drill Series
- Active tab highlighted with underline/background
- Shows version badge (e.g., "v1") if artifact exists
- Shows "Not Generated" badge if no artifact
- Click navigates via Next.js router (not full page reload)

#### `SimpleToolbar`
**Location:** `components/artifacts/SimpleToolbar.tsx`
**Purpose:** Minimal controls for Simple Mode

```typescript
interface SimpleToolbarProps {
  artifactType: 'mental-model' | 'curriculum' | 'drill-series';
  artifact: GuruArtifact | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
  notesExpanded: boolean;
  onNotesExpandedChange: (expanded: boolean) => void;
}
```

**Elements:**
- Icon + Title (e.g., "🧠 Mental Model")
- Status line: "Version X • Generated [date] • [status]"
- Regenerate button (if artifact exists)
- Generate button (if no artifact)
- Collapsible "Add generation notes..." section

#### `ExpandableNotes`
**Location:** `components/artifacts/ExpandableNotes.tsx`
**Purpose:** Collapsible generation notes textarea

```typescript
interface ExpandableNotesProps {
  value: string;
  onChange: (value: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  disabled?: boolean;
}
```

**Behavior:**
- Collapsed: Shows "▸ Add generation notes..." clickable text
- Expanded: Shows "▾ Generation notes" header + textarea
- Textarea has placeholder "Optional notes to guide generation..."

### Modified Components

#### `layout.tsx` Changes
**File:** `app/projects/[id]/artifacts/teaching/layout.tsx`

**Before:**
```tsx
<div className="h-screen flex bg-white dark:bg-background">
  <TeachingArtifactNav projectId={params.id} />
  <main className="flex-1 overflow-hidden">
    {children}
  </main>
</div>
```

**After:**
```tsx
<div className="h-screen flex flex-col bg-white dark:bg-background">
  <TeachingPageHeader projectId={params.id} />
  <main className="flex-1 overflow-hidden">
    {children}
  </main>
</div>
```

#### `TeachingPageHeader` (New)
**Location:** `components/artifacts/TeachingPageHeader.tsx`
**Purpose:** Top header with back button and advanced toggle

```typescript
interface TeachingPageHeaderProps {
  projectId: string;
}
```

**Elements:**
- "← Back to Project" link (left)
- "Advanced" toggle switch (right)

**Note:** Advanced mode state is lifted to UnifiedArtifactPage and passed via context or URL.

### Removed/Deprecated Components

| Component | Status | Reason |
|-----------|--------|--------|
| `TeachingArtifactNav` | Remove from layout | Replaced by ArtifactTabBar |
| `TeachingArtifactsContent` | Deprecate | Replaced by UnifiedArtifactPage |
| `ArtifactDetailPanel` | Refactor into SimpleToolbar | Functionality absorbed |
| `ArtifactListSidebar` | Remove | No longer needed |

---

## 5) Data Flow

### Page Load Flow

```
[Browser] → GET /projects/[id]/artifacts/teaching/mental-model
           ↓
[Server] app/projects/[id]/artifacts/teaching/[type]/page.tsx
           ↓
         fetchUnifiedPageData(projectId, type)
           ├── getArtifactSummaries(projectId)      → All artifacts summary
           ├── getArtifactWithVersions(type)        → Current artifact + versions
           └── getPromptInfo(type)                  → Prompt config + drift
           ↓
[Client] <UnifiedArtifactPage {...serverData} />
           ↓
         Render based on:
           - advancedMode (state)
           - artifact exists?
           - isGenerating?
```

### Generation Flow

```
[User] Clicks "Generate" or "Regenerate"
         ↓
[Client] handleGenerate()
           ├── setIsGenerating(true)
           ├── POST /api/projects/{id}/guru/{type}
           │     body: { userNotes }
           ↓
[Server] Creates artifact with status: GENERATING
         Sends Inngest event
         Returns { artifactId, version }
           ↓
[Client] Start polling /api/projects/{id}/guru/artifacts
         Every 3 seconds until:
           - status === 'COMPLETED' AND corpusHash exists  ← CRITICAL: Race condition check
           - OR status === 'FAILED'
           ↓
         setIsGenerating(false)
         Update artifact state
```

**Race Condition Handling:** The `corpusHash` check is critical. The Inngest job may mark
the artifact as COMPLETED before the content is fully saved. Polling must wait for BOTH
`status === 'COMPLETED'` AND `corpusHash` to exist before stopping. This pattern is
already implemented in `TeachingArtifactsContent.tsx:65-72`.

### Mode Toggle Flow

```
[User] Toggles "Advanced" switch
         ↓
[Client] setAdvancedMode(!advancedMode)
           ↓
         Re-render with:
           - Simple: SimpleToolbar + full-width content
           - Advanced: ArtifactHeader + TOC sidebar + content
```

---

## 6) State Management

### Component State (UnifiedArtifactPage)

```typescript
const [advancedMode, setAdvancedMode] = useState(false);
const [viewMode, setViewMode] = useState<ViewMode>('rendered');
const [isGenerating, setIsGenerating] = useState(false);
const [generationProgress, setGenerationProgress] = useState<SubTaskProgress | null>(null);
const [userNotes, setUserNotes] = useState('');
const [notesExpanded, setNotesExpanded] = useState(false);
const [artifact, setArtifact] = useState<GuruArtifact | null>(initialArtifact);
```

### URL State (Advanced Mode only)

| State | URL Param | Default |
|-------|-----------|---------|
| Version | `?v=2` | Latest |
| Diff mode | `?diff=true` | false |

### Context (Optional)

If Advanced Mode state needs to persist across tab navigation within a session:

```typescript
// contexts/ArtifactViewContext.tsx
interface ArtifactViewContextValue {
  advancedMode: boolean;
  setAdvancedMode: (mode: boolean) => void;
}
```

---

## 7) API Changes

### No Backend Changes Required

All existing API routes remain unchanged:
- `GET /api/projects/[id]/guru/artifacts` - Fetch all artifact summaries
- `GET /api/projects/[id]/guru/[type]` - Fetch specific artifact
- `POST /api/projects/[id]/guru/[type]` - Trigger generation
- `GET /api/projects/[id]/guru/prompts` - Fetch prompt configs

---

## 8) File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `components/artifacts/UnifiedArtifactPage.tsx` | Main unified page component |
| `components/artifacts/ArtifactTabBar.tsx` | Tab navigation |
| `components/artifacts/SimpleToolbar.tsx` | Simple mode controls |
| `components/artifacts/ExpandableNotes.tsx` | Collapsible notes |
| `components/artifacts/TeachingPageHeader.tsx` | Top header with back + toggle |

### Modified Files

| File | Changes |
|------|---------|
| `app/projects/[id]/artifacts/teaching/layout.tsx` | Remove TeachingArtifactNav, add TeachingPageHeader |
| `app/projects/[id]/artifacts/teaching/page.tsx` | Redirect to /mental-model |
| `app/projects/[id]/artifacts/teaching/[type]/page.tsx` | Use UnifiedArtifactPage |
| `components/artifacts/renderers/TypeSpecificRenderer.tsx` | Make TOC sidebar conditional on `showTOC` prop |

### Deprecated Files (Keep but mark deprecated)

| File | Note |
|------|------|
| `components/artifacts/TeachingArtifactsContent.tsx` | Replaced by UnifiedArtifactPage |
| `components/artifacts/ArtifactDetailPanel.tsx` | Functionality moved to SimpleToolbar |
| `components/artifacts/ArtifactListSidebar.tsx` | No longer needed |
| `components/artifacts/TeachingArtifactNav.tsx` | Replaced by ArtifactTabBar |

---

## 9) Implementation Tasks

### Phase 1: Foundation (Route + Layout)

1. **Create TeachingPageHeader component**
   - Back to project link
   - Advanced mode toggle (receives state via props)

2. **Update layout.tsx**
   - Remove TeachingArtifactNav
   - Add TeachingPageHeader
   - Pass advancedMode state down (or use context)

3. **Update /teaching/page.tsx**
   - Add redirect to /teaching/mental-model

4. **Create ArtifactTabBar component**
   - Three tabs with icons
   - Active state styling
   - Badge for version / "Not Generated"
   - Next.js Link navigation

### Phase 2: Simple Mode Components

5. **Create ExpandableNotes component**
   - Collapsed/expanded states
   - Textarea with placeholder

6. **Create SimpleToolbar component**
   - Icon + Title
   - Status line
   - Generate/Regenerate button
   - ExpandableNotes integration

7. **Create UnifiedArtifactPage component**
   - State management
   - Conditional rendering (Simple vs Advanced)
   - Generation handling
   - Polling logic

### Phase 3: Integration

8. **Update [type]/page.tsx**
   - Fetch unified page data
   - Render UnifiedArtifactPage

9. **Update TypeSpecificRenderer**
   - Add `showTOC` prop
   - Conditionally render TableOfContents
   - Note: Drill Series uses phase-organized schema (`phases[].principleGroups[].drills[]`)

10. **Wire up Advanced Mode**
    - Reuse existing ArtifactHeader
    - Reuse existing ArtifactViewerWithVersions logic
    - Connect view mode, version, diff controls

### Phase 4: Polish

11. **Empty state handling**
    - Simple: Single generate button
    - Advanced: Full EmptyStateGuidance

12. **Generation progress**
    - Show FullWidthProgressTracker inline

13. **Testing**
    - Update E2E tests
    - Manual QA all states

---

## 10) Acceptance Criteria

### Simple Mode (Default)
- [ ] Page loads in Simple Mode by default
- [ ] Only visible controls: title, status, regenerate button, expandable notes
- [ ] Artifact content renders full-width (no sidebars)
- [ ] Tab navigation works between artifact types
- [ ] Generate button appears when no artifact exists
- [ ] Generation progress shows inline

### Advanced Mode
- [ ] Toggle reveals full feature set
- [ ] Version dropdown, badges, view modes all visible
- [ ] TOC sidebar appears for rendered view
- [ ] Show Diff checkbox works
- [ ] Edit Prompts button opens modal
- [ ] All existing features work unchanged

### Navigation
- [ ] `/teaching` redirects to `/teaching/mental-model`
- [ ] Tabs navigate without full page reload
- [ ] Back to Project link works
- [ ] URL params preserved when relevant (?v, ?diff)

### States
- [ ] No artifact: Shows appropriate empty state per mode
- [ ] Generating: Shows progress tracker
- [ ] Completed: Shows artifact content
- [ ] Failed: Shows error state with retry option

### Error States
- [ ] Network error during generation: Show "Generation failed. Please try again." with Retry button
- [ ] API error (4xx/5xx): Display error message from response
- [ ] Timeout: Show timeout message with Retry button
- [ ] All error states allow regeneration without page refresh

---

## 11) Testing Strategy

### Unit Tests
- `SimpleToolbar` renders correct controls based on artifact state
- `ExpandableNotes` toggles correctly
- `ArtifactTabBar` shows correct badges

### Integration Tests
- Mode toggle switches UI correctly
- Generation flow works end-to-end
- Tab navigation preserves state appropriately

### E2E Tests (Playwright)
```typescript
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
```

---

## 12) Migration Notes

### Backward Compatibility
- Old URLs (`/artifacts/teaching`) redirect to new structure
- All existing deep links to `/teaching/[type]` continue to work
- No database changes required

### Rollback Plan
- Feature can be rolled back by reverting layout.tsx changes
- Old components remain in codebase (deprecated, not deleted)
