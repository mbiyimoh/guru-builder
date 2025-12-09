# Task Breakdown: Per-Project Prompt Customization

Generated: 2025-12-08
Source: specs/feat-per-project-prompt-customization.md
Depends On: specs/feat-enhanced-content-creation-prompts-tasks.md

## Overview

Enable per-project customization of teaching content generation prompts. Users can view, edit, and save custom system prompts and user prompts for each of the three artifact types. Includes prompt history tracking for analysis of how prompts evolve over time.

---

## Phase 1: Core Infrastructure

### Task 1.1: Add Prisma Schema Models

**Description**: Add ProjectPromptConfig and PromptConfigHistory models to Prisma schema.
**Size**: Medium
**Priority**: High
**Dependencies**: None (foundation task)
**Can run parallel with**: None

**File**: `prisma/schema.prisma`

**Implementation**:

```prisma
model ProjectPromptConfig {
  id          String   @id @default(cuid())
  projectId   String

  // Which artifact type this config applies to
  artifactType GuruArtifactType  // MENTAL_MODEL | CURRICULUM | DRILL_SERIES

  // Custom prompts (null means use default)
  customSystemPrompt String?  @db.Text
  customUserPrompt   String?  @db.Text

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relation
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  history     PromptConfigHistory[]

  // Unique constraint: one config per project per artifact type
  @@unique([projectId, artifactType])
}

model PromptConfigHistory {
  id              String   @id @default(cuid())
  configId        String

  // Snapshot of prompts at this point in time
  systemPrompt    String?  @db.Text
  userPrompt      String?  @db.Text

  // Change metadata
  changeType      PromptChangeType  // CREATED | UPDATED | RESET
  changedAt       DateTime @default(now())

  // Hash for quick comparison (matches GuruArtifact.systemPromptHash/userPromptHash)
  systemPromptHash String?
  userPromptHash   String?

  config          ProjectPromptConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  @@index([configId, changedAt])
}

enum PromptChangeType {
  CREATED
  UPDATED
  RESET
}

// Update Project model to include relation
model Project {
  // ... existing fields
  promptConfigs  ProjectPromptConfig[]
}
```

**Acceptance Criteria**:
- [ ] ProjectPromptConfig model added with all fields
- [ ] PromptConfigHistory model added with all fields
- [ ] PromptChangeType enum added
- [ ] Project model updated with promptConfigs relation
- [ ] Compound unique constraint on [projectId, artifactType]
- [ ] Index on [configId, changedAt] for history queries

---

### Task 1.2: Run Database Migration

**Description**: Create and run the database migration for new models.
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Commands**:
```bash
npm run db:backup  # Always backup first!
npm run migrate:safe -- add-prompt-customization
npx prisma generate
```

**Acceptance Criteria**:
- [ ] Migration file created
- [ ] Migration runs successfully
- [ ] Prisma client regenerated
- [ ] Database has new tables

---

### Task 1.3: Create Default Prompts Module

**Description**: Create a module that exports default prompts for easy access.
**Size**: Medium
**Priority**: High
**Dependencies**: None (can start immediately if Spec 1 prompts exist)
**Can run parallel with**: Task 1.1, Task 1.2

**File**: `lib/guruFunctions/prompts/defaults.ts`

**Implementation**:

