# Guru Builder System - Project Scaffold

## Executive Summary

This document maps the existing backgammon-guru codebase to the new guru builder system requirements. It identifies **what we can reuse**, **what needs modification**, and **what must be built from scratch**.

**Key Finding**: ~40% of the guru builder system already exists in some form. We have strong foundations in database architecture, context layer management, and UI components that can be extended.

---

## 1. Database Architecture

### ✅ REUSABLE (with extensions)

**Existing Schema** (`prisma/schema.prisma`)
```prisma
model Project {
  id              String   @id @default(cuid())
  name            String
  description     String?
  contextLayers   ContextLayer[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ContextLayer {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  description String?
  priority    Int
  content     String   @db.Text
  isActive    Boolean  @default(true)
  isBuiltIn   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**What's Good:**
- ✅ Project model already exists
- ✅ ContextLayer model already exists
- ✅ Proper indexing on projectId
- ✅ Cascade deletion on context layers
- ✅ Priority-based ordering
- ✅ Active/inactive toggling

**What's Missing:**
- ❌ No KnowledgeFile model (knowledge files separate from context layers)
- ❌ No ResearchRun model (research run history, status tracking)
- ❌ No Recommendation model (structured recommendation data objects)
- ❌ No ResearchRunSnapshot model (backup/versioning before changes)
- ❌ No project-level metadata (icon, game type, last research run, etc.)

### 🔨 NEW MODELS NEEDED

```prisma
// Knowledge files that are referenced conditionally
model KnowledgeFile {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name        String              // e.g., "priming_strategy_coaching_guide.md"
  description String?
  content     String   @db.Text
  fileSize    Int                 // in bytes

  // Track which layers reference this file
  referencedIn String[]           // Array of layer IDs that reference this file

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId])
}

// Research run tracking
model ResearchRun {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  title           String              // e.g., "Backgammon Galaxy Modern Strategy"
  instructions    String   @db.Text   // Research instructions from user
  depth           String              // "quick" | "moderate" | "deep"
  scope           Json                // { layers: "all" | string[], files: "all" | string[] }

  status          String              // "pending" | "running" | "complete" | "failed"

  // Research results
  sourcesAnalyzed Int?
  researchSummary String?  @db.Text   // Markdown summary of key findings
  fullReport      String?  @db.Text   // Full detailed report

  // Recommendations relationship
  recommendations Recommendation[]

  // Timing
  startedAt       DateTime?
  completedAt     DateTime?
  duration        Int?                // seconds

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([projectId])
  @@index([projectId, status])
}

// Individual recommendation from a research run
model Recommendation {
  id              String   @id @default(cuid())
  researchRunId   String
  researchRun     ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Cascade)

  // Recommendation metadata
  actionType      String              // "add" | "edit" | "delete"
  targetType      String              // "layer" | "knowledge-file"
  targetId        String?             // ID if editing/deleting existing item
  targetName      String              // Name of layer/file being affected

  // Recommendation details
  title           String              // Brief description
  justification   String   @db.Text   // Why this change is recommended
  confidence      String              // "high" | "medium" | "low"
  impact          String              // "high" | "medium" | "low"
  priority        Int                 // 1-N ranking within the research run

  // Proposed changes (stored as JSON for flexibility)
  proposedChanges Json                // Structure depends on actionType
  // For edit: { before: string, after: string, section?: string }
  // For add: { content: string, priority?: number, referencedIn?: string[] }
  // For delete: { reason: string }

  // User decision
  status          String   @default("pending")  // "pending" | "approved" | "rejected" | "edited"
  userNotes       String?  @db.Text             // User's notes on this recommendation

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([researchRunId])
  @@index([researchRunId, status])
}

// Backup snapshots before applying changes
model CorpusSnapshot {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  researchRunId   String?
  researchRun     ResearchRun? @relation(fields: [researchRunId], references: [id], onDelete: SetNull)

  snapshotData    Json                // Complete corpus state (layers + files)
  description     String?             // e.g., "Before Research Run #5"

  createdAt       DateTime @default(now())

  @@index([projectId])
  @@index([projectId, createdAt])
}

