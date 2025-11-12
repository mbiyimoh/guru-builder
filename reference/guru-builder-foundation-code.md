# Guru Builder Foundation Code
## Complete Reusable Patterns from Backgammon Guru (40% Foundation)

This document contains all the reusable code patterns from the backgammon-guru codebase that are referenced in the Guru Builder System MVP spec but not included inline.

Use these patterns as-is when implementing the new Guru Builder system in a fresh directory.

---

## Table of Contents

1. [Core Library Files](#core-library-files)
   - lib/db.ts
   - lib/utils.ts
   - lib/validation.ts
   - lib/types.ts
   - lib/contextComposer.ts
2. [Reusable UI Components](#reusable-ui-components)
   - components/layers/LayerCard.tsx
   - components/layers/LayerManager.tsx
   - components/layers/LayerEditModal.tsx
3. [API Route Patterns](#api-route-patterns)
   - app/api/project/[id]/context-layers/route.ts

---

## Core Library Files

### lib/db.ts

**Purpose**: Prisma client singleton pattern (prevents multiple instances in development)

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Usage**: Import `prisma` from this file for all database operations

---

### lib/utils.ts

**Purpose**: Utility functions for className merging (used by shadcn/ui components)

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Dependencies**: Requires `clsx` and `tailwind-merge` packages

**Usage**: `className={cn("base-classes", condition && "conditional-classes")}`

---

### lib/validation.ts

**Purpose**: Zod validation schemas for context layers (extend for new models)

```typescript
import { z } from 'zod'

export const CreateLayerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  priority: z.number().int('Priority must be an integer').min(1, 'Priority must be at least 1'),
  content: z.string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be less than 50,000 characters'),
  isActive: z.boolean().default(true),
})

export const UpdateLayerSchema = CreateLayerSchema.partial()

export type CreateLayerInput = z.infer<typeof CreateLayerSchema>
export type UpdateLayerInput = z.infer<typeof UpdateLayerSchema>
```

**Usage**: Add new schemas for Project, KnowledgeFile, ResearchRun, etc. following this pattern

---

### lib/types.ts

**Purpose**: TypeScript type definitions for existing backgammon-guru functionality

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Drill types
export interface BoardSetup {
  points: Record<string, { color: 'black' | 'white'; checkers: number }>
  bar: { black: number; white: number }
  off: { black: number; white: number }
  summary: string
}

export interface DrillOption {
  move: string
  isCorrect: boolean
  explanation: string
}

export interface Drill {
  id: number
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  boardSetup: BoardSetup
  toPlay: 'black' | 'white'
  roll: [number, number]
  previousMove?: string | null
  question: string
  options: DrillOption[]
  principle: string
  hintsAvailable: string[]
}

export interface DrillModule {
  moduleId: number
  moduleName: string
  totalDrills: number
  note?: string
  drills: Drill[]
}

export interface DrillContext {
  drillId: number
  moduleId: number
  drill: Drill
  hintsUsedCount: number
}

// Chat types
export type ChatMode = 'open' | 'drill'

export interface ChatRequest {
  projectId: string
  userMessage: string
  chatHistory?: ChatMessage[]
  layerIds?: string[]
  mode?: ChatMode
  drillContext?: DrillContext
}

// Drill action API types
export interface HintRequest {
  moduleId: number
  drillId: number
  hintsUsed: number
}

export interface HintResponse {
  hint: string
  source: 'json' | 'ai-generated'
  hintsRemaining: number
  messageId?: string
}

export interface AnswerRequest {
  moduleId: number
  drillId: number
  selectedOptionIndex: number
  hintsUsed: number
}

export interface AnswerResponse {
  isCorrect: boolean
  feedback: string
  correctOption: {
    index: number
    move: string
    explanation: string
  }
  messageId?: string
}

// Context audit types
export interface ContextLayerMetadata {
  id: string
  name: string
  priority: number
  contentLength: number
}

export interface AuditTrail {
  messageId: string
  timestamp: Date
  model: string
  reasoning?: string[]
  contextLayers: ContextLayerMetadata[]
  tokens: {
    prompt: number
    completion: number
    reasoning?: number
    total: number
  }
  cost: {
    prompt: number
    completion: number
    reasoning?: number
    total: number
  }
}

export interface ContextWithMetadata {
  prompt: string
  layers: ContextLayerMetadata[]
}
```

**Usage**: Extend with new types for Guru Builder (ResearchRun, Recommendation, etc.)

---

### lib/contextComposer.ts

**Purpose**: Composes context layers into system prompts for LLM

```typescript
import { prisma } from './db'
import { DrillContext, ContextWithMetadata, ContextLayerMetadata } from './types'

const DEFAULT_CONTEXT = `
You are a backgammon coach. Provide strategic advice based on general backgammon principles.
When no custom context is provided, use general backgammon knowledge.
`.trim()

export async function composeContextFromLayers(
  projectId: string,
  layerIds?: string[]
): Promise<string> {
  try {
    const layers = await prisma.contextLayer.findMany({
      where: {
        projectId,
        isActive: true,
        ...(layerIds && layerIds.length > 0 ? { id: { in: layerIds } } : {}),
      },
      orderBy: { priority: 'asc' },
    })

    if (layers.length === 0) {
      console.warn('[composeContextFromLayers] No active layers, using default context')
      return DEFAULT_CONTEXT
    }

    let prompt = '# CONTEXT LAYERS\n\n'
    prompt += 'The following layers inform your coaching style and knowledge:\n\n'

    layers.forEach((layer, idx) => {
      prompt += `## Layer ${idx + 1}: ${layer.name}\n\n`
      prompt += `${layer.content}\n\n`
      prompt += '---\n\n'
    })

    prompt += '\nAnswer the user\'s question based on the context layers above. '
    prompt += 'Reference specific principles from the layers when relevant.\n'

    return prompt
  } catch (error) {
    console.error('[composeContextFromLayers] Error:', error)
    return DEFAULT_CONTEXT
  }
}

export async function composeContextWithMetadata(
  projectId: string,
  layerIds?: string[]
): Promise<ContextWithMetadata> {
  try {
    const layers = await prisma.contextLayer.findMany({
      where: {
        projectId,
        isActive: true,
        ...(layerIds && layerIds.length > 0 ? { id: { in: layerIds } } : {}),
      },
      orderBy: { priority: 'asc' },
    })

    if (layers.length === 0) {
      console.warn('[composeContextWithMetadata] No active layers, using default context')
      return {
        prompt: DEFAULT_CONTEXT,
        layers: [],
      }
    }

    let prompt = '# CONTEXT LAYERS\n\n'
    prompt += 'The following layers inform your coaching style and knowledge:\n\n'

    const layerMetadata: ContextLayerMetadata[] = []

    layers.forEach((layer, idx) => {
      prompt += `## Layer ${idx + 1}: ${layer.name}\n\n`
      prompt += `${layer.content}\n\n`
      prompt += '---\n\n'

      layerMetadata.push({
        id: layer.id,
        name: layer.name,
        priority: layer.priority,
        contentLength: layer.content.length,
      })
    })

    prompt += '\nAnswer the user\'s question based on the context layers above. '
    prompt += 'Reference specific principles from the layers when relevant.\n'

    return {
      prompt,
      layers: layerMetadata,
    }
  } catch (error) {
    console.error('[composeContextWithMetadata] Error:', error)
    return {
      prompt: DEFAULT_CONTEXT,
      layers: [],
    }
  }
}

export function composeDrillSystemPrompt(drillContext: DrillContext): string {
  const { drill, hintsUsedCount } = drillContext
  const boardSummary = drill.boardSetup.summary

  return `
---

# DRILL MODE ACTIVE

You are helping the user practice this specific backgammon position:

**Position**: ${boardSummary}
**To Play**: ${drill.toPlay.charAt(0).toUpperCase() + drill.toPlay.slice(1)}
**Roll**: ${drill.roll.join('-')}
**Question**: ${drill.question}

**Core Principle**: ${drill.principle}

**Available Moves**:
${drill.options
  .map(
    (opt, idx) =>
      `${idx + 1}. ${opt.move} ${opt.isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
   ${opt.explanation}`
  )
  .join('\n\n')}

**Progressive Hints Available** (${hintsUsedCount}/${drill.hintsAvailable.length} used):
${drill.hintsAvailable
  .map((hint, idx) => {
    const hintNum = idx + 1
    if (idx < hintsUsedCount) {
      return `${hintNum}. [ALREADY PROVIDED] ${hint}`
    } else if (idx === hintsUsedCount) {
      return `${hintNum}. [NEXT HINT] ${hint}`
    } else {
      return `${hintNum}. [NOT YET PROVIDED]`
    }
  })
  .join('\n')}

---

## Your Role in Drill Mode

**When user selects a move** (e.g., "I choose option A" or "I choose option 2"):
- Tell them if it's correct or incorrect
- Provide the explanation for their choice
- Reference the core principle
- Encourage them or guide them to think more

**When user asks "hint" or "I'm stuck"**:
- If JSON hints remain: Provide the NEXT hint from the list above
  - Add label: "(Hint from training material)"
- If all JSON hints exhausted: Generate a helpful Socratic hint based on the principle
  - Add label: "(AI-generated hint)"
- Don't reveal the answer directly

**When user asks for explanation or "show answer"**:
- Explain why the correct move is best
- Reference the principle
- Compare with other options if relevant

**When user wants open discussion**:
- Discuss related strategy, alternative scenarios, or concepts
- Stay grounded in this position but can broaden if they ask

**Important**:
- Be concise and focused (mobile-friendly)
- Use short paragraphs
- Always reference the principle when explaining
- Adapt tone to be encouraging and educational
`.trim()
}
```

**Usage**: Use for composing corpus context in research recommendation generation

---

## Reusable UI Components

### components/layers/LayerCard.tsx

**Purpose**: Displays a single context layer with edit/delete/toggle actions

```tsx
'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import type { ContextLayer } from '@prisma/client'

interface LayerCardProps {
  layer: ContextLayer
  onEdit: () => void
  onDelete: () => void
  onToggle: (isActive: boolean) => void
}

export function LayerCard({ layer, onEdit, onDelete, onToggle }: LayerCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                layer.isActive ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={layer.isActive ? 'Active' : 'Inactive'}
            />
            <div>
              <CardTitle className="text-lg">
                Layer {layer.priority}: {layer.name}
              </CardTitle>
              {layer.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {layer.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={layer.isActive}
              onCheckedChange={onToggle}
              aria-label="Toggle layer active"
            />
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={layer.isBuiltIn}
              title={layer.isBuiltIn ? 'Cannot delete built-in layers' : 'Delete layer'}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {layer.content.substring(0, 200)}
          {layer.content.length > 200 && '...'}
        </p>
        <div className="flex gap-2 mt-3">
          {layer.isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
          <Badge>{layer.isActive ? 'Active' : 'Inactive'}</Badge>
          <Badge variant="outline">{layer.content.length} chars</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Adaptation Pattern**: For ProjectCard or KnowledgeFileCard, replace `layer` prop with `project` or `file` and adjust displayed fields accordingly.

---

### components/layers/LayerManager.tsx

**Purpose**: Manages list of context layers with CRUD operations

```tsx
'use client'

import { useState, useEffect } from 'react'
import { LayerCard } from './LayerCard'
import { LayerEditModal } from './LayerEditModal'
import { Button } from '@/components/ui/button'
import type { ContextLayer } from '@prisma/client'
import type { CreateLayerInput } from '@/lib/validation'

interface LayerManagerProps {
  projectId: string
}

export function LayerManager({ projectId }: LayerManagerProps) {
  const [layers, setLayers] = useState<ContextLayer[]>([])
  const [editingLayer, setEditingLayer] = useState<ContextLayer | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchLayers() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/project/${projectId}/context-layers`)
        if (!res.ok) throw new Error('Failed to fetch layers')
        const { layers } = await res.json()
        setLayers(layers)
      } catch (error) {
        console.error('Failed to fetch layers:', error)
        alert('Failed to load layers. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLayers()
  }, [projectId])

  async function handleCreate(data: CreateLayerInput) {
    try {
      const res = await fetch(`/api/project/${projectId}/context-layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create layer')
      }

      // Refetch to get updated list
      setIsLoading(true)
      try {
        const res = await fetch(`/api/project/${projectId}/context-layers`)
        if (!res.ok) throw new Error('Failed to fetch layers')
        const { layers } = await res.json()
        setLayers(layers)
      } finally {
        setIsLoading(false)
      }

      setIsCreateOpen(false)
    } catch (error) {
      console.error('Failed to create layer:', error)
      alert(error instanceof Error ? error.message : 'Failed to create layer')
      throw error
    }
  }

  async function handleUpdate(layerId: string, data: CreateLayerInput) {
    try {
      const res = await fetch(`/api/project/${projectId}/context-layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update layer')
      }

      // Refetch to get updated list
      setIsLoading(true)
      try {
        const res = await fetch(`/api/project/${projectId}/context-layers`)
        if (!res.ok) throw new Error('Failed to fetch layers')
        const { layers } = await res.json()
        setLayers(layers)
      } finally {
        setIsLoading(false)
      }

      setEditingLayer(null)
    } catch (error) {
      console.error('Failed to update layer:', error)
      alert(error instanceof Error ? error.message : 'Failed to update layer')
      throw error
    }
  }

  async function handleDelete(layerId: string) {
    if (!confirm('Are you sure you want to delete this layer?')) return

    try {
      const res = await fetch(`/api/project/${projectId}/context-layers/${layerId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete layer')
      }

      // Refetch to get updated list
      setIsLoading(true)
      try {
        const res = await fetch(`/api/project/${projectId}/context-layers`)
        if (!res.ok) throw new Error('Failed to fetch layers')
        const { layers } = await res.json()
        setLayers(layers)
      } finally {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Failed to delete layer:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete layer')
    }
  }

  async function handleToggle(layerId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/project/${projectId}/context-layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })

      if (!res.ok) throw new Error('Failed to toggle layer')

      // Refetch to get updated list
      setIsLoading(true)
      try {
        const res = await fetch(`/api/project/${projectId}/context-layers`)
        if (!res.ok) throw new Error('Failed to fetch layers')
        const { layers } = await res.json()
        setLayers(layers)
      } finally {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Failed to toggle layer:', error)
      alert('Failed to toggle layer. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading layers...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Context Layers</h2>
        <Button onClick={() => setIsCreateOpen(true)}>+ New Layer</Button>
      </div>

      {layers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">No context layers yet.</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            Create your first layer
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {layers.map((layer) => (
            <LayerCard
              key={layer.id}
              layer={layer}
              onEdit={() => setEditingLayer(layer)}
              onDelete={() => handleDelete(layer.id)}
              onToggle={(active) => handleToggle(layer.id, active)}
            />
          ))}
        </div>
      )}

      <LayerEditModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSave={handleCreate}
      />

      {editingLayer && (
        <LayerEditModal
          layer={editingLayer}
          open={!!editingLayer}
          onOpenChange={(open) => !open && setEditingLayer(null)}
          onSave={(data) => handleUpdate(editingLayer.id, data)}
        />
      )}
    </div>
  )
}
```

**Adaptation Pattern**: For KnowledgeFileManager or ProjectList, replace `layers` with `files` or `projects` and adjust API endpoints accordingly.

---

### components/layers/LayerEditModal.tsx

**Purpose**: Modal form for creating/editing context layers

```tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ContextLayer } from '@prisma/client'
import type { CreateLayerInput } from '@/lib/validation'

interface LayerEditModalProps {
  layer?: ContextLayer
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: CreateLayerInput) => Promise<void>
}

export function LayerEditModal({
  layer,
  open,
  onOpenChange,
  onSave,
}: LayerEditModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(1)
  const [content, setContent] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when layer changes or modal opens
  useEffect(() => {
    if (open) {
      if (layer) {
        setName(layer.name)
        setDescription(layer.description || '')
        setPriority(layer.priority)
        setContent(layer.content)
        setIsActive(layer.isActive)
      } else {
        setName('')
        setDescription('')
        setPriority(1)
        setContent('')
        setIsActive(true)
      }
    }
  }, [layer, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await onSave({
        name,
        description: description || undefined,
        priority,
        content,
        isActive,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save layer:', error)
      alert('Failed to save layer. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{layer ? 'Edit Layer' : 'Create Layer'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Backgammon Fundamentals"
              required
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description for tooltips..."
              maxLength={500}
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="priority">Priority (1 = first, 2 = second, ...)</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
              min={1}
              required
            />
          </div>

          <div>
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Layer context (markdown supported)..."
              rows={15}
              className="font-mono text-sm"
              required
              maxLength={50000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {content.length.toLocaleString()} / 50,000 characters
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
            <Label htmlFor="active">Active (include in LLM context)</Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : layer ? 'Save Changes' : 'Create Layer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Adaptation Pattern**: For CreateProjectModal or CreateKnowledgeFileModal, replace form fields with appropriate model properties.

---

## API Route Patterns

### app/api/project/[id]/context-layers/route.ts

**Purpose**: CRUD API routes for context layers (GET list, POST create)

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CreateLayerSchema } from '@/lib/validation'
import { z } from 'zod'

// GET - List all layers for a project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const layers = await prisma.contextLayer.findMany({
      where: { projectId },
      orderBy: { priority: 'asc' },
    })

    return NextResponse.json({ layers })
  } catch (error) {
    console.error('[GET /api/project/[id]/context-layers] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch layers' },
      { status: 500 }
    )
  }
}

// POST - Create a new layer
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await req.json()

    // Validate input
    const data = CreateLayerSchema.parse(body)

    // Check if priority already exists
    const existingLayer = await prisma.contextLayer.findFirst({
      where: {
        projectId,
        priority: data.priority,
      },
    })

    if (existingLayer) {
      return NextResponse.json(
        { error: `Priority ${data.priority} already exists. Choose a different priority.` },
        { status: 400 }
      )
    }

    // Create layer
    const layer = await prisma.contextLayer.create({
      data: {
        projectId,
        ...data,
      },
    })

    return NextResponse.json({ layer }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[POST /api/project/[id]/context-layers] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create layer' },
      { status: 500 }
    )
  }
}
```

**Adaptation Pattern**:
1. For `app/api/project/[id]/knowledge-files/route.ts`: Replace `contextLayer` with `knowledgeFile`, replace `CreateLayerSchema` with `CreateKnowledgeFileSchema`
2. For `app/api/projects/route.ts`: Remove `projectId` from params, add `CreateProjectSchema` validation
3. For PATCH/DELETE routes: Create `app/api/project/[id]/context-layers/[layerId]/route.ts` with similar pattern

---

## Usage Notes

### Adapting Components for New Models

**Example: Creating ProjectCard from LayerCard**

```tsx
// components/projects/ProjectCard.tsx
// Based on: components/layers/LayerCard.tsx

'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Project } from '@prisma/client'

interface ProjectCardProps {
  project: Project
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ProjectCard({ project, onOpen, onEdit, onDelete }: ProjectCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onOpen}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{project.icon || '🎯'}</div>
            <div>
              <CardTitle className="text-lg">{project.name}</CardTitle>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {project.gameType && <Badge>{project.gameType}</Badge>}
      </CardContent>
    </Card>
  )
}
```

### Adapting API Routes for New Models

**Example: Creating knowledge-files route from context-layers route**

```typescript
// app/api/project/[id]/knowledge-files/route.ts
// Based on: app/api/project/[id]/context-layers/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CreateKnowledgeFileSchema } from '@/lib/validation'
import { z } from 'zod'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const files = await prisma.knowledgeFile.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ files })
  } catch (error) {
    console.error('[GET /api/project/[id]/knowledge-files] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch knowledge files' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await req.json()

    const data = CreateKnowledgeFileSchema.parse(body)

    const file = await prisma.knowledgeFile.create({
      data: {
        projectId,
        ...data,
        fileSize: data.content.length,
      },
    })

    return NextResponse.json({ file }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[POST /api/project/[id]/knowledge-files] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create knowledge file' },
      { status: 500 }
    )
  }
}
```

---

## Dependencies Required

These patterns require the following npm packages:

```json
{
  "@prisma/client": "^5.22.0",
  "@radix-ui/react-dialog": "^1.1.2",
  "@radix-ui/react-label": "^2.1.0",
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-switch": "^1.1.1",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.462.0",
  "next": "15.2.4",
  "react": "19.1.1",
  "react-dom": "19.1.1",
  "tailwind-merge": "^2.6.0",
  "zod": "^3.24.1"
}
```

See `guru-builder-project-setup.md` for complete package.json

---

**End of Foundation Code Reference**
**Total Lines**: ~860 lines of reusable code
**Last Updated**: 2025-01-08
