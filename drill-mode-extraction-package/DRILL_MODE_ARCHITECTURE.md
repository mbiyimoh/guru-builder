# Drill Mode Chat Architecture: Complete Extraction Guide

**Purpose**: Comprehensive blueprint for building an AI-powered drill/testing system with context layers, reasoning audit tracking, and position-based chat. Extract this complete functionality to test "gurus" against mathematical engines.

**Based on**: Backgammon Guru drill mode implementation

**Use Case**: Copy this architecture to build similar testing systems where you present a position (chess, backgammon, Go, etc.), chat with an AI "guru" about it, and compare responses against a mathematical engine's calculations.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Drill Mode vs Open Chat Architecture](#2-drill-mode-vs-open-chat-architecture)
3. [Context Layer System](#3-context-layer-system)
4. [Drill Data Structure](#4-drill-data-structure)
5. [Reasoning & Audit Tracking](#5-reasoning--audit-tracking)
6. [Chat Integration with Drill Context](#6-chat-integration-with-drill-context)
7. [Complete Code Examples](#7-complete-code-examples)
8. [Integration Checklist](#8-integration-checklist)

---

## 1. System Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + AI SDK v5)                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ Drill Chat UI    │  │ Board Display    │                     │
│  │ (useChat hook)   │  │ (ASCII/Visual)   │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
└───────────┼──────────────────────┼───────────────────────────────┘
            │                      │
            ↓                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API ROUTES (Next.js)                          │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ POST /api/chat   │  │ Drill APIs       │                     │
│  │ (dual-mode)      │  │ (hints/answers)  │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
└───────────┼──────────────────────┼───────────────────────────────┘
            │                      │
            ↓                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CORE LOGIC LAYER                              │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ Context Composer │  │ Audit Tracking   │                     │
│  │ (layers + drill) │  │ (reasoning/cost) │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
└───────────┼──────────────────────┼───────────────────────────────┘
            │                      │
            ↓                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA & AI PROVIDERS                           │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ PostgreSQL       │  │ AI Models        │                     │
│  │ (Prisma ORM)     │  │ - Claude Sonnet  │                     │
│  │ - ContextLayers  │  │   (drill mode)   │                     │
│  │ - Drill JSON     │  │ - GPT-4o-mini    │                     │
│  │                  │  │   (open chat)    │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User enters drill** → Drill selected → Board position displayed
2. **System composes context** → Base layers + drill-specific prompt
3. **User chats about position** → AI responds with extended thinking
4. **Audit trail created** → Reasoning, tokens, costs tracked
5. **User views audit** → Sees exactly what context informed response

### Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, AI SDK v5
- **AI Models**:
  - Claude 3.7 Sonnet (drill mode - extended thinking, 5000 token budget)
  - GPT-4o-mini (open chat - cost-effective)
- **Database**: PostgreSQL + Prisma ORM
- **Validation**: Zod for runtime type checking
- **UI**: Tailwind CSS + shadcn/ui components

---

## 2. Drill Mode vs Open Chat Architecture

### Dual-Mode Pattern

The system supports TWO distinct operational modes with different AI models and context:

#### **Open Chat Mode**
- **Model**: GPT-4o-mini ($0.15/$0.60 per 1M tokens)
- **Context**: Base context layers only
- **Use Case**: General questions, exploration, learning
- **Behavior**: Conversational, broad advice

#### **Drill Mode**
- **Model**: Claude 3.7 Sonnet ($3/$15 per 1M tokens)
- **Extended Thinking**: 5000 token budget for reasoning
- **Context**: Base layers + drill-specific context
- **Use Case**: Focused practice on specific positions
- **Behavior**: Position-specific, pedagogical, detailed reasoning

### Mode Selection Implementation

```typescript
// Frontend - Request-level body configuration (prevents stale closures)
sendMessage(
  { text: userInput },
  {
    body: {
      projectId: 'default-project',
      mode,           // 'open' or 'drill'
      drillContext,   // Only present in drill mode
    }
  }
)

// Backend - Model selection based on mode
const model = mode === 'drill'
  ? anthropic('claude-3-7-sonnet-20250219')      // Rich reasoning
  : openai('gpt-4o-mini')                        // Cost-efficient

// Backend - Extended thinking for drill mode
const result = mode === 'drill'
  ? streamText({
      model,
      messages,
      providerOptions: {
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: 5000,  // Extended reasoning budget
          },
        },
      },
    })
  : streamText({ model, messages })
```

**Key Insight**: Same chat endpoint supports both modes via mode parameter. This allows seamless switching without component re-mounting issues.

---

## 3. Context Layer System

### Concept

**Problem**: AI needs domain knowledge (backgammon strategy, chess principles, etc.), but maintaining one massive system prompt is unwieldy.

**Solution**: Multi-layer context system where domain knowledge is broken into modular, editable layers that compose into a system prompt at request time.

### Database Schema

```prisma
model Project {
  id              String          @id @default(cuid())
  name            String
  contextLayers   ContextLayer[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model ContextLayer {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name        String              // e.g., "Opening Principles"
  description String?             // Optional tooltip
  priority    Int                 // 1 = first, 2 = second, etc.
  content     String   @db.Text   // Markdown/text context

  isActive    Boolean  @default(true)    // Toggle without deletion
  isBuiltIn   Boolean  @default(false)   // Prevent deletion

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, priority])  // Prevent conflicts
  @@index([projectId, isActive])
}
```

### Context Composition

```typescript
// lib/contextComposer.ts
export async function composeContextFromLayers(
  projectId: string,
  layerIds?: string[]
): Promise<string> {
  const layers = await prisma.contextLayer.findMany({
    where: {
      projectId,
      isActive: true,
      ...(layerIds?.length ? { id: { in: layerIds } } : {}),
    },
    orderBy: { priority: 'asc' },
  })

  if (layers.length === 0) {
    return DEFAULT_CONTEXT
  }

  let prompt = '# CONTEXT LAYERS\n\n'
  prompt += 'The following layers inform your coaching:\n\n'

  layers.forEach((layer, idx) => {
    prompt += `## Layer ${idx + 1}: ${layer.name}\n\n`
    prompt += `${layer.content}\n\n---\n\n`
  })

  prompt += '\nAnswer based on the context layers above.\n'
  return prompt
}
```

**Output Example**:
```
# CONTEXT LAYERS

The following layers inform your coaching:

## Layer 1: Backgammon Fundamentals

[Backgammon rules, checker movement, basic strategy...]

---

## Layer 2: Opening Strategy

[Opening roll principles, point-making priorities...]

---

Answer based on the context layers above.
```

### Context Composition with Metadata (for Audit Trails)

```typescript
export interface ContextLayerMetadata {
  id: string
  name: string
  priority: number
  contentLength: number
}

export interface ContextWithMetadata {
  prompt: string
  layers: ContextLayerMetadata[]
}

export async function composeContextWithMetadata(
  projectId: string,
  layerIds?: string[]
): Promise<ContextWithMetadata> {
  const layers = await prisma.contextLayer.findMany({
    where: { projectId, isActive: true, ...(layerIds ? { id: { in: layerIds } } : {}) },
    orderBy: { priority: 'asc' },
  })

  if (layers.length === 0) {
    return { prompt: DEFAULT_CONTEXT, layers: [] }
  }

  let prompt = '# CONTEXT LAYERS\n\n...'
  const layerMetadata: ContextLayerMetadata[] = []

  layers.forEach((layer, idx) => {
    prompt += `## Layer ${idx + 1}: ${layer.name}\n\n${layer.content}\n\n---\n\n`

    layerMetadata.push({
      id: layer.id,
      name: layer.name,
      priority: layer.priority,
      contentLength: layer.content.length,
    })
  })

  return { prompt, layers: layerMetadata }
}
```

---

## 4. Drill Data Structure

### Drill JSON Format

Drills are stored as JSON files with comprehensive structure:

```json
{
  "moduleId": 1,
  "moduleName": "Basic Opening Rolls",
  "totalDrills": 24,
  "drills": [
    {
      "id": 1,
      "difficulty": "easy",
      "category": "mandatory-points",
      "position": {
        "black": "24(2), 13(5), 8(3), 6(5)",
        "white": "1(2), 12(5), 17(3), 19(5)"
      },
      "boardSetup": {
        "points": {
          "24": { "color": "black", "checkers": 2 },
          "13": { "color": "black", "checkers": 5 },
          // ... all 24 points
        },
        "bar": { "black": 0, "white": 0 },
        "off": { "black": 0, "white": 0 },
        "summary": "Black: 2 on 24, 5 on 13... (human-readable)"
      },
      "toPlay": "black",
      "roll": [3, 1],
      "question": "Black to play 3-1. What's your best opening move?",
      "options": [
        {
          "move": "8/5, 6/5",
          "isCorrect": true,
          "explanation": "Makes the golden 5-point..."
        },
        {
          "move": "24/21, 13/12",
          "isCorrect": false,
          "explanation": "Splitting is solid but..."
        }
        // ... 3-5 total options
      ],
      "principle": "When you can make the 5-point with 3-1, it's mandatory.",
      "hintsAvailable": [
        "Think about which point is most valuable",
        "Can you make a key point with this roll?",
        "The 5-point is called 'golden' for a reason"
      ]
    }
  ]
}
```

### Drill Schema Validation (Zod)

```typescript
// lib/drillSchema.ts
import { z } from 'zod'

const BoardSetupSchema = z.object({
  points: z.record(z.string(), z.object({
    color: z.enum(['black', 'white']).nullable(),
    checkers: z.number().int().min(0).max(15),
  })),
  bar: z.object({
    black: z.number().int().min(0).max(15),
    white: z.number().int().min(0).max(15),
  }),
  off: z.object({
    black: z.number().int().min(0).max(15),
    white: z.number().int().min(0).max(15),
  }),
  summary: z.string(),
})

const DrillOptionSchema = z.object({
  move: z.string(),
  isCorrect: z.boolean(),
  explanation: z.string().min(20).max(1000),
})

const DrillSchema = z.object({
  id: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string(),
  boardSetup: BoardSetupSchema,
  toPlay: z.enum(['black', 'white']),
  roll: z.tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)]),
  question: z.string().min(10).max(500),
  options: z.array(DrillOptionSchema).min(2).max(10),
  principle: z.string().min(10).max(500),
  hintsAvailable: z.array(z.string()).min(1).max(5),
}).refine(
  (drill) => drill.options.filter(opt => opt.isCorrect).length >= 1,
  { message: 'At least one option must be marked correct' }
)
```

### Drill Loading System

```typescript
// lib/drillLoader.ts
import { promises as fs } from 'fs'
import path from 'path'
import { DrillModuleSchema } from './drillSchema'

