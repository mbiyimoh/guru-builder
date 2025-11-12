# Feature Specification: Guru Builder System - MVP

## Status
**Draft** - Ready for Review

## Authors
Claude Code - January 8, 2025

## Overview

Transform the single-project backgammon-guru application into a multi-project "Guru Builder" system that allows users to create, manage, and iteratively improve AI teaching assistants for any game or domain through autonomous research and structured recommendation workflows.

The system enables users to start with a basic guru (context layers + knowledge files), run AI-powered research cycles that analyze external sources, review structured recommendations for corpus improvements, and apply approved changes—creating a continuously improving knowledge base.

## Problem Statement

**Current State**: The backgammon-guru is a single-project system with excellent context layer architecture but requires manual content updates. There's no systematic way to:
- Manage multiple guru projects
- Discover and incorporate knowledge from external sources
- Compare new information against existing corpus
- Get structured, actionable recommendations for improvements
- Track changes and maintain version history

**User Need**: Domain experts want to build comprehensive AI teaching assistants but face challenges:
1. **Knowledge Discovery**: Finding and synthesizing expert content is time-consuming
2. **Corpus Maintenance**: Manually updating context layers and knowledge files is tedious
3. **Quality Assurance**: Ensuring new information aligns with existing knowledge is difficult
4. **Iteration**: No systematic workflow for continuous improvement

**Value Proposition**: A system that autonomously researches topics, compares findings to existing knowledge, generates structured recommendations, and applies approved changes—turning weeks of manual work into hours of guided curation.

## Goals

### Must-Have (MVP Scope)
1. **Multi-Project Management**: Dashboard to create, view, and manage multiple guru projects
2. **Research Run Orchestration**: Configure and execute autonomous research tasks using GPT Researcher
3. **Structured Recommendations**: Generate actionable, typed recommendation objects (not just text reports)
4. **Approval Workflow**: Review, approve/reject, and preview changes before applying
5. **Automated Updates**: Apply approved recommendations to update context layers and knowledge files
6. **Version Control**: Snapshot corpus before changes with restore capability
7. **Knowledge File System**: Support conditionally-loaded knowledge files referenced by layers

### MVP User Flow
```
1. Create Project → 2. Add Initial Layers → 3. Configure Research Run →
4. System Researches & Analyzes → 5. Review Recommendations →
6. Approve/Reject → 7. Apply Changes → 8. Iterate
```

## Non-Goals (Explicitly Out of Scope for MVP)

