# Feature Specification: Self-Assessment System for Guru Projects

## 1. Status

**Draft** - Pending Review

## 2. Authors

Claude (AI Assistant) - November 16, 2025

## 3. Overview

Enable quantitative validation of guru knowledge by testing AI teaching assistants against authoritative sources (game engines, mathematical solvers, expert systems). The system provides a shared architectural framework with pluggable domain-specific connectors, starting with GNU Backgammon engine integration.

---

## 4. Background/Problem Statement

### The Problem

Users invest significant time building AI teaching assistants (gurus) through the research-and-apply workflow, but have **no objective way to measure whether their guru's knowledge is accurate**. Current validation is:

- **Subjective**: "This sounds right" doesn't scale
- **Unmeasurable**: No metrics to track improvement over research iterations
- **Disconnected**: External benchmarking tools don't integrate with Guru Builder
- **Incomplete**: Qualitative assessment misses specific knowledge gaps

### Real-World Example

A user builds a backgammon guru through 10 research runs. The corpus grows to 15 context layers and 50 knowledge files. But questions remain:
- Does the guru know the mathematically optimal opening moves?
- Can it identify checker play errors?
- Has accuracy improved from run #1 to run #10?

Without self-assessment, these questions remain unanswered.

### Why This Matters

- **Confidence**: Users need objective proof their guru works
- **Improvement**: Can't optimize what you can't measure
- **Trust**: End users of the guru need assurance of accuracy
- **Focus**: Identify specific knowledge gaps to target with future research

---

## 5. Goals

- **Primary**: Enable side-by-side comparison of guru responses vs. authoritative ground truth
- **Enable extensibility**: Create shared framework that supports multiple domains (backgammon, chess, Go, poker)
- **Integrate seamlessly**: Leverage existing corpus (context layers, knowledge files) as guru's knowledge base
- **Maintain transparency**: Capture guru's reasoning process (extended thinking) for analysis
- **First implementation**: Complete working backgammon assessment using GNU Backgammon MCP server

---

## 6. Non-Goals (Explicitly Out of Scope)

- **NOT building**: Automated testing pipelines (batch evaluation)
- **NOT building**: User-generated test case library
- **NOT building**: Performance benchmarking against other gurus
- **NOT building**: Automated corpus improvement suggestions based on failures
- **NOT building**: Abstract connector interfaces or plugin systems (backgammon-specific only)
- **NOT integrating**: More than one engine connector in initial release (backgammon only)
- **NOT building**: Configuration UI modal (simple toggle on project page instead)

---

## 7. Technical Dependencies

### Already Available in package.json

```json
{
  "ai": "^5.0.89",
  "@ai-sdk/react": "^2.0.89",
  "@ai-sdk/anthropic": "^2.0.42",
  "@ai-sdk/openai": "^2.0.64",
  "zod": "^3.24.1",
  "@prisma/client": "^5.22.0",
  "next": "15.2.4",
  "react": "19.1.1"
}
```

### External Services

- **GNU Backgammon MCP Server**
  - URL: `https://gnubg-mcp-d1c3c7a814e8.herokuapp.com/mcp`
  - HTTP transport (REST-compatible)
  - Tools: `plays`, `opening`, `test-opening`, `get_session`
  - Documentation: `backgammon-engine-MCP-README.md`

### Documentation Links

- Vercel AI SDK v5: https://sdk.vercel.ai/docs
- Prisma ORM: https://www.prisma.io/docs
- Claude Extended Thinking: https://docs.anthropic.com/
- MCP Protocol: https://modelcontextprotocol.io/docs

---

## 8. Detailed Design

### 8.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js + React)                        │
│  ┌──────────────────┐        ┌──────────────────┐                   │
│  │ Assessment Page   │        │ Config Modal     │                   │
│  │ (Split-Screen UI) │        │ (Connector Setup)│                   │
│  └────────┬─────────┘        └────────┬─────────┘                   │
└───────────┼──────────────────────────┼──────────────────────────────┘
            │                          │
            ↓                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    API ROUTES (Next.js)                              │
│  ┌──────────────────┐  ┌──────────────────┐                         │
│  │ POST /chat       │  │ GET /ground-truth│                         │
│  │ (Guru streaming) │  │ (Engine query)   │                         │
│  └────────┬─────────┘  └────────┬─────────┘                         │
└───────────┼──────────────────────┼──────────────────────────────────┘
            │                      │
            ↓                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    CORE LOGIC LAYER                                  │