// Update Project model
model Project {
  id              String          @id @default(cuid())
  name            String
  description     String?
  icon            String?                    // NEW: emoji or icon identifier
  gameType        String?                    // NEW: "backgammon", "chess", etc.

  contextLayers   ContextLayer[]
  knowledgeFiles  KnowledgeFile[]            // NEW
  researchRuns    ResearchRun[]              // NEW
  snapshots       CorpusSnapshot[]           // NEW

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```

---

## 2. API Routes

### ✅ REUSABLE (mostly as-is)

**Existing Routes:**
- `GET /api/project/[id]/context-layers` - List layers ✅
- `POST /api/project/[id]/context-layers` - Create layer ✅
- `PATCH /api/project/[id]/context-layers/[layerId]` - Update layer ✅
- `DELETE /api/project/[id]/context-layers/[layerId]` - Delete layer ✅
- `POST /api/chat` - Stream chat with context ✅ (for testing guru)

**Reusability:**
- ✅ Layer CRUD operations are solid
- ✅ Validation with Zod schemas is excellent
- ✅ Error handling patterns are good
- ✅ Chat endpoint can be used to "test" the guru after research runs

### 🔨 NEW ROUTES NEEDED

```typescript
// Project management
GET    /api/projects                           // List all projects (dashboard)
POST   /api/projects                           // Create new project
GET    /api/projects/[id]                      // Get single project
PATCH  /api/projects/[id]                      // Update project metadata
DELETE /api/projects/[id]                      // Delete project

// Knowledge file management
GET    /api/project/[id]/knowledge-files       // List knowledge files
POST   /api/project/[id]/knowledge-files       // Upload/create knowledge file
GET    /api/project/[id]/knowledge-files/[fileId]    // Get file
PATCH  /api/project/[id]/knowledge-files/[fileId]    // Update file
DELETE /api/project/[id]/knowledge-files/[fileId]    // Delete file

// Research run management
GET    /api/project/[id]/research-runs         // List research runs
POST   /api/project/[id]/research-runs         // Create new research run
GET    /api/project/[id]/research-runs/[runId] // Get research run details
DELETE /api/project/[id]/research-runs/[runId] // Delete research run

// Research run execution (the core AI workflow)
POST   /api/project/[id]/research-runs/[runId]/execute    // Start research
GET    /api/project/[id]/research-runs/[runId]/status     // Check progress

// Recommendation management
GET    /api/project/[id]/research-runs/[runId]/recommendations      // List
PATCH  /api/recommendations/[id]               // Update status/notes (approve/reject/edit)

// Apply changes workflow
POST   /api/project/[id]/research-runs/[runId]/apply     // Apply approved recommendations
GET    /api/project/[id]/research-runs/[runId]/changes   // View change summary

// Snapshots/versioning
GET    /api/project/[id]/snapshots             // List snapshots
POST   /api/project/[id]/snapshots             // Create manual snapshot
POST   /api/project/[id]/snapshots/[id]/restore // Restore from snapshot
```

---

## 3. Core Libraries

### ✅ REUSABLE

**`lib/contextComposer.ts`** - ✅ Can be extended
- Current: Composes context layers into system prompt
- Extension needed: Add support for dynamically loading knowledge files when referenced

**`lib/validation.ts`** - ✅ Excellent foundation
- Current: Zod schemas for layer validation
- Extension needed: Add schemas for KnowledgeFile, ResearchRun, Recommendation

**`lib/db.ts`** - ✅ Prisma client singleton
- Current: Works perfectly
- No changes needed

**`lib/types.ts`** - ✅ Good type foundation
- Current: ChatMessage, DrillContext, etc.
- Extension needed: Add types for research runs, recommendations, knowledge files

**`lib/utils.ts`** - ✅ General utilities
- Current: cn() for className merging
- Can be extended with additional utilities

### 🔨 NEW LIBRARIES NEEDED

```typescript
// lib/researchOrchestrator.ts
// Handles the AI research workflow:
// 1. Deep research on specified sources
// 2. Compare to existing corpus
// 3. Generate structured recommendations
export async function executeResearchRun(
  projectId: string,
  runId: string,
  instructions: string,
  depth: 'quick' | 'moderate' | 'deep'
): Promise<void>

// lib/recommendationApplier.ts
// Applies approved recommendations to corpus:
// 1. Create snapshot
// 2. Execute changes (edit/add/delete layers and files)
// 3. Update database
export async function applyRecommendations(
  projectId: string,
  runId: string,
  approvedRecommendationIds: string[]
): Promise<ApplyResult>

// lib/knowledgeFileLoader.ts
// Conditionally loads knowledge files based on context
export async function loadReferencedKnowledgeFiles(
  projectId: string,
  layerIds: string[],
  userMessage: string
): Promise<string[]>

// lib/corpusAnalyzer.ts
// Analyzes corpus and compares with research findings
export async function analyzeCorpusGaps(
  existingCorpus: Corpus,
  researchFindings: ResearchData
): Promise<Recommendation[]>

// lib/snapshotManager.ts
// Creates and restores corpus snapshots
export async function createSnapshot(
  projectId: string,
  description?: string
): Promise<CorpusSnapshot>

export async function restoreSnapshot(
  snapshotId: string
): Promise<void>
```

### 🔨 NEW VALIDATION SCHEMAS NEEDED

```typescript
// lib/validation.ts - Extensions

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
  focusAreas: z.array(z.string()).optional(),
})

