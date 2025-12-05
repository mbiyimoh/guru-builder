# Task Breakdown: Detailed GNU Backgammon Evaluation Display

**Generated:** November 17, 2025
**Source:** specs/feat-backgammon-detailed-evaluation-display-lean.md
**Total Tasks:** 4
**Implementation Phases:** 1 (single cohesive feature)

---

## Overview

Enable users to view detailed GNU Backgammon evaluation data (win/lose probabilities, gammon/backgammon percentages, equity differential, search depth) by clicking on any move in the ground truth results. The data already exists in engine responses but is currently discarded during parsing.

**Key Insight:** This requires NO new API calls - we're already receiving all this data, just need to preserve and display it.

---

## Task Dependency Graph

```
Task 1 (Type Definitions)
    ↓
Task 2 (Engine Parsing) ← Can run parallel with Task 3 after Task 1
    ↓
Task 3 (Modal Component) ← Can run parallel with Task 2 after Task 1
    ↓
Task 4 (UI Integration) ← Requires Tasks 2 & 3
```

**Critical Path:** Task 1 → Task 2 → Task 4 (Tasks 2 & 3 can run in parallel)

---

## Phase 1: Complete Feature Implementation

### Task 1.1: Extend Type Definitions for Detailed Evaluation Data

**Description:** Add `MoveEvaluation` interface and extend `BackgammonMove` to preserve full engine evaluation data
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (foundation for all other tasks)

**File:** `lib/assessment/types.ts`

**Technical Requirements:**
- Add new `MoveEvaluation` interface with equity, diff, probability, and info fields
- Extend existing `BackgammonMove` interface with optional `evaluation` field
- Maintain backward compatibility (equity field remains required)
- All probability fields should be 0-1 range (not percentages)

**Implementation:**

```typescript
// lib/assessment/types.ts

// ADD: Detailed evaluation from GNU Backgammon engine
export interface MoveEvaluation {
  equity: number           // Equity value (same as BackgammonMove.equity)
  diff: number            // Difference from best move (0 for best move)
  probability: {
    win: number           // Probability of winning (0-1)
    lose: number          // Probability of losing (0-1)
    winG: number          // Probability of winning gammon (0-1)
    loseG: number         // Probability of losing gammon (0-1)
    winBG: number         // Probability of winning backgammon (0-1)
    loseBG: number        // Probability of losing backgammon (0-1)
  }
  info: {
    cubeful: boolean      // Whether equity is cubeful
    plies: number         // Search depth in plies
  }
}

// MODIFY: Add optional evaluation field to existing interface
export interface BackgammonMove {
  move: string              // e.g., "8/5 6/5"
  equity: number            // Equity score (kept for backward compatibility)
  evaluation?: MoveEvaluation  // Full evaluation details (optional)
}
```