export async function loadDrillModule(moduleId: number) {
  const filePath = path.join(
    process.cwd(),
    'project-context',
    `module_${String(moduleId).padStart(2, '0')}_drills.json`
  )

  const fileContent = await fs.readFile(filePath, 'utf-8')
  const rawData = JSON.parse(fileContent)

  // Validate with Zod
  const module = DrillModuleSchema.parse(rawData)
  return module
}

export async function getDrill(moduleId: number, drillId: number) {
  const module = await loadDrillModule(moduleId)
  const drill = module.drills.find(d => d.id === drillId)

  if (!drill) {
    throw new Error(`Drill ${drillId} not found in module ${moduleId}`)
  }

  return drill
}
```

---

## 5. Reasoning & Audit Tracking

### The Race Condition Problem

**Problem**: Streaming responses return before reasoning/usage data is available. If user clicks "View Audit" immediately, data doesn't exist yet.

**Solution**: Placeholder + Update pattern

```typescript
// 1. Create placeholder IMMEDIATELY (before streaming)
createPlaceholderAuditTrail({
  messageId,
  model: AI_MODELS.DRILL,
  contextLayers: layersMetadata,
  knowledgeFiles: drillMetadata,
})

// 2. Start streaming (returns to user immediately)
const result = streamText({ ... })

