# Task Breakdown: Phase-Organized Drill Library (Lean Approach)

**Generated:** 2025-12-16
**Source:** specs/phase-organized-drill-library/02-specification.md
**Feature Slug:** phase-organized-drill-library
**Last Updated:** 2025-12-16 (Revised to lean approach)

## Overview

Restructure drill series AND curriculum systems to organize content hierarchically by game phase with nested principles.

**Completed (Phases 1, 2, 2.5):**
- Post-generation drill count validation with retry logic
- Hierarchical schema: Phase → Principle → Drills
- Aligned curriculum schema: Phase → Principle → Lessons
- Dual-tagging system: Every drill tagged with primary (phase-specific) + universal principles
- Bug fixes: TPM rate limit, schema migration, options format

**Remaining (Lean Scope - Phase 3 + E2E Tests):**
- Position attribution linking drills to Position Library entries
- E2E tests for new drill viewer

**Deferred (Phase 4 - Drill Library Management):**
- Replace vs Add toggle for incremental library building
- Individual drill deletion capability
- Normalized Drill model in database

---

## Completed Phases

### Phase 1: Drill Count Enforcement ✅ COMPLETE

- ✅ Task 1.1: Add validateDrillOutput Function
- ✅ Task 1.2: Add buildRetryFeedback Function
- ✅ Task 1.3: Update generateDrillSeries with Retry Loop
- ✅ Task 1.4: Add Validation Warning to Artifact Metadata
- ✅ Task 1.5: Update Progress Tracking for Validation Phase
- ✅ Task 1.6: Unit Tests for Drill Count Validation

### Phase 2: Phase-Organized Schema ✅ COMPLETE

- ✅ Task 2.1: Create Backgammon Principles Constants
- ✅ Task 2.2: Create Hierarchical Phase-Organized Drill Schema
- ✅ Task 2.3: Update Prompt Builder with Principle Injection
- ✅ Task 2.4: Create PhaseOrganizedDrillRenderer Component
- ✅ Task 2.5: Update Artifact Viewer to Use New Renderer
- ✅ Task 2.6: Unit Tests for Backgammon Principles

### Phase 2.5: Curriculum Schema Alignment ✅ COMPLETE

- ✅ Task 2.5.1: Create Aligned Curriculum Schema
- ✅ Task 2.5.2: Update Curriculum Generator Prompt
- ✅ Task 2.5.3: Update Curriculum Renderer Component
- ✅ Task 2.5.4: Create Curriculum Migration Script

### Bug Fixes (Session 2) ✅ COMPLETE

- ✅ Fixed TPM rate limit (429 error) - Compacted prompts from ~30K to ~18-22K tokens
- ✅ Fixed schema migration in drillDesigner.ts - Now uses phaseOrganizedDrillSeriesSchema
- ✅ Fixed schema migration in claimExtraction.ts - Updated traversal for new structure
- ✅ Fixed test fixtures in unit-claim-extraction.spec.ts - Uses new schema format
- ✅ Fixed options format in prompt - Now shows explicit `{id, text, isCorrect}` structure

---

## Phase 3: Position Attribution (Lean Scope)

**Goal:** Show position context (ASCII board, match info, archive source) in drill viewer when drills reference positions from the Position Library.

### Task 3.1: Extend SeededPositionWithContext Type

**Description:** Add match metadata to seeded position type
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 3.5

**File:** `lib/positionLibrary/types.ts`

**Implementation:**

```typescript
/**
 * Match context for positions sourced from imported matches
 */
export interface PositionMatchContext {
  player1Name: string;
  player1Country?: string;
  player2Name: string;
  player2Country?: string;
  tournamentName?: string;
  matchLength: number;
  gameNumber?: number;
  moveNumber?: number;
}

/**
 * Archive source information
 */
export interface PositionArchiveContext {
  filename: string;
  sourceCollection?: string;
}

/**
 * Extended seeded position with full context for drill generation
 */
export interface SeededPositionWithContext extends SeededPosition {
  libraryId: string;
  match?: PositionMatchContext;
  archive?: PositionArchiveContext;
  sourceType: PositionSource;
}
```

**Acceptance Criteria:**
- [ ] PositionMatchContext interface defined
- [ ] PositionArchiveContext interface defined
- [ ] SeededPositionWithContext extends SeededPosition
- [ ] All fields properly typed with optional markers

---

### Task 3.2: Update Seeder to Fetch Match Relations

**Description:** Modify position seeder to include match metadata when fetching positions
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.1

**File:** `lib/positionLibrary/seeder.ts`

**Key Changes:**
- Add Prisma `include` for match and archive relations
- Map relation data to SeededPositionWithContext type
- Handle null values from database

**Acceptance Criteria:**
- [ ] Match relation included when available
- [ ] Archive relation included when available
- [ ] libraryId mapped from position ID
- [ ] sourceType included
- [ ] Existing fields preserved
- [ ] Null values converted to undefined

---

### Task 3.3: Create PositionAttributionPanel Component

**Description:** Expandable panel showing position details and match context
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.1, Task 3.5

**File:** `components/artifacts/renderers/cards/PositionAttributionPanel.tsx`

**Features:**
- ASCII board display in monospace font
- Best move with equity
- Alternative moves when available
- Match context (player names, tournament, match length)
- Archive source info
- Loading and error states

