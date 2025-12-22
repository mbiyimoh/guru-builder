# Automatic Readiness Reevaluation After Corpus Updates

**Slug:** auto-readiness-reevaluation-after-corpus-update
**Author:** Claude Code
**Date:** 2025-12-21
**Branch:** feat/auto-readiness-reevaluation
**Related:** Research workflow, Readiness scoring system, Apply recommendations flow

---

## 1) Intent & Assumptions

**Task brief:** Users apply research recommendations to update their corpus, but the readiness score doesn't automatically reevaluate. The UI still shows outdated gaps (like "foundations" and "progression") even after adding content. Need automatic reevaluation when corpus changes and better UX to surface updated readiness scores and remaining gaps after applying recommendations.

**Assumptions:**
- Readiness scoring logic (`calculateReadinessScore`) is correct and works
- The issue is that calculation is NOT triggered when corpus is updated
- Users expect immediate feedback after applying recommendations
- Current caching (`Cache-Control: private, max-age=300`) may prevent seeing fresh scores
- Auto-tagging happens asynchronously in `applyRecommendations.ts` but readiness scoring doesn't wait for it

**Out of scope:**
- Multi-user collaboration scenarios
- Real-time websocket updates (polling is acceptable)

**In scope (updated):**
- Adjustments to scoring algorithm to better reflect unconfirmed content value
- Adjustments to auto-confirm threshold

---

## 2) Pre-reading Log

**Documentation:**
- `.claude/CLAUDE.md`: Confirms async job patterns and race condition awareness, mentions readiness scoring in wizard context

**Code files analyzed:**
- `app/api/projects/[id]/readiness/route.ts`: GET endpoint with 5-minute cache, calls `calculateReadinessScore()`
- `lib/readiness/scoring.ts`: Core scoring logic - queries DB for layers/files/tags and calculates weighted score
- `app/projects/[id]/readiness/ReadinessPageContent.tsx`: Client component that fetches readiness once on mount via `useEffect`
- `lib/applyRecommendations.ts`: Applies recommendations and calls `autoTagCorpusItem()` asynchronously (non-blocking)
- `app/api/projects/[id]/apply-recommendations/route.ts`: POST endpoint that applies recommendations but does NOT trigger readiness recalculation
- `lib/dimensions/autoTag.ts`: Auto-tags corpus items, currently auto-confirms at ≥0.8 confidence

---

## 3) Codebase Map

**Primary components/modules:**
- **`lib/readiness/scoring.ts`** - Core calculation logic (no caching)
- **`app/api/projects/[id]/readiness/route.ts`** - API route with 5-min HTTP cache
- **`app/projects/[id]/readiness/ReadinessPageContent.tsx`** - UI component (fetches once on mount)
- **`lib/applyRecommendations.ts`** - Applies changes, triggers async auto-tagging
- **`lib/dimensions/autoTag.ts`** - Auto-tags corpus items (called async, non-blocking)
- **`app/api/projects/[id]/apply-recommendations/route.ts`** - Apply endpoint
- **`app/projects/[id]/research/ResearchPageContent.tsx`** - Research page with suggested topics

**Shared dependencies:**
- Prisma (database queries for layers, files, dimension tags)
- Next.js caching (`Cache-Control` headers, `export const dynamic`)

**Data flow:**
```
User applies recommendations
  → POST /api/projects/[id]/apply-recommendations
    → applyRecommendations()
      → Creates/updates ContextLayer or KnowledgeFile
      → Triggers autoTagCorpusItem() asynchronously (fire-and-forget)
      → Returns success immediately
  → UI shows success
  → User navigates to readiness page
    → GET /api/projects/[id]/readiness (returns cached result if <5 min)
    → calculateReadinessScore() queries DB for dimension tags
      → May NOT include newly auto-tagged items if auto-tag is still running
```

**Feature flags/config:**
- `Cache-Control: private, max-age=300` in readiness API
- `export const dynamic = 'force-dynamic'` in readiness route (prevents static generation)

**Potential blast radius:**
- Readiness page UI
- Apply recommendations API response
- Research page (suggested topics section)
- Any components that display readiness score or gaps

---

## 4) Root Cause Analysis