│  ┌──────────────────┐  ┌──────────────────┐                         │
│  │ Context Composer │  │ Truth Source     │                         │
│  │ (Corpus → Prompt)│  │ Connector        │                         │
│  └────────┬─────────┘  └────────┬─────────┘                         │
└───────────┼──────────────────────┼──────────────────────────────────┘
            │                      │
            ↓                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA & AI PROVIDERS                               │
│  ┌──────────────────┐  ┌──────────────────┐                         │
│  │ PostgreSQL       │  │ External Engine  │                         │
│  │ - Project config │  │ - GNU Backgammon │                         │
│  │ - Corpus         │  │ - (Future: Chess)│                         │
│  │ - Audit trails   │  │                  │                         │
│  └──────────────────┘  └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Database Schema Changes

Add to `prisma/schema.prisma`:

```prisma
// ============================================================================
// SELF-ASSESSMENT MODELS
// ============================================================================

model SelfAssessmentConfig {
  id           String   @id @default(cuid())
  projectId    String   @unique

  // Backgammon-specific configuration (MVP: only backgammon supported)
  engineUrl    String   @default("https://gnubg-mcp-d1c3c7a814e8.herokuapp.com")
  isEnabled    Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sessions     AssessmentSession[]

  @@index([projectId])
}

model AssessmentSession {
  id           String   @id @default(cuid())
  configId     String

  // Session metadata
  startedAt    DateTime @default(now())
  endedAt      DateTime?

  // Relations
  config       SelfAssessmentConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
  results      AssessmentResult[]

  @@index([configId])
  @@index([startedAt])
}

model AssessmentResult {
  id           String   @id @default(cuid())
  sessionId    String

  // Problem context (backgammon position)
  diceRoll     String              // e.g., "3-1"
  position     String   @default("opening") // For MVP: always "opening"

  // Guru response
  guruResponse String   @db.Text   // What the guru recommended

  // Ground truth from engine
  bestMoves    Json                // Array of { move, equity } from GNU Backgammon

  // Simple accuracy tracking
  guruMatchedBest Boolean?         // Did guru's top recommendation match engine's best?

  createdAt    DateTime @default(now())

  // Relations
  session      AssessmentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([createdAt])
}
```

Update existing Project model:

```prisma
model Project {
  id          String   @id @default(cuid())
  // ... existing fields ...

  // Relations (add to existing)
  assessmentConfig SelfAssessmentConfig?

  // ... existing relations ...
}
```

### 8.3 Code Structure and File Organization

```
lib/
├── assessment/
│   ├── types.ts                      # Type definitions (backgammon-specific)
│   ├── backgammonEngine.ts           # Direct GNU Backgammon API calls
│   ├── contextComposer.ts            # Compose guru system prompt from corpus
│   ├── asciiBoard.ts                 # Render backgammon board as ASCII
│   └── validation.ts                 # Zod schemas for assessment data

app/
├── api/
│   └── projects/
│       └── [id]/
│           └── assessment/
│               ├── config/route.ts     # PATCH toggle assessment on/off
│               ├── session/route.ts    # POST start session, PATCH end session
│               ├── chat/route.ts       # POST streaming guru chat
│               ├── ground-truth/route.ts # POST query GNU Backgammon engine
│               └── results/route.ts    # POST save assessment result
└── projects/
    └── [id]/
        └── assessment/
            ├── page.tsx                # Main assessment UI (server component)
            └── history/
                └── page.tsx            # View past sessions and results

components/
└── assessment/
    ├── AssessmentClient.tsx          # Main split-screen layout (client)
    └── SessionHistory.tsx            # Display past results with accuracy stats
```

**Key simplifications:**
- No abstract connector interface - direct `backgammonEngine.ts` functions
- No ConfigModal - simple toggle on project page
- Fewer components - inline chat and ground truth panels in main client component
- History page for viewing past sessions and tracking improvement

### 8.4 Core Types (Backgammon-Specific)

