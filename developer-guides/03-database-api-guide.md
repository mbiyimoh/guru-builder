# Database & API Developer Guide

**Component:** Prisma schema, database models, REST API patterns
**Files:** `prisma/schema.prisma`, `app/api/**/*.ts`, `lib/apiHelpers.ts`

## Database Schema

### Entity Relationship Diagram

```
Project (1) ──┬─→ (N) ContextLayer
              ├─→ (N) KnowledgeFile
              ├─→ (N) ResearchRun
              └─→ (N) CorpusSnapshot

ResearchRun (1) ──→ (N) Recommendation

Recommendation (N) ──→ (1) ContextLayer [optional]
Recommendation (N) ──→ (1) KnowledgeFile [optional]
Recommendation (1) ──→ (N) ApplyChangesLog

CorpusSnapshot (1) ──→ (N) ApplyChangesLog
```

### Core Models

#### Project
**Purpose:** Root container for all corpus data

```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  contextLayers  ContextLayer[]
  knowledgeFiles KnowledgeFile[]
  researchRuns   ResearchRun[]
  snapshots      CorpusSnapshot[]
}
```

**Cascade deletion:** Deleting project deletes ALL related data

#### ContextLayer
**Purpose:** System prompts/instructions for AI

```prisma
model ContextLayer {
  id        String   @id @default(cuid())
  projectId String
  title     String
  content   String   @db.Text
  priority  Int      // Lower = higher priority (loaded first)
  isActive  Boolean  @default(true)

  project Project @relation(...)
  recommendations Recommendation[] @relation("RecommendationToLayer")

  @@index([projectId, priority])
  @@index([projectId, isActive])
}
```

**Key constraints:**
- `priority` determines load order
- `isActive` for soft deletion
- Recommendations can target layers for EDIT/DELETE

#### KnowledgeFile
**Purpose:** Curated knowledge documents

```prisma
model KnowledgeFile {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  description String?
  content     String   @db.Text
  category    String?  // Optional grouping
  isActive    Boolean  @default(true)

  project Project @relation(...)
  recommendations Recommendation[] @relation("RecommendationToFile")

  @@index([projectId, isActive])
  @@index([projectId, category])
}
```

#### ResearchRun
**Purpose:** Track research execution and results

```prisma
model ResearchRun {
  id            String         @id @default(cuid())
  projectId     String
  instructions  String         @db.Text
  depth         ResearchDepth  @default(MODERATE)
  status        ResearchStatus @default(PENDING)

  researchData  Json?          // Full research findings
  errorMessage  String?        @db.Text

  startedAt     DateTime?
  completedAt   DateTime?
  executionTime Int?           // milliseconds
  tokensUsed    Int?
  costEstimate  Float?         // USD

  project Project @relation(...)
  recommendations Recommendation[]

  @@index([projectId, status])
  @@index([projectId, createdAt])
}
```

**Status flow:** PENDING → RUNNING → (COMPLETED | FAILED | CANCELLED)

#### Recommendation
**Purpose:** AI-generated corpus improvement suggestions

```prisma
model Recommendation {
  id            String               @id @default(cuid())
  researchRunId String

  action        RecommendationAction // ADD, EDIT, DELETE
  targetType    TargetType           // LAYER or KNOWLEDGE_FILE
  targetId      String?              // Null for ADD

  title         String
  content       String               @db.Text
  reasoning     String               @db.Text

  confidence    Float                // 0.0 to 1.0
  impactLevel   ImpactLevel          // LOW, MEDIUM, HIGH
  priority      Int                  // Ordering within run

  status        RecommendationStatus @default(PENDING)
  reviewedAt    DateTime?
  appliedAt     DateTime?

  researchRun   ResearchRun @relation(...)
  contextLayer  ContextLayer? @relation("RecommendationToLayer", ...)
  knowledgeFile KnowledgeFile? @relation("RecommendationToFile", ...)
  applyChangesLogs ApplyChangesLog[]

  @@index([researchRunId, status])
  @@index([researchRunId, priority])
  @@index([targetType, targetId])
}
```

**Polymorphic relation:** `targetType` + `targetId` point to either layer or file

**Status flow:** PENDING → (APPROVED | REJECTED) → APPLIED

#### CorpusSnapshot
**Purpose:** Version control for corpus state

```prisma
model CorpusSnapshot {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  description String?  @db.Text

  layersData  Json     // Snapshot of all ContextLayers
  filesData   Json     // Snapshot of all KnowledgeFiles

  createdAt   DateTime @default(now())
  restoredAt  DateTime?

  project Project @relation(...)
  applyChangesLogs ApplyChangesLog[]

  @@index([projectId, createdAt])
}
```

**Purpose:** Created before applying recommendations for rollback capability

#### ApplyChangesLog
**Purpose:** Audit trail for applied changes

```prisma
model ApplyChangesLog {
  id               String               @id @default(cuid())
  snapshotId       String
  recommendationId String

  changeType       RecommendationAction
  targetType       TargetType
  targetId         String?

  previousValue    Json?                // For EDIT/DELETE
  newValue         Json?                // For ADD/EDIT

  createdAt        DateTime @default(now())

  snapshot       CorpusSnapshot @relation(...)
  recommendation Recommendation @relation(...)

  @@index([snapshotId])
  @@index([recommendationId])
}
```