// 3. Update with full data ASYNCHRONOUSLY (when ready)
Promise.all([result.reasoning, result.usage])
  .then(([reasoning, usage]) => {
    updateAuditTrailWithData({
      messageId,
      model: AI_MODELS.DRILL,
      usage,
      reasoning: reasoning?.map(r => r.text).join('\n\n'),
    })
  })
  .catch(error => console.error('Audit update failed:', error))

return result.toUIMessageStreamResponse({
  headers: { 'x-message-id': messageId },
})
```

### Audit Trail Data Structure

```typescript
interface AuditTrail {
  messageId: string
  timestamp: Date
  model: ModelName

  // Claude's extended thinking traces
  reasoning?: string[]

  // Context layers used (with metadata for transparency)
  contextLayers: ContextLayerMetadata[]

  // Knowledge files (drills tracked as knowledge files)
  knowledgeFiles: KnowledgeFileMetadata[]

  // Token usage
  tokens: {
    prompt: number
    completion: number
    reasoning?: number   // Included in completion for Claude
    total: number
  }

  // Cost calculation
  cost: {
    prompt: number       // $ cost
    completion: number   // $ cost
    reasoning?: number   // Included in completion for Claude
    total: number        // $ total cost
  }
}
```

### Audit Utils Implementation

```typescript
// lib/auditUtils.ts
import { storeAuditTrail, updateAuditTrail } from './auditStore'
import { MODEL_PRICING, ModelName } from './constants'

