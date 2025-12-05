# Audit Trail Database Migration Plan

## Current State

The audit trail feature currently uses **in-memory storage** (`lib/assessment/auditStore.ts`) which is suitable for development but **not production-ready**.

### Limitations

- ❌ Data lost on server restart/redeploy
- ❌ Not suitable for serverless environments (Vercel, AWS Lambda)
- ❌ Memory leaks from setTimeout-based cleanup
- ❌ No persistence guarantee
- ❌ Cannot query historical audit data

## Migration Goal

Migrate audit trails to **PostgreSQL database** using Prisma ORM with zero downtime.

---

## Phase 1: Database Schema (2 hours)

### Step 1: Add Prisma Model

Add to `prisma/schema.prisma`:

```prisma
model AuditTrail {
  id            String   @id @default(cuid())
  messageId     String   @unique
  timestamp     DateTime @default(now())
  projectId     String   // Link to project for analytics
  model         String
  reasoning     Json?    // Array of reasoning traces (string[])
  contextLayers Int
  tokens        Json     // { prompt: number, completion: number, total: number }
  cost          Json     // { prompt: number, completion: number, total: number }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@index([projectId])
  @@index([timestamp])
  @@map("audit_trails")
}
```

Update Project model:

```prisma
model Project {
  // ... existing fields
  auditTrails   AuditTrail[]
}
```

### Step 2: Create Migration

```bash
npm run db:backup
npm run migrate:safe -- add-audit-trail-table
```

---

## Phase 2: Implement Database Layer (3 hours)

### Step 1: Create Repository Pattern

Create `lib/assessment/auditRepository.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { AuditTrail } from './auditStore'

const prisma = new PrismaClient()

export async function storeAuditTrailDb(
  auditTrail: AuditTrail & { projectId: string }
): Promise<void> {
  await prisma.auditTrail.create({
    data: {
      messageId: auditTrail.messageId,
      projectId: auditTrail.projectId,
      timestamp: auditTrail.timestamp,
      model: auditTrail.model,
      reasoning: auditTrail.reasoning || null,
      contextLayers: auditTrail.contextLayers,
      tokens: auditTrail.tokens,
      cost: auditTrail.cost,
    },
  })
}

export async function getAuditTrailDb(messageId: string): Promise<AuditTrail | null> {
  const trail = await prisma.auditTrail.findUnique({
    where: { messageId },
  })

  if (!trail) return null

  return {
    messageId: trail.messageId,
    timestamp: trail.timestamp,
    model: trail.model,
    reasoning: trail.reasoning as string[] | undefined,
    contextLayers: trail.contextLayers,
    tokens: trail.tokens as AuditTrail['tokens'],
    cost: trail.cost as AuditTrail['cost'],
  }
}

export async function updateAuditTrailDb(
  messageId: string,
  updates: Partial<AuditTrail>
): Promise<void> {
  await prisma.auditTrail.update({
    where: { messageId },
    data: {
      reasoning: updates.reasoning ?? undefined,
      tokens: updates.tokens ?? undefined,
      cost: updates.cost ?? undefined,
    },
  })
}

export async function cleanupOldAuditTrails(daysOld: number = 7): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
  const result = await prisma.auditTrail.deleteMany({
    where: { timestamp: { lt: cutoffDate } },
  })
  return result.count
}
```

### Step 2: Add Feature Flag

Add to `.env`:

```bash
# Audit Trail Storage Backend
# Options: "memory" (dev only), "database" (production)
AUDIT_TRAIL_BACKEND="memory"
```

### Step 3: Update auditStore.ts with Dual Backend

```typescript
import { getAuditTrailDb, storeAuditTrailDb, updateAuditTrailDb } from './auditRepository'

const USE_DATABASE = process.env.AUDIT_TRAIL_BACKEND === 'database'

export function storeAuditTrail(
  auditTrail: AuditTrail,
  projectId?: string
): void | Promise<void> {
  if (USE_DATABASE) {
    if (!projectId) throw new Error('projectId required for database storage')
    return storeAuditTrailDb({ ...auditTrail, projectId })
  }

  // Fallback to in-memory (existing code)
  auditStore.set(auditTrail.messageId, auditTrail)
  // ... rest of existing code
}

export function getAuditTrail(messageId: string): AuditTrail | undefined | Promise<AuditTrail | null> {
  if (USE_DATABASE) {
    return getAuditTrailDb(messageId)
  }

  // Fallback to in-memory
  return auditStore.get(messageId)
}

export function updateAuditTrail(
  messageId: string,
  updates: Partial<AuditTrail>
): void | Promise<void> {
  if (USE_DATABASE) {
    return updateAuditTrailDb(messageId, updates)
  }

  // Fallback to in-memory (existing code)
  const existing = auditStore.get(messageId)
  // ... rest of existing code
}
```

---

## Phase 3: Update Chat API (1 hour)

### Update API Route

`app/api/projects/[id]/assessment/chat/route.ts`:

```typescript
// Add projectId to audit trail creation
createPlaceholderAuditTrail({
  messageId,
  model: ASSESSMENT_MODEL,
  contextLayers: contextResult.layerCount,
  projectId, // Pass projectId for database storage
})
```

Update `lib/assessment/auditUtils.ts`:

```typescript
export function createPlaceholderAuditTrail(params: {
  messageId: string
  model: ModelName
  contextLayers: number
  projectId?: string // Optional for backward compatibility
}) {
  const { messageId, model, contextLayers, projectId } = params

  const placeholderAuditTrail = {
    messageId,
    timestamp: new Date(),
    model,
    reasoning: undefined,
    contextLayers,
    tokens: { prompt: 0, completion: 0, total: 0 },
    cost: { prompt: 0, completion: 0, total: 0 },
  }

  storeAuditTrail(placeholderAuditTrail, projectId)
}
```