```typescript
/**
 * Default Prompts Module
 *
 * Exports default system and user prompts for all artifact types.
 * Used when no custom prompts are configured for a project.
 */

import { CREATIVE_TEACHING_SYSTEM_PROMPT } from './creativeSystemPrompt'
import { buildMentalModelPrompt } from './mentalModelPrompt'
import { buildCurriculumPrompt } from './curriculumPrompt'
import { buildDrillDesignerPrompt } from './drillDesignerPrompt'

export type ArtifactType = 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'

export interface PromptDefaults {
  systemPrompt: string
  userPromptTemplate: string  // The template before variable substitution
}

/**
 * Get the default system prompt (shared across all artifact types)
 */
export function getDefaultSystemPrompt(): string {
  return CREATIVE_TEACHING_SYSTEM_PROMPT
}

/**
 * Get the default user prompt template for an artifact type.
 * This returns the template with placeholder markers for documentation.
 */
export function getDefaultUserPromptTemplate(artifactType: ArtifactType): string {
  switch (artifactType) {
    case 'MENTAL_MODEL':
      return buildMentalModelPrompt({
        domain: '{{domain}}',
        corpusSummary: '{{corpusSummary}}',
        corpusWordCount: 0,
        userNotes: '{{userNotes}}',
      })
    case 'CURRICULUM':
      return buildCurriculumPrompt({
        domain: '{{domain}}',
        corpusSummary: '{{corpusSummary}}',
        mentalModel: { /* placeholder */ } as any,
        userNotes: '{{userNotes}}',
      })
    case 'DRILL_SERIES':
      return buildDrillDesignerPrompt({
        domain: '{{domain}}',
        corpusSummary: '{{corpusSummary}}',
        mentalModel: { /* placeholder */ } as any,
        curriculum: { /* placeholder */ } as any,
        userNotes: '{{userNotes}}',
      })
  }
}

/**
 * Get both default prompts for an artifact type.
 */
export function getDefaultPrompts(artifactType: ArtifactType): PromptDefaults {
  return {
    systemPrompt: getDefaultSystemPrompt(),
    userPromptTemplate: getDefaultUserPromptTemplate(artifactType),
  }
}
```

**Acceptance Criteria**:
- [ ] File created at correct location
- [ ] Exports ArtifactType type
- [ ] Exports PromptDefaults interface
- [ ] getDefaultSystemPrompt returns shared system prompt
- [ ] getDefaultUserPromptTemplate returns correct template per type
- [ ] getDefaultPrompts returns combined defaults
- [ ] TypeScript compiles without errors

---

### Task 1.4: Create Prompt Resolver Service

**Description**: Create a service that resolves which prompts to use for a project.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2 (needs Prisma models)
**Can run parallel with**: Task 1.3

**File**: `lib/guruFunctions/promptResolver.ts`

**Implementation**:

```typescript
/**
 * Prompt Resolver Service
 *
 * Resolves prompts for a project, checking for custom configurations
 * and falling back to defaults.
 */

import { prisma } from '@/lib/db'
import { getDefaultSystemPrompt, getDefaultUserPromptTemplate, type ArtifactType } from './prompts/defaults'

export interface ResolvedPrompts {
  systemPrompt: string
  isCustomSystem: boolean
  userPromptTemplate: string | null  // null means use default builder
  isCustomUser: boolean
}

/**
 * Get the prompts to use for a specific project and artifact type.
 */
export async function resolvePromptsForProject(
  projectId: string,
  artifactType: ArtifactType
): Promise<ResolvedPrompts> {
  // Check for custom config
  const config = await prisma.projectPromptConfig.findUnique({
    where: {
      projectId_artifactType: {
        projectId,
        artifactType,
      },
    },
  })

  return {
    systemPrompt: config?.customSystemPrompt ?? getDefaultSystemPrompt(),
    isCustomSystem: !!config?.customSystemPrompt,
    userPromptTemplate: config?.customUserPrompt ?? null,
    isCustomUser: !!config?.customUserPrompt,
  }
}

/**
 * Check if a project has any custom prompts.
 */
export async function hasCustomPrompts(projectId: string): Promise<boolean> {
  const count = await prisma.projectPromptConfig.count({
    where: {
      projectId,
      OR: [
        { customSystemPrompt: { not: null } },
        { customUserPrompt: { not: null } },
      ],
    },
  })
  return count > 0
}
```

**Acceptance Criteria**:
- [ ] File created at correct location
- [ ] ResolvedPrompts interface exported
- [ ] resolvePromptsForProject returns default when no config exists
- [ ] resolvePromptsForProject returns custom prompts when configured
- [ ] hasCustomPrompts utility function works
- [ ] TypeScript compiles without errors

---

## Phase 2: API Routes

### Task 2.1: Create GET Prompts Route

**Description**: Create API route to fetch all prompt configurations for a project.
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.2, Task 2.3

**File**: `app/api/projects/[id]/guru/prompts/route.ts`

**Implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { getDefaultPrompts } from '@/lib/guruFunctions/prompts/defaults'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/projects/[id]/guru/prompts
 * Get all prompt configurations for a project
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  try {
    await requireProjectOwnership(projectId)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get custom configs
  const configs = await prisma.projectPromptConfig.findMany({
    where: { projectId },
  })

  // Build response with defaults and custom overrides
  const artifactTypes = ['MENTAL_MODEL', 'CURRICULUM', 'DRILL_SERIES'] as const

  const promptConfigs = artifactTypes.map(type => {
    const custom = configs.find(c => c.artifactType === type)
    const defaults = getDefaultPrompts(type)

    return {
      artifactType: type,
      systemPrompt: {
        current: custom?.customSystemPrompt ?? defaults.systemPrompt,
        isCustom: !!custom?.customSystemPrompt,
        default: defaults.systemPrompt,
      },
      userPrompt: {
        current: custom?.customUserPrompt ?? defaults.userPromptTemplate,
        isCustom: !!custom?.customUserPrompt,
        default: defaults.userPromptTemplate,
      },
      updatedAt: custom?.updatedAt ?? null,
    }
  })

  return NextResponse.json({ promptConfigs })
}
```

**Acceptance Criteria**:
- [ ] Route handles GET requests
- [ ] Requires project ownership
- [ ] Returns all 3 artifact type configs
- [ ] Each config shows current, isCustom, and default
- [ ] Returns updatedAt for custom configs

---

### Task 2.2: Create PUT Prompts Route

**Description**: Create API route to update prompts for a specific artifact type with history recording.
**Size**: Large
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, Task 2.3

**File**: `app/api/projects/[id]/guru/prompts/[artifactType]/route.ts`

**Implementation**:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string; artifactType: string }> }

const updatePromptSchema = z.object({
  systemPrompt: z.string().max(50000).nullable().optional(),
  userPrompt: z.string().max(50000).nullable().optional(),
})

/**
 * PUT /api/projects/[id]/guru/prompts/[artifactType]
 * Update prompts for a specific artifact type
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id: projectId, artifactType } = await context.params

  // Validate artifact type
  if (!['MENTAL_MODEL', 'CURRICULUM', 'DRILL_SERIES'].includes(artifactType)) {
    return NextResponse.json({ error: 'Invalid artifact type' }, { status: 400 })
  }

  try {
    await requireProjectOwnership(projectId)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const result = updatePromptSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { systemPrompt, userPrompt } = result.data

  // Import hash utility
  const { hashPrompt } = await import('@/lib/guruFunctions/promptHasher')

  // Check if config exists (to determine change type)
  const existingConfig = await prisma.projectPromptConfig.findUnique({
    where: {
      projectId_artifactType: { projectId, artifactType: artifactType as any },
    },
  })

  const changeType = existingConfig ? 'UPDATED' : 'CREATED'

  // Upsert the config
  const config = await prisma.projectPromptConfig.upsert({
    where: {
      projectId_artifactType: {
        projectId,
        artifactType: artifactType as any,
      },
    },
    create: {
      projectId,
      artifactType: artifactType as any,
      customSystemPrompt: systemPrompt,
      customUserPrompt: userPrompt,
    },
    update: {
      customSystemPrompt: systemPrompt,
      customUserPrompt: userPrompt,
    },
  })

  // Record history for tracking changes over time
  await prisma.promptConfigHistory.create({
    data: {
      configId: config.id,
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      changeType,
      systemPromptHash: systemPrompt ? hashPrompt(systemPrompt) : null,
      userPromptHash: userPrompt ? hashPrompt(userPrompt) : null,
    },
  })

  return NextResponse.json({
    message: 'Prompts updated',
    config: {
      artifactType: config.artifactType,
      hasCustomSystem: !!config.customSystemPrompt,
      hasCustomUser: !!config.customUserPrompt,
      updatedAt: config.updatedAt,
    },
  })
}
```

**Acceptance Criteria**:
- [ ] Route handles PUT requests
- [ ] Validates artifact type
- [ ] Requires project ownership
- [ ] Validates request body with max size limit
- [ ] Uses upsert for create/update
- [ ] Records history with change type
- [ ] Computes and stores prompt hashes
- [ ] Returns updated config status

---

### Task 2.3: Create DELETE Prompts Route (Reset)

**Description**: Create API route to reset prompts to defaults with history recording.
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, Task 2.2

**File**: `app/api/projects/[id]/guru/prompts/[artifactType]/route.ts` (add to existing file)

**Implementation**:

