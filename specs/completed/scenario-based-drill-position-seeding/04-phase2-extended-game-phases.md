# Phase 2: Extended Game Phase Positions

**Slug:** scenario-based-drill-position-seeding-phase2
**Author:** Claude Code
**Date:** 2025-12-13
**Status:** Planned (Implement after Phase 1 MVP)
**Depends on:** Phase 1 - Opening Positions MVP

---

## Overview

This specification extends the Position Seeding feature beyond opening rolls to cover all four game phases:
- **Opening** (Phase 1 - already implemented)
- **Early Game** (Phase 2)
- **Mid-Game** (Phase 2)
- **Bearoff** (Phase 2)

This work was scoped out of Phase 1 to reduce implementation risk. The opening positions are a finite, known set (21 rolls) that can be reliably queried. Other phases require position generation which may need additional engine capabilities.

---

## Prerequisites

Before implementing Phase 2:
1. Phase 1 (opening positions) is working end-to-end
2. Drills are successfully generated using seeded opening positions
3. The Position Library infrastructure is proven stable

---

## 1. Position Generation Approaches

### 1.1 Self-Play Position Generation

Generate positions by having GNUBG play against itself and extracting interesting positions.

```typescript
// lib/positionLibrary/selfPlayGenerator.ts

export interface SelfPlayConfig {
  gamesCount: number         // Number of games to simulate
  positionsPerPhase: number  // Target positions per phase
  minEquitySwing: number     // Minimum equity difference for "instructive"
}

export async function generateSelfPlayPositions(
  engineConfig: GroundTruthConfig,
  config: SelfPlayConfig = {
    gamesCount: 100,
    positionsPerPhase: 20,
    minEquitySwing: 0.05  // 5% equity swing minimum
  }
): Promise<PositionData[]> {
  const positions: PositionData[] = []

  // Request self-play game records from engine
  // NOTE: This requires the engine to support self-play mode
  const games = await requestSelfPlayGames(engineConfig, config.gamesCount)

  for (const game of games) {
    for (const position of game.positions) {
      // Classify game phase
      const phase = classifyGamePhase(position)

      // Check if instructive (tutor mode - significant equity swing)
      if (position.equitySwing >= config.minEquitySwing) {
        // Get best moves for this position
        const analysis = await analyzePosition(engineConfig, position)

        positions.push({
          positionId: position.gnubgId,
          gamePhase: phase,
          diceRoll: position.dice,
          ...analysis,
          sourceType: 'SELF_PLAY',
          sourceRef: game.id,
          asciiBoard: renderAsciiBoard(position)
        })
      }
    }
  }

  // Deduplicate and balance across phases
  return balancePositions(positions, config.positionsPerPhase)
}

function balancePositions(
  positions: PositionData[],
  targetPerPhase: number
): PositionData[] {
  const byPhase: Record<GamePhase, PositionData[]> = {
    OPENING: [],
    EARLY: [],
    MIDDLE: [],
    BEAROFF: []
  }

  // Group by phase
  for (const pos of positions) {
    byPhase[pos.gamePhase].push(pos)
  }

  // Take up to target from each phase
  const balanced: PositionData[] = []
  for (const phase of Object.keys(byPhase) as GamePhase[]) {
    const phasePositions = byPhase[phase]
    // Sort by equity swing (most instructive first)
    phasePositions.sort((a, b) => b.equitySwing - a.equitySwing)
    balanced.push(...phasePositions.slice(0, targetPerPhase))
  }

  return balanced
}
```

### 1.2 Engine API Requirements

For self-play to work, we need the GNUBG MCP wrapper to support:

```typescript
// New tool definition for self-play
{
  type: 'function',
  function: {
    name: 'run_self_play_game',
    description: 'Run a complete game where GNUBG plays against itself, returning all positions.',
    parameters: {
      type: 'object',
      properties: {
        matchLength: {
          type: 'number',
          description: 'Number of points in the match (1 for single game)'
        },
        includeDoubles: {
          type: 'boolean',
          description: 'Whether to include doubling cube decisions'
        }
      },
      required: ['matchLength']
    }
  }
}

// Expected response format
interface SelfPlayGameResult {
  gameId: string
  positions: Array<{
    moveNumber: number
    positionId: string  // GNUBG Position ID
    diceRoll: string
    movePlayed: string
    bestMove: string
    equity: number
    equityLoss: number  // How much worse was the move played vs best?
  }>
  result: 'white_wins' | 'black_wins'
}
```

