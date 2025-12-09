# Per-Project Prompt Customization

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-08
**Depends On:** [feat-enhanced-content-creation-prompts.md](./feat-enhanced-content-creation-prompts.md)
**Related:** [docs/ideation/enhance-content-creation-prompts.md](../docs/ideation/enhance-content-creation-prompts.md)

---

## Overview

Enable per-project customization of teaching content generation prompts. Users can view, edit, and save custom system prompts and user prompts for each of the three artifact types (mental model, curriculum, drills). Each project starts with standard defaults but can be customized independently. Includes "Save" and "Save & Regenerate" actions for workflow flexibility.

## Background/Problem Statement

### Current State

The teaching content generation system uses hardcoded prompts in:
- `lib/guruFunctions/prompts/mentalModelPrompt.ts`
- `lib/guruFunctions/prompts/curriculumPrompt.ts`
- `lib/guruFunctions/prompts/drillDesignerPrompt.ts`

Users can only influence generation through transient `userNotes` that are:
- Not persisted
- Limited to simple text guidance
- No visibility into the actual prompts being used

### Why Customization Matters

Different domains benefit from different instructional approaches:
- A **programming** guru might need more worked-example-focused drills
- A **sports strategy** guru might benefit from game-scenario-based content
- A **creative** domain might need more metaphor-heavy mental models

Power users who understand their domain deeply should be able to tune the prompts to produce better-fitting content.

### Core Problem

Users cannot see or modify the prompts that shape their guru's teaching content, limiting their ability to optimize for their specific domain.

## Goals

- Allow users to view the current prompts (system + user) for each artifact type
- Allow users to edit and save custom prompts per project
- Custom prompts persist and are used for all subsequent generations
- Provide "Save" (use next time) and "Save & Regenerate" (use immediately) actions
- Include "Reset to Defaults" option
- Ensure prompt changes only affect the specific project
- Maintain backward compatibility (projects without custom prompts use defaults)

## Non-Goals

- Version history of prompt changes
- Prompt templates library (shared across projects)
- Prompt validation/linting
- A/B testing of prompts
- Prompt diff view
- Collaborative prompt editing
- Prompt analytics/metrics

## Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Prisma | ^5.x | Database ORM, new model |
| React | 19.x | UI components |
| Monaco Editor | Optional | Rich code editing (could defer) |
| Inngest | ^3.x | Generation job integration |

**Prerequisite:** `feat-enhanced-content-creation-prompts.md` must be implemented first to define the default prompts.

---

## Detailed Design

### 1. Database Schema

Add a new model to store custom prompts per project.

**File:** `prisma/schema.prisma`

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

  // Unique constraint: one config per project per artifact type
  @@unique([projectId, artifactType])
}

// Update Project model to include relation
model Project {
  // ... existing fields
  promptConfigs  ProjectPromptConfig[]
}
```

**Migration Note:** This is a new table with no existing data to migrate. Safe to add.

### 2. Default Prompts Module

Create a module that exports default prompts for easy access.

**File:** `lib/guruFunctions/prompts/defaults.ts`

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

### 3. Prompt Resolution Service

Create a service that resolves which prompts to use for a project.

**File:** `lib/guruFunctions/promptResolver.ts`

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

### 4. Generator Updates

Update generators to use resolved prompts instead of hardcoded imports.

**File:** `lib/guruFunctions/generators/mentalModelGenerator.ts`

**Changes:**

```typescript
import { resolvePromptsForProject } from '../promptResolver'
import { buildMentalModelPrompt } from '../prompts/mentalModelPrompt'

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
    response_format: { /* unchanged */ },
    temperature: 0.7,
  })

  // ... rest unchanged
}
```

Similar updates for `curriculumGenerator.ts` and `drillDesigner.ts`.

### 5. Inngest Job Updates

Update Inngest jobs to resolve and pass custom prompts.

**File:** `lib/inngest-functions.ts`

**Changes to mental model job:**

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

### 6. API Routes

#### Get Prompts for Project

**File:** `app/api/projects/[id]/guru/prompts/route.ts`

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

#### Update Prompts for Artifact Type

**File:** `app/api/projects/[id]/guru/prompts/[artifactType]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string; artifactType: string }> }