```typescript
/**
 * DELETE /api/projects/[id]/guru/prompts/[artifactType]
 * Reset prompts to defaults for a specific artifact type
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: projectId, artifactType } = await context.params

  if (!['MENTAL_MODEL', 'CURRICULUM', 'DRILL_SERIES'].includes(artifactType)) {
    return NextResponse.json({ error: 'Invalid artifact type' }, { status: 400 })
  }

  try {
    await requireProjectOwnership(projectId)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find existing config to record reset in history
  const existingConfig = await prisma.projectPromptConfig.findUnique({
    where: {
      projectId_artifactType: { projectId, artifactType: artifactType as any },
    },
  })

  if (existingConfig) {
    // Record the reset in history before deleting
    await prisma.promptConfigHistory.create({
      data: {
        configId: existingConfig.id,
        systemPrompt: null,
        userPrompt: null,
        changeType: 'RESET',
        systemPromptHash: null,
        userPromptHash: null,
      },
    })
  }

  await prisma.projectPromptConfig.deleteMany({
    where: {
      projectId,
      artifactType: artifactType as any,
    },
  })

  return NextResponse.json({ message: 'Prompts reset to defaults' })
}
```

**Acceptance Criteria**:
- [ ] Route handles DELETE requests
- [ ] Validates artifact type
- [ ] Requires project ownership
- [ ] Records RESET in history before deletion
- [ ] Deletes config record
- [ ] Returns success message

---

### Task 2.4: Test API CRUD Operations

**Description**: Create integration tests for prompt CRUD operations.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Tasks 2.1, 2.2, 2.3
**Can run parallel with**: None

**File**: `__tests__/integration/promptCustomization.test.ts`

**Key Tests**:
- GET returns all 3 configs with defaults
- PUT saves custom system prompt
- PUT saves custom user prompt
- PUT saves both prompts
- DELETE resets to defaults
- History records created for CREATED, UPDATED, RESET

**Acceptance Criteria**:
- [ ] All CRUD tests pass
- [ ] History tracking verified
- [ ] Authorization tests included

---

## Phase 3: Generator Integration

### Task 3.1: Update Generator Options Interface

**Description**: Update all generators to accept optional custom prompts.
**Size**: Small
**Priority**: High
**Dependencies**: Phase 1, Phase 2
**Can run parallel with**: None

**Files**:
- `lib/guruFunctions/generators/mentalModelGenerator.ts`
- `lib/guruFunctions/generators/curriculumGenerator.ts`
- `lib/guruFunctions/generators/drillDesigner.ts`

**Implementation (mentalModelGenerator.ts as example)**:

```typescript
export interface GeneratorOptions {
  projectId: string
  contextLayers: CorpusItem[]
  knowledgeFiles: CorpusItem[]
  domain: string
  userNotes?: string
  // NEW: Optional custom prompts (resolved before calling generator)
  customSystemPrompt?: string
  customUserPromptTemplate?: string
}
```

**Acceptance Criteria**:
- [ ] All 3 generators have updated interface
- [ ] Optional customSystemPrompt field
- [ ] Optional customUserPromptTemplate field
- [ ] TypeScript compiles without errors

---

### Task 3.2: Update Mental Model Generator

**Description**: Update mental model generator to use custom prompts when provided.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.3, Task 3.4

**File**: `lib/guruFunctions/generators/mentalModelGenerator.ts`

**Implementation**:

```typescript
export async function generateMentalModel(
  options: GeneratorOptions
): Promise<GenerationResult<MentalModelOutput>> {
  const {
    contextLayers,
    knowledgeFiles,
    domain,
    userNotes,
    customSystemPrompt,
    customUserPromptTemplate,
  } = options

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)
  const corpusWordCount = countCorpusWords(contextLayers, knowledgeFiles)

  // Build user prompt - use custom if provided, otherwise default builder
  let userPrompt: string
  if (customUserPromptTemplate) {
    // Substitute variables in custom template
    userPrompt = customUserPromptTemplate
      .replace(/\{\{domain\}\}/g, domain)
      .replace(/\{\{corpusSummary\}\}/g, corpusSummary)
      .replace(/\{\{corpusWordCount\}\}/g, String(corpusWordCount))
      .replace(/\{\{userNotes\}\}/g, userNotes || '')
  } else {
    userPrompt = buildMentalModelPrompt({
      domain,
      corpusSummary,
      corpusWordCount,
      userNotes,
    })
  }

  // Use custom system prompt if provided
  const systemPrompt = customSystemPrompt ?? CREATIVE_TEACHING_SYSTEM_PROMPT

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    // ... rest unchanged
  })

  // ... rest unchanged
}
```