export const UpdateRecommendationSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'edited']),
  userNotes: z.string().max(2000).optional(),
  proposedChanges: z.any().optional(), // Modified changes if "edited"
})
```

---

## 4. UI Components

### ✅ REUSABLE

**shadcn/ui Components** - ✅ All reusable
- `components/ui/button.tsx` ✅
- `components/ui/card.tsx` ✅
- `components/ui/input.tsx` ✅
- `components/ui/textarea.tsx` ✅
- `components/ui/label.tsx` ✅
- `components/ui/badge.tsx` ✅
- `components/ui/switch.tsx` ✅
- `components/ui/dialog.tsx` ✅
- `components/ui/tabs.tsx` ✅

**Layer Components** - ✅ Can be reused with minor modifications
- `components/layers/LayerCard.tsx` - ✅ Excellent foundation
  - Shows layer metadata, priority, active status
  - Edit/Delete/Toggle actions
  - Can be reused as-is for guru builder

- `components/layers/LayerEditModal.tsx` - ✅ Good modal pattern
  - Can be reused for editing layers in guru builder
  - Pattern can be copied for KnowledgeFileEditModal

- `components/layers/LayerManager.tsx` - ✅ Solid list management
  - Fetches, displays, CRUD operations
  - Can be adapted for guru corpus view

**Patterns to Replicate:**
- ✅ Card-based list views
- ✅ Modal edit dialogs
- ✅ Loading states
- ✅ Error handling with alerts
- ✅ Optimistic updates with refetch

### 🔨 NEW COMPONENTS NEEDED

```typescript
// Dashboard & Projects
components/projects/ProjectCard.tsx              // Project card on dashboard
components/projects/ProjectList.tsx              // List of all projects
components/projects/CreateProjectModal.tsx       // New project creation

// Guru Corpus Management (can extend existing layer components)
components/corpus/CorpusView.tsx                 // Tabbed view: Layers + Files
components/corpus/KnowledgeFileCard.tsx          // Similar to LayerCard
components/corpus/KnowledgeFileEditModal.tsx     // Similar to LayerEditModal
components/corpus/KnowledgeFileManager.tsx       // Similar to LayerManager