- ❌ Multi-user collaboration or team features
- ❌ Authentication or authorization (single-user MVP)
- ❌ Real-time collaboration on corpus editing
- ❌ Advanced analytics or data visualization (basic stats only)
- ❌ Export/import of projects (manual database operations acceptable)
- ❌ Custom AI model selection (GPT-4o-mini only)
- ❌ Web scraping infrastructure (leverage GPT Researcher's capabilities)
- ❌ Advanced conflict resolution (simple last-write-wins)
- ❌ Undo/redo beyond snapshot restore
- ❌ Advanced search or filtering (basic list views acceptable)

## Technical Approach

### Architecture Overview

**Build on Existing Foundation (40% Reuse)**:
- ✅ Keep: Next.js 15, Prisma, Vercel AI SDK, shadcn/ui, Tailwind
- ✅ Extend: Database schema, API routes, UI components
- 🆕 Add: GPT Researcher, Inngest, OpenAI Structured Outputs

**Key Architectural Decisions**:
1. **GPT Researcher for Autonomous Research**: Purpose-built for deep research, saves 5-7 days vs custom build
2. **Inngest for Background Jobs**: Serverless-native, perfect for Vercel, no Redis needed
3. **OpenAI Structured Outputs**: Guarantees valid JSON for recommendation objects
4. **Knowledge Files vs Context Layers**: Layers always loaded, files loaded conditionally when referenced

### Database Schema Extensions

**New Models** (extend existing `Project` and `ContextLayer`):

```prisma
// Knowledge files referenced conditionally
model KnowledgeFile {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name          String
  description   String?
  content       String   @db.Text
  fileSize      Int
  referencedIn  String[]  // Array of layer IDs

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([projectId])
}

// Research run tracking
model ResearchRun {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  title           String
  instructions    String   @db.Text
  depth           String   // "quick" | "moderate" | "deep"
  scope           Json     // { layers: "all" | string[], files: "all" | string[] }
  status          String   // "pending" | "running" | "complete" | "failed"

  sourcesAnalyzed Int?
  researchSummary String?  @db.Text
  fullReport      String?  @db.Text

  recommendations Recommendation[]

  startedAt       DateTime?
  completedAt     DateTime?
  duration        Int?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([projectId, status])
}

// Structured recommendations
model Recommendation {
  id              String   @id @default(cuid())
  researchRunId   String
  researchRun     ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Cascade)

  actionType      String   // "add" | "edit" | "delete"
  targetType      String   // "layer" | "knowledge-file"
  targetId        String?
  targetName      String

  title           String
  justification   String   @db.Text
  confidence      String   // "high" | "medium" | "low"
  impact          String   // "high" | "medium" | "low"
  priority        Int

  proposedChanges Json
  status          String   @default("pending")  // "pending" | "approved" | "rejected"
  userNotes       String?  @db.Text

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([researchRunId, status])
}

// Version control snapshots
model CorpusSnapshot {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  researchRunId   String?
  researchRun     ResearchRun? @relation(fields: [researchRunId], references: [id], onDelete: SetNull)

  snapshotData    Json
  description     String?

  createdAt       DateTime @default(now())

  @@index([projectId, createdAt])
}

// Update Project model
model Project {
  id              String   @id @default(cuid())
  name            String
  description     String?
  icon            String?
  gameType        String?

  contextLayers   ContextLayer[]
  knowledgeFiles  KnowledgeFile[]
  researchRuns    ResearchRun[]
  snapshots       CorpusSnapshot[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### API Routes Structure

**Reusable (Keep As-Is)**:
- ✅ `GET/POST/PATCH/DELETE /api/project/[id]/context-layers/*`
- ✅ `POST /api/chat` (for testing guru)

**New Routes Needed**:
```typescript
// Project management
GET    /api/projects
POST   /api/projects
GET    /api/projects/[id]
PATCH  /api/projects/[id]
DELETE /api/projects/[id]

// Knowledge files
GET    /api/project/[id]/knowledge-files
POST   /api/project/[id]/knowledge-files
PATCH  /api/project/[id]/knowledge-files/[fileId]
DELETE /api/project/[id]/knowledge-files/[fileId]

// Research runs
GET    /api/project/[id]/research-runs
POST   /api/project/[id]/research-runs          // Creates run, triggers Inngest
GET    /api/project/[id]/research-runs/[runId]

// Recommendations
GET    /api/project/[id]/research-runs/[runId]/recommendations
PATCH  /api/recommendations/[id]                 // Approve/reject

// Apply changes
POST   /api/project/[id]/research-runs/[runId]/apply

// Snapshots
GET    /api/project/[id]/snapshots
POST   /api/project/[id]/snapshots/[id]/restore
```

### Core Libraries

**New Libraries to Build**:

```typescript
// lib/researchOrchestrator.ts
// Integrates GPT Researcher via Python subprocess or HTTP
export async function executeResearchRun(
  projectId: string,
  runId: string,
  config: ResearchRunConfig
): Promise<void>

// lib/recommendationGenerator.ts
// Uses OpenAI Structured Outputs for guaranteed valid JSON
export async function generateRecommendations(
  corpus: Corpus,
  findings: ResearchFindings
): Promise<Recommendation[]>

// lib/recommendationApplier.ts
// Atomically applies approved recommendations
export async function applyRecommendations(
  projectId: string,
  runId: string,
  approvedIds: string[]
): Promise<ApplySummary>

// lib/snapshotManager.ts
// Creates and restores corpus snapshots
export async function createSnapshot(
  projectId: string,
  description?: string
): Promise<CorpusSnapshot>

// lib/knowledgeFileLoader.ts
// Conditionally loads knowledge files when referenced
export async function loadReferencedKnowledgeFiles(
  projectId: string,
  layerIds: string[],
  userMessage: string
): Promise<string[]>
```

**Validation Schemas (extend existing)**:

```typescript
// lib/validation.ts extensions

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  icon: z.string().max(10).optional(),
  gameType: z.string().max(50).optional(),
})

export const CreateKnowledgeFileSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  content: z.string().min(1).max(100000),
  referencedIn: z.array(z.string()).optional(),
})

export const CreateResearchRunSchema = z.object({
  title: z.string().min(1).max(200),
  instructions: z.string().min(1).max(5000),
  depth: z.enum(['quick', 'moderate', 'deep']),
  scope: z.object({
    layers: z.union([z.literal('all'), z.array(z.string())]),
    files: z.union([z.literal('all'), z.array(z.string())]),
  }),
})

export const UpdateRecommendationSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  userNotes: z.string().max(2000).optional(),
})
```

## Implementation Details

### Phase 1: Validation & Proof of Concept (Week 1)

**Goal**: Validate core technical assumptions before full implementation

#### Day 1-2: GPT Researcher Integration POC
```bash
# Install GPT Researcher
pip install gpt-researcher

# Create Python wrapper script
# research_agent.py - callable from Next.js API route
```

**Validation Criteria**:
- ✅ Can call Python subprocess from Next.js API route
- ✅ GPT Researcher can research a topic and return structured output
- ✅ Response quality meets expectations
- ✅ Performance is acceptable (~5-10 minutes for moderate research)

**Implementation**:
```typescript
// app/api/research/test/route.ts
import { spawn } from 'child_process';

export async function POST(req: Request) {
  const { instructions } = await req.json();

  // Call Python GPT Researcher
  const python = spawn('python', ['research_agent.py', instructions]);

  let output = '';
  python.stdout.on('data', (data) => {
    output += data.toString();
  });

  return new Promise((resolve) => {
    python.on('close', (code) => {
      resolve(NextResponse.json({ findings: JSON.parse(output) }));
    });
  });
}
```

#### Day 3: Inngest Background Jobs Setup
```bash
# Install Inngest
npm install inngest

# Create Inngest account (free tier)
# Configure Inngest endpoint
```

**Validation Criteria**:
- ✅ Inngest functions execute successfully
- ✅ Can trigger long-running jobs (5+ minutes)
- ✅ Job status tracking works
- ✅ Error handling is reliable

**Implementation**:
```typescript
// app/api/inngest/route.ts
import { Inngest } from 'inngest';
import { serve } from 'inngest/next';

const inngest = new Inngest({ id: 'guru-builder' });

const researchJob = inngest.createFunction(
  { id: 'research-run' },
  { event: 'research/run.started' },
  async ({ event, step }) => {
    const findings = await step.run('execute-research', async () => {
      // Call GPT Researcher
      return await performResearch(event.data.instructions);
    });

    const recommendations = await step.run('generate-recommendations', async () => {
      return await generateRecommendations(event.data.corpus, findings);
    });

    return { findings, recommendations };
  }
);

export default serve({ client: inngest, functions: [researchJob] });
```

#### Day 4: OpenAI Structured Outputs Test
**Validation Criteria**:
- ✅ Structured output returns valid JSON 100% of time
- ✅ Recommendation schema is comprehensive
- ✅ Integration with Zod validation works

**Implementation**:
```typescript
// Test structured recommendation generation
const recommendationSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      actionType: { type: "string", enum: ["add", "edit", "delete"] },
      targetType: { type: "string", enum: ["layer", "knowledge-file"] },
      title: { type: "string" },
      justification: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      impact: { type: "string", enum: ["high", "medium", "low"] },
      proposedChanges: { type: "object" }
    },
    required: ["actionType", "targetType", "title", "justification", "confidence", "impact"]
  }
};

const completion = await openai.chat.completions.create({
  model: "gpt-4o-2024-08-06",
  messages: [...],
  response_format: {
    type: "json_schema",
    json_schema: { schema: recommendationSchema }
  }
});
```

#### Day 5: Integration Test & Go/No-Go Decision

**Success Criteria**:
- All three core technologies working
- End-to-end flow: Research → Recommendations → Structured JSON
- Performance acceptable
- Costs within budget (~$0.005 per research run)

**Decision Point**:
- ✅ **GO**: Proceed to Phase 2 (database & APIs)
- ❌ **NO-GO**: Identify blockers, adjust approach, or pivot to alternatives

---

### Phase 2: Database & API Foundation (Week 2)

**Goal**: Extend database schema and build API layer

#### Day 1: Prisma Schema Migration
```bash
# Update prisma/schema.prisma with new models
# Create migration
npx prisma migrate dev --name add_guru_builder_models

# Seed database with test data
npx prisma db seed
```

**Deliverable**: Database supports all new models, migrations run cleanly

#### Day 2-3: Project & Knowledge File APIs

**Endpoints**:
```typescript
// app/api/projects/route.ts
GET    /api/projects           // List all projects
POST   /api/projects           // Create new project

// app/api/projects/[id]/route.ts
GET    /api/projects/[id]      // Get project details
PATCH  /api/projects/[id]      // Update project
DELETE /api/projects/[id]      // Delete project

// app/api/project/[id]/knowledge-files/route.ts
GET    /api/project/[id]/knowledge-files       // List files
POST   /api/project/[id]/knowledge-files       // Create file

// app/api/project/[id]/knowledge-files/[fileId]/route.ts
PATCH  /api/project/[id]/knowledge-files/[fileId]
DELETE /api/project/[id]/knowledge-files/[fileId]
```

**Pattern (reuse from existing layer APIs)**:
```typescript
// app/api/project/[id]/knowledge-files/route.ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const files = await prisma.knowledgeFile.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ files });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await req.json();

  const data = CreateKnowledgeFileSchema.parse(body);

  const file = await prisma.knowledgeFile.create({
    data: { projectId, ...data, fileSize: data.content.length },
  });

  return NextResponse.json({ file }, { status: 201 });
}
```

#### Day 4: Research Run & Recommendation APIs

**Endpoints**:
```typescript
// app/api/project/[id]/research-runs/route.ts
GET    /api/project/[id]/research-runs
POST   /api/project/[id]/research-runs  // Creates run + triggers Inngest job

// app/api/project/[id]/research-runs/[runId]/route.ts
GET    /api/project/[id]/research-runs/[runId]  // Get status & results

// app/api/project/[id]/research-runs/[runId]/recommendations/route.ts
GET    /api/project/[id]/research-runs/[runId]/recommendations

// app/api/recommendations/[id]/route.ts
PATCH  /api/recommendations/[id]  // Update status (approve/reject)
```

**Key Implementation**:
```typescript
// app/api/project/[id]/research-runs/route.ts
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await req.json();

  const data = CreateResearchRunSchema.parse(body);

  // Create research run record
  const run = await prisma.researchRun.create({
    data: {
      projectId,
      ...data,
      status: 'pending',
    },
  });

  // Trigger Inngest background job
  await inngest.send({
    name: 'research/run.started',
    data: {
      runId: run.id,
      projectId,
      instructions: data.instructions,
      depth: data.depth,
    },
  });

  return NextResponse.json({ run }, { status: 201 });
}
```

#### Day 5: Apply Changes & Snapshot APIs

**Endpoints**:
```typescript
// app/api/project/[id]/research-runs/[runId]/apply/route.ts
POST   /api/project/[id]/research-runs/[runId]/apply

// app/api/project/[id]/snapshots/route.ts
GET    /api/project/[id]/snapshots

// app/api/project/[id]/snapshots/[snapshotId]/restore/route.ts
POST   /api/project/[id]/snapshots/[snapshotId]/restore
```

**Deliverable**: Complete API layer, all routes tested with Postman/curl

---

### Phase 3: Core Research Orchestration (Week 3)

**Goal**: Implement the AI-powered research workflow

#### Day 1-2: Research Orchestrator

**Implementation**:
```typescript
// lib/researchOrchestrator.ts

export async function executeResearchRun(
  projectId: string,
  runId: string,
  config: ResearchRunConfig
): Promise<void> {
  // Update status to running
  await prisma.researchRun.update({
    where: { id: runId },
    data: { status: 'running', startedAt: new Date() },
  });

  try {
    const startTime = Date.now();

    // PHASE 1: Deep research using GPT Researcher
    const findings = await performDeepResearch(config.instructions, config.depth);

    // PHASE 2: Load corpus
    const corpus = await loadCorpus(projectId, config.scope);

    // PHASE 3: Generate recommendations
    const recommendations = await generateRecommendations(corpus, findings);

    // Save results
    await saveResearchResults(runId, {
      sourcesAnalyzed: findings.sources.length,
      researchSummary: findings.summary,
      fullReport: findings.fullReport,
      recommendations,
      duration: Math.floor((Date.now() - startTime) / 1000),
    });

    await prisma.researchRun.update({
      where: { id: runId },
      data: { status: 'complete', completedAt: new Date() },
    });

  } catch (error) {
    await prisma.researchRun.update({
      where: { id: runId },
      data: { status: 'failed' },
    });
    throw error;
  }
}

async function performDeepResearch(
  instructions: string,
  depth: 'quick' | 'moderate' | 'deep'
): Promise<ResearchFindings> {
  // Call GPT Researcher via Python subprocess
  const python = spawn('python', ['research_agent.py', instructions, depth]);

  return new Promise((resolve, reject) => {
    let output = '';
    python.stdout.on('data', (data) => { output += data.toString(); });
    python.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(output));
      } else {
        reject(new Error(`Research failed with code ${code}`));
      }
    });
  });
}
```

#### Day 3: Recommendation Generator with Structured Outputs

**Implementation**:
```typescript
// lib/recommendationGenerator.ts

export async function generateRecommendations(
  corpus: Corpus,
  findings: ResearchFindings
): Promise<Recommendation[]> {
  const systemPrompt = `
You are a corpus optimization expert. Analyze research findings and generate structured recommendations.

EXISTING CORPUS:
${JSON.stringify(corpus, null, 2)}

RESEARCH FINDINGS:
${findings.summary}

FULL SOURCES:
${findings.fullReport}

Generate recommendations for updating the corpus. Each recommendation must:
1. Specify actionType: "add", "edit", or "delete"
2. Specify targetType: "layer" or "knowledge-file"
3. Include clear title and justification
4. Assess confidence and impact (high/medium/low)
5. Provide specific proposedChanges

Prioritize by importance (top 3-5 most critical first).
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate recommendations" }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "recommendations",
        schema: recommendationSchema
      }
    }
  });

  const recommendations = JSON.parse(completion.choices[0].message.content);

  // Validate with Zod for extra safety
  return recommendations.map((rec: any, idx: number) => ({
    ...RecommendationSchema.parse(rec),
    priority: idx + 1,
  }));
}
```

#### Day 4-5: Recommendation Applier & Snapshot Manager

**Implementation**:
```typescript
// lib/recommendationApplier.ts

export async function applyRecommendations(
  projectId: string,
  runId: string,
  approvedIds: string[]
): Promise<ApplySummary> {
  // 1. Create snapshot
  const snapshot = await createSnapshot(projectId, `Before Research Run #${runId}`);

  // 2. Get approved recommendations
  const recommendations = await prisma.recommendation.findMany({
    where: {
      researchRunId: runId,
      id: { in: approvedIds },
      status: 'approved'
    },
    orderBy: { priority: 'asc' }
  });

  const summary = {
    layersModified: 0,
    layersCreated: 0,
    filesModified: 0,
    filesCreated: 0,
    filesDeleted: 0,
  };

  // 3. Execute recommendations atomically
  for (const rec of recommendations) {
    switch (rec.actionType) {
      case 'add':
        if (rec.targetType === 'layer') {
          await prisma.contextLayer.create({ data: rec.proposedChanges });
          summary.layersCreated++;
        } else {
          await prisma.knowledgeFile.create({ data: rec.proposedChanges });
          summary.filesCreated++;
        }
        break;

      case 'edit':
        if (rec.targetType === 'layer') {
          await prisma.contextLayer.update({
            where: { id: rec.targetId },
            data: rec.proposedChanges
          });
          summary.layersModified++;
        } else {
          await prisma.knowledgeFile.update({
            where: { id: rec.targetId },
            data: rec.proposedChanges
          });
          summary.filesModified++;
        }
        break;

      case 'delete':
        if (rec.targetType === 'layer') {
          await prisma.contextLayer.delete({ where: { id: rec.targetId } });
        } else {
          await prisma.knowledgeFile.delete({ where: { id: rec.targetId } });
          summary.filesDeleted++;
        }
        break;
    }
  }

  return { summary, snapshotId: snapshot.id };
}

// lib/snapshotManager.ts

export async function createSnapshot(
  projectId: string,
  description?: string
): Promise<CorpusSnapshot> {
  // Load full corpus
  const layers = await prisma.contextLayer.findMany({ where: { projectId } });
  const files = await prisma.knowledgeFile.findMany({ where: { projectId } });

  const snapshot = await prisma.corpusSnapshot.create({
    data: {
      projectId,
      description,
      snapshotData: { layers, files },
    },
  });

  return snapshot;
}

export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await prisma.corpusSnapshot.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) throw new Error('Snapshot not found');

  const { layers, files } = snapshot.snapshotData as any;
  const { projectId } = snapshot;

  // Delete current corpus
  await prisma.contextLayer.deleteMany({ where: { projectId } });
  await prisma.knowledgeFile.deleteMany({ where: { projectId } });

  // Restore from snapshot
  await prisma.contextLayer.createMany({ data: layers });
  await prisma.knowledgeFile.createMany({ data: files });
}
```

**Deliverable**: Complete research orchestration workflow working end-to-end

---

### Phase 4: UI Components (Week 4)

**Goal**: Build user interfaces for all workflows

#### Day 1: Projects Dashboard

**Components** (reuse patterns from existing LayerCard/LayerManager):
```tsx
// components/projects/ProjectCard.tsx
// Similar structure to LayerCard but for projects

// components/projects/ProjectList.tsx
// Similar to LayerManager pattern

// components/projects/CreateProjectModal.tsx
// Similar to LayerEditModal
```

**Pages**:
```tsx
// app/page.tsx (REPLACE existing)
// Dashboard listing all projects

// app/projects/new/page.tsx
// Create new project wizard
```

#### Day 2: Knowledge File Management

**Components** (adapt existing layer components):
```tsx
// components/corpus/KnowledgeFileCard.tsx
// Adapted from LayerCard

// components/corpus/KnowledgeFileManager.tsx
// Adapted from LayerManager

// components/corpus/CorpusView.tsx
// Tabbed view: Context Layers + Knowledge Files
```

**Pages**:
```tsx
// app/projects/[id]/page.tsx
// Main corpus view with tabs
```

#### Day 3: Research Run Configuration & Progress

**Components**:
```tsx
// components/research/ResearchRunConfig.tsx
// Form for configuring new research run

// components/research/ResearchRunProgress.tsx
// Live progress indicator (polling /api/research-runs/[runId])

// components/research/ResearchSummary.tsx
// Display research findings
```

**Pages**:
```tsx
// app/projects/[id]/research/new/page.tsx
// Configure new research run

// app/projects/[id]/research/page.tsx
// Research history list

// app/projects/[id]/research/[runId]/page.tsx
// View research results
```

#### Day 4: Recommendation Review UI

**Components**:
```tsx
// components/recommendations/RecommendationCard.tsx
// Single recommendation with approve/reject actions

// components/recommendations/RecommendationPreview.tsx
// Modal with before/after diff using react-diff-viewer

// components/recommendations/BulkActions.tsx
// Approve/reject all buttons
```

**Integration**:
```tsx
import ReactDiffViewer from 'react-diff-viewer';

<ReactDiffViewer
  oldValue={recommendation.proposedChanges.before}
  newValue={recommendation.proposedChanges.after}
  splitView={true}
  showDiffOnly={false}
/>
```

#### Day 5: Apply Progress & Changes Summary

**Components**:
```tsx
// components/changes/ApplyProgress.tsx
// Progress bar during recommendation application

// components/changes/ChangesSummary.tsx
// Summary after applying changes
```

**Deliverable**: Complete UI for all workflows, functional end-to-end

---

### Phase 5: Integration & Production Readiness (Week 5)

#### Day 1-2: End-to-End Testing

**Test Scenarios**:
1. Create project → Add layers → Configure research → Review recommendations → Apply
2. Multiple research runs on same project
3. Approve/reject mixed recommendations
4. Restore from snapshot
5. Error handling: failed research, invalid JSON, API errors

**Testing Approach**:
```typescript
// Manual testing with real GPT Researcher calls
// Document test cases and results
// Fix integration bugs
```

#### Day 3: Error Handling & Edge Cases

**Areas to Harden**:
- Python subprocess failures
- OpenAI API rate limits
- Inngest job failures
- Database constraint violations
- Invalid recommendation JSON (despite structured outputs)
- Concurrent research runs

**Implementation**:
```typescript
// Add retry logic
// Add proper error messages to UI
// Add loading states
// Add optimistic updates where appropriate
```

#### Day 4: Performance Optimization

**Optimizations**:
- Add database query optimization
- Implement loading skeletons
- Add pagination to project/research lists (if needed)
- Optimize API response sizes

#### Day 5: Documentation & Deployment

**Documentation**:
- Environment setup guide
- GPT Researcher installation instructions
- Inngest configuration
- Database migration guide
- Deployment to Vercel guide

**Deployment**:
```bash
# Set environment variables
DATABASE_URL=...
OPENAI_API_KEY=...
INNGEST_SIGNING_KEY=...
INNGEST_EVENT_KEY=...

# Deploy to Vercel
vercel deploy --prod
```

**Deliverable**: Production-ready MVP deployed to Vercel

---

## Testing Approach

### Phase 1 Validation Tests
- [ ] GPT Researcher returns valid JSON
- [ ] Python subprocess integration works
- [ ] Inngest jobs execute and track status
- [ ] Structured outputs validate with Zod
- [ ] End-to-end POC: Research → Recommendations

### API Integration Tests
- [ ] All CRUD operations work for projects
- [ ] All CRUD operations work for knowledge files
- [ ] Research run creation triggers Inngest job
- [ ] Recommendation approval updates status
- [ ] Apply changes executes all actions
- [ ] Snapshot creation and restore works

### UI Functional Tests
- [ ] Can create and view projects
- [ ] Can manage context layers and knowledge files
- [ ] Can configure and start research run
- [ ] Can view research progress
- [ ] Can review and approve recommendations
- [ ] Can see changes summary

### Error Handling Tests
- [ ] Failed Python subprocess handled gracefully
- [ ] OpenAI API errors show user-friendly messages
- [ ] Inngest job failures are logged and recoverable
- [ ] Invalid data rejected with validation errors

## Open Questions

### Answered During Validation (Phase 1)
- ✅ How to integrate Python GPT Researcher with Next.js? → Subprocess or HTTP service
- ✅ Can Inngest handle 5-10 minute research jobs? → Yes, no timeout limits
- ✅ Are structured outputs reliable enough? → Yes, 100% JSON adherence

### To Be Answered During Implementation
- ⏳ What's the optimal research depth for MVP? (Quick/Moderate/Deep)
- ⏳ Should we support concurrent research runs per project?
- ⏳ How many snapshots should we keep per project?
- ⏳ Should knowledge file loading be automatic or manual?
- ⏳ What's the UX for knowledge file references in layers?

## User Experience

### Key User Flows

**1. Create New Guru**
```
Dashboard → [+ Create New Guru] → Modal (name, description, icon)
→ [Create] → Project Page (empty corpus) → [+ Add Layer] → Layer Editor
```

**2. Run Research Cycle**
```
Project Page → [🔬 New Research Run] → Config Form (instructions, depth, scope)
→ [Start] → Progress Screen (live updates) → Results Page (recommendations)
→ Review each recommendation → [✓ Approve] or [✗ Reject]
→ [Apply Selected (12)] → Progress → Changes Summary
```

**3. Review Before/After**
```
Recommendation Card → [Preview Changes] → Modal with split diff view
→ [✓ Approve] or [✗ Reject] → Back to list
```

### UI Components Reused from Existing
- ✅ shadcn/ui: Button, Card, Input, Textarea, Badge, Switch, Dialog, Tabs
- ✅ LayerCard pattern for ProjectCard and KnowledgeFileCard
- ✅ LayerEditModal pattern for CreateProjectModal
- ✅ LayerManager pattern for ProjectList

### New UI Patterns
- 🆕 Multi-step research configuration wizard
- 🆕 Real-time progress tracking with polling
- 🆕 Before/after diff viewer for recommendations
- 🆕 Bulk action buttons for recommendation approval
- 🆕 Snapshot restore confirmation flow

## Security & Performance

### Security (MVP Scope)
- ⚠️ No authentication (single-user assumption)
- ✅ Input validation with Zod on all API routes
- ✅ SQL injection prevented by Prisma
- ✅ Rate limiting handled by Vercel (100 req/10s default)
- ✅ Environment variables for API keys

### Performance Considerations
- ✅ Research runs execute in background (Inngest)
- ✅ Database queries indexed appropriately
- ✅ API responses paginated if lists grow large
- ⏳ Knowledge file loading optimized (lazy load when referenced)
- ⏳ Snapshot storage size monitored (JSON compression if needed)

## Documentation

### User Documentation (Create During Phase 5)
1. **Getting Started Guide**
   - Creating your first guru
   - Adding context layers and knowledge files
   - Running your first research cycle

2. **Research Run Guide**
   - Crafting effective research instructions
   - Choosing research depth
   - Understanding recommendation confidence/impact levels

3. **Best Practices**
   - Structuring context layers
   - When to use knowledge files vs layers
   - Iterative corpus improvement workflow

### Developer Documentation
1. **Environment Setup**
   - Installing GPT Researcher
   - Configuring Inngest
   - Database migrations

2. **Architecture Overview**
   - Data flow diagrams
   - API endpoint reference
   - Database schema reference

3. **Deployment Guide**
   - Vercel deployment steps
   - Environment variables
   - Python runtime setup

## Migration/Rollout

### Migration from Single-Project to Multi-Project

**Automatic Migration Script**:
```typescript
// scripts/migrate-to-multi-project.ts

async function migrateToMultiProject() {
  // Check if any projects exist
  const projectCount = await prisma.project.count();

  if (projectCount === 0) {
    // Create default "Backgammon Guru" project
    const project = await prisma.project.create({
      data: {
        name: 'Backgammon Guru',
        description: 'Teaching strategic mastery through style-based learning',
        icon: '🎲',
        gameType: 'backgammon',
      },
    });

    // Assign all existing layers to this project
    await prisma.contextLayer.updateMany({
      where: { projectId: null },
      data: { projectId: project.id },
    });

    console.log(`✅ Migrated existing layers to project: ${project.id}`);
  }
}
```

**Run migration**:
```bash
npx tsx scripts/migrate-to-multi-project.ts
```

### Rollout Plan
1. **Week 5 Day 1**: Deploy to staging, test with existing backgammon data
2. **Week 5 Day 2**: Run migration script, verify data integrity
3. **Week 5 Day 3**: Deploy to production (Vercel)
4. **Week 5 Day 4**: Monitor for issues, gather user feedback
5. **Week 5 Day 5**: Fix critical bugs, document known issues

## Future Improvements and Enhancements

**⚠️ EVERYTHING IN THIS SECTION IS OUT OF SCOPE FOR MVP**

### Multi-User & Collaboration
- User authentication and authorization
- Team workspaces with role-based access
- Real-time collaborative editing of layers
- Comment threads on recommendations
- Activity feed and change notifications

### Advanced Research Features
- Custom AI model selection (GPT-4o, Claude, o1-mini)
- Research run templates and presets
- Scheduled/recurring research runs
- Research run chaining (one run triggers another)
- Custom knowledge source connectors (Notion, Google Docs, etc.)

### Enhanced Recommendation System
- ML-powered recommendation ranking
- Automatic recommendation categorization
- Recommendation impact scoring based on usage data
- A/B testing of different corpus configurations
- Recommendation explanation with reasoning chains

### Analytics & Insights
- Advanced dashboard with charts (research velocity, approval rates)
- Corpus health metrics (coverage, freshness, consistency)
- Knowledge gap analysis
- User interaction analytics
- Cost tracking and optimization suggestions

### Knowledge Management
- Full-text search across corpus
- Knowledge graph visualization
- Automatic duplicate detection
- Consistency checking across layers and files
- Version diffing (not just snapshots)
- Export to various formats (PDF, Markdown archive, etc.)

### Performance & Scale
- Redis caching for frequently accessed data
- Background job queue optimization
- Corpus compression for large projects
- Incremental research (only new/changed sources)
- Parallel research execution

### Integration & Extensibility
- Webhook support for external integrations
- REST API for third-party tools
- CLI tool for corpus management
- GitHub integration (commit corpus changes)
- Plugin system for custom research sources

### Testing & Quality
- Automated corpus quality checks
- Regression testing for guru responses
- Performance benchmarking
- E2E test suite with Playwright
- Visual regression testing

### UX Enhancements
- Drag-and-drop layer reordering
- Bulk editing of layers/files
- Advanced filtering and sorting
- Keyboard shortcuts
- Mobile-responsive design improvements
- Dark mode

### DevOps & Monitoring
- Logging and error tracking (Sentry)
- Performance monitoring (Vercel Analytics)
- Cost monitoring and alerts
- Automated backups
- Disaster recovery procedures

## References

### Research Documents
- [Guru Builder UX Design](./guru-builder-ux-design.md)
- [Guru Builder Project Scaffold](./guru-builder-project-scaffold.md)
- [Guru Builder Building Blocks Research](./guru-builder-building-blocks-research.md)
- [Original System Description](./guru-builder-system.md)

### External Libraries & Tools
- [GPT Researcher](https://github.com/assafelovic/gpt-researcher) - Autonomous research agent
- [Inngest](https://www.inngest.com/docs) - Serverless background jobs
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) - Guaranteed JSON schemas
- [react-diff-viewer](https://www.npmjs.com/package/react-diff-viewer) - Before/after diff component
- [shadcn-admin](https://github.com/satnaing/shadcn-admin) - Dashboard template reference

### Technology Stack
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Prisma ORM](https://www.prisma.io/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Zod Validation](https://zod.dev)

### Best Practices
- [Prisma Migration Best Practices](https://www.prisma.io/docs/orm/prisma-migrate/getting-started)
- [Next.js App Router Patterns](https://nextjs.org/docs/app/building-your-application)
- [Vercel AI SDK Best Practices](https://www.telerik.com/blogs/practical-guide-using-vercel-ai-sdk-next-js-applications)

---

## Success Criteria

### Phase 1 Validation (Week 1) ✓
- [ ] GPT Researcher integrates successfully with Next.js
- [ ] Inngest executes long-running jobs reliably
- [ ] OpenAI Structured Outputs returns valid recommendations
- [ ] End-to-end POC completes in under 10 minutes
- [ ] Cost per research run under $0.01

### MVP Complete (Week 5) ✓
- [ ] Can create and manage multiple projects
- [ ] Can configure and execute research runs
- [ ] Research generates structured recommendations
- [ ] Can review, approve/reject recommendations
- [ ] Can apply approved changes and see summary
- [ ] Can restore from snapshots
- [ ] All core workflows tested end-to-end
- [ ] Deployed to production (Vercel)
- [ ] Documentation complete

### Post-MVP Success Metrics
- **Efficiency**: Research cycle (configure → apply) takes <30 minutes user time
- **Quality**: 50%+ recommendation approval rate (indicates good suggestions)
- **Reliability**: <5% research run failure rate
- **Performance**: Research completes in <10 minutes for moderate depth
- **Cost**: <$1 per research run (all costs included)

---

**Estimated Total Effort**: 4-5 weeks (single developer, full-time)
- Week 1: Validation (5 days)
- Week 2: Database & APIs (5 days)
- Week 3: Research Orchestration (5 days)
- Week 4: UI Components (5 days)
- Week 5: Integration & Production (5 days)

**Confidence Level**: High (85%)
- Foundation exists (40% reuse)
- Technology stack validated
- Clear implementation path
- Realistic scope for MVP
