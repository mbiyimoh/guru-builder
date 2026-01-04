# Deep Research to Structured Data Field Update Recommendations

## Technical Reference Document

**Purpose:** This document describes the complete end-to-end architecture for conducting autonomous web research and generating structured recommendations to update data fields. Use this as a reference for implementing similar "research → recommendations → apply" workflows in other projects.

**Adaptation Note:** In Guru Builder, this updates a "knowledge corpus" (ContextLayers + KnowledgeFiles). In your profile enrichment project, this would update sections of a "clarity profile" instead.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Models](#2-data-models)
3. [Frontend Flow](#3-frontend-flow)
4. [API Routes](#4-api-routes)
5. [Background Jobs (Inngest)](#5-background-jobs-inngest)
6. [Core Libraries](#6-core-libraries)
7. [State Management & Polling](#7-state-management--polling)
8. [Workflow Sequence Diagram](#8-workflow-sequence-diagram)
9. [Error Handling](#9-error-handling)
10. [Configuration & Constants](#10-configuration--constants)
11. [Key Files Reference](#11-key-files-reference)
12. [Replication Checklist](#12-replication-checklist)

---

## 1. Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Research Chat    →    Status Polling    →    Recommendations    →   Apply  │
│  (plan research)       (watch progress)       (review/approve)      (commit)│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  POST /research-runs     GET /research-runs/[id]     POST /apply-recommendations │
│  (create & trigger)      (poll status)               (commit changes)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKGROUND JOBS (Inngest)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  research/requested  →  researchJob  →  research/completed  →  recommendationJob │
│  (event)                (execute)        (event)               (generate)     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Tavily API (web search)          OpenAI GPT-4o (synthesis + recommendations) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| Research Orchestrator | Conducts web research | Tavily API + GPT-4o |
| Recommendation Generator | Creates structured update suggestions | GPT-4o + Zod schemas |
| Apply Changes | Atomically commits approved changes | Prisma transactions |
| Status Polling | Real-time progress updates | 5-second intervals |
| Snapshot System | Rollback capability | JSON serialization |

---

## 2. Data Models

### ResearchRun Model

The core entity tracking a research session.

```prisma
model ResearchRun {
  id            String         @id @default(cuid())
  projectId     String
  instructions  String         @db.Text    // Research query/instructions
  depth         ResearchDepth  @default(MODERATE)
  status        ResearchStatus @default(PENDING)
  progressStage String?        // Current stage for UI display

  // Results
  researchData  Json?          // Raw findings from research
  errorMessage  String?        @db.Text

  // Metadata
  startedAt     DateTime?
  completedAt   DateTime?
  executionTime Int?           // milliseconds
  tokensUsed    Int?
  costEstimate  Float?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  recommendations Recommendation[]

  @@index([projectId, status])
}
```

### Recommendation Model

Individual update suggestions generated from research.

```prisma
model Recommendation {
  id            String @id @default(cuid())
  researchRunId String

  // What to do
  action     RecommendationAction  // ADD, EDIT, DELETE
  targetType TargetType            // Which entity type to modify

  // For your profile project: these would be profile section IDs
  contextLayerId  String?          // Target entity ID (polymorphic)
  knowledgeFileId String?

  // Recommendation content
  title       String
  description String @db.Text      // Brief summary
  fullContent String @db.Text      // Complete content to apply
  reasoning   String @db.Text      // Why this matters

  // Quality indicators
  confidence  Float                // 0.0 to 1.0
  impactLevel ImpactLevel          // LOW, MEDIUM, HIGH
  priority    Int                  // Ordering

  // Approval workflow
  status     RecommendationStatus @default(PENDING)
  reviewedAt DateTime?
  appliedAt  DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  researchRun ResearchRun @relation(fields: [researchRunId], references: [id], onDelete: Cascade)

  @@index([researchRunId, status])
}
```

### Enums

```prisma
enum ResearchDepth {
  QUICK       // 1-2 minutes, 5 sources
  MODERATE    // 3-5 minutes, 10 sources
  DEEP        // 5-10 minutes, 20 sources
}

enum ResearchStatus {
  PENDING     // Queued, not started
  RUNNING     // Currently executing
  COMPLETED   // Finished successfully
  FAILED      // Error occurred
  CANCELLED   // User cancelled
}

enum RecommendationAction {
  ADD         // Create new field/section
  EDIT        // Modify existing
  DELETE      // Remove existing
}

enum RecommendationStatus {
  PENDING     // Awaiting review
  APPROVED    // Ready to apply
  REJECTED    // Rejected by user
  APPLIED     // Successfully applied
}

enum ImpactLevel {
  LOW         // Minor improvement
  MEDIUM      // Moderate improvement
  HIGH        // Significant improvement
}
```

### Adaptation for Profile Enrichment

For your profile project, replace corpus-specific models:

```prisma
// Instead of ContextLayer + KnowledgeFile, you'd have:
model ProfileSection {
  id          String @id @default(cuid())
  profileId   String
  sectionKey  String    // e.g., "background", "expertise", "goals"
  title       String
  content     String @db.Text
  confidence  Float?    // How confident AI is in this content

  profile Profile @relation(fields: [profileId], references: [id])
}

// Recommendation would target ProfileSection instead:
model Recommendation {
  // ...same fields...
  profileSectionId String?
  profileSection   ProfileSection? @relation(...)
}
```

---

## 3. Frontend Flow

### Research Initiation

**Component:** `ResearchChatAssistant.tsx`

Interactive chat interface where users describe what they want to research.

```typescript
interface ResearchPlan {
  objective: string;      // Main research goal
  focusAreas: string[];   // Specific topics to investigate
  depth: ResearchDepth;   // How thorough to be
}

// User types: "Research my background in AI and machine learning"
// Assistant generates structured plan
// User confirms → triggers research execution
```

**Key Features:**
- Converts natural language to structured research plan
- Suggests focus areas based on context
- Lets user adjust depth (quick/moderate/deep)

### Status Polling

**Component:** `ResearchStatusPoller.tsx`

Polls backend every 5 seconds while research is running.

```typescript
// Polling logic
const poll = async () => {
  const response = await fetch(`/api/research-runs/${runId}`);
  const data = await response.json();

  if (data.run.status === 'RUNNING') {
    // Update progress UI
    setProgressStage(data.run.progressStage);
    return; // Continue polling
  }

  if (data.run.status === 'COMPLETED') {
    // CRITICAL: Check for recommendations
    if (data.recommendations.total > 0) {
      // Ready to show recommendations
      router.refresh();
      stopPolling();
    } else if (pollCount < 12) {
      // Keep polling (max 60s) - recommendations may still be generating
      return;
    }
  }

  // FAILED or CANCELLED - stop and refresh
  router.refresh();
  stopPolling();
};
```

**Critical Detail:** Don't stop polling on `status === 'COMPLETED'` alone. Must wait for `recommendations.total > 0` because recommendation generation is a separate async job.

### Progress Stages Display

Show users what's happening:

```typescript
const PROGRESS_STAGES = {
  STARTING: 'Starting research...',
  OPTIMIZING_QUERY: 'Optimizing search query...',
  SEARCHING: 'Searching the web for sources...',
  ANALYZING: 'Analyzing source content...',
  SYNTHESIZING: 'Synthesizing research report...',
  SAVING_RESEARCH: 'Saving research findings...',
  GENERATING_RECOMMENDATIONS: 'Generating recommendations...',
  SAVING_RECOMMENDATIONS: 'Saving recommendations...',
  COMPLETE: 'Complete',
};
```

### Recommendations View

**Component:** `RecommendationsView.tsx`

Display recommendations for user review:

```typescript
interface RecommendationCardProps {
  recommendation: {
    id: string;
    action: 'ADD' | 'EDIT' | 'DELETE';
    title: string;
    description: string;
    fullContent: string;
    reasoning: string;
    confidence: number;
    impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  };
  onApprove: () => void;
  onReject: () => void;
}

// For EDIT actions, show diff between current and proposed content
// For ADD, show full proposed content
// For DELETE, show what will be removed
```

**User Actions:**
- **Approve**: Mark recommendation for application
- **Reject**: Dismiss recommendation
- **Apply All Approved**: Commit all approved changes atomically

---

## 4. API Routes

### Create Research Run

```typescript
// POST /api/research-runs
// Request
{
  projectId: string,
  instructions: string,  // "Research my AI expertise and projects"
  depth: "QUICK" | "MODERATE" | "DEEP"
}

// Response (201)
{
  run: ResearchRun,
  message: "Research initiated"
}

// Backend behavior:
// 1. Create ResearchRun with status=PENDING
// 2. Send Inngest event: "research/requested"
// 3. Update status to RUNNING
// 4. Return immediately (research runs in background)
```

### Get Research Run Status

```typescript
// GET /api/research-runs/[id]
// Response
{
  run: {
    id, status, progressStage,
    researchData, // null until complete
    createdAt, completedAt, executionTime
  },
  recommendationStats: {
    total: 5,
    pending: 3,
    approved: 2,
    rejected: 0,
    applied: 0
  }
}

// CRITICAL: Set cache headers
headers: {
  'Cache-Control': 'no-store, no-cache, must-revalidate'
}
```

### Approve/Reject Recommendation

```typescript
// POST /api/recommendations/[id]/approve
// POST /api/recommendations/[id]/reject

// Response (200)
{
  recommendation: { ...updated },
  message: "Recommendation approved/rejected"
}
```

### Apply Recommendations

```typescript
// POST /api/projects/[id]/apply-recommendations
// Request
{
  recommendationIds: string[],
  snapshotName?: string,      // For rollback
  snapshotDescription?: string
}

// Response (200)
{
  success: true,
  snapshotId: string,         // Can rollback to this
  appliedCount: 3,
  changes: {
    added: 1,
    edited: 2,
    deleted: 0
  },
  // Optional: score delta
  readinessScore: {
    overall: 78,
    previousOverall: 65,
    criticalGaps: []
  }
}
```

---

## 5. Background Jobs (Inngest)

### Research Job

Triggered by `research/requested` event.

```typescript
// lib/inngest-functions.ts
export const researchJob = inngest.createFunction(
  {
    id: 'research-job',
    concurrency: { limit: 5 }  // Max parallel research runs
  },
  { event: 'research/requested' },
  async ({ event, step }) => {
    const { researchId } = event.data;

    // Step 1: Check if cancelled
    const run = await step.run('check-cancelled', async () => {
      return prisma.researchRun.findUnique({ where: { id: researchId } });
    });

    if (run.status === 'CANCELLED') {
      return { cancelled: true };
    }

    // Step 2: Execute research
    const result = await step.run('execute-research', async () => {
      return executeResearch({
        instructions: run.instructions,
        depth: run.depth,
        timeout: 600000, // 10 minutes
        onProgress: async (stage) => {
          await updateProgressStage(researchId, stage);
        }
      });
    });

    // Step 3: Save results
    await step.run('save-results', async () => {
      await prisma.researchRun.update({
        where: { id: researchId },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          researchData: result.data,
          errorMessage: result.error?.message,
          completedAt: new Date(),
          executionTime: result.executionTime
        }
      });
    });

    // Step 4: Trigger recommendation generation
    if (result.success) {
      await step.sendEvent('trigger-recommendations', {
        name: 'research/completed',
        data: { researchId, success: true }
      });
    }

    return { researchId, success: result.success };
  }
);
```

### Recommendation Generation Job

Triggered by `research/completed` event.

```typescript
export const recommendationGenerationJob = inngest.createFunction(
  {
    id: 'recommendation-generation',
    concurrency: { limit: 3 }
  },
  { event: 'research/completed' },
  async ({ event, step }) => {
    const { researchId, success } = event.data;

    if (!success) {
      return { skipped: true, reason: 'Research failed' };
    }

    // Step 1: Fetch research run with current data
    const run = await step.run('fetch-data', async () => {
      return prisma.researchRun.findUnique({
        where: { id: researchId },
        include: {
          project: {
            include: {
              // For profiles: include profile sections
              contextLayers: { where: { isActive: true } },
              knowledgeFiles: { where: { isActive: true } }
            }
          }
        }
      });
    });

    // Step 2: Generate recommendations
    const recommendations = await step.run('generate', async () => {
      await updateProgressStage(researchId, 'GENERATING_RECOMMENDATIONS');

      return generateRecommendations({
        researchFindings: run.researchData,
        currentData: run.project.contextLayers, // or profile sections
        instructions: run.instructions
      });
    });

    // Step 3: Filter by confidence threshold
    const MIN_CONFIDENCE = 0.4;
    const filtered = recommendations.filter(r => r.confidence >= MIN_CONFIDENCE);

    // Step 4: Save to database
    await step.run('save-recommendations', async () => {
      await updateProgressStage(researchId, 'SAVING_RECOMMENDATIONS');

      await prisma.recommendation.createMany({
        data: filtered.map((rec, index) => ({
          researchRunId: researchId,
          action: rec.action,
          targetType: rec.targetType,
          targetId: rec.targetId,
          title: rec.title,
          description: rec.description,
          fullContent: rec.fullContent,
          reasoning: rec.reasoning,
          confidence: rec.confidence,
          impactLevel: rec.impactLevel,
          priority: index,
          status: 'PENDING'
        }))
      });

      await updateProgressStage(researchId, 'COMPLETE');
    });

    return {
      researchId,
      recommendationsGenerated: filtered.length
    };
  }
);
```

---

## 6. Core Libraries

### Research Orchestrator

Conducts web research using Tavily API and synthesizes with GPT-4o.

```typescript
// lib/researchOrchestrator.ts

interface ResearchOptions {
  instructions: string;
  depth?: 'QUICK' | 'MODERATE' | 'DEEP';
  timeout?: number;
  onProgress?: (stage: string) => Promise<void>;
}

interface ResearchResult {
  success: boolean;
  data?: ResearchFindings;
  error?: { message: string };
  executionTime?: number;
}

export async function executeResearch(options: ResearchOptions): Promise<ResearchResult> {
  const startTime = Date.now();

  try {
    // 1. Optimize query (Tavily has 400 char limit)
    await options.onProgress?.('OPTIMIZING_QUERY');
    const query = await optimizeQuery(options.instructions);

    // 2. Search with Tavily
    await options.onProgress?.('SEARCHING');
    const searchConfig = getSearchConfig(options.depth);
    const searchResults = await tavily.search({
      query,
      maxResults: searchConfig.maxSources,
      searchDepth: searchConfig.searchDepth,
      includeRawContent: searchConfig.includeRaw
    });

    // 3. Synthesize with GPT-4o
    await options.onProgress?.('SYNTHESIZING');
    const synthesis = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: 'You are a research analyst...' },
        { role: 'user', content: formatSourcesForSynthesis(searchResults) }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    return {
      success: true,
      data: {
        query: options.instructions,
        depth: options.depth,
        summary: synthesis.choices[0].message.content.slice(0, 500),
        fullReport: synthesis.choices[0].message.content,
        sources: searchResults.results,
        sourcesAnalyzed: searchResults.results.length
      },
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: { message: error.message },
      executionTime: Date.now() - startTime
    };
  }
}

// Search configuration by depth
function getSearchConfig(depth: ResearchDepth) {
  switch (depth) {
    case 'QUICK':    return { maxSources: 5,  searchDepth: 'basic',    includeRaw: false };
    case 'MODERATE': return { maxSources: 10, searchDepth: 'basic',    includeRaw: true };
    case 'DEEP':     return { maxSources: 20, searchDepth: 'advanced', includeRaw: true };
  }
}
```

### Recommendation Generator

Generates structured recommendations using GPT-4o with Zod schemas.

```typescript
// lib/recommendationGenerator.ts
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

// Define the output schema
const RecommendationSchema = z.object({
  recommendations: z.array(z.object({
    action: z.enum(['ADD', 'EDIT', 'DELETE']),
    targetType: z.string(),         // e.g., 'PROFILE_SECTION'
    targetId: z.string().nullable(), // null for ADD
    title: z.string(),
    description: z.string(),
    fullContent: z.string(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
    impactLevel: z.enum(['LOW', 'MEDIUM', 'HIGH'])
  })),
  noRecommendationsReason: z.string().nullable().optional()
});

export async function generateRecommendations(options: {
  researchFindings: ResearchFindings;
  currentData: any[];  // Current profile sections or corpus items
  instructions: string;
}): Promise<Recommendation[]> {

  const prompt = buildPrompt(options);

  const response = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    response_format: zodResponseFormat(RecommendationSchema, 'recommendations')
  });

  const parsed = response.choices[0].message.parsed;
  return parsed.recommendations;
}

const SYSTEM_PROMPT = `You are an expert at analyzing research findings and generating
specific, actionable recommendations for improving user profiles.

For each recommendation:
- action: ADD (new section), EDIT (improve existing), DELETE (remove outdated)
- targetId: existing section ID for EDIT/DELETE, null for ADD
- fullContent: complete, ready-to-use content (not a summary)
- confidence: 0.0-1.0 based on evidence strength
- impactLevel: LOW/MEDIUM/HIGH based on importance

Only suggest changes with strong evidence from the research.`;
```

### Apply Recommendations

Atomically applies approved recommendations with snapshot backup.

```typescript
// lib/applyRecommendations.ts

export async function applyRecommendations(options: {
  projectId: string;
  recommendationIds: string[];
  snapshotName?: string;
}): Promise<ApplyResult> {

  // 1. Fetch approved recommendations
  const recommendations = await prisma.recommendation.findMany({
    where: {
      id: { in: options.recommendationIds },
      status: 'APPROVED'
    }
  });

  // 2. Create snapshot for rollback
  const snapshot = await createSnapshot(options.projectId, options.snapshotName);

  // 3. Apply in transaction (all-or-nothing)
  const changes = { added: 0, edited: 0, deleted: 0 };

  await prisma.$transaction(async (tx) => {
    for (const rec of recommendations) {
      switch (rec.action) {
        case 'ADD':
          await tx.profileSection.create({
            data: {
              profileId: options.projectId,
              sectionKey: rec.targetType,
              title: rec.title,
              content: rec.fullContent
            }
          });
          changes.added++;
          break;

        case 'EDIT':
          await tx.profileSection.update({
            where: { id: rec.targetId },
            data: {
              title: rec.title,
              content: rec.fullContent
            }
          });
          changes.edited++;
          break;

        case 'DELETE':
          await tx.profileSection.delete({
            where: { id: rec.targetId }
          });
          changes.deleted++;
          break;
      }

      // Mark recommendation as applied
      await tx.recommendation.update({
        where: { id: rec.id },
        data: { status: 'APPLIED', appliedAt: new Date() }
      });
    }
  });

  return {
    success: true,
    snapshotId: snapshot.id,
    appliedCount: recommendations.length,
    changes
  };
}
```

---

## 7. State Management & Polling

### Polling Pattern

```typescript
// Frontend polling hook
function useResearchPolling(runId: string) {
  const [status, setStatus] = useState<ResearchStatus>('PENDING');
  const [progressStage, setProgressStage] = useState<string>('');
  const [pollCount, setPollCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (status !== 'RUNNING') return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/research-runs/${runId}`, {
        cache: 'no-store'
      });
      const data = await res.json();

      setStatus(data.run.status);
      setProgressStage(data.run.progressStage);

      // Stop conditions
      if (data.run.status === 'COMPLETED' && data.recommendations.total > 0) {
        clearInterval(interval);
        router.refresh();
      } else if (['FAILED', 'CANCELLED'].includes(data.run.status)) {
        clearInterval(interval);
        router.refresh();
      } else if (pollCount >= 12) {  // 60 second timeout
        clearInterval(interval);
        router.refresh();
      }

      setPollCount(c => c + 1);
    }, 5000);  // 5 second interval

    return () => clearInterval(interval);
  }, [runId, status, pollCount]);

  return { status, progressStage };
}
```

### Cache Control

Critical for polling to work correctly:

```typescript
// API route
export async function GET(request: Request) {
  // ... fetch data ...

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

// Page component
export const dynamic = 'force-dynamic';  // Disable static generation
```

---

## 8. Workflow Sequence Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                USER FLOW                                      │
└──────────────────────────────────────────────────────────────────────────────┘

User: "Research my AI background"
         │
         ▼
┌─────────────────┐
│ Research Chat   │ ──→ Generate structured plan
│ Assistant       │     (objective, focus areas, depth)
└─────────────────┘
         │
         ▼ User confirms
┌─────────────────┐     ┌─────────────────┐
│ POST            │ ──→ │ Create          │ ──→ status: PENDING
│ /research-runs  │     │ ResearchRun     │
└─────────────────┘     └─────────────────┘
         │
         ▼ Send Inngest event
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKGROUND PROCESSING                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ research/       │
│ requested       │ (Inngest event)
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Research Job    │ ──→ │ Tavily Search   │ ──→ │ GPT-4o          │
│ (Inngest)       │     │ (5-20 sources)  │     │ Synthesis       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼ Save results, status: COMPLETED
┌─────────────────┐
│ research/       │
│ completed       │ (Inngest event)
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Recommendation  │ ──→ │ GPT-4o          │ ──→ │ Save            │
│ Job (Inngest)   │     │ (structured)    │     │ Recommendations │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         │ progressStage: COMPLETE
         │
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND POLLING                                 │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼ Poll detects: status=COMPLETED && recommendations.total > 0
┌─────────────────┐
│ Recommendations │ ──→ Show recommendation cards
│ View            │     (action, content, reasoning, confidence)
└─────────────────┘
         │
         ▼ User reviews each
┌─────────────────┐     ┌─────────────────┐
│ Approve/Reject  │ ──→ │ Update          │
│ buttons         │     │ status          │
└─────────────────┘     └─────────────────┘
         │
         ▼ User clicks "Apply Approved"
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ POST /apply-    │ ──→ │ Create          │ ──→ │ Transaction:    │
│ recommendations │     │ Snapshot        │     │ Apply changes   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Show success    │ ──→ Score improvement, applied count
│ banner          │
└─────────────────┘
```

---

## 9. Error Handling

### Research Errors

```typescript
// Timeout handling
const TIMEOUTS = {
  TOTAL: 600000,      // 10 minutes total
  SEARCH: 100000,     // 100 seconds for Tavily
  SYNTHESIS: 150000   // 150 seconds for GPT-4o
};

// Cancellation check
async function checkCancellation(researchId: string): Promise<boolean> {
  const run = await prisma.researchRun.findUnique({
    where: { id: researchId },
    select: { status: true }
  });
  return run?.status === 'CANCELLED';
}

// Usage in job
if (await checkCancellation(researchId)) {
  return { cancelled: true };
}
```

### Frontend Error States

```typescript
// Error types for UI feedback
type ErrorType = 'network' | 'api' | 'timeout' | 'cancelled';

function getErrorMessage(type: ErrorType): string {
  switch (type) {
    case 'network':   return 'Network error. Please check your connection.';
    case 'api':       return 'Server error. Please try again.';
    case 'timeout':   return 'Research took too long. Try a smaller scope.';
    case 'cancelled': return 'Research was cancelled.';
  }
}
```

---

## 10. Configuration & Constants

```typescript
// lib/constants.ts

// Model configuration
export const RESEARCH_MODEL = 'gpt-4o-2024-08-06';

// Confidence threshold for recommendations
export const MIN_RECOMMENDATION_CONFIDENCE = 0.4;

// Timeouts (milliseconds)
export const TIMEOUTS = {
  RESEARCH_TOTAL: 600000,     // 10 minutes
  TAVILY_SEARCH: 100000,      // 100 seconds
  GPT_SYNTHESIS: 150000,      // 150 seconds
  POLLING_INTERVAL: 5000,     // 5 seconds
  POLLING_MAX: 60000,         // 60 seconds max
};

// Research depth configurations
export const DEPTH_CONFIG = {
  QUICK:    { maxSources: 5,  searchDepth: 'basic',    timeout: 120000 },
  MODERATE: { maxSources: 10, searchDepth: 'basic',    timeout: 300000 },
  DEEP:     { maxSources: 20, searchDepth: 'advanced', timeout: 600000 },
};

// Progress stages
export const PROGRESS_STAGES = {
  STARTING: 'Starting research...',
  OPTIMIZING_QUERY: 'Optimizing search query...',
  SEARCHING: 'Searching the web...',
  ANALYZING: 'Analyzing sources...',
  SYNTHESIZING: 'Synthesizing findings...',
  GENERATING_RECOMMENDATIONS: 'Generating recommendations...',
  SAVING: 'Saving results...',
  COMPLETE: 'Complete',
};
```

---

## 11. Key Files Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Data models |
| `lib/researchOrchestrator.ts` | Web research execution |
| `lib/recommendationGenerator.ts` | GPT-4o recommendation generation |
| `lib/applyRecommendations.ts` | Atomic change application |
| `lib/inngest-functions.ts` | Background job definitions |
| `app/api/research-runs/route.ts` | Create/list research |
| `app/api/research-runs/[id]/route.ts` | Get/cancel research |
| `app/api/recommendations/[id]/approve/route.ts` | Approve recommendation |
| `app/api/recommendations/[id]/reject/route.ts` | Reject recommendation |
| `app/api/projects/[id]/apply-recommendations/route.ts` | Apply changes |
| `components/research/ResearchStatusPoller.tsx` | Polling component |
| `components/research/RecommendationsView.tsx` | Recommendation UI |

---

## 12. Replication Checklist

To implement this in your profile enrichment project:

### Data Layer
- [ ] Create `ResearchRun` model
- [ ] Create `Recommendation` model
- [ ] Create `ProfileSection` model (or equivalent target)
- [ ] Create `Snapshot` model for rollback
- [ ] Define all enums

### API Layer
- [ ] `POST /api/research-runs` - Create and trigger
- [ ] `GET /api/research-runs/[id]` - Status polling
- [ ] `DELETE /api/research-runs/[id]` - Cancellation
- [ ] `POST /api/recommendations/[id]/approve`
- [ ] `POST /api/recommendations/[id]/reject`
- [ ] `POST /api/profiles/[id]/apply-recommendations`

### Background Jobs
- [ ] Install Inngest
- [ ] Create `researchJob` function
- [ ] Create `recommendationGenerationJob` function
- [ ] Configure concurrency limits
- [ ] Set up event triggers

### Core Libraries
- [ ] Research orchestrator (Tavily + GPT-4o)
- [ ] Recommendation generator (Zod + structured outputs)
- [ ] Apply changes (Prisma transactions)
- [ ] Snapshot creation

### Frontend
- [ ] Research initiation UI
- [ ] Status polling component
- [ ] Progress stage display
- [ ] Recommendations view
- [ ] Approve/reject buttons
- [ ] Apply button with confirmation

### External Services
- [ ] Tavily API key
- [ ] OpenAI API key
- [ ] Inngest setup

---

## Adaptation Notes for Profile Enrichment

### Key Differences

| Guru Builder | Profile Enrichment |
|--------------|-------------------|
| Updates ContextLayers + KnowledgeFiles | Updates ProfileSections |
| Corpus recommendation prompt | Profile improvement prompt |
| Research external topics | Research user's own work/background |
| Multiple target types (LAYER, FILE) | Single target type (SECTION) |

### Prompt Adaptation

Change the system prompt to focus on profile improvement:

```typescript
const PROFILE_SYSTEM_PROMPT = `You are an expert at analyzing research findings
and generating specific, actionable recommendations for improving user profiles.

Given research about a person's background, expertise, and projects, suggest:
- ADD: New profile sections that should exist
- EDIT: Improvements to existing sections with better/updated content
- DELETE: Outdated or redundant sections

Focus on:
- Clarity and specificity
- Quantifiable achievements
- Skills and expertise areas
- Project highlights
- Professional narrative coherence`;
```

### Research Direction

Instead of researching external topics, research the user:

```typescript
// Example research queries for profile enrichment
const queries = [
  "LinkedIn profile [user name]",
  "[user name] recent projects",
  "[user name] publications papers",
  "[company name] achievements",
  "[user name] speaking engagements"
];
```

---

*Document generated from Guru Builder codebase analysis. Adapt models, prompts, and UI to your specific profile enrichment use case.*
