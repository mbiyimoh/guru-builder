# Self-Play Position Generator

**Slug:** self-play-position-generator
**Author:** Claude Code
**Date:** 2025-12-23
**Branch:** feat/self-play-position-generator
**Related:**
- `specs/completed/scenario-based-drill-position-seeding/04-phase2-extended-game-phases.md`
- `developer-guides/10-position-library-guide.md`

---

## 1) Intent & Assumptions

**Task brief:** Build a system that uses the GNUBG engine to simulate games (self-play) and document all positions that occur throughout those games, storing them in the Position Library. Users should be able to request "play N games and save all the unique positions," with the system automatically tagging positions by game phase and skipping duplicates.

**Assumptions:**
- The GNUBG MCP server is already deployed and accessible (used for ground truth verification)
- We need to add a new MCP tool or endpoint to the GNUBG wrapper to support self-play (current tools are `opening` and `plays` only)
- Positions will be stored with `sourceType: 'SELF_PLAY'` to distinguish from match imports and opening catalog
- The existing phase classification logic (`lib/matchImport/phaseClassifier.ts`) can be reused
- The existing replay engine board state management can be reused
- Self-play can run as a background Inngest job to handle long-running generation
- Deduplication is based on the unique `positionId` (derived from board state + dice + player)

**Out of scope:**
- Modifying GNUBG core - we'll work within MCP wrapper capabilities
- Real-time streaming of positions during generation (batch only)
- Custom neural net training or alternative engines
- Match result statistics (wins/losses) - focus is position extraction
- Curated position metadata (names, descriptions, difficulty ratings)

---

## 2) Pre-reading Log

- `lib/positionLibrary/types.ts`: Defines `SeededPosition`, `PositionData`, `AlternativeMove`, game phases. Source types include `SELF_PLAY` which is already defined.
- `lib/positionLibrary/seeder.ts`: Fetches positions from DB for drill generation. Uses `shuffleArray` for variety. Handles OPENING specially (no shuffle).
- `lib/positionLibrary/openings.ts`: `populateOpeningPositions()` queries GNUBG for 21 opening rolls. Pattern to follow for self-play population.
- `lib/matchImport/replayEngine.ts`: Board state management, `generatePositionIdFromBoard()`, `generateAsciiBoard()`. Core utilities we'll reuse.
- `lib/matchImport/phaseClassifier.ts`: `classifyPhase()` determines OPENING/EARLY/MIDDLE/BEAROFF. Will reuse for self-play positions.
- `lib/groundTruth/mcpClient.ts`: MCP client with `getOpeningMoves()` and `getPlaysForPosition()`. Need to extend with self-play capability.
- `prisma/schema.prisma`: `PositionLibrary` model with all required fields. `PositionSource` enum includes `SELF_PLAY`.
- `lib/inngest-functions.ts`: Background job patterns for match import. Model for self-play job.
- `specs/completed/scenario-based-drill-position-seeding/04-phase2-extended-game-phases.md`: Original self-play spec with `SelfPlayConfig` interface design.
- `developer-guides/10-position-library-guide.md`: Current state (460 positions), deprecated code patterns to avoid.

---

## 3) Codebase Map

**Primary components/modules:**
- `lib/positionLibrary/` - Position storage and retrieval
- `lib/groundTruth/mcpClient.ts` - Engine communication
- `lib/matchImport/replayEngine.ts` - Board state utilities
- `lib/matchImport/phaseClassifier.ts` - Phase classification
- `lib/inngest-functions.ts` - Background job orchestration
- `app/api/position-library/` - API routes for position management

**Shared dependencies:**
- Prisma client for database access
- Inngest for background job scheduling
- GNUBG MCP server (external service)

**Data flow:**
```
User triggers generation (API/UI)
    → Inngest job starts
    → MCP client calls GNUBG self-play tool
    → GNUBG plays N games, returns position stream
    → For each position:
        → Classify phase
        → Generate positionId
        → Check for duplicates
        → Query GNUBG for best moves analysis
        → Store in PositionLibrary
    → Return summary (total generated, by phase, duplicates skipped)
```

**Feature flags/config:**
- `GroundTruthEngine.enabled` - Must be true for engine access
- Environment: `GNUBG_MCP_URL` or engine config from DB

**Potential blast radius:**
- New MCP tool required on GNUBG wrapper (external dependency)
- New Inngest function (isolated)
- New API routes (isolated)
- No changes to existing position seeding or drill generation

---

## 4) Root Cause Analysis

N/A - This is a new feature, not a bug fix.

---

## 5) Research

### Position Generation Approaches

#### Approach 1: Extend GNUBG MCP Server with Self-Play Tool

**Description:** Add a new `run_self_play` tool to the GNUBG MCP wrapper that plays complete games and returns all positions.