function calculateCosts(usage: ModelUsage, modelName: ModelName) {
  const pricing = MODEL_PRICING[modelName]
  const promptCost = ((usage.inputTokens || 0) / 1_000_000) * pricing.input
  const completionCost = ((usage.outputTokens || 0) / 1_000_000) * pricing.output

  return {
    prompt: promptCost,
    completion: completionCost,
    total: promptCost + completionCost,
  }
}

export function createPlaceholderAuditTrail(params: {
  messageId: string
  model: ModelName
  contextLayers?: ContextLayerMetadata[]
  knowledgeFiles?: KnowledgeFileMetadata[]
}) {
  const placeholderAuditTrail = {
    messageId: params.messageId,
    timestamp: new Date(),
    model: params.model,
    reasoning: undefined,
    contextLayers: params.contextLayers || [],
    knowledgeFiles: params.knowledgeFiles || [],
    tokens: { prompt: 0, completion: 0, total: 0 },
    cost: { prompt: 0, completion: 0, total: 0 },
  }

  storeAuditTrail(placeholderAuditTrail)
}

export function updateAuditTrailWithData(params: {
  messageId: string
  model: ModelName
  usage: ModelUsage
  reasoning?: string
}) {
  const costs = calculateCosts(params.usage, params.model)
  const reasoningArray = params.reasoning ? [params.reasoning] : undefined

  updateAuditTrail(params.messageId, {
    reasoning: reasoningArray,
    tokens: {
      prompt: params.usage.inputTokens || 0,
      completion: params.usage.outputTokens || 0,
      total: params.usage.totalTokens || 0,
    },
    cost: costs,
  })
}

export function generateMessageId(): string {
  return crypto.randomUUID()
}
```

### Audit Store (In-Memory)

```typescript
// lib/auditStore.ts
const auditStore = new Map<string, AuditTrail>()
const RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000 // 7 days

export function storeAuditTrail(trail: AuditTrail) {
  auditStore.set(trail.messageId, trail)

  // Cleanup old trails
  const cutoff = Date.now() - RETENTION_PERIOD
  for (const [id, t] of auditStore.entries()) {
    if (t.timestamp.getTime() < cutoff) {
      auditStore.delete(id)
    }
  }
}

export function getAuditTrail(messageId: string): AuditTrail | undefined {
  return auditStore.get(messageId)
}

export function updateAuditTrail(messageId: string, updates: Partial<AuditTrail>) {
  const existing = auditStore.get(messageId)
  if (existing) {
    auditStore.set(messageId, { ...existing, ...updates })
  }
}
```

### Model Pricing Configuration

```typescript
// lib/constants.ts
export const MODEL_PRICING = {
  'claude-3-7-sonnet-20250219': {
    input: 3.00,
    output: 15.00,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
  },
} as const

export const AI_MODELS = {
  DRILL: 'claude-3-7-sonnet-20250219',
  CHAT_OPEN: 'gpt-4o-mini',
} as const

