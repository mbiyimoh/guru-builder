# Context Layers vs Knowledge Files: Architectural Summary

## Executive Summary

This document provides a detailed architectural analysis of how the Guru Builder system differentiates between **Context Layers** and **Knowledge Files** — two distinct types of knowledge storage designed for different use cases in AI knowledge management.

**TL;DR:**
- **Context Layers** = Always-loaded foundational knowledge (in every AI prompt)
- **Knowledge Files** = Conditionally-loaded reference documents (only when relevant)

---

## 1. Conceptual Model

### Context Layers (Always-Loaded)
Context layers are **foundational knowledge** that shapes the AI's behavior, personality, and core expertise. They are:

- **Always included** in every LLM prompt
- **Priority-ordered** to control loading sequence
- **Toggleable** for experimentation (active/inactive)
- **Composable** into structured system prompts

**Use Cases:**
- System instructions ("You are a backgammon coach...")
- Core principles and methodologies
- Coaching style and tone guidelines
- Foundational domain knowledge
- Rules and constraints

**Think of them as:** The AI's "personality" and "core training" that should always be present.

### Knowledge Files (Conditionally-Loaded)
Knowledge files are **detailed reference documents** that provide specific information when needed. They are:

- **Conditionally loaded** based on user query relevance
- **Categorized** for organization
- **Token-efficient** (not in every prompt)
- **Referenced** when mentioned or semantically relevant

**Use Cases:**
- Detailed strategy guides
- Historical game analyses
- Specific opening theory documents
- Reference materials
- Extended examples and case studies

**Think of them as:** A library of reference books that the AI can pull from when relevant.

---

## 2. Database Schema Comparison

### ContextLayer Model

```prisma
model ContextLayer {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  content     String   @db.Text
  priority    Int      // Lower = higher priority (loaded first)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project         Project          @relation(...)
  recommendations Recommendation[] @relation("RecommendationToLayer")

  @@index([projectId, priority])
  @@index([projectId, isActive])
}
```

**Key Fields:**
- `priority` (Int) - Determines load order in composed prompt
- `isActive` (Boolean) - Soft delete / A/B testing toggle
- No `description` field (title is sufficient)

**Indexes:**
- `[projectId, priority]` - Optimized for ordered retrieval
- `[projectId, isActive]` - Filter active layers efficiently

### KnowledgeFile Model

```prisma
model KnowledgeFile {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  description String?
  content     String   @db.Text
  category    String?  // Optional categorization (e.g., "openings", "strategy")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project         Project          @relation(...)
  recommendations Recommendation[] @relation("RecommendationToFile")

  @@index([projectId, isActive])
  @@index([projectId, category])
}
```

