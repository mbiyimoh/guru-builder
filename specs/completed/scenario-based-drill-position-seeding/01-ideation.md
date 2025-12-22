# Position Seeding for Scenario-Based Backgammon Drills

**Slug:** scenario-based-drill-position-seeding
**Author:** Claude Code
**Date:** 2025-12-13
**Branch:** preflight/scenario-based-drill-position-seeding
**Related:**
- `specs/feat-ground-truth-content-validation/` - Ground truth engine integration
- `specs/feat-guru-teaching-functions.md` - Teaching artifact generation

---

## 1) Intent & Assumptions

### Task Brief
Transform drill series generation from abstract concept questions to **scenario-based drills** featuring authentic backgammon positions (board setup + dice roll + "what's the best move?"). Add a pre-generation step that seeds positions from external sources organized by game phase (first roll, early game, mid-game, end game), so GPT creates pedagogically rich drills around real, engine-verified positions rather than inventing scenarios from its training data.

### Assumptions
- The existing GNU Backgammon engine integration (ground truth system) can be extended for position sourcing
- Positions will be represented as GNUBG Position IDs (14-char Base64 strings) which are compact and portable
- ASCII board representation is sufficient for MVP; SVG rendering is a future enhancement
- The 4-phase mental model (first roll, early, mid, end game) aligns with how positions should be categorized
- Token efficiency matters - we'll batch positions intelligently rather than passing all at once
- This is a backgammon-specific implementation within the generalizable "Position Library" concept

### Out of Scope
- SVG/visual board rendering in the UI (ASCII is sufficient)
- Other game domains (chess, poker, blackjack) - those get their own implementations later
- Real-time position generation during user play
- Position difficulty scoring/ranking (future enhancement)
- Match replay or full game analysis features

---

## 2) Pre-reading Log

### Documentation Reviewed
- `CLAUDE.md`: Ground Truth Content Validation section - established engine architecture
- `developer-guides/01-overall-architecture.md`: System overview and data flow
- `specs/feat-ground-truth-content-validation/`: Engine integration patterns

### Code Reviewed
- `lib/guruFunctions/generators/drillDesigner.ts`: Current drill generation, dual path (standard vs ground truth)
- `lib/guruFunctions/prompts/drillDesignerPrompt.ts`: 15+ methodology index, no position seeding
- `lib/guruFunctions/schemas/drillSeriesSchema.ts`: Drill structure with `scenario.setup` and `asciiWireframe`
- `lib/groundTruth/tools.ts`: Existing tools - `query_position`, `verify_move`, `get_best_moves`
- `lib/groundTruth/executor.ts`: MCP request pattern to backgammon engine
- `lib/groundTruth/generatorWithVerification.ts`: Agentic loop that allows GPT to call tools
- `lib/inngest-functions.ts:721-970`: Drill series generation job with phases

### Key Takeaways
1. **Current flow is verification-only**: GPT invents positions, engine verifies afterward
2. **Tools exist but aren't proactive**: GPT can query the engine but isn't instructed to source positions from it
3. **Schema supports scenarios**: `scenario.setup` and `asciiWireframe` fields exist but are freeform
4. **No game phase concept**: The drill prompt doesn't know about opening/early/mid/endgame phases

---

## 3) Codebase Map

### Primary Components/Modules

| File | Role |
|------|------|
| `lib/guruFunctions/generators/drillDesigner.ts` | Main drill generation orchestration |
| `lib/guruFunctions/prompts/drillDesignerPrompt.ts` | User prompt with methodology index |
| `lib/guruFunctions/schemas/drillSeriesSchema.ts` | Output schema (needs position fields) |
| `lib/groundTruth/tools.ts` | Engine tool definitions (needs new tools) |
| `lib/groundTruth/executor.ts` | Tool execution against engine |
| `lib/inngest-functions.ts` | Background job orchestration |

### Shared Dependencies
- `lib/groundTruth/config.ts`: Engine configuration resolution
- `lib/groundTruth/cache.ts`: Response caching (can cache positions)
- `lib/guruFunctions/promptResolver.ts`: Custom prompt handling
- `lib/guruFunctions/prompts/creativeSystemPrompt.ts`: System prompt with guru profile

### Data Flow (Current)
```
User clicks Generate → API creates artifact → Inngest job starts
→ Load prerequisites (mental model + curriculum)
→ Resolve prompts
→ [IF ground truth] GPT + tool loop, GPT invents positions
→ [ELSE] Direct GPT call, GPT invents positions
→ Parse/validate → Save artifact
```

