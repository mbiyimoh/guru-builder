# Phase-Organized Drill Library

**Slug:** phase-organized-drill-library
**Author:** Claude Code
**Date:** 2025-12-16
**Branch:** preflight/phase-organized-drill-library
**Related:**
- `specs/scenario-based-drill-position-seeding/` - Position Library integration
- `specs/feat-position-library-browser-lean.md` - Position browser UI

---

## 1) Intent & Assumptions

### Task Brief
Restructure the drill series system to organize drills by game phase (OPENING, EARLY, MIDDLE, BEAROFF) rather than by principle. This includes:
1. Fixing drill count adherence (user asked for 10 drills, got 3)
2. Organizing generated drills by game phase with clear visual headers
3. Distributing drills evenly across selected phases
4. Supporting REPLACE ALL vs ADD TO EXISTING modes for incremental library building
5. Enabling individual drill deletion
6. Linking each drill to its source Position Library entry with expandable match metadata
7. Making this a system-level architecture change, not a prompt-driven workaround

### Assumptions
- All backgammon gurus will use phase-based drill organization (domain-specific decision)
- The 4 game phases (OPENING, EARLY, MIDDLE, BEAROFF) are fixed and sufficient
- Ground truth engine integration will remain required for scenario-based drills
- Users want to build a drill library over time, not just generate single artifacts
- Match metadata (player names, tournament, countries) adds educational value to drills

### Out of Scope
- Non-backgammon domains (other games would need their own phase taxonomy)
- Real-time drill execution/practice UI (just viewing/managing the library)
- Spaced repetition or adaptive learning algorithms
- Export to external formats (Anki, etc.)
- Multi-user drill library sharing
- Drill analytics/usage tracking

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `lib/guruFunctions/schemas/drillSeriesSchema.ts` | Drills organized by `PrincipleSeries`, `gamePhase` is optional on individual drills |
| `lib/guruFunctions/prompts/drillDesignerPrompt.ts` | Prompt includes `targetDrillCount` but GPT doesn't always honor it; positions seeded by phase but output not phase-organized |
| `lib/guruFunctions/generators/drillDesigner.ts` | Routes to ground truth or standard generation; normalizes output but doesn't validate count |
| `lib/guruFunctions/types.ts` | `DrillGenerationConfig` has `gamePhases`, `targetDrillCount`, `directDrillRatio` |
| `lib/inngest-functions.ts:775-924` | Drill generation job passes config through correctly; positions seeded by phase |
| `lib/positionLibrary/seeder.ts` | Fetches positions by phase but doesn't include match metadata in `SeededPosition` |
| `lib/positionLibrary/types.ts` | `SeededPosition` lacks match context (player, tournament, etc.) |
| `components/guru/DrillConfigurationPanel.tsx` | UI for phase selection and drill count; already has phase-aware controls |
| `components/artifacts/renderers/DrillSeriesRenderer.tsx` | Renders drills grouped by principle, not phase; no position attribution UI |
| `components/artifacts/renderers/cards/DrillCard.tsx` | Individual drill display; no position/match info shown |
| `prisma/schema.prisma:390-440` | `GuruArtifact` stores content as JSON blob; has `positionsUsed` array |
| `components/position-library/PositionDetailModal.tsx` | Shows match metadata (player names, countries, tournament) - good UI pattern to reuse |

---

## 3) Codebase Map

### Primary Components/Modules

| Path | Role |
|------|------|
| `lib/guruFunctions/schemas/drillSeriesSchema.ts` | Zod schema for drill output (needs restructuring) |
| `lib/guruFunctions/prompts/drillDesignerPrompt.ts` | Prompt builder (needs phase-first organization) |
| `lib/guruFunctions/generators/drillDesigner.ts` | Generation orchestration (needs count validation) |
| `lib/inngest-functions.ts` | Background job (may need new "add drills" job) |
| `lib/positionLibrary/seeder.ts` | Position seeding (needs match metadata) |
| `lib/positionLibrary/types.ts` | Types (needs extended SeededPosition) |
| `components/artifacts/renderers/DrillSeriesRenderer.tsx` | Drill display (needs phase-based layout) |
| `components/artifacts/renderers/cards/DrillCard.tsx` | Individual drill (needs position attribution) |
| `components/guru/DrillConfigurationPanel.tsx` | Config UI (needs replace/add toggle) |
| `prisma/schema.prisma` | Database (may need normalized drill table) |

