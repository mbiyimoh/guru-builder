# Feature Specification: Guru Teaching Functions

## 1. Status

**Draft** - Ready for Review

## 2. Authors

Claude Code - December 4, 2025

## 3. Overview

Implement three core LLM-powered functions that any guru can perform using their corpus to generate teaching artifacts. These functions build sequentially (Mental Model → Curriculum → Drills) and enable any domain guru to automatically produce principle-based educational content following progressive disclosure pedagogy.

---

## 4. Background/Problem Statement

### The Problem

Currently, Guru Builder allows users to create knowledge corpora (context layers + knowledge files) but provides no way to automatically generate structured teaching materials from that knowledge. Users must manually create:

1. **Mental models** - How to organize the domain conceptually
2. **Curricula** - How to sequence and teach concepts
3. **Practice drills** - How to reinforce learning

This is time-consuming and requires pedagogical expertise most users lack.

### The Opportunity

By leveraging GPT-4o with carefully crafted system prompts, we can automatically generate high-quality teaching artifacts that:

1. Follow principle-based teaching (Schema Theory)
2. Implement progressive disclosure (2-3 lines max initially)
3. Create actionable mental models (2-5 categories, 2-3 principles each)
4. Design tiered practice drills (Recognition → Application → Transfer)

### User POV (from teaching-POVs.md)

> "I want our content and explanation experience to be heavily rooted in principles, so that the next time the person sees a situation like this, instead of thinking about what the specific right play is, they think about the one or two principles that we emphasized."

---

## 5. Goals

- **Primary**: Any guru can generate structured teaching artifacts from their corpus
- Three functions that build sequentially: Mental Model → Curriculum → Drills
- Rich, pedagogically-grounded system prompts that produce high-quality output
- Artifacts stored as both JSON (structured) and Markdown (human-readable)
- Version tracking with all versions preserved (v1, v2, v3...)
- Staleness detection when corpus changes after generation
- Modal preview of corpus before generation

## 6. Non-Goals

- User-facing drill execution UI (separate feature)
- Real-time collaborative editing of generated artifacts
- Multi-language curriculum generation
- Voice/audio learning content
- A/B testing of prompts (future enhancement)
- Parallel function execution (strictly sequential)

---

## 7. Technical Dependencies

### Existing Stack
- **Vercel AI SDK v5** - OpenAI integration
- **GPT-4o** - LLM for structured outputs
- **Inngest** - Background job execution
- **Prisma ORM** - Database models
- **Zod** - Schema validation
- **Next.js 15** - API routes and UI

### Key Patterns to Reuse
- `lib/corpusRecommendationGenerator.ts` - GPT-4o structured output pattern
- `lib/inngest-functions.ts` - Job chaining via events
- `lib/assessment/contextComposer.ts` - Corpus → system prompt composition
- `lib/validation.ts` - Zod schema patterns

---

## 8. Detailed Design

### 8.1 Architecture Overview

```
Project Corpus (Context Layers + Knowledge Files)
        │
        ▼
┌─────────────────────────────────────────────────┐
│           Guru Teaching Functions               │
├─────────────────────────────────────────────────┤
│  ┌─────────────────┐                            │
│  │ Function 1:     │ ──▶ GuruArtifact           │
│  │ Mental Model    │     (MENTAL_MODEL)         │
│  │ Generator       │                            │
│  └────────┬────────┘                            │
│           │ (required input for next)           │
│           ▼                                     │
│  ┌─────────────────┐                            │
│  │ Function 2:     │ ──▶ GuruArtifact           │
│  │ Curriculum      │     (CURRICULUM)           │
│  │ Generator       │                            │
│  └────────┬────────┘                            │
│           │ (required input for next)           │
│           ▼                                     │
│  ┌─────────────────┐                            │
│  │ Function 3:     │ ──▶ GuruArtifact           │
│  │ Drill           │     (DRILL_SERIES)         │
│  │ Designer        │     + Markdown w/ ASCII    │
│  └─────────────────┘                            │
└─────────────────────────────────────────────────┘
```

### 8.2 Database Schema