---

## Phase 4: Scheduled Cleanup (2 hours)

### Add Inngest Cleanup Job

`lib/inngest-functions.ts`:

```typescript
export const auditTrailCleanup = inngest.createFunction(
  {
    id: "audit-trail-cleanup",
    name: "Clean Old Audit Trails"
  },
  { cron: "0 2 * * *" }, // Daily at 2 AM
  async () => {
    if (process.env.AUDIT_TRAIL_BACKEND === 'database') {
      const deletedCount = await cleanupOldAuditTrails(7)
      console.log(`[Audit Cleanup] Deleted ${deletedCount} old audit trails (>7 days)`)
      return { deletedCount, backend: 'database' }
    }

    console.log('[Audit Cleanup] Skipped - using in-memory backend')
    return { deletedCount: 0, backend: 'memory' }
  }
)
```

Register in Inngest serve route:

```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processResearchRun,
    generateRecommendations,
    auditTrailCleanup, // Add this
  ],
})
```

---

## Phase 5: Testing & Rollout (3 hours)

### Step 1: Add Tests

`lib/assessment/__tests__/auditRepository.test.ts`:

```typescript
describe('Database Audit Trail Repository', () => {
  beforeEach(async () => {
    await prisma.auditTrail.deleteMany()
  })

  it('should store and retrieve audit trail', async () => {
    const trail = {
      messageId: 'test-123',
      projectId: 'proj-1',
      timestamp: new Date(),
      model: 'claude-3-7-sonnet-20250219',
      contextLayers: 3,
      tokens: { prompt: 100, completion: 50, total: 150 },
      cost: { prompt: 0.0003, completion: 0.00075, total: 0.00105 },
    }

    await storeAuditTrailDb(trail)
    const retrieved = await getAuditTrailDb('test-123')

    expect(retrieved).toBeDefined()
    expect(retrieved?.messageId).toBe('test-123')
    expect(retrieved?.tokens.total).toBe(150)
  })

  it('should cleanup old trails', async () => {
    // Create old trail (10 days ago)
    await prisma.auditTrail.create({
      data: {
        messageId: 'old-123',
        projectId: 'proj-1',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        model: 'claude-3-7-sonnet-20250219',
        contextLayers: 1,
        tokens: {},
        cost: {},
      },
    })

    const deletedCount = await cleanupOldAuditTrails(7)
    expect(deletedCount).toBe(1)

    const retrieved = await getAuditTrailDb('old-123')
    expect(retrieved).toBeNull()
  })
})
```

### Step 2: Gradual Rollout

1. **Week 1**: Deploy with `AUDIT_TRAIL_BACKEND=memory` (current state)
2. **Week 2**: Enable database on staging: `AUDIT_TRAIL_BACKEND=database`
3. **Week 3**: Monitor for errors, validate data integrity
4. **Week 4**: Enable database on production
5. **Week 5**: Remove in-memory code after validation

### Step 3: Monitoring

Add logging to track backend usage:

```typescript
console.log(`[Audit Trail] Using backend: ${process.env.AUDIT_TRAIL_BACKEND || 'memory'}`)
console.log(`[Audit Trail] Stored: ${messageId} (cost: $${cost.total.toFixed(4)})`)
```

---

## Phase 6: Analytics Dashboard (Optional, 4 hours)

### Add Analytics Endpoint

`app/api/projects/[id]/assessment/analytics/route.ts`:

```typescript
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params

  const trails = await prisma.auditTrail.findMany({
    where: { projectId },
    orderBy: { timestamp: 'desc' },
    take: 100,
  })

  const analytics = {
    totalCost: trails.reduce((sum, t) => sum + (t.cost as any).total, 0),
    totalTokens: trails.reduce((sum, t) => sum + (t.tokens as any).total, 0),
    averageCost: trails.length > 0
      ? trails.reduce((sum, t) => sum + (t.cost as any).total, 0) / trails.length
      : 0,
    messageCount: trails.length,
    costByDay: groupByDay(trails),
    recentTrails: trails.slice(0, 10),
  }

  return NextResponse.json({ analytics })
}
```

---

## Effort Estimate

| Phase | Task | Time |
|-------|------|------|
| 1 | Database Schema | 2 hours |
| 2 | Implement Repository | 3 hours |
| 3 | Update Chat API | 1 hour |
| 4 | Scheduled Cleanup | 2 hours |
| 5 | Testing & Rollout | 3 hours |
| 6 | Analytics (Optional) | 4 hours |
| **Total** | **Core Migration** | **11 hours** |
| **Total** | **With Analytics** | **15 hours** |

---

## Risk Mitigation

1. **Data Loss During Migration**: Use feature flag to enable dual-write temporarily
2. **Performance Impact**: Add database indexes on `messageId`, `projectId`, `timestamp`
3. **Serverless Timeout**: Use Inngest for cleanup (runs in background)
4. **Cost Increase**: Monitor database size; 7-day retention keeps it minimal

---

## Success Criteria

- ✅ Audit trails persist across server restarts
- ✅ No setTimeout memory leaks
- ✅ Sub-100ms query performance for audit retrieval
- ✅ Automatic cleanup runs daily
- ✅ Zero data loss during migration
- ✅ Analytics dashboard shows cost trends

---

## Post-Migration Cleanup

After 4 weeks of stable database usage:

1. Remove in-memory code from `lib/assessment/auditStore.ts`
2. Delete `AUDIT_TRAIL_BACKEND` feature flag
3. Update documentation to reflect database-only implementation
4. Archive this migration plan for future reference

---

**Status**: 🟡 In-Memory (Development Only)
**Target**: 🟢 Database (Production Ready)
**Owner**: Development Team
**Priority**: High (Production Blocker)
