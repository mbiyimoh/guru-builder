# Task Breakdown: Automatic Readiness Reevaluation After Corpus Updates

**Generated:** 2025-12-21
**Source:** specs/auto-readiness-reevaluation-after-corpus-update/02-specification.md
**Feature Slug:** auto-readiness-reevaluation-after-corpus-update
**Last Decompose:** 2025-12-21

---

## Overview

This task breakdown implements automatic readiness score updates when users apply research recommendations. The core problem is that readiness scores don't update after corpus changes due to async tagging, HTTP caching, and harsh scoring formulas.

**Total Tasks:** 10
**Phases:** 3 (Backend Core, UI Integration, Polish & Testing)

---

## Phase 1: Backend Core Fixes

### Task 1.1: Make Auto-Tagging Blocking with Timeout

**Description:** Convert fire-and-forget auto-tagging to blocking with Promise.all and safety timeout
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.2, 1.3

**File to modify:** `lib/applyRecommendations.ts`
**Lines:** 113-127

**Current Code:**
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

**New Code to Implement:**
```typescript
// Collect all auto-tag promises (declare at top of function, before the loop)
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

// After the transaction completes (after line 131), add:
// Wait for auto-tagging with timeout
const AUTO_TAG_TIMEOUT_MS = 10000; // 10 second safety timeout
await Promise.race([
  Promise.all(autoTagPromises),
  new Promise((resolve) => setTimeout(resolve, AUTO_TAG_TIMEOUT_MS))
]);
```

**Implementation Notes:**
- Declare `autoTagPromises` array BEFORE the for loop (around line 95)
- Move the auto-tag call INSIDE the loop but push to array instead of fire-and-forget
- Add the `await Promise.race` AFTER the transaction (after line 131, before the return)
- The timeout prevents hanging if OpenAI is slow

**Acceptance Criteria:**
- [ ] Auto-tagging completes before API response returns
- [ ] Request doesn't hang beyond 10 seconds even if tagging is slow
- [ ] Individual tag failures are logged but don't block the response
- [ ] TypeScript compiles without errors

---

### Task 1.2: Remove HTTP Cache from Readiness API

**Description:** Change Cache-Control header from 5-minute cache to no-store
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.3

**File to modify:** `app/api/projects/[id]/readiness/route.ts`
**Line:** 35

**Current Code:**
```typescript
return NextResponse.json(
  {
    success: true,
    score,
    dimensions,
  },
  {
    headers: {
      'Cache-Control': 'private, max-age=300', // 5 minutes cache
    },
  }
);
```

**New Code:**
```typescript
return NextResponse.json(
  {
    success: true,
    score,
    dimensions,
  },
  {
    headers: {
      'Cache-Control': 'no-store', // Always fresh - user prioritizes immediacy
    },
  }
);
```

**Acceptance Criteria:**
- [ ] Readiness API returns `Cache-Control: no-store` header
- [ ] Multiple rapid fetches return fresh data each time
- [ ] No caching behavior observed in browser DevTools

---

### Task 1.3: Lower Auto-Confirm Threshold to 0.6

**Description:** Change auto-confirm confidence threshold from 0.8 to 0.6
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.2

**File to modify:** `lib/dimensions/autoTag.ts`
**Line:** 86

**Current Code:**
```typescript
// Determine if this should be auto-confirmed
const confirmedByUser = suggestion.confidence >= 0.8;
```

**New Code:**
```typescript
// Auto-confirm at 0.6 threshold (lowered from 0.8 to capture more content)
// Most AI suggestions fall in 0.6-0.79 range, so this ensures meaningful score improvement
const confirmedByUser = suggestion.confidence >= 0.6;
```

**Acceptance Criteria:**
- [ ] Tags with confidence 0.6-0.79 are now auto-confirmed
- [ ] Tags with confidence < 0.6 remain unconfirmed
- [ ] Confirmed tags contribute to higher readiness score

---

### Task 1.4: Raise Unconfirmed Coverage to 40%

**Description:** Change unconfirmed item coverage from 25% to 40%
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 1.1, 1.2, 1.3

**File to modify:** `lib/readiness/scoring.ts`
**Line:** 95

**Current Code:**
```typescript
} else if (itemCount > 0) {
  coveragePercent = 25;  // Unconfirmed items = 25% coverage
}
```

