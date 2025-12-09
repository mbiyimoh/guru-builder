# Ideation: Fix Recommendation targetId FK Constraint

**Slug:** `fix-recommendation-targetid-fk-constraint`
**Created:** 2025-12-06
**Status:** Ideation Complete

---

## Intent & Scope

### Problem Statement
Recommendations fail to save with `Foreign key constraint violated: Recommendation_layer_fkey` error. This occurs because the Prisma schema uses a single `targetId` field with dual foreign key constraints pointing to both `ContextLayer` and `KnowledgeFile` tables.

### User Request
> "use @.claude/commands/spec/ideate.md to plan out the proper fix. these recommendations are critical to the guru system and they need to work fully properly"

### Current Workaround Impact
A workaround that forces `targetId: null` for all recommendations breaks EDIT and DELETE operations, which check `&& targetId` before executing updates.

---

## Root Cause Analysis

### Schema Design Flaw

In `prisma/schema.prisma` (lines 152-175):

```prisma
model Recommendation {
  id               String   @id @default(uuid())
  researchRunId    String
  action           String   // ADD, EDIT, DELETE
  targetType       String   // CONTEXT_LAYER or KNOWLEDGE_FILE
  targetId         String?  // ID of ContextLayer or KnowledgeFile (null for ADD)

  // PROBLEM: Both relations use the SAME targetId field
  contextLayer     ContextLayer?  @relation("RecommendationToLayer", fields: [targetId], references: [id], onDelete: SetNull, map: "Recommendation_layer_fkey")
  knowledgeFile    KnowledgeFile? @relation("RecommendationToFile", fields: [targetId], references: [id], onDelete: SetNull, map: "Recommendation_file_fkey")

  // ... other fields
}
```

### Why This Fails

1. When `targetId` contains a `ContextLayer` UUID, PostgreSQL checks both FK constraints
2. The UUID doesn't exist in `KnowledgeFile` table → `Recommendation_file_fkey` violated
3. Vice versa for `KnowledgeFile` UUIDs → `Recommendation_layer_fkey` violated
4. Only `targetId: null` satisfies both constraints (but breaks EDIT/DELETE logic)

### Current Code Impact

In `lib/applyRecommendations.ts`:
```typescript
// EDIT operations require targetId to find the entity
} else if (action === "EDIT" && targetId) {
  const updated = await tx.contextLayer.update({
    where: { id: targetId },  // Can't work if targetId is always null
    // ...
  });
}

// DELETE operations also require targetId
} else if (action === "DELETE" && targetId) {
  await tx.contextLayer.delete({
    where: { id: targetId },  // Can't work if targetId is always null
  });
}
```

---

## Solution Options

### Option A: Separate FK Fields (Recommended)

**Approach:** Replace single `targetId` with two separate nullable FK fields.

```prisma
model Recommendation {
  id               String   @id @default(uuid())
  researchRunId    String
  action           String
  targetType       String

  // Separate FK fields - only one populated at a time
  contextLayerId   String?
  knowledgeFileId  String?

  contextLayer     ContextLayer?  @relation("RecommendationToLayer", fields: [contextLayerId], references: [id], onDelete: SetNull)
  knowledgeFile    KnowledgeFile? @relation("RecommendationToFile", fields: [knowledgeFileId], references: [id], onDelete: SetNull)

  // ... other fields
}
```

**Pros:**
- Clean, idiomatic Prisma pattern
- Each FK validates independently against correct table
- Type-safe - compiler helps catch errors
- Works with Prisma's relation system

**Cons:**
- Requires data migration
- Slightly more complex query logic (check two fields)

**Migration Strategy:**
1. Add new nullable fields
2. Migrate existing data based on `targetType`
3. Remove old `targetId` field
4. Add PostgreSQL check constraint for data integrity

### Option B: Remove FK Relations, Keep Logical Reference

**Approach:** Remove FK constraints entirely, use `targetId` as a logical reference only.

```prisma
model Recommendation {
  targetId         String?  // Logical reference only, no FK
  // Remove: contextLayer and knowledgeFile relations
}
```

**Pros:**
- Simple schema change
- No migration of existing data needed
- Maximum flexibility

**Cons:**
- No referential integrity
- Orphaned recommendations possible
- No cascade delete behavior
- Loses Prisma relation features (include, etc.)

### Option C: Discriminated Union with Table-Per-Type

**Approach:** Create separate recommendation tables for each target type.

```prisma
model ContextLayerRecommendation {
  contextLayerId String
  contextLayer   ContextLayer @relation(...)
}

model KnowledgeFileRecommendation {
  knowledgeFileId String
  knowledgeFile   KnowledgeFile @relation(...)
}
```

**Pros:**
- Perfect type safety
- Clean FK relationships
- No null fields

**Cons:**
- Major refactor across entire codebase
- Complex queries across recommendation types
- Over-engineered for this use case

---

## Recommended Solution: Option A

### Implementation Plan

#### Phase 1: Schema Migration