**Key Fields:**
- `category` (String?) - Grouping mechanism (e.g., "openings", "endgame")
- `description` (String?) - Brief summary for display
- No `priority` field (order doesn't matter for conditional loading)

**Indexes:**
- `[projectId, isActive]` - Filter active files
- `[projectId, category]` - Group by category for UI/loading

---

## 3. Loading Mechanisms

### Context Layer Composition

Context layers are composed into a structured system prompt via `lib/contextComposer.ts`:

```typescript
export async function composeContextFromLayers(
  projectId: string,
  layerIds?: string[]
): Promise<string> {
  // 1. Fetch all active layers (or specific layerIds if provided)
  const layers = await prisma.contextLayer.findMany({
    where: {
      projectId,
      isActive: true,
      ...(layerIds && layerIds.length > 0 ? { id: { in: layerIds } } : {}),
    },
    orderBy: { priority: 'asc' }, // ⚡ Priority-ordered
  });

  // 2. Compose into structured prompt
  let prompt = '# CONTEXT LAYERS\n\n';
  prompt += 'The following layers inform your coaching style and knowledge:\n\n';

  layers.forEach((layer, idx) => {
    prompt += `## Layer ${idx + 1}: ${layer.title}\n\n`;
    prompt += `${layer.content}\n\n`;
    prompt += '---\n\n';
  });

  prompt += '\nAnswer the user\'s question based on the context layers above. ';
  prompt += 'Reference specific principles from the layers when relevant.\n';

  return prompt;
}
```

**Key Characteristics:**
- ✅ **Sequential assembly** based on priority
- ✅ **All active layers included** (unless specific IDs provided)
- ✅ **Markdown-formatted** with clear section headers
- ✅ **Metadata preserved** (layer numbers, titles)

**Flow:**
1. Query database for active layers (ordered by priority)
2. Assemble into markdown-formatted string
3. Return complete prompt to be prepended to every LLM call

### Knowledge File Loading

Knowledge files use a **conditional loading** strategy:

```typescript
// From app/api/knowledge-files/route.ts
export async function GET(request: NextRequest) {
  const projectId = searchParams.get("projectId");

  const files = await prisma.knowledgeFile.findMany({
    where: { projectId },
    orderBy: [
      { category: "asc" },  // Group by category
      { createdAt: "desc" },
    ],
  });

  // Group by category for organized access
  const grouped = files.reduce((acc, file) => {
    const category = file.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(file);
    return acc;
  }, {} as Record<string, typeof files>);

  return { files, grouped, total, activeCount };
}
```

**Key Characteristics:**
- ✅ **Category-based grouping** for organization
- ✅ **No automatic inclusion** in prompts
- ✅ **Retrieved on-demand** (likely via semantic search or explicit reference)
- ✅ **Token-efficient** (only loaded when relevant)

**Flow (Inferred):**
1. User asks question
2. System determines relevant knowledge files (via embeddings/keywords/explicit mention)
3. Fetches specific files from database
4. Includes in prompt context alongside context layers

> **Note:** The exact conditional loading mechanism is not fully implemented in this codebase (likely an upcoming feature or handled elsewhere in the architecture).

---

## 4. API Patterns

### Context Layers API

**Endpoint Pattern:**
- `GET /api/context-layers?projectId=xxx` - List all layers (priority-ordered)
- `POST /api/context-layers` - Create new layer
- `PUT /api/context-layers/[id]` - Update layer
- `DELETE /api/context-layers/[id]` - Delete layer

**Note:** This follows the same pattern as Knowledge Files API for consistency.

**Validation Schema:**
```typescript
const CreateLayerSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(1),  // ⚡ Required
  content: z.string().min(1).max(50000),
  isActive: z.boolean().default(true),
});
```

**Priority Conflict Handling:**
```typescript
// Check if priority already exists (prevents conflicts)
const existingLayer = await prisma.contextLayer.findFirst({
  where: { projectId, priority: data.priority },
});

if (existingLayer) {
  return NextResponse.json(
    { error: `Priority ${data.priority} already exists` },
    { status: 400 }
  );
}
```

### Knowledge Files API

**Endpoint Pattern:**
- `GET /api/knowledge-files?projectId=xxx` - List all files (category-grouped)
- `POST /api/knowledge-files` - Create new file
- `PUT /api/knowledge-files/[id]` - Update file
- `DELETE /api/knowledge-files/[id]` - Delete file

**Status:** ✅ Implemented (Phase 2)

**Validation Schema:**
```typescript
const createKnowledgeFileSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),  // ⚡ Has description
  content: z.string().min(1),
  category: z.string().optional(),     // ⚡ Has category
  isActive: z.boolean().default(true),
});
```

**Category Grouping:**
```typescript
// Returns both flat list and category-grouped data
return {
  files,                    // All files
  grouped,                  // Grouped by category
  total: files.length,
  activeCount: files.filter(f => f.isActive).length,
};
```

---

## 5. Recommendation System Integration

Both context layers and knowledge files can be targets for AI-generated recommendations:

### Recommendation Model

```prisma
model Recommendation {
  action        RecommendationAction // ADD, EDIT, DELETE
  targetType    TargetType           // LAYER or KNOWLEDGE_FILE
  targetId      String?              // null for ADD, ID for EDIT/DELETE

  title         String
  content       String
  reasoning     String

  // Polymorphic relations
  contextLayer     ContextLayer?   @relation("RecommendationToLayer", ...)
  knowledgeFile    KnowledgeFile?  @relation("RecommendationToFile", ...)
}
```

### Generation Logic

From `lib/corpusRecommendationGenerator.ts`:

```typescript
const prompt = `
CURRENT CONTEXT LAYERS (${currentLayers.length}):
${currentLayers.map((l, i) => `${i + 1}. ${l.title} (${l.id})`).join("\n")}

CURRENT KNOWLEDGE FILES (${currentKnowledgeFiles.length}):
${currentKnowledgeFiles.map((f, i) => `${i + 1}. ${f.title} (${f.id})`).join("\n")}

Based on the research findings, generate recommendations to improve the corpus. You can:
- ADD new context layers or knowledge files
- EDIT existing ones (provide targetId and new content)
- DELETE outdated ones (provide targetId)
`;

