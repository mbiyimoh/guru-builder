# Position Library Developer Guide

**Created:** 2025-12-16
**Purpose:** Understanding the Position Library system for scenario-based drill generation

---

## Overview

The Position Library stores pre-verified game positions from ground truth engines (like GNU Backgammon). These positions are "seeded" into drill generation prompts to create scenario-based practice exercises grounded in real game situations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       POSITION LIBRARY                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   OPENING     │   │   MATCH       │   │   SELF-PLAY   │
│   CATALOG     │   │   MINING      │   │   POSITIONS   │
│ (21 positions)│   │ (from games)  │   │  (generated)  │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   PositionLibrary │
                    │      (table)      │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Drill Generation │
                    │   (seeding)       │
                    └───────────────────┘
```

---

## Database Schema

```prisma
model PositionLibrary {
  id                  String       @id @default(cuid())
  engineId            String       // Links to GroundTruthEngine
  positionId          String       // Unique position identifier
  gamePhase           GamePhase    // OPENING, EARLY, MIDDLE, BEAROFF
  sourceType          PositionSource // OPENING_CATALOG, SELF_PLAY, MATCH_MINING

  // Position data
  diceRoll            String       // e.g., "6-5", "3-1"
  asciiBoard          String       @db.Text  // ASCII representation
  xgid               String?       // Optional XGID format

  // Analysis data (from ground truth engine)
  bestMove            String       // e.g., "24/18 13/10"
  bestMoveEquity      Float        // e.g., 0.089
  secondBestMove      String?
  secondEquity        Float?
  thirdBestMove       String?
  thirdEquity         Float?
  probabilityBreakdown Json?       // Win/gammon/backgammon probabilities

  // Match context (for MATCH_MINING source)
  matchId             String?
  gameNumber          Int?
  moveNumber          Int?

  // Timestamps
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  // Relations
  engine              GroundTruthEngine @relation(...)
  match               MatchArchive?     @relation(...)
  archive             PositionArchive?  @relation(...)

  @@unique([engineId, positionId])
  @@index([engineId, gamePhase])
}

enum GamePhase {
  OPENING   // First few moves (21 unique opening rolls)
  EARLY     // Early game positions
  MIDDLE    // Mid-game positions
  BEAROFF   // Bearing off positions
}

enum PositionSource {
  OPENING_CATALOG  // Standard opening positions
  SELF_PLAY        // Generated from engine self-play
  MATCH_MINING     // Extracted from match archives
}
```

---

## Key Files

### Core Library
- `lib/positionLibrary/types.ts` - TypeScript interfaces
- `lib/positionLibrary/seeder.ts` - Position fetching and sampling
- `lib/positionLibrary/openings.ts` - Opening position catalog
- `lib/positionLibrary/asciiRenderer.ts` - Board visualization
- `lib/positionLibrary/index.ts` - Barrel exports

### Population Scripts
- `scripts/populate-positions.ts` - Initial position population

---

## Position Types

### SeededPosition

The basic position format for drill generation:

```typescript
interface SeededPosition {
  positionId: string;           // Unique ID
  diceRoll: string;             // e.g., "6-5"
  bestMove: string;             // e.g., "24/18 13/10"
  bestMoveEquity: number;       // e.g., 0.089
  bestMoveProbability?: number; // e.g., 0.52 (52% win)
  alternatives: AlternativeMove[];
  asciiBoard: string;           // ASCII board for prompt
  metadata?: PositionMetadata;  // Name/description for curated positions
}

interface AlternativeMove {
  move: string;
  equity: number;
  probability?: number;
}
```

### SeededPositionWithContext

Extended position with match/archive attribution:

```typescript
interface SeededPositionWithContext extends SeededPosition {
  libraryId: string;
  sourceType: PositionSource;
  match?: PositionMatchContext;   // Player names, tournament, etc.
  archive?: PositionArchiveContext;
}
```

---

## Seeding Functions

### seedPositionsForPhase

Fetch positions for a single game phase:

```typescript
import { seedPositionsForPhase } from '@/lib/positionLibrary';

// Fetch up to 10 MIDDLE phase positions
const positions = await seedPositionsForPhase(
  engineId,     // Ground truth engine ID
  'MIDDLE',     // Game phase
  10            // Max positions (optional, default 25)
);
```

### seedPositionsByPhase

Fetch positions for multiple phases at once:

```typescript
import { seedPositionsByPhase } from '@/lib/positionLibrary';

