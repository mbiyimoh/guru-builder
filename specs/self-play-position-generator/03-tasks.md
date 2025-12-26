# Self-Play Position Generator - Task Breakdown

**Spec:** `02-specification.md`
**Status:** Ready for Implementation
**Total Tasks:** 24
**Estimated Parallelization:** ~60% (14 tasks can run in parallel groups)

---

## Parallelization Summary

```
Phase 0 (Sequential): 1 task
Phase 1 (Sequential): 2 tasks
Phase 2 (Parallel Group A): 4 tasks can run in parallel
Phase 3 (Parallel Group B): 8 unit tests can run in parallel after Phase 2
Phase 4 (Sequential): 2 tasks (depends on Phase 1 + 2)
Phase 5 (Parallel Group C): 2 API routes can be built in parallel
Phase 6 (Sequential): 3 tasks
Phase 7 (Parallel Group D): 2 documentation tasks can run in parallel
```

---

## Phase 0: Prerequisites (Sequential)

### Task 0.1: Add Admin Auth Helpers
**File:** `lib/auth.ts`
**Type:** Code Addition
**Dependencies:** None
**Parallelizable:** No (foundation for API routes)

Add two helper functions for admin authentication:

```typescript
/**
 * Check if current user is an admin (non-throwing)
 * Returns authorization status and user object for flexible API handling
 */
export async function checkAdminAuth(): Promise<{ authorized: boolean; user: User | null }> {
  const user = await getCurrentUser()
  if (!user) {
    return { authorized: false, user: null }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  if (!adminEmail) {
    console.warn('[Auth] ADMIN_EMAIL not configured')
    return { authorized: false, user }
  }

  const isAdmin = user.email.toLowerCase() === adminEmail
  return { authorized: isAdmin, user }
}

/**
 * Require admin user - throws if not authenticated or not admin
 * Consistent with requireUser() and requireProjectOwnership() patterns
 */
export async function requireAdmin(): Promise<User> {
  const { authorized, user } = await checkAdminAuth()
  if (!user) {
    throw new Error('Unauthorized')
  }
  if (!authorized) {
    throw new Error('Forbidden')
  }
  return user
}
```

**Acceptance Criteria:**
- [ ] `checkAdminAuth()` exported from `lib/auth.ts`
- [ ] `requireAdmin()` exported from `lib/auth.ts`
- [ ] `checkAdminAuth()` returns `{ authorized: true, user }` for admin email
- [ ] `checkAdminAuth()` returns `{ authorized: false, user }` for non-admin
- [ ] `checkAdminAuth()` returns `{ authorized: false, user: null }` when not logged in
- [ ] `requireAdmin()` throws 'Unauthorized' when not logged in
- [ ] `requireAdmin()` throws 'Forbidden' when not admin
- [ ] Logs warning when `ADMIN_EMAIL` not configured

---

## Phase 1: Database Schema (Sequential)

### Task 1.1: Add Prisma Schema Models
**File:** `prisma/schema.prisma`
**Type:** Schema Addition
**Dependencies:** None
**Parallelizable:** No (must complete before migration)

Add to schema:

1. `SelfPlayStatus` enum
2. `SelfPlayBatch` model with all fields
3. Self-play tracking fields on `PositionLibrary`
4. Relation from `GroundTruthEngine` to `SelfPlayBatch`

**Acceptance Criteria:**
- [ ] `SelfPlayStatus` enum added (PENDING, RUNNING, COMPLETED, FAILED)
- [ ] `SelfPlayBatch` model with all tracking fields
- [ ] `PositionLibrary` has `selfPlayBatchId`, `selfPlayGameNum`, `selfPlayMoveNum`
- [ ] All indexes defined
- [ ] Foreign key relations correct

---

### Task 1.2: Run Database Migration
**Command:** `npm run db:backup && npm run migrate:safe -- add-self-play-batch`
**Type:** Migration
**Dependencies:** Task 1.1
**Parallelizable:** No

