# Self-Assessment System - Task Breakdown (Phases 1 & 2)

Generated from: `specs/feat-self-assessment-system.md`

---

## Phase 1: Core Infrastructure (MVP)

### Task 1.1: Database Schema and Migration

**Objective**: Add three new models to Prisma schema and create migration

**Files to modify**:
- `prisma/schema.prisma`

**Implementation**:

```prisma
// Add after existing models in prisma/schema.prisma

model SelfAssessmentConfig {
  id           String   @id @default(cuid())
  projectId    String   @unique

  engineUrl    String   @default("https://gnubg-mcp-d1c3c7a814e8.herokuapp.com")
  isEnabled    Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sessions     AssessmentSession[]

  @@index([projectId])
}

model AssessmentSession {
  id           String   @id @default(cuid())
  configId     String

  startedAt    DateTime @default(now())
  endedAt      DateTime?

  config       SelfAssessmentConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
  results      AssessmentResult[]

  @@index([configId])
  @@index([startedAt])
}

model AssessmentResult {
  id           String   @id @default(cuid())
  sessionId    String

  diceRoll     String
  position     String   @default("opening")

  guruResponse String   @db.Text

  bestMoves    Json

  guruMatchedBest Boolean?

  createdAt    DateTime @default(now())

  session      AssessmentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([createdAt])
}
```

Also update the existing Project model:

```prisma
model Project {
  // ... existing fields ...

  // Add this relation
  assessmentConfig SelfAssessmentConfig?

  // ... existing relations ...
}
```

**Commands to run**:
```bash
npm run db:backup
npm run migrate:safe -- add-self-assessment-models
npx prisma generate
```

**Verification**: Run `npx prisma studio` and confirm new tables exist

---

### Task 1.2: Core Types and Constants

**Objective**: Create TypeScript types for assessment system

**Files to create**:
- `lib/assessment/types.ts`

**Implementation**:

```typescript
// lib/assessment/types.ts

export interface BackgammonBoard {
  o: Record<string, number>
  x: Record<string, number>
}

export const OPENING_POSITION: BackgammonBoard = {
  o: { "6": 5, "8": 3, "13": 5, "24": 2 },
  x: { "6": 5, "8": 3, "13": 5, "24": 2 }
}

export interface BackgammonRequest {
  board: BackgammonBoard
  dice: [number, number]
  player: 'x' | 'o'
  cubeful: boolean
  'max-moves': number
  'score-moves': boolean
}

export interface BackgammonMove {
  move: string
  equity: number
}

export interface BackgammonResponse {
  plays: BackgammonMove[]
}

export interface AssessmentResultData {
  diceRoll: string
  position: string
  guruResponse: string
  bestMoves: BackgammonMove[]
  guruMatchedBest?: boolean
}
```

**Verification**: Import types in another file without TypeScript errors

---

### Task 1.3: Backgammon Engine Functions

**Objective**: Create direct functions to query GNU Backgammon API

**Files to create**:
- `lib/assessment/backgammonEngine.ts`

**Implementation**:

```typescript
// lib/assessment/backgammonEngine.ts

import {
  BackgammonMove,
  BackgammonResponse,
  OPENING_POSITION
} from './types'

const DEFAULT_ENGINE_URL = 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'

export async function getBackgammonGroundTruth(
  diceRoll: [number, number],
  engineUrl: string = DEFAULT_ENGINE_URL
): Promise<BackgammonMove[]> {
  const response = await fetch(`${engineUrl}/plays`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      board: OPENING_POSITION,
      dice: diceRoll,
      player: 'x',
      cubeful: false,
      'max-moves': 10,
      'score-moves': true
    })
  })

  if (!response.ok) {
    throw new Error(`GNU Backgammon engine request failed: ${response.statusText}`)
  }

  const data: BackgammonResponse = await response.json()
  return data.plays
}

export function parseDiceRoll(input: string): [number, number] | null {
  const match = input.match(/^(\d)-(\d)$/)
  if (!match) return null

  const die1 = parseInt(match[1], 10)
  const die2 = parseInt(match[2], 10)

  if (die1 < 1 || die1 > 6 || die2 < 1 || die2 > 6) return null
  return [die1, die2]
}

export function formatDiceRoll(dice: [number, number]): string {
  return `${dice[0]}-${dice[1]}`
}
```