```prisma
// NEW: Generated teaching artifact
model GuruArtifact {
  id          String           @id @default(cuid())
  projectId   String

  type        GuruArtifactType
  version     Int              @default(1)

  // Structured content (JSON)
  content     Json

  // Human-readable version (Markdown with ASCII wireframes for drills)
  markdownContent String?      @db.Text

  // Generation metadata
  promptVersion   String?      // Track which prompt version was used
  corpusHash      String?      // Hash of corpus state when generated
  generatedAt     DateTime     @default(now())

  // For tracking dependencies
  dependsOnArtifactId String?  // ID of artifact this one builds on

  // Status tracking
  status      ArtifactStatus   @default(COMPLETED)

  // Relations
  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  dependsOn   GuruArtifact?    @relation("ArtifactDependency", fields: [dependsOnArtifactId], references: [id])
  dependents  GuruArtifact[]   @relation("ArtifactDependency")

  @@index([projectId, type])
  @@index([projectId, type, version])
  @@index([generatedAt])
}

enum GuruArtifactType {
  MENTAL_MODEL
  CURRICULUM
  DRILL_SERIES
}

enum ArtifactStatus {
  GENERATING
  COMPLETED
  FAILED
}

// Update Project model
model Project {
  // ... existing fields ...

  // ADD:
  guruArtifacts   GuruArtifact[]

  // ... existing relations ...
}
```

### 8.3 File Structure

```
lib/guruFunctions/
├── index.ts                    # Exports all functions
├── types.ts                    # TypeScript types for all artifacts
├── corpusHasher.ts             # Generate hash of corpus state
│
├── prompts/
│   ├── mentalModelPrompt.ts    # Function 1 system prompt
│   ├── curriculumPrompt.ts     # Function 2 system prompt
│   ├── drillDesignerPrompt.ts  # Function 3 system prompt
│   └── shared/
│       ├── pedagogyPrinciples.ts    # Common teaching principles
│       └── progressiveDisclosure.ts  # Disclosure rules
│
├── generators/
│   ├── mentalModelGenerator.ts  # Function 1 implementation
│   ├── curriculumGenerator.ts   # Function 2 implementation
│   └── drillDesigner.ts         # Function 3 implementation
│
├── schemas/
│   ├── mentalModelSchema.ts     # Zod schema for output
│   ├── curriculumSchema.ts      # Zod schema for output
│   └── drillSeriesSchema.ts     # Zod schema for output
│
└── renderers/
    ├── mentalModelMarkdown.ts   # Convert JSON → Markdown
    ├── curriculumMarkdown.ts    # Convert JSON → Markdown
    └── drillSeriesMarkdown.ts   # Convert JSON → Markdown with ASCII wireframes
```

### 8.4 Output Schemas

#### Mental Model Output Schema

```typescript
// lib/guruFunctions/schemas/mentalModelSchema.ts

export const mentalModelSchema = z.object({
  domainTitle: z.string(),
  teachingApproach: z.string(),
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    mentalModelMetaphor: z.string().nullable().optional(),
    principles: z.array(z.object({
      id: z.string(),
      name: z.string(),
      essence: z.string(),
      whyItMatters: z.string(),
      commonMistake: z.string(),
      recognitionPattern: z.string(),
    })),
    orderInLearningPath: z.number(),
  })),
  principleConnections: z.array(z.object({
    fromPrinciple: z.string(),
    toPrinciple: z.string(),
    relationship: z.string(),
  })),
  masterySummary: z.string(),
});

export type MentalModelOutput = z.infer<typeof mentalModelSchema>;
```

#### Curriculum Output Schema

```typescript
// lib/guruFunctions/schemas/curriculumSchema.ts

export const curriculumSchema = z.object({
  curriculumTitle: z.string(),
  targetAudience: z.string(),
  estimatedDuration: z.string(),
  modules: z.array(z.object({
    moduleId: z.string(),
    categoryId: z.string(),
    title: z.string(),
    subtitle: z.string(),
    learningObjectives: z.array(z.string()),
    prerequisites: z.array(z.string()),
    lessons: z.array(z.object({
      lessonId: z.string(),
      principleId: z.string(),
      type: z.enum(['CONCEPT', 'EXAMPLE', 'CONTRAST', 'PRACTICE']),
      title: z.string(),
      content: z.object({
        headline: z.string(),
        essence: z.string(),
        expandedContent: z.string(),
      }),
      metadata: z.object({
        difficultyTier: z.enum(['FOUNDATION', 'EXPANSION', 'MASTERY']),
        estimatedMinutes: z.number(),
      }),
    })),
  })),
  learningPath: z.object({
    recommended: z.array(z.string()),
    alternatives: z.array(z.object({
      name: z.string(),
      modules: z.array(z.string()),
      description: z.string(),
    })),
  }),
});

export type CurriculumOutput = z.infer<typeof curriculumSchema>;
```