1. **Update Prisma Schema**
```prisma
model Recommendation {
  id               String   @id @default(uuid())
  researchRunId    String
  action           String   // ADD, EDIT, DELETE
  targetType       String   // CONTEXT_LAYER or KNOWLEDGE_FILE

  // NEW: Separate FK fields
  contextLayerId   String?
  knowledgeFileId  String?

  contextLayer     ContextLayer?  @relation("RecommendationToLayer", fields: [contextLayerId], references: [id], onDelete: SetNull)
  knowledgeFile    KnowledgeFile? @relation("RecommendationToFile", fields: [knowledgeFileId], references: [id], onDelete: SetNull)

  // Existing fields (unchanged)
  title            String
  description      String
  reasoning        String
  suggestedContent String?  @db.Text
  confidence       Float
  priority         Int      @default(0)
  status           String   @default("pending")
  applied          Boolean  @default(false)
  appliedAt        DateTime?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  researchRun      ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Cascade)
}
```

2. **Create Safe Migration**
```bash
npm run db:backup
npm run migrate:safe -- add-separate-recommendation-fks
```

3. **Add Data Integrity Check Constraint** (optional but recommended)
```sql
-- Ensure at most one FK is populated
ALTER TABLE "Recommendation" ADD CONSTRAINT "recommendation_single_target_check"
CHECK (
  (action = 'ADD') OR
  (("contextLayerId" IS NOT NULL AND "knowledgeFileId" IS NULL) OR
   ("contextLayerId" IS NULL AND "knowledgeFileId" IS NOT NULL))
);
```

#### Phase 2: Code Updates

**File: `lib/inngest-functions.ts`**

Update recommendation creation to use correct FK field:
```typescript
await prisma.recommendation.createMany({
  data: recommendationsResult.recommendations.map((rec, index) => ({
    researchRunId: researchId,
    action: rec.action,
    targetType: rec.targetType,
    // Route to correct FK based on targetType
    contextLayerId: rec.targetType === 'CONTEXT_LAYER' ? rec.targetId : null,
    knowledgeFileId: rec.targetType === 'KNOWLEDGE_FILE' ? rec.targetId : null,
    title: rec.title,
    description: rec.description,
    reasoning: rec.reasoning,
    suggestedContent: rec.suggestedContent || null,
    confidence: rec.confidence,
    priority: index + 1,
    status: 'pending',
  })),
});
```

**File: `lib/applyRecommendations.ts`**

Update to use new FK fields:
```typescript
// Get targetId from the appropriate FK field
const targetId = rec.targetType === 'CONTEXT_LAYER'
  ? rec.contextLayerId
  : rec.knowledgeFileId;

if (action === "EDIT" && targetId) {
  // ... existing logic works unchanged
}

if (action === "DELETE" && targetId) {
  // ... existing logic works unchanged
}
```

**File: `lib/types.ts`** (if applicable)

Update Recommendation type to include new fields.

#### Phase 3: Remove Old Field

After confirming everything works:
1. Create migration to drop `targetId` column
2. Update any remaining references

---

## Testing Checklist

- [ ] ADD recommendation for CONTEXT_LAYER saves successfully
- [ ] ADD recommendation for KNOWLEDGE_FILE saves successfully
- [ ] EDIT recommendation for existing layer works
- [ ] EDIT recommendation for existing file works
- [ ] DELETE recommendation for layer works
- [ ] DELETE recommendation for file works
- [ ] Deleting a ContextLayer sets `contextLayerId` to null (cascade)
- [ ] Deleting a KnowledgeFile sets `knowledgeFileId` to null (cascade)
- [ ] Research run with mixed recommendations completes successfully

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | High | Backup before migration |
| Existing recommendations orphaned | Low | Medium | Migrate based on targetType |
| Code references old field | Medium | Low | TypeScript will catch at compile |
| Production downtime | Low | Medium | Test thoroughly in dev first |

---

## Clarification Questions

1. **Existing Data:** Are there existing recommendations in production that need migration, or can we treat this as a fresh start?

2. **Backward Compatibility:** Do we need to support the old `targetId` field during a transition period, or can we do a clean cutover?

3. **Check Constraint:** Should we add the PostgreSQL check constraint, or rely on application-level validation?

---

## Files to Modify

1. `prisma/schema.prisma` - Schema changes
2. `lib/inngest-functions.ts` - Recommendation creation
3. `lib/applyRecommendations.ts` - Recommendation application
4. `lib/types.ts` - Type definitions (if separate)
5. Any API routes that query recommendations with `targetId`

---

## Next Steps

1. **If approved:** Create spec using `/spec:create-lean` with this ideation as input
2. **Backup database** before any migration
3. **Implement in dev** and test all recommendation workflows
4. **Deploy to production** with monitoring

---

## Summary

The FK constraint error is a schema design flaw where a single field has dual FK relations. The recommended fix is to use separate nullable FK fields (`contextLayerId`, `knowledgeFileId`), which follows standard Prisma patterns for polymorphic associations. This is a medium-complexity change requiring schema migration and code updates across 3-4 files.
