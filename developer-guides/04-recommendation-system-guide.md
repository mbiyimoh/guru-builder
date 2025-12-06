# Recommendation System Developer Guide

**Component:** AI-powered corpus recommendation generation and application
**Files:** `lib/corpusRecommendationGenerator.ts`, `lib/applyRecommendations.ts`

## Overview

The recommendation system uses OpenAI GPT-4 to analyze research findings and generate structured recommendations for improving the knowledge corpus through ADD/EDIT/DELETE operations.

## Architecture

```
Research Findings + Current Corpus
          ↓
OpenAI GPT-4 (Structured Outputs)
          ↓
Zod Schema Validation
          ↓
Recommendation[] (JSON)
          ↓
Database Persistence
          ↓
User Approval/Rejection
          ↓
Atomic Application with Snapshots
```

## Recommendation Generation

### File: `lib/corpusRecommendationGenerator.ts`

**Core Function:**
```typescript
async function generateCorpusRecommendations(
  options: GenerateCorpusRecommendationsOptions
): Promise<CorpusRecommendation[]>
```

**Input:**
```typescript
interface GenerateCorpusRecommendationsOptions {
  researchFindings: Record<string, unknown>;  // Research JSON
  currentLayers: CorpusItem[];                // Existing layers
  currentKnowledgeFiles: CorpusItem[];        // Existing files
  instructions: string;                       // Original query
}
```

**Output:**
```typescript
type CorpusRecommendation = {
  action: "ADD" | "EDIT" | "DELETE";
  targetType: "LAYER" | "KNOWLEDGE_FILE";
  targetId: string | null;                    // Null for ADD
  title: string;
  content: string;
  reasoning: string;
  confidence: number;                         // 0.0 to 1.0
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
};
```

### Zod Schema

```typescript
const corpusRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      action: z.enum(["ADD", "EDIT", "DELETE"]),
      targetType: z.enum(["LAYER", "KNOWLEDGE_FILE"]),
      targetId: z.string().nullable(),
      title: z.string(),
      content: z.string(),
      reasoning: z.string(),
      confidence: z.number().min(0).max(1),
      impactLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
  ),
  noRecommendationsReason: z.string().nullable().optional(),
});
```

### Data Flow: AI Interface vs Database Schema

**IMPORTANT:** The GPT-4o interface uses a simple `targetId` field, but the database uses **separate FK fields** to avoid constraint violations.

| Layer | Field(s) | Purpose |
|-------|----------|---------|
| **GPT-4o Output** | `targetId` | Simple interface for AI |
| **Database (Prisma)** | `contextLayerId`, `knowledgeFileId` | Separate FKs avoid polymorphic constraint issues |

**Translation happens in `lib/inngest-functions.ts`:**
```typescript
// GPT returns: rec.targetId
// Database stores:
contextLayerId: rec.targetType === "LAYER" ? rec.targetId : null,
knowledgeFileId: rec.targetType === "KNOWLEDGE_FILE" ? rec.targetId : null,
```

See CLAUDE.md "Prisma Polymorphic Associations" section for technical details on why this pattern is necessary.

**CRITICAL: OpenAI Structured Outputs Schema Requirements**

When using OpenAI's `strict: true` mode with structured outputs, optional fields **MUST** use `.nullable().optional()` - not just `.optional()` alone:

```typescript
// ✅ CORRECT - Required by OpenAI API
noRecommendationsReason: z.string().nullable().optional()

// ❌ WRONG - Will cause API error
noRecommendationsReason: z.string().optional()
```

This is required because OpenAI's strict mode can either:
- Include the field with a value
- Include the field with `null`
- Omit the field entirely

The `.nullable().optional()` pattern handles all three cases.

### Prompt Engineering

**System Prompt:**
```
You are an expert knowledge engineer who improves AI knowledge bases
with research-backed recommendations.
```

**User Prompt Structure:**
1. Research instructions (what user asked for)
2. Research findings (JSON dump)
3. Current corpus state (layers + files with IDs)
4. Guidelines for recommendations

**Key Guidelines:**
- Focus on high-quality, actionable recommendations
- Provide clear reasoning for each suggestion
- Rate confidence honestly
- Assess real impact level