const schema = z.object({
  recommendations: z.array(
    z.object({
      action: z.enum(["ADD", "EDIT", "DELETE"]),
      targetType: z.enum(["LAYER", "KNOWLEDGE_FILE"]), // ⚡ Distinguishes target
      targetId: z.string().nullable(),
      title: z.string(),
      content: z.string(),
      reasoning: z.string(),
      confidence: z.number().min(0).max(1),
      impactLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
  ),
});
```

**AI Decision-Making:**
The LLM decides whether to recommend:
- **Context Layer** - If the knowledge should always be present (foundational)
- **Knowledge File** - If the knowledge is reference material (conditional)

### Application Logic

From `lib/applyRecommendations.ts`:

```typescript
async function applySingleRecommendationWithTx(tx, recommendation, snapshotId) {
  const { action, targetType, targetId, title, content, researchRun } = recommendation;
  const projectId = researchRun.projectId;

  if (targetType === "LAYER") {
    if (action === "ADD") {
      const layer = await tx.contextLayer.create({
        data: {
          projectId,
          title,
          content,
          priority: 999, // ⚡ New layers added at end
          isActive: true,
        },
      });
    }
    // ... EDIT/DELETE logic
  } else if (targetType === "KNOWLEDGE_FILE") {
    if (action === "ADD") {
      const file = await tx.knowledgeFile.create({
        data: {
          projectId,
          title,
          content,
          isActive: true,
        },
      });
    }
    // ... EDIT/DELETE logic
  }
}
```

**Key Differences:**
- Context layers get default `priority: 999` (end of list, user reorders)
- Knowledge files don't need priority (no ordering requirement)

---

## 6. Snapshot & Versioning

Both types are versioned together in corpus snapshots:

```typescript
// From lib/applyRecommendations.ts
const layers = await prisma.contextLayer.findMany({
  where: { projectId },
});

const files = await prisma.knowledgeFile.findMany({
  where: { projectId },
});

const snapshot = await prisma.corpusSnapshot.create({
  data: {
    projectId,
    name: snapshotName || `Auto-snapshot ${new Date().toISOString()}`,
    description: `Before applying ${recommendations.length} recommendations`,
    layersData: layers,      // ⚡ All context layers
    filesData: files,        // ⚡ All knowledge files
  },
});
```

**CorpusSnapshot Model:**
```prisma
model CorpusSnapshot {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  description String?

  layersData  Json     // Snapshot of all ContextLayers
  filesData   Json     // Snapshot of all KnowledgeFiles

  createdAt   DateTime @default(now())
  restoredAt  DateTime?
}
```

**Restoration Strategy:**
- Both layers and files are restored atomically from snapshot JSON
- Maintains complete corpus state at each version point

---

## 7. Use Case Decision Matrix

When should you use each type?

### Use Context Layers When:

| Scenario | Example |
|----------|---------|
| **Always-needed knowledge** | "You are a backgammon coach. Use the rollout equity formula..." |
| **System instructions** | "Respond in a concise, encouraging tone. Keep answers mobile-friendly." |
| **Core principles** | "The 5 key principles of backgammon: 1) Prime building, 2) Hitting, 3)..." |
| **Personality/tone** | "You teach using the Socratic method. Ask guiding questions..." |
| **Rules and constraints** | "Never suggest illegal moves. Always validate board positions." |
| **Foundational knowledge** | "Opening theory fundamentals: The 13-24 split is correct 95% of the time..." |

### Use Knowledge Files When:

| Scenario | Example |
|----------|---------|
| **Reference documents** | "Advanced Endgame Theory: 42 positions you must memorize" (5000+ words) |
| **Detailed guides** | "Complete Guide to Modern Opening Theory (2024 update)" |
| **Specific topics** | "The Back Game: When and How to Execute" |
| **Historical analyses** | "Championship Match Analysis: Magriel vs. Robertie (1979)" |
| **Extended examples** | "50 Classic Backgammon Positions with Solutions" |
| **Large corpuses** | "Encyclopedia of Backgammon Primes" (10,000+ words) |

### Decision Flowchart:

```
Does the AI need this information for EVERY query?
├─ YES → Context Layer
└─ NO → Continue...
    │
    Is this foundational to the AI's identity/behavior?
    ├─ YES → Context Layer
    └─ NO → Continue...
        │
        Is this >1000 words of detailed reference material?
        ├─ YES → Knowledge File
        └─ NO → Continue...
            │
            Will this only be relevant for specific queries?
            ├─ YES → Knowledge File
            └─ NO → Context Layer (default to always-available)
```

---

## 8. Performance & Token Economics

### Context Layers
- **Token Cost:** Fixed overhead on EVERY prompt
- **Typical Size:** 200-2000 tokens per layer
- **Recommended Limit:** 5-10 layers maximum
- **Total Budget:** ~5,000-15,000 tokens (always included)

**Optimization Strategies:**
1. Keep layers concise and focused
2. Use priority to front-load most important layers
3. Toggle off experimental layers when not A/B testing
4. Regular audits to remove redundant information

### Knowledge Files
- **Token Cost:** Only when loaded (0 tokens if not referenced)
- **Typical Size:** 1,000-50,000 tokens per file
- **Recommended Limit:** No hard limit (loaded on-demand)
- **Total Budget:** Variable based on query relevance

**Optimization Strategies:**
1. Use semantic embeddings for efficient retrieval
2. Chunk large files into smaller, topic-focused files
3. Categorize for faster filtering
4. Cache frequently-accessed files

### Example Token Breakdown

**Query:** "What's the best opening move for a 3-1 roll?"

```
Context Layers (Always Included):
├─ Layer 1: System Instructions      (500 tokens)
├─ Layer 2: Core Principles           (800 tokens)
├─ Layer 3: Opening Theory Basics     (1200 tokens)
└─ TOTAL CONTEXT LAYERS              = 2,500 tokens

Knowledge Files (Conditionally Loaded):
├─ "Opening Theory Details" (5000 tokens) → LOADED (query mentions "opening")
├─ "Endgame Guide" (3000 tokens)          → NOT LOADED
├─ "Back Game Strategy" (2000 tokens)     → NOT LOADED
└─ TOTAL KNOWLEDGE FILES             = 5,000 tokens (1 of 3 loaded)

User Query: "What's the best opening move for a 3-1 roll?" (12 tokens)

TOTAL PROMPT SIZE = 7,512 tokens
```

**Without Knowledge Files (all in context layers):**
- Would need ~7,500 tokens in EVERY prompt
- Wasteful for queries about endgames, back games, etc.

---

## 9. Migration Path for Existing Systems

If you have an existing system with **only context layers**, here's how to add knowledge files:

### Step 1: Identify Candidates for Migration

Audit your existing context layers and identify:

```typescript
// Example audit script
const layers = await prisma.contextLayer.findMany({ where: { projectId } });

const migrationCandidates = layers.filter(layer => {
  return (
    layer.content.length > 2000 &&           // Large content
    !layer.title.includes("System") &&       // Not system instructions
    !layer.title.includes("Core") &&         // Not core principles
    layer.priority > 3                       // Low priority (not foundational)
  );
});

console.log(`Found ${migrationCandidates.length} layers to migrate`);
```

### Step 2: Create Knowledge Files from Candidates

```typescript
for (const layer of migrationCandidates) {
  await prisma.knowledgeFile.create({
    data: {
      projectId: layer.projectId,
      title: layer.title,
      description: `Migrated from context layer (${layer.priority})`,
      content: layer.content,
      category: inferCategoryFromTitle(layer.title), // Custom logic
      isActive: layer.isActive,
    },
  });
}
```

### Step 3: Update Context Layers

Keep only foundational layers (priority 1-3):

```typescript
// Remove migrated layers
await prisma.contextLayer.deleteMany({
  where: {
    id: { in: migrationCandidates.map(l => l.id) },
  },
});

// Re-prioritize remaining layers
const remainingLayers = await prisma.contextLayer.findMany({
  where: { projectId },
  orderBy: { priority: 'asc' },
});

for (let i = 0; i < remainingLayers.length; i++) {
  await prisma.contextLayer.update({
    where: { id: remainingLayers[i].id },
    data: { priority: i + 1 },
  });
}
```

### Step 4: Implement Conditional Loading

Add semantic search or keyword-based loading:

```typescript
async function loadRelevantKnowledgeFiles(query: string, projectId: string) {
  // Option 1: Simple keyword matching
  const keywords = extractKeywords(query); // Your implementation

  const files = await prisma.knowledgeFile.findMany({
    where: {
      projectId,
      isActive: true,
      OR: keywords.map(kw => ({
        OR: [
          { title: { contains: kw, mode: 'insensitive' } },
          { content: { contains: kw, mode: 'insensitive' } },
          { category: { contains: kw, mode: 'insensitive' } },
        ],
      })),
    },
  });

  return files;
}

// Option 2: Semantic embeddings (recommended)
async function loadRelevantKnowledgeFilesSemantic(
  query: string,
  projectId: string
) {
  const queryEmbedding = await generateEmbedding(query); // OpenAI embeddings API

  // Use pgvector or similar for similarity search
  const files = await prisma.$queryRaw`
    SELECT * FROM "KnowledgeFile"
    WHERE "projectId" = ${projectId}
    AND "isActive" = true
    ORDER BY embedding <-> ${queryEmbedding}::vector
    LIMIT 3
  `;

  return files;
}
```

---

## 10. Advanced Patterns

### Hybrid Loading Strategy

Combine both types for optimal token usage:

```typescript
async function composeFullContext(
  projectId: string,
  userQuery: string
): Promise<string> {
  // 1. Always load context layers
  const contextPrompt = await composeContextFromLayers(projectId);

  // 2. Conditionally load relevant knowledge files
  const relevantFiles = await loadRelevantKnowledgeFiles(userQuery, projectId);

  let knowledgeSection = '';
  if (relevantFiles.length > 0) {
    knowledgeSection = '\n\n# RELEVANT KNOWLEDGE FILES\n\n';
    relevantFiles.forEach(file => {
      knowledgeSection += `## ${file.title}\n\n${file.content}\n\n---\n\n`;
    });
  }

  return contextPrompt + knowledgeSection;
}
```

### Dynamic Layer Promotion

Automatically promote frequently-accessed knowledge files to context layers:

```typescript
// Track knowledge file access
await prisma.knowledgeFileAccess.create({
  data: { fileId, queryId, timestamp: new Date() },
});

// Weekly job: Promote high-access files
const accessCounts = await prisma.knowledgeFileAccess.groupBy({
  by: ['fileId'],
  where: { timestamp: { gte: oneWeekAgo } },
  _count: true,
  orderBy: { _count: { fileId: 'desc' } },
  take: 5,
});

for (const { fileId, _count } of accessCounts) {
  if (_count > 50) { // Threshold
    const file = await prisma.knowledgeFile.findUnique({ where: { id: fileId } });

    // Create context layer from frequently-accessed file
    await prisma.contextLayer.create({
      data: {
        projectId: file.projectId,
        title: file.title,
        content: summarizeContent(file.content), // Condense for layer
        priority: 999,
        isActive: true,
      },
    });
  }
}
```

### Category-Based Auto-Loading

Automatically load all files in a category based on query:

```typescript
const queryCategories = detectCategories(userQuery); // e.g., ["openings", "endgame"]

const files = await prisma.knowledgeFile.findMany({
  where: {
    projectId,
    category: { in: queryCategories },
    isActive: true,
  },
});
```

---

## 11. Testing Strategies

### Unit Tests

```typescript
describe('Context Layer vs Knowledge File Loading', () => {
  it('should always load active context layers', async () => {
    const prompt = await composeContextFromLayers(projectId);
    expect(prompt).toContain('# CONTEXT LAYERS');
    expect(prompt).toContain('Layer 1:');
    expect(prompt).toContain('Layer 2:');
  });

  it('should not load inactive context layers', async () => {
    await prisma.contextLayer.update({
      where: { id: layer1.id },
      data: { isActive: false },
    });
    const prompt = await composeContextFromLayers(projectId);
    expect(prompt).not.toContain(layer1.title);
  });

  it('should load knowledge files only when relevant', async () => {
    const files = await loadRelevantKnowledgeFiles('opening strategy', projectId);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.category === 'openings')).toBe(true);
  });

  it('should not load knowledge files for unrelated queries', async () => {
    const files = await loadRelevantKnowledgeFiles('endgame strategy', projectId);
    const openingFiles = files.filter(f => f.category === 'openings');
    expect(openingFiles.length).toBe(0);
  });
});
```

### Integration Tests

```typescript
describe('Full Context Composition', () => {
  it('should combine layers and relevant files', async () => {
    const fullContext = await composeFullContext(projectId, 'What about opening 3-1?');

    // Should have context layers
    expect(fullContext).toContain('# CONTEXT LAYERS');

    // Should have relevant knowledge files
    expect(fullContext).toContain('# RELEVANT KNOWLEDGE FILES');
    expect(fullContext).toContain('Opening Theory');
  });

  it('should respect token limits', async () => {
    const fullContext = await composeFullContext(projectId, query);
    const tokenCount = countTokens(fullContext);

    expect(tokenCount).toBeLessThan(15000); // Max context window
  });
});
```

---

## 12. Common Pitfalls & Solutions

### Pitfall 1: Token Overflow

**Problem:** Adding too many context layers bloats every prompt

**Solution:**
```typescript
// Enforce layer limit
const MAX_LAYERS = 8;
const MAX_LAYER_SIZE = 2000; // characters

