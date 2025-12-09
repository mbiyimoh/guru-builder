# Fix Recommendation FK Constraint Violation

## Status
**Draft** | Author: Claude | Date: 2025-12-06

## Overview

Fix the foreign key constraint violation that prevents recommendations from being saved to the database. The current schema uses a single `targetId` field with dual FK constraints pointing to both `ContextLayer` and `KnowledgeFile` tables, causing PostgreSQL to reject valid UUIDs.

**Solution:** Replace the polymorphic `targetId` field with two separate nullable FK fields (`contextLayerId`, `knowledgeFileId`), which is the idiomatic Prisma pattern for polymorphic associations.

## Background/Problem Statement

### The Error
```
Foreign key constraint violated: Recommendation_layer_fkey
```

### Root Cause Analysis

In `prisma/schema.prisma`, the `Recommendation` model uses a single `targetId` field with two FK relations:

```prisma
model Recommendation {
  targetId         String?  // ID of ContextLayer OR KnowledgeFile

  // PROBLEM: Both relations use the SAME targetId field
  contextLayer     ContextLayer?  @relation(..., fields: [targetId], ...)
  knowledgeFile    KnowledgeFile? @relation(..., fields: [targetId], ...)
}
```

**Why this fails:**
1. When `targetId` contains a `ContextLayer` UUID, PostgreSQL validates against BOTH FK constraints
2. The UUID doesn't exist in `KnowledgeFile` table → `Recommendation_file_fkey` violated
3. Vice versa for `KnowledgeFile` UUIDs → `Recommendation_layer_fkey` violated
4. Only `targetId: null` satisfies both constraints (current workaround)

### Current Workaround Impact

A temporary workaround forces `targetId: null` for all recommendations:

```typescript
// lib/inngest-functions.ts line 269
targetId: null,  // WORKAROUND: Always null due to Prisma schema issue
```

**This breaks EDIT and DELETE operations** which check `&& targetId`:

```typescript
// lib/applyRecommendations.ts
} else if (action === "EDIT" && targetId) {  // Never executes!
  const updated = await tx.contextLayer.update({ where: { id: targetId } });
}
```

## Goals

- Recommendations with valid target references save successfully to the database
- EDIT recommendations correctly reference existing ContextLayers or KnowledgeFiles
- DELETE recommendations correctly reference existing ContextLayers or KnowledgeFiles
- ADD recommendations work without target references (as designed)
- Existing production recommendations are preserved during migration
- Referential integrity maintained via proper FK constraints
- Cascade delete behavior preserved (target deletion sets FK to null)

## Non-Goals

- Changing the recommendation generation logic in `corpusRecommendationGenerator.ts`
- Modifying the recommendation approval/rejection workflow
- Changing how recommendations are displayed in the UI
- Adding new recommendation types or actions

## Technical Dependencies

- **Prisma ORM** (v5.x) - Schema migration and client generation
- **PostgreSQL** - Database with FK constraints and check constraints
- **npm scripts**: `db:backup`, `migrate:safe`

## Detailed Design

### Schema Changes

**File:** `prisma/schema.prisma`

```prisma
model Recommendation {
  id               String               @id @default(cuid())
  researchRunId    String

  // Recommendation type and target
  action           RecommendationAction // ADD, EDIT, DELETE
  targetType       TargetType           // LAYER or KNOWLEDGE_FILE

  // NEW: Separate FK fields (only one populated at a time)
  contextLayerId   String?
  knowledgeFileId  String?

  // DEPRECATED: Keep during transition, remove in Phase 3
  targetId         String?

  // ... existing fields unchanged ...

  // Relations - updated to use new FK fields
  researchRun      ResearchRun          @relation(fields: [researchRunId], references: [id], onDelete: Cascade)
  contextLayer     ContextLayer?        @relation("RecommendationToLayer", fields: [contextLayerId], references: [id], onDelete: SetNull)
  knowledgeFile    KnowledgeFile?       @relation("RecommendationToFile", fields: [knowledgeFileId], references: [id], onDelete: SetNull)

  // Indexes
  @@index([researchRunId, status])
  @@index([researchRunId, priority])
  @@index([contextLayerId])
  @@index([knowledgeFileId])
}
```

### Code Changes

#### 1. Recommendation Creation (`lib/inngest-functions.ts`)

**Before:**
```typescript
await prisma.recommendation.createMany({
  data: recommendationsResult.recommendations.map((rec, index) => ({
    // ...
    targetId: null,  // WORKAROUND
  })),
});
```

