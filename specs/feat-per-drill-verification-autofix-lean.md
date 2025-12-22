# Per-Drill Ground Truth Verification with Auto-Fix

**Status:** Implemented
**Author:** Claude
**Date:** 2025-12-16

## Overview

Replace the current claim-based verification system with per-drill verification that checks every single drill's correct answer against GNUBG, stores correction data for failures, and provides a one-click "Fix Failed Drills" workflow.

## Problem Statement

The current verification system extracts "claims" from drill content (move recommendations, equity values mentioned in text) rather than verifying each drill's actual correct answer. This causes:

1. **Count mismatch:** 28 drills generated but only 22 claims verified (due to extraction failures, deduplication, multiple claims per drill)
2. **Incomplete coverage:** Some drills aren't verified at all if no move can be extracted from their text
3. **No actionable fix path:** When verification fails, the discrepancy message shows what's wrong but there's no automated way to fix it

Users need confidence that 100% of drills have mathematically correct answers, with a clear path to fix any failures.

## Goals

- Verify every drill's `correctAnswer` against GNUBG (not text-extracted claims)
- Store engine correction data (best move, top 3 with equity) for each failed drill
- Add "Fix Failed Drills" button that rewrites incorrect drills using engine data
- Maintain the existing verification status flow (VERIFIED/NEEDS_REVIEW/FAILED)

## Non-Goals

- Changing drill generation logic or prompts
- Verifying non-opening positions (EARLY/MIDDLE/BEAROFF require XGID lookup - future work)
- Real-time verification during generation (keep post-generation approach)
- Per-drill status tracking in the Drill table (artifact-level is sufficient)
- Automatic fix without user action (user should click the button)
- Diff preview before applying fixes (just fix and re-verify)

## Technical Approach

### Key Files to Modify

1. `lib/groundTruth/verification/drillVerifier.ts` (NEW) - Per-drill verification logic
2. `lib/groundTruth/verification/drillFixer.ts` (NEW) - GPT-4o drill rewriting
3. `lib/groundTruth/claimExtraction.ts` - Keep for backward compat, but add new entry point
4. `lib/inngest-functions.ts` - Switch to per-drill verification in drill generation job
5. `components/artifacts/VerificationDetailsModal.tsx` - Add "Fix Failed Drills" button
6. `app/api/artifacts/[id]/fix-drills/route.ts` (NEW) - API endpoint for fix workflow

### Integration Points

- **GNUBG MCP Client:** Use existing `getOpeningMoves()` for opening drills
- **Inngest Jobs:** Modify `drillSeriesGenerationJob` to use new verifier
- **Artifact Storage:** Store per-drill results in `verificationDetails` JSON
- **UI:** VerificationDetailsModal shows failed drills with "Fix" button

## Implementation Details

### 1. Per-Drill Verification Function

```typescript
// lib/groundTruth/verification/drillVerifier.ts

interface DrillVerificationResult {
  drillId: string
  verified: boolean
  positionId: string | null
  claimedMove: string
  engineData: {
    bestMove: string
    bestEquity: number
    top3: Array<{ move: string; equity: number }>
  } | null
  discrepancy: string | null
}

interface DrillSeriesVerificationResult {
  status: 'VERIFIED' | 'NEEDS_REVIEW' | 'UNVERIFIED' | 'FAILED'
  drills: DrillVerificationResult[]
  summary: {
    totalDrills: number
    verifiedDrills: number
    failedDrills: number
    skippedDrills: number  // Non-opening positions we can't verify yet
  }
}

export async function verifyAllDrills(
  content: PhaseOrganizedDrillSeries,
  config: GroundTruthConfig
): Promise<DrillSeriesVerificationResult>
```

**Logic:**
1. Iterate through `content.phases[].principleGroups[].drills[]`
2. For each drill:
   - Extract `positionId` (e.g., "opening-3-1") and `correctAnswer`
   - If opening position: query GNUBG via `getOpeningMoves(die1, die2, config, 5)`
   - Compare drill's `correctAnswer` against engine's best move(s)
   - If mismatch: store engine's top 3 moves with equity values
3. Calculate status: VERIFIED if 0 failures, NEEDS_REVIEW if any failures

### 2. Drill Fixer Function

```typescript
// lib/groundTruth/verification/drillFixer.ts

interface FixResult {
  drillId: string
  fixed: boolean
  originalAnswer: string
  newAnswer: string
  error?: string
}

export async function fixFailedDrills(
  content: PhaseOrganizedDrillSeries,
  failedDrills: DrillVerificationResult[]
): Promise<{
  fixedContent: PhaseOrganizedDrillSeries
  results: FixResult[]
}>
```

**Logic:**
1. For each failed drill, call GPT-4o with:
   - The original drill content
   - The engine's correct answer and top 3 alternatives with equity
   - Instructions to rewrite `correctAnswer`, `options[].isCorrect`, and `feedback`
2. Parse GPT response and update drill in content
3. Return modified content for re-verification

