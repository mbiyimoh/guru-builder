# Decouple Ground Truth from Assessments & Simplify Version UI

**Slug:** decouple-ground-truth-simplify-version-ui
**Author:** Claude Code
**Date:** 2025-12-12
**Branch:** preflight/decouple-ground-truth-simplify-version-ui
**Related:** `specs/feat-ground-truth-content-validation/`, `specs/feat-self-assessment-system.md`

---

## 1) Intent & Assumptions

**Task brief:**
Two related UX improvements: (1) Decouple Ground Truth content validation from the Assessment system so users can add ground truth engines directly from the project dashboard, independent of self-assessments. Users should be able to clearly see available engines (e.g., "GNU Backgammon") and verify that generated content is "ground truth verified". (2) Replace the artifact version sidebar panel with a compact dropdown in the header to reclaim screen space, since two other panels (artifacts list and document outline) already exist.

**Assumptions:**
- Ground Truth and Assessments serve fundamentally different purposes (content accuracy vs. learner self-testing)
- Users shouldn't need to create/enable an assessment just to get ground truth validation
- A catalog of available "Ground Truth Engines" should be browsable and selectable
- The current 3-panel artifact layout wastes space; 2 panels + header dropdown is sufficient
- Users rarely need to see all version history at once - dropdown is adequate
- Existing assessment-based ground truth configs should be migrated or supported during transition