**Acceptance Criteria**:
- [ ] Uses custom system prompt when provided
- [ ] Uses custom user prompt with variable substitution
- [ ] Falls back to defaults when not provided
- [ ] All 4 variables substituted correctly
- [ ] TypeScript compiles without errors

---

### Task 3.3: Update Curriculum Generator

**Description**: Update curriculum generator to use custom prompts when provided.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.2, Task 3.4

**File**: `lib/guruFunctions/generators/curriculumGenerator.ts`

**Pattern**: Same as mental model generator, with curriculum-specific variables.

**Acceptance Criteria**:
- [ ] Uses custom system prompt when provided
- [ ] Uses custom user prompt with variable substitution
- [ ] Falls back to defaults when not provided
- [ ] TypeScript compiles without errors

---

### Task 3.4: Update Drill Designer Generator

**Description**: Update drill designer generator to use custom prompts when provided.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.2, Task 3.3

**File**: `lib/guruFunctions/generators/drillDesigner.ts`

**Pattern**: Same as mental model generator, with drill-specific variables.

**Acceptance Criteria**:
- [ ] Uses custom system prompt when provided
- [ ] Uses custom user prompt with variable substitution
- [ ] Falls back to defaults when not provided
- [ ] TypeScript compiles without errors

---

### Task 3.5: Update Inngest Jobs

**Description**: Update Inngest jobs to resolve and pass custom prompts to generators.
**Size**: Large
**Priority**: High
**Dependencies**: Tasks 3.2, 3.3, 3.4
**Can run parallel with**: None

**File**: `lib/inngest-functions.ts`

**Implementation (mental model job as example)**:

```typescript
import { resolvePromptsForProject } from './guruFunctions/promptResolver'

export const mentalModelGenerationJob = inngest.createFunction(
  { id: 'mental-model-generation', concurrency: { limit: 3 } },
  { event: 'guru/generate-mental-model' },
  async ({ event, step }) => {
    const { projectId, artifactId, userNotes } = event.data

    // NEW: Resolve prompts for this project
    const prompts = await step.run('resolve-prompts', async () => {
      return await resolvePromptsForProject(projectId, 'MENTAL_MODEL')
    })

    // ... existing progress updates and project fetch ...

    // Pass resolved prompts to generator
    result = await step.run('generate-mental-model', async () => {
      return await generateMentalModel({
        projectId,
        contextLayers: project.contextLayers.map(l => ({ title: l.title, content: l.content })),
        knowledgeFiles: project.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
        domain: project.name,
        userNotes,
        // NEW: Pass custom prompts if configured
        customSystemPrompt: prompts.isCustomSystem ? prompts.systemPrompt : undefined,
        customUserPromptTemplate: prompts.isCustomUser ? prompts.userPromptTemplate : undefined,
      })
    })

    // ... rest unchanged
  }
)
```

**Acceptance Criteria**:
- [ ] All 3 generation jobs updated
- [ ] resolvePromptsForProject called in step
- [ ] Custom prompts passed only when configured
- [ ] Generation works with and without custom prompts
- [ ] Existing tests still pass

---

## Phase 4: UI - Core Modal

### Task 4.1: Create PromptEditorModal Component

**Description**: Create the main prompt editor modal component.
**Size**: Large
**Priority**: High
**Dependencies**: Phase 2 complete
**Can run parallel with**: Task 4.2

**File**: `components/guru/PromptEditorModal.tsx`

**Key Features**:
- Two tabs: System Prompt, User Prompt Template
- "Modified" badge on changed tabs
- Textarea for editing (full-height)
- Variable documentation for user prompt
- Save, Save & Regenerate, Cancel buttons
- Reset to Defaults button
- Loading state during save

**Acceptance Criteria**:
- [ ] Modal renders with header and close button
- [ ] Tab switching between system/user prompts
- [ ] Textarea displays and edits prompts
- [ ] Modified indicator shows on changed tabs
- [ ] Save calls PUT API
- [ ] Save & Regenerate calls PUT then triggers generation
- [ ] Reset to Defaults calls DELETE API
- [ ] Proper loading states
- [ ] Modal closes on backdrop click