### Data Flow (Proposed)
```
User clicks Generate → API creates artifact → Inngest job starts
→ Load prerequisites (mental model + curriculum)
→ [NEW] Seed positions from Position Library by game phase
→ [NEW] Build prompt with seeded positions as constraints
→ GPT generates drills around seeded positions
→ [OPTIONAL] Verify any additional claims
→ Parse/validate → Save artifact
```

### Potential Blast Radius
- `lib/guruFunctions/generators/drillDesigner.ts` - Major changes
- `lib/guruFunctions/prompts/drillDesignerPrompt.ts` - New section for seeded positions
- `lib/guruFunctions/schemas/drillSeriesSchema.ts` - New fields (positionId, gamePhase)
- `lib/groundTruth/tools.ts` - New tools for position sourcing
- `lib/inngest-functions.ts` - New step before generation
- `prisma/schema.prisma` - New PositionLibrary model (optional)

---

## 4) Root Cause Analysis

**N/A** - This is a feature, not a bug fix.

---

## 5) Research Findings

### Position Sourcing Options Evaluated

#### Option 1: GNU Backgammon + Python Scripting (RECOMMENDED)

**What it offers:**
- Full command-line interface for position evaluation
- Native Python scripting module (`gnubg.evaluate()`, `gnubg.positionid()`)
- Tutor mode identifies "instructive" positions (equity loss > threshold)
- Self-play for unlimited position generation
- Exports to Position ID format (14-char Base64)

**Pros:**
- Already integrated as ground truth engine
- Can generate infinite positions via self-play
- Tutor mode filters for pedagogically interesting positions
- Full equity and move ranking data available

**Cons:**
- Requires Python environment or REST wrapper
- Self-play generation takes time (but can be done offline)
- No built-in game phase classification (must implement)

**Feasibility:** HIGH

---

#### Option 2: Curated Position Databases

**Sources identified:**
- **USBGF Opening Database**: 651 opening positions with analysis (PDF, needs digitization)
- **Kit Woolsey Encyclopedias**: 452 expert-curated positions across all phases
- **BGMoves Dataset**: 1000+ analyzed matches from Backgammon Galaxy (R package)
- **AnkiGammon**: Existing flashcard positions for learning

**Pros:**
- Positions already vetted for teaching value
- Organized by topic/phase
- Rich annotations available

**Cons:**
- Limited quantity (hundreds, not thousands)
- May require manual digitization
- Licensing unclear for some sources

**Feasibility:** MEDIUM-HIGH (good for bootstrapping, supplement with generated)

---

#### Option 3: Match Mining