**Fallback if self-play not supported:**
If the engine doesn't support self-play, we can:
1. Manually curate positions from known sources (Woolsey books, USBGF)
2. Query known position strings from backgammon databases
3. Use match mining from recorded games

---

## 2. Game Phase Classification

### 2.1 Classification Logic

```typescript
// lib/positionLibrary/classifier.ts

export function classifyGamePhase(position: PositionState): GamePhase {
  // Opening: First move of the game
  if (position.moveNumber === 1) {
    return 'OPENING'
  }

  // Bearoff: All checkers in home board (points 1-6)
  if (isAllCheckersInHomeBoard(position)) {
    return 'BEAROFF'
  }

  // Early game: Moves 2-6, still establishing position
  if (position.moveNumber <= 6 && hasBackCheckers(position)) {
    return 'EARLY'
  }

  // Middle game: Default for complex positions with contact
  return 'MIDDLE'
}

function isAllCheckersInHomeBoard(position: PositionState): boolean {
  // Check if all 15 checkers are on points 1-6
  const homeBoard = position.points.slice(0, 6)
  const totalInHome = homeBoard.reduce((sum, count) => sum + count, 0)
  return totalInHome === 15
}

function hasBackCheckers(position: PositionState): boolean {
  // Check if player has checkers in opponent's home board (points 19-24)
  const opponentHome = position.points.slice(18, 24)
  return opponentHome.some(count => count > 0)
}

function hasContact(position: PositionState): boolean {
  // Check if there's any possibility of hitting opponent's checkers
  // This is true if any opponent checker is behind any of our checkers
  let foundOpponent = false
  let foundOurs = false

  for (let i = 23; i >= 0; i--) {
    if (position.opponentPoints[i] > 0) foundOpponent = true
    if (position.ourPoints[i] > 0) foundOurs = true
    if (foundOpponent && foundOurs) return true
  }

  return false
}
```

### 2.2 Position State Parsing

```typescript
// Parse GNUBG Position ID to board state
interface PositionState {
  moveNumber: number
  points: number[]        // 24 points, our checkers
  opponentPoints: number[] // 24 points, opponent checkers
  bar: number             // Checkers on bar
  opponentBar: number
  bearoff: number         // Checkers borne off
  opponentBearoff: number
}

export function parsePositionId(positionId: string): PositionState {
  // GNUBG Position ID is a Base64 encoded representation
  // Decode and parse according to GNUBG specification
  // See: https://www.gnu.org/software/gnubg/manual/html_node/A-technical-description-of-the-Position-ID.html

  const decoded = Buffer.from(positionId, 'base64')
  // ... parsing logic based on GNUBG spec

  return {
    moveNumber: 0, // Need to track separately
    points: [],
    opponentPoints: [],
    bar: 0,
    opponentBar: 0,
    bearoff: 0,
    opponentBearoff: 0
  }
}
```

---

## 3. Extended Database Fields

Phase 2 may want to add these fields back to PositionLibrary:

```prisma
model PositionLibrary {
  // ... Phase 1 fields ...

  // Phase 2 additions:
  equitySwing     Float?            // Difference between best and worst common move
  isInstructive   Boolean @default(true)  // Tutor mode flagged
  principleIds    String[]          // Which principles this teaches (AI-tagged)
  teachingNotes   String?           // Why this position is instructive
  matchId         String?           // GNUBG Match ID for context
  sourceRef       String?           // Reference to source match/game

  // Usage tracking (for variety)
  usageCount      Int      @default(0)
  lastUsedAt      DateTime?
}
```

---

## 4. Intelligent Position Selection

### 4.1 Usage-Based Selection

Avoid repetition by tracking which positions have been used:

```typescript
export async function seedPositionsWithVariety(
  config: SeedingConfig
): Promise<Record<GamePhase, SeededPosition[]>> {
  const result: Record<GamePhase, SeededPosition[]> = {
    OPENING: [],
    EARLY: [],
    MIDDLE: [],
    BEAROFF: []
  }

  for (const phase of Object.keys(config.targetCounts) as GamePhase[]) {
    const targetCount = config.targetCounts[phase]

    // Query position library, preferring less-used positions
    const positions = await prisma.positionLibrary.findMany({
      where: {
        engineId: config.engineId,
        gamePhase: phase,
        isInstructive: true,
        ...(config.excludeUsedRecently && {
          OR: [
            { lastUsedAt: null },
            { lastUsedAt: { lt: subDays(new Date(), config.recentlyUsedDays || 7) } }
          ]
        })
      },
      orderBy: [
        { usageCount: 'asc' },   // Prefer less-used positions
        { equitySwing: 'desc' }  // Prefer more instructive
      ],
      take: targetCount
    })

    // Update usage tracking
    await prisma.positionLibrary.updateMany({
      where: { id: { in: positions.map(p => p.id) } },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    })

    result[phase] = positions.map(positionToSeededPosition)
  }

  return result
}
```