const createLayerSchema = z.object({
  // ...
  content: z.string().min(1).max(MAX_LAYER_SIZE),
});

// Warn when approaching limit
const layerCount = await prisma.contextLayer.count({
  where: { projectId, isActive: true },
});

if (layerCount >= MAX_LAYERS) {
  console.warn(`Project ${projectId} has ${layerCount} active layers (limit: ${MAX_LAYERS})`);
}
```

### Pitfall 2: Stale Knowledge Files

**Problem:** Knowledge files become outdated but still get loaded

**Solution:**
```typescript
// Add freshness metadata
model KnowledgeFile {
  // ...
  lastVerified DateTime?
  expiresAt    DateTime?
}

// Filter by freshness
const files = await prisma.knowledgeFile.findMany({
  where: {
    projectId,
    isActive: true,
    OR: [
      { expiresAt: null },
      { expiresAt: { gte: new Date() } },
    ],
  },
});
```

### Pitfall 3: Inefficient File Loading

**Problem:** Loading entire file content when only summary needed

**Solution:**
```typescript
// Add summary field
model KnowledgeFile {
  // ...
  summary String? @db.Text // 200-500 chars
}

// Two-stage loading
async function loadWithSummaries(query: string, projectId: string) {
  // Stage 1: Load summaries only
  const candidates = await prisma.knowledgeFile.findMany({
    where: { projectId, isActive: true },
    select: { id: true, title: true, summary: true },
  });

  // Stage 2: Semantic filter on summaries (cheap)
  const relevant = filterBySemantic(candidates, query);

  // Stage 3: Load full content for top matches
  const fullFiles = await prisma.knowledgeFile.findMany({
    where: { id: { in: relevant.map(r => r.id) } },
  });

  return fullFiles;
}
```

---

## 13. Summary & Best Practices

### Context Layers
✅ **DO:**
- Use for foundational knowledge (personality, core principles)
- Keep concise (200-2000 characters)
- Limit to 5-10 layers
- Use priority to order most important first
- Toggle off for A/B testing

❌ **DON'T:**
- Include detailed reference material
- Exceed 10 active layers
- Duplicate information across layers
- Add information that's only occasionally relevant

### Knowledge Files
✅ **DO:**
- Use for detailed reference documents
- Categorize for efficient filtering
- Add summaries for quick filtering
- Implement semantic search
- Track access patterns

❌ **DON'T:**
- Include foundational knowledge
- Forget to categorize
- Load all files on every query
- Neglect freshness/expiration

### Architecture Principles

1. **Separation of Concerns:** Layers = behavior, Files = knowledge
2. **Token Efficiency:** Always-load only what's always needed
3. **Flexibility:** Both can be targets for AI recommendations
4. **Versioning:** Both tracked together in snapshots
5. **Optimization:** Regularly audit and rebalance

---

## 14. Implementation Checklist

For projects implementing this architecture:

- [x] Database schema includes both `ContextLayer` and `KnowledgeFile` models
- [x] Context layer composer function loads active layers by priority
- [ ] Knowledge file conditional loading mechanism (semantic/keyword) - *Future enhancement*
- [x] API endpoints for Knowledge Files (CRUD operations)
- [ ] API endpoints for Context Layers (CRUD operations) - *In progress*
- [x] Recommendation system targets both types
- [x] Snapshot system captures both types atomically
- [ ] UI differentiates between layers (always-on) and files (reference) - *In progress*
  - [ ] Context Layer Manager component with create/edit/delete
  - [ ] Knowledge File Manager component with create/edit/delete
  - [ ] Integrated into project detail page
- [ ] Token usage monitoring and alerts - *Future enhancement*
- [ ] Migration path from legacy single-type systems
- [ ] Documentation for users on when to use each type

### Manual CRUD UI (Phase 3 Enhancement)

**Implementation Details:**
- **UI Pattern:** Tailwind CSS modals following `CreateProjectButton.tsx` pattern
- **Components:**
  - `ContextLayerManager.tsx` - List, create, edit, delete context layers
  - `ContextLayerModal.tsx` - Form for creating/editing layers
  - `KnowledgeFileManager.tsx` - List, create, edit, delete knowledge files
  - `KnowledgeFileModal.tsx` - Form for creating/editing files
- **Integration:** Both managers integrated into `/projects/[id]` page
- **User Flow:** Users can manually build corpus before running research
- **Spec:** See `specs/feat-context-layer-knowledge-file-crud.md`

---

**Document Version:** 1.0
**Created:** 2025-11-09
**Based on:** Guru Builder Implementation (Phase 2 Complete)
**Author:** Architectural Analysis of Production Codebase