**Repro steps:**
1. Create project with GuruProfile
2. Run research on "foundations" dimension
3. Approve and apply all recommendations
4. Navigate to readiness page
5. Observe readiness score and critical gaps

**Observed vs Expected:**
- **Observed:** Readiness score stays same, critical gaps still show "foundations" and "progression" even after applying recommendations
- **Expected:** Readiness score updates to reflect new corpus content, critical gaps list shrinks or disappears

**Evidence:**

1. **HTTP Cache (5 minutes):**
   - `app/api/projects/[id]/readiness/route.ts:35`: `Cache-Control: private, max-age=300`
   - Browser/CDN may serve stale score for up to 5 minutes after corpus update

2. **Client-side fetch runs once on mount:**
   - `app/projects/[id]/readiness/ReadinessPageContent.tsx:22-44`: `useEffect(..., [projectId])`
   - No polling, no refetch on navigation, no cache busting

3. **Auto-tagging is async (fire-and-forget):**
   - `lib/applyRecommendations.ts:114-127`: `autoTagCorpusItem(...).catch(...)` - NOT awaited
   - Readiness calculation may run BEFORE auto-tagging completes
   - Even if cache is busted, dimension tags may not exist yet

4. **No cache invalidation after apply:**
   - `app/api/projects/[id]/apply-recommendations/route.ts:84-90`: Returns success but doesn't bust readiness cache
   - No signal to UI that readiness should be refetched

5. **Harsh unconfirmed scoring:**
   - `lib/readiness/scoring.ts:91-96`: Unconfirmed items = 25% coverage only
   - Auto-confirm threshold is 0.8 (`lib/dimensions/autoTag.ts:86`)
   - If AI confidence is 0.6-0.79, content is added but still shows as a "gap"

**Root-cause hypotheses:**

1. **HTTP caching (HIGH confidence):** 5-minute cache prevents seeing fresh calculations
2. **No refetch trigger (HIGH confidence):** UI doesn't know to refetch after apply
3. **Async tagging race condition (HIGH confidence):** Auto-tag may not complete before readiness recalculation
4. **Scoring penalizes unconfirmed too harshly (MEDIUM confidence):** 25% for unconfirmed doesn't reflect content value

**Decision:** All four causes contribute. Need to address caching, refetch mechanism, async race condition, AND scoring formula.

---

## 5) Research

### Potential Solutions

#### Solution 1: Cache Invalidation + Client Refetch

**Approach:**
- Remove or reduce `Cache-Control: max-age` on readiness API
- Add cache-busting param or headers after apply
- Client component refetches readiness after applying recommendations

**Pros:**
- Simple to implement
- No backend changes to apply flow
- Works with existing scoring logic
- Browser handles cache correctly

**Cons:**
- Doesn't solve async auto-tagging race condition
- User may still see stale score if auto-tag is slow
- Requires coordination between apply success and readiness refetch

#### Solution 2: Server-Side Readiness Recalculation After Apply

**Approach:**
- `applyRecommendations()` awaits auto-tagging (make it blocking)
- After tagging completes, trigger readiness recalculation server-side
- Return fresh readiness score in apply response
- UI can show updated score immediately without separate fetch

**Pros:**
- Eliminates race condition (auto-tag completes before score calculated)
- UI gets fresh score atomically with apply success
- No need for separate refetch
- User sees instant feedback

**Cons:**
- Makes apply endpoint slower (blocks on auto-tagging)
- Auto-tagging currently fire-and-forget for performance
- Increases complexity of apply flow
- Could timeout if auto-tagging takes too long

#### Solution 3: Optimistic UI Update + Background Sync

**Approach:**
- UI optimistically updates readiness score after apply (e.g., increment by 10%)
- Background polling refetches actual score every 5-10 seconds
- Display loading indicator until real score available

**Pros:**
- Immediate perceived feedback
- Handles async tagging gracefully
- No changes to backend timing

**Cons:**
- Optimistic update may be inaccurate
- Adds complexity to client state management
- User sees "fake" score briefly
- Polling overhead

#### Solution 4: Event-Driven Reevaluation (Inngest Job)

**Approach:**
- `applyRecommendations()` sends Inngest event: `corpus/updated`
- Inngest job waits for auto-tagging, then recalculates readiness
- Store calculated readiness in DB (new table: `ProjectReadinessCache`)
- API serves from cache, job keeps it fresh