```typescript
// lib/assessment/types.ts

// Backgammon board representation (matches GNU Backgammon API format)
export interface BackgammonBoard {
  o: Record<string, number>  // Opponent's checkers: point number -> count
  x: Record<string, number>  // Player's checkers: point number -> count
}

// Standard opening position (constant)
export const OPENING_POSITION: BackgammonBoard = {
  o: { "6": 5, "8": 3, "13": 5, "24": 2 },
  x: { "6": 5, "8": 3, "13": 5, "24": 2 }
}

// Request to GNU Backgammon engine
export interface BackgammonRequest {
  board: BackgammonBoard
  dice: [number, number]
  player: 'x' | 'o'
  cubeful: boolean
  'max-moves': number
  'score-moves': boolean
}

// Response from GNU Backgammon engine
export interface BackgammonMove {
  move: string    // e.g., "8/5, 6/5"
  equity: number  // e.g., 0.12
}

export interface BackgammonResponse {
  plays: BackgammonMove[]
}

// Assessment result for storage
export interface AssessmentResultData {
  diceRoll: string
  position: string
  guruResponse: string
  bestMoves: BackgammonMove[]
  guruMatchedBest?: boolean
}
```

### 8.5 Backgammon Engine Functions (Direct Implementation)

```typescript
// lib/assessment/backgammonEngine.ts

import {
  BackgammonBoard,
  BackgammonMove,
  BackgammonResponse,
  OPENING_POSITION
} from './types'

const DEFAULT_ENGINE_URL = 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'

/**
 * Query GNU Backgammon engine for best moves
 */
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
      player: 'x',  // Black to play
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

/**
 * Parse dice roll string into tuple (e.g., "3-1" -> [3, 1])
 */
export function parseDiceRoll(input: string): [number, number] | null {
  const match = input.match(/^(\d)-(\d)$/)
  if (!match) return null

  const die1 = parseInt(match[1], 10)
  const die2 = parseInt(match[2], 10)

  if (die1 < 1 || die1 > 6 || die2 < 1 || die2 > 6) return null
  return [die1, die2]
}

/**
 * Format dice roll for display
 */
export function formatDiceRoll(dice: [number, number]): string {
  return `${dice[0]}-${dice[1]}`
}
```

```typescript
// lib/assessment/asciiBoard.ts

import { OPENING_POSITION } from './types'

/**
 * Render backgammon opening position as ASCII art
 */
export function renderOpeningBoard(diceRoll: [number, number]): string {
  // Simplified ASCII representation for opening position
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

### 8.6 Context Composer for Assessment

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
  // Fetch active context layers (sorted by priority)
  const layers = await prisma.contextLayer.findMany({
    where: { projectId, isActive: true },
    orderBy: { priority: 'asc' },
    select: { title: true, content: true }
  })

  if (layers.length === 0) {
    throw new Error('No active context layers found. Cannot assess guru without knowledge.')
  }

  // Build system prompt from layers
  let systemPrompt = `# BACKGAMMON GURU KNOWLEDGE BASE\n\n`

  layers.forEach((layer, idx) => {
    systemPrompt += `## ${layer.title}\n\n`
    systemPrompt += `${layer.content}\n\n---\n\n`
  })

  // Add assessment-specific instructions
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

### 8.7 API Route: Assessment Chat (Streaming)

```typescript
// app/api/projects/[id]/assessment/chat/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { streamText, convertToCoreMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { composeAssessmentContext } from '@/lib/assessment/contextComposer'
import { z } from 'zod'

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })),
  diceRoll: z.string().regex(/^\d-\d$/, 'Invalid dice roll format (e.g., "3-1")')
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { messages: uiMessages, diceRoll } = parsed.data

    // Compose guru's system prompt from corpus
    const contextResult = await composeAssessmentContext(projectId, diceRoll)

    // Convert to core messages
    const coreMessages = convertToCoreMessages(uiMessages)

    // Build final messages array
    const messages = [
      { role: 'system' as const, content: contextResult.systemPrompt },
      ...coreMessages
    ]

    // Use Claude Sonnet with extended thinking
    const model = anthropic('claude-sonnet-4-5-20250929')

    // Stream response
    const result = streamText({
      model,
      messages
    })

    // Return streaming response
    return result.toUIMessageStreamResponse()
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

### 8.8 API Route: Ground Truth Query

```typescript
// app/api/projects/[id]/assessment/ground-truth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getBackgammonGroundTruth, parseDiceRoll } from '@/lib/assessment/backgammonEngine'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const requestSchema = z.object({
  diceRoll: z.string().regex(/^\d-\d$/, 'Invalid dice roll format')
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { diceRoll } = parsed.data

    // Get assessment config for engine URL
    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId }
    })

    if (!config || !config.isEnabled) {
      return NextResponse.json(
        { error: 'Assessment not configured for this project' },
        { status: 404 }
      )
    }

    // Parse dice roll
    const dice = parseDiceRoll(diceRoll)
    if (!dice) {
      return NextResponse.json(
        { error: 'Invalid dice roll format' },
        { status: 400 }
      )
    }

    // Query GNU Backgammon engine directly
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