const positions = await seedPositionsByPhase(
  engineId,
  ['OPENING', 'MIDDLE'],  // Phases to fetch
  15                       // Max per non-OPENING phase
);

// Returns: { OPENING: [...], EARLY: [], MIDDLE: [...], BEAROFF: [] }
```

---

## Opening Positions (MVP)

The 21 unique opening rolls in backgammon:

### Non-Doubles (15)
```
6-5, 6-4, 6-3, 6-2, 6-1
5-4, 5-3, 5-2, 5-1
4-3, 4-2, 4-1
3-2, 3-1
2-1
```

### Doubles (6)
```
6-6, 5-5, 4-4, 3-3, 2-2, 1-1
```

### Opening Roll Handling

Opening positions are special:
- **Always returns all 21**: No sampling/limiting
- **Preserves dice order**: Sorted by dice roll ascending
- **No shuffling**: Unlike other phases

```typescript
// lib/positionLibrary/seeder.ts
if (phase === 'OPENING') {
  // Return ALL positions, no shuffle
  return positions; // All 21
} else {
  // Shuffle and limit for variety
  return shuffleArray(positions).slice(0, limit);
}
```

---

## Random Sampling

For non-OPENING phases, positions are randomly sampled to provide variety:

### Fisher-Yates Shuffle

```typescript
// lib/positionLibrary/seeder.ts:26-37
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

### 2x Fetch Pattern

To enable good random sampling, we fetch 2x the limit:

```typescript
// Fetch 2x to have a sampling pool
const fetchLimit = limit ? limit * 2 : undefined;

const positions = await prisma.positionLibrary.findMany({
  where: { engineId, gamePhase: phase },
  take: fetchLimit
});

// Then shuffle and take limit
return shuffleArray(positions).slice(0, limit);
```

---

## ASCII Board Rendering

Positions include ASCII board representations for prompt injection:

```typescript
// lib/positionLibrary/asciiRenderer.ts
export function renderAsciiBoard(position: PositionData): string {
  // Returns something like:
  /*
    +13-14-15-16-17-18------19-20-21-22-23-24-+
    | X           O    |   | O              X |
    | X           O    |   | O              X |
    | X           O    |   | O                |
    | X                |   | O                |
    | X                |   |                  |
    |                  |BAR|                  |
    | O                |   |                  |
    | O           X    |   | X                |
    | O           X    |   | X              O |
    | O           X    |   | X              O |
    | O           X    |   | X              O |
    +12-11-10--9--8--7-------6--5--4--3--2--1-+
  */
}
```

---

## Integration with Drill Generation

### In Inngest Function

```typescript
// lib/inngest-functions.ts:850-890
const gtConfig = await resolveGroundTruthConfig(projectId);

if (gtConfig?.enabled) {
  // Calculate dynamic position limit
  const phasesCount = drillConfig?.gamePhases?.length ?? 1;
  const targetDrills = drillConfig?.targetDrillCount ?? 21;
  const positionsPerPhase = Math.ceil(targetDrills / phasesCount) + 2;
  const dynamicLimit = Math.min(positionsPerPhase, 25);

  // Seed positions for requested phases
  const seededPositions = await step.run('seed-positions', async () => {
    return seedPositionsByPhase(
      gtConfig.engineId,
      drillConfig?.gamePhases,
      dynamicLimit
    );
  });

  // Pass to generator
  result = await step.run('generate-drills', async () => {
    return generateDrillSeries({
      ...options,
      seededPositions
    });
  });

  // Track which positions were used
  const positionsUsed = getPositionIdsFromSeeded(seededPositions);
}
```

### In Prompt