// Research Runs
components/research/ResearchRunConfig.tsx        // Configure new research run
components/research/ResearchRunCard.tsx          // Research run in history
components/research/ResearchRunList.tsx          // List all research runs
components/research/ResearchRunProgress.tsx      // Live progress indicator
components/research/ResearchSummary.tsx          // Summary of findings

// Recommendations
components/recommendations/RecommendationCard.tsx      // Single recommendation
components/recommendations/RecommendationList.tsx      // List of recommendations
components/recommendations/RecommendationPreview.tsx   // Before/after preview modal
components/recommendations/BulkActions.tsx             // Approve/reject all

// Changes & Snapshots
components/changes/ChangesSummary.tsx            // Summary after applying
components/changes/ApplyProgress.tsx             // Progress bar during apply
components/snapshots/SnapshotList.tsx            // List of backups
components/snapshots/RestoreSnapshot.tsx         // Restore UI

// Analytics
components/analytics/ResearchAnalytics.tsx       // Charts and stats
```

---

## 5. Page Structure

### ✅ REUSABLE

**`app/layout.tsx`** - ✅ Root layout
- Can be reused, might add navigation for projects

**`app/page.tsx`** - Current: Single project chat interface
- 🔨 Will become: Projects dashboard (list of gurus)

**`app/layers/page.tsx`** - Current: Layer management for single project
- 🔨 Will move to: `/projects/[id]/corpus` or similar

### 🔨 NEW PAGES NEEDED

```
app/
├── page.tsx                                    // 🔨 REPLACE: Projects Dashboard
├── projects/
│   ├── new/
│   │   └── page.tsx                            // Create new project
│   └── [id]/
│       ├── page.tsx                            // Guru overview (corpus view)
│       ├── corpus/
│       │   └── page.tsx                        // Detailed corpus management
│       ├── research/
│       │   ├── page.tsx                        // Research run history
│       │   ├── new/
│       │   │   └── page.tsx                    // Configure new research run
│       │   └── [runId]/
│       │       ├── page.tsx                    // View run results
│       │       └── recommendations/
│       │           └── page.tsx                // Review recommendations
│       ├── analytics/
│       │   └── page.tsx                        // Analytics dashboard
│       ├── settings/
│       │   └── page.tsx                        // Project settings
│       └── test/
│           └── page.tsx                        // ✅ REUSE: Chat interface to test guru
```

---

## 6. AI Integration & Research Orchestration

### ✅ REUSABLE

**Vercel AI SDK Integration** - ✅ Already set up
- `POST /api/chat` uses `streamText` from Vercel AI SDK
- OpenAI GPT-4o-mini integration working
- Can reuse this pattern for research orchestration

### 🔨 NEW AI WORKFLOWS NEEDED

**Research Execution Workflow:**
```typescript
// This is the CORE new functionality

1. Deep Research Phase
   - Use OpenAI's extended research capabilities
   - Feed it research instructions + sources to analyze
   - Generate comprehensive findings summary

2. Corpus Comparison Phase
   - Load existing corpus (layers + files)
   - Compare research findings to corpus
   - Identify gaps, contradictions, updates needed

3. Recommendation Generation Phase
   - Generate structured recommendations (JSON objects)
   - Include: action, target, justification, confidence, impact
   - Bucket by priority (top 3-5 vs high/medium/low)
   - Include before/after previews for edits

4. Apply Changes Phase
   - Create corpus snapshot (backup)
   - Execute approved recommendations
   - Update database atomically
   - Generate change summary
```

**Implementation approach:**
```typescript
// lib/researchOrchestrator.ts