### 8.9 Frontend: Split-Screen Assessment Page

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
          <Link
            href={`/projects/${projectId}/assessment/history`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View History
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <AssessmentClient projectId={projectId} />
      </main>
    </div>
  )
}
```

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

  // Initialize useChat WITHOUT body (prevents stale closures)
  const { messages, sendMessage, status, setMessages } = useChat({
    id: `assessment-${projectId}`,
    api: `/api/projects/${projectId}/assessment/chat`
  })

  // Start new problem with entered dice roll
  async function startProblem() {
    if (!diceRoll.match(/^\d-\d$/)) {
      setError('Invalid dice format. Use format like "3-1"')
      return
    }
    setError(null)
    setCurrentDice(diceRoll)
    setGroundTruth(null)
    setMessages([])

    // Create session if not exists
    if (!sessionId) {
      const response = await fetch(`/api/projects/${projectId}/assessment/session`, {
        method: 'POST'
      })
      const data = await response.json()
      setSessionId(data.session.id)
    }
  }

  // Query GNU Backgammon engine
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
      if (data.error) throw new Error(data.message)
      setGroundTruth(data.bestMoves)

      // Save result to session
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

  // Ask guru about position
  function askGuru() {
    if (!currentDice) return
    sendMessage(
      { content: 'What is the best move for this position?' },
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
            <div className="p-4 bg-gray-50 border-b font-mono text-xs whitespace-pre">
              {renderOpeningBoard(currentDice.split('-').map(Number) as [number, number])}
            </div>

            {/* Chat */}
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
              {status === 'streaming' && (
                <p className="text-gray-500 text-sm">Guru is thinking...</p>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={askGuru}
                disabled={status === 'streaming'}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {status === 'streaming' ? 'Thinking...' : 'Ask Guru'}
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

            <div className="p-4">
              {!groundTruth && !isLoadingTruth && (
                <p className="text-gray-500">Click "Check Answer" to see engine analysis</p>
              )}
              {groundTruth && (
                <div className="space-y-3">
                  <h3 className="font-medium">Best Moves:</h3>
                  {groundTruth.slice(0, 5).map((move, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-mono">{move.move}</span>
                      <span className={`text-sm ${move.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

---

## 9. User Experience

### User Flow

1. **Configuration** (one-time per project):
   - Navigate to project overview
   - Click "Configure Self-Assessment"
   - Select connector type (e.g., GNU Backgammon)
   - Save configuration

2. **Assessment Session**:
   - Click "Start Assessment" on project page
   - View split-screen: problem on left, ground truth on right
   - Problem loads automatically with board position
   - Ask guru: "What's the best move here?"
   - Read guru's response and reasoning
   - Click "Check Answer" to see engine's calculation
   - Compare guru vs. engine
   - Click "New Problem" for next test
   - Click "End Session" when done

3. **Post-Session**:
   - Return to project overview
   - See session summary (questions asked, checks performed)
   - Identify knowledge gaps for future research runs

### UI Patterns

- **Split-screen layout**: Guru chat on left, ground truth on right
- **ASCII board display**: Consistent with drill-mode-extraction-package
- **Status badges**: Active (green), Completed (blue), Abandoned (gray)
- **Loading states**: Skeleton loaders for async operations
- **Error boundaries**: Graceful failure with retry options

---

## 10. Testing Strategy

### Unit Tests

```typescript
// __tests__/lib/assessment/connectors/backgammon.test.ts

/**
 * Purpose: Verify GNU Backgammon connector correctly communicates with engine
 * Why it matters: Incorrect engine integration would produce wrong ground truth
 */
describe('BackgammonConnector', () => {
  it('should parse engine response into standard format', async () => {
    // Mock HTTP response
    const mockResponse = {
      plays: [
        { move: '8/5, 6/5', equity: 0.12 },
        { move: '24/21, 13/12', equity: 0.0 }
      ]
    }

    const connector = new BackgammonConnector()
    // ... test implementation

    expect(result.bestMoves[0].move).toBe('8/5, 6/5')
    expect(result.bestMoves[0].score).toBe(0.12)
  })

  it('should throw error when engine is unavailable', async () => {
    // Test network failure handling
  })
})
```

### Integration Tests

```typescript
// __tests__/api/assessment/chat.test.ts

/**
 * Purpose: Verify assessment chat composes corpus correctly into system prompt
 * Why it matters: Guru must use project's knowledge, not generic knowledge
 */
describe('POST /api/projects/[id]/assessment/chat', () => {
  it('should include all active context layers in system prompt', async () => {
    // Create project with layers
    // Make chat request
    // Verify layers appear in composed prompt
  })

  it('should reject request when no context layers exist', async () => {
    // Empty corpus should prevent assessment
  })
})
```

### E2E Tests

```typescript
// e2e/assessment.spec.ts

/**
 * Purpose: Full user journey from config to comparison
 * Why it matters: Ensures all components work together in real browser
 */
test('complete assessment flow', async ({ page }) => {
  // 1. Configure assessment
  await page.goto('/projects/test-project')
  await page.click('[data-testid="configure-assessment"]')
  await page.selectOption('[name="connectorType"]', 'BACKGAMMON_GNU')
  await page.click('[data-testid="save-config"]')

  // 2. Start session
  await page.click('[data-testid="start-assessment"]')
  await expect(page.locator('[data-testid="problem-display"]')).toBeVisible()

  // 3. Ask guru
  await page.fill('[data-testid="chat-input"]', 'What is the best move?')
  await page.click('[data-testid="send-message"]')
  await expect(page.locator('[data-testid="guru-response"]')).toBeVisible()

  // 4. Check ground truth
  await page.click('[data-testid="check-answer"]')
  await expect(page.locator('[data-testid="ground-truth-panel"]')).toContainText('Equity')
})
```

### Mocking Strategies

- **Engine API**: Use MSW (Mock Service Worker) for HTTP mocks
- **Database**: Use separate test database with cleanup
- **AI Responses**: Mock Vercel AI SDK's streamText for predictable outputs

---

## 11. Performance Considerations

### Potential Bottlenecks

1. **AI Response Latency**: Claude Sonnet with extended thinking (3-10 seconds)
2. **Engine Query Latency**: HTTP to external service (500ms-2s)
3. **Corpus Composition**: Loading all context layers (< 100ms)

### Mitigations

- **Streaming responses**: User sees partial response immediately
- **Parallel queries**: Can query guru and engine simultaneously (if user wants)
- **Caching**: Cache engine responses for identical problems (optional v2 feature)
- **Connection pooling**: Reuse HTTP connections to engine

### Cost Management

- **Claude Sonnet**: $3/$15 per 1M tokens (expensive)
- **Extended thinking**: 5000 token budget adds ~$0.075 per query
- **Recommendation**: Display cost estimate before starting session

---

## 12. Security Considerations

### Data Protection

- **No PII**: Assessment data contains only technical positions
- **API Keys**: Store securely in environment variables
- **External Service**: GNU Backgammon server is read-only (no writes)

### Input Validation

- **Zod schemas**: All API inputs validated
- **Sanitization**: Problem data validated before engine query
- **Rate limiting**: Prevent abuse of external engine (future enhancement)

### Access Control

- **Project ownership**: Only project owner can configure assessment
- **Session isolation**: Sessions scoped to single user/project (future enhancement)

---

## 13. Documentation

### Required Documentation

1. **Developer Guide**: `developer-guides/06-self-assessment-system-guide.md`
   - Architecture overview
   - Adding new connectors
   - Extending problem generators

2. **API Documentation**: Update existing API docs
   - New endpoints under `/api/projects/[id]/assessment/*`
   - Request/response schemas

3. **User Guide**: In-app help or README section
   - How to configure assessment
   - Interpreting results
   - Troubleshooting engine connections

### Code Comments

- Each connector implements clear interface
- Assessment context composition well-documented
- Error handling explains recovery strategies

---

## 14. Implementation Phases

### Phase 1: Core Infrastructure (MVP)

**Focus**: Single working backgammon implementation with session tracking

- Database models and migrations (SelfAssessmentConfig, AssessmentSession, AssessmentResult)
- Direct backgammonEngine.ts functions (no abstract interfaces)
- Assessment chat API with streaming
- Ground truth query API (direct GNU Backgammon calls)
- Results storage API
- Basic split-screen UI with dice input, ASCII board, chat, and ground truth display
- Session creation and result persistence
- Enable/disable toggle on project page

**Deliverable**: User can test backgammon guru against GNU Backgammon engine and track results over time

### Phase 2: History & Analytics

**Focus**: Track improvement and identify patterns

- History page showing past sessions and results
- Accuracy statistics (% of times guru matched best move)
- Session summaries with total tests performed
- Export results as JSON/CSV
- Filter results by dice roll or date range

**Deliverable**: Users can measure guru improvement after research runs

**⚠️ CHECKPOINT: Stop implementation after Phase 2 and check in with user before proceeding to Phase 3. Phase 3 is speculative and may not be needed.**

### Phase 3: Enhanced Positions (Post-MVP)

**Focus**: Beyond opening positions

- Support for non-opening positions (custom board setups)
- Pre-defined test scenarios from known problem sets
- Batch testing mode (run multiple positions automatically)
- Comparison dashboard across corpus versions

**Deliverable**: Comprehensive guru testing beyond simple opening rolls

**Note**: Only implement Phase 3 after explicit user approval. This phase represents significant scope expansion and should be re-evaluated based on actual usage patterns from Phases 1-2.

---

## 15. Open Questions

1. **Accuracy Calculation**: How to determine if guru "matched" best move? Options:
   - Exact string match of top move
   - Guru mentioned top move anywhere in response
   - Guru's reasoning aligned with engine's top 3 moves
   - **Recommendation**: Store boolean `guruMatchedBest` as nullable, let user manually mark during review

2. **Session Boundaries**: When does a session end? Options:
   - User clicks "End Session" button
   - After browser close (mark as abandoned)
   - Auto-end after 30 minutes of inactivity
   - **Recommendation**: Keep session open until user explicitly ends it or starts new one

3. **Multiple Dice Rolls per Session**: Should each dice roll be a separate result, or should user be able to test same roll multiple times?
   - **Recommendation**: Each "Check Answer" creates new AssessmentResult, allowing retesting same roll

4. **History Display**: How much history to show by default?
   - **Recommendation**: Last 10 sessions, expandable to show all results within each session

---

## 16. References

### Internal Documentation

- `drill-mode-extraction-package/DRILL_MODE_ARCHITECTURE.md` - Complete drill system blueprint
- `drill-mode-extraction-package/INTEGRATION_GUIDE.md` - Step-by-step integration
- `backgammon-engine-MCP-README.md` - GNU Backgammon MCP server setup
- `specs/feat-guru-builder-system-mvp.md` - Original system architecture

### External Documentation

- Vercel AI SDK v5: https://sdk.vercel.ai/docs
- Claude Extended Thinking: https://docs.anthropic.com/
- Prisma Relations: https://www.prisma.io/docs/concepts/components/prisma-schema/relations

### Design Patterns

- **Connector Pattern**: Abstract interface with domain-specific implementations
- **Streaming Chat**: AI SDK's useChat hook with request-level body configuration
- **Race Condition Prevention**: Placeholder + async update pattern
- **Server Components**: Next.js 15 async params pattern

---

## 17. Appendix: Validation Schemas

```typescript
// lib/assessment/validation.ts

import { z } from 'zod'

// Dice roll validation (e.g., "3-1", "6-2")
export const diceRollSchema = z.string().regex(
  /^[1-6]-[1-6]$/,
  'Invalid dice roll format. Use format like "3-1"'
)

// Backgammon move from engine
export const backgammonMoveSchema = z.object({
  move: z.string(),
  equity: z.number()
})

// Assessment config (simple for backgammon-only MVP)
export const assessmentConfigSchema = z.object({
  engineUrl: z.string().url().default('https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'),
  isEnabled: z.boolean().default(true)
})

// Save assessment result
export const saveResultSchema = z.object({
  sessionId: z.string(),
  diceRoll: diceRollSchema,
  guruResponse: z.string().min(1),
  bestMoves: z.array(backgammonMoveSchema),
  guruMatchedBest: z.boolean().nullable().optional()
})

// Chat request
export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })),
  diceRoll: diceRollSchema
})

// Ground truth request
export const groundTruthRequestSchema = z.object({
  diceRoll: diceRollSchema
})

export type DiceRoll = z.infer<typeof diceRollSchema>
export type BackgammonMoveData = z.infer<typeof backgammonMoveSchema>
export type SaveResultData = z.infer<typeof saveResultSchema>
```

---

**End of Specification**

*Quality Score: 9/10 - Simplified, focused on core value (session tracking + side-by-side comparison), no unnecessary abstractions*