### OpenAI Configuration

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-2024-08-06",              // Supports structured outputs
  messages: [system, user],
  response_format: {
    type: "json_schema" as const,
    json_schema: {
      name: "corpus_recommendations",
      schema: zodResponseFormat(corpusRecommendationSchema, "...").json_schema.schema,
      strict: true,                        // Enforces exact schema match
    },
  },
  temperature: 0.7,                        // Balanced creativity
});
```

**Why this model?**
- `gpt-4o-2024-08-06` supports Structured Outputs feature
- Guarantees valid JSON matching Zod schema
- No need for manual parsing or retries

## Recommendation Application

### File: `lib/applyRecommendations.ts`

**Core Function:**
```typescript
async function applyRecommendations(
  options: ApplyRecommendationsOptions
): Promise<ApplyRecommendationsResult>
```

**Workflow:**

1. **Fetch approved recommendations**
   ```typescript
   const recommendations = await prisma.recommendation.findMany({
     where: {
       id: { in: recommendationIds },
       status: "APPROVED",
     },
     include: { researchRun: { select: { projectId: true } } },
   });
   ```

2. **Verify ownership**
   ```typescript
   // Ensure all recommendations belong to project
   const invalidRecs = recommendations.filter(
     (r) => r.researchRun.projectId !== projectId
   );
   if (invalidRecs.length > 0) {
     throw new Error("Invalid recommendations");
   }
   ```

3. **Create snapshot**
   ```typescript
   const snapshot = await prisma.corpusSnapshot.create({
     data: {
       projectId,
       name: snapshotName || `Auto-snapshot ${new Date().toISOString()}`,
       layersData: layers as Prisma.JsonArray,
       filesData: files as Prisma.JsonArray,
     },
   });
   ```

4. **Apply in transaction**
   ```typescript
   await prisma.$transaction(async (tx) => {
     for (const rec of recommendations) {
       await applySingleRecommendationWithTx(tx, rec, snapshot.id);

       await tx.recommendation.update({
         where: { id: rec.id },
         data: { status: "APPLIED", appliedAt: new Date() },
       });
     }
   });
   ```

**Transaction guarantees:**
- All recommendations applied or none
- Automatic rollback on any error
- Database consistency maintained

### Recommendation Types

#### ADD Operations

**Context Layer:**
```typescript
const layer = await tx.contextLayer.create({
  data: {
    projectId,
    title,
    content,
    priority: 999,  // Add at end
    isActive: true,
  },
});
```

**Knowledge File:**
```typescript
const file = await tx.knowledgeFile.create({
  data: {
    projectId,
    title,
    content,
    isActive: true,
  },
});
```

#### EDIT Operations

**Requires:** `targetId` must exist

```typescript
const updated = await tx.contextLayer.update({
  where: { id: targetId },
  data: { title, content },
});
```

**Logs previous value for audit trail:**
```typescript
await tx.applyChangesLog.create({
  data: {
    snapshotId,
    recommendationId,
    changeType: "EDIT",
    targetType: "LAYER",
    targetId: updated.id,
    previousValue: currentLayer,
    newValue: updated,
  },
});
```

#### DELETE Operations

**Requires:** `targetId` must exist

```typescript
await tx.contextLayer.delete({
  where: { id: targetId },
});

