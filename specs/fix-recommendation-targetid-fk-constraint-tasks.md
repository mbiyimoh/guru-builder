# Task Breakdown: Fix Recommendation FK Constraint

**Generated:** 2025-12-06
**Source:** specs/fix-recommendation-targetid-fk-constraint.md

## Overview

Fix the FK constraint violation preventing recommendations from saving by replacing the single polymorphic `targetId` field with separate `contextLayerId` and `knowledgeFileId` FK fields.

## Dependency Graph

```
Phase 1: Schema & Data Migration
  Task 1.1 (Backup) → Task 1.2 (Schema) → Task 1.3 (Data Migration)

Phase 2: Code Updates (can start after Task 1.2)
  Task 2.1 (inngest-functions.ts) ─┬─→ Task 2.3 (Manual Testing)
  Task 2.2 (applyRecommendations.ts) ─┘

Phase 3: Cleanup (after Phase 2 verified working)
  Task 3.1 (Check Constraint) → Task 3.2 (Remove targetId) → Task 3.3 (Documentation)
```

---

## Phase 1: Schema Migration & Data Migration

### Task 1.1: Database Backup
**Description**: Create database backup before schema changes
**Size**: Small
**Priority**: Critical (MUST do first)
**Dependencies**: None
**Can run parallel with**: None

**Implementation Steps**:
```bash
npm run db:backup
```

**Acceptance Criteria**:
- [ ] Backup file created in `backups/` directory with timestamp
- [ ] Backup file size > 0 bytes
- [ ] Backup can be restored if needed

---

### Task 1.2: Update Prisma Schema with New FK Fields
**Description**: Add contextLayerId and knowledgeFileId fields to Recommendation model
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (Backup)
**Can run parallel with**: None

**File to modify**: `prisma/schema.prisma`

**Current schema (lines 130-167)**:
```prisma
model Recommendation {
  id               String               @id @default(cuid())
  researchRunId    String

  // Recommendation type and target
  action           RecommendationAction // ADD, EDIT, DELETE
  targetType       TargetType           // LAYER or KNOWLEDGE_FILE
  targetId         String? // ID of ContextLayer or KnowledgeFile (null for ADD)

  // ... other fields ...

  // Relations
  researchRun      ResearchRun          @relation(fields: [researchRunId], references: [id], onDelete: Cascade)
  contextLayer     ContextLayer?        @relation("RecommendationToLayer", fields: [targetId], references: [id], onDelete: SetNull, map: "Recommendation_layer_fkey")
  knowledgeFile    KnowledgeFile?       @relation("RecommendationToFile", fields: [targetId], references: [id], onDelete: SetNull, map: "Recommendation_file_fkey")

  @@index([researchRunId, status])
  @@index([researchRunId, priority])
  @@index([targetType, targetId])
}
```

**Updated schema**:
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

  // Recommendation content
  title            String
  description      String               @db.Text
  fullContent      String               @db.Text
  reasoning        String               @db.Text

  // Metadata
  confidence       Float
  impactLevel      ImpactLevel
  priority         Int

  // Approval workflow
  status           RecommendationStatus @default(PENDING)
  reviewedAt       DateTime?
  appliedAt        DateTime?

  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  // Relations - updated to use new FK fields
  researchRun      ResearchRun          @relation(fields: [researchRunId], references: [id], onDelete: Cascade)
  contextLayer     ContextLayer?        @relation("RecommendationToLayer", fields: [contextLayerId], references: [id], onDelete: SetNull)
  knowledgeFile    KnowledgeFile?       @relation("RecommendationToFile", fields: [knowledgeFileId], references: [id], onDelete: SetNull)
  applyChangesLogs ApplyChangesLog[]

  // Indexes
  @@index([researchRunId, status])
  @@index([researchRunId, priority])
  @@index([contextLayerId])
  @@index([knowledgeFileId])
}
```

**Implementation Steps**:
1. Edit `prisma/schema.prisma` with changes above
2. Run migration: `npm run migrate:safe -- add-separate-recommendation-fks`
3. Regenerate Prisma client: `npx prisma generate`
4. Verify migration applied: Check `prisma/migrations/` for new migration folder

**Acceptance Criteria**:
- [ ] Schema updated with contextLayerId and knowledgeFileId fields
- [ ] Old targetId field preserved (not removed yet)
- [ ] Migration runs without errors
- [ ] Prisma client regenerated
- [ ] TypeScript recognizes new fields on Recommendation type

---

### Task 1.3: Create and Run Data Migration Script
**Description**: Migrate existing recommendation targetId values to new FK fields
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2 (Schema)
**Can run parallel with**: None

**Create file**: `scripts/migrate-recommendation-fks.ts`

**Full implementation**:
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

**Implementation Steps**:
1. Create `scripts/migrate-recommendation-fks.ts` with code above
2. Run: `npx tsx scripts/migrate-recommendation-fks.ts`
3. Verify migration with SQL queries

**Verification queries**:
```sql
-- Check LAYER recommendations migrated
SELECT COUNT(*) FROM "Recommendation"
WHERE "targetType" = 'LAYER' AND "targetId" IS NOT NULL AND "contextLayerId" IS NULL;
-- Expected: 0