#### Drill Series Output Schema

```typescript
// lib/guruFunctions/schemas/drillSeriesSchema.ts

export const drillSeriesSchema = z.object({
  drillSeriesTitle: z.string(),
  targetPrinciples: z.array(z.string()),
  totalDrills: z.number(),
  estimatedCompletionMinutes: z.number(),
  series: z.array(z.object({
    seriesId: z.string(),
    principleId: z.string(),
    principleName: z.string(),
    seriesDescription: z.string(),
    drills: z.array(z.object({
      drillId: z.string(),
      tier: z.enum(['RECOGNITION', 'APPLICATION', 'TRANSFER']),
      scenario: z.object({
        setup: z.string(),
        visual: z.string().nullable().optional(),
        question: z.string(),
      }),
      options: z.array(z.object({
        id: z.string(),
        text: z.string(),
        isCorrect: z.boolean(),
        commonMistake: z.string().nullable().optional(),
      })),
      correctAnswer: z.string(),
      feedback: z.object({
        correct: z.object({
          brief: z.string(),
          principleReinforcement: z.string(),
          expanded: z.string().nullable().optional(),
        }),
        incorrect: z.object({
          brief: z.string(),
          principleReminder: z.string(),
          commonMistakeAddress: z.string(),
          tryAgainHint: z.string(),
        }),
      }),
      // ASCII wireframe for UI preview
      asciiWireframe: z.string().nullable().optional(),
      metadata: z.object({
        estimatedSeconds: z.number(),
        prerequisiteDrills: z.array(z.string()),
        tags: z.array(z.string()),
      }),
    })),
  })),
  practiceSequences: z.array(z.object({
    name: z.string(),
    description: z.string(),
    drillIds: z.array(z.string()),
  })),
});

export type DrillSeriesOutput = z.infer<typeof drillSeriesSchema>;
```

### 8.5 Generator Implementation Pattern

```typescript
// lib/guruFunctions/generators/mentalModelGenerator.ts

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { mentalModelSchema, type MentalModelOutput } from "../schemas/mentalModelSchema";
import { buildMentalModelPrompt } from "../prompts/mentalModelPrompt";
import { composeCorpusSummary } from "../../contextComposer";

// Lazy-loaded OpenAI client (matches existing pattern)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface GenerateMentalModelOptions {
  projectId: string;
  contextLayers: { title: string; content: string }[];
  knowledgeFiles: { title: string; content: string }[];
  domain: string;
}

export async function generateMentalModel(
  options: GenerateMentalModelOptions
): Promise<MentalModelOutput> {
  const { contextLayers, knowledgeFiles, domain } = options;

  // Compose corpus summary
  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles);
  const corpusWordCount = corpusSummary.split(/\s+/).length;

  // Build system prompt
  const systemPrompt = buildMentalModelPrompt({
    domain,
    corpusSummary,
    corpusWordCount,
  });

  console.log(`[Mental Model Generator] Starting for domain: ${domain}`);
  console.log(`[Mental Model Generator] Corpus: ${corpusWordCount} words`);

  const response = await getOpenAI().beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the mental model based on the corpus provided." },
    ],
    response_format: zodResponseFormat(mentalModelSchema, "mental_model"),
  });

  const result = response.choices[0].message.parsed;
  if (!result) {
    throw new Error("Failed to parse mental model response");
  }

  console.log(`[Mental Model Generator] Generated ${result.categories.length} categories`);

  return result;
}
```

### 8.6 Inngest Job Definitions