**What it offers:**
- Extract positions from recorded matches (SGF, MAT files)
- GNUBG can identify "blunder" positions (where best move wasn't played)
- Large archives available (Backgammon Galaxy exports, tournament records)

**Pros:**
- Real game situations with context
- Blunders = natural teaching opportunities
- Large volume available

**Cons:**
- Requires processing pipeline
- Quality varies by source
- Still needs phase classification

**Feasibility:** MEDIUM (good long-term, more setup)

---

#### Option 4: gnubg-nn-pypi (Lightweight Production)

**What it offers:**
- Python package with GNUBG neural network for position evaluation
- No full GNUBG installation required
- Fast move ranking without external engine calls

**Pros:**
- Easy deployment (pip install)
- Fast response times
- Can validate positions in-process

**Cons:**
- Evaluation only, not position generation
- Less accurate than full GNUBG
- Can't do self-play or match analysis

**Feasibility:** HIGH for validation, LOW for sourcing

---

### Game Phase Classification

**No built-in GNUBG classifier**, but straightforward to implement:

| Phase | Classification Rule |
|-------|---------------------|
| **Opening (First Roll)** | Move count = 1 (21 possible rolls, all catalogued) |
| **Early Game** | Move count 2-6, both sides have back checkers |
| **Mid-Game** | Move count 7+, significant contact, checkers behind opponent's prime |
| **Bearoff (End Game)** | All 15 checkers in home board (points 1-6) |

These rules can be computed from the Position ID without engine calls.

---

### Position Format Recommendation

**Use GNUBG Position ID (14 characters, Base64)**

Example: `4HPwATDgc/ABMA`

**Why:**
- Most compact representation
- Native to our engine
- Encodes complete board state
- Easily validated (checksum)
- Human-readable tools exist for debugging

**Match ID** (12 chars) encodes cube/score separately - use if match context needed.

---

### Recommended Architecture

#### Phase 1: Curated Position Library (MVP)

1. **Database model**: `PositionLibrary` table storing:
   - `positionId` (GNUBG format)
   - `gamePhase` (OPENING, EARLY, MIDDLE, BEAROFF)
   - `diceRoll` (e.g., "3-1")
   - `bestMove` (GNUBG notation)
   - `equity` (float)
   - `teachingNotes` (optional, from curation)
   - `sourceType` (CURATED, GENERATED, MINED)
   - `principleIds` (which principles this position teaches)

2. **Seed ~50 positions per phase** from:
   - USBGF opening database (21 first rolls + responses)
   - Woolsey reference positions (manually entered)
   - GNUBG self-play (filter by equity swing)

3. **At drill generation time**:
   - Query position library for phase-appropriate positions
   - Select 8-12 positions that cover target principles
   - Inject into prompt as "USE THESE POSITIONS"

#### Phase 2: Intelligent Position Selection

1. **Map positions to principles**: Tag which principles each position teaches
2. **Balance coverage**: Ensure drill series covers all target principles
3. **Vary difficulty**: Mix high-equity-swing (obvious) with low-swing (subtle) positions

#### Phase 3: Dynamic Position Generation (Future)

1. Use GNUBG self-play to generate positions on-demand
2. Filter by game phase + principle coverage
3. Cache generated positions to library

---

### Batching Strategy for Token Efficiency

**Problem**: 50 positions × ~200 chars each = 10,000 tokens just for positions

**Solution: Phase-by-Phase Generation**

Instead of generating all drills at once:

```
FOR each game phase (OPENING, EARLY, MIDDLE, BEAROFF):
  1. Fetch 8-12 positions for this phase from library
  2. Generate 3-5 drills using these positions
  3. Append to drill series

THEN: Combine all phase drills into final output
```

**Benefits:**
- Each GPT call handles ~2,500 tokens of positions
- Natural organization by game phase
- Can parallelize phase generation
- Easier to retry failed phases

**Implementation**: Modify `drillSeriesGenerationJob` in `inngest-functions.ts` to:
1. Split into 4 sub-steps (one per phase)
2. Each sub-step fetches positions and generates phase drills
3. Final step merges and validates

---

### Potential Solutions Summary

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| A) Prompt-only (tell GPT to use tools) | No code changes | GPT still invents positions | NOT RECOMMENDED |
| B) Position Seeding (library + prompt injection) | Guarantees real positions, GPT focuses on pedagogy | Requires position library | **RECOMMENDED** |
| C) Full schema + engine integration | Most robust, typed positions | More code, board rendering needed | Future enhancement |

**Recommended: Option B with Phase-by-Phase Batching**

---

## 6) Clarifications - User Decisions

### 1. Position Library Bootstrap Strategy

**Decision: Fully Automated via GNUBG**

No manual curation. GNUBG provides everything we need:
- **Opening rolls**: Query all 21 unique first rolls with best moves
- **Other phases**: Generate via self-play, filter with tutor mode for instructive positions
- **Deduplication**: System checks for unique positions before adding

---

### 2. Position-to-Principle Mapping

**Decision: AI-Assisted Tagging (Option C)**

Use GPT to suggest which principles a position teaches during import. Efficient and accurate enough.

---

### 3. Drill Generation Scope per Phase

**Decision: Complete Opening Coverage + Expandable Other Phases**

- **Opening (First Roll)**: ALL 21 unique dice rolls - this is a finite, critical set
- **Early/Mid/Bearoff**: Start with 20 positions each, easily expandable
- **Deduplication**: System ensures no duplicate positions when adding more
- **Long-term vision**: Generate many drills so users can practice extensively without hitting duplicates

---

### 4. Position Format in UI

**Decision: ASCII Only (Option A)**

Simple text board diagram. Clean and sufficient for MVP.

---

### 5. Integration Point

**Decision: New Inngest Step (Option A)**

Add "seed-positions" step before "generate-drills". Cleaner separation, easier to monitor/retry.

---

### 6. Feature Toggle

**Decision: Ground Truth Dependent (Option C)**

Position seeding activates automatically when ground truth engine is enabled. Aligns with existing system.

---

### 7. Additional Feature: Artifact Creation Info Modal

**Decision: Include in this implementation**

Add an info icon to each artifact tile on the dashboard that opens a modal explaining how that artifact type is created, in plain language. Helps users understand where to make adjustments (corpus, system prompt, user prompt, etc.).

---

## Next Steps

1. **Create 02-specification.md** with technical design
2. **Create 03-tasks.md** with implementation breakdown
3. **Implement position sourcing from GNUBG** (all 21 opening rolls + self-play for other phases)
4. **Implement position seeding step** in Inngest
5. **Modify drill prompt** to use seeded positions
6. **Add info icon + modal** to artifact tiles
7. **Test end-to-end** drill generation with real positions