### Shared Dependencies
- `@/lib/utils` - Utility functions
- `@/lib/positionLibrary/formatting.ts` - Badge/formatting utilities
- `@/lib/teaching/types.ts` - Shared type definitions
- Tailwind CSS / shadcn-ui components

### Data Flow

```
User selects phases + count
         ↓
DrillConfigurationPanel
         ↓
GuruTeachingManager.handleGenerate()
         ↓
POST /api/projects/[id]/guru/drill-series
         ↓
Inngest: drillSeriesGenerationJob
         ↓
seedPositionsByPhase() ← Position Library + Match metadata
         ↓
buildDrillDesignerPrompt() ← Phase-organized with counts
         ↓
GPT-4o generation
         ↓
Post-generation count validation + retry
         ↓
Save to GuruArtifact (+ merge with existing if "ADD" mode)
         ↓
DrillSeriesRenderer (phase-grouped display)
```

### Potential Blast Radius
- **High:** DrillSeriesSchema (changes output structure)
- **High:** DrillSeriesRenderer (new phase-based layout)
- **Medium:** DrillDesignerPrompt (new prompt structure)
- **Medium:** inngest-functions.ts (add/replace logic)
- **Low:** DrillCard (add position attribution expandable)
- **Low:** DrillConfigurationPanel (add replace/add toggle)
- **Low:** seeder.ts (add match metadata)

---

## 4) Root Cause Analysis

### Bug: Drill Count Not Honored

**Repro Steps:**
1. Open drill series regeneration modal
2. Set target drill count to 10
3. Select 2 phases (e.g., OPENING, MIDDLE)
4. Click Generate
5. Observe only 3 drills generated

**Observed:** 3 drills generated
**Expected:** 10 drills generated (5 per phase)

**Evidence:**
- `drillDesignerPrompt.ts:171`: Prompt says `Total drills to generate: ${config.targetDrillCount}`
- `drillDesignerPrompt.ts:186`: Prompt says `Total drill count MUST equal ${safeTargetCount}`
- No post-generation validation of count
- GPT-4o sometimes ignores count constraints despite explicit instructions

**Root-Cause Hypotheses:**
1. **GPT ignores count instructions** (HIGH confidence) - Even with explicit "MUST" language, GPT-4o doesn't always generate exact counts
2. **Schema doesn't enforce count** (HIGH confidence) - Zod schema has no minItems/maxItems constraints (and OpenAI strict mode doesn't support them anyway)
3. **Prompt structure causes early termination** (MEDIUM confidence) - Large prompt with JSON output may hit token limits

**Decision:** Primary cause is lack of post-generation validation with retry. OpenAI's structured outputs don't support array length constraints, so validation must happen after generation with a retry budget.

---

## 5) Research Findings

### Research Question 1: Enforcing AI Output Counts

**Finding:** OpenAI's `strict: true` mode does NOT support `minItems`/`maxItems` constraints.

**Solutions:**
1. **Explicit prompt engineering** - State "EXACTLY N drills" not "around N"
2. **Post-generation validation** - Parse output, count drills, retry if wrong
3. **Per-phase generation** - Generate drills for each phase separately (guarantees count but more API calls)

**Recommendation:** Post-generation validation with retry budget (max 3 attempts). Count drills, if wrong, regenerate with feedback "You generated X drills but I need exactly Y."

### Research Question 2: Incremental Content Patterns

**Options:**
| Pattern | Pros | Cons |
|---------|------|------|
| **Append-only** | Full history, easy rollback | Grows unbounded, complex queries |
| **Snapshot-based** | Clear versions, easy compare | Duplication, expensive storage |
| **Hybrid (current + delta)** | Balanced, supports both modes | Medium complexity |
| **Normalized table** | Fast queries, individual CRUD | Schema migration needed |

**Recommendation:** Hybrid approach:
- Keep `GuruArtifact.content` for the "official" artifact view
- Add `Drill` table for individual drill CRUD operations
- Sync between them on regeneration (replace all) or merge (add mode)

### Research Question 3: Schema Design

**Current:** Nested JSON in `GuruArtifact.content`