**After:**
```typescript
await prisma.recommendation.createMany({
  data: recommendationsResult.recommendations.map((rec, index) => ({
    researchRunId: researchId,
    action: rec.action,
    targetType: rec.targetType,
    // Route to correct FK based on targetType (uses Prisma enum string values)
    contextLayerId: rec.targetType === "LAYER" ? rec.targetId : null,
    knowledgeFileId: rec.targetType === "KNOWLEDGE_FILE" ? rec.targetId : null,
    title: rec.title,
    description: rec.description,
    fullContent: rec.fullContent,
    reasoning: rec.reasoning,
    confidence: rec.confidence,
    impactLevel: rec.impactLevel,
    priority: index,
    status: "PENDING" as const,
  })),
});
```

#### 2. Recommendation Application (`lib/applyRecommendations.ts`)

**Update function signature:**
```typescript
async function applySingleRecommendationWithTx(
  tx: Prisma.TransactionClient,
  recommendation: {
    id: string;
    action: string;
    targetType: string;
    contextLayerId: string | null;  // NEW
    knowledgeFileId: string | null;  // NEW
    title: string;
    fullContent: string;
    researchRun: {
      projectId: string;
    };
  },
  snapshotId: string
)
```

**Update logic to derive targetId:**
```typescript
const { action, targetType, contextLayerId, knowledgeFileId, title, fullContent, researchRun } = recommendation;
const projectId = researchRun.projectId;

// Derive targetId from the appropriate FK field
const targetId = targetType === "LAYER" ? contextLayerId : knowledgeFileId;

// Rest of logic unchanged - uses targetId as before
if (targetType === "LAYER") {
  if (action === "EDIT" && targetId) {
    // ... existing logic
  }
}
```

#### 3. Type Definitions (`lib/corpusRecommendationGenerator.ts`)

The `CorpusRecommendation` interface already uses `targetId` as the field name. The GPT-4o structured output continues to generate `targetId` - the routing to separate FK fields happens in `inngest-functions.ts`.

**No changes needed to this file.**

### Data Migration

**Migration approach:** Use Prisma migration for schema changes, then run a separate data migration script.

**Step 1: Prisma Migration** (handles schema changes)
Prisma generates migration SQL for adding columns, FK constraints, and indexes. Run via `npm run migrate:safe`.

**Step 2: Data Migration Script** (run separately after schema migration)
Create `scripts/migrate-recommendation-fks.ts`:

```typescript
// scripts/migrate-recommendation-fks.ts
import { prisma } from '../lib/db';

async function migrateRecommendationFKs() {
  console.log('Starting recommendation FK migration...');

  // Migrate LAYER recommendations
  const layerResult = await prisma.$executeRaw`
    UPDATE "Recommendation"
    SET "contextLayerId" = "targetId"
    WHERE "targetType" = 'LAYER' AND "targetId" IS NOT NULL
  `;
  console.log(`Migrated ${layerResult} LAYER recommendations`);

  // Migrate KNOWLEDGE_FILE recommendations
  const fileResult = await prisma.$executeRaw`
    UPDATE "Recommendation"
    SET "knowledgeFileId" = "targetId"
    WHERE "targetType" = 'KNOWLEDGE_FILE' AND "targetId" IS NOT NULL
  `;
  console.log(`Migrated ${fileResult} KNOWLEDGE_FILE recommendations`);

  console.log('Migration complete!');
}

migrateRecommendationFKs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run with: `npx tsx scripts/migrate-recommendation-fks.ts`

**Expected Prisma-generated migration SQL:**
```sql
-- Add new nullable columns
ALTER TABLE "Recommendation" ADD COLUMN "contextLayerId" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "knowledgeFileId" TEXT;