**GPT Prompt Structure:**
```
You are fixing a backgammon drill that has an incorrect answer.

Original drill:
- Scenario: {scenario}
- Question: {question}
- Current correct answer: {correctAnswer}
- Options: {options}

Engine analysis shows the correct answer is: {engineBestMove} (equity: {equity})
Top 3 moves: {top3}

Rewrite ONLY these fields:
1. correctAnswer: Set to the engine's best move
2. options: Update isCorrect flags (mark the engine's move as correct)
3. feedback.correct: Update to explain why the engine's move is best
4. feedback.incorrect: Update to explain common mistakes

Return JSON with the updated fields only.
```

### 3. Updated Verification Details Storage

```typescript
// In verificationDetails JSON
{
  drills: DrillVerificationResult[],  // Per-drill results
  summary: {
    totalDrills: number,
    verifiedDrills: number,
    failedDrills: number,
    skippedDrills: number
  }
}
```

### 4. Fix Drills API Endpoint

```typescript
// app/api/artifacts/[id]/fix-drills/route.ts

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // 1. Load artifact and verification details
  // 2. Get failed drills from verificationDetails
  // 3. Call fixFailedDrills()
  // 4. Update artifact content with fixed drills
  // 5. Re-run verification
  // 6. Update artifact with new status and details
  // 7. Return success/failure
}
```

### 5. UI Changes to VerificationDetailsModal

Add after the failed claims section:

```tsx
{/* Fix Failed Drills Button */}
{status === 'NEEDS_REVIEW' && summary.failedDrills > 0 && (
  <div className="flex justify-center pt-4 border-t">
    <Button
      onClick={handleFixDrills}
      disabled={isFixing}
      className="bg-amber-600 hover:bg-amber-700"
    >
      {isFixing ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Fixing {summary.failedDrills} drills...
        </>
      ) : (
        <>
          <Wrench className="w-4 h-4 mr-2" />
          Fix {summary.failedDrills} Failed Drills
        </>
      )}
    </Button>
  </div>
)}
```

### 6. Update Inngest Job

In `drillSeriesGenerationJob`, replace:
```typescript
// OLD: Claim-based verification
const claims = extractVerifiableClaims(result.content)
const verificationResult = await verifyClaimsAgainstGroundTruth(claims, gtConfig)

// NEW: Per-drill verification
const verificationResult = await verifyAllDrills(result.content, gtConfig)
```

## Testing Approach

### Key Scenarios to Test

1. **Per-drill verification coverage:**
   - Generate 28 drills → verify all 28 are checked
   - Verify count in summary matches total drills

2. **Failure detection:**
   - Manually create a drill with wrong answer
   - Verify it shows as failed with engine's correct move

3. **Fix workflow:**
   - Click "Fix Failed Drills" button
   - Verify drills are updated with correct answers
   - Verify re-verification passes

4. **Edge cases:**
   - Drill without positionId (should skip, not fail)
   - Non-opening position (should skip for now)
   - Engine timeout (should mark as FAILED, not crash)

## Open Questions

1. **Non-opening positions:** How do we verify EARLY/MIDDLE/BEAROFF drills? They need XGID lookup from PositionLibrary. Defer to future work?

2. **Multiple correct moves:** Some positions have multiple equally good moves. Should we accept any move in the engine's top 3? (Current approach: yes, accept top 3)

3. **Fix attempt limit:** Should we limit how many times users can click "Fix"? (Suggestion: no limit, but show warning if fix fails twice)

## User Experience

### Updated Modal Display

The VerificationDetailsModal will show:
- **Summary:** "3 Verified | 9 Failed | 16 Skipped (non-opening)"
- **Failed Drills List:** Each failed drill with:
  - Drill ID and section
  - Claimed answer vs engine's best move
  - Top 3 alternatives with equity values
- **Fix Button:** Prominent amber button to fix all failed drills
- **After Fix:** Modal refreshes to show updated status

## Future Improvements and Enhancements

**OUT OF SCOPE for initial implementation:**

- **Verify non-opening positions:** Requires XGID lookup from PositionLibrary for EARLY/MIDDLE/BEAROFF phases
- **Selective fixing:** Let users choose which failed drills to fix (vs. fix all)
- **Fix preview/diff:** Show what will change before applying fixes
- **Per-drill status in Drill table:** Track verification status per drill record
- **Automatic re-generation:** Instead of fixing, regenerate just the failed drills from scratch
- **Verification during generation:** Real-time verification as drills are generated (agentic loop)
- **Equity threshold:** Accept moves within X equity of best move (not just top 3)
- **Human override:** Let users mark a drill as "correct despite engine disagreement"
- **Batch processing:** Verify/fix multiple artifacts at once
- **Verification history:** Track all verification attempts over time

## References

- Existing verification code: `lib/groundTruth/verification/batchVerifier.ts`
- Claim extraction: `lib/groundTruth/claimExtraction.ts`
- MCP client: `lib/groundTruth/mcpClient.ts`
- Drill schema: `lib/guruFunctions/schemas/phaseOrganizedDrillSchema.ts`
- Verification modal: `components/artifacts/VerificationDetailsModal.tsx`
- Inngest drill job: `lib/inngest-functions.ts` (lines 775-1097)