## API Patterns

### Standard CRUD Pattern

All entity APIs follow consistent patterns:

#### List Endpoint
```typescript
// GET /api/[resource]?projectId=xxx&status=xxx
export async function GET(request: NextRequest) {
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const items = await prisma.[resource].findMany({
    where: { projectId },
    include: { _count: { select: { ... } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items, stats: { ... } });
}
```

#### Create Endpoint
```typescript
// POST /api/[resource]
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate with Zod
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.format() },
      { status: 400 }
    );
  }

  const item = await prisma.[resource].create({
    data: result.data,
  });

  return NextResponse.json({ item }, { status: 201 });
}
```

#### Get by ID
```typescript
// GET /api/[resource]/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const item = await prisma.[resource].findUnique({
    where: { id },
    include: { ... },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
```

### Error Handling with apiHelpers

**Using error utilities:**
```typescript
import { errorResponse, handlePrismaError } from "@/lib/apiHelpers";

try {
  const item = await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
} catch (error) {
  return errorResponse("delete project", error);
}
```

**Handles automatically:**
- P2025: Not found → 404
- P2002: Unique violation → 409
- P2003: Foreign key violation → 400
- Generic errors → 500

## Common Development Tasks

### Adding a New Field

**Example:** Add `priority` to KnowledgeFile

1. **Update schema:**
```prisma
model KnowledgeFile {
  // ... existing fields
  priority Int @default(100)  // NEW
}
```

2. **Create migration:**
```bash
npx prisma migrate dev --name add-knowledge-file-priority
```

3. **Update create validation:**
```typescript
// app/api/knowledge-files/route.ts
const createSchema = z.object({
  // ... existing
  priority: z.number().int().min(0).optional(),
});
```

4. **Update update validation:**
```typescript
const updateSchema = z.object({
  // ... existing
  priority: z.number().int().min(0).optional(),
});
```

### Adding a New Enum Value

**Example:** Add PAUSED to ResearchStatus

1. **Update schema:**
```prisma
enum ResearchStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
  PAUSED  // NEW
}
```

2. **Create migration:**
```bash
npx prisma migrate dev --name add-paused-status
```

3. **Regenerate Prisma client:**
```bash
npx prisma generate
```

4. **Update validation:**
```typescript
const validStatuses = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "PAUSED"] as const;
```

### Adding a New Relationship

**Example:** Add User model and ownership to Project

1. **Add User model:**
```prisma
model User {
  id       String    @id @default(cuid())
  email    String    @unique
  name     String?
  projects Project[]
}
```

2. **Add foreign key to Project:**
```prisma
model Project {
  // ... existing fields
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

3. **Create migration:**
```bash
npx prisma migrate dev --name add-user-ownership
```

4. **Update API to require userId:**
```typescript
// app/api/projects/route.ts
const createSchema = z.object({
  name: z.string(),
  userId: z.string().cuid(),  // NEW
});
```

## Testing Database Operations

### Manual Testing with Prisma Studio
```bash
npx prisma studio
# Opens GUI at http://localhost:5555
```

### Database Reset
```bash
# WARNING: Deletes all data
npx prisma migrate reset

# Alternative: Drop and recreate
npx prisma migrate reset --skip-seed
npx prisma migrate deploy
```

### Seed Data
```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: {
      name: "Test Project",
      description: "For development",
    },
  });

  await prisma.contextLayer.create({
    data: {
      projectId: project.id,
      title: "Core Instructions",
      content: "You are a backgammon expert...",
      priority: 1,
      isActive: true,
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run with: `npx prisma db seed`

## Critical Constraints

### Cascade Deletion Rules

```
Project deleted → Deletes:
  - All ContextLayers
  - All KnowledgeFiles
  - All ResearchRuns (which cascade deletes Recommendations)
  - All CorpusSnapshots (which cascade deletes ApplyChangesLogs)

Recommendation deleted → Deletes:
  - All ApplyChangesLogs

ContextLayer/KnowledgeFile deleted → Sets:
  - Recommendation.targetId = null (SetNull behavior)
```

### Unique Constraints

- `Project`: No unique constraints (allows duplicate names)
- `ContextLayer`: No unique constraints
- `KnowledgeFile`: No unique constraints
- `ResearchRun`: No unique constraints
- `Recommendation`: No unique constraints
- `CorpusSnapshot`: No unique constraints

**Rationale:** Flexibility over strict uniqueness. Business logic handles duplicates.

### Index Strategy

**Query patterns optimized:**
- List by projectId + status
- List by projectId + createdAt (descending)
- List by projectId + priority
- Find by targetType + targetId

## Performance Considerations

**N+1 Query Prevention:**
```typescript
// BAD: N+1 queries
const projects = await prisma.project.findMany();
for (const project of projects) {
  const layers = await prisma.contextLayer.findMany({
    where: { projectId: project.id },
  });
}

// GOOD: Single query with include
const projects = await prisma.project.findMany({
  include: {
    contextLayers: true,
    _count: { select: { knowledgeFiles: true } },
  },
});
```

**Pagination (not yet implemented):**
```typescript
// Future enhancement
const items = await prisma.project.findMany({
  skip: (page - 1) * limit,
  take: limit,
});
```

---

**Next:** See `04-recommendation-system-guide.md` for AI integration details