**Acceptance Criteria:**
- [ ] Backup completed successfully
- [ ] Migration runs without errors
- [ ] `SelfPlayBatch` table exists in DB
- [ ] `PositionLibrary` has new columns
- [ ] Verify in Prisma Studio

---

## Phase 2: Self-Play Generator Core (Parallel Group A)

These 4 tasks can be developed in parallel after Phase 1, then integrated.

### Task 2.1: Dice Utilities
**File:** `lib/positionLibrary/selfPlayGenerator.ts`
**Type:** Code Creation
**Dependencies:** Phase 1
**Parallelizable:** Yes (with 2.2, 2.3, 2.4)

Implement:
- `rollDice(): [number, number]`
- `formatDiceRoll(dice: [number, number]): string`

```typescript
function rollDice(): [number, number] {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return [die1, die2]
}

function formatDiceRoll(dice: [number, number]): string {
  const [d1, d2] = dice
  return d1 >= d2 ? `${d1}-${d2}` : `${d2}-${d1}`
}
```

**Acceptance Criteria:**
- [ ] `rollDice()` returns values 1-6 for both dice
- [ ] `formatDiceRoll()` puts larger die first

---

### Task 2.2: Game Over Detection
**File:** `lib/positionLibrary/selfPlayGenerator.ts`
**Type:** Code Creation
**Dependencies:** Phase 1
**Parallelizable:** Yes (with 2.1, 2.3, 2.4)

Implement:
- `isGameOver(board: BoardState): { over: boolean; winner?: 'x' | 'o' }`

Must handle:
- X's bar (index 0)
- O's bar (index 25)
- Points 1-24 with positive (X) and negative (O) values

**Acceptance Criteria:**
- [ ] Returns `{ over: false }` for starting position
- [ ] Returns `{ over: true, winner: 'x' }` when X has no checkers
- [ ] Returns `{ over: true, winner: 'o' }` when O has no checkers
- [ ] Correctly counts bar checkers

---

### Task 2.3: Move Application
**File:** `lib/positionLibrary/selfPlayGenerator.ts`
**Type:** Code Creation
**Dependencies:** Phase 1, imports from `replayEngine.ts`
**Parallelizable:** Yes (with 2.1, 2.2, 2.4)

Implement:
- `applyGnubgMove(board, play, player): BoardState`

