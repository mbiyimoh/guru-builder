# Task Breakdown: Guru Teaching Functions

Generated: 2025-12-04
Source: specs/feat-guru-teaching-functions.md

## Overview

Implement three core LLM-powered functions that any guru can perform using their corpus to generate teaching artifacts. These functions build sequentially (Mental Model → Curriculum → Drills) and enable any domain guru to automatically produce principle-based educational content.

**MVP Simplifications Applied**:
- Cut `learningPath.alternatives` - keep only recommended path
- Deferred `promptVersion` tracking - add post-MVP
- Made `practiceSequences` optional in drills
- Focus on Markdown view + regenerate flow (defer JSON editing)

---

## Phase 1: Database & Infrastructure

### Task 1.1: Add GuruArtifact model and enums

**Description**: Create database model for storing generated teaching artifacts
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation)

**Technical Requirements**:

Add to `prisma/schema.prisma`:

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
```

Update Project model:
```prisma
model Project {
  // ... existing fields ...

  // ADD:
  guruArtifacts   GuruArtifact[]
}
```

**Implementation Steps**:
1. Run `npm run db:backup`
2. Add GuruArtifactType enum
3. Add ArtifactStatus enum
4. Add GuruArtifact model
5. Add relation to Project
6. Run `npm run migrate:safe -- add-guru-artifacts`
7. Run `npx prisma generate`

**Acceptance Criteria**:
- [ ] GuruArtifact model exists
- [ ] Enums created
- [ ] Migration successful
- [ ] Self-referential relation works (dependsOn)
- [ ] Indexes created

---

### Task 1.2: Create directory structure and types

**Description**: Set up lib/guruFunctions directory with TypeScript types
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.3

**Technical Requirements**:

Create directory structure:
```
lib/guruFunctions/
├── index.ts
├── types.ts
├── corpusHasher.ts
├── prompts/
│   ├── mentalModelPrompt.ts
│   ├── curriculumPrompt.ts
│   └── drillDesignerPrompt.ts
├── generators/
│   ├── mentalModelGenerator.ts
│   ├── curriculumGenerator.ts
│   └── drillDesigner.ts
├── schemas/
│   ├── mentalModelSchema.ts
│   ├── curriculumSchema.ts
│   └── drillSeriesSchema.ts
└── renderers/
    ├── mentalModelMarkdown.ts
    ├── curriculumMarkdown.ts
    └── drillSeriesMarkdown.ts
```

Create `lib/guruFunctions/types.ts`:

```typescript
export interface CorpusItem {
  id?: string;
  title: string;
  content: string;
}

export interface GeneratorOptions {
  projectId: string;
  contextLayers: CorpusItem[];
  knowledgeFiles: CorpusItem[];
  domain: string;
  userNotes?: string; // Optional notes for regeneration
}

export interface GenerationResult<T> {
  content: T;
  markdown: string;
  corpusHash: string;
}
```

Create `lib/guruFunctions/index.ts`:

```typescript
export * from './types';
export * from './corpusHasher';
export * from './schemas/mentalModelSchema';
export * from './schemas/curriculumSchema';
export * from './schemas/drillSeriesSchema';
export * from './generators/mentalModelGenerator';
export * from './generators/curriculumGenerator';
export * from './generators/drillDesigner';
```

**Implementation Steps**:
1. Create directory structure
2. Create types.ts with interfaces
3. Create index.ts with exports
4. Create placeholder files for prompts/generators/schemas

**Acceptance Criteria**:
- [ ] Directory structure exists
- [ ] Types exported and usable
- [ ] No TypeScript errors

---

### Task 1.3: Implement corpus hash utility

**Description**: Create utility for computing corpus hash for staleness detection
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2

**Technical Requirements**:

Create `lib/guruFunctions/corpusHasher.ts`:

```typescript
import crypto from 'crypto';
import type { CorpusItem } from './types';

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
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 16); // Short hash is sufficient
}

/**
 * Compose a summary of corpus content for LLM prompts.
 */