**Verification**: Write a quick test to query the engine with "3-1" dice roll

---

### Task 1.4: ASCII Board Renderer

**Objective**: Create visual representation of backgammon opening position

**Files to create**:
- `lib/assessment/asciiBoard.ts`

**Implementation**:

```typescript
// lib/assessment/asciiBoard.ts

export function renderOpeningBoard(diceRoll: [number, number]): string {
  const lines: string[] = [
    '┌────────────────────────────────────────┐',
    '│   BACKGAMMON OPENING POSITION          │',
    '├────────────────────────────────────────┤',
    '│  13 14 15 16 17 18   19 20 21 22 23 24 │',
    '│  ○○ .  .  .  ●  .  │  ●  .  .  .  .  ○○ │',
    '│  ○○          ●     │  ●              ○○ │',
    '│  ○○          ●     │  ●                 │',
    '│  ○○          ●     │  ●                 │',
    '│  ○○          ●     │  ●                 │',
    '├────────────────────────────────────────┤',
    '│  12 11 10  9  8  7    6  5  4  3  2  1 │',
    '│  ●● .  .  .  ○○ .  │  ○○ .  .  .  .  ●● │',
    '│  ●●          ○○    │  ○○              ●● │',
    '│  ●●          ○○    │  ○○                 │',
    '│  ●●          ○○    │  ○○                 │',
    '│  ●●          ○○    │  ○○                 │',
    '└────────────────────────────────────────┘',
    '',
    `BLACK (●) to play: ${diceRoll[0]}-${diceRoll[1]}`,
    '',
    'What is the best move?'
  ]

  return lines.join('\n')
}
```

**Verification**: Call function with [3, 1] and verify ASCII output renders correctly

---

### Task 1.5: Validation Schemas

**Objective**: Create Zod schemas for API input validation

**Files to create**:
- `lib/assessment/validation.ts`

**Implementation**:

```typescript
// lib/assessment/validation.ts

import { z } from 'zod'

export const diceRollSchema = z.string().regex(
  /^[1-6]-[1-6]$/,
  'Invalid dice roll format. Use format like "3-1"'
)

export const backgammonMoveSchema = z.object({
  move: z.string(),
  equity: z.number()
})

export const assessmentConfigSchema = z.object({
  engineUrl: z.string().url().default('https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'),
  isEnabled: z.boolean().default(true)
})

export const saveResultSchema = z.object({
  sessionId: z.string(),
  diceRoll: diceRollSchema,
  guruResponse: z.string().min(1),
  bestMoves: z.array(backgammonMoveSchema),
  guruMatchedBest: z.boolean().nullable().optional()
})

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })),
  diceRoll: diceRollSchema
})

export const groundTruthRequestSchema = z.object({
  diceRoll: diceRollSchema
})

export type DiceRoll = z.infer<typeof diceRollSchema>
export type BackgammonMoveData = z.infer<typeof backgammonMoveSchema>
export type SaveResultData = z.infer<typeof saveResultSchema>
```

**Verification**: Import schemas and validate sample data

---

### Task 1.6: Context Composer for Assessment

**Objective**: Compose guru system prompt from project's corpus

**Files to create**:
- `lib/assessment/contextComposer.ts`

**Implementation**:

```typescript
// lib/assessment/contextComposer.ts

import { prisma } from '@/lib/db'

export interface AssessmentContextResult {
  systemPrompt: string
  layerCount: number
}

export async function composeAssessmentContext(
  projectId: string,
  diceRoll: string
): Promise<AssessmentContextResult> {
  const layers = await prisma.contextLayer.findMany({
    where: { projectId, isActive: true },
    orderBy: { priority: 'asc' },
    select: { title: true, content: true }
  })

  if (layers.length === 0) {
    throw new Error('No active context layers found. Cannot assess guru without knowledge.')
  }

  let systemPrompt = `# BACKGAMMON GURU KNOWLEDGE BASE\n\n`

  layers.forEach((layer) => {
    systemPrompt += `## ${layer.title}\n\n`
    systemPrompt += `${layer.content}\n\n---\n\n`
  })

  systemPrompt += `\n# ASSESSMENT MODE\n\n`
  systemPrompt += `You are being tested on your backgammon knowledge. A standard opening position is shown.\n`
  systemPrompt += `Black to play: ${diceRoll}\n\n`
  systemPrompt += `Provide your recommended move(s) with clear reasoning based on the principles in your knowledge base.\n`
  systemPrompt += `Be specific about which checkers to move and why.\n`

  return {
    systemPrompt,
    layerCount: layers.length
  }
}
```

**Verification**: Call with a test project ID and verify prompt includes all active layers

---

### Task 1.7: API Route - Config Toggle

**Objective**: Create endpoint to enable/disable assessment for a project

**Files to create**:
- `app/api/projects/[id]/assessment/config/route.ts`

**Implementation**:

```typescript
// app/api/projects/[id]/assessment/config/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const patchSchema = z.object({
  isEnabled: z.boolean()
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const config = await prisma.selfAssessmentConfig.upsert({
      where: { projectId },
      update: { isEnabled: parsed.data.isEnabled },
      create: {
        projectId,
        isEnabled: parsed.data.isEnabled
      }
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('[PATCH /api/projects/[id]/assessment/config] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update assessment config' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId }
    })

    return NextResponse.json({ config: config || null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/assessment/config] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assessment config' },
      { status: 500 }
    )
  }
}
```

**Verification**: Test PATCH with curl to enable/disable assessment

---

### Task 1.8: API Route - Session Management

**Objective**: Create endpoints to start and end assessment sessions

**Files to create**:
- `app/api/projects/[id]/assessment/session/route.ts`

**Implementation**:

```typescript
// app/api/projects/[id]/assessment/session/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId }
    })

    if (!config || !config.isEnabled) {
      return NextResponse.json(
        { error: 'Assessment not enabled for this project' },
        { status: 400 }
      )
    }

    const session = await prisma.assessmentSession.create({
      data: { configId: config.id }
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/session] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create assessment session' },
      { status: 500 }
    )
  }
}