---

### Task 4.2: Create useModalAccessibility Hook

**Description**: Create or identify existing modal accessibility hook.
**Size**: Small
**Priority**: Medium
**Dependencies**: None
**Can run parallel with**: Task 4.1

**File**: `hooks/useModalAccessibility.ts` (if not existing)

**Features**:
- Escape key to close modal
- Focus trapping within modal
- Body scroll lock while open

**Alternative**: If using shadcn/ui Dialog, skip this task (accessibility built-in).

**Acceptance Criteria**:
- [ ] Hook created or existing pattern identified
- [ ] Escape key closes modal
- [ ] Documented in PromptEditorModal

---

### Task 4.3: Add Settings Button to ArtifactCard

**Description**: Add gear icon button to open prompt editor for each artifact type.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 4.1
**Can run parallel with**: Task 4.4

**File**: `components/guru/GuruTeachingManager.tsx`

**Implementation**:

```typescript
// Add state
const [promptEditorOpen, setPromptEditorOpen] = useState<{
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'
} | null>(null)
const [promptConfigs, setPromptConfigs] = useState<PromptConfigResponse | null>(null)

// Fetch prompt configs on mount
useEffect(() => {
  async function fetchPromptConfigs() {
    const res = await fetch(`/api/projects/${projectId}/guru/prompts`)
    if (res.ok) {
      const data = await res.json()
      setPromptConfigs(data)
    }
  }
  fetchPromptConfigs()
}, [projectId])

// In ArtifactCard, add settings button
<button
  onClick={() => setPromptEditorOpen({ artifactType: 'MENTAL_MODEL' })}
  className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
  title="Edit prompts"
  data-testid="mental-model-settings"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0..." />
  </svg>
</button>
```

**Acceptance Criteria**:
- [ ] Settings button visible on each artifact card
- [ ] Click opens prompt editor for that artifact type
- [ ] data-testid attributes for E2E testing

---

### Task 4.4: Add Custom Badge Indicator

**Description**: Show "Custom" badge when prompts are customized.
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 4.3
**Can run parallel with**: Task 4.3

**File**: `components/guru/GuruTeachingManager.tsx`

**Implementation**:

```typescript
{promptConfigs?.promptConfigs.find(c => c.artifactType === 'MENTAL_MODEL')?.systemPrompt.isCustom && (
  <span
    className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded"
    data-testid="mental-model-custom-badge"
  >
    Custom
  </span>
)}
```

**Acceptance Criteria**:
- [ ] Badge shows when system or user prompt is custom
- [ ] Badge hidden when using defaults
- [ ] Badge updates after save/reset

---

### Task 4.5: Wire Up Modal Actions

**Description**: Connect modal Save and Save & Regenerate to generation flow.
**Size**: Medium
**Priority**: High
**Dependencies**: Tasks 4.1, 4.3
**Can run parallel with**: None

**File**: `components/guru/GuruTeachingManager.tsx`

**Implementation**:

```typescript
// Render modal with callbacks
{promptEditorOpen && promptConfigs && (
  <PromptEditorModal
    projectId={projectId}
    artifactType={promptEditorOpen.artifactType}
    systemPrompt={promptConfigs.promptConfigs.find(c => c.artifactType === promptEditorOpen.artifactType)!.systemPrompt}
    userPrompt={promptConfigs.promptConfigs.find(c => c.artifactType === promptEditorOpen.artifactType)!.userPrompt}
    onClose={() => setPromptEditorOpen(null)}
    onSave={() => {
      setPromptEditorOpen(null)
      fetchPromptConfigs()  // Refresh to show updated badges
    }}
    onSaveAndRegenerate={() => {
      setPromptEditorOpen(null)
      fetchPromptConfigs()
      // Convert artifact type to generation key
      const typeKey = promptEditorOpen.artifactType.toLowerCase().replace('_', '-') as 'mental-model' | 'curriculum' | 'drill-series'
      handleGenerate(typeKey)
    }}
  />
)}
```

**Acceptance Criteria**:
- [ ] Save closes modal and refreshes configs
- [ ] Save & Regenerate closes modal, refreshes, triggers generation
- [ ] Custom badge updates after actions
- [ ] Error handling for failed operations

---

## Phase 5: UI - Validation & Polish

### Task 5.1: Add Validation Warnings