await tx.applyChangesLog.create({
  data: {
    // ... logs previousValue for rollback capability
  },
});
```

## Error Handling

### Generation Errors

**OpenAI API errors:**
```typescript
try {
  const completion = await openai.chat.completions.create({ ... });
} catch (error) {
  console.error("[Corpus Recommendations] Error generating:", error);
  return [];  // Return empty array, don't fail job
}
```

**Invalid JSON errors:**
```typescript
const parsed = corpusRecommendationSchema.parse(JSON.parse(content));
// If parse fails, throws ZodError → caught by caller → empty array
```

### Application Errors

**Transaction rollback:**
```typescript
try {
  await prisma.$transaction(async (tx) => {
    // All operations...
  });
} catch (error) {
  // Transaction automatically rolled back
  return {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };
}
```

**Partial application prevented:**
- Either ALL recommendations apply successfully
- Or NONE apply (rollback)
- No inconsistent state possible

## Customization Examples

### Modifying Recommendation Criteria

**Example:** Only generate HIGH impact recommendations

```typescript
// In corpusRecommendationGenerator.ts prompt
const prompt = `
...
Only generate recommendations with HIGH impact level.
Focus on transformative changes that significantly improve the corpus.
Minimum confidence threshold: 0.8
`;
```

### Adding Custom Recommendation Fields

1. **Update schema:**
```typescript
const corpusRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      // ... existing fields
      estimatedReadingTime: z.number(),  // NEW
      tags: z.array(z.string()),         // NEW
    })
  ),
});
```

2. **Update type:**
```typescript
export type CorpusRecommendation = {
  // ... existing
  estimatedReadingTime: number;
  tags: string[];
};
```

3. **Update Prisma schema:**
```prisma
model Recommendation {
  // ... existing fields
  estimatedReadingTime Int?
  tags                 String[]
}
```

4. **Update application logic:**
```typescript
await tx.recommendation.update({
  data: {
    // ... existing
    estimatedReadingTime: rec.estimatedReadingTime,
    tags: rec.tags,
  },
});
```

### Implementing Recommendation Filters

**Example:** Filter out low-confidence recommendations

```typescript
// In recommendationGenerationJob
const filteredRecs = recommendations.filter(
  (rec) => rec.confidence >= 0.7  // Only 70%+ confidence
);

await prisma.recommendation.createMany({
  data: filteredRecs.map((rec, index) => ({ ... })),
});
```

## Testing Strategies

### Unit Testing Generation

**Mock OpenAI:**
```typescript
jest.mock("openai");

test("generates valid recommendations", async () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          recommendations: [
            {
              action: "ADD",
              targetType: "LAYER",
              targetId: null,
              title: "Test",
              content: "...",
              reasoning: "...",
              confidence: 0.9,
              impactLevel: "HIGH",
            },
          ],
        }),
      },
    }],
  });

  openai.chat.completions.create = mockCreate;

  const recs = await generateCorpusRecommendations({ ... });
  expect(recs).toHaveLength(1);
  expect(recs[0].action).toBe("ADD");
});
```

### Integration Testing Application

**With test database:**
```typescript
test("applies recommendations atomically", async () => {
  const projectId = await createTestProject();
  const recs = await createTestRecommendations(projectId);

  const result = await applyRecommendations({
    projectId,
    recommendationIds: recs.map((r) => r.id),
  });

  expect(result.success).toBe(true);
  expect(result.appliedCount).toBe(recs.length);

  // Verify changes
  const layers = await prisma.contextLayer.findMany({
    where: { projectId },
  });
  expect(layers.length).toBeGreaterThan(0);
});
```

## Performance Optimization

**Batch recommendation generation:**
```typescript
// Instead of generating one at a time, generate all at once
const allRecs = await generateCorpusRecommendations({ ... });

// Bulk insert
await prisma.recommendation.createMany({
  data: allRecs.map((rec, index) => ({ ... })),
  skipDuplicates: true,
});
```

**Cache research findings:**
```typescript
// Hash instructions + depth
const cacheKey = `research:${hash(instructions + depth)}`;

// Check cache first
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// If not cached, research and cache
const result = await executeResearch({ ... });
await redis.set(cacheKey, JSON.stringify(result), "EX", 86400);  // 24h
```

## Monitoring & Analytics

**Track recommendation acceptance rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'APPROVED') / COUNT(*)::float AS approval_rate,
  COUNT(*) FILTER (WHERE status = 'APPLIED') / COUNT(*)::float AS application_rate
FROM recommendations
WHERE created_at > NOW() - INTERVAL '30 days';
```

**Track impact distribution:**
```sql
SELECT
  impact_level,
  COUNT(*),
  AVG(confidence)
FROM recommendations
WHERE status = 'APPLIED'
GROUP BY impact_level;
```

---

**Completion:** All developer guides created. Ready for Phase 3: UI Implementation.