**How it works:**
1. MCP client calls `run_self_play` with parameters (match length, games count)
2. GNUBG MCP wrapper executes:
   ```
   set player 0 gnubg
   set player 1 gnubg
   set automatic roll on
   set automatic game on
   new match {length}
   ```
3. After each move, extracts board state and returns position data
4. Returns array of all positions with dice, moves played, board states

**Pros:**
- Clean separation of concerns (GNUBG handles game logic)
- Single API call triggers entire game generation
- Consistent with existing MCP architecture
- Position data comes pre-formatted

**Cons:**
- Requires modifying GNUBG MCP wrapper (external dependency)
- Large response payload for long games
- No streaming - must wait for full game completion
- MCP wrapper maintenance burden increases

**Implementation complexity:** Medium - GNUBG wrapper change required

---

#### Approach 2: Client-Side Game Simulation Using `plays` Tool

**Description:** Simulate games entirely client-side by repeatedly calling the existing `plays` tool for each position, making optimal moves, and advancing the game state.

**How it works:**
1. Start with opening position (standard board setup)
2. Roll random dice
3. Call `getPlaysForPosition()` to get best move for current position
4. Apply best move to advance board state
5. Repeat from step 2 until game ends (one player bears off all checkers)
6. Store each position encountered

**Pros:**
- No GNUBG wrapper changes needed
- Uses existing, proven MCP tools
- Full control over game flow
- Can pause/resume mid-game
- Easier to add position filtering logic

**Cons:**
- Many API calls per game (30-60 moves per game = 60-120 calls)
- Must implement game logic client-side (move application, win detection)
- Higher latency due to round-trips
- Need to handle cube decisions or skip them

**Implementation complexity:** Medium-High - Game logic implementation needed

---

#### Approach 3: Hybrid - MCP Self-Play with Position Filtering

**Description:** Add a lightweight `play_one_game` MCP tool that returns only the game record (moves played), then client processes the record to extract positions.

**How it works:**
1. MCP tool plays one complete game using GNUBG commands
2. Returns compact game record: `[(dice, move), (dice, move), ...]`
3. Client replays game to reconstruct board states
4. Client calls `plays` tool for analysis only on selected positions
5. Stores positions meeting criteria (phase distribution, equity swing)

**Pros:**
- Smaller MCP response payload
- Reuses existing `replayEngine.ts` for board reconstruction
- Can filter positions before expensive analysis calls
- Balances server vs client work

**Cons:**
- Still requires GNUBG wrapper modification
- Two-phase process (generate then analyze)
- Replay logic must match GNUBG exactly

**Implementation complexity:** Medium - Wrapper change + client replay

---

#### Approach 4: Batch File Processing via GNUBG CLI

**Description:** Generate games by running GNUBG CLI with command files, save to SGF, then import SGF files via existing match import system.

**How it works:**
1. Generate GNUBG command file programmatically
2. Execute `gnubg -t -c commands.txt` via subprocess
3. GNUBG saves games as SGF files
4. Import SGF files using modified match import pipeline
5. Parse and store positions as `SELF_PLAY` source type

**Pros:**
- No MCP wrapper changes needed
- Proven GNUBG batch capability
- SGF format well-documented
- Reuses match import infrastructure

**Cons:**
- Requires GNUBG CLI installed on server
- File I/O overhead (write commands, write SGF, read SGF)
- SGF parsing complexity (different from JellyFish format)
- Subprocess management complexity
- Not suitable for serverless/Railway environment

**Implementation complexity:** High - New parser + subprocess management

---

### Recommendation

**Recommended Approach: #2 (Client-Side Game Simulation Using `plays` Tool)**

**Rationale:**

1. **No external dependencies:** Works with existing GNUBG MCP tools. No need to coordinate wrapper changes.

2. **Incremental delivery:** Can generate and store positions as we go, providing progress visibility.

3. **Better control:** Can implement sophisticated filtering (skip boring positions, target specific phases, detect instructive moments).

4. **Fault tolerance:** Can resume from any position if job fails. Each API call is independent.

5. **Alignment with codebase:** Reuses `replayEngine.ts` board state logic that's already battle-tested from match import.

**Trade-off acceptance:** The higher number of API calls is acceptable because:
- Inngest handles long-running jobs gracefully
- Can batch multiple games in single job
- Rate limiting can be implemented if needed
- Total positions needed is finite (targeting ~200-500 more across phases)