**Proposed Hybrid:**
```prisma
model Drill {
  id            String    @id @default(cuid())
  artifactId    String    // FK to GuruArtifact (the parent series)
  positionId    String?   // FK to PositionLibrary
  gamePhase     GamePhase
  orderIndex    Int       // For ordering within phase

  // Drill content (JSON for flexibility)
  content       Json      // { drillId, tier, scenario, options, feedback, etc. }

  // Denormalized for quick display
  title         String?   // Extracted from scenario.setup
  tier          DrillTier // RECOGNITION, APPLICATION, TRANSFER

  // Soft delete for "remove" without losing history
  deletedAt     DateTime?

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  artifact      GuruArtifact @relation(fields: [artifactId], references: [id], onDelete: Cascade)
  position      PositionLibrary? @relation(fields: [positionId], references: [id])

  @@index([artifactId, gamePhase])
  @@index([artifactId, orderIndex])
}
```

**Trade-offs:**
- Normalized: Fast phase filtering, individual CRUD, but requires migration
- JSONB alone: 2000x slower queries per Heap research
- Hybrid: Best of both - JSON for content flexibility, columns for filtering

### Research Question 4: Phase Distribution Algorithm

**Recommended: Minimum Guarantees + Balanced Allocation**

```typescript
function distributeAcrossPhases(total: number, phases: GamePhase[]): Map<GamePhase, number> {
  const perPhase = Math.floor(total / phases.length);
  const remainder = total % phases.length;

  return new Map(phases.map((phase, i) => [
    phase,
    perPhase + (i < remainder ? 1 : 0)
  ]));
}

// Example: 10 drills across [OPENING, MIDDLE]
// → OPENING: 5, MIDDLE: 5

// Example: 10 drills across [OPENING, EARLY, MIDDLE]
// → OPENING: 4, EARLY: 3, MIDDLE: 3
```

### Research Question 5: Position/Source Attribution

**TASL Framework:** Title, Author, Source, License (Creative Commons standard)

**Implementation:**
1. Store `positionId` FK on each drill
2. Extend `SeededPosition` to include match metadata
3. Add expandable "Position Info" section in DrillCard
4. Display: Dice roll, best moves, player names, tournament (like PositionDetailModal)

---

## 6) Clarifications Needed

### 1. Phase-First vs Principle-First Organization

**Current:** Drills organized by *principle* (`series[].principleName → drills[]`)
**Proposed:** Drills organized by *phase* (`OPENING → drills[], MIDDLE → drills[]`)

**Question:** Should we:
- A) Completely replace principle-based with phase-based organization
- B) Support both views (phase as primary, principle as secondary filter)
- C) Nest phases within principles (`series[].principleName → phases[].drills[]`)

**Recommendation:** Option A - Phase-first is the clear user requirement for backgammon. Principles can be tags/metadata on individual drills.

### 2. Schema Migration Strategy

**Question:** Should we:
- A) Migrate to normalized `Drill` table (enables individual CRUD but requires migration)
- B) Keep JSON blob but restructure schema (simpler but limited CRUD)
- C) Add `Drill` table alongside existing (backwards compatible but dual maintenance)

**Recommendation:** Option C for MVP, migrate existing data later. Allows incremental rollout.

### 3. Replace vs Add Default Behavior

**Question:** When user regenerates drills, should the default be:
- A) REPLACE all existing drills (current behavior)
- B) ADD to existing drills
- C) Prompt user to choose each time (explicit choice)

**Recommendation:** Option C - Always show a toggle with REPLACE as default for backwards compatibility.

### 4. Drill Count Enforcement Strictness

**Question:** If GPT returns wrong count after 3 retries, should we:
- A) Fail the generation with error
- B) Accept partial results with warning
- C) Pad with placeholder "pending" drills

**Recommendation:** Option B - Accept what we have, show warning "Generated X of Y requested drills"

### 5. Match Metadata Display Scope

**Question:** How much match context to show on each drill:
- A) Minimal: Just dice roll and position ID
- B) Moderate: Dice, players, tournament name
- C) Full: Everything from PositionDetailModal in expandable

**Recommendation:** Option C - Full context in expandable section. The information is valuable for learning.

---

## 7) Proposed Solution Architecture

### Schema Changes

```typescript
// New phase-organized output schema
export const phaseOrganizedDrillSeriesSchema = z.object({
  drillSeriesTitle: z.string(),
  totalDrills: z.number(),
  estimatedCompletionMinutes: z.number(),

  // Phase-organized drills (the key change)
  phases: z.array(z.object({
    phase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']),
    phaseTitle: z.string(),  // e.g., "Opening Rolls"
    drillCount: z.number(),
    drills: z.array(drillSchema),  // Existing drill schema
  })),

  designThoughts: designThoughtsSchema,
});
```

### Extended SeededPosition with Match Metadata