const patchSchema = z.object({
  sessionId: z.string(),
  action: z.enum(['end'])
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const session = await prisma.assessmentSession.update({
      where: { id: parsed.data.sessionId },
      data: { endedAt: new Date() }
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('[PATCH /api/projects/[id]/assessment/session] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
```

**Verification**: Create and end a session via API calls

---

### Task 1.9: API Route - Assessment Chat

**Objective**: Create streaming chat endpoint that uses guru's corpus

**Files to create**:
- `app/api/projects/[id]/assessment/chat/route.ts`

**Implementation**:

```typescript
// app/api/projects/[id]/assessment/chat/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { streamText, convertToCoreMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { composeAssessmentContext } from '@/lib/assessment/contextComposer'
import { chatRequestSchema } from '@/lib/assessment/validation'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { messages: uiMessages, diceRoll } = parsed.data

    const contextResult = await composeAssessmentContext(projectId, diceRoll)

    const coreMessages = convertToCoreMessages(uiMessages)

    const messages = [
      { role: 'system' as const, content: contextResult.systemPrompt },
      ...coreMessages
    ]

    const model = anthropic('claude-sonnet-4-5-20250929')

    const result = streamText({
      model,
      messages
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/chat] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process assessment chat',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

**Verification**: Send chat request and verify streaming response with corpus context

---

### Task 1.10: API Route - Ground Truth Query

**Objective**: Create endpoint to query GNU Backgammon engine

**Files to create**:
- `app/api/projects/[id]/assessment/ground-truth/route.ts`

**Implementation**:

```typescript
// app/api/projects/[id]/assessment/ground-truth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getBackgammonGroundTruth, parseDiceRoll } from '@/lib/assessment/backgammonEngine'
import { prisma } from '@/lib/db'
import { groundTruthRequestSchema } from '@/lib/assessment/validation'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    const parsed = groundTruthRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { diceRoll } = parsed.data

    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId }
    })

    if (!config || !config.isEnabled) {
      return NextResponse.json(
        { error: 'Assessment not configured for this project' },
        { status: 404 }
      )
    }

    const dice = parseDiceRoll(diceRoll)
    if (!dice) {
      return NextResponse.json(
        { error: 'Invalid dice roll format' },
        { status: 400 }
      )
    }

    const bestMoves = await getBackgammonGroundTruth(dice, config.engineUrl)

    return NextResponse.json({
      bestMoves,
      diceRoll,
      message: 'Ground truth retrieved successfully'
    })
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/ground-truth] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to query GNU Backgammon engine',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

**Verification**: Query with "3-1" dice roll and verify engine returns move rankings

---

### Task 1.11: API Route - Save Results

**Objective**: Create endpoint to persist assessment results

**Files to create**:
- `app/api/projects/[id]/assessment/results/route.ts`

**Implementation**:

```typescript
// app/api/projects/[id]/assessment/results/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { saveResultSchema } from '@/lib/assessment/validation'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()

    const parsed = saveResultSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { sessionId, diceRoll, guruResponse, bestMoves, guruMatchedBest } = parsed.data

    const result = await prisma.assessmentResult.create({
      data: {
        sessionId,
        diceRoll,
        guruResponse,
        bestMoves,
        guruMatchedBest
      }
    })

    return NextResponse.json({ result })
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/results] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save assessment result' },
      { status: 500 }
    )
  }
}
```

**Verification**: Save a test result and verify it appears in database

---

### Task 1.12: Assessment Page (Server Component)

**Objective**: Create the main assessment page with data fetching

**Files to create**:
- `app/projects/[id]/assessment/page.tsx`

**Implementation**:

```typescript
// app/projects/[id]/assessment/page.tsx

import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { AssessmentClient } from '@/components/assessment/AssessmentClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AssessmentPage({ params }: PageProps) {
  const { id: projectId } = await params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assessmentConfig: true,
      contextLayers: {
        where: { isActive: true },
        select: { id: true }
      }
    }
  })

  if (!project) {
    notFound()
  }

  if (!project.assessmentConfig?.isEnabled) {
    redirect(`/projects/${projectId}?error=assessment-not-configured`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">
              Self-Assessment: {project.name}
            </h1>
            <p className="text-sm text-gray-600">
              {project.contextLayers.length} context layers loaded
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href={`/projects/${projectId}/assessment/history`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View History
            </Link>
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Back to Project
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <AssessmentClient projectId={projectId} />
      </main>
    </div>
  )
}
```

**Verification**: Navigate to page and verify it loads project data correctly

---

### Task 1.13: Assessment Client Component

**Objective**: Create the split-screen UI with chat and ground truth panels

**Files to create**:
- `components/assessment/AssessmentClient.tsx`

**Implementation**:

```typescript
// components/assessment/AssessmentClient.tsx

'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { renderOpeningBoard } from '@/lib/assessment/asciiBoard'
import { BackgammonMove } from '@/lib/assessment/types'

interface Props {
  projectId: string
}

export function AssessmentClient({ projectId }: Props) {
  const [diceRoll, setDiceRoll] = useState('')
  const [currentDice, setCurrentDice] = useState<string | null>(null)
  const [groundTruth, setGroundTruth] = useState<BackgammonMove[] | null>(null)
  const [isLoadingTruth, setIsLoadingTruth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const { messages, append, isLoading, setMessages } = useChat({
    id: `assessment-${projectId}`,
    api: `/api/projects/${projectId}/assessment/chat`
  })

  async function startProblem() {
    if (!diceRoll.match(/^[1-6]-[1-6]$/)) {
      setError('Invalid dice format. Use format like "3-1"')
      return
    }
    setError(null)
    setCurrentDice(diceRoll)
    setGroundTruth(null)
    setMessages([])

    if (!sessionId) {
      const response = await fetch(`/api/projects/${projectId}/assessment/session`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.session) {
        setSessionId(data.session.id)
      }
    }
  }

  async function fetchGroundTruth() {
    if (!currentDice) return
    setIsLoadingTruth(true)
    setError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/assessment/ground-truth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diceRoll: currentDice })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.message || data.error)
      setGroundTruth(data.bestMoves)

      if (sessionId && messages.length > 0) {
        const guruResponse = messages.find(m => m.role === 'assistant')?.content || ''
        await fetch(`/api/projects/${projectId}/assessment/results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            diceRoll: currentDice,
            guruResponse,
            bestMoves: data.bestMoves
          })
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ground truth')
    } finally {
      setIsLoadingTruth(false)
    }
  }

  function askGuru() {
    if (!currentDice) return
    append(
      { role: 'user', content: 'What is the best move for this position?' },
      { body: { diceRoll: currentDice } }
    )
  }

  return (
    <div className="space-y-6">
      {/* Dice Roll Input */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Dice Roll</label>
            <input
              type="text"
              value={diceRoll}
              onChange={(e) => setDiceRoll(e.target.value)}
              placeholder="e.g., 3-1"
              className="px-3 py-2 border rounded-md w-32"
            />
          </div>
          <button
            onClick={startProblem}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Set Problem
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {/* Split Screen: Guru vs Ground Truth */}
      {currentDice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Board + Guru Chat */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Guru Analysis</h2>
            </div>

            {/* ASCII Board */}
            <div className="p-4 bg-gray-50 border-b font-mono text-xs whitespace-pre overflow-x-auto">
              {renderOpeningBoard(currentDice.split('-').map(Number) as [number, number])}
            </div>

            {/* Chat Messages */}
            <div className="h-64 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {isLoading && (
                <p className="text-gray-500 text-sm">Guru is thinking...</p>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={askGuru}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Thinking...' : 'Ask Guru'}
              </button>
            </div>
          </div>

          {/* Right: Ground Truth */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold">Ground Truth (GNU Backgammon)</h2>
              <button
                onClick={fetchGroundTruth}
                disabled={isLoadingTruth}
                className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {isLoadingTruth ? 'Loading...' : 'Check Answer'}
              </button>
            </div>

            <div className="p-4 min-h-[200px]">
              {!groundTruth && !isLoadingTruth && (
                <p className="text-gray-500">Click "Check Answer" to see engine analysis</p>
              )}
              {groundTruth && (
                <div className="space-y-3">
                  <h3 className="font-medium">Best Moves (ranked by equity):</h3>
                  {groundTruth.slice(0, 5).map((move, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">{idx + 1}. {move.move}</span>
                      <span className={`text-sm font-medium ${move.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {move.equity >= 0 ? '+' : ''}{move.equity.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Verification**: Full UI test - enter dice roll, ask guru, check answer, verify all panels work

---

### Task 1.14: Add Assessment Link to Project Page

**Objective**: Add enable/disable toggle and assessment link on project overview page

**Files to modify**:
- `app/projects/[id]/page.tsx`

**Implementation**:

Add this section to the existing project page:

```typescript
// In the project page component, add state for assessment config
const [assessmentEnabled, setAssessmentEnabled] = useState(false)
const [loadingConfig, setLoadingConfig] = useState(true)

// Fetch config on mount
useEffect(() => {
  fetch(`/api/projects/${projectId}/assessment/config`)
    .then(res => res.json())
    .then(data => {
      setAssessmentEnabled(data.config?.isEnabled ?? false)
      setLoadingConfig(false)
    })
}, [projectId])

// Toggle handler
async function toggleAssessment() {
  const response = await fetch(`/api/projects/${projectId}/assessment/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isEnabled: !assessmentEnabled })
  })
  const data = await response.json()
  setAssessmentEnabled(data.config.isEnabled)
}