```typescript
// lib/inngest-functions.ts (additions)

/**
 * Mental Model generation job
 */
export const mentalModelGenerationJob = inngest.createFunction(
  {
    id: "mental-model-generation",
    name: "Generate Mental Model",
    concurrency: { limit: 3 },
  },
  { event: "guru/generate-mental-model" },
  async ({ event, step }) => {
    const { projectId, artifactId } = event.data;

    // Fetch project with corpus
    const project = await step.run("fetch-project", async () => {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: "asc" } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Generate mental model
    const result = await step.run("generate-mental-model", async () => {
      return await generateMentalModel({
        projectId,
        contextLayers: project.contextLayers.map(l => ({ title: l.title, content: l.content })),
        knowledgeFiles: project.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
        domain: project.name,
      });
    });

    // Generate Markdown version
    const markdown = await step.run("generate-markdown", async () => {
      return renderMentalModelMarkdown(result);
    });

    // Compute corpus hash for staleness detection
    const corpusHash = await step.run("compute-corpus-hash", async () => {
      return computeCorpusHash(project.contextLayers, project.knowledgeFiles);
    });

    // Save artifact
    await step.run("save-artifact", async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result as Prisma.JsonObject,
          markdownContent: markdown,
          corpusHash,
          status: "COMPLETED",
        },
      });
    });

    return { artifactId, success: true };
  }
);

/**
 * Curriculum generation job (requires mental model)
 */
export const curriculumGenerationJob = inngest.createFunction(
  {
    id: "curriculum-generation",
    name: "Generate Curriculum",
    concurrency: { limit: 3 },
  },
  { event: "guru/generate-curriculum" },
  async ({ event, step }) => {
    const { projectId, artifactId, mentalModelArtifactId } = event.data;

    // Fetch mental model artifact
    const mentalModelArtifact = await step.run("fetch-mental-model", async () => {
      return await prisma.guruArtifact.findUnique({
        where: { id: mentalModelArtifactId },
      });
    });

    if (!mentalModelArtifact || mentalModelArtifact.status !== "COMPLETED") {
      throw new Error("Mental model artifact not found or not completed");
    }

    const mentalModel = mentalModelArtifact.content as MentalModelOutput;

    // Fetch project corpus
    const project = await step.run("fetch-project", async () => {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: "asc" } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    // Generate curriculum
    const result = await step.run("generate-curriculum", async () => {
      return await generateCurriculum({
        projectId,
        mentalModel,
        contextLayers: project!.contextLayers.map(l => ({ title: l.title, content: l.content })),
        knowledgeFiles: project!.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
        domain: project!.name,
      });
    });

    // Generate Markdown and save
    const markdown = await step.run("generate-markdown", async () => {
      return renderCurriculumMarkdown(result);
    });

    const corpusHash = computeCorpusHash(project!.contextLayers, project!.knowledgeFiles);

    await step.run("save-artifact", async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result as Prisma.JsonObject,
          markdownContent: markdown,
          corpusHash,
          dependsOnArtifactId: mentalModelArtifactId,
          status: "COMPLETED",
        },
      });
    });

    return { artifactId, success: true };
  }
);

/**
 * Drill series generation job (requires curriculum + mental model)
 */
export const drillSeriesGenerationJob = inngest.createFunction(
  {
    id: "drill-series-generation",
    name: "Generate Drill Series",
    concurrency: { limit: 3 },
  },
  { event: "guru/generate-drill-series" },
  async ({ event, step }) => {
    const { projectId, artifactId, curriculumArtifactId, mentalModelArtifactId } = event.data;

    // Fetch both prerequisite artifacts
    const [mentalModelArtifact, curriculumArtifact] = await step.run("fetch-prerequisites", async () => {
      return await Promise.all([
        prisma.guruArtifact.findUnique({ where: { id: mentalModelArtifactId } }),
        prisma.guruArtifact.findUnique({ where: { id: curriculumArtifactId } }),
      ]);
    });

    if (!mentalModelArtifact || !curriculumArtifact) {
      throw new Error("Required artifacts not found");
    }

    const mentalModel = mentalModelArtifact.content as MentalModelOutput;
    const curriculum = curriculumArtifact.content as CurriculumOutput;

    // Fetch project corpus
    const project = await step.run("fetch-project", async () => {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: "asc" } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    // Generate drill series
    const result = await step.run("generate-drills", async () => {
      return await generateDrillSeries({
        projectId,
        mentalModel,
        curriculum,
        contextLayers: project!.contextLayers.map(l => ({ title: l.title, content: l.content })),
        knowledgeFiles: project!.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
        domain: project!.name,
      });
    });

    // Generate Markdown with ASCII wireframes
    const markdown = await step.run("generate-markdown", async () => {
      return renderDrillSeriesMarkdown(result);
    });

    const corpusHash = computeCorpusHash(project!.contextLayers, project!.knowledgeFiles);

    await step.run("save-artifact", async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result as Prisma.JsonObject,
          markdownContent: markdown,
          corpusHash,
          dependsOnArtifactId: curriculumArtifactId,
          status: "COMPLETED",
        },
      });
    });

    return { artifactId, success: true };
  }
);
```