```typescript
export interface SeededPositionWithMatch extends SeededPosition {
  // Existing fields...

  // New match context
  match?: {
    player1Name: string;
    player1Country?: string;
    player2Name: string;
    player2Country?: string;
    tournamentName?: string;
    matchLength: number;
    gameNumber?: number;
    moveNumber?: number;
  };
  archive?: {
    filename: string;
    sourceCollection?: string;
  };
}
```

### UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Drill Configuration                                              │
├─────────────────────────────────────────────────────────────────┤
│ Game Phases: [✓ OPENING] [✓ EARLY] [ ] MIDDLE [ ] BEAROFF       │
│                                                                  │
│ Target Drills: [====●========] 10                               │
│                                                                  │
│ Mode: (•) Replace all drills  ( ) Add to existing               │
│                                                                  │
│ [Cancel]                                      [Generate Drills]  │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│ Drill Series - Backgammon Fundamentals                          │
│ 10 drills | ~15 min                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ══════════════════════════════════════════════════════════════  │
│   OPENING ROLLS (5 drills)                                       │
│ ══════════════════════════════════════════════════════════════  │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Drill 1 of 5 | RECOGNITION | 3-1 Opening                    │ │
│ │ [Position: 3-1 ▼]                                            │ │
│ │                                                              │ │
│ │ You've rolled 3-1 at the start of the game...               │ │
│ │ ┌────────────────────────────────────────┐                  │ │
│ │ │ ASCII board                             │                  │ │
│ │ └────────────────────────────────────────┘                  │ │
│ │                                                              │ │
│ │ ○ A) 8/5, 6/5 (Make the 5-point)        ← Correct          │ │
│ │ ○ B) 24/21, 8/7                                             │ │
│ │ ○ C) 13/10, 8/7                                             │ │
│ │                                                              │ │
│ │ [🗑️ Delete]                              [Show Feedback ▼]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Position: 3-1 Opening                            [Collapse] │ │
│ │ ────────────────────────────────────────────────────────── │ │
│ │ Best Move: 8/5, 6/5         Equity: +0.234                  │ │
│ │ 2nd Best:  24/21, 8/7       Equity: +0.198                  │ │
│ │ 3rd Best:  8/5, 8/7         Equity: +0.156                  │ │
│ │ ────────────────────────────────────────────────────────── │ │
│ │ Match: Mochy (JPN) vs Falafel (USA)                         │ │
│ │ Tournament: World Championship 2023                          │ │
│ │ Game 5, Move 12                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ... more drills ...                                              │
│                                                                  │
│ ══════════════════════════════════════════════════════════════  │
│   EARLY GAME (5 drills)                                          │
│ ══════════════════════════════════════════════════════════════  │
│                                                                  │
│ ... drills for early game phase ...                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8) Implementation Phases

### Phase 1: Fix Drill Count (Quick Win)
- Add post-generation count validation
- Retry with explicit feedback if count wrong
- Accept partial with warning after 3 retries

### Phase 2: Phase-Based Schema
- Create new `phaseOrganizedDrillSeriesSchema`
- Update prompt to generate phase-organized output
- Update renderer for phase-grouped display

### Phase 3: Position Attribution
- Extend SeededPosition with match metadata
- Add expandable position section in DrillCard
- Link drills to Position Library entries

### Phase 4: Incremental Library
- Add normalized Drill table (optional)
- Implement REPLACE vs ADD toggle
- Add individual drill deletion

### Phase 5: Polish
- Migration script for existing drill artifacts
- E2E tests for new flows
- Documentation updates

---

## 9) Enhancement Opportunity: Match Metadata in Drill Prompts

**From earlier investigation:** The Position Library now stores rich match metadata (player names, countries, tournament, game/move numbers) but this isn't being passed to drill generation.

**Proposed Enhancement:**
1. Update `seedPositionsForPhase()` to include match relations
2. Format match context in drill prompts
3. Enable prompts like: *"This position occurred in the 2023 World Championship when Mochy faced Falafel..."*

This transforms drills from abstract exercises into historically-grounded learning experiences.

---

## 10) Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GPT still ignores count after 3 retries | Medium | Low | Accept partial, show warning |
| Schema migration breaks existing artifacts | Low | High | Backwards-compatible JSON parsing |
| Performance with normalized Drill table | Low | Medium | Proper indexes, lazy loading |
| User confusion with Replace/Add modes | Medium | Low | Clear UI labels, default to Replace |
| Phase distribution edge cases (1 drill, 4 phases) | Low | Low | Minimum of 1 per phase, warn if impossible |
