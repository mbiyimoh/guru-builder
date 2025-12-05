# Feature Specification: Detailed GNU Backgammon Evaluation Display

## 1. Status

**Draft** - Pending Review

## 2. Authors

Claude (AI Assistant) - November 17, 2025

## 3. Overview

Enable users to view detailed GNU Backgammon evaluation data (win/lose probabilities, gammon/backgammon percentages, equity differential, search depth) for any move in the ground truth results by clicking on it. Currently only move notation and equity score are displayed.

## 4. Problem Statement

### The Problem

When users click "Check Answer" in the self-assessment system, they see a ranked list of best moves with only basic information:

```
1. 8/5 6/5         +0.1590
2. 13/10 24/23     -0.0090
3. 24/21 21/20     -0.0150
```

However, the GNU Backgammon engine calculates rich probability data for each move:
- Win/Lose probabilities (e.g., 55.1% win, 44.9% lose)
- Gammon percentages (e.g., 17.4% winG, 12.4% loseG)
- Backgammon percentages (e.g., 1.3% winBG, 0.5% loseBG)
- Equity differential from best move
- Search depth (plies)

**This data is already being fetched from the engine but is currently discarded before reaching the UI.** Users cannot see WHY a move is rated better - they only see the final equity number.

### Why This Matters

- **Educational Value**: Understanding probability breakdowns helps users learn backgammon theory
- **Decision Making**: Users can see trade-offs between moves (e.g., safer vs. more aggressive)
- **Trust**: Detailed metrics build confidence in the engine's recommendations
- **Existing Data**: No additional API calls needed - we're already receiving this data

### Real-World Example

A user tests their backgammon guru on a 3-1 opening roll. The engine says "8/5 6/5" is best with equity +0.159, but doesn't explain that this move has:
- 55.1% chance to win (vs 49.7% for second-best move)
- 17.4% gammon rate (strong attacking position)
- Only 12.4% risk of losing a gammon (acceptable risk)

Without this context, the user can't understand the strategic implications or explain them to others.

---

## 5. Goals

- **Primary**: Display full evaluation breakdown when user clicks on any move in the ground truth list
- **Data Preservation**: Extend data structures to preserve evaluation data from engine through to UI
- **Clear Presentation**: Format probability data in an easy-to-understand layout
- **Non-Intrusive**: Don't clutter the main comparison view - show details on-demand

---

## 6. Non-Goals (Explicitly Out of Scope)