**Implementation sketch:**
```typescript
// lib/positionLibrary/selfPlayGenerator.ts

interface SelfPlayConfig {
  gamesCount: number          // How many games to simulate
  matchLength: number         // Points per match (1 = single game)
  targetPositionsPerPhase?: number  // Stop when reached
  skipOpening: boolean        // Don't store opening positions (we have catalog)
  minEquitySwing?: number     // Only store "interesting" positions
}

async function simulateSelfPlayGames(
  engineConfig: GroundTruthConfig,
  config: SelfPlayConfig
): Promise<SelfPlayResult> {
  const positions: PositionData[] = []

  for (let game = 0; game < config.gamesCount; game++) {
    let board = INITIAL_BOARD
    let moveNumber = 0

    while (!isGameOver(board)) {
      const dice = rollDice()
      const player = moveNumber % 2 === 0 ? 'x' : 'o'

      // Get best move from engine
      const boardConfig = boardStateToMCPFormat(board, dice, player)
      const moves = await getPlaysForPosition(boardConfig, engineConfig)

      if (moves.length === 0) break // No legal moves

      const bestMove = moves[0]

      // Store position (with filtering)
      if (shouldStorePosition(board, dice, moveNumber, config)) {
        const positionId = generatePositionIdFromBoard(board, dice, player)
        const phase = classifyPhase({ board, dice, moveNumber, ... })

        positions.push({
          positionId,
          gamePhase: phase.phase,
          diceRoll: formatDice(dice),
          bestMove: formatMove(bestMove.play),
          bestMoveEquity: bestMove.evaluation.eq,
          // ... etc
        })
      }

      // Apply move to advance game
      board = applyMove(board, bestMove.play, player)
      moveNumber++
    }
  }

  return { positions, gamesPlayed: config.gamesCount }
}
```

---

## 6) Clarification

The following decisions would benefit from user input:

1. **Game simulation fidelity:**
   - Should games include doubling cube decisions, or money play only?
   - Should we simulate match play (Crawford rule, score-based strategy) or single games?
   - *Recommendation:* Start with money play (no cube) for simplicity
   >> follow your recommendation. we can add those other bells and whistles later

2. **Position filtering criteria:**
   - Store ALL positions, or only "instructive" ones (equity swing > threshold)?
   - If filtering, what equity swing threshold? (0.05 = 5%?)
   - *Recommendation:* Store all positions initially, filter later if needed
   >> follow your recommendation
   

3. **Target position counts:**
   - How many positions per phase do we want to add?
   - Current: OPENING=21, EARLY=93, MIDDLE=272, BEAROFF=74
   - *Recommendation:* Target 50-100 more per non-opening phase
   >> follow your recommendation for the "first run" re: adding more positions to our seed library but the idea is that at least from the admin view, you would have the ability to go view this library and also use this new self plate engine to go fetch some more positions to add to the library if and when you want to do that.

4. **Duplicate handling:**
   - Same position with different dice is different entry (current behavior) - keep?
   - *Recommendation:* Yes, keep current behavior (different decisions for different dice)
   >> yes, follow your recommendation

5. **UI exposure:**
   - Admin-only feature, or available to all users?
   - Trigger via API only, or add UI button?
   - *Recommendation:* Admin-only API initially, UI later if successful
   >> follow your recommendation with additional context from my answer to #3 being relevant here 

6. **Self-play metadata:**
   - Should we store which game a position came from (like match import)?
   - *Recommendation:* Yes, store `selfPlayBatchId` + `gameNumber` + `moveNumber`
   >> follow your recommendation

7. **Parallelization:**
   - Run multiple games in parallel, or sequentially?
   - *Recommendation:* Sequential initially for simplicity, parallelize later
   >> follow your recommendation

---

## Appendix: Alternative Self-Play Tool Design

If we later decide to extend the GNUBG MCP wrapper, here's the tool specification:

```typescript
// New MCP tool: run_self_play
{
  name: 'run_self_play',
  description: 'Play complete backgammon games with GNUBG against itself',
  inputSchema: {
    type: 'object',
    properties: {
      gamesCount: {
        type: 'number',
        description: 'Number of games to play (default: 1)'
      },
      matchLength: {
        type: 'number',
        description: 'Match length in points (1 = single game, default: 1)'
      },
      includeCube: {
        type: 'boolean',
        description: 'Include doubling cube decisions (default: false)'
      },
      analysisPlies: {
        type: 'number',
        description: 'Analysis depth for move evaluation (default: 2)'
      }
    }
  }
}

// Response format
interface SelfPlayResponse {
  games: Array<{
    gameId: string
    winner: 'x' | 'o'
    positions: Array<{
      moveNumber: number
      player: 'x' | 'o'
      dice: [number, number]
      board: BoardPosition
      movePlayed: string
      bestMove: string
      equity: number
      equityLoss: number
      probability: ProbabilityBreakdown
    }>
  }>
}
```

This would be the cleanest long-term solution but requires external coordination.