**Out of scope:**
- Removing the assessment system entirely (it's still needed for self-testing)
- Adding new ground truth engines beyond what's currently supported
- Changing how the actual verification/tool calling works (engine integration stays the same)
- Mobile-specific layouts (focus on desktop first)

---

## 2) Pre-reading Log

- `lib/groundTruth/config.ts`: Central coupling point - `resolveGroundTruthConfig()` queries `ProjectAssessment.useForContentValidation` and `AssessmentDefinition.canValidateContent/engineUrl`
- `prisma/schema.prisma`: Ground truth config embedded in assessment models; no standalone GT table exists
- `components/ground-truth/EngineHealthStatus.tsx`: Already renders independently on project page (lines 137-141 in page.tsx)
- `components/project/ContentValidationToggle.tsx`: Orphaned component - defined but never used in UI
- `components/artifacts/VersionHistoryPanel.tsx`: 192px sidebar (w-48) showing version list
- `components/artifacts/ArtifactHeader.tsx`: Version badge at lines 105-107 - simple `v{version}` display, no dropdown
- `app/projects/[id]/page.tsx`: Shows Ground Truth Engine Status section separately from Assessments (good separation point)

---

## 3) Codebase Map

### Primary Components/Modules

| Component | Path | Role |
|-----------|------|------|
| `resolveGroundTruthConfig()` | `lib/groundTruth/config.ts:24-55` | **KEY COUPLING** - resolves GT config from assessments |
| `EngineHealthStatus` | `components/ground-truth/EngineHealthStatus.tsx` | Displays engine online/offline status |
| `ContentValidationToggle` | `components/project/ContentValidationToggle.tsx` | Orphaned toggle for assessment-based GT |
| `ProjectAssessmentManager` | `components/assessment/ProjectAssessmentManager.tsx` | Assessment cards UI |
| `VersionHistoryPanel` | `components/artifacts/VersionHistoryPanel.tsx` | 192px version sidebar |
| `ArtifactHeader` | `components/artifacts/ArtifactHeader.tsx` | Header with version badge (lines 105-107) |
| `ArtifactViewerWithVersions` | `components/artifacts/ArtifactViewerWithVersions.tsx` | 3-panel layout orchestrator |

### Shared Dependencies
- `prisma/schema.prisma` - Database models
- `lib/teaching/artifactClient.ts` - `ArtifactSummary` type for versions
- `@/lib/utils` - `cn()` utility for classNames

### Data Flow

**Ground Truth (Current):**
```
Project → ProjectAssessment (useForContentValidation=true)
       → AssessmentDefinition (canValidateContent=true, engineUrl)
       → resolveGroundTruthConfig()
       → Generation uses tools if enabled
```

**Version Selection (Current):**
```
URL ?v=N → VersionHistoryPanel reads currentVersion
         → Button click → router.push(?v=M)
         → Page re-renders with different version
```

### Potential Blast Radius

**Ground Truth Decoupling:**
- `lib/groundTruth/config.ts` - Must change resolver
- `lib/inngest-functions.ts` - Calls resolver (no changes needed if signature same)
- `prisma/schema.prisma` - New model, migration
- `app/api/projects/[id]/ground-truth/*` - New/modified endpoints
- `app/projects/[id]/page.tsx` - Replace EngineHealthStatus section with new UI
- `components/project/ContentValidationToggle.tsx` - Delete or repurpose

**Version UI:**
- `components/artifacts/ArtifactHeader.tsx` - Add dropdown
- `components/artifacts/ArtifactViewerWithVersions.tsx` - Remove VersionHistoryPanel
- `components/artifacts/VersionHistoryPanel.tsx` - Delete or hide
- All artifact pages (`mental-model/page.tsx`, etc.) - Pass versions to header

---

## 4) Root Cause Analysis

*N/A - This is a feature refactoring, not a bug fix.*

---

## 5) Research

### Part A: Ground Truth Decoupling

#### Option 1: Standalone GroundTruthEngine Model (Recommended)

**Approach:** Create a new Prisma model that directly links projects to ground truth engines, bypassing the assessment system entirely.

```prisma
model GroundTruthEngine {
  id          String @id @default(cuid())
  name        String       // "GNU Backgammon"
  domain      String       // "backgammon"
  engineUrl   String       // MCP server URL
  description String?
  iconUrl     String?      // For UI display
  isActive    Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projectConfigs ProjectGroundTruthConfig[]
}

model ProjectGroundTruthConfig {
  id        String @id @default(cuid())
  projectId String
  engineId  String
  isEnabled Boolean @default(true)

  createdAt DateTime @default(now())

  project Project           @relation(...)
  engine  GroundTruthEngine @relation(...)

  @@unique([projectId, engineId])
}
```

**Pros:**
- Clean separation from assessments
- Clear user mental model: "Add Ground Truth Engine to Project"
- Engine catalog can grow independently
- Simple `resolveGroundTruthConfig()` implementation
- Assessment system untouched

**Cons:**
- Database migration required
- Need to seed initial engine(s)
- Migration path for existing assessment-based configs

#### Option 2: Hybrid - Keep Assessment Coupling, Add Direct Option

**Approach:** Keep current assessment-based config but also allow direct engine selection.

**Pros:**
- No breaking changes
- Gradual migration possible

**Cons:**
- Two paths to same feature = confusing UX
- More complex `resolveGroundTruthConfig()` logic
- Technical debt

#### Option 3: Refactor AssessmentDefinition to be Engine-First

**Approach:** Rename/repurpose `AssessmentDefinition` to be more generic "Engine" concept.

**Pros:**
- Uses existing infrastructure

**Cons:**
- Confuses assessment vs. ground truth purposes
- Couples unrelated features
- Not addressing the core problem

**Recommendation:** Option 1 - Standalone model. It's the cleanest separation and matches the user's mental model.

---

### Part B: Version UI Simplification

#### Option 1: Header Dropdown (Recommended)

**Approach:** Replace the version badge in `ArtifactHeader.tsx` with a dropdown selector.

```tsx
// Before (line 105-107)
<span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 ...">
  v{artifact.version}
</span>

// After
<VersionDropdown
  versions={versions}
  currentVersion={artifact.version}
  onVersionSelect={(v) => router.push(`?v=${v}`)}
/>
```

**Implementation:**
1. Create `VersionDropdown` component using shadcn/ui `DropdownMenu`
2. Pass `versions` array to `ArtifactHeader`
3. Remove `VersionHistoryPanel` from `ArtifactViewerWithVersions`
4. Reclaim 192px for content area

**Pros:**
- Reclaims 192px horizontal space
- Cleaner 2-panel layout
- Common UX pattern (GitHub, Figma, etc.)
- Mobile-friendly

**Cons:**
- Less visible version history (requires click to see all)
- Loses at-a-glance date/hash info (can add to dropdown items)

#### Option 2: Collapsible Sidebar

**Approach:** Keep `VersionHistoryPanel` but make it collapsible.

**Pros:**
- Best of both worlds
- No information loss

**Cons:**
- More complex UI
- Still takes space when expanded
- Another toggle to manage

#### Option 3: Bottom Panel

**Approach:** Move version history to a horizontal panel below content.

**Pros:**
- More horizontal space for version info

**Cons:**
- Unusual pattern
- Takes vertical space
- Harder to scan

**Recommendation:** Option 1 - Header dropdown. Matches user request and common patterns.

---

## 6) Clarification (Resolved)

| Question | Decision |
|----------|----------|
| **Engine Catalog Source** | Admin-seeded only - fixed catalog of verified engines |
| **Migration Strategy** | Leave existing assessment system alone - build standalone system |
| **UI Location** | Near Teaching Pipeline (grouped with artifact generation controls) |
| **Version Dropdown Detail** | Medium: Version + date (e.g., "v2 - Dec 10, 2025") |
| **"Latest" Behavior** | Default behavior - stay on current version |

---

## 7) Proposed Solution Summary

### Ground Truth Decoupling

1. **New Models:** `GroundTruthEngine` (catalog) + `ProjectGroundTruthConfig` (per-project)
2. **Seed Data:** Create "GNU Backgammon" engine with existing Heroku URL
3. **New API:** `POST/DELETE /api/projects/[id]/ground-truth-engine`
4. **New UI:** `GroundTruthEngineSelector` component replacing assessment-based toggle
5. **Update:** `resolveGroundTruthConfig()` to query new model
6. **Cleanup:** Delete orphaned `ContentValidationToggle.tsx`

### Version UI

1. **New Component:** `VersionDropdown` (shadcn DropdownMenu)
2. **Modify:** `ArtifactHeader` to accept `versions` prop and render dropdown
3. **Remove:** `VersionHistoryPanel` from layout
4. **Update:** `ArtifactViewerWithVersions` to 2-panel layout

### Files to Change

| File | Action | Reason |
|------|--------|--------|
| `prisma/schema.prisma` | Add 2 models | New GT data structure |
| `lib/groundTruth/config.ts` | Rewrite resolver | Query new model |
| `app/api/projects/[id]/ground-truth-engine/route.ts` | Create | CRUD endpoints |
| `components/ground-truth/GroundTruthEngineSelector.tsx` | Create | New UI |
| `app/projects/[id]/page.tsx` | Modify | Replace GT section |
| `components/project/ContentValidationToggle.tsx` | Delete | No longer needed |
| `components/artifacts/VersionDropdown.tsx` | Create | New dropdown |
| `components/artifacts/ArtifactHeader.tsx` | Modify | Add dropdown |
| `components/artifacts/ArtifactViewerWithVersions.tsx` | Modify | Remove sidebar |
| `components/artifacts/VersionHistoryPanel.tsx` | Delete | Replaced by dropdown |

---

## 8) Next Steps

1. User answers clarification questions
2. Create `02-specification.md` with detailed technical spec
3. Create `03-tasks.md` with implementation breakdown
4. Implement in phases:
   - Phase 1: Database models + migration
   - Phase 2: Ground Truth UI
   - Phase 3: Version dropdown
   - Phase 4: Cleanup + testing
