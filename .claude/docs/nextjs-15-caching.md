# Next.js 15 Caching - Project Reference

**Version:** 15.2.4 | **Last updated:** 2025-12-06

## TL;DR

Next.js 15 **inverted caching defaults**: `fetch()`, GET handlers, and Router Cache are now **uncached by default** (opposite of v14). Your current patterns (`force-dynamic` + `Cache-Control: no-store`) are **correct** for polling endpoints. `router.refresh()` only clears client cache—use `revalidatePath()` in Server Actions to clear ALL caches.

## Gotchas

| Issue | Severity | Fix |
|-------|----------|-----|
| **`router.refresh()` doesn't clear server caches** | HIGH | Use `revalidatePath()` in Server Actions |
| **`Cache-Control` in next.config.js ignored** | HIGH | Set headers directly in Route Handlers |
| **DB queries not detected as dynamic** | HIGH | Add `unstable_noStore()` or `dynamic = 'force-dynamic'` |
| **`dynamic = 'force-dynamic'` affects ALL fetches** | MEDIUM | Use per-fetch `cache: 'no-store'` if needed |
| **Conflicting cache options ignored** | MEDIUM | Don't mix `no-store` with `revalidate` |
| **Stale-while-revalidate is by design** | LOW | First request after expiry returns stale data |

## Your Patterns (Keep These)

### Polling Endpoints (Correct)
```typescript
// app/api/research/[runId]/status/route.ts
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }) {
  const status = await db.researchRun.findUnique({...});

  return Response.json(status, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

### Async Job Results Pages (Correct)
```typescript
// app/projects/[id]/research/[runId]/page.tsx
export const dynamic = 'force-dynamic';  // Recommendations generated async

export default async function ResearchResultsPage({ params }) {
  const recommendations = await db.recommendation.findMany({...});
  return <RecommendationsList recommendations={recommendations} />;
}
```

### Race Condition Fix (Correct)
```typescript
// Poll until BOTH conditions met
if (status === 'COMPLETED' && recommendationCount > 0) {
  router.refresh(); // Safe - all data ready
} else if (status === 'COMPLETED') {
  setProgressMessage('Generating recommendations...');
  // Keep polling
}
```

## Cache Invalidation

### After Mutations (Server Actions)
```typescript
'use server';
import { revalidatePath } from 'next/cache';

export async function updateProject(id: string, data: any) {
  await db.project.update({ where: { id }, data });
  revalidatePath(`/projects/${id}`);  // Clears ALL caches
}
```

### DON'T rely on router.refresh()
```typescript
// WRONG - Only clears Router Cache (client)
const router = useRouter();
await fetch('/api/update', { method: 'POST' });
router.refresh();  // Server caches still stale!

// CORRECT - Use Server Action
await updateProject(id, data);  // Calls revalidatePath internally
```

## Quick Reference

### Route Segment Config
```typescript
export const dynamic = 'auto' | 'force-dynamic' | 'force-static' | 'error';
export const revalidate = false | 0 | number;  // seconds
```

| Config | Behavior |
|--------|----------|
| `dynamic = 'force-dynamic'` | Never cache, all fetches uncached |
| `dynamic = 'force-static'` | Force static, error if dynamic APIs used |
| `revalidate = 0` | Same as `force-dynamic` |
| `revalidate = 60` | ISR: revalidate every 60 seconds |

### fetch() Options (v15 Defaults)
```typescript
fetch(url)                              // Uncached (v15 default)
fetch(url, { cache: 'no-store' })       // Explicitly uncached
fetch(url, { cache: 'force-cache' })    // Cached indefinitely
fetch(url, { next: { revalidate: 60 }}) // ISR: 60 seconds
fetch(url, { next: { tags: ['posts'] }})// Tag for revalidateTag()
```

### Four Cache Layers

| Layer | Location | v15 Default | Cleared By |
|-------|----------|-------------|------------|
| Request Memoization | Server | Always on | Per-request |
| Data Cache | Server | Uncached | `revalidatePath/Tag` |
| Full Route Cache | Server | Static only | `revalidatePath` |
| Router Cache | Client | staleTime=0 | `router.refresh()` |

## When to Use What

| Scenario | Pattern |
|----------|---------|
| Polling endpoints | `force-dynamic` + `Cache-Control: no-store` |
| User dashboards | `force-dynamic` |
| Async job results | `force-dynamic` |
| Static content | `revalidate = 3600` |
| After mutations | `revalidatePath()` in Server Action |

## Debugging

```bash
# Enable cache debug logs
NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev
```

```typescript
// Check if route is dynamic
export default async function Page() {
  console.log('[DEBUG] Rendered at:', new Date().toISOString());
  // Same timestamp = cached, different = dynamic
}
```
