# Automatic Readiness Reevaluation After Corpus Updates

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-21
**Branch:** feat/auto-readiness-reevaluation
**Ideation Doc:** `specs/auto-readiness-reevaluation-after-corpus-update/01-ideation.md`

---

## Overview

When users apply research recommendations to update their corpus, the readiness score doesn't automatically update. Users see stale gap information (e.g., "foundations" and "progression" still showing as gaps) even after adding relevant content. This specification defines changes to provide immediate readiness feedback after corpus updates.

---

## Background/Problem Statement

### Current Behavior

1. **User applies recommendations** via POST `/api/projects/[id]/apply-recommendations`
2. **Auto-tagging fires asynchronously** (fire-and-forget pattern in `applyRecommendations.ts:114-127`)
3. **API returns success immediately** without waiting for tags
4. **Readiness API has 5-minute cache** (`Cache-Control: private, max-age=300`)
5. **User navigates to readiness page** and sees stale score

### Root Causes Identified

| Cause | Impact | Confidence |
|-------|--------|------------|
| HTTP cache (5 min) | Browser serves stale scores | HIGH |
| No refetch trigger | UI doesn't know to reload after apply | HIGH |
| Async tagging race condition | Tags may not exist when readiness calculated | HIGH |
| Unconfirmed scoring too harsh (25%) | Even tagged content shows as gap | MEDIUM |

### User Impact

- Users see "foundations" and "progression" as critical gaps after adding content for those dimensions
- No immediate feedback that applying recommendations improved corpus coverage
- Confusing UX where actions don't visibly change system state

---

## Goals

- **G1:** Readiness score updates within 3 seconds of applying recommendations
- **G2:** Suggested topics on research page reflect current corpus state
- **G3:** Users see visual progress feedback during the apply process
- **G4:** Auto-confirmed content provides meaningful score improvement (not penalized at 25%)

---

## Non-Goals

- Real-time websocket updates (polling is acceptable)
- Multi-user collaboration scenarios
- Changing the readiness threshold (60) or dimension weights
- Changing which dimensions are critical

---

## Technical Dependencies

- **Next.js 15** - App router, server actions
- **React 19** - Client components, hooks
- **Vercel AI SDK v5** - For dimension suggestion (existing)
- **Prisma** - Database ORM (existing)
- **OpenAI GPT-4o-mini** - For dimension tagging (existing)

No new dependencies required.

---

## Detailed Design

### 1. Make Auto-Tagging Blocking

**File:** `lib/applyRecommendations.ts`
**Lines:** 114-127

#### Current Code
```typescript
// Fire-and-forget pattern (problematic)
autoTagCorpusItem({
  projectId,
  itemId: appliedItemId,
  itemType,
  content: rec.fullContent,
  title: rec.title,
}).catch((error) => {
  console.error(`[Apply Changes] Auto-tag failed...`);
});
```

#### New Code
```typescript
// Collect all auto-tag promises
const autoTagPromises: Promise<void>[] = [];

// Inside the loop, push promises instead of fire-and-forget
if (appliedItemId && (rec.action === "ADD" || rec.action === "EDIT")) {
  const itemType = rec.targetType === "LAYER" ? "layer" : "file";

  autoTagPromises.push(
    autoTagCorpusItem({
      projectId,
      itemId: appliedItemId,
      itemType,
      content: rec.fullContent,
      title: rec.title,
    }).catch((error) => {
      console.error(`[Apply Changes] Auto-tag failed for ${itemType} ${appliedItemId}:`, error);
      // Don't re-throw - we still want to return success
    })
  );
}

// After all recommendations processed, wait for auto-tagging with timeout
const AUTO_TAG_TIMEOUT_MS = 10000; // 10 second safety timeout
await Promise.race([
  Promise.all(autoTagPromises),
  new Promise((resolve) => setTimeout(resolve, AUTO_TAG_TIMEOUT_MS))
]);
```