**New Code:**
```typescript
} else if (itemCount > 0) {
  coveragePercent = 40;  // Unconfirmed items = 40% coverage (raised from 25%)
  // Even unconfirmed content represents meaningful corpus coverage
}
```

**Acceptance Criteria:**
- [ ] Dimensions with only unconfirmed tags show 40% coverage
- [ ] Confirmed items still show 50%+ coverage
- [ ] Overall readiness score increases for projects with unconfirmed tags

---

### Task 1.5: Add Fresh Readiness to Apply Response

**Description:** Include calculated readiness score in apply-recommendations API response
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1 (blocking auto-tag must complete first)
**Can run parallel with:** None (depends on 1.1)

**File to modify:** `app/api/projects/[id]/apply-recommendations/route.ts`

**Changes Required:**

1. Add import at top of file:
```typescript
import { calculateReadinessScore } from '@/lib/readiness/scoring';
```

2. After `applyRecommendations()` call, add readiness calculation:
```typescript
// Existing code
const result = await applyRecommendations({
  projectId,
  recommendationIds,
  snapshotName,
  snapshotDescription,
});

// NEW: Calculate fresh readiness after apply
const { score: freshReadiness } = await calculateReadinessScore(projectId);

// Update return to include readiness
return NextResponse.json({
  success: result.success,
  snapshotId: result.snapshotId,
  appliedCount: result.appliedCount,
  changes: result.changes,
  readiness: freshReadiness,  // NEW: Include fresh score
});
```

3. Update type in `lib/applyRecommendations.ts`:
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
    overall: number;
    profile: number;
    knowledge: number;
    criticalGaps: string[];
    suggestedGaps: string[];
    dimensionScores: Record<string, number>;
  };
}
```

**Acceptance Criteria:**
- [ ] Apply response includes `readiness` object with score
- [ ] Readiness is calculated AFTER blocking auto-tagging completes
- [ ] TypeScript compiles without errors
- [ ] API response is <5 seconds for typical apply operations

---

## Phase 2: UI Integration

### Task 2.1: Create InlineReadinessIndicator Component

**Description:** Build new component showing slim progress bar with score on research page
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2 (no-cache API)
**Can run parallel with:** None

**New File:** `components/research/InlineReadinessIndicator.tsx`

**Complete Implementation:**
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
        setScore(data.score);
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
  const isReady = score.overall >= 60 && score.criticalGaps.length === 0;

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
                  isReady ? 'bg-green-500' : 'bg-amber-500'
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
                isReady ? 'text-green-600' : 'text-amber-600'
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

**Acceptance Criteria:**
- [ ] Component displays loading skeleton initially
- [ ] Progress bar shows correct percentage width
- [ ] Color is green when ready (≥60% + no critical gaps), amber otherwise
- [ ] "+X%" animation shows when score improves
- [ ] Critical gaps count displayed when present
- [ ] "View Report" link navigates to readiness page
- [ ] data-testid attributes present for E2E testing

---

### Task 2.2: Integrate Indicator into Research Page

**Description:** Add InlineReadinessIndicator to research page with refresh trigger
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** None

**File to modify:** `app/projects/[id]/research/ResearchPageContent.tsx`

**Changes Required:**

1. Add import:
```typescript
import { InlineReadinessIndicator } from '@/components/research/InlineReadinessIndicator';
```

2. Add state for refresh trigger (near other useState declarations):
```typescript
const [readinessRefreshTrigger, setReadinessRefreshTrigger] = useState(0);
```

3. Add component in JSX (below suggested topics header, above research assistant):
```tsx
{/* Inline Readiness Indicator */}
<InlineReadinessIndicator
  projectId={projectId}
  refreshTrigger={readinessRefreshTrigger}