Must handle:
- Simple point-to-point moves
- Bar entry (from: "bar")
- Bearing off (to: "off")
- Hitting opponent blots
- O player coordinate conversion (GNUBG uses O's perspective)

**Acceptance Criteria:**
- [ ] Correctly moves X checkers
- [ ] Correctly moves O checkers (coordinate conversion)
- [ ] Handles bar entry
- [ ] Handles bearing off
- [ ] Hits blots and sends to bar
- [ ] Returns new board (doesn't mutate input)

---

### Task 2.4: Single Game Simulation
**File:** `lib/positionLibrary/selfPlayGenerator.ts`
**Type:** Code Creation
**Dependencies:** Tasks 2.1, 2.2, 2.3
**Parallelizable:** Yes (can start structure, integrate after 2.1-2.3)

Implement:
- `simulateSingleGame(engineConfig, gameNumber, skipOpening): Promise<{ positions, errors }>`
- `runSelfPlayBatch(config): Promise<SelfPlayResult>`

**Acceptance Criteria:**
- [ ] Plays from INITIAL_BOARD to game over
- [ ] Calls GNUBG for each move decision
- [ ] Stores positions with full analysis data
- [ ] Handles no legal moves (skip turn)
- [ ] Safety limit of 200 moves per game
- [ ] Collects errors without stopping
- [ ] Batch runner deduplicates within batch

---

## Phase 3: Unit Tests (Parallel Group B)

All 8 tests can run in parallel after Phase 2 tasks 2.1-2.3 complete.

### Task 3.1: Test rollDice
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.1
**Parallelizable:** Yes (with all Phase 3 tasks)

```typescript
it('returns values 1-6 for both dice', () => {
  for (let i = 0; i < 100; i++) {
    const [d1, d2] = rollDice()
    expect(d1).toBeGreaterThanOrEqual(1)
    expect(d1).toBeLessThanOrEqual(6)
    expect(d2).toBeGreaterThanOrEqual(1)
    expect(d2).toBeLessThanOrEqual(6)
  }
})
```

---

### Task 3.2: Test formatDiceRoll
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.1
**Parallelizable:** Yes

Test larger die comes first: `[4, 6]` → `"6-4"`

---

### Task 3.3: Test isGameOver Starting Position
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.2
**Parallelizable:** Yes

```typescript
it('returns false for starting position', () => {
  expect(isGameOver(INITIAL_BOARD).over).toBe(false)
})
```

---

### Task 3.4: Test isGameOver X Wins
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.2
**Parallelizable:** Yes

Create board with no X checkers, verify `{ over: true, winner: 'x' }`

---

### Task 3.5: Test applyGnubgMove Simple Move
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.3
**Parallelizable:** Yes

Test moving a single checker from point to point.

---

### Task 3.6: Test applyGnubgMove Bar Entry
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.3
**Parallelizable:** Yes

Test entering from bar with `from: "bar"`.

---

### Task 3.7: Test applyGnubgMove Hitting Blot
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.3
**Parallelizable:** Yes

Test landing on opponent's blot sends to bar.

---

### Task 3.8: Test applyGnubgMove Bearing Off
**File:** `tests/unit-self-play.spec.ts`
**Dependencies:** Task 2.3
**Parallelizable:** Yes

Test bearing off with `to: "off"`.

---

## Phase 4: Inngest Background Job (Sequential)

### Task 4.1: Create Inngest Job Function
**File:** `lib/inngest-functions.ts`
**Type:** Code Addition
**Dependencies:** Phase 1, Phase 2
**Parallelizable:** No

Add `selfPlayGenerationJob` with:
- Step: update-status-running
- Step: get-engine-config
- Step: simulate-games
- Step: filter-existing (DB deduplication)
- Step: store-positions
- Step: mark-complete

**Acceptance Criteria:**
- [ ] Concurrency limit of 1
- [ ] Retries: 2
- [ ] Progress updates every 5 games
- [ ] Handles errors gracefully
- [ ] Updates batch record at each step

---

### Task 4.2: Register Job in Inngest Serve
**File:** `app/api/inngest/route.ts` (or wherever serve is)
**Type:** Code Addition
**Dependencies:** Task 4.1
**Parallelizable:** No

Add `selfPlayGenerationJob` to the functions array.

**Acceptance Criteria:**
- [ ] Job visible in Inngest dev UI
- [ ] Can be triggered manually for testing

---

## Phase 5: API Routes (Parallel Group C)

### Task 5.1: Self-Play Trigger Route
**File:** `app/api/position-library/self-play/route.ts`
**Type:** File Creation
**Dependencies:** Phase 0, Phase 1, Phase 4
**Parallelizable:** Yes (with 5.2)

Implement:
- `POST` - Start new self-play batch
- `GET` - List recent batches

**Acceptance Criteria:**
- [ ] Requires admin auth
- [ ] Validates engineId exists and enabled
- [ ] Validates gamesCount 1-100
- [ ] Creates SelfPlayBatch record
- [ ] Triggers Inngest job
- [ ] Returns batchId

---

### Task 5.2: Batch Status Route
**File:** `app/api/position-library/self-play/[batchId]/route.ts`
**Type:** File Creation
**Dependencies:** Phase 0, Phase 1
**Parallelizable:** Yes (with 5.1)

Implement:
- `GET` - Get batch status and details

**Acceptance Criteria:**
- [ ] Requires admin auth
- [ ] Returns full batch details
- [ ] Includes position count
- [ ] 404 if batch not found

---

## Phase 6: Admin UI (Sequential)

### Task 6.1: Create SelfPlayGenerator Component
**File:** `components/admin/SelfPlayGenerator.tsx`
**Type:** File Creation
**Dependencies:** Phase 5
**Parallelizable:** No

Create React component with:
- Games count input (1-100)
- Generate button
- Progress display with polling
- Results summary

**Acceptance Criteria:**
- [ ] Form validates input
- [ ] Disables button during generation
- [ ] Polls every 2 seconds
- [ ] Shows progress bar
- [ ] Shows completion summary with phase breakdown
- [ ] "Generate More" resets state

---

### Task 6.2: Integrate into Position Library Page
**File:** Likely `app/admin/position-library/page.tsx` or similar
**Type:** Code Addition
**Dependencies:** Task 6.1
**Parallelizable:** No

Add `<SelfPlayGenerator engineId={...} />` to the page.

**Acceptance Criteria:**
- [ ] Component appears on Position Library admin page
- [ ] Receives correct engineId prop
- [ ] Styled consistently with page

---

### Task 6.3: End-to-End UI Test
**Type:** Manual Testing
**Dependencies:** Task 6.2
**Parallelizable:** No

Full flow test:
1. Navigate to Position Library admin
2. Click "Generate Positions"
3. Enter games count (e.g., 5)
4. Monitor progress
5. Verify completion summary
6. Check database for new positions

**Acceptance Criteria:**
- [ ] Full flow works without errors
- [ ] Progress updates visible
- [ ] Positions appear in library
- [ ] Duplicates correctly skipped

---

## Phase 7: Documentation (Parallel Group D)

### Task 7.1: Update Position Library Guide
**File:** `developer-guides/10-position-library-guide.md`
**Type:** Documentation
**Dependencies:** All previous phases
**Parallelizable:** Yes (with 7.2)

Add section covering:
- Self-play generation overview
- How to trigger via Admin UI
- How to trigger via API
- Expected position counts per game
- Troubleshooting

---

### Task 7.2: Update CLAUDE.md
**File:** `.claude/CLAUDE.md`
**Type:** Documentation
**Dependencies:** All previous phases
**Parallelizable:** Yes (with 7.1)

Add to Position Library section:
- Self-play generation capability
- Key files (`selfPlayGenerator.ts`, API routes)
- Inngest job name: `self-play-generation`
- Admin auth requirement

---

## Execution Order with Parallelization

```
Week 1:
├── Day 1:
│   ├── Task 0.1 (checkAdminAuth + requireAdmin)
│   ├── Task 1.1 (Prisma schema)
│   └── Task 1.2 (Migration)
│
├── Day 2 (Parallel):
│   ├── Task 2.1 (Dice utilities)
│   ├── Task 2.2 (isGameOver)
│   ├── Task 2.3 (applyGnubgMove)
│   └── Task 2.4 (simulateSingleGame) - start
│
├── Day 3 (Parallel):
│   ├── Task 2.4 (complete integration)
│   ├── Tasks 3.1-3.8 (all unit tests in parallel)
│
├── Day 4:
│   ├── Task 4.1 (Inngest job)
│   └── Task 4.2 (Register job)
│
├── Day 5 (Parallel):
│   ├── Task 5.1 (POST/GET routes)
│   └── Task 5.2 (batchId route)
│
Week 2:
├── Day 1:
│   ├── Task 6.1 (SelfPlayGenerator component)
│   └── Task 6.2 (Integrate into page)
│
├── Day 2:
│   └── Task 6.3 (E2E UI test)
│
├── Day 3 (Parallel):
│   ├── Task 7.1 (Update guide)
│   └── Task 7.2 (Update CLAUDE.md)
```

---

## Summary

| Phase | Tasks | Parallelizable | Notes |
|-------|-------|----------------|-------|
| 0 | 1 | No | Foundation |
| 1 | 2 | No | Schema changes |
| 2 | 4 | Yes (Group A) | Core logic can develop in parallel |
| 3 | 8 | Yes (Group B) | All tests can run in parallel |
| 4 | 2 | No | Inngest integration |
| 5 | 2 | Yes (Group C) | Both API routes in parallel |
| 6 | 3 | No | UI requires sequential integration |
| 7 | 2 | Yes (Group D) | Docs can update in parallel |

**Total:** 24 tasks
**Parallelizable:** 14 tasks (~60%)
**Critical Path:** Phase 0 → Phase 1 → Phase 2 → Phase 4 → Phase 5 → Phase 6