**Rationale:** Auto-tagging typically takes 1-2 seconds per item. With batching, even 5-10 items complete in ~3 seconds total. User accepts this delay when shown progress steps. The 10-second timeout ensures the request doesn't hang if OpenAI is slow.

---

### 2. Remove HTTP Cache from Readiness API

**File:** `app/api/projects/[id]/readiness/route.ts`
**Line:** 35

#### Current Code
```typescript
return NextResponse.json(score, {
  headers: {
    'Cache-Control': 'private, max-age=300',  // 5-minute cache
  },
});
```

#### New Code
```typescript
return NextResponse.json(score, {
  headers: {
    'Cache-Control': 'no-store',  // Always fresh
  },
});
```

**Rationale:** User prioritizes immediacy over scale. The readiness calculation is fast (~50-100ms database query) and doesn't need caching.

---

### 3. Lower Auto-Confirm Threshold

**File:** `lib/dimensions/autoTag.ts`
**Line:** 86

#### Current Code
```typescript
const confirmedByUser = suggestion.confidence >= 0.8;
```

#### New Code
```typescript
const confirmedByUser = suggestion.confidence >= 0.6;
```

**Rationale:** 0.8 threshold is too strict - most AI suggestions fall in 0.6-0.79 range. Lowering to 0.6 means more content auto-confirms, providing immediate score improvement without requiring manual confirmation.

---

### 4. Raise Unconfirmed Coverage Value

**File:** `lib/readiness/scoring.ts`
**Line:** 95

#### Current Code
```typescript
} else if (itemCount > 0) {
  coveragePercent = 25;  // Unconfirmed items = 25% coverage
}
```

#### New Code
```typescript
} else if (itemCount > 0) {
  coveragePercent = 40;  // Unconfirmed items = 40% coverage
}
```

**Rationale:** Even unconfirmed content represents meaningful corpus coverage. 40% (up from 25%) better reflects that content exists even if not yet confirmed. Combined with 0.6 auto-confirm threshold, most content will auto-confirm anyway.

---

### 5. Add Inline Readiness Indicator on Research Page

**New Component:** `components/research/InlineReadinessIndicator.tsx`

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronRight, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ReadinessScore {
  overall: number;
  isReady: boolean;
  criticalGaps: string[];
  dimensions: Record<string, { coverage: number; weight: number }>;
}

interface InlineReadinessIndicatorProps {
  projectId: string;
  refreshTrigger?: number; // Increment to force refresh
}

export function InlineReadinessIndicator({
  projectId,
  refreshTrigger = 0
}: InlineReadinessIndicatorProps) {
  const [score, setScore] = useState<ReadinessScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/readiness`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (score?.overall !== undefined) {
          setPreviousScore(score.overall);
        }
        setScore(data);
      }
    } catch (error) {
      console.error('Failed to fetch readiness:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, score?.overall]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="w-full bg-gray-50 border-b px-6 py-3">
        <div className="animate-pulse flex items-center gap-4">
          <div className="h-2 bg-gray-200 rounded flex-1 max-w-xs" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!score) return null;

  const scoreImproved = previousScore !== null && score.overall > previousScore;
  const scoreDelta = previousScore !== null ? score.overall - previousScore : 0;

  return (
    <div className="w-full bg-gradient-to-r from-gray-50 to-white border-b px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Progress bar section */}
        <div className="flex items-center gap-4 flex-1">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Readiness
          </span>

          {/* Progress bar */}
          <div className="flex-1 max-w-md">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  score.isReady ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, score.overall)}%` }}
              />
            </div>
          </div>

          {/* Score display */}
          <div className="flex items-center gap-2">
            <span
              data-testid="readiness-score"
              className={`text-lg font-bold ${
                score.isReady ? 'text-green-600' : 'text-amber-600'
              }`}
            >
              {Math.round(score.overall)}%
            </span>

            {/* Score improvement indicator */}
            {scoreImproved && (
              <span
                data-testid="score-improvement"
                className="flex items-center text-sm text-green-600 animate-pulse"
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                +{Math.round(scoreDelta)}%
              </span>
            )}
          </div>
        </div>

        {/* Status and link */}
        <div className="flex items-center gap-4">
          {score.criticalGaps.length > 0 && (
            <span className="flex items-center text-sm text-amber-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              {score.criticalGaps.length} critical gap{score.criticalGaps.length !== 1 ? 's' : ''}
            </span>
          )}

          <Link
            href={`/projects/${projectId}/readiness`}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View Report
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