**Acceptance Criteria:**
- [ ] ASCII board displayed in monospace
- [ ] Best move with equity shown
- [ ] Alternative moves shown when available
- [ ] Match context displayed in amber box
- [ ] Archive source shown
- [ ] Loading and error states handled
- [ ] Fetches position data on mount

---

### Task 3.4: Create DrillCardWithPosition Component

**Description:** Enhanced drill card with expandable position attribution
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.3

**File:** `components/artifacts/renderers/cards/DrillCardWithPosition.tsx`

**Features:**
- All existing DrillCard functionality
- New "Position" toggle when drill has positionId
- Expandable PositionAttributionPanel
- Database icon indicator

**Acceptance Criteria:**
- [ ] All drill content displayed
- [ ] Feedback section expandable
- [ ] Position attribution expandable (when positionId present)
- [ ] Position toggle shows positionId
- [ ] Tier and methodology badges displayed

---

### Task 3.5: Add Position Detail API Endpoint

**Description:** API endpoint to fetch single position with relations
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 3.1

**File:** `app/api/projects/[id]/positions/[positionId]/route.ts`

**Implementation:**
- GET endpoint returning position with match and archive relations
- Validate project ownership
- Return ASCII board, move analysis, match context

**Acceptance Criteria:**
- [ ] Returns position with match and archive relations
- [ ] Validates project ownership
- [ ] Returns 404 for unknown position
- [ ] Returns 401 for unauthenticated requests
- [ ] Response includes ASCII board and move analysis

---

## Phase 5: E2E Tests (Minimal)

### Task 5.3: Write E2E Tests for Phase-Organized Drills

**Description:** Playwright tests for phase-organized drill viewer
**Size:** Medium
**Priority:** High
**Dependencies:** Phase 3 complete

**File:** `tests/phase-organized-drills.spec.ts`

**Test Cases:**
1. Drill series artifact displays with phase sections
2. Principle groups render within phases
3. Drill cards show correct content (scenario, question, options)
4. Feedback section expands/collapses
5. Position attribution panel loads when positionId present (if positions exist)
6. TOC navigation works for phase sections

**Acceptance Criteria:**
- [ ] Test drill viewer renders phase sections
- [ ] Test principle groups display within phases
- [ ] Test drill card interactions
- [ ] Test position attribution when available
- [ ] All tests pass reliably

---

## Deferred Tasks (Phase 4: Drill Library Management)

**Reason for deferral:** These tasks add significant infrastructure (normalized Drill model, CRUD API, sync mechanism) for features that aren't immediately necessary. The current JSON-in-artifact approach works fine for viewing and generating drills.

**Deferred tasks:**
- Task 4.1: Add Prisma Migration for Drill Model
- Task 4.2: Create Drill CRUD API Endpoints
- Task 4.3: Implement Artifact-Drill Sync Mechanism
- Task 4.4: Add Replace/Add Mode Toggle to Config Panel
- Task 4.5: Implement Individual Drill Deletion
- Task 4.6: Update Inngest Job for Add Mode

**Deferred polish tasks:**
- Task 5.1: Add Loading States and Error Handling (beyond what's in Phase 3)
- Task 5.2: Add Confirmation Dialogs for Destructive Actions
- Task 5.5: Create and Run Migration Script

**Documentation:**
- Task 5.4: Already COMPLETE (CLAUDE.md updated with Phase-Organized Drill Schema section)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Drill Count Enforcement | 6 | ✅ COMPLETE |
| Phase 2: Phase-Organized Schema | 6 | ✅ COMPLETE |
| Phase 2.5: Curriculum Schema Alignment | 4 | ✅ COMPLETE |
| Bug Fixes (Session 2) | 5 | ✅ COMPLETE |
| Phase 3: Position Attribution | 5 | ⏳ PENDING |
| Phase 5.3: E2E Tests | 1 | ⏳ PENDING |
| **Active Scope** | **6** | **0 complete** |
| Phase 4: Drill Library Management | 6 | 🔜 DEFERRED |
| Phase 5: Other Polish | 3 | 🔜 DEFERRED |

## Execution Order

**Critical Path for Lean Scope:**
1. Tasks 3.1 + 3.5 (types + API) - Can run in parallel
2. Task 3.2 (seeder update) - Depends on 3.1
3. Task 3.3 (PositionAttributionPanel) - Depends on 3.5
4. Task 3.4 (DrillCardWithPosition) - Depends on 3.3
5. Task 5.3 (E2E tests) - Depends on all Phase 3 tasks

**Parallelizable:**
- Tasks 3.1 + 3.5 (types + API endpoint)

---

## Files to Create/Modify

**New Files:**
- `components/artifacts/renderers/cards/PositionAttributionPanel.tsx`
- `components/artifacts/renderers/cards/DrillCardWithPosition.tsx`
- `app/api/projects/[id]/positions/[positionId]/route.ts`
- `tests/phase-organized-drills.spec.ts`

**Modified Files:**
- `lib/positionLibrary/types.ts` (add context types)
- `lib/positionLibrary/seeder.ts` (include relations)
- `components/artifacts/renderers/PhaseOrganizedDrillRenderer.tsx` (use DrillCardWithPosition)