export async function executeResearchRun(
  projectId: string,
  runId: string,
  config: ResearchRunConfig
): Promise<void> {
  // Update status to "running"
  await updateResearchRunStatus(runId, 'running')

  try {
    // PHASE 1: Deep research
    const findings = await performDeepResearch(config.instructions, config.depth)

    // PHASE 2: Load and compare corpus
    const corpus = await loadCorpus(projectId)
    const comparison = await compareCorpus(corpus, findings)

    // PHASE 3: Generate recommendations
    const recommendations = await generateRecommendations(comparison, corpus)

    // Save results to database
    await saveResearchResults(runId, {
      findings,
      recommendations,
      sourcesAnalyzed: findings.sources.length,
    })

    // Update status to "complete"
    await updateResearchRunStatus(runId, 'complete')

  } catch (error) {
    await updateResearchRunStatus(runId, 'failed')
    throw error
  }
}

async function performDeepResearch(
  instructions: string,
  depth: 'quick' | 'moderate' | 'deep'
): Promise<ResearchFindings> {
  // Use OpenAI with extended context/research capabilities
  // Could use o1-mini or gpt-4o for reasoning
  // Potentially use web search tools if available

  const systemPrompt = `
    You are a research assistant. Your task is to:
    1. Research the specified topic/sources thoroughly
    2. Synthesize the information into key learnings
    3. Identify the most important insights

    Research Instructions: ${instructions}
    Research Depth: ${depth}
  `

  // Implementation would use streaming or long-running AI calls
  // Return structured findings
}

async function generateRecommendations(
  comparison: CorpusComparison,
  corpus: Corpus
): Promise<Recommendation[]> {
  // Use AI to generate structured recommendations
  const systemPrompt = `
    You are a corpus optimization expert. Based on:

    EXISTING CORPUS:
    ${JSON.stringify(corpus, null, 2)}

    RESEARCH FINDINGS:
    ${JSON.stringify(comparison.findings, null, 2)}

    Generate structured recommendations for how to update the corpus.
    Each recommendation should be a JSON object with:
    - actionType: "add" | "edit" | "delete"
    - targetType: "layer" | "knowledge-file"
    - targetId: string (if editing/deleting)
    - targetName: string
    - title: string (brief description)
    - justification: string (detailed reasoning)
    - confidence: "high" | "medium" | "low"
    - impact: "high" | "medium" | "low"
    - proposedChanges: object (structure depends on actionType)

    Return recommendations prioritized by importance.
  `

  // Use structured output from OpenAI
  // Parse into Recommendation objects
}
```

---

## 7. Testing Strategy

### ✅ REUSABLE PATTERNS

Currently no tests exist, but we can establish patterns:

### 🔨 TESTING NEEDED

```typescript
// Unit tests
tests/lib/contextComposer.test.ts
tests/lib/researchOrchestrator.test.ts
tests/lib/recommendationApplier.test.ts
tests/lib/validation.test.ts

// Integration tests
tests/api/projects.test.ts
tests/api/research-runs.test.ts
tests/api/recommendations.test.ts

// E2E tests (Playwright)
e2e/guru-creation.spec.ts
e2e/research-run-workflow.spec.ts
e2e/recommendation-approval.spec.ts
```

---

## 8. Environment & Configuration

### ✅ REUSABLE

Current setup:
- Next.js 15 ✅
- PostgreSQL + Prisma ✅
- Vercel AI SDK ✅
- OpenAI API ✅
- Tailwind CSS + shadcn/ui ✅

### 🔨 ADDITIONS NEEDED

```bash
# .env additions

# Research configuration
RESEARCH_MODEL=gpt-4o-mini           # Or o1-mini for better reasoning
RESEARCH_MAX_TOKENS=16000            # For deep research
RESEARCH_TIMEOUT_MS=300000           # 5 minutes for research runs