// Add this JSX section to the page
<div className="bg-white p-6 rounded-lg shadow-sm border">
  <h2 className="text-lg font-semibold mb-4">Self-Assessment</h2>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-600 mb-2">
        Test your guru against GNU Backgammon engine
      </p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={assessmentEnabled}
          onChange={toggleAssessment}
          disabled={loadingConfig}
          className="rounded"
        />
        <span className="text-sm">Enable Assessment Mode</span>
      </label>
    </div>
    {assessmentEnabled && (
      <Link
        href={`/projects/${projectId}/assessment`}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Start Assessment
      </Link>
    )}
  </div>
</div>
```

**Verification**: Toggle assessment on/off and verify link appears/disappears

---

## Phase 2: History & Analytics

### Task 2.1: Session History API Route

**Objective**: Create endpoint to fetch past sessions with results

**Files to create**:
- `app/api/projects/[id]/assessment/history/route.ts`

**Implementation**:

```typescript
// app/api/projects/[id]/assessment/history/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: {
            results: {
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    })

    if (!config) {
      return NextResponse.json({ sessions: [] })
    }

    // Calculate accuracy stats for each session
    const sessionsWithStats = config.sessions.map(session => {
      const totalTests = session.results.length
      const matchedBest = session.results.filter(r => r.guruMatchedBest === true).length
      const accuracy = totalTests > 0 ? (matchedBest / totalTests) * 100 : 0

      return {
        ...session,
        stats: {
          totalTests,
          matchedBest,
          accuracy: accuracy.toFixed(1)
        }
      }
    })

    return NextResponse.json({ sessions: sessionsWithStats })
  } catch (error) {
    console.error('[GET /api/projects/[id]/assessment/history] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assessment history' },
      { status: 500 }
    )
  }
}
```

**Verification**: Fetch history and verify sessions include results and stats

---

### Task 2.2: Export Results API Route

**Objective**: Create endpoint to export results as JSON or CSV

**Files to create**:
- `app/api/projects/[id]/assessment/export/route.ts`

**Implementation**:

```typescript
// app/api/projects/[id]/assessment/export/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId },
      include: {
        sessions: {
          include: {
            results: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'No assessment data found' },
        { status: 404 }
      )
    }

    // Flatten results for export
    const exportData = config.sessions.flatMap(session =>
      session.results.map(result => ({
        sessionId: session.id,
        sessionStarted: session.startedAt,
        sessionEnded: session.endedAt,
        resultId: result.id,
        diceRoll: result.diceRoll,
        position: result.position,
        guruResponse: result.guruResponse,
        bestMove: (result.bestMoves as { move: string; equity: number }[])[0]?.move || '',
        bestEquity: (result.bestMoves as { move: string; equity: number }[])[0]?.equity || 0,
        guruMatchedBest: result.guruMatchedBest,
        createdAt: result.createdAt
      }))
    )

    if (format === 'csv') {
      const headers = [
        'sessionId',
        'sessionStarted',
        'sessionEnded',
        'resultId',
        'diceRoll',
        'position',
        'guruResponse',
        'bestMove',
        'bestEquity',
        'guruMatchedBest',
        'createdAt'
      ]

      const csvRows = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(h => {
            const val = row[h as keyof typeof row]
            const str = String(val ?? '').replace(/"/g, '""')
            return `"${str}"`
          }).join(',')
        )
      ]

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="assessment-results-${projectId}.csv"`
        }
      })
    }

    return NextResponse.json({ results: exportData })
  } catch (error) {
    console.error('[GET /api/projects/[id]/assessment/export] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export assessment data' },
      { status: 500 }
    )
  }
}
```