export const THINKING_BUDGET = {
  DRILL: 5000,  // Extended thinking token budget
  CHAT: 3000,
} as const
```

---

## 6. Chat Integration with Drill Context

### Drill System Prompt Composition

When drill mode is active, append drill-specific context to base layers:

```typescript
// lib/contextComposer.ts
export function composeDrillSystemPrompt(drillContext: DrillContext): string {
  const { drill, hintsUsedCount } = drillContext
  const boardSummary = drill.boardSetup.summary

  return `
---

# DRILL MODE ACTIVE

You are helping the user practice this specific position:

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
    if (idx < hintsUsedCount) return `${idx + 1}. [ALREADY PROVIDED] ${hint}`
    if (idx === hintsUsedCount) return `${idx + 1}. [NEXT HINT] ${hint}`
    return `${idx + 1}. [NOT YET PROVIDED]`
  })
  .join('\n')}

---

## Your Role in Drill Mode

**When user selects a move**:
- Tell them if correct/incorrect
- Provide the explanation
- Reference the core principle
- Encourage or guide

**When user asks for hint**:
- If JSON hints remain: Provide NEXT hint with label "(Hint from training material)"
- If all exhausted: Generate Socratic hint with label "(AI-generated hint)"
- Don't reveal answer

**When user asks for explanation**:
- Explain why correct move is best
- Reference principle
- Compare with other options

**When user wants discussion**:
- Discuss related strategy
- Stay grounded in this position
- Broaden if they ask

**Important**:
- Be concise (mobile-friendly)
- Short paragraphs
- Always reference principle
- Encouraging and educational tone
`.trim()
}
```

### Full Chat API Route (Dual-Mode)

```typescript
// app/api/chat/route.ts
import { streamText, convertToCoreMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { composeContextWithMetadata, composeDrillSystemPrompt } from '@/lib/contextComposer'
import { AI_MODELS, THINKING_BUDGET } from '@/lib/constants'
import { generateMessageId, createPlaceholderAuditTrail, updateAuditTrailWithData } from '@/lib/auditUtils'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages: uiMessages,
      projectId = 'default-project',
      mode = 'open',
      drillContext,
      layerIds,
    } = body

    // 1. Compose base context layers with metadata
    const contextResult = await composeContextWithMetadata(projectId, layerIds)
    let systemPrompt = contextResult.prompt
    const contextLayersMetadata = contextResult.layers
    const knowledgeFilesMetadata = []

    // 2. If drill mode, append drill-specific context
    if (mode === 'drill' && drillContext) {
      const drillPrompt = composeDrillSystemPrompt(drillContext)
      systemPrompt += '\n\n' + drillPrompt

      // Track drill as knowledge file for audit trail
      knowledgeFilesMetadata.push({
        id: `drill-${drillContext.drillId}`,
        title: `Drill ${drillContext.drillId}`,
        category: 'drill',
        contentLength: drillPrompt.length,
      })
    }

    // 3. Convert UI messages to core messages
    const coreMessages = convertToCoreMessages(uiMessages || [])

    // 4. Build final messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...coreMessages,
    ]

    // 5. Select model based on mode
    const model = mode === 'drill'
      ? anthropic(AI_MODELS.DRILL)
      : openai(AI_MODELS.CHAT_OPEN)

    // 6. Generate unique messageId for audit tracking
    const messageId = generateMessageId()

    // 7. Create placeholder audit trail IMMEDIATELY (prevents race condition)
    if (mode === 'drill') {
      createPlaceholderAuditTrail({
        messageId,
        model: AI_MODELS.DRILL,
        contextLayers: contextLayersMetadata,
        knowledgeFiles: knowledgeFilesMetadata,
      })
    }

    // 8. Stream response with extended thinking for drill mode
    const result = mode === 'drill'
      ? streamText({
          model,
          messages,
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: THINKING_BUDGET.DRILL,
              },
            },
          },
        })
      : streamText({ model, messages })

    // 9. Update audit trail ASYNCHRONOUSLY when data ready (drill mode only)
    if (mode === 'drill') {
      Promise.all([result.reasoning, result.usage])
        .then(([reasoning, usage]) => {
          updateAuditTrailWithData({
            messageId,
            model: AI_MODELS.DRILL,
            usage,
            reasoning: reasoning?.map(r => r.text).join('\n\n'),
          })
        })
        .catch(error => {
          console.error('[POST /api/chat] Failed to update audit trail:', error)
        })
    }

    // 10. Return streaming response with messageId in headers
    return result.toUIMessageStreamResponse({
      headers: {
        'x-message-id': messageId,
        'Access-Control-Expose-Headers': 'x-message-id',
      },
    })
  } catch (error) {
    console.error('[POST /api/chat] Error:', error)
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 })
  }
}
```

### Frontend Chat Component (Drill Mode)

```typescript
// components/chat/BackgammonChat.tsx (SIMPLIFIED EXCERPT)
'use client'