const updatePromptSchema = z.object({
  systemPrompt: z.string().nullable().optional(),
  userPrompt: z.string().nullable().optional(),
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

  await prisma.projectPromptConfig.deleteMany({
    where: {
      projectId,
      artifactType: artifactType as any,
    },
  })

  return NextResponse.json({ message: 'Prompts reset to defaults' })
}
```

### 7. UI Components

#### Prompt Editor Modal

**File:** `components/guru/PromptEditorModal.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'

/**
 * useModalAccessibility hook handles:
 * - Escape key to close modal
 * - Focus trapping within modal
 * - Body scroll lock while modal is open
 *
 * Implementation: Create at hooks/useModalAccessibility.ts or use existing
 * modal patterns in the codebase. If not available, can use:
 * - @radix-ui/react-dialog for full accessibility
 * - Or inline useEffect with keydown listener for Escape key only
 */
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface PromptConfig {
  current: string
  isCustom: boolean
  default: string
}

interface PromptEditorModalProps {
  projectId: string
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'
  systemPrompt: PromptConfig
  userPrompt: PromptConfig
  onClose: () => void
  onSave: () => void
  onSaveAndRegenerate: () => void
}

const ARTIFACT_LABELS = {
  MENTAL_MODEL: 'Mental Model',
  CURRICULUM: 'Curriculum',
  DRILL_SERIES: 'Drill Series',
}

export function PromptEditorModal({
  projectId,
  artifactType,
  systemPrompt,
  userPrompt,
  onClose,
  onSave,
  onSaveAndRegenerate,
}: PromptEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'system' | 'user'>('system')
  const [editedSystem, setEditedSystem] = useState(systemPrompt.current)
  const [editedUser, setEditedUser] = useState(userPrompt.current)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useModalAccessibility({ onClose })

  useEffect(() => {
    const systemChanged = editedSystem !== systemPrompt.current
    const userChanged = editedUser !== userPrompt.current
    setHasChanges(systemChanged || userChanged)
  }, [editedSystem, editedUser, systemPrompt.current, userPrompt.current])

  async function handleSave(regenerate: boolean) {
    setIsSaving(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/guru/prompts/${artifactType}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: editedSystem !== systemPrompt.default ? editedSystem : null,
            userPrompt: editedUser !== userPrompt.default ? editedUser : null,
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to save prompts')

      if (regenerate) {
        onSaveAndRegenerate()
      } else {
        onSave()
      }
    } catch (error) {
      console.error('Failed to save prompts:', error)
      alert('Failed to save prompts. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset() {
    if (!confirm('Reset both prompts to defaults? This cannot be undone.')) return

    setIsSaving(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/guru/prompts/${artifactType}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Failed to reset prompts')

      setEditedSystem(systemPrompt.default)
      setEditedUser(userPrompt.default)
      onSave()
    } catch (error) {
      console.error('Failed to reset prompts:', error)
      alert('Failed to reset prompts. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative w-full max-w-5xl transform overflow-hidden rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Edit {ARTIFACT_LABELS[artifactType]} Prompts
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Customize how content is generated for this project
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('system')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'system'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                System Prompt
                {editedSystem !== systemPrompt.default && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Modified
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('user')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'user'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                User Prompt Template
                {editedUser !== userPrompt.default && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Modified
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="p-6">
            {activeTab === 'system' && (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  The system prompt establishes the AI's persona and approach. This is shared across all artifact types by default.
                </p>
                <textarea
                  value={editedSystem}
                  onChange={(e) => setEditedSystem(e.target.value)}
                  className="w-full h-96 px-4 py-3 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter system prompt..."
                />
              </div>
            )}

            {activeTab === 'user' && (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  The user prompt template defines the task. Use these variables:
                  <code className="bg-gray-100 px-1 rounded">{'{{domain}}'}</code>,
                  <code className="bg-gray-100 px-1 rounded">{'{{corpusSummary}}'}</code>,
                  <code className="bg-gray-100 px-1 rounded">{'{{corpusWordCount}}'}</code>,
                  <code className="bg-gray-100 px-1 rounded">{'{{userNotes}}'}</code>
                </p>
                <textarea
                  value={editedUser}
                  onChange={(e) => setEditedUser(e.target.value)}
                  className="w-full h-96 px-4 py-3 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter user prompt template..."
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
            <button
              onClick={handleReset}
              disabled={isSaving || (!systemPrompt.isCustom && !userPrompt.isCustom)}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:text-gray-400"
            >
              Reset to Defaults
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving || !hasChanges}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving || !hasChanges}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save & Regenerate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

#### Update GuruTeachingManager

**File:** `components/guru/GuruTeachingManager.tsx`

**Add prompt editor integration:**

```typescript
// Add state
const [promptEditorOpen, setPromptEditorOpen] = useState<{
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'
} | null>(null)
const [promptConfigs, setPromptConfigs] = useState<PromptConfigResponse | null>(null)

// Fetch prompt configs
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

// Add to ArtifactCard - settings button
<button
  onClick={() => setPromptEditorOpen({ artifactType: 'MENTAL_MODEL' })}
  className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
  title="Edit prompts"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
</button>

// Show indicator if custom prompts configured
{promptConfigs?.promptConfigs.find(c => c.artifactType === 'MENTAL_MODEL')?.systemPrompt.isCustom && (
  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
    Custom
  </span>
)}

// Render modal
{promptEditorOpen && promptConfigs && (
  <PromptEditorModal
    projectId={projectId}
    artifactType={promptEditorOpen.artifactType}
    systemPrompt={promptConfigs.promptConfigs.find(c => c.artifactType === promptEditorOpen.artifactType)!.systemPrompt}
    userPrompt={promptConfigs.promptConfigs.find(c => c.artifactType === promptEditorOpen.artifactType)!.userPrompt}
    onClose={() => setPromptEditorOpen(null)}
    onSave={() => {
      setPromptEditorOpen(null)
      fetchPromptConfigs()
    }}
    onSaveAndRegenerate={() => {
      setPromptEditorOpen(null)
      fetchPromptConfigs()
      handleGenerate(promptEditorOpen.artifactType.toLowerCase().replace('_', '-') as any)
    }}
  />
)}
```

---

## User Experience

### Accessing Prompt Editor

1. User navigates to project's Guru Teaching Pipeline
2. Each artifact card shows a settings icon (gear)
3. If custom prompts are configured, a "Custom" badge appears
4. Clicking the gear opens the Prompt Editor Modal

### Editing Prompts

1. Modal shows two tabs: System Prompt, User Prompt Template
2. Modified tabs show "Modified" badge
3. User edits text in the textarea
4. Variable placeholders explained above editor

### Saving Changes

Three options:
- **Cancel**: Discard changes, close modal
- **Save**: Persist changes for next generation
- **Save & Regenerate**: Persist changes and immediately trigger generation

> **Note:** After regeneration completes, users navigate to the full-page artifact viewer at `/projects/[id]/artifacts/teaching/[type]` to see results. The artifact card in GuruTeachingManager shows completion status and links to the viewer.

### Resetting to Defaults

- "Reset to Defaults" button in modal footer
- Confirmation dialog before resetting
- Removes custom config from database

---

## Testing Strategy

### Unit Tests

**File:** `__tests__/lib/guruFunctions/promptResolver.test.ts`

```typescript
describe('resolvePromptsForProject', () => {
  it('returns default prompts when no custom config exists', async () => {
    const result = await resolvePromptsForProject('project-1', 'MENTAL_MODEL')

    expect(result.isCustomSystem).toBe(false)
    expect(result.isCustomUser).toBe(false)
    expect(result.systemPrompt).toContain('innovative instructional designer')
  })

  it('returns custom prompts when configured', async () => {
    // Setup: Create custom config in test DB
    await prisma.projectPromptConfig.create({
      data: {
        projectId: 'project-1',
        artifactType: 'MENTAL_MODEL',
        customSystemPrompt: 'Custom system',
        customUserPrompt: 'Custom user {{domain}}',
      },
    })

    const result = await resolvePromptsForProject('project-1', 'MENTAL_MODEL')

    expect(result.isCustomSystem).toBe(true)
    expect(result.systemPrompt).toBe('Custom system')
    expect(result.isCustomUser).toBe(true)
    expect(result.userPromptTemplate).toBe('Custom user {{domain}}')
  })

  it('returns partial custom prompts correctly', async () => {
    await prisma.projectPromptConfig.create({
      data: {
        projectId: 'project-1',
        artifactType: 'MENTAL_MODEL',
        customSystemPrompt: 'Custom system only',
        customUserPrompt: null,
      },
    })

    const result = await resolvePromptsForProject('project-1', 'MENTAL_MODEL')

    expect(result.isCustomSystem).toBe(true)
    expect(result.isCustomUser).toBe(false)
    expect(result.userPromptTemplate).toBeNull()
  })
})
```

### Integration Tests

**File:** `__tests__/integration/promptCustomization.test.ts`

```typescript
describe('Prompt Customization API', () => {
  it('GET /prompts returns all artifact configs with defaults', async () => {
    const response = await fetch('/api/projects/test-project/guru/prompts')
    const data = await response.json()

    expect(data.promptConfigs).toHaveLength(3)
    expect(data.promptConfigs[0].artifactType).toBe('MENTAL_MODEL')
    expect(data.promptConfigs[0].systemPrompt.isCustom).toBe(false)
  })

  it('PUT /prompts/MENTAL_MODEL saves custom prompts', async () => {
    const response = await fetch('/api/projects/test-project/guru/prompts/MENTAL_MODEL', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: 'Custom system prompt',
        userPrompt: null, // Keep default user prompt
      }),
    })

    expect(response.ok).toBe(true)

    // Verify persistence
    const getResponse = await fetch('/api/projects/test-project/guru/prompts')
    const data = await getResponse.json()

    const mmConfig = data.promptConfigs.find(c => c.artifactType === 'MENTAL_MODEL')
    expect(mmConfig.systemPrompt.isCustom).toBe(true)
    expect(mmConfig.systemPrompt.current).toBe('Custom system prompt')
  })

  it('DELETE /prompts/MENTAL_MODEL resets to defaults', async () => {
    // Setup: First create custom config
    await fetch('/api/projects/test-project/guru/prompts/MENTAL_MODEL', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: 'Custom' }),
    })

    // Delete
    const response = await fetch('/api/projects/test-project/guru/prompts/MENTAL_MODEL', {
      method: 'DELETE',
    })

    expect(response.ok).toBe(true)

    // Verify reset
    const getResponse = await fetch('/api/projects/test-project/guru/prompts')
    const data = await getResponse.json()

    const mmConfig = data.promptConfigs.find(c => c.artifactType === 'MENTAL_MODEL')
    expect(mmConfig.systemPrompt.isCustom).toBe(false)
  })
})
```

### E2E Tests

**File:** `e2e/prompt-customization.spec.ts`

```typescript
test.describe('Prompt Customization', () => {
  test('user can view and edit prompts', async ({ page }) => {
    await page.goto('/projects/test-project')

    // Open prompt editor
    await page.click('[data-testid="mental-model-settings"]')

    // Verify modal opens
    await expect(page.locator('text=Edit Mental Model Prompts')).toBeVisible()

    // Verify default prompt content visible
    await expect(page.locator('textarea')).toContainText('innovative instructional designer')
  })

  test('user can save custom prompts', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('[data-testid="mental-model-settings"]')

    // Edit prompt
    const textarea = page.locator('textarea')
    await textarea.fill('My custom system prompt')

    // Save
    await page.click('text=Save')

    // Verify modal closes and "Custom" badge appears
    await expect(page.locator('text=Edit Mental Model Prompts')).not.toBeVisible()
    await expect(page.locator('[data-testid="mental-model-custom-badge"]')).toBeVisible()
  })

  test('save and regenerate triggers generation', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('[data-testid="mental-model-settings"]')

    // Make edit
    const textarea = page.locator('textarea')
    await textarea.fill('My custom prompt')

    // Save & Regenerate
    await page.click('text=Save & Regenerate')

    // Verify generation starts
    await expect(page.locator('[data-testid="mental-model-status"]')).toContainText('Generating')
  })

  test('regenerated content viewable in artifact viewer', async ({ page }) => {
    // Assuming generation has completed from previous test
    await page.goto('/projects/test-project')

    // Wait for completed status
    await expect(page.locator('[data-testid="mental-model-status"]')).toContainText('Completed', { timeout: 120000 })

    // Navigate to full-page viewer
    await page.goto('/projects/test-project/artifacts/teaching/mental-model')

    // Verify content is displayed
    await expect(page.locator('[data-testid="artifact-content"]')).toBeVisible()
  })
})
```

---

## Performance Considerations

### Database Impact

- New table `ProjectPromptConfig` with ~3 rows per project (one per artifact type)
- Queries use indexed compound unique key `(projectId, artifactType)`
- Minimal impact on generation flow (one additional DB read)

### Prompt Size

- Custom prompts stored as TEXT fields (no size limit)
- Default prompts are ~2000-3000 characters
- Custom prompts could be larger but unlikely to exceed 10KB

### Caching

- Prompt resolution happens once per generation job
- No caching needed for MVP (prompts rarely change)
- Future: Cache resolved prompts in Redis if needed

---

## Security Considerations

### Prompt Injection

Custom prompts are user-controlled content sent to LLM. Mitigations:

1. **Ownership validation**: Only project owners can edit prompts
2. **No execution context**: Prompts are treated as text, not code
3. **Output validation**: Zod schemas validate LLM output regardless of prompt

### Access Control

- API routes require `requireProjectOwnership()` authentication
- Prompts are scoped to individual projects
- No cross-project access possible

### Data Storage

- Prompts stored in PostgreSQL as TEXT
- Standard database encryption at rest
- No sensitive data expected in prompts

---

## Error Handling

### Invalid Custom Prompts
If a custom prompt produces invalid output during generation:
- Generation fails with `FAILED` status (existing behavior)
- Error logged to Inngest with prompt content for debugging
- User sees: "Generation failed. Your custom prompt may have issues. Try resetting to defaults."

### Missing Template Variables
If user omits required variables like `{{domain}}`:
- Generation proceeds with empty/missing data substituted
- Output may be lower quality but won't crash
- Variable substitution uses empty string for missing placeholders
- Future enhancement: Add validation warning in UI before save

### Misspelled Variables
If user types `{{domian}}` instead of `{{domain}}`:
- Misspelled variable is left as literal text in prompt
- AI may produce unexpected output
- No automatic correction (user responsibility)

### Large Prompts
If custom prompt exceeds reasonable size:
- Add max length validation to PUT route (50KB limit)
- API returns 400 with "Prompt too large" error

```typescript
const updatePromptSchema = z.object({
  systemPrompt: z.string().max(50000).nullable().optional(),
  userPrompt: z.string().max(50000).nullable().optional(),
})
```

### Database Errors
If prompt config save fails:
- API returns 500 with error message
- UI shows: "Failed to save prompts. Please try again."
- No partial state (upsert is atomic)

---

## Documentation

### Updates Required

1. **CLAUDE.md**: Add section on per-project prompt customization
2. **User Guide**: Document prompt editing workflow
3. **Developer Guide**: Document prompt resolution service

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Add `ProjectPromptConfig` Prisma model
2. Run migration
3. Create `prompts/defaults.ts` module
4. Create `promptResolver.ts` service
5. Add API routes for prompt CRUD

### Phase 2: Generator Integration
1. Update `GeneratorOptions` interface
2. Update all three generators to accept custom prompts
3. Update Inngest jobs to resolve and pass prompts
4. Test generation with custom prompts

### Phase 3: UI
1. Create `PromptEditorModal` component
2. Add settings button to `ArtifactCard`
3. Add "Custom" badge indicator
4. Wire up Save/Save & Regenerate actions
5. Test end-to-end flow

---

## Pending Decisions

> **Action Required:** These questions need explicit answers before implementation begins.

### Decision 1: Monaco Editor
**Question:** Should we use Monaco Editor for rich prompt editing (syntax highlighting, etc.)?

**Options:**
- **A) No** - Plain textarea is sufficient for MVP, reduces bundle size
- **B) Yes** - Better editing experience for long prompts with markdown-like syntax

**Recommendation:** Option A (No) - simplifies implementation, can add later if users request

**Your Decision:** _________________

---

### Decision 2: Prompt Validation
**Question:** Should we validate that custom prompts include required template variables?

**Options:**
- **A) No** - Trust users, show variable list in UI as guidance, let generation fail if broken
- **B) Yes, warn only** - Show warning if `{{domain}}` is missing, but allow save
- **C) Yes, block** - Prevent save if required variables are missing

**Recommendation:** Option A (No) - keeps implementation simple, error handling covers failures

**Your Decision:** _________________

---

### Decision 3: Prompt History
**Question:** Should we keep version history of prompt changes?

**Options:**
- **A) No** - Out of scope, users can copy/paste to save versions externally
- **B) Yes** - Track changes with timestamps, allow rollback

**Recommendation:** Option A (No) - significant schema additions for minimal user value

**Your Decision:** _________________

---

## References

- [feat-enhanced-content-creation-prompts.md](./feat-enhanced-content-creation-prompts.md) - Default prompts specification
- [Ideation Document](../docs/ideation/enhance-content-creation-prompts.md)
- [Prisma Unique Constraints](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#defining-a-unique-field)