**Description**: Show warnings in modal when required variables are missing.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Phase 4 complete
**Can run parallel with**: Task 5.2

**File**: `components/guru/PromptEditorModal.tsx`

**Implementation**:

```typescript
const REQUIRED_VARIABLES = ['{{domain}}', '{{corpusSummary}}']
const [validationWarnings, setValidationWarnings] = useState<string[]>([])

useEffect(() => {
  const warnings: string[] = []

  for (const variable of REQUIRED_VARIABLES) {
    if (!editedUser.includes(variable)) {
      warnings.push(`User prompt is missing ${variable} - generation may produce unexpected results`)
    }
  }

  setValidationWarnings(warnings)
}, [editedUser])

// In JSX, show warning banner:
{validationWarnings.length > 0 && (
  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
    <div className="flex items-start gap-2">
      <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" ...>
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="text-sm text-amber-800">
        <p className="font-medium mb-1">Missing required variables:</p>
        <ul className="list-disc list-inside space-y-1">
          {validationWarnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Warnings shown when {{domain}} missing
- [ ] Warnings shown when {{corpusSummary}} missing
- [ ] Warnings styled as amber/warning color
- [ ] Warnings update as user types
- [ ] Save NOT blocked (warn only per decision)

---

### Task 5.2: Add Variable Documentation

**Description**: Show available variables and their descriptions in user prompt tab.
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 4 complete
**Can run parallel with**: Task 5.1

**File**: `components/guru/PromptEditorModal.tsx`

**Implementation**:

```typescript
{activeTab === 'user' && (
  <div>
    <p className="text-sm text-gray-600 mb-3">
      The user prompt template defines the task. Use these variables:
    </p>
    <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
      <div className="font-mono space-y-1">
        <div><code className="bg-gray-200 px-1 rounded">{'{{domain}}'}</code> - Project name/domain</div>
        <div><code className="bg-gray-200 px-1 rounded">{'{{corpusSummary}}'}</code> - Full corpus text</div>
        <div><code className="bg-gray-200 px-1 rounded">{'{{corpusWordCount}}'}</code> - Corpus word count</div>
        <div><code className="bg-gray-200 px-1 rounded">{'{{userNotes}}'}</code> - User guidance (optional)</div>
      </div>
    </div>
    <textarea ... />
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Variable list shown above user prompt textarea
- [ ] All 4 variables documented
- [ ] Clear formatting with code styling

---

### Task 5.3: Create E2E Tests

**Description**: Create end-to-end tests for prompt customization workflow.
**Size**: Large
**Priority**: High
**Dependencies**: Phase 4 complete
**Can run parallel with**: Tasks 5.1, 5.2

**File**: `e2e/prompt-customization.spec.ts`

**Key Tests**:

```typescript
test.describe('Prompt Customization', () => {
  test('user can view and edit prompts', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('[data-testid="mental-model-settings"]')
    await expect(page.locator('text=Edit Mental Model Prompts')).toBeVisible()
    await expect(page.locator('textarea')).toContainText('innovative instructional designer')
  })

  test('user can save custom prompts', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('[data-testid="mental-model-settings"]')
    const textarea = page.locator('textarea')
    await textarea.fill('My custom system prompt')
    await page.click('text=Save')
    await expect(page.locator('text=Edit Mental Model Prompts')).not.toBeVisible()
    await expect(page.locator('[data-testid="mental-model-custom-badge"]')).toBeVisible()
  })

  test('save and regenerate triggers generation', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('[data-testid="mental-model-settings"]')
    const textarea = page.locator('textarea')
    await textarea.fill('My custom prompt')
    await page.click('text=Save & Regenerate')
    await expect(page.locator('[data-testid="mental-model-status"]')).toContainText('Generating')
  })

  test('validation warnings shown for missing variables', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('[data-testid="mental-model-settings"]')
    await page.click('text=User Prompt Template')
    const textarea = page.locator('textarea')
    await textarea.fill('No variables here')
    await expect(page.locator('text=Missing required variables')).toBeVisible()
  })

  test('regenerated content viewable in artifact viewer', async ({ page }) => {
    // After generation completes
    await page.goto('/projects/test-project/artifacts/teaching/mental-model')
    await expect(page.locator('[data-testid="artifact-content"]')).toBeVisible()
  })
})
```

**Acceptance Criteria**:
- [ ] Test opens prompt editor
- [ ] Test saves custom prompt
- [ ] Test verifies Custom badge
- [ ] Test Save & Regenerate
- [ ] Test validation warnings
- [ ] All tests pass

---

### Task 5.4: Update Documentation

**Description**: Update CLAUDE.md and create user documentation.
**Size**: Small
**Priority**: Low
**Dependencies**: All other tasks complete
**Can run parallel with**: None

**Files**:
- `.claude/CLAUDE.md` - Add section on per-project prompt customization
- `developer-guides/` - Document prompt resolution service

**CLAUDE.md Addition**:
```markdown
### Per-Project Prompt Customization

Projects can customize the prompts used for teaching content generation:

**Database Model:** `ProjectPromptConfig` stores custom prompts per artifact type
**API:** `/api/projects/[id]/guru/prompts` for CRUD operations
**UI:** Settings icon on artifact cards opens prompt editor modal

**Key Files:**
- `lib/guruFunctions/promptResolver.ts` - Resolves prompts for project
- `lib/guruFunctions/prompts/defaults.ts` - Default prompt access
- `components/guru/PromptEditorModal.tsx` - UI component

**Variables in User Prompts:**
- `{{domain}}` - Project name
- `{{corpusSummary}}` - Corpus content
- `{{corpusWordCount}}` - Word count
- `{{userNotes}}` - User guidance
```

**Acceptance Criteria**:
- [ ] CLAUDE.md updated
- [ ] Key files documented
- [ ] Variable list documented

---

## Testing Requirements

### Unit Tests

**File**: `__tests__/lib/guruFunctions/promptResolver.test.ts`

**Key Tests**:
- Returns default prompts when no custom config
- Returns custom prompts when configured
- Returns partial custom (system only or user only)
- hasCustomPrompts utility works

### Integration Tests

**File**: `__tests__/integration/promptCustomization.test.ts`

**Key Tests**:
- GET returns all configs with defaults
- PUT saves and records history
- DELETE resets and records history
- History contains correct change types

### E2E Tests

**File**: `e2e/prompt-customization.spec.ts`

See Task 5.3 for detailed test list.

---

## Dependency Graph

```
Phase 1 (Infrastructure)
├── Task 1.1: Prisma Schema
│   └── Task 1.2: Run Migration
│       └── Task 1.4: Prompt Resolver
├── Task 1.3: Defaults Module (parallel)

Phase 2 (API)
├── Task 2.1: GET Route ─────┐
├── Task 2.2: PUT Route ─────┤ (parallel)
├── Task 2.3: DELETE Route ──┤
└── Task 2.4: Test API ──────┘

Phase 3 (Generators)
├── Task 3.1: Update Interface
│   ├── Task 3.2: Mental Model Generator ─┐
│   ├── Task 3.3: Curriculum Generator ───┤ (parallel)
│   └── Task 3.4: Drill Designer ─────────┘
│       └── Task 3.5: Update Inngest Jobs

Phase 4 (UI Core)
├── Task 4.1: PromptEditorModal ─────────┐
├── Task 4.2: useModalAccessibility ─────┤ (parallel)
├── Task 4.3: Settings Button ───────────┤
├── Task 4.4: Custom Badge ──────────────┤
└── Task 4.5: Wire Up Actions ───────────┘

Phase 5 (Polish)
├── Task 5.1: Validation Warnings ─┐
├── Task 5.2: Variable Docs ───────┤ (parallel)
├── Task 5.3: E2E Tests ───────────┤
└── Task 5.4: Documentation ───────┘
```

---

## Summary

- **Total Tasks**: 18
- **Phase 1**: 4 tasks (Core Infrastructure)
- **Phase 2**: 4 tasks (API Routes)
- **Phase 3**: 5 tasks (Generator Integration)
- **Phase 4**: 5 tasks (UI Core Modal)
- **Phase 5**: 4 tasks (Validation & Polish)

**Parallel Execution Opportunities**:
- Phase 1: Task 1.3 can run parallel with 1.1/1.2
- Phase 2: Tasks 2.1-2.3 can run parallel
- Phase 3: Tasks 3.2-3.4 can run parallel after 3.1
- Phase 4: Tasks 4.1-4.4 can run parallel
- Phase 5: Tasks 5.1-5.3 can run parallel