/>
```

4. Update apply success handler to trigger refresh:
```typescript
// After successful apply
setReadinessRefreshTrigger(prev => prev + 1);
```

**Acceptance Criteria:**
- [ ] Indicator appears on research page below suggested topics
- [ ] Indicator updates after applying recommendations
- [ ] No layout shift when indicator loads/updates

---

### Task 2.3: Update Suggested Topics After Apply

**Description:** Refetch readiness to update suggested topics list after applying recommendations
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 1.5, Task 2.2
**Can run parallel with:** None

**File to modify:** `app/projects/[id]/research/ResearchPageContent.tsx`

**Changes Required:**

1. Update the existing `fetchReadiness` function to use no-store:
```typescript
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
```

2. Add refetch after apply success:
```typescript
const handleApplySuccess = async () => {
  // Refetch readiness to update suggested topics
  await fetchReadiness();
  // Trigger inline indicator refresh
  setReadinessRefreshTrigger(prev => prev + 1);
};
```

**Acceptance Criteria:**
- [ ] Suggested topics list updates after apply
- [ ] Addressed gaps are removed from the list
- [ ] Critical gaps section updates appropriately

---

## Phase 3: Polish & Testing

### Task 3.1: Write Unit Tests for Scoring Changes

**Description:** Add unit tests for new scoring thresholds
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 1.3, 1.4
**Can run parallel with:** Task 3.2

**New File:** `lib/__tests__/readiness-scoring.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    pedagogicalDimension: {
      findMany: vi.fn(),
    },
  },
}));

import { calculateReadinessScore } from '../readiness/scoring';
import { prisma } from '@/lib/db';

describe('Readiness Scoring', () => {
  describe('unconfirmed coverage', () => {
    it('should return 40% for dimensions with only unconfirmed items', async () => {
      // Setup mock data with unconfirmed tags
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: 'test-project',
        currentProfile: {
          profileData: {
            domainExpertise: 'Test',
            specificTopics: ['topic1'],
            audienceLevel: 'beginner',
            audienceDescription: 'Test audience',
            pedagogicalApproach: 'Test approach',
            tone: 'friendly',
            communicationStyle: 'conversational',
            uniquePerspective: 'Test perspective',
            successMetrics: 'Test metrics',
          },
        },
        contextLayers: [{
          id: 'layer-1',
          dimensionTags: [{
            dimensionId: 'dim-foundations',
            confirmedByUser: false,
            confidence: 0.5,
          }],
        }],
        knowledgeFiles: [],
      } as any);

      vi.mocked(prisma.pedagogicalDimension.findMany).mockResolvedValue([
        { id: 'dim-foundations', key: 'foundations', name: 'Foundations', isCritical: true, priority: 1 },
      ] as any);

      const result = await calculateReadinessScore('test-project');

      // With only unconfirmed items, coverage should be 40%
      expect(result.score.dimensionScores.foundations).toBe(40);
    });

    it('should return 50%+ for dimensions with confirmed items', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: 'test-project',
        currentProfile: { profileData: { /* ... */ } },
        contextLayers: [{
          id: 'layer-1',
          dimensionTags: [{
            dimensionId: 'dim-foundations',
            confirmedByUser: true,
            confidence: 0.8,
          }],
        }],
        knowledgeFiles: [],
      } as any);

      const result = await calculateReadinessScore('test-project');

      // With 1 confirmed item, coverage should be 60%
      expect(result.score.dimensionScores.foundations).toBe(60);
    });
  });
});
```

**Acceptance Criteria:**
- [ ] Test verifies 40% coverage for unconfirmed items
- [ ] Test verifies 60%+ coverage for confirmed items
- [ ] Tests pass with `npm run test:unit`

---

### Task 3.2: Write E2E Test for Readiness Update Flow

**Description:** E2E test verifying readiness updates after applying recommendations
**Size:** Medium
**Priority:** Medium
**Dependencies:** All Phase 1 and 2 tasks
**Can run parallel with:** Task 3.1

**New File:** `tests/readiness-reevaluation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Readiness Reevaluation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test project with recommendations
    // This test assumes a test project exists with approved recommendations
  });

  test('readiness score updates after applying recommendations', async ({ page }) => {
    // 1. Navigate to research page
    await page.goto('/projects/[testProjectId]/research');

    // 2. Wait for inline indicator to load
    await page.waitForSelector('[data-testid="readiness-score"]');

    // 3. Note initial readiness score
    const initialScoreText = await page.locator('[data-testid="readiness-score"]').textContent();
    const initialScore = parseInt(initialScoreText || '0');

    // 4. Click apply recommendations (assuming button exists)
    await page.click('[data-testid="apply-recommendations"]');

    // 5. Wait for apply success
    await page.waitForSelector('[data-testid="apply-success"]', { timeout: 15000 });

    // 6. Verify score improvement indicator appears
    await expect(page.locator('[data-testid="score-improvement"]')).toBeVisible({ timeout: 5000 });

    // 7. Verify score increased
    const newScoreText = await page.locator('[data-testid="readiness-score"]').textContent();
    const newScore = parseInt(newScoreText || '0');
    expect(newScore).toBeGreaterThanOrEqual(initialScore);
  });

  test('suggested topics update after apply', async ({ page }) => {
    await page.goto('/projects/[testProjectId]/research');

    // Count initial suggested topics
    const initialCount = await page.locator('[data-testid="suggested-topic"]').count();

    // Apply recommendations
    await page.click('[data-testid="apply-recommendations"]');
    await page.waitForSelector('[data-testid="apply-success"]', { timeout: 15000 });

    // Wait for refetch
    await page.waitForTimeout(2000);

    // Verify gap count decreased or stayed same (shouldn't increase)
    const newCount = await page.locator('[data-testid="suggested-topic"]').count();
    expect(newCount).toBeLessThanOrEqual(initialCount);
  });
});
```

**Acceptance Criteria:**
- [ ] Test creates/uses a test project with recommendations
- [ ] Test verifies score updates within timeout
- [ ] Test verifies suggested topics update
- [ ] Tests pass with `npm run test:e2e`

---

### Task 3.3: Update Documentation

**Description:** Update CLAUDE.md with readiness reevaluation behavior
**Size:** Small
**Priority:** Low
**Dependencies:** All implementation tasks
**Can run parallel with:** Task 3.1, 3.2

**File to modify:** `.claude/CLAUDE.md`

**Add new section under "Wizard Flow":**

```markdown
### Readiness Reevaluation