-- Add FK constraints
ALTER TABLE "Recommendation"
ADD CONSTRAINT "Recommendation_contextLayerId_fkey"
FOREIGN KEY ("contextLayerId") REFERENCES "ContextLayer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Recommendation"
ADD CONSTRAINT "Recommendation_knowledgeFileId_fkey"
FOREIGN KEY ("knowledgeFileId") REFERENCES "KnowledgeFile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Recommendation_contextLayerId_idx" ON "Recommendation"("contextLayerId");
CREATE INDEX "Recommendation_knowledgeFileId_idx" ON "Recommendation"("knowledgeFileId");
```

### Check Constraint (Phase 3)

After confirming the new fields work correctly:

```sql
-- Ensure EDIT/DELETE have exactly one FK populated, ADD has none
ALTER TABLE "Recommendation" ADD CONSTRAINT "recommendation_target_check"
CHECK (
  (action = 'ADD' AND "contextLayerId" IS NULL AND "knowledgeFileId" IS NULL) OR
  (action IN ('EDIT', 'DELETE') AND (
    ("contextLayerId" IS NOT NULL AND "knowledgeFileId" IS NULL) OR
    ("contextLayerId" IS NULL AND "knowledgeFileId" IS NOT NULL)
  ))
);
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RECOMMENDATION CREATION                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GPT-4o generates:                                                  │
│  ┌───────────────────────────────────────────────────┐             │
│  │ { action: "EDIT",                                 │             │
│  │   targetType: "LAYER",                            │             │
│  │   targetId: "clx123...",  ← Layer UUID            │             │
│  │   ... }                                           │             │
│  └───────────────────────────────────────────────────┘             │
│                          │                                          │
│                          ▼                                          │
│  inngest-functions.ts routes based on targetType:                   │
│  ┌───────────────────────────────────────────────────┐             │
│  │ if (targetType === 'LAYER') {                     │             │
│  │   contextLayerId = rec.targetId;  // clx123...    │             │
│  │   knowledgeFileId = null;                         │             │
│  │ }                                                 │             │
│  └───────────────────────────────────────────────────┘             │
│                          │                                          │
│                          ▼                                          │
│  Database stores with correct FK:                                   │
│  ┌───────────────────────────────────────────────────┐             │
│  │ Recommendation                                    │             │
│  │ ├─ contextLayerId: "clx123..."  ← FK validated    │             │
│  │ ├─ knowledgeFileId: null                          │             │
│  │ └─ (targetId: deprecated, kept for transition)    │             │
│  └───────────────────────────────────────────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDATION APPLICATION                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  applyRecommendations.ts reads from correct FK:                     │
│  ┌───────────────────────────────────────────────────┐             │
│  │ const targetId = targetType === "LAYER"           │             │
│  │   ? contextLayerId      // "clx123..."            │             │
│  │   : knowledgeFileId;                              │             │
│  └───────────────────────────────────────────────────┘             │
│                          │                                          │
│                          ▼                                          │
│  Apply EDIT/DELETE with valid targetId:                             │
│  ┌───────────────────────────────────────────────────┐             │
│  │ await tx.contextLayer.update({                    │             │
│  │   where: { id: targetId },  // Works!             │             │
│  │   data: { content: fullContent }                  │             │
│  │ });                                               │             │
│  └───────────────────────────────────────────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## User Experience

No user-facing changes. This is a backend data model fix. Users will experience:
- Research runs generating recommendations that can be properly applied
- EDIT recommendations actually modifying existing content (currently broken)
- DELETE recommendations actually removing content (currently broken)

## Testing Strategy

### Manual Testing Checklist

1. **ADD recommendation for CONTEXT_LAYER**
   - Purpose: Verify ADD operations don't require target reference
   - Run research → Generate ADD LAYER recommendation → Approve → Apply → Verify new layer created

2. **ADD recommendation for KNOWLEDGE_FILE**
   - Purpose: Verify ADD operations work for files
   - Run research → Generate ADD FILE recommendation → Approve → Apply → Verify new file created

3. **EDIT recommendation for existing layer**
   - Purpose: Verify EDIT operations use contextLayerId correctly
   - Create layer → Run research targeting it → Generate EDIT recommendation → Approve → Apply → Verify layer updated

4. **EDIT recommendation for existing file**
   - Purpose: Verify EDIT operations use knowledgeFileId correctly
   - Create file → Run research targeting it → Generate EDIT recommendation → Approve → Apply → Verify file updated

5. **DELETE recommendation for layer**
   - Purpose: Verify DELETE operations use contextLayerId correctly
   - Create layer → Run research → Generate DELETE recommendation → Approve → Apply → Verify layer removed

6. **DELETE recommendation for file**
   - Purpose: Verify DELETE operations use knowledgeFileId correctly
   - Create file → Run research → Generate DELETE recommendation → Approve → Apply → Verify file removed

7. **Cascade delete behavior**
   - Purpose: Verify FK constraint onDelete: SetNull works
   - Create recommendation referencing a layer → Delete the layer directly → Verify contextLayerId set to null (not cascaded delete of recommendation)

8. **Mixed recommendations in single run**
   - Purpose: Verify all action types work together
   - Run research generating ADD, EDIT, DELETE for both LAYER and FILE → Apply all → Verify all changes applied correctly

### Database Verification Queries

```sql
-- Verify no recommendations have both FKs populated
SELECT COUNT(*) FROM "Recommendation"
WHERE "contextLayerId" IS NOT NULL AND "knowledgeFileId" IS NOT NULL;
-- Expected: 0

-- Verify EDIT/DELETE have exactly one FK
SELECT COUNT(*) FROM "Recommendation"
WHERE action IN ('EDIT', 'DELETE')
AND "contextLayerId" IS NULL AND "knowledgeFileId" IS NULL;
-- Expected: 0 (after migration)

-- Verify FK integrity
SELECT r.id, r.action, r.targetType, r."contextLayerId", c.id as layer_exists
FROM "Recommendation" r
LEFT JOIN "ContextLayer" c ON r."contextLayerId" = c.id
WHERE r."contextLayerId" IS NOT NULL AND c.id IS NULL;
-- Expected: 0 rows (no orphaned references)
```