```typescript
// lib/guruFunctions/prompts/drillDesignerPrompt.ts
function formatPositionsForPrompt(positions: SeededPositionsByPhase): string {
  let output = '';

  for (const phase of ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']) {
    const phasePositions = positions[phase];
    if (phasePositions.length === 0) continue;

    output += `\n## ${phase} PHASE POSITIONS\n\n`;

    for (const pos of phasePositions) {
      output += `### Position: ${pos.positionId}\n`;
      output += `Dice Roll: ${pos.diceRoll}\n`;
      output += `Best Move: ${pos.bestMove} (equity: ${pos.bestMoveEquity})\n`;
      output += `\`\`\`\n${pos.asciiBoard}\n\`\`\`\n\n`;
    }
  }

  return output;
}
```

---

## Populating the Library

### Opening Catalog Population

```bash
# Run the population script
npx ts-node scripts/populate-positions.ts
```

### Match Mining (Future)

Positions extracted from match archives:
- Import `.mat` files via Match Import system
- Parse games and extract interesting positions
- Query ground truth engine for analysis
- Store in Position Library with match context

### Self-Play (Future)

Engine generates positions through self-play:
- Configure position generation parameters
- Run simulated games
- Extract varied positions across phases
- Analyze and store

---

## Token Optimization

Position data in prompts consumes significant tokens:

| Component | ~Tokens per Position |
|-----------|---------------------|
| ASCII Board | ~100 tokens |
| Move data | ~25 tokens |
| Alternatives | ~50 tokens |
| **Total** | **~175 tokens** |

### Token Budget per Phase

With default 25 positions per phase:
- Per phase: 25 × 175 = 4,375 tokens
- 4 phases: 17,500 tokens

### Dynamic Optimization

The dynamic limit calculation reduces this significantly:
- 12 positions per phase (for 20 drills, 2 phases)
- Per phase: 12 × 175 = 2,100 tokens
- 2 phases: 4,200 tokens
- **Savings: 76%**

---

## Deprecated Code Cleanup (2025-12-16)

**CRITICAL: The following code has been removed and should NOT be recreated:**

### What Was Removed

1. **Hardcoded Position Seeds** (`lib/positionLibrary/positionSeeds.ts`)
   - ~490 lines of hardcoded EARLY/MIDDLE/BEAROFF positions
   - Functions: `getSeededPositionsForPhase()`, `getSeededPositionsSubset()`, `toPlaysBoardConfig()`
   - Constants: `EARLY_GAME_POSITIONS`, `MIDDLE_GAME_POSITIONS`, `BEAROFF_POSITIONS`

2. **Non-Opening Population** (`lib/positionLibrary/nonOpeningPositions.ts`)
   - ~189 lines using deprecated position seeds
   - Functions: `populateNonOpeningPositions()`, `getPositionsByPhase()`, `getPositionCountsByPhase()`, `getAvailableSeedCount()`

3. **Deprecated Function** (`lib/positionLibrary/seeder.ts`)
   - `seedOpeningPositions()` - Use `seedPositionsForPhase(engineId, 'OPENING')` instead

4. **Deprecated API Route** (`app/api/position-library/fetch/`)
   - Entire route folder removed (depended on deprecated code)

5. **Deprecated Zod Schema** (`lib/assessment/validation.ts`)
   - `assessmentConfigSchema` - Replaced by new Ground Truth architecture

### Why It Was Removed

- **Match Import System**: Positions are now populated from **Hardee's match collection** via the Match Import system, not hardcoded arrays
- **Database-First Approach**: All positions live in `PositionLibrary` table, queried dynamically
- **Token Optimization**: Dynamic position loading prevents hardcoded bloat
- **Maintainability**: Single source of truth in database vs scattered hardcoded arrays

### What to Use Instead

| Deprecated | Replacement |
|------------|-------------|
| `getSeededPositionsForPhase()` | `seedPositionsForPhase(engineId, phase)` |
| `seedOpeningPositions()` | `seedPositionsForPhase(engineId, 'OPENING')` |
| `populateNonOpeningPositions()` | Use Match Import system to populate database |
| Hardcoded position arrays | Query `PositionLibrary` table via Prisma |

### Migration Checklist

If you encounter references to deprecated code:

- [ ] Replace `seedOpeningPositions()` with `seedPositionsForPhase(engineId, 'OPENING')`
- [ ] Remove imports from `positionSeeds.ts` or `nonOpeningPositions.ts`
- [ ] Use Match Import to populate positions from `.mat` files
- [ ] Query `PositionLibrary` table directly via Prisma for custom needs

### Current State (Verified 2025-12-16)

Production database has **460 positions** across all phases:
- OPENING: 21 (all opening rolls)
- EARLY: 93
- MIDDLE: 272
- BEAROFF: 74

All populated via Match Import from Hardee's collection.

---

## Related Documentation

- `developer-guides/09-drill-series-generation-guide.md` - How positions are used
- `developer-guides/11-ground-truth-engine-guide.md` - Engine that analyzes positions
- `specs/completed/scenario-based-drill-position-seeding/` - Original specification
- `lib/positionLibrary/` - Source code