### 8.7 API Routes

```typescript
// app/api/projects/[id]/guru-functions/mental-model/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireProjectOwnership } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest";
import { computeCorpusHash } from "@/lib/guruFunctions/corpusHasher";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const project = await requireProjectOwnership(projectId);

  // Check if mental model already exists
  const existingArtifact = await prisma.guruArtifact.findFirst({
    where: { projectId, type: "MENTAL_MODEL" },
    orderBy: { version: "desc" },
  });

  // Calculate next version
  const nextVersion = existingArtifact ? existingArtifact.version + 1 : 1;

  // Create artifact placeholder
  const artifact = await prisma.guruArtifact.create({
    data: {
      projectId,
      type: "MENTAL_MODEL",
      version: nextVersion,
      content: {},
      status: "GENERATING",
    },
  });

  // Trigger background generation
  await inngest.send({
    name: "guru/generate-mental-model",
    data: {
      projectId,
      artifactId: artifact.id,
    },
  });

  return NextResponse.json({
    artifactId: artifact.id,
    version: nextVersion,
    status: "GENERATING",
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  await requireProjectOwnership(projectId);

  // Get all mental model versions
  const artifacts = await prisma.guruArtifact.findMany({
    where: { projectId, type: "MENTAL_MODEL" },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      generatedAt: true,
      corpusHash: true,
    },
  });

  // Check staleness against current corpus
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      contextLayers: { where: { isActive: true } },
      knowledgeFiles: { where: { isActive: true } },
    },
  });

  const currentCorpusHash = computeCorpusHash(
    project!.contextLayers,
    project!.knowledgeFiles
  );

  const latestArtifact = artifacts[0];
  const isStale = latestArtifact?.corpusHash !== currentCorpusHash;

  return NextResponse.json({
    artifacts,
    isStale,
    currentCorpusHash,
  });
}
```

### 8.8 Corpus Preview Modal

Before generating, show user a modal with corpus summary:

```typescript
// components/guruFunctions/CorpusPreviewModal.tsx

interface CorpusPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contextLayers: { title: string; wordCount: number }[];
  knowledgeFiles: { title: string; wordCount: number }[];
  totalWordCount: number;
  estimatedTime: string;
}

export function CorpusPreviewModal({
  open,
  onClose,
  onConfirm,
  contextLayers,
  knowledgeFiles,
  totalWordCount,
  estimatedTime,
}: CorpusPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Corpus Before Generation</DialogTitle>
          <DialogDescription>
            The following knowledge will be used to generate your teaching materials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Context Layers ({contextLayers.length})</h4>
            <ul className="text-sm text-gray-600">
              {contextLayers.map(layer => (
                <li key={layer.title}>• {layer.title} ({layer.wordCount} words)</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Knowledge Files ({knowledgeFiles.length})</h4>
            <ul className="text-sm text-gray-600">
              {knowledgeFiles.map(file => (
                <li key={file.title}>• {file.title} ({file.wordCount} words)</li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm"><strong>Total:</strong> {totalWordCount} words</p>
            <p className="text-sm"><strong>Estimated time:</strong> {estimatedTime}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 8.9 Staleness Detection

```typescript
// lib/guruFunctions/corpusHasher.ts

import crypto from "crypto";

interface CorpusItem {
  id?: string;
  title: string;
  content: string;
}

/**
 * Compute a hash of the corpus state for staleness detection.
 * Changes to layer/file content or order will produce a different hash.
 */
export function computeCorpusHash(
  contextLayers: CorpusItem[],
  knowledgeFiles: CorpusItem[]
): string {
  const data = {
    layers: contextLayers.map(l => ({ title: l.title, content: l.content })),
    files: knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 16); // Short hash is sufficient
}
```

### 8.10 Staleness Warning UI

```typescript
// components/guruFunctions/StalenessWarning.tsx

interface StalenessWarningProps {
  artifactType: "mental model" | "curriculum" | "drills";
  onRegenerate: () => void;
}