**Pros:**
- Decouples readiness calc from apply flow (async)
- Handles auto-tagging race properly (job waits)
- Readiness API becomes fast (serves cached result)
- Scalable architecture

**Cons:**
- Adds new DB table
- Requires Inngest job setup
- Introduces eventual consistency (score updates 5-30s after apply)
- More complex system

---

### Recommendation

**Comprehensive approach addressing all root causes:**

1. **Make auto-tagging blocking** in `applyRecommendations()`
   - Await all auto-tag calls before returning
   - Show progress steps to user during wait (2-3 seconds acceptable)

2. **Remove HTTP cache entirely** from readiness API
   - User prefers immediacy over scale
   - Always calculate on-demand

3. **Adjust scoring formula** to be more generous to unconfirmed content:
   - Lower auto-confirm threshold to 0.6 (from 0.8)
   - AND increase unconfirmed coverage to 40% (from 25%)
   - This way adding content meaningfully improves score even at lower confidence

4. **Add inline readiness indicator on research page**
   - Slim, full-width progress bar below suggested topics, above research assistant
   - Updates after applying recommendations
   - Button to view full readiness report

5. **Update suggested topics dynamically**
   - After applying recommendations, refetch and remove addressed gaps
   - e.g., "foundations — high priority" disappears when foundations is covered

---

## 6) Clarifications (Resolved)

### Q1: Auto-tagging performance
**A:** Unknown, but user accepts 2-3 second delay if steps are displayed.

### Q2: Acceptable delay
**A:** Yes, 2-3 seconds is acceptable. Display progress steps visually so user sees system is working.

### Q3: Caching strategy
**A:** Always on-demand. Immediacy > scale.

### Q4: UX after applying
**A:** Option A - Stay on research page. Add slim inline readiness indicator (full-width bar below suggested topics, above research assistant) with button to view full report. Suggested topics should update to remove addressed gaps.

### Q5: Dimension tagging confirmation
**A:** Hybrid approach:
- Lower auto-confirm threshold to 0.6 (from 0.8) so more content gets confirmed
- Also increase unconfirmed coverage value to 40% (from 25%) so even unconfirmed content provides meaningful score improvement

---

## 7) Implementation Notes

**Scoring Formula Changes:**

Current:
```typescript
// Auto-confirm if confidence ≥ 0.8
const confirmedByUser = suggestion.confidence >= 0.8;

// Coverage:
// - 0 items = 0%
// - 1+ unconfirmed = 25%
// - 1 confirmed = 60%, 2 confirmed = 70%, etc.
```

New:
```typescript
// Auto-confirm if confidence ≥ 0.6 (lowered from 0.8)
const confirmedByUser = suggestion.confidence >= 0.6;

// Coverage:
// - 0 items = 0%
// - 1+ unconfirmed = 40% (raised from 25%)
// - 1 confirmed = 60%, 2 confirmed = 70%, etc.
```

**Files to modify:**
- `lib/dimensions/autoTag.ts:86` - Change auto-confirm threshold: 0.8 → 0.6
- `lib/readiness/scoring.ts:94-95` - Change unconfirmed coverage: 25 → 40
- `lib/applyRecommendations.ts:114-127` - Make auto-tagging blocking (await Promise.all)
- `app/api/projects/[id]/readiness/route.ts:35` - Remove Cache-Control header
- `app/projects/[id]/research/ResearchPageContent.tsx` - Add inline readiness indicator component
- `app/projects/[id]/research/ResearchPageContent.tsx` - Add refetch for suggested topics after apply

**New Components:**
- `components/research/InlineReadinessIndicator.tsx` - Slim progress bar with score + view report button

**Testing considerations:**
- E2E test: Apply recommendations → verify readiness updates within 5 seconds
- E2E test: Apply recommendations → verify suggested topics update (addressed gaps removed)
- Unit test: `applyRecommendations` with mocked auto-tagging (verify blocking)
- Unit test: Scoring formula with various confirmed/unconfirmed combinations

---

## 8) Open Questions

**None remaining.** All clarifications have been resolved. Ready for specification.

---