- **NOT building**: Comparison charts between multiple moves
- **NOT building**: Historical tracking of evaluation data across sessions
- **NOT building**: Custom filters or sorting of moves by specific metrics
- **NOT building**: Export of evaluation data to CSV/JSON
- **NOT building**: Equity calculator or "what-if" analysis tools
- **NOT building**: Visualization graphs (bar charts, probability curves, etc.)
- **NOT building**: Educational tooltips explaining what each metric means
- **NOT implementing**: Support for cubeful equity display (engine doesn't provide it for opening positions)

---

## 7. Technical Dependencies

### Already Available

All required dependencies are already in the project:

```json
{
  "react": "19.1.1",
  "next": "15.2.4",
  "@radix-ui/react-dialog": "^1.1.2" // Via shadcn/ui
}
```

### External Services

- GNU Backgammon Engine: Already integrated at `https://gnubg-mcp-d1c3c7a814e8.herokuapp.com`
- Engine response already includes all required evaluation data

---

## 8. Technical Approach

### High-Level Strategy

The data already exists in the engine response but gets discarded during parsing. We need to:

1. **Preserve** evaluation data when parsing engine responses
2. **Store** it in the `BackgammonMove` type
3. **Display** it on-demand via a modal dialog

### Key Files to Modify

1. `lib/assessment/types.ts` - Extend `BackgammonMove` interface
2. `lib/assessment/backgammonEngine.ts` - Preserve evaluation in parsing logic
3. `components/assessment/AssessmentClient.tsx` - Add click handlers and modal
4. `components/assessment/MoveDetailModal.tsx` - **NEW** component for detail view

### Integration Points

- **Data Flow**: Engine response → `getBackgammonGroundTruth()` → `BackgammonMove[]` → UI state → Modal
- **UI Pattern**: Follows same pattern as existing `ContextAuditModal` (click to view details)
- **Styling**: Uses existing Tailwind classes and shadcn/ui Dialog component

---

## 9. Implementation Details

### 9.1 Type Definitions

**File:** `lib/assessment/types.ts`

Add optional `evaluation` field to preserve detailed data:

```typescript
// lib/assessment/types.ts

// Detailed evaluation from GNU Backgammon engine
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

// MODIFIED: Add optional evaluation field
export interface BackgammonMove {
  move: string              // e.g., "8/5 6/5"
  equity: number            // Equity score (kept for backward compatibility)
  evaluation?: MoveEvaluation  // Full evaluation details (optional)
}
```

### 9.2 Engine Response Parsing

**File:** `lib/assessment/backgammonEngine.ts`

Update parsing to preserve evaluation object (lines 108-123):

```typescript
// lib/assessment/backgammonEngine.ts

// Current parsing (MODIFY THIS):
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

### 9.3 Move Detail Modal Component

**File:** `components/assessment/MoveDetailModal.tsx` (NEW)

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
            <div className="grid grid-cols-2 gap-4">
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

### 9.4 UI Integration

**File:** `components/assessment/AssessmentClient.tsx`

Add state and click handlers (modifications to existing code):

```typescript
// components/assessment/AssessmentClient.tsx

import { MoveDetailModal } from './MoveDetailModal'  // ADD

export function AssessmentClient({ projectId }: Props) {
  // ... existing state ...

  // ADD: State for move detail modal
  const [selectedMove, setSelectedMove] = useState<BackgammonMove | null>(null)
  const [selectedMoveRank, setSelectedMoveRank] = useState<number>(0)
  const [showMoveDetail, setShowMoveDetail] = useState(false)

  // ADD: Click handler
  function handleMoveClick(move: BackgammonMove, rank: number) {
    setSelectedMove(move)
    setSelectedMoveRank(rank)
    setShowMoveDetail(true)
  }

  return (
    <div className="space-y-6">
      {/* ... existing code ... */}

      {/* MODIFY: Make moves clickable (around line 210) */}
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

      {/* ADD: Move detail modal */}
      <MoveDetailModal
        move={selectedMove}
        rank={selectedMoveRank}
        isOpen={showMoveDetail}
        onClose={() => setShowMoveDetail(false)}
      />
    </div>
  )
}
```

---

## 10. User Experience

### User Flow

1. User enters dice roll (e.g., "3-1") and clicks "Set Problem"
2. User asks guru for recommendation
3. User clicks "Check Answer" to see ground truth
4. **List of best moves appears** with move notation and equity
5. **User clicks on any move** in the list
6. **Modal opens** showing detailed probability breakdown
7. User reviews win/lose percentages, gammon rates, and equity difference
8. User closes modal and can click other moves to compare

### Visual Design

**Main List (Existing with Enhancement):**
- Each move is now a clickable button (hover state for feedback)
- Small arrow icon (›) appears on right if detailed data is available
- Maintains current green/red equity color coding

**Detail Modal (New):**
- Three sections: Equity Summary, Outcome Probabilities (visual cards), Detailed Breakdown (table)
- Color-coded: Green for win, Red for lose
- Percentages formatted to 1 decimal place (e.g., "55.1%")
- Clear visual hierarchy with section headings

### Accessibility

- Modal uses shadcn/ui Dialog (built on Radix UI with full a11y support)
- Keyboard navigation: Tab through moves, Enter to open details, Esc to close
- Screen reader support via semantic HTML and ARIA labels
- Focus trap within modal when open

---

## 11. Testing Approach

### Manual Testing Scenarios

**Scenario 1: Happy Path**
- Input dice roll "3-1"
- Ask guru for recommendation
- Click "Check Answer"
- Click on first move (8/5 6/5)
- Verify modal shows:
  - Equity: ~+0.159
  - Win: ~55.1%
  - Win Gammon: ~17.4%
  - Lose Gammon: ~12.4%

**Scenario 2: Edge Case - Moves Without Detailed Data**
- If engine somehow returns move without probability data
- Click on move
- Verify modal shows "No detailed evaluation available" message

**Scenario 3: Comparison Workflow**
- Open details for move #1
- Close modal
- Open details for move #2
- Compare probability differences
- Verify correct rank number displayed in modal title

### Validation Criteria

- ✅ Percentages sum to 100% (win + lose = 1.0)
- ✅ Gammon/backgammon percentages don't exceed win/lose totals
- ✅ Equity diff is 0 for best move, negative for others
- ✅ Modal state doesn't interfere with other UI interactions

---

## 12. Open Questions

1. **Number of moves to show details for**: Currently limiting to top 5 moves in UI. Should all 10 fetched moves have detailed data?
   - **Recommendation**: Keep top 5 for UI display, all data preserved in state

2. **Cubeful vs Cubeless indicator**: Engine provides this flag but opening positions are always cubeless. Show it anyway?
   - **Recommendation**: Yes, show it for completeness and future non-opening positions

3. **Rounding precision**: Show percentages to 1 decimal (55.1%) or 2 decimals (55.12%)?
   - **Recommendation**: 1 decimal for readability, 2 decimals would be false precision

4. **Mobile layout**: Two-column probability cards may not fit on narrow screens
   - **Recommendation**: Use CSS grid with `grid-cols-1 sm:grid-cols-2` responsive breakpoint

---

## 13. Future Improvements and Enhancements

**⚠️ Everything in this section is OUT OF SCOPE for initial implementation.**

### Enhanced Visualizations

- **Probability bar charts**: Visual representation of win/lose/gammon rates
- **Equity comparison graph**: Show equity curve across all moves
- **Position heatmap**: Color-code board positions by checker value

### Comparative Analysis

- **Side-by-side comparison**: Select multiple moves and compare in table
- **Equity calculator**: "What if" analysis with different dice rolls
- **Historical tracking**: Chart how move evaluations change across different gurus/research runs

### Educational Features

- **Tooltips on metrics**: Hover over "Win Gammon" to see explanation
- **Strategy insights**: AI-generated explanation of why probabilities differ
- **Bookmark favorite positions**: Save interesting evaluation comparisons

### Export & Sharing

- **Copy to clipboard**: Export evaluation data as text or JSON
- **Screenshot generator**: Create shareable image of evaluation breakdown
- **Session comparison**: Compare how same position is evaluated over time

### Performance Optimizations

- **Lazy loading**: Only fetch detailed data when user clicks (current approach fetches all)
- **Caching**: Store evaluation data in IndexedDB for offline access
- **Pagination**: Support more than 10 moves from engine

### Alternative Presentation Modes

- **Inline expansion**: Accordion-style details below each move (instead of modal)
- **Split panel**: Permanent detail view on right side when move selected
- **Compact mode**: Single-line summary with key metrics

---

## 14. References

### Internal Documentation

- `backgammon-engine-MCP-README.md` - GNU Backgammon engine API documentation
- `specs/feat-self-assessment-system.md` - Original self-assessment architecture
- `lib/assessment/backgammonEngine.ts:8-29` - Full `EngineEvaluation` interface definition

### External Documentation

- GNU Backgammon Documentation: https://www.gnu.org/software/gnubg/
- Backgammon Equity Theory: https://bkgm.com/articles/
- shadcn/ui Dialog Component: https://ui.shadcn.com/docs/components/dialog

### Design Patterns

- **Progressive Disclosure**: Show basic info first, details on-demand
- **Modal Pattern**: Focused detail view without navigation disruption
- **Color Semantics**: Green = positive equity/win, Red = negative/lose

---

**End of Specification**

*Quality Score: 9/10 - Focused on core request (displaying existing data), minimal new complexity, clear value proposition*