-- Check KNOWLEDGE_FILE recommendations migrated
SELECT COUNT(*) FROM "Recommendation"
WHERE "targetType" = 'KNOWLEDGE_FILE' AND "targetId" IS NOT NULL AND "knowledgeFileId" IS NULL;
-- Expected: 0
```

**Acceptance Criteria**:
- [ ] Migration script created
- [ ] Script runs without errors
- [ ] All LAYER recommendations have contextLayerId populated
- [ ] All KNOWLEDGE_FILE recommendations have knowledgeFileId populated
- [ ] Verification queries return 0 for both checks

---

## Phase 2: Code Updates

### Task 2.1: Update Recommendation Creation in inngest-functions.ts
**Description**: Route recommendations to correct FK field based on targetType
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2 (Schema)
**Can run parallel with**: Task 2.2

**File to modify**: `lib/inngest-functions.ts`

**Current code (lines 261-279)**:
```typescript
await prisma.recommendation.createMany({
  data: recommendationsResult.recommendations.map((rec: CorpusRecommendation, index: number) => ({
    researchRunId: researchId,
    action: rec.action,
    targetType: rec.targetType,
    // WORKAROUND: Always null due to Prisma schema issue where targetId has
    // FK constraints on BOTH ContextLayer and KnowledgeFile tables.
    // The relationship is handled by targetType + manual lookup when applying.
    targetId: null,
    title: rec.title,
    description: rec.description,
    fullContent: rec.fullContent,
    reasoning: rec.reasoning,
    confidence: rec.confidence,
    impactLevel: rec.impactLevel,
    priority: index, // Use index for ordering
    status: "PENDING" as const,
  })),
});
```

**Updated code**:
```typescript
await prisma.recommendation.createMany({
  data: recommendationsResult.recommendations.map((rec: CorpusRecommendation, index: number) => ({
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

**Key changes**:
1. Remove `targetId: null` workaround comment
2. Add `contextLayerId: rec.targetType === "LAYER" ? rec.targetId : null`
3. Add `knowledgeFileId: rec.targetType === "KNOWLEDGE_FILE" ? rec.targetId : null`

**Acceptance Criteria**:
- [ ] Code updated as shown above
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] New recommendations route to correct FK field based on targetType

---

### Task 2.2: Update Recommendation Application in applyRecommendations.ts
**Description**: Read targetId from correct FK field when applying recommendations
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2 (Schema)
**Can run parallel with**: Task 2.1

**File to modify**: `lib/applyRecommendations.ts`

**Current function signature (lines 137-151)**:
```typescript
async function applySingleRecommendationWithTx(
  tx: Prisma.TransactionClient,
  recommendation: {
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    title: string;
    fullContent: string;
    researchRun: {
      projectId: string;
    };
  },
  snapshotId: string
)
```

**Updated function signature**:
```typescript
async function applySingleRecommendationWithTx(
  tx: Prisma.TransactionClient,
  recommendation: {
    id: string;
    action: string;
    targetType: string;
    contextLayerId: string | null;
    knowledgeFileId: string | null;
    title: string;
    fullContent: string;
    researchRun: {
      projectId: string;
    };
  },
  snapshotId: string
)
```

**Current destructuring (line 152)**:
```typescript
const { action, targetType, targetId, title, fullContent, researchRun } = recommendation;
```

**Updated destructuring and targetId derivation**:
```typescript
const { action, targetType, contextLayerId, knowledgeFileId, title, fullContent, researchRun } = recommendation;
const projectId = researchRun.projectId;

// Derive targetId from the appropriate FK field
const targetId = targetType === "LAYER" ? contextLayerId : knowledgeFileId;
```

**Key changes**:
1. Update function parameter type to use `contextLayerId` and `knowledgeFileId` instead of `targetId`
2. Derive `targetId` locally from the correct FK field based on `targetType`
3. Rest of function logic remains unchanged (uses derived `targetId`)

**Acceptance Criteria**:
- [ ] Function signature updated
- [ ] Destructuring updated with targetId derivation
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] EDIT operations work with valid contextLayerId/knowledgeFileId

---

### Task 2.3: Manual Testing of All Recommendation Workflows
**Description**: Verify all recommendation actions work correctly with new FK fields
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: None

**Test scenarios**:

1. **ADD recommendation for CONTEXT_LAYER**
   - Run research on a project
   - Generate ADD LAYER recommendation
   - Approve recommendation
   - Apply recommendation
   - Verify: New layer created, no FK errors

2. **ADD recommendation for KNOWLEDGE_FILE**
   - Run research on a project
   - Generate ADD FILE recommendation
   - Approve recommendation
   - Apply recommendation
   - Verify: New file created, no FK errors

3. **EDIT recommendation for existing layer** (CRITICAL - was broken)
   - Create a context layer
   - Run research targeting that layer
   - Generate EDIT recommendation for that layer
   - Approve and apply
   - Verify: Layer content updated (not just created new)

4. **DELETE recommendation for layer** (CRITICAL - was broken)
   - Create a context layer
   - Generate DELETE recommendation for it
   - Approve and apply
   - Verify: Layer deleted

5. **Cascade delete behavior**
   - Create recommendation referencing a layer
   - Delete the layer directly via UI
   - Verify: Recommendation's contextLayerId is now null (not deleted)

6. **Check Inngest logs**
   - Open http://localhost:8288
   - Verify no FK constraint errors in recommendation-generation job

**Database verification queries**:
```sql
-- No recommendations have both FKs populated
SELECT COUNT(*) FROM "Recommendation"
WHERE "contextLayerId" IS NOT NULL AND "knowledgeFileId" IS NOT NULL;
-- Expected: 0

-- EDIT/DELETE have correct FK populated
SELECT id, action, "targetType", "contextLayerId", "knowledgeFileId"
FROM "Recommendation"
WHERE action IN ('EDIT', 'DELETE')
ORDER BY "createdAt" DESC
LIMIT 10;
-- Verify: LAYER rows have contextLayerId, KNOWLEDGE_FILE rows have knowledgeFileId
```

**Acceptance Criteria**:
- [ ] ADD LAYER recommendation saves and applies correctly
- [ ] ADD FILE recommendation saves and applies correctly
- [ ] EDIT LAYER recommendation updates existing layer (not null targetId)
- [ ] DELETE LAYER recommendation removes layer
- [ ] Cascade delete sets FK to null, doesn't delete recommendation
- [ ] No FK constraint errors in Inngest logs

---

## Phase 3: Constraint & Cleanup

### Task 3.1: Add PostgreSQL Check Constraint
**Description**: Add database-level constraint to enforce FK rules
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.3 (verified working)
**Can run parallel with**: None

**Create migration manually or via Prisma**:

Option A: Raw SQL migration file `prisma/migrations/[timestamp]_add_recommendation_check_constraint/migration.sql`:
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

Option B: Run via `npx prisma db execute`:
```bash
npx prisma db execute --stdin <<EOF
ALTER TABLE "Recommendation" ADD CONSTRAINT "recommendation_target_check"
CHECK (
  (action = 'ADD' AND "contextLayerId" IS NULL AND "knowledgeFileId" IS NULL) OR
  (action IN ('EDIT', 'DELETE') AND (
    ("contextLayerId" IS NOT NULL AND "knowledgeFileId" IS NULL) OR
    ("contextLayerId" IS NULL AND "knowledgeFileId" IS NOT NULL)
  ))
);
EOF
```

**Acceptance Criteria**:
- [ ] Check constraint added to database
- [ ] Existing data passes constraint (or fix data first)
- [ ] Invalid inserts are rejected by database

---

### Task 3.2: Remove Deprecated targetId Field
**Description**: Clean up old targetId field from schema
**Size**: Small
**Priority**: Low
**Dependencies**: Task 3.1
**Can run parallel with**: None

**Schema changes**:
1. Remove `targetId String?` line from Recommendation model
2. Remove `@@index([targetType, targetId])` index
3. Run migration: `npm run migrate:safe -- remove-deprecated-targetid`

**Acceptance Criteria**:
- [ ] targetId field removed from schema
- [ ] Old index removed
- [ ] Migration runs without errors
- [ ] TypeScript compiles (no code references targetId directly)

---

### Task 3.3: Update Documentation
**Description**: Document the polymorphic FK pattern for future reference
**Size**: Small
**Priority**: Low
**Dependencies**: Task 3.2
**Can run parallel with**: None

**Files to update**:

1. **CLAUDE.md** - Add section:
```markdown
### Polymorphic Associations in Prisma

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

2. **developer-guides/04-recommendation-system-guide.md** - Update schema section to reflect new fields

**Acceptance Criteria**:
- [ ] CLAUDE.md updated with polymorphic FK pattern
- [ ] Developer guide reflects current schema

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1 | 1.1 Backup, 1.2 Schema, 1.3 Data Migration | Critical |
| Phase 2 | 2.1 inngest-functions, 2.2 applyRecommendations, 2.3 Testing | High |
| Phase 3 | 3.1 Check Constraint, 3.2 Remove targetId, 3.3 Docs | Medium/Low |

**Critical Path**: 1.1 → 1.2 → 1.3 → 2.1/2.2 → 2.3

**Parallel Opportunities**: Tasks 2.1 and 2.2 can be done in parallel after Task 1.2