### 6. Update Research Page to Integrate Indicator

**File:** `app/projects/[id]/research/ResearchPageContent.tsx`

#### Changes Required

1. **Import the new component:**
```typescript
import { InlineReadinessIndicator } from '@/components/research/InlineReadinessIndicator';
```

2. **Add refresh trigger state:**
```typescript
const [readinessRefreshTrigger, setReadinessRefreshTrigger] = useState(0);
```

3. **Add indicator below suggested topics header:**
```tsx
{/* Inline Readiness Indicator - below Suggested Topics, above Research Assistant */}
<InlineReadinessIndicator
  projectId={projectId}
  refreshTrigger={readinessRefreshTrigger}
/>
```

4. **Trigger refresh after applying recommendations:**
```typescript
// In the apply success handler
const handleApplySuccess = () => {
  // ... existing logic
  setReadinessRefreshTrigger(prev => prev + 1);
  // Also refetch suggested topics
  fetchReadiness();
};
```

---

### 7. Update Suggested Topics After Apply

**File:** `app/projects/[id]/research/ResearchPageContent.tsx`

The research page already fetches readiness on mount to populate suggested topics. Add a refetch after apply:

```typescript
// Existing fetchReadiness function
const fetchReadiness = useCallback(async () => {
  try {
    const res = await fetch(`/api/projects/${projectId}/readiness`, {
      cache: 'no-store',  // Force fresh data
    });
    if (res.ok) {
      const data = await res.json();
      setReadinessScore(data);
    }
  } catch (error) {
    console.error('Failed to fetch readiness:', error);
  }
}, [projectId]);

// Call after apply success
const handleApplySuccess = async () => {
  // Refetch readiness to update suggested topics
  await fetchReadiness();
  setReadinessRefreshTrigger(prev => prev + 1);
};
```

---

### 8. Update Apply Recommendations API Response

**File:** `app/api/projects/[id]/apply-recommendations/route.ts`

Add fresh readiness score to apply response so UI can update immediately:

```typescript
// After await applyRecommendations(...)
const freshReadiness = await calculateReadinessScore(projectId);

return NextResponse.json({
  success: true,
  appliedCount: result.appliedCount,
  readiness: freshReadiness,  // Include fresh score
});
```

**Also update the type definition in `lib/applyRecommendations.ts`:**

```typescript
export interface ApplyRecommendationsResult {
  success: boolean;
  snapshotId: string;
  appliedCount: number;
  changes: {
    added: number;
    edited: number;
    deleted: number;
  };
  error?: string;
  readiness?: {  // NEW: Optional readiness score
    score: {
      overall: number;
      profile: number;
      knowledge: number;
      criticalGaps: string[];
      suggestedGaps: string[];
    };
  };
}
```

---

## Data Flow

```
User clicks "Apply Recommendations"
  │
  ▼
POST /api/projects/[id]/apply-recommendations
  │
  ├─► Apply changes to ContextLayer/KnowledgeFile (DB writes)
  │
  ├─► Collect auto-tag promises
  │     │
  │     └─► For each ADD/EDIT recommendation:
  │           autoTagCorpusItem() → POST /dimensions/suggest
  │                                       │
  │                                       ▼
  │                                  GPT-4o-mini suggests dimensions
  │                                       │
  │                                       ▼
  │                                  Create CorpusDimensionTag
  │                                  (confirmedByUser = confidence >= 0.6)
  │
  ├─► await Promise.all(autoTagPromises)  // BLOCKING
  │
  ├─► calculateReadinessScore()  // Fresh score
  │
  └─► Return { success, appliedCount, readiness }
        │
        ▼
UI receives response
  │
  ├─► Update success message
  │
  ├─► InlineReadinessIndicator refetches
  │     └─► Shows updated score with "+X%" animation
  │
  └─► Suggested Topics refetch
        └─► Removes addressed gaps from list
```