## Performance Considerations

- **Index addition:** Two new indexes on `contextLayerId` and `knowledgeFileId` - minimal performance impact
- **Query changes:** No additional joins required - deriving targetId in code is O(1)
- **Migration:** One-time UPDATE on existing recommendations - negligible for current data volume

## Security Considerations

- No security implications - this is a data model refactoring
- FK constraints maintain referential integrity (improvement over current broken state)
- Check constraint adds additional data validation at DB level

## Documentation

### Files to Update

1. **CLAUDE.md** - Add note about polymorphic FK pattern for future reference
2. **developer-guides/04-recommendation-system-guide.md** - Update schema documentation

### Migration Notes for Future Developers

Document the pattern for polymorphic associations in Prisma:

```markdown
## Polymorphic Associations in Prisma

When a model needs to reference one of multiple target types, use separate nullable FK fields
instead of a single polymorphic field:

**WRONG:**
```prisma
targetId String?  // Points to TableA OR TableB
tableA   TableA? @relation(fields: [targetId], ...)
tableB   TableB? @relation(fields: [targetId], ...)
```

**CORRECT:**
```prisma
tableAId String?
tableBId String?
tableA   TableA? @relation(fields: [tableAId], ...)
tableB   TableB? @relation(fields: [tableBId], ...)
```
```

## Implementation Phases

### Phase 1: Schema Migration & Data Migration
1. Run `npm run db:backup`
2. Update `prisma/schema.prisma` with new fields (keep old `targetId`)
3. Run `npm run migrate:safe -- add-separate-recommendation-fks`
4. Verify migration applied correctly
5. Run data migration to populate new fields from existing `targetId` values

### Phase 2: Code Updates
1. Update `lib/inngest-functions.ts` to route to correct FK field
2. Update `lib/applyRecommendations.ts` to read from correct FK field
3. Run TypeScript compiler to catch any type errors
4. Test all recommendation workflows manually
5. Deploy to production

### Phase 3: Constraint & Cleanup
1. Add PostgreSQL check constraint via migration
2. Remove old `targetId` field from schema
3. Remove old `targetId` index
4. Run final migration
5. Verify all tests pass

## Rollback Strategy

### Phase 1 Rollback
If migration fails:
```bash
# Restore from backup
psql $DATABASE_URL < backups/backup_TIMESTAMP.sql
# Revert schema changes in git
git checkout prisma/schema.prisma
npx prisma generate
```

### Phase 2 Rollback
If code changes cause issues:
- Both old (`targetId`) and new (`contextLayerId`/`knowledgeFileId`) fields exist
- Revert code changes, old field still available
- No data loss

### Phase 3 Rollback
Strongly recommend not rolling back after Phase 3:
- Would require re-adding `targetId` column
- Data migration in reverse direction

## Open Questions

None - all clarifications resolved:
1. Existing data will be migrated
2. Transition period with old `targetId` maintained
3. Check constraint will be added

## References

- **Ideation Document:** `docs/ideation/fix-recommendation-targetid-fk-constraint.md`
- **Prisma Relations Documentation:** https://www.prisma.io/docs/concepts/components/prisma-schema/relations
- **PostgreSQL Check Constraints:** https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `prisma/schema.prisma` | Schema | Add contextLayerId, knowledgeFileId fields |
| `lib/inngest-functions.ts` | Logic | Route to correct FK on recommendation creation |
| `lib/applyRecommendations.ts` | Logic | Read from correct FK on recommendation application |
| `scripts/migrate-recommendation-fks.ts` | New | Data migration script for existing recommendations |
| `developer-guides/04-recommendation-system-guide.md` | Docs | Update schema documentation |
| `CLAUDE.md` | Docs | Add polymorphic FK pattern note |

## Acceptance Criteria Checklist

- [ ] ADD recommendation for CONTEXT_LAYER saves successfully
- [ ] ADD recommendation for KNOWLEDGE_FILE saves successfully
- [ ] EDIT recommendation for existing layer works
- [ ] EDIT recommendation for existing file works
- [ ] DELETE recommendation for layer works
- [ ] DELETE recommendation for file works
- [ ] Deleting a ContextLayer sets contextLayerId to null (cascade)
- [ ] Deleting a KnowledgeFile sets knowledgeFileId to null (cascade)
- [ ] Research run with mixed recommendations completes successfully
- [ ] Existing production recommendations are preserved and migrated
- [ ] No FK constraint violations in Inngest logs
- [ ] TypeScript compiles without errors