**Acceptance Criteria:**
- [ ] `MoveEvaluation` interface defined with all required fields
- [ ] `BackgammonMove.evaluation` field is optional (doesn't break existing code)
- [ ] TypeScript compilation passes with no errors
- [ ] Existing code using `BackgammonMove` continues to work

---

### Task 1.2: Preserve Evaluation Data in Engine Response Parsing

**Description:** Update `getBackgammonGroundTruth()` to preserve full evaluation object instead of discarding it
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1 (Type Definitions)
**Can run parallel with:** Task 1.3 (Modal Component)

**File:** `lib/assessment/backgammonEngine.ts`

**Technical Requirements:**
- Modify the `validatedMoves` mapping logic (lines 108-123)
- Check if `evaluation.probability` exists before preserving
- Handle missing or undefined fields gracefully (use defaults)
- Preserve all probability data: win, lose, winG, loseG, winBG, loseBG
- Preserve metadata: cubeful flag, plies count, equity diff

**Current Code Location:**
Lines 108-123 in `lib/assessment/backgammonEngine.ts`

**Implementation:**

```typescript
// lib/assessment/backgammonEngine.ts
// Lines 108-123 - MODIFY the existing mapping

const validatedMoves: BackgammonMove[] = plays.map((item: EngineResponse) => {
  const playArray = item.play || []
  const evaluation = item.evaluation || { eq: 0 }
  const equity = evaluation.eq || evaluation.equity || 0

  const moveNotation = playArray
    .map((p: EnginePlayMove) => `${p.from}/${p.to}`)
    .join(' ')

  return {
    move: moveNotation || 'Unknown',
    equity: Number(equity),
    // ADD: Preserve full evaluation if probability data exists
    evaluation: evaluation.probability ? {
      equity: Number(equity),
      diff: evaluation.diff || 0,
      probability: {
        win: evaluation.probability.win,
        lose: evaluation.probability.lose,
        winG: evaluation.probability.winG || 0,
        loseG: evaluation.probability.loseG || 0,
        winBG: evaluation.probability.winBG || 0,
        loseBG: evaluation.probability.loseBG || 0,
      },
      info: {
        cubeful: evaluation.info?.cubeful || false,
        plies: evaluation.info?.plies || 0,
      },
    } : undefined,
  }
})
```

**Test with Real Engine Data:**
```bash
# Verify the engine returns probability data
curl -X POST 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com/plays' \
  -H 'Content-Type: application/json' \
  --data '{"board":{"o":{"6":5,"8":3,"13":5,"24":2},"x":{"6":5,"8":3,"13":5,"24":2}},"dice":[3,1],"player":"x","cubeful":false,"max-moves":3,"score-moves":true}'

# Should return evaluation.probability with win, winG, winBG, lose, loseG, loseBG
```

**Acceptance Criteria:**
- [ ] Engine responses with probability data have `evaluation` field populated
- [ ] All probability fields preserved: win, lose, winG, loseG, winBG, loseBG
- [ ] Metadata preserved: cubeful flag, plies, diff
- [ ] Responses without probability data have `evaluation: undefined` (graceful degradation)
- [ ] Existing functionality (equity display) still works
- [ ] TypeScript compilation passes
- [ ] Console logs show evaluation data present in parsed moves

**Test Scenarios:**
1. Make engine request with dice "3-1" - verify evaluation.probability exists
2. Check that win + lose ≈ 1.0 (should sum to 100%)
3. Check that winG <= win and loseG <= lose (gammons subset of wins/losses)
4. Verify diff is 0 for best move, negative for others

---

### Task 1.3: Create Move Detail Modal Component

**Description:** Build new `MoveDetailModal` component to display full evaluation breakdown
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.1 (Type Definitions)
**Can run parallel with:** Task 1.2 (Engine Parsing)

**File:** `components/assessment/MoveDetailModal.tsx` (NEW FILE)

**Technical Requirements:**
- Use shadcn/ui Dialog component (@radix-ui/react-dialog)
- Accept move, rank, isOpen, onClose as props
- Handle missing evaluation data gracefully (show message)
- Format percentages to 1 decimal place (e.g., 55.1%)
- Three-section layout: Equity Summary, Outcome Probabilities, Detailed Breakdown
- Color-coding: Green for wins, Red for losses
- Responsive grid for probability cards (1 column mobile, 2 columns desktop)

**Component Interface:**
```typescript
interface Props {
  move: BackgammonMove | null
  isOpen: boolean
  onClose: () => void
  rank: number  // Position in best moves list (1-indexed)
}
```

**Full Implementation:**

```typescript
// components/assessment/MoveDetailModal.tsx

'use client'

import { BackgammonMove } from '@/lib/assessment/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  move: BackgammonMove | null
  isOpen: boolean
  onClose: () => void
  rank: number  // Position in best moves list (1-indexed)
}

export function MoveDetailModal({ move, isOpen, onClose, rank }: Props) {
  if (!move?.evaluation) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Details</DialogTitle>
          </DialogHeader>
          <p className="text-gray-500">No detailed evaluation available for this move.</p>
        </DialogContent>
      </Dialog>
    )
  }

  const { evaluation } = move
  const prob = evaluation.probability

  // Format percentage helper
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Move #{rank}: {move.move}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Equity Summary */}
          <section>
            <h3 className="font-semibold mb-2">Equity</h3>
            <div className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Equity Score:</span>
                <span className={`font-mono font-bold ${evaluation.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {evaluation.equity >= 0 ? '+' : ''}{evaluation.equity.toFixed(4)}
                </span>
              </div>
              {evaluation.diff !== 0 && (
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-600">Difference from best:</span>
                  <span className="font-mono text-red-600">
                    {evaluation.diff.toFixed(4)}
                  </span>
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                {evaluation.info.cubeful ? 'Cubeful' : 'Cubeless'} · {evaluation.info.plies} ply analysis
              </div>
            </div>
          </section>

          {/* Win/Lose Probabilities */}
          <section>
            <h3 className="font-semibold mb-2">Outcome Probabilities</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Win */}
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <div className="text-sm text-green-800 font-medium mb-2">Win</div>
                <div className="text-2xl font-bold text-green-600">{pct(prob.win)}</div>
                <div className="mt-2 space-y-1 text-xs text-green-700">
                  <div className="flex justify-between">
                    <span>Single:</span>
                    <span>{pct(prob.win - prob.winG)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gammon:</span>
                    <span>{pct(prob.winG - prob.winBG)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Backgammon:</span>
                    <span>{pct(prob.winBG)}</span>
                  </div>
                </div>
              </div>

              {/* Lose */}
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <div className="text-sm text-red-800 font-medium mb-2">Lose</div>
                <div className="text-2xl font-bold text-red-600">{pct(prob.lose)}</div>
                <div className="mt-2 space-y-1 text-xs text-red-700">
                  <div className="flex justify-between">
                    <span>Single:</span>
                    <span>{pct(prob.lose - prob.loseG)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gammon:</span>
                    <span>{pct(prob.loseG - prob.loseBG)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Backgammon:</span>
                    <span>{pct(prob.loseBG)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Raw Probability Table */}
          <section>
            <h3 className="font-semibold mb-2">Detailed Breakdown</h3>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="py-2">Outcome</th>
                  <th className="py-2 text-right">Probability</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 text-green-700">Win</td>
                  <td className="py-2 text-right font-mono">{pct(prob.win)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-green-600 pl-4">Win Gammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.winG)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-green-500 pl-4">Win Backgammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.winBG)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-red-700">Lose</td>
                  <td className="py-2 text-right font-mono">{pct(prob.lose)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-red-600 pl-4">Lose Gammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.loseG)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-red-500 pl-4">Lose Backgammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.loseBG)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Acceptance Criteria:**
- [ ] Modal displays move notation and rank in title
- [ ] Equity section shows score, diff, and metadata (cubeful/plies)
- [ ] Outcome Probabilities section shows two color-coded cards (win/lose)
- [ ] Detailed Breakdown table shows all 6 probability rows
- [ ] Percentages formatted to 1 decimal (e.g., "55.1%")
- [ ] Responsive layout (1 column mobile, 2 columns desktop)
- [ ] Missing evaluation data shows graceful fallback message
- [ ] Modal closes on Escape key
- [ ] Focus trapped within modal when open
- [ ] TypeScript compilation passes

**Test Scenarios:**
1. Open modal with move containing evaluation data - all sections display correctly
2. Open modal with move missing evaluation - shows "No detailed evaluation available"
3. Test mobile responsiveness - cards stack vertically on narrow screens
4. Test keyboard navigation - Escape closes modal
5. Verify probabilities display correctly: Win + Lose ≈ 100%

---

### Task 1.4: Integrate Modal into Assessment UI

**Description:** Add click handlers and state management to make moves clickable and display modal
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2 (Engine Parsing), Task 1.3 (Modal Component)
**Can run parallel with:** None (requires both previous tasks)

**File:** `components/assessment/AssessmentClient.tsx`

**Technical Requirements:**
- Import `MoveDetailModal` component
- Add state for selected move, rank, and modal visibility
- Create `handleMoveClick` function
- Convert move list items from divs to clickable buttons
- Add hover styles and arrow icon for moves with evaluation data
- Add "Click any move to see detailed analysis" hint text
- Maintain existing functionality (star rating, etc.)

**Implementation Changes:**

**1. Add imports:**
```typescript
// components/assessment/AssessmentClient.tsx
// ADD to existing imports
import { MoveDetailModal } from './MoveDetailModal'
```

**2. Add state (after existing state declarations):**
```typescript
// ADD: State for move detail modal
const [selectedMove, setSelectedMove] = useState<BackgammonMove | null>(null)
const [selectedMoveRank, setSelectedMoveRank] = useState<number>(0)
const [showMoveDetail, setShowMoveDetail] = useState(false)
```

**3. Add click handler function (after existing functions):**
```typescript
// ADD: Click handler for move selection
function handleMoveClick(move: BackgammonMove, rank: number) {
  setSelectedMove(move)
  setSelectedMoveRank(rank)
  setShowMoveDetail(true)
}
```

**4. Modify ground truth display section (around line 210):**
```typescript
{/* MODIFY: Change from divs to clickable buttons */}
{groundTruth && (
  <div className="space-y-3">
    <h3 className="font-medium">Best Moves (ranked by equity):</h3>
    <p className="text-xs text-gray-500">Click any move to see detailed analysis</p>
    {groundTruth.slice(0, 5).map((move, idx) => (
      <button
        key={idx}
        onClick={() => handleMoveClick(move, idx + 1)}
        className="w-full flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors cursor-pointer text-left"
      >
        <span className="font-mono text-sm">
          {idx + 1}. {move.move}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${move.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {move.equity >= 0 ? '+' : ''}
            {move.equity.toFixed(4)}
          </span>
          {move.evaluation && (
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </button>
    ))}

    {/* ... existing rating component ... */}
  </div>
)}
```

**5. Add modal at end of component (before closing div):**
```typescript
{/* ADD: Move detail modal */}
<MoveDetailModal
  move={selectedMove}
  rank={selectedMoveRank}
  isOpen={showMoveDetail}
  onClose={() => setShowMoveDetail(false)}
/>
```

**Acceptance Criteria:**
- [ ] Moves are clickable buttons with hover states
- [ ] Arrow icon (›) appears only for moves with evaluation data
- [ ] Clicking a move opens the modal with correct data and rank
- [ ] Modal state doesn't interfere with other UI interactions
- [ ] Hint text "Click any move to see detailed analysis" displays
- [ ] Existing star rating functionality still works
- [ ] TypeScript compilation passes
- [ ] No console errors or warnings

**Test Scenarios:**
1. Set problem with dice "3-1", ask guru, check answer
2. Click first move - modal opens with Move #1 and detailed probabilities
3. Close modal, click second move - modal opens with Move #2
4. Verify arrow icon only shows for moves with evaluation data
5. Test that other UI elements (star rating, audit trail) still work
6. Check mobile responsiveness of clickable moves

---

## Execution Strategy

### Recommended Order

1. **Task 1.1** - Type definitions (15 min)
   - Foundation for all other work
   - Must complete first

2. **Parallel execution:**
   - **Task 1.2** - Engine parsing (30 min)
   - **Task 1.3** - Modal component (60 min)
   - Can work on these simultaneously

3. **Task 1.4** - UI integration (30 min)
   - Final assembly
   - Requires Tasks 1.2 & 1.3 complete

**Total Estimated Time:** ~2.5 hours

### Risk Assessment

**Low Risk:**
- Type changes are additive (won't break existing code)
- Engine already returns all required data
- Modal pattern already proven (ContextAuditModal)

**Minimal Dependencies:**
- All dependencies already in project
- No new npm packages required
- No database changes needed

---

## Testing Checklist

### Unit-Level Validation
- [ ] TypeScript compilation passes
- [ ] No console errors in browser
- [ ] Engine response parsing preserves all fields

### Integration Testing
- [ ] Click move → Modal opens with correct data
- [ ] Probabilities sum correctly (win + lose ≈ 100%)
- [ ] Arrow icon only shows when evaluation exists
- [ ] Modal closes properly (X button, Escape, outside click)

### User Experience Testing
- [ ] Hover states provide visual feedback
- [ ] Modal is readable and well-formatted
- [ ] Mobile layout is responsive
- [ ] Keyboard navigation works (Tab, Enter, Escape)

---

## Success Metrics

**Functionality:**
- ✅ Users can click any move to see detailed breakdown
- ✅ All engine probability data is displayed
- ✅ No new API calls required (data already present)

**Code Quality:**
- ✅ TypeScript strict mode passes
- ✅ No breaking changes to existing functionality
- ✅ Component follows established patterns

**User Experience:**
- ✅ Progressive disclosure (simple view → detailed on demand)
- ✅ Clear visual hierarchy in modal
- ✅ Responsive design works on all screen sizes

---

**End of Task Breakdown**

Ready for execution via `/spec:execute` or manual implementation.