**Verification**: Download both JSON and CSV formats and verify data integrity

---

### Task 2.3: History Page (Server Component)

**Objective**: Create page to display past assessment sessions

**Files to create**:
- `app/projects/[id]/assessment/history/page.tsx`

**Implementation**:

```typescript
// app/projects/[id]/assessment/history/page.tsx

import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SessionHistory } from '@/components/assessment/SessionHistory'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function HistoryPage({ params }: PageProps) {
  const { id: projectId } = await params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  })

  if (!project) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">
              Assessment History: {project.name}
            </h1>
          </div>
          <div className="flex gap-4">
            <Link
              href={`/projects/${projectId}/assessment`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              New Assessment
            </Link>
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Back to Project
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <SessionHistory projectId={projectId} />
      </main>
    </div>
  )
}
```

**Verification**: Navigate to history page and verify it renders

---

### Task 2.4: Session History Client Component

**Objective**: Create component to display sessions, results, and statistics

**Files to create**:
- `components/assessment/SessionHistory.tsx`

**Implementation**:

```typescript
// components/assessment/SessionHistory.tsx

'use client'

import { useEffect, useState } from 'react'
import { BackgammonMove } from '@/lib/assessment/types'

interface SessionWithStats {
  id: string
  startedAt: string
  endedAt: string | null
  results: {
    id: string
    diceRoll: string
    guruResponse: string
    bestMoves: BackgammonMove[]
    guruMatchedBest: boolean | null
    createdAt: string
  }[]
  stats: {
    totalTests: number
    matchedBest: number
    accuracy: string
  }
}

interface Props {
  projectId: string
}

export function SessionHistory({ projectId }: Props) {
  const [sessions, setSessions] = useState<SessionWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${projectId}/assessment/history`)
      .then(res => res.json())
      .then(data => {
        setSessions(data.sessions || [])
        setLoading(false)
      })
  }, [projectId])

  function downloadExport(format: 'json' | 'csv') {
    window.location.href = `/api/projects/${projectId}/assessment/export?format=${format}`
  }

  if (loading) {
    return <p className="text-gray-500">Loading history...</p>
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
        <p className="text-gray-600">No assessment sessions yet.</p>
        <p className="text-sm text-gray-500 mt-2">
          Start an assessment to track your guru's performance.
        </p>
      </div>
    )
  }

  // Calculate overall stats
  const totalSessions = sessions.length
  const totalTests = sessions.reduce((sum, s) => sum + s.stats.totalTests, 0)
  const totalMatched = sessions.reduce((sum, s) => sum + s.stats.matchedBest, 0)
  const overallAccuracy = totalTests > 0 ? ((totalMatched / totalTests) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="font-semibold mb-4">Overall Statistics</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Sessions</p>
            <p className="text-2xl font-bold">{totalSessions}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Tests</p>
            <p className="text-2xl font-bold">{totalTests}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Matched Best Move</p>
            <p className="text-2xl font-bold">{totalMatched}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Overall Accuracy</p>
            <p className="text-2xl font-bold text-green-600">{overallAccuracy}%</p>
          </div>
        </div>
      </div>

      {/* Export & Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center">
        <div>
          <input
            type="text"
            placeholder="Filter by dice roll (e.g., 3-1)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border rounded-md w-48"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadExport('json')}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          >
            Export JSON
          </button>
          <button
            onClick={() => downloadExport('csv')}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-white rounded-lg shadow-sm border">
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
            >
              <div>
                <p className="font-medium">
                  Session {new Date(session.startedAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  {session.stats.totalTests} tests | {session.stats.accuracy}% accuracy
                </p>
              </div>
              <span className="text-gray-400">
                {expandedSession === session.id ? '▼' : '▶'}
              </span>
            </div>

            {expandedSession === session.id && (
              <div className="border-t p-4 space-y-3">
                {session.results
                  .filter(r => !filter || r.diceRoll.includes(filter))
                  .map(result => (
                    <div key={result.id} className="bg-gray-50 p-3 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono font-medium">{result.diceRoll}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          result.guruMatchedBest === true
                            ? 'bg-green-100 text-green-700'
                            : result.guruMatchedBest === false
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {result.guruMatchedBest === true
                            ? 'Matched'
                            : result.guruMatchedBest === false
                            ? 'Missed'
                            : 'Not Rated'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Best move:</strong> {result.bestMoves[0]?.move || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        <strong>Guru said:</strong> {result.guruResponse.slice(0, 200)}...
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Verification**: View history with multiple sessions, test filter, test export buttons

---

### Task 2.5: Add Rating Controls to Assessment Client

**Objective**: Allow users to mark whether guru matched best move

**Files to modify**:
- `components/assessment/AssessmentClient.tsx`

**Implementation**:

Add after ground truth display in the right panel:

```typescript
// Add state for rating
const [lastResultId, setLastResultId] = useState<string | null>(null)

// Update fetchGroundTruth to capture result ID
// After saving result:
const saveResponse = await fetch(`/api/projects/${projectId}/assessment/results`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    diceRoll: currentDice,
    guruResponse,
    bestMoves: data.bestMoves
  })
})
const saveData = await saveResponse.json()
if (saveData.result) {
  setLastResultId(saveData.result.id)
}

// Add rating function
async function rateResult(matched: boolean) {
  if (!lastResultId) return
  await fetch(`/api/projects/${projectId}/assessment/results/${lastResultId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guruMatchedBest: matched })
  })
}

// Add JSX after ground truth display
{groundTruth && lastResultId && (
  <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
    <p className="text-sm font-medium mb-2">Did the guru match the best move?</p>
    <div className="flex gap-2">
      <button
        onClick={() => rateResult(true)}
        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
      >
        Yes, Matched
      </button>
      <button
        onClick={() => rateResult(false)}
        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
      >
        No, Missed
      </button>
    </div>
  </div>
)}
```

Also create the PATCH endpoint:

```typescript
// app/api/projects/[id]/assessment/results/[resultId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const patchSchema = z.object({
  guruMatchedBest: z.boolean()
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; resultId: string }> }
) {
  try {
    const { resultId } = await context.params
    const body = await request.json()

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const result = await prisma.assessmentResult.update({
      where: { id: resultId },
      data: { guruMatchedBest: parsed.data.guruMatchedBest }
    })

    return NextResponse.json({ result })
  } catch (error) {
    console.error('[PATCH /api/.../results/[resultId]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update result' },
      { status: 500 }
    )
  }
}
```

**Verification**: Rate a result and verify it shows correctly in history

---

## Summary

**Phase 1 Tasks (14 tasks):**
1. Database Schema and Migration
2. Core Types and Constants
3. Backgammon Engine Functions
4. ASCII Board Renderer
5. Validation Schemas
6. Context Composer for Assessment
7. API Route - Config Toggle
8. API Route - Session Management
9. API Route - Assessment Chat
10. API Route - Ground Truth Query
11. API Route - Save Results
12. Assessment Page (Server Component)
13. Assessment Client Component
14. Add Assessment Link to Project Page

**Phase 2 Tasks (5 tasks):**
1. Session History API Route
2. Export Results API Route
3. History Page (Server Component)
4. Session History Client Component
5. Add Rating Controls to Assessment Client

**Total: 19 tasks**

---

## Implementation Order

1. **Foundation** (Tasks 1.1-1.6): Types, schemas, utilities
2. **Backend** (Tasks 1.7-1.11): All API routes
3. **Frontend** (Tasks 1.12-1.14): UI components and integration
4. **Analytics** (Tasks 2.1-2.5): History and statistics

**Checkpoint after Phase 1:** Full working assessment flow with session tracking
**Checkpoint after Phase 2:** Analytics dashboard with export functionality

---

*Generated: November 16, 2025*