export function composeCorpusSummary(
  contextLayers: CorpusItem[],
  knowledgeFiles: CorpusItem[]
): string {
  const sections: string[] = [];

  if (contextLayers.length > 0) {
    sections.push('## Context Layers\n');
    contextLayers.forEach((layer, i) => {
      sections.push(`### ${i + 1}. ${layer.title}\n${layer.content}\n`);
    });
  }

  if (knowledgeFiles.length > 0) {
    sections.push('## Knowledge Files\n');
    knowledgeFiles.forEach((file, i) => {
      sections.push(`### ${i + 1}. ${file.title}\n${file.content}\n`);
    });
  }

  return sections.join('\n');
}
```

**Implementation Steps**:
1. Create corpusHasher.ts
2. Implement computeCorpusHash
3. Implement composeCorpusSummary

**Acceptance Criteria**:
- [ ] Hash is deterministic (same input = same output)
- [ ] Hash changes when content changes
- [ ] Summary includes all layers and files

---

## Phase 2: Mental Model Generator (Function 1)

### Task 2.1: Create Mental Model Zod schema

**Description**: Define output schema for mental model generation
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 2.2

**Technical Requirements**:

Create `lib/guruFunctions/schemas/mentalModelSchema.ts`:

```typescript
import { z } from 'zod';

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

**Implementation Steps**:
1. Create schema file
2. Define all fields with proper Zod types
3. Use `.nullable().optional()` for optional fields (OpenAI strict mode requirement)
4. Export type

**Acceptance Criteria**:
- [ ] Schema validates correctly
- [ ] Type exported
- [ ] Compatible with OpenAI structured outputs

---

### Task 2.2: Create Mental Model system prompt

**Description**: Build the rich pedagogical prompt for mental model generation
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.1

**Technical Requirements**:

Create `lib/guruFunctions/prompts/mentalModelPrompt.ts`:

```typescript
interface MentalModelPromptParams {
  domain: string;
  corpusSummary: string;
  corpusWordCount: number;
  userNotes?: string;
}

export function buildMentalModelPrompt(params: MentalModelPromptParams): string {
  const { domain, corpusSummary, corpusWordCount, userNotes } = params;

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\nThe user has provided these notes for this generation:\n${userNotes}\n\nIncorporate this guidance into your mental model design.\n`
    : '';

  return `
# ROLE: Expert Instructional Designer & Mental Model Architect

You are designing the foundational mental model for teaching ${domain}. Your task is to analyze the provided knowledge corpus and create a teaching framework that transforms novices into principle-driven thinkers.

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
${userNotesSection}
## CORPUS KNOWLEDGE BASE

${corpusSummary}

(Corpus contains approximately ${corpusWordCount} words of domain knowledge)

## OUTPUT REQUIREMENTS

Generate a mental model with:
- domainTitle: Human-readable name for this domain
- teachingApproach: 1-2 sentence description of recommended approach
- categories: Array of 2-5 categories, each with:
  - id: Unique identifier (e.g., "category_1")
  - name: Short, memorable name
  - description: 2-3 sentences on what this covers and why it matters
  - mentalModelMetaphor: Optional analogy to familiar concept
  - principles: Array of 2-3 principles, each with:
    - id: Unique identifier (e.g., "principle_1_1")
    - name: Short, memorable principle name
    - essence: ONE sentence capturing the core idea
    - whyItMatters: 2-3 sentences on WHY following this leads to better outcomes
    - commonMistake: What novices typically do wrong
    - recognitionPattern: How to recognize when this principle applies
  - orderInLearningPath: Suggested order (1, 2, 3...)
- principleConnections: How principles relate/trade off with each other
- masterySummary: "When a learner has internalized this, they will..."

## CONSTRAINTS

- Categories: MINIMUM 2, MAXIMUM 5
- Principles per category: MINIMUM 2, MAXIMUM 3
- All text should be clear to a motivated beginner
- Avoid jargon unless you define it immediately
- Each principle must be ACTIONABLE (not just descriptive)

Now analyze the corpus and generate the mental model.
`.trim();
}
```

**Implementation Steps**:
1. Create prompt file
2. Include all pedagogical guidance
3. Add user notes section for regeneration
4. Add corpus summary placeholder

**Acceptance Criteria**:
- [ ] Prompt is well-structured
- [ ] User notes incorporated when provided
- [ ] Constraints clearly stated
- [ ] Output structure matches Zod schema

---

### Task 2.3: Implement Mental Model generator

**Description**: Build the generator that calls GPT-4o with structured output
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: None

**Technical Requirements**:

Create `lib/guruFunctions/generators/mentalModelGenerator.ts`:

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { mentalModelSchema, type MentalModelOutput } from '../schemas/mentalModelSchema';
import { buildMentalModelPrompt } from '../prompts/mentalModelPrompt';
import { composeCorpusSummary, computeCorpusHash } from '../corpusHasher';
import type { GeneratorOptions, GenerationResult } from '../types';

// Lazy-loaded OpenAI client (matches existing pattern)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function generateMentalModel(
  options: GeneratorOptions
): Promise<GenerationResult<MentalModelOutput>> {
  const { contextLayers, knowledgeFiles, domain, userNotes } = options;

  // Validate corpus is not empty
  if (contextLayers.length === 0 && knowledgeFiles.length === 0) {
    throw new Error('Corpus is empty. Add context layers or knowledge files first.');
  }

  // Compose corpus summary
  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles);
  const corpusWordCount = corpusSummary.split(/\s+/).length;
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles);

  // Build system prompt
  const systemPrompt = buildMentalModelPrompt({
    domain,
    corpusSummary,
    corpusWordCount,
    userNotes,
  });

  console.log(`[Mental Model Generator] Starting for domain: ${domain}`);
  console.log(`[Mental Model Generator] Corpus: ${corpusWordCount} words`);

  const response = await getOpenAI().beta.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the mental model based on the corpus provided.' },
    ],
    response_format: zodResponseFormat(mentalModelSchema, 'mental_model'),
  });

  const result = response.choices[0].message.parsed;
  if (!result) {
    throw new Error('Failed to parse mental model response');
  }

  console.log(`[Mental Model Generator] Generated ${result.categories.length} categories`);

  // Generate markdown
  const markdown = renderMentalModelMarkdown(result);

  return {
    content: result,
    markdown,
    corpusHash,
  };
}

function renderMentalModelMarkdown(model: MentalModelOutput): string {
  const lines: string[] = [
    `# ${model.domainTitle}`,
    '',
    `*${model.teachingApproach}*`,
    '',
    '---',
    '',
  ];

  model.categories
    .sort((a, b) => a.orderInLearningPath - b.orderInLearningPath)
    .forEach(category => {
      lines.push(`## ${category.name}`);
      lines.push('');
      lines.push(category.description);
      if (category.mentalModelMetaphor) {
        lines.push('');
        lines.push(`> ${category.mentalModelMetaphor}`);
      }
      lines.push('');

      category.principles.forEach(principle => {
        lines.push(`### ${principle.name}`);
        lines.push('');
        lines.push(`**Essence:** ${principle.essence}`);
        lines.push('');
        lines.push(`**Why it matters:** ${principle.whyItMatters}`);
        lines.push('');
        lines.push(`**Common mistake:** ${principle.commonMistake}`);
        lines.push('');
        lines.push(`**Recognition pattern:** ${principle.recognitionPattern}`);
        lines.push('');
      });
    });

  if (model.principleConnections.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Principle Connections');
    lines.push('');
    model.principleConnections.forEach(conn => {
      lines.push(`- **${conn.fromPrinciple}** ↔ **${conn.toPrinciple}**: ${conn.relationship}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Mastery Summary');
  lines.push('');
  lines.push(model.masterySummary);

  return lines.join('\n');
}
```

**Implementation Steps**:
1. Create generator file
2. Implement lazy OpenAI client
3. Add corpus validation
4. Call GPT-4o with structured output
5. Implement Markdown renderer
6. Return GenerationResult

**Acceptance Criteria**:
- [ ] Throws error for empty corpus
- [ ] Calls GPT-4o successfully
- [ ] Parses response correctly
- [ ] Generates readable Markdown
- [ ] Returns corpus hash

---

### Task 2.4: Add Inngest job for Mental Model generation

**Description**: Create background job for mental model generation
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.3
**Can run parallel with**: Task 2.5

**Technical Requirements**:

Add to `lib/inngest-functions.ts`:

```typescript
import { generateMentalModel } from './guruFunctions';
import { Prisma } from '@prisma/client';

/**
 * Mental Model generation job
 */
export const mentalModelGenerationJob = inngest.createFunction(
  {
    id: 'mental-model-generation',
    name: 'Generate Mental Model',
    concurrency: { limit: 3 },
  },
  { event: 'guru/generate-mental-model' },
  async ({ event, step }) => {
    const { projectId, artifactId, userNotes } = event.data;

    // Fetch project with corpus
    const project = await step.run('fetch-project', async () => {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: 'asc' } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    if (!project) {
      await step.run('mark-failed', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED' },
        });
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    // Generate mental model
    let result;
    try {
      result = await step.run('generate-mental-model', async () => {
        return await generateMentalModel({
          projectId,
          contextLayers: project.contextLayers.map(l => ({ title: l.title, content: l.content })),
          knowledgeFiles: project.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
          domain: project.name,
          userNotes,
        });
      });
    } catch (error) {
      await step.run('mark-failed', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED' },
        });
      });
      throw error;
    }

    // Save artifact
    await step.run('save-artifact', async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result.content as unknown as Prisma.JsonObject,
          markdownContent: result.markdown,
          corpusHash: result.corpusHash,
          status: 'COMPLETED',
        },
      });
    });

    return { artifactId, success: true };
  }
);
```

Register in Inngest client:
```typescript
// In lib/inngest.ts or where functions are registered
export const functions = [
  // ... existing functions
  mentalModelGenerationJob,
];
```

**Implementation Steps**:
1. Add job function to inngest-functions.ts
2. Handle errors and mark artifact as failed
3. Register function with Inngest
4. Test via Inngest dev UI

**Acceptance Criteria**:
- [ ] Job runs in background
- [ ] Fetches corpus correctly
- [ ] Saves completed artifact
- [ ] Marks as FAILED on error
- [ ] Visible in Inngest dev UI

---

### Task 2.5: Create Mental Model API routes

**Description**: Build API endpoints for triggering and viewing mental models
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.3, Task 2.4
**Can run parallel with**: Task 2.4

**Technical Requirements**:

Create `app/api/projects/[id]/guru-functions/mental-model/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { inngest } from '@/lib/inngest';
import { computeCorpusHash } from '@/lib/guruFunctions';

export const dynamic = 'force-dynamic';

// POST - Generate new mental model
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  await requireProjectOwnership(projectId);

  // Get optional user notes from body
  let userNotes: string | undefined;
  try {
    const body = await request.json();
    userNotes = body.userNotes;
  } catch {
    // No body is fine
  }

  // Get latest version number
  const existingArtifact = await prisma.guruArtifact.findFirst({
    where: { projectId, type: 'MENTAL_MODEL' },
    orderBy: { version: 'desc' },
  });

  const nextVersion = existingArtifact ? existingArtifact.version + 1 : 1;

  // Create artifact placeholder
  const artifact = await prisma.guruArtifact.create({
    data: {
      projectId,
      type: 'MENTAL_MODEL',
      version: nextVersion,
      content: {},
      status: 'GENERATING',
    },
  });

  // Trigger background generation
  await inngest.send({
    name: 'guru/generate-mental-model',
    data: {
      projectId,
      artifactId: artifact.id,
      userNotes,
    },
  });

  return NextResponse.json({
    artifactId: artifact.id,
    version: nextVersion,
    status: 'GENERATING',
  });
}

// GET - List mental model versions and check staleness
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  await requireProjectOwnership(projectId);

  // Get all versions
  const artifacts = await prisma.guruArtifact.findMany({
    where: { projectId, type: 'MENTAL_MODEL' },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      status: true,
      generatedAt: true,
      corpusHash: true,
    },
  });

  // Compute current corpus hash
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
  const isStale = latestArtifact?.status === 'COMPLETED' &&
                  latestArtifact?.corpusHash !== currentCorpusHash;

  return NextResponse.json({
    artifacts,
    isStale,
    currentCorpusHash,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
```

Create `app/api/projects/[id]/guru-functions/mental-model/[artifactId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET - Get specific artifact content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const { id: projectId, artifactId } = await params;
  await requireProjectOwnership(projectId);

  const artifact = await prisma.guruArtifact.findFirst({
    where: { id: artifactId, projectId },
  });

  if (!artifact) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ artifact });
}
```

**Implementation Steps**:
1. Create route files
2. Implement POST for generation
3. Implement GET for listing with staleness
4. Implement GET for specific artifact
5. Add proper caching headers

**Acceptance Criteria**:
- [ ] POST triggers generation
- [ ] POST increments version correctly
- [ ] GET returns versions with staleness
- [ ] GET artifact returns content
- [ ] No-cache headers on polling endpoint

---

## Phase 3: Curriculum Generator (Function 2)

### Task 3.1: Create Curriculum Zod schema

**Description**: Define output schema for curriculum generation
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 3.2

**Technical Requirements**:

Create `lib/guruFunctions/schemas/curriculumSchema.ts`:

```typescript
import { z } from 'zod';

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
  }),
});

export type CurriculumOutput = z.infer<typeof curriculumSchema>;
```

**Acceptance Criteria**:
- [ ] Schema validates correctly
- [ ] Simplified learningPath (no alternatives)
- [ ] Type exported

---

### Task 3.2: Create Curriculum system prompt

**Description**: Build the progressive disclosure prompt for curriculum generation
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3.1

**Technical Requirements**:

Create `lib/guruFunctions/prompts/curriculumPrompt.ts`:

```typescript
import type { MentalModelOutput } from '../schemas/mentalModelSchema';

interface CurriculumPromptParams {
  domain: string;
  corpusSummary: string;
  mentalModel: MentalModelOutput;
  userNotes?: string;
}

export function buildCurriculumPrompt(params: CurriculumPromptParams): string {
  const { domain, corpusSummary, mentalModel, userNotes } = params;

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\n${userNotes}\n`
    : '';

  return `
# ROLE: Curriculum Designer with Progressive Disclosure Expertise

You are creating a digital learning curriculum for ${domain} based on an established mental model. Your curriculum must embody ruthless brevity and progressive disclosure.

## THE CARDINAL RULE: PROGRESSIVE DISCLOSURE

"In today's world, if someone sees more than two or three lines of relatively small text, their brain automatically wants to disengage."

EVERY piece of content must follow this structure:
1. HEADLINE: One compelling sentence (max 15 words)
2. ESSENCE: 2-3 lines that capture the core concept
3. EXPANDABLE: Additional context (but NOT shown by default)

If you write a paragraph of more than 3 sentences without a break, you have failed.
${userNotesSection}
## MENTAL MODEL FOUNDATION

${JSON.stringify(mentalModel, null, 2)}

## CORPUS KNOWLEDGE BASE

${corpusSummary}

## CURRICULUM STRUCTURE

Create a modular curriculum organized by the mental model's categories. Each module teaches ONE category's principles through four lesson types:

### Lesson Types (use all four for each principle)

1. **CONCEPT** - Introduces the principle
   - Hook: Surprising fact or relatable scenario (1 sentence)
   - Core: The principle stated clearly (1-2 sentences)
   - Why: Why this matters in practice (2-3 sentences)
   - Expand: Deeper explanation (hidden by default)

2. **EXAMPLE** - Shows principle in action
   - Situation: Brief scenario setup (2-3 sentences)
   - Principle Applied: How an expert thinks (2-3 sentences)
   - Outcome: What happens when followed vs. ignored

3. **CONTRAST** - Distinguishes from common mistakes
   - Novice Thinking: How beginners approach this
   - Expert Thinking: How experts approach this
   - Key Difference: The principle that separates them

4. **PRACTICE** - Guides application
   - Scenario: Situation to analyze
   - Prompt: Question focusing on the principle
   - Hint: Gentle nudge (hidden)
   - Explanation: Full reasoning (hidden until attempted)

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] No lesson essence exceeds 3 sentences
- [ ] Every principle has all 4 lesson types
- [ ] Expandable content is clearly separated
- [ ] Each lesson focuses on ONE principle
- [ ] Learning path makes logical sense

Generate the curriculum now.
`.trim();
}
```

**Acceptance Criteria**:
- [ ] Emphasizes progressive disclosure
- [ ] Includes mental model context
- [ ] Defines all 4 lesson types
- [ ] Quality checklist included

---

### Task 3.3: Implement Curriculum generator

**Description**: Build the generator with mental model dependency
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1, Task 3.2, Task 2.3
**Can run parallel with**: None

**Technical Requirements**:

Create `lib/guruFunctions/generators/curriculumGenerator.ts`:

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { curriculumSchema, type CurriculumOutput } from '../schemas/curriculumSchema';
import { buildCurriculumPrompt } from '../prompts/curriculumPrompt';
import { composeCorpusSummary, computeCorpusHash } from '../corpusHasher';
import type { GeneratorOptions, GenerationResult } from '../types';
import type { MentalModelOutput } from '../schemas/mentalModelSchema';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

interface CurriculumGeneratorOptions extends GeneratorOptions {
  mentalModel: MentalModelOutput;
}

export async function generateCurriculum(
  options: CurriculumGeneratorOptions
): Promise<GenerationResult<CurriculumOutput>> {
  const { contextLayers, knowledgeFiles, domain, mentalModel, userNotes } = options;

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles);
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles);

  const systemPrompt = buildCurriculumPrompt({
    domain,
    corpusSummary,
    mentalModel,
    userNotes,
  });

  console.log(`[Curriculum Generator] Starting for domain: ${domain}`);

  const response = await getOpenAI().beta.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the curriculum based on the mental model and corpus.' },
    ],
    response_format: zodResponseFormat(curriculumSchema, 'curriculum'),
  });

  const result = response.choices[0].message.parsed;
  if (!result) {
    throw new Error('Failed to parse curriculum response');
  }

  console.log(`[Curriculum Generator] Generated ${result.modules.length} modules`);

  const markdown = renderCurriculumMarkdown(result);

  return { content: result, markdown, corpusHash };
}

function renderCurriculumMarkdown(curriculum: CurriculumOutput): string {
  const lines: string[] = [
    `# ${curriculum.curriculumTitle}`,
    '',
    `**Target Audience:** ${curriculum.targetAudience}`,
    `**Duration:** ${curriculum.estimatedDuration}`,
    '',
    '---',
    '',
  ];

  curriculum.modules.forEach(module => {
    lines.push(`## ${module.title}`);
    lines.push(`*${module.subtitle}*`);
    lines.push('');
    lines.push('**Learning Objectives:**');
    module.learningObjectives.forEach(obj => lines.push(`- ${obj}`));
    lines.push('');

    module.lessons.forEach(lesson => {
      const tierBadge = lesson.metadata.difficultyTier === 'FOUNDATION' ? '🟢' :
                        lesson.metadata.difficultyTier === 'EXPANSION' ? '🟡' : '🔴';
      lines.push(`### ${tierBadge} ${lesson.title} (${lesson.type})`);
      lines.push('');
      lines.push(`**${lesson.content.headline}**`);
      lines.push('');
      lines.push(lesson.content.essence);
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Learn more...</summary>');
      lines.push('');
      lines.push(lesson.content.expandedContent);
      lines.push('</details>');
      lines.push('');
    });
  });

  return lines.join('\n');
}
```

**Acceptance Criteria**:
- [ ] Requires mental model as input
- [ ] Generates valid curriculum
- [ ] Markdown uses progressive disclosure (`<details>` tags)
- [ ] Returns corpus hash

---

### Task 3.4: Add Inngest job and API for Curriculum

**Description**: Create background job and API endpoints for curriculum
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.3
**Can run parallel with**: None

**Technical Requirements**:

Add to `lib/inngest-functions.ts` (similar pattern to mental model job).

Create API routes at `app/api/projects/[id]/guru-functions/curriculum/`:
- POST: Requires `mentalModelArtifactId` in body
- GET: Returns versions with staleness

Key difference: POST must verify mental model exists and is COMPLETED before proceeding.

```typescript
// In POST handler
const mentalModelArtifact = await prisma.guruArtifact.findFirst({
  where: {
    projectId,
    type: 'MENTAL_MODEL',
    status: 'COMPLETED',
  },
  orderBy: { version: 'desc' },
});

if (!mentalModelArtifact) {
  return NextResponse.json(
    { error: 'Mental model must be generated first' },
    { status: 400 }
  );
}
```

**Acceptance Criteria**:
- [ ] Enforces mental model prerequisite
- [ ] Returns error if mental model missing
- [ ] Stores dependsOnArtifactId
- [ ] Job fetches mental model content

---

## Phase 4: Drill Designer (Function 3)

### Task 4.1: Create Drill Series Zod schema

**Description**: Define output schema for drill series generation
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 4.2

**Technical Requirements**:

Create `lib/guruFunctions/schemas/drillSeriesSchema.ts`:

```typescript
import { z } from 'zod';

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
  })).optional(), // Made optional per simplification
});