export function StalenessWarning({ artifactType, onRegenerate }: StalenessWarningProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-amber-800">
          Your corpus has changed since this {artifactType} was generated.
          The content may be outdated.
        </p>
        <button
          onClick={onRegenerate}
          className="text-sm text-amber-700 hover:text-amber-900 font-medium mt-2"
        >
          Regenerate with current corpus →
        </button>
      </div>
    </div>
  );
}
```

---

## 9. System Prompts (Critical)

The system prompts are the most important part of this feature. They determine the quality of generated output.

### 9.1 Mental Model Prompt

See ideation document section 8 for the full prompt. Key elements:

- **Role definition**: "Expert Instructional Designer & Mental Model Architect"
- **Philosophy injection**: Schema Theory, principle-based learning
- **Constraints**: 2-5 categories, 2-3 principles per category
- **Output structure**: Detailed JSON schema

### 9.2 Curriculum Prompt

Key elements:

- **Cardinal rule**: Progressive disclosure (2-3 lines max initially)
- **Mental model reference**: Uses output from Function 1
- **Lesson types**: CONCEPT, EXAMPLE, CONTRAST, PRACTICE for each principle
- **Quality checklist**: Enforces constraints before output

### 9.3 Drill Designer Prompt

Key elements:

- **Deliberate practice philosophy**: Targeted, diagnostic, corrective, progressive
- **Difficulty tiers**: RECOGNITION → APPLICATION → TRANSFER
- **Principle-first feedback**: Wrong answers explained via principles
- **ASCII wireframes**: Visual mockups of drill UI

---

## 10. User Experience

### Flow 1: First-time Generation

1. User navigates to project → Teaching tab
2. Sees empty state: "Generate teaching materials from your corpus"
3. Clicks "Generate Mental Model"
4. **Corpus Preview Modal** shows what will be used
5. Confirms → Loading state with progress
6. Mental model displays with "Generate Curriculum" now available
7. Repeats for Curriculum → Drills

### Flow 2: Regeneration (Notes Option)

1. User has existing mental model
2. Clicks "Regenerate" button
3. Modal asks: "Add notes for the AI?" (optional textarea)
4. User adds: "Focus more on opening strategies"
5. Generates new version (v2) with notes included in prompt
6. Both versions available in version selector

### Flow 3: Staleness Warning

1. User modifies corpus (adds/edits layer)
2. Returns to Teaching tab
3. Sees warning banner: "Your corpus has changed since this was generated"
4. Can click "Regenerate" or dismiss and continue with current version

---

## 11. Testing Strategy

### Unit Tests

```typescript
// lib/guruFunctions/__tests__/mentalModelGenerator.test.ts

describe('Mental Model Generator', () => {
  it('should generate valid mental model from corpus', async () => {
    const result = await generateMentalModel({
      projectId: 'test-project',
      contextLayers: [{ title: 'Basics', content: 'Backgammon fundamentals...' }],
      knowledgeFiles: [],
      domain: 'Backgammon',
    });

    expect(result.categories.length).toBeGreaterThanOrEqual(2);
    expect(result.categories.length).toBeLessThanOrEqual(5);
    result.categories.forEach(cat => {
      expect(cat.principles.length).toBeGreaterThanOrEqual(2);
      expect(cat.principles.length).toBeLessThanOrEqual(3);
    });
  });

  it('should throw error for empty corpus', async () => {
    await expect(generateMentalModel({
      projectId: 'test-project',
      contextLayers: [],
      knowledgeFiles: [],
      domain: 'Empty',
    })).rejects.toThrow('Corpus is empty');
  });
});
```

### Integration Tests

```typescript
// lib/guruFunctions/__tests__/generationFlow.test.ts