# Optional: Web search integration
TAVILY_API_KEY=xxx                   # For web research capabilities
```

---

## 9. Migration Strategy

### Phase 1: Database Extensions (Week 1)
1. ✅ Add new models to Prisma schema
2. ✅ Create and run migrations
3. ✅ Update Project model with new fields
4. ✅ Seed database with test data

### Phase 2: Core Libraries (Week 2)
1. ✅ Build `lib/researchOrchestrator.ts`
2. ✅ Build `lib/recommendationApplier.ts`
3. ✅ Build `lib/knowledgeFileLoader.ts`
4. ✅ Build `lib/corpusAnalyzer.ts`
5. ✅ Extend validation schemas

### Phase 3: API Routes (Week 3)
1. ✅ Projects CRUD routes
2. ✅ Knowledge files CRUD routes
3. ✅ Research runs routes
4. ✅ Recommendations routes
5. ✅ Apply changes routes

### Phase 4: UI Components (Week 4-5)
1. ✅ Projects dashboard
2. ✅ Knowledge file management
3. ✅ Research run configuration
4. ✅ Recommendation review interface
5. ✅ Changes summary views

### Phase 5: Integration & Testing (Week 6)
1. ✅ End-to-end workflow testing
2. ✅ AI orchestration refinement
3. ✅ Error handling and edge cases
4. ✅ Performance optimization

---

## 10. Key Architectural Decisions

### ✅ KEEP FROM EXISTING

1. **Context Layer Architecture** - Excellent foundation
   - Multi-layer composable system
   - Priority-based ordering
   - Active/inactive toggling

2. **Prisma ORM** - Great choice
   - Type-safe database access
   - Migration management
   - Good performance

3. **Vercel AI SDK** - Modern and effective
   - Streaming support
   - Good OpenAI integration
   - Handles retries and errors

4. **shadcn/ui Components** - Excellent UI foundation
   - Consistent design
   - Accessible
   - Customizable

### 🔨 NEW ARCHITECTURAL DECISIONS

1. **Knowledge Files vs Context Layers**
   - Context layers: Always loaded (foundational knowledge)
   - Knowledge files: Conditionally loaded (referenced when needed)
   - Separation allows for larger corpus without context bloat

2. **Research Run as Async Job**
   - Research runs execute asynchronously
   - Status tracking (pending → running → complete)
   - User can navigate away during execution

3. **Recommendations as First-Class Objects**
   - Structured data (not just text)
   - Approve/reject/edit workflow
   - Preview before applying
   - Stored in database for audit trail

4. **Snapshot-Based Versioning**
   - Create snapshot before applying changes
   - Allow rollback to previous state
   - Lightweight (JSON storage of corpus state)

5. **Multi-Project Architecture**
   - Dashboard lists all projects
   - Each project is independent
   - Can export/import projects for sharing

---

## 11. Reusability Summary

### What We Have (40% of guru builder)

| Component | Reusability | Notes |
|-----------|-------------|-------|
| Database (Project, ContextLayer) | ✅ 90% | Just need to add new models |
| Context Layer CRUD APIs | ✅ 100% | Works as-is |
| Context Layer UI Components | ✅ 80% | Can adapt for corpus view |
| Context Composition Logic | ✅ 70% | Extend for knowledge files |
| Validation Schemas | ✅ 60% | Pattern is good, add new schemas |
| Chat/AI Integration | ✅ 80% | Pattern works, extend for research |
| shadcn/ui Components | ✅ 100% | All reusable |

### What We Need to Build (60% of guru builder)

| Component | Complexity | Estimated Effort |
|-----------|------------|------------------|
| KnowledgeFile Model + APIs | Medium | 2-3 days |
| ResearchRun Model + APIs | High | 5-7 days |
| Recommendation Model + APIs | Medium | 3-4 days |
| Research Orchestrator (AI) | High | 7-10 days |
| Recommendation Applier | Medium | 3-4 days |
| Projects Dashboard | Low | 2-3 days |
| Research Run UI | Medium | 5-6 days |
| Recommendation Review UI | Medium | 4-5 days |
| Snapshot Management | Medium | 3-4 days |

**Total Estimated Effort: 5-6 weeks** (single developer, full-time)

---

## 12. Next Steps

### Immediate Actions

1. **Review this scaffold** with stakeholders
2. **Prioritize features** (MVP vs nice-to-have)
3. **Create detailed specs** for Phase 1 (database extensions)
4. **Set up project board** with tasks from migration strategy
5. **Prototype research orchestration** to validate AI workflow

### Questions to Answer

1. Which AI model for research? (GPT-4o vs o1-mini vs Claude)
2. How to handle long-running research? (Background jobs? Polling?)
3. What's the auth strategy? (Multi-user or single-user MVP?)
4. Export/import format for sharing projects?
5. Rate limiting for API calls during research?

---

## Appendix A: File Structure Comparison

### Current Structure
```
backgammon-guru/
├── app/
│   ├── api/
│   │   ├── project/[id]/context-layers/
│   │   └── chat/
│   ├── layers/page.tsx
│   └── page.tsx
├── components/
│   ├── layers/
│   └── ui/
├── lib/
│   ├── contextComposer.ts
│   ├── validation.ts
│   └── types.ts
└── prisma/
    └── schema.prisma