export type DrillSeriesOutput = z.infer<typeof drillSeriesSchema>;
```

**Acceptance Criteria**:
- [ ] Schema validates correctly
- [ ] practiceSequences is optional
- [ ] ASCII wireframe field included

---

### Task 4.2: Create Drill Designer system prompt

**Description**: Build the deliberate practice prompt for drill design
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 4.1

**Technical Requirements**:

Create `lib/guruFunctions/prompts/drillDesignerPrompt.ts` with:
- Deliberate practice philosophy
- RECOGNITION → APPLICATION → TRANSFER tiers
- Principle-first feedback requirements
- ASCII wireframe instructions
- Quality checklist

**Acceptance Criteria**:
- [ ] All 3 difficulty tiers defined
- [ ] Feedback tied to principles
- [ ] ASCII wireframe guidance included

---

### Task 4.3: Implement Drill Designer generator

**Description**: Build the generator requiring both mental model and curriculum
**Size**: Medium
**Priority**: High
**Dependencies**: Task 4.1, Task 4.2, Task 3.3
**Can run parallel with**: None

**Technical Requirements**:

Create `lib/guruFunctions/generators/drillDesigner.ts`:
- Requires both mentalModel and curriculum as inputs
- Generates drills for each principle
- Includes ASCII wireframes in markdown output
- Format wireframes as code blocks in Markdown

**Acceptance Criteria**:
- [ ] Requires both prerequisites
- [ ] At least 3 drills per principle (one per tier)
- [ ] ASCII wireframes rendered in Markdown
- [ ] Feedback references principles

---

### Task 4.4: Add Inngest job and API for Drill Series

**Description**: Create background job and API endpoints for drill series
**Size**: Medium
**Priority**: High
**Dependencies**: Task 4.3
**Can run parallel with**: None

**Technical Requirements**:

POST must verify both mental model AND curriculum exist and are COMPLETED.

```typescript
// In POST handler
const [mentalModel, curriculum] = await Promise.all([
  prisma.guruArtifact.findFirst({
    where: { projectId, type: 'MENTAL_MODEL', status: 'COMPLETED' },
    orderBy: { version: 'desc' },
  }),
  prisma.guruArtifact.findFirst({
    where: { projectId, type: 'CURRICULUM', status: 'COMPLETED' },
    orderBy: { version: 'desc' },
  }),
]);