describe('Guru Function Flow', () => {
  it('should enforce sequential execution order', async () => {
    // Attempt to generate curriculum without mental model
    const response = await fetch('/api/projects/test/guru-functions/curriculum', {
      method: 'POST',
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('Mental model must be generated first');
  });
});
```

### E2E Tests

```typescript
// tests/guru-functions.spec.ts

test('complete guru function generation flow', async ({ page }) => {
  // Navigate to project teaching tab
  await page.goto('/projects/test-backgammon/teaching');

  // Verify empty state
  await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();

  // Generate mental model
  await page.click('[data-testid="generate-mental-model-btn"]');

  // Verify corpus preview modal
  await expect(page.locator('[data-testid="corpus-preview-modal"]')).toBeVisible();
  await page.click('[data-testid="confirm-generate"]');

  // Wait for generation
  await expect(page.locator('[data-testid="generation-status"]')).toHaveText('Generating...', { timeout: 5000 });
  await expect(page.locator('[data-testid="mental-model-content"]')).toBeVisible({ timeout: 60000 });

  // Verify curriculum button is now enabled
  await expect(page.locator('[data-testid="generate-curriculum-btn"]')).toBeEnabled();
});
```

---

## 12. Performance Considerations

### Generation Time Estimates

| Function | Corpus Size | Estimated Time |
|----------|-------------|----------------|
| Mental Model | < 5k words | 15-30 seconds |
| Mental Model | 5k-20k words | 30-60 seconds |
| Curriculum | Any | 45-90 seconds |
| Drill Series | Any | 60-120 seconds |

### Optimization Strategies

1. **Background jobs**: All generation runs in Inngest, not blocking UI
2. **Polling**: UI polls for completion every 3 seconds
3. **Caching**: Corpus hash enables quick staleness checks
4. **Pagination**: Large drill series paginated in UI

---

## 13. Security Considerations

### Authorization

- All endpoints require project ownership verification
- Artifacts inherit project ownership (no separate ACL)
- Corpus content is passed to OpenAI - ensure no PII policies apply

### Input Validation

- Validate artifact type enum strictly
- Validate version numbers are positive integers
- Sanitize any user notes before including in prompts

---

## 14. Implementation Phases

### Phase 1: Database & Infrastructure (2-3 hours)

1. Add `GuruArtifact` model to Prisma schema
2. Run migration
3. Create Zod schemas for all artifact types
4. Set up `lib/guruFunctions/` directory structure
5. Implement corpus hash utility

**Deliverable**: Database ready, types defined

### Phase 2: Mental Model Generator (3-4 hours)

1. Implement `mentalModelPrompt.ts` with rich prompt
2. Build `mentalModelGenerator.ts` with GPT-4o structured output
3. Create `mentalModelMarkdown.ts` renderer
4. Add Inngest job `mentalModelGenerationJob`
5. Create API routes
6. Build basic UI for triggering and viewing

**Deliverable**: Function 1 fully working

### Phase 3: Curriculum Generator (3-4 hours)

1. Implement `curriculumPrompt.ts`
2. Build `curriculumGenerator.ts` (requires mental model)
3. Create `curriculumMarkdown.ts` renderer
4. Add Inngest job
5. Create API routes
6. Build UI with progressive disclosure rendering

**Deliverable**: Function 2 fully working

### Phase 4: Drill Designer (4-5 hours)

1. Implement `drillDesignerPrompt.ts`
2. Build `drillDesigner.ts` (requires mental model + curriculum)
3. Create `drillSeriesMarkdown.ts` renderer with ASCII wireframes
4. Add Inngest job
5. Create API routes
6. Build UI for drill preview

**Deliverable**: Function 3 fully working

### Phase 5: Polish & Integration (2-3 hours)

1. Implement corpus preview modal
2. Add staleness detection and warning UI
3. Implement regeneration with notes flow
4. Version selector UI
5. Error handling and edge cases
6. E2E tests

**Deliverable**: Complete feature ready for production

---

## 15. Versioning Strategy

### Version Naming

Artifacts use incrementing version numbers:
- `v1` - First generation
- `v2` - Second generation (after regeneration)
- etc.

### Storage

All versions are kept indefinitely (per user decision). Each version is a separate `GuruArtifact` row with:
- Same `projectId` and `type`
- Different `version` number
- Own `content`, `markdownContent`, `corpusHash`

### UI Access

Version selector dropdown shows all versions with:
- Version number
- Generation timestamp
- Staleness indicator (if corpus changed since)

---

## 16. Editability & Regeneration

### Direct Editing

Artifacts can be directly edited in the UI:
- JSON content editable via code editor modal
- Markdown content editable via textarea
- Changes saved to same version (no new version created)

### Regeneration with Notes (Recommended)

When regenerating:
1. User clicks "Regenerate"
2. Modal offers optional notes field
3. Notes are prepended to system prompt as user guidance
4. New version created with fresh generation
5. Old version remains accessible

---

## 17. Open Questions

1. ~~Should we support global/shared artifacts?~~ **Decided: No, project-scoped only**
2. Should artifacts be exportable (JSON/Markdown download)?
3. What's the maximum corpus size before we should warn users?
4. Should we track prompt versions for reproducibility?

---

## 18. References

- **Ideation Document**: `docs/ideation/guru-teaching-functions-self-assessment-architecture.md`
- **Teaching POVs**: `teaching-POVs.md` (progressive disclosure, principle-based learning)
- **LLM Pattern**: `lib/corpusRecommendationGenerator.ts` (structured output reference)
- **Job Pattern**: `lib/inngest-functions.ts` (background job reference)
- **Research Report**: `/tmp/research_20251204_llm_principle_based_teaching_prompts.md`

---

## 19. Appendix: Full System Prompts

### A. Mental Model Generator Prompt

```
# ROLE: Expert Instructional Designer & Mental Model Architect

You are designing the foundational mental model for teaching [DOMAIN]. Your task is to analyze the provided knowledge corpus and create a teaching framework that transforms novices into principle-driven thinkers.

## YOUR CORE MISSION

Create a mental model that:
1. Breaks the domain into 2-5 intuitive categories (no more!)
2. Identifies 2-3 core principles per category
3. Explains WHY these principles matter (transfer is the goal)
4. Maps how principles interconnect across categories

## GUIDING PHILOSOPHY

### On Principle-Based Learning
"The more expertise a person has, the easier they find it to categorize and solve problems because they have greater conceptual knowledge and understanding of principles." - Schema Theory

Your goal: Transform learners who see surface features into principle-driven thinkers.

### On Cognitive Architecture
Working memory is severely limited. Your mental model must be:
- MEMORABLE: 2-5 top-level categories maximum
- HIERARCHICAL: Principles nest within categories
- ACTIONABLE: Each principle guides decision-making
- TRANSFERABLE: Principles apply across varied situations

[... corpus content ...]

## CONSTRAINTS

- Categories: MINIMUM 2, MAXIMUM 5
- Principles per category: MINIMUM 2, MAXIMUM 3
- All text should be clear to a motivated beginner
- Avoid jargon unless you define it immediately
- Each principle must be ACTIONABLE (not just descriptive)
```

### B. Curriculum Generator Prompt

```
# ROLE: Curriculum Designer with Progressive Disclosure Expertise

## THE CARDINAL RULE: PROGRESSIVE DISCLOSURE

"In today's world, if someone sees more than two or three lines of relatively small text, their brain automatically wants to disengage."

EVERY piece of content must follow this structure:
1. HEADLINE: One compelling sentence (max 15 words)
2. ESSENCE: 2-3 lines that capture the core concept
3. EXPANDABLE: Additional context available on tap/click (but NOT shown by default)

If you write a paragraph of more than 3 sentences without a break, you have failed.

[... mental model + corpus ...]

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] No lesson essence exceeds 3 sentences
- [ ] Every principle has all 4 lesson types
- [ ] Expandable content is clearly separated
- [ ] Jargon is either avoided or immediately defined
- [ ] Each lesson focuses on ONE principle (not multiple)
- [ ] Learning path makes logical sense
```

### C. Drill Designer Prompt

```
# ROLE: Practice Exercise Designer with Deliberate Practice Expertise

## DELIBERATE PRACTICE PHILOSOPHY

Effective practice is NOT repetition. It is:
1. TARGETED: Each drill isolates one principle
2. DIAGNOSTIC: Reveals whether learner understood the principle
3. CORRECTIVE: Feedback explains WHY, not just right/wrong
4. PROGRESSIVE: Difficulty increases as competence grows

## PRINCIPLE-FIRST FEEDBACK

When a learner gets a drill wrong, the feedback should:
1. Identify which principle was violated or misapplied
2. Explain how to recognize this situation type
3. Connect back to the mental model
4. Never just say "wrong" - always explain WHY

[... mental model + curriculum + corpus ...]

## QUALITY REQUIREMENTS

- [ ] Every principle has at least 3 drills (one per tier)
- [ ] Incorrect feedback always references the relevant principle
- [ ] No drill tests multiple principles simultaneously
- [ ] Recognition drills are genuinely easier than Application drills
- [ ] Transfer drills present novel situations not in curriculum examples
- [ ] Feedback uses progressive disclosure (brief visible, expanded hidden)
```

---

**End of Specification**

*Quality Score: 9/10 - Comprehensive with clear implementation path, rich pedagogical foundation, sequential execution enforced*