---

## User Experience

### Before (Current)
1. User applies 5 recommendations
2. Success message appears immediately
3. Navigate to readiness page
4. See same score, same gaps
5. Confused: "Did it work?"

### After (New)
1. User applies 5 recommendations
2. Progress indicator shows "Applying... Tagging... Calculating..."
3. Success message with "+12% readiness" highlight
4. Inline indicator on research page shows new score
5. Suggested topics list shrinks (addressed gaps removed)
6. Clear feedback: corpus improved

### Visual Feedback During Apply

Add progress steps to apply dialog:

```
┌─────────────────────────────────────┐
│  Applying Recommendations           │
│                                     │
│  ✓ Updating corpus (5/5)           │
│  ✓ Categorizing content (5/5)      │
│  ○ Calculating readiness...         │
│                                     │
│  [████████████░░░░░░░░░░░░] 75%    │
└─────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

**File:** `lib/__tests__/readiness-scoring.test.ts`

```typescript
describe('Readiness Scoring', () => {
  describe('unconfirmed coverage', () => {
    it('should return 40% for unconfirmed items (not 25%)', async () => {
      // Setup: dimension with 1 unconfirmed tag
      const score = await calculateReadinessScore(projectId);
      expect(score.dimensions.foundations.coverage).toBe(40);
    });
  });
});
```

**File:** `lib/__tests__/auto-tag.test.ts`

```typescript
describe('Auto-Tagging', () => {
  describe('auto-confirm threshold', () => {
    it('should auto-confirm at 0.6 confidence', async () => {
      // Mock dimension suggestion with 0.65 confidence
      const tag = await autoTagCorpusItem({...});
      expect(tag.confirmedByUser).toBe(true);
    });

    it('should NOT auto-confirm below 0.6', async () => {
      // Mock dimension suggestion with 0.55 confidence
      const tag = await autoTagCorpusItem({...});
      expect(tag.confirmedByUser).toBe(false);
    });
  });
});
```

### E2E Tests

**File:** `tests/readiness-reevaluation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Readiness Reevaluation', () => {
  test('readiness updates within 5 seconds after applying recommendations', async ({ page }) => {
    // 1. Navigate to research page
    await page.goto('/projects/[testProjectId]/research');

    // 2. Note initial readiness score
    const initialScore = await page.locator('[data-testid="readiness-score"]').textContent();

    // 3. Apply recommendations
    await page.click('[data-testid="apply-recommendations"]');
    await page.waitForSelector('[data-testid="apply-success"]', { timeout: 10000 });

    // 4. Verify score updated (within 5 seconds)
    await expect(async () => {
      const newScore = await page.locator('[data-testid="readiness-score"]').textContent();
      expect(parseInt(newScore)).toBeGreaterThan(parseInt(initialScore));
    }).toPass({ timeout: 5000 });
  });

  test('suggested topics update after apply', async ({ page }) => {
    // 1. Note initial gap count
    const initialGaps = await page.locator('[data-testid="suggested-topic"]').count();

    // 2. Apply recommendations for one dimension
    await page.click('[data-testid="apply-recommendations"]');
    await page.waitForSelector('[data-testid="apply-success"]');

    // 3. Verify gap count decreased
    const newGaps = await page.locator('[data-testid="suggested-topic"]').count();
    expect(newGaps).toBeLessThan(initialGaps);
  });

  test('inline readiness indicator shows improvement animation', async ({ page }) => {
    // Apply and verify "+X%" indicator appears
    await page.click('[data-testid="apply-recommendations"]');
    await expect(page.locator('[data-testid="score-improvement"]')).toBeVisible();
  });
});
```

### Integration Tests

**Purpose:** Verify auto-tagging completes before API response

```typescript
describe('Apply Recommendations Integration', () => {
  it('auto-tagging completes before response', async () => {
    // 1. Apply recommendation
    const response = await fetch('/api/projects/[id]/apply-recommendations', {
      method: 'POST',
      body: JSON.stringify({ recommendationIds: [recId] }),
    });

    // 2. Immediately check for dimension tag
    const tag = await prisma.corpusDimensionTag.findFirst({
      where: { contextLayerId: layerId },
    });

    // Tag should exist (not race condition)
    expect(tag).toBeTruthy();
  });
});
```

---

## Performance Considerations

### Auto-Tagging Latency

| Items Applied | Current (Async) | New (Blocking) |
|---------------|-----------------|----------------|
| 1 | ~0ms wait | ~1.5s wait |
| 5 | ~0ms wait | ~2.5s wait |
| 10 | ~0ms wait | ~3.5s wait |

**Mitigation:** Show progress steps during wait. User accepted 2-3 second delay.

### Readiness API Without Cache

| Request | With Cache (300s) | Without Cache |
|---------|-------------------|---------------|
| First | ~100ms (DB query) | ~100ms (DB query) |
| Subsequent | ~5ms (cached) | ~100ms (DB query) |

**Impact:** Minimal. Readiness queries are fast (single DB query with joins). No external API calls.

### Concurrent Auto-Tagging

Auto-tagging uses `Promise.all()` for parallelism. With OpenAI rate limits, 10 concurrent calls are safe.

---

## Security Considerations

- **No new endpoints** - Uses existing authenticated APIs
- **No new data exposure** - Readiness data already accessible to project owners
- **Rate limiting** - OpenAI API has built-in rate limits for dimension suggestions

---

## Documentation

### Files to Update

1. **`.claude/CLAUDE.md`** - Add section on readiness reevaluation behavior
2. **`developer-guides/wizard-flow.md`** - Document blocking auto-tag change

### Inline Code Comments

Add comments explaining:
- Why auto-tagging is blocking (race condition prevention)
- Why cache is disabled (immediacy over scale)
- Why thresholds are set at 0.6 / 40%

---

## Implementation Phases

### Phase 1: Core Fixes (Backend)
1. Make auto-tagging blocking in `applyRecommendations.ts`
2. Remove HTTP cache from readiness API
3. Adjust scoring thresholds (0.6 auto-confirm, 40% unconfirmed)
4. Add fresh readiness to apply response

### Phase 2: UI Integration
1. Create `InlineReadinessIndicator` component
2. Integrate indicator into research page
3. Add refetch logic for suggested topics
4. Add `refreshTrigger` mechanism

### Phase 3: Polish
1. Add progress steps during apply
2. Add "+X%" improvement animation
3. Write E2E tests
4. Update documentation

---

## Files Modified

| File | Change |
|------|--------|
| `lib/applyRecommendations.ts` | Make auto-tagging blocking |
| `app/api/projects/[id]/readiness/route.ts` | Remove cache header |
| `lib/dimensions/autoTag.ts` | Lower threshold to 0.6 |
| `lib/readiness/scoring.ts` | Raise unconfirmed to 40% |
| `app/api/projects/[id]/apply-recommendations/route.ts` | Return fresh readiness |
| `app/projects/[id]/research/ResearchPageContent.tsx` | Add indicator, refetch logic |
| `components/research/InlineReadinessIndicator.tsx` | NEW: Inline progress bar |

---

## Open Questions

**None.** All clarifications resolved in ideation phase.

---

## References

- **Ideation Doc:** `specs/auto-readiness-reevaluation-after-corpus-update/01-ideation.md`
- **Readiness Scoring:** `lib/readiness/scoring.ts`
- **Auto-Tagging:** `lib/dimensions/autoTag.ts`
- **Apply Recommendations:** `lib/applyRecommendations.ts`
- **Research Page:** `app/projects/[id]/research/ResearchPageContent.tsx`
- **Wizard Flow Spec:** `specs/simplified-frontend-wrapper/02-specification.md`