```

### Guru Builder Structure
```
guru-builder/
├── app/
│   ├── api/
│   │   ├── projects/                          # 🔨 NEW
│   │   ├── project/[id]/
│   │   │   ├── context-layers/                # ✅ KEEP
│   │   │   ├── knowledge-files/               # 🔨 NEW
│   │   │   ├── research-runs/                 # 🔨 NEW
│   │   │   └── snapshots/                     # 🔨 NEW
│   │   ├── recommendations/                   # 🔨 NEW
│   │   └── chat/                              # ✅ KEEP
│   ├── page.tsx                               # 🔨 REPLACE (dashboard)
│   └── projects/[id]/                         # 🔨 NEW
│       ├── page.tsx
│       ├── corpus/
│       ├── research/
│       └── test/
├── components/
│   ├── projects/                              # 🔨 NEW
│   ├── corpus/                                # 🔨 NEW (extend layers/)
│   ├── research/                              # 🔨 NEW
│   ├── recommendations/                       # 🔨 NEW
│   ├── layers/                                # ✅ KEEP
│   └── ui/                                    # ✅ KEEP
├── lib/
│   ├── contextComposer.ts                     # ✅ EXTEND
│   ├── researchOrchestrator.ts                # 🔨 NEW
│   ├── recommendationApplier.ts               # 🔨 NEW
│   ├── knowledgeFileLoader.ts                 # 🔨 NEW
│   ├── corpusAnalyzer.ts                      # 🔨 NEW
│   ├── snapshotManager.ts                     # 🔨 NEW
│   ├── validation.ts                          # ✅ EXTEND
│   └── types.ts                               # ✅ EXTEND
└── prisma/
    └── schema.prisma                          # ✅ EXTEND
```

**Legend:**
- ✅ KEEP - Use as-is or with minor modifications
- 🔨 NEW - Build from scratch
- ✅ EXTEND - Add to existing code

---

## Appendix B: Data Flow Diagrams

### Current Flow (Single Guru)
```
User → Chat UI → /api/chat → contextComposer → OpenAI → Response
                                    ↓
                              Prisma (layers)
```

### Guru Builder Flow (Research Run)
```
User → Research Config UI → /api/research-runs (POST)
                                    ↓
                          researchOrchestrator
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
            performDeepResearch              loadCorpus
                    ↓                               ↓
                OpenAI                         Prisma
            (extended research)            (layers + files)
                    ↓                               ↓
                    └───────────────┬───────────────┘
                                    ↓
                          corpusAnalyzer
                                    ↓
                          generateRecommendations
                                    ↓
                        Save to ResearchRun + Recommendations
                                    ↓
User → Recommendation Review UI → Approve/Reject
                                    ↓
                          recommendationApplier
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
            createSnapshot                  applyChanges
                    ↓                               ↓
                Prisma                          Prisma
            (snapshots)                    (layers/files)
```

---

**End of Scaffold Document**

This scaffold provides a comprehensive map of what exists, what can be reused, and what needs to be built for the guru builder system. The existing backgammon-guru codebase provides an excellent foundation (~40% of required functionality), particularly in database architecture, layer management, and UI components.