When recommendations are applied, the system automatically:
1. **Blocks on auto-tagging** - Waits for dimension tags to be created (up to 10s timeout)
2. **Calculates fresh score** - Returns updated readiness in apply response
3. **Updates UI** - InlineReadinessIndicator on research page shows new score with animation

**Key Files:**
- `lib/applyRecommendations.ts` - Blocking auto-tag with Promise.all
- `lib/readiness/scoring.ts` - Coverage calculation (40% unconfirmed, 50%+ confirmed)
- `lib/dimensions/autoTag.ts` - Auto-confirm threshold at 0.6
- `app/api/projects/[id]/readiness/route.ts` - No-cache API
- `components/research/InlineReadinessIndicator.tsx` - Progress bar with refresh

**Scoring Thresholds:**
- Auto-confirm confidence: 0.6 (tags >= 0.6 are auto-confirmed)
- Unconfirmed coverage: 40%
- Confirmed base: 50% + 10% per additional confirmed tag
```

**Acceptance Criteria:**
- [ ] Documentation accurately describes new behavior
- [ ] Key files and thresholds documented
- [ ] No stale information

---

## Dependency Graph

```
Phase 1 (Parallel):
  1.1 ─┬─► 1.5
  1.2 ─┘
  1.3 ─────► (independent)
  1.4 ─────► (independent)

Phase 2 (Sequential):
  2.1 ──► 2.2 ──► 2.3

Phase 3 (Parallel after Phase 1 & 2):
  3.1 ─────► (parallel)
  3.2 ─────► (parallel)
  3.3 ─────► (parallel)
```

---

## Execution Strategy

### Recommended Order

1. **Start with Phase 1 tasks in parallel** (1.1, 1.2, 1.3, 1.4)
   - These are all small, independent changes
   - Can be done by same developer rapidly or parallelized

2. **Complete 1.5** after 1.1 is done
   - Depends on blocking auto-tag being implemented

3. **Move to Phase 2 sequentially** (2.1 → 2.2 → 2.3)
   - Component must exist before integration
   - Integration before suggested topics update

4. **Phase 3 in parallel** after all implementation done
   - Tests and docs can be written simultaneously

### Critical Path

```
1.1 → 1.5 → 2.1 → 2.2 → 2.3 → 3.2
```

Estimated completion: All tasks can be done in a focused session.

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Backend | 5 | High |
| Phase 2: UI | 3 | High |
| Phase 3: Polish | 2 | Medium |
| **Total** | **10** | |

**Parallel Opportunities:**
- Tasks 1.1, 1.2, 1.3, 1.4 (4 tasks)
- Tasks 3.1, 3.2, 3.3 (3 tasks)