import { useChat } from '@ai-sdk/react'
import { DrillBoard } from '@/components/drill/DrillBoard'
import { ContextAuditModal } from '@/components/chat/ContextAuditModal'

export function BackgammonChat({ mode = 'open', drill, moduleId, onExitDrill }) {
  const [hintsUsed, setHintsUsed] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [auditModalOpen, setAuditModalOpen] = useState(false)

  const drillContext = drill && moduleId
    ? { drillId: drill.id, moduleId, drill, hintsUsedCount: hintsUsed }
    : undefined

  // ✅ CRITICAL: No body in useChat initialization (prevents stale closures)
  const { messages, sendMessage, status } = useChat({
    id: mode === 'drill' && drill ? `drill-${drill.id}` : 'open-chat',
    api: '/api/chat',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      // ✅ CRITICAL: Pass body at request time (fresh values)
      sendMessage(
        { text: inputValue },
        {
          body: {
            projectId: 'default-project',
            mode,           // Current mode
            drillContext,   // Fresh drill context
          }
        }
      )
      setInputValue('')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode indicator */}
      <div className="border-b p-3">
        <span>{mode === 'drill' ? '🎯 Drill Mode' : '💬 Open Chat'}</span>
        {mode === 'drill' && drill && (
          <span>Drill #{drill.id} • {drill.difficulty}</span>
        )}
      </div>

      {/* Drill board (drill mode only) */}
      {mode === 'drill' && drill && (
        <div className="p-4 border-b">
          <DrillBoard
            boardSetup={drill.boardSetup}
            toPlay={drill.toPlay}
            roll={drill.roll}
            question={drill.question}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => {
          const messageIdFromMetadata = message.metadata?.messageId
          const hasAuditTrail = !!messageIdFromMetadata

          return (
            <div key={message.id} className="message">
              <p>{message.content}</p>
              {hasAuditTrail && message.role === 'assistant' && (
                <button
                  onClick={() => {
                    setSelectedMessageId(messageIdFromMetadata!)
                    setAuditModalOpen(true)
                  }}
                >
                  View Context Audit
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={mode === 'drill' ? 'Ask about the position...' : 'Ask anything...'}
          disabled={status === 'streaming'}
        />
        <button type="submit" disabled={status === 'streaming'}>
          Send
        </button>
      </form>

      {/* Audit Modal */}
      <ContextAuditModal
        messageId={selectedMessageId}
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
      />
    </div>
  )
}
```

---

## 7. Complete Code Examples

### ASCII Board Display

```typescript
// lib/asciiBoard.ts
export function renderASCIIBoard(
  boardSetup: BoardSetup,
  toPlay: 'black' | 'white',
  roll: [number, number]
): string {
  const { points, bar, off } = boardSetup

  const getPoint = (num: number) => {
    const key = String(num)
    return points[key] || { color: null, checkers: 0 }
  }

  const renderCheckers = (color: 'black' | 'white' | null, count: number, maxDisplay = 5) => {
    if (!color || count === 0) return '   '
    const symbol = color === 'black' ? '●' : '○'
    if (count <= maxDisplay) return symbol.repeat(count).padEnd(6)
    return `${symbol.repeat(maxDisplay)}+${count - maxDisplay}`.padEnd(6)
  }

  const lines: string[] = []
  lines.push('┌────────────────────────────────────────┐')
  lines.push('│  13  14  15  16  17  18 │ 19  20  21  22  23  24 │')
  lines.push('│  ' + [13, 14, 15, 16, 17, 18].map(p => {
    const point = getPoint(p)
    return renderCheckers(point.color, point.checkers)
  }).join('') + '│' + [19, 20, 21, 22, 23, 24].map(p => {
    const point = getPoint(p)
    return renderCheckers(point.color, point.checkers)
  }).join('') + '│')
  lines.push('├────────────────────────────────────────┤')
  lines.push(`│          BAR: ${bar.black}● / ${bar.white}○           │`)
  lines.push('├────────────────────────────────────────┤')
  lines.push('│  12  11  10   9   8   7 │  6   5   4   3   2   1 │')
  lines.push('│  ' + [12, 11, 10, 9, 8, 7].map(p => {
    const point = getPoint(p)
    return renderCheckers(point.color, point.checkers)
  }).join('') + '│' + [6, 5, 4, 3, 2, 1].map(p => {
    const point = getPoint(p)
    return renderCheckers(point.color, point.checkers)
  }).join('') + '│')
  lines.push('└────────────────────────────────────────┘')
  lines.push(`OFF: Black ${off.black}●  White ${off.white}○`)
  lines.push(`TO PLAY: ${toPlay.toUpperCase()}`)
  lines.push(`ROLL: ${roll.join('-')}`)

  return lines.join('\n')
}
```

### Audit Trail Modal

```typescript
// components/chat/ContextAuditModal.tsx
'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useEffect, useState } from 'react'

export function ContextAuditModal({ messageId, isOpen, onClose }) {
  const [auditTrail, setAuditTrail] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && messageId) {
      setLoading(true)
      fetch(`/api/audit/${messageId}`)
        .then(res => res.json())
        .then(data => setAuditTrail(data.auditTrail))
        .catch(err => console.error('Failed to load audit trail:', err))
        .finally(() => setLoading(false))
    }
  }, [messageId, isOpen])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Context Audit</h2>

        {loading && <p>Loading audit trail...</p>}

        {auditTrail && (
          <div className="space-y-4">
            {/* Model & Tokens */}
            <div>
              <h3 className="font-semibold">Model</h3>
              <p>{auditTrail.model}</p>
            </div>

            <div>
              <h3 className="font-semibold">Token Usage</h3>
              <p>Prompt: {auditTrail.tokens.prompt.toLocaleString()}</p>
              <p>Completion: {auditTrail.tokens.completion.toLocaleString()}</p>
              <p>Total: {auditTrail.tokens.total.toLocaleString()}</p>
            </div>

            <div>
              <h3 className="font-semibold">Cost</h3>
              <p>Prompt: ${auditTrail.cost.prompt.toFixed(4)}</p>
              <p>Completion: ${auditTrail.cost.completion.toFixed(4)}</p>
              <p className="font-bold">Total: ${auditTrail.cost.total.toFixed(4)}</p>
            </div>

            {/* Reasoning */}
            {auditTrail.reasoning && (
              <div>
                <h3 className="font-semibold">Extended Thinking</h3>
                {auditTrail.reasoning.map((trace, idx) => (
                  <div key={idx} className="bg-muted p-3 rounded mt-2">
                    <pre className="whitespace-pre-wrap text-sm">{trace}</pre>
                  </div>
                ))}
              </div>
            )}

            {/* Context Layers */}
            <div>
              <h3 className="font-semibold">Context Layers Used</h3>
              <ul className="list-disc pl-5">
                {auditTrail.contextLayers.map(layer => (
                  <li key={layer.id}>
                    {layer.name} (Priority: {layer.priority}, Length: {layer.contentLength})
                  </li>
                ))}
              </ul>
            </div>

            {/* Knowledge Files (Drills) */}
            {auditTrail.knowledgeFiles.length > 0 && (
              <div>
                <h3 className="font-semibold">Knowledge Files Used</h3>
                <ul className="list-disc pl-5">
                  {auditTrail.knowledgeFiles.map(file => (
                    <li key={file.id}>
                      {file.title} ({file.category}, Length: {file.contentLength})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

---

## 8. Integration Checklist

### Phase 1: Setup & Dependencies

- [ ] Install dependencies:
  ```bash
  npm install @ai-sdk/react @ai-sdk/anthropic @ai-sdk/openai ai @prisma/client prisma zod
  ```
- [ ] Set up environment variables:
  ```bash
  DATABASE_URL=postgresql://...
  ANTHROPIC_API_KEY=sk-ant-...
  OPENAI_API_KEY=sk-...
  ```
- [ ] Initialize Prisma:
  ```bash
  npx prisma init
  ```

### Phase 2: Database Schema

- [ ] Copy `prisma/schema.prisma` (ContextLayer model)
- [ ] Run migration:
  ```bash
  npx prisma migrate dev --name add_context_layers
  npx prisma generate
  ```
- [ ] Create seed script for default context layers

### Phase 3: Core Logic

- [ ] Create `lib/db.ts` (Prisma singleton)
- [ ] Create `lib/types.ts` (TypeScript types)
- [ ] Create `lib/constants.ts` (AI models, pricing)
- [ ] Create `lib/contextComposer.ts` (context composition)
- [ ] Create `lib/auditUtils.ts` (audit trail creation)
- [ ] Create `lib/auditStore.ts` (in-memory storage)
- [ ] Create `lib/drillSchema.ts` (Zod validation)
- [ ] Create `lib/drillLoader.ts` (JSON loading)
- [ ] Create `lib/asciiBoard.ts` (board rendering)

### Phase 4: Drill Data

- [ ] Create `project-context/` folder
- [ ] Add drill JSON files (e.g., `module_01_drills.json`)
- [ ] Validate drill structure with Zod

### Phase 5: API Routes

- [ ] Create `app/api/chat/route.ts` (dual-mode chat)
- [ ] Create `app/api/audit/[messageId]/route.ts` (audit retrieval)
- [ ] Create `app/api/modules/route.ts` (list modules)
- [ ] Create `app/api/modules/[moduleId]/route.ts` (get module)
- [ ] Create `app/api/modules/[moduleId]/drills/[drillId]/route.ts` (get drill)

### Phase 6: Frontend Components

- [ ] Create `components/drill/DrillBoard.tsx` (board display)
- [ ] Create `components/chat/BackgammonChat.tsx` (main chat UI)
- [ ] Create `components/chat/ContextAuditModal.tsx` (audit display)
- [ ] Add mode switcher UI
- [ ] Add drill selector UI

### Phase 7: Testing

- [ ] Test open chat mode
- [ ] Test drill mode with position display
- [ ] Test audit trail creation and display
- [ ] Test context layer composition
- [ ] Test extended thinking reasoning capture
- [ ] Verify costs calculated correctly

### Phase 8: Customization for Your Domain

- [ ] Replace drill JSON structure with your domain (chess, Go, etc.)
- [ ] Replace ASCII board with your visualization
- [ ] Update context layers for your domain knowledge
- [ ] Adjust AI models if needed (e.g., GPT-4 for chess)
- [ ] Customize drill-specific system prompt for your domain

---

## Summary

This architecture provides a complete, production-ready blueprint for building an AI-powered drill/testing system with:

1. **Multi-layer context system** - Modular, editable domain knowledge
2. **Dual-mode chat** - Different AI models for different use cases
3. **Extended thinking capture** - Claude's reasoning traces tracked and displayed
4. **Comprehensive audit trails** - Full transparency into what informed responses
5. **Position-based drill system** - Structured practice with specific setups
6. **Cost tracking** - Token usage and costs calculated per response

**Copy these patterns to build**:
- Chess position analysis vs Stockfish
- Go position evaluation vs KataGo
- Poker hand analysis vs solver
- Any domain where you test an AI "guru" against ground truth

**Key Files to Copy**:
- `lib/contextComposer.ts` - Context layer system
- `lib/auditUtils.ts` - Audit trail tracking
- `app/api/chat/route.ts` - Dual-mode streaming chat
- `components/chat/BackgammonChat.tsx` - Chat UI with drill mode
- `lib/drillLoader.ts` - Drill data loading
- `lib/asciiBoard.ts` - Position visualization

**Critical Patterns to Remember**:
- Request-level body configuration (prevents stale closures)
- Placeholder + update for audit trails (prevents race conditions)
- Extended thinking with 5000 token budget (rich reasoning)
- Separate models for different modes (cost optimization)
- Clean rebuild after significant changes: `rm -rf .next && npm run dev`

**Next Steps**:
1. Copy this documentation to your new project
2. Follow integration checklist step-by-step
3. Customize for your domain (replace backgammon with chess/Go/etc.)
4. Test drill mode thoroughly
5. Connect to your mathematical engine API
6. Compare guru responses vs engine calculations