### 4.2 Principle-Based Selection

Balance positions to cover all principles from the mental model:

```typescript
export async function seedPositionsBalancedByPrinciple(
  config: SeedingConfig & { principleIds: string[] }
): Promise<Record<GamePhase, SeededPosition[]>> {
  // Ensure each principle has at least one position that teaches it
  const principlesCovered = new Set<string>()
  const selected: PositionData[] = []

  // First pass: ensure principle coverage
  for (const principleId of config.principleIds) {
    const position = await prisma.positionLibrary.findFirst({
      where: {
        engineId: config.engineId,
        principleIds: { has: principleId },
        id: { notIn: selected.map(p => p.id) }
      },
      orderBy: { usageCount: 'asc' }
    })

    if (position) {
      selected.push(position)
      principlesCovered.add(principleId)
    }
  }

  // Second pass: fill remaining with best available
  // ...
}
```

---

## 5. Match Mining (Alternative Source)

If self-play doesn't work, mine positions from recorded matches:

```typescript
// lib/positionLibrary/matchMiner.ts

export async function minePositionsFromMatches(
  engineConfig: GroundTruthConfig,
  matchFiles: string[]  // Paths to SGF or MAT files
): Promise<PositionData[]> {
  const positions: PositionData[] = []

  for (const file of matchFiles) {
    // Load match via engine
    const match = await loadMatchFile(engineConfig, file)

    for (const game of match.games) {
      for (const position of game.positions) {
        // Only include positions where a non-trivial decision was made
        if (position.equityLoss > 0.02) {  // Error threshold
          const phase = classifyGamePhase(position)

          positions.push({
            positionId: position.gnubgId,
            gamePhase: phase,
            diceRoll: position.dice,
            bestMove: position.bestMove,
            bestMoveEquity: position.bestEquity,
            secondBestMove: position.moves[1]?.move,
            secondEquity: position.moves[1]?.equity,
            asciiBoard: renderAsciiBoard(position),
            sourceType: 'MATCH_MINING',
            sourceRef: `${file}:game${game.number}:move${position.moveNumber}`
          })
        }
      }
    }
  }

  return deduplicatePositions(positions)
}
```

---

## 6. Target Position Counts

| Phase | Initial Target | Notes |
|-------|---------------|-------|
| Opening | 21 (complete) | All unique first rolls |
| Early | 20 | Moves 2-6, establishing position |
| Middle | 30 | Where most complexity lives |
| Bearoff | 20 | Race/endgame positions |
| **Total** | **91** | Expandable as needed |

---

## 7. Implementation Tasks

### Phase 2a: Position Generation Infrastructure
- [ ] Add self-play tool to engine (if supported)
- [ ] Implement game phase classifier
- [ ] Implement position ID parser
- [ ] Add ASCII renderer for arbitrary positions

### Phase 2b: Database Extensions
- [ ] Add Phase 2 fields to PositionLibrary
- [ ] Migrate existing data
- [ ] Add indexes for new query patterns

### Phase 2c: Position Population
- [ ] Generate/mine early game positions (20)
- [ ] Generate/mine mid-game positions (30)
- [ ] Generate/mine bearoff positions (20)
- [ ] Verify all positions with engine

### Phase 2d: Drill Generation Updates
- [ ] Update seeder to fetch from all phases
- [ ] Update prompt to include all phases
- [ ] Test drill quality across phases

---

## 8. Success Criteria

- [ ] 20+ early game positions populated
- [ ] 30+ mid-game positions populated
- [ ] 20+ bearoff positions populated
- [ ] Drills generated for all phases
- [ ] No duplicate positions across phases
- [ ] Variety in positions used (usage tracking works)

---

## 9. Timeline Estimate

- **Week 1**: Engine capability assessment, classifier implementation
- **Week 2**: Position generation/mining pipeline
- **Week 3**: Database updates, drill generation integration
- **Week 4**: Testing and refinement

**Total**: ~4 weeks after Phase 1 is stable