if (!mentalModel || !curriculum) {
  return NextResponse.json(
    { error: 'Mental model and curriculum must be generated first' },
    { status: 400 }
  );
}
```

**Acceptance Criteria**:
- [ ] Enforces both prerequisites
- [ ] Clear error message if missing
- [ ] Stores dependsOnArtifactId (curriculum)

---

## Phase 5: UI Components

### Task 5.1: Create Teaching tab UI shell

**Description**: Build the main Teaching tab page for projects
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 2, 3, 4 tasks
**Can run parallel with**: None

**Technical Requirements**:

Create `app/projects/[id]/teaching/page.tsx`:

```tsx
import { requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TeachingFunctionsPanel } from '@/components/guruFunctions/TeachingFunctionsPanel';

export const dynamic = 'force-dynamic';

export default async function TeachingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProjectOwnership(id);

  // Fetch latest artifacts
  const [mentalModel, curriculum, drills] = await Promise.all([
    prisma.guruArtifact.findFirst({
      where: { projectId: id, type: 'MENTAL_MODEL' },
      orderBy: { version: 'desc' },
    }),
    prisma.guruArtifact.findFirst({
      where: { projectId: id, type: 'CURRICULUM' },
      orderBy: { version: 'desc' },
    }),
    prisma.guruArtifact.findFirst({
      where: { projectId: id, type: 'DRILL_SERIES' },
      orderBy: { version: 'desc' },
    }),
  ]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Teaching Materials</h1>

      <TeachingFunctionsPanel
        projectId={id}
        mentalModel={mentalModel}
        curriculum={curriculum}
        drills={drills}
      />
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Page loads at /projects/[id]/teaching
- [ ] Shows all 3 function states
- [ ] Sequential flow enforced visually

---

### Task 5.2: Create TeachingFunctionsPanel component

**Description**: Build the main panel showing all 3 functions with sequential flow
**Size**: Large
**Priority**: High
**Dependencies**: Task 5.1
**Can run parallel with**: Task 5.3

**Technical Requirements**:

Create `components/guruFunctions/TeachingFunctionsPanel.tsx`:
- Show 3 cards/sections for each function
- Disable function 2 until function 1 complete
- Disable function 3 until function 2 complete
- Show staleness warnings when applicable
- "Generate" and "Regenerate" buttons
- Loading states during generation

**Acceptance Criteria**:
- [ ] Sequential dependency enforced
- [ ] Loading states work
- [ ] Staleness warnings display
- [ ] Regenerate opens notes modal

---

### Task 5.3: Create CorpusPreviewModal and StalenessWarning

**Description**: Build supporting UI components
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 5.2

**Technical Requirements**:

Create `components/guruFunctions/CorpusPreviewModal.tsx`:
- Show list of context layers and knowledge files
- Show word counts
- Show estimated generation time
- Confirm/Cancel buttons

Create `components/guruFunctions/StalenessWarning.tsx`:
- Amber warning banner
- "Regenerate" link
- Dismissible (optional)

**Acceptance Criteria**:
- [ ] Preview modal shows corpus summary
- [ ] Staleness warning is clear
- [ ] Regenerate action works

---

### Task 5.4: Create ArtifactViewer component

**Description**: Build component for viewing generated artifacts
**Size**: Medium
**Priority**: High
**Dependencies**: Task 5.1
**Can run parallel with**: Task 5.2, 5.3

**Technical Requirements**:

Create `components/guruFunctions/ArtifactViewer.tsx`:
- Version selector dropdown
- Markdown rendering with proper styling
- JSON view toggle (secondary)
- Generated timestamp
- Staleness indicator per version

**Acceptance Criteria**:
- [ ] Version selector works
- [ ] Markdown renders correctly
- [ ] Progressive disclosure (`<details>`) works
- [ ] Timestamps displayed

---

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1: Database & Infrastructure | 3 tasks | 2-3 hours |
| Phase 2: Mental Model Generator | 5 tasks | 4-5 hours |
| Phase 3: Curriculum Generator | 4 tasks | 3-4 hours |
| Phase 4: Drill Designer | 4 tasks | 4-5 hours |
| Phase 5: UI Components | 4 tasks | 4-5 hours |
| **Total** | **20 tasks** | **~17-22 hours** |

### Parallel Execution Opportunities

- Task 1.2 and 1.3 can run parallel
- Task 2.1 and 2.2 can run parallel
- Task 2.4 and 2.5 can run parallel
- Task 3.1 and 3.2 can run parallel
- Task 4.1 and 4.2 can run parallel
- Task 5.2, 5.3, 5.4 can run parallel

### Critical Path

1.1 → 1.2 → 2.1/2.2 → 2.3 → 2.4/2.5 → 3.1/3.2 → 3.3 → 3.4 → 4.1/4.2 → 4.3 → 4.4 → 5.1 → 5.2/5.3/5.4

### Sequential Constraint

Functions must be implemented in order (1→2→3) because each depends on the previous function's output.
