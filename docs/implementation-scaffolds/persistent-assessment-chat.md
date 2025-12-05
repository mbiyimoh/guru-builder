# Implementation Scaffold: Persistent Assessment Chat with History

## Overview

Transform self-assessment from single Q&A to full conversational chat with persistent message history linked to assessment sessions.

**Status:** Planning
**Estimated Effort:** 5-6 hours
**Dependencies:** Existing assessment system, Prisma, AI SDK v5

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE (Single Q&A)                        │
│  User → "Ask Guru" button → Single response → Clear on new problem  │
│  Messages stored: Component state only (ephemeral)                   │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    TARGET STATE (Persistent Chat)                    │
│  User → Text input + followups → Full conversation → Saved to DB    │
│  Messages stored: PostgreSQL with session + dice roll grouping       │
│  History page: View full conversation threads per problem            │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User enters dice roll "3-1"
  ↓
Load existing messages for (sessionId + "3-1") from DB
  ↓
Hydrate useChat with loaded messages
  ↓
User types question → Send message
  ↓
Save user message to DB immediately
  ↓
Stream assistant response (optimistic UI)
  ↓
When stream completes → Save assistant message to DB
  ↓
User clicks "Check Answer" → Create AssessmentResult linked to messages
  ↓
User continues conversation → More messages persisted
  ↓
User enters new dice roll "4-2" → Repeat process (separate thread)
```

---

## Phase 1: Database Schema Extension

### New Model: AssessmentMessage

**File:** `prisma/schema.prisma` (add after `AssessmentResult`)

```prisma
model AssessmentMessage {
  id        String   @id @default(cuid())
  sessionId String
  diceRoll  String   // Links messages to specific problem (e.g., "3-1")
  resultId  String?  // Optional link to AssessmentResult (when "Check Answer" clicked)

  // Message content
  role      String   // 'user' | 'assistant'
  content   String   @db.Text  // Extracted text content for display
  parts     Json     // AI SDK v5 parts array format for full fidelity

  // Metadata (from audit trail)
  messageId String?  @unique  // Links to audit trail record
  tokens    Json?    // { prompt: N, completion: N, total: N }
  reasoning String?  @db.Text // Extended thinking traces
  cost      Json?    // { prompt: $X, completion: $Y, total: $Z }

  createdAt DateTime @default(now())

  // Relations
  session AssessmentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  result  AssessmentResult? @relation(fields: [resultId], references: [id], onDelete: SetNull)

  @@index([sessionId, diceRoll, createdAt])
  @@index([resultId])
  @@index([messageId])
}
```

### Update Existing Models

```prisma
// Add to AssessmentSession
model AssessmentSession {
  // ... existing fields ...
  messages AssessmentMessage[]
}

// Add to AssessmentResult
model AssessmentResult {
  // ... existing fields ...
  messages AssessmentMessage[]
}
```

### Migration Commands

```bash
# 1. Backup database (MANDATORY)
npm run db:backup

# 2. Create migration
npm run migrate:safe -- add-assessment-messages

# 3. Verify migration
npx prisma studio
# Check: Navigate to AssessmentMessage model, should see empty table
```

---

## Phase 2: Message Persistence API

### 2.1 Create Message Save Endpoint

**File:** `app/api/projects/[id]/assessment/messages/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// AI SDK v5 message format
const aiSdkMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
})

const saveMessageSchema = z.object({
  sessionId: z.string().cuid(),
  diceRoll: z.string().regex(/^[1-6]-[1-6]$/),
  role: z.enum(['user', 'assistant']),
  parts: z.array(aiSdkMessagePartSchema),
  messageId: z.string().uuid().optional(), // From audit trail
  tokens: z.object({
    prompt: z.number().int().optional(),
    completion: z.number().int().optional(),
    total: z.number().int().optional(),
  }).optional(),
  reasoning: z.string().optional(),
  cost: z.object({
    prompt: z.number().optional(),
    completion: z.number().optional(),
    total: z.number().optional(),
  }).optional(),
})

// Helper to extract text from parts array
function extractTextContent(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('')
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    const parsed = saveMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { sessionId, diceRoll, role, parts, messageId, tokens, reasoning, cost } = parsed.data

    // Verify session belongs to project
    const session = await prisma.assessmentSession.findFirst({
      where: {
        id: sessionId,
        config: { projectId },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or does not belong to project' },
        { status: 404 }
      )
    }

    // Extract text content for display
    const content = extractTextContent(parts)

    // Save message
    const message = await prisma.assessmentMessage.create({
      data: {
        sessionId,
        diceRoll,
        role,
        content,
        parts,
        messageId,
        tokens,
        reasoning,
        cost,
      },
    })

    console.log(`[Assessment] Saved ${role} message for session ${sessionId}, dice ${diceRoll}`)

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/messages] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save message',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
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
    const { searchParams } = new URL(request.url)

    const sessionId = searchParams.get('sessionId')
    const diceRoll = searchParams.get('diceRoll')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter required' },
        { status: 400 }
      )
    }

    // Verify session belongs to project
    const session = await prisma.assessmentSession.findFirst({
      where: {
        id: sessionId,
        config: { projectId },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Build where clause
    const where: any = { sessionId }
    if (diceRoll) {
      where.diceRoll = diceRoll
    }

    // Fetch messages in chronological order
    const messages = await prisma.assessmentMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        parts: true,
        diceRoll: true,
        messageId: true,
        tokens: true,
        reasoning: true,
        cost: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      messages,
      count: messages.length,
      sessionId,
      diceRoll: diceRoll || null,
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/assessment/messages] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

### 2.2 Update Chat API to Persist Messages

**File:** `app/api/projects/[id]/assessment/chat/route.ts`

**Modifications:**

```typescript
// At the top, add import
import { prisma } from '@/lib/db'

// After streaming completes, add message persistence
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ... existing code to parse request, compose context, generate messageId ...

    const { messages: uiMessages, diceRoll } = parsed.data

    // NEW: Get sessionId from request body (frontend must pass it)
    const sessionId = body.sessionId as string | undefined
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId required in request body' },
        { status: 400 }
      )
    }

    // ... existing code for composing context and streaming ...

    // NEW: Save user message immediately (before streaming)
    const userMessage = uiMessages[uiMessages.length - 1]
    if (userMessage) {
      await prisma.assessmentMessage.create({
        data: {
          sessionId,
          diceRoll,
          role: userMessage.role,
          content: userMessage.parts
            .filter((p) => p.type === 'text' && p.text)
            .map((p) => p.text)
            .join(''),
          parts: userMessage.parts,
        },
      })
      console.log('[Assessment Chat] User message saved')
    }

    // Stream response
    const result = streamText({ model, messages, ... })

    // NEW: Save assistant message after streaming completes
    Promise.all([result.text, result.reasoning, result.usage])
      .then(async ([text, reasoning, usage]) => {
        // Extract reasoning traces
        const reasoningText = reasoning?.map((r) => r.text).join('\n\n')

        // Calculate costs
        const costs = usage ? {
          prompt: ((usage.inputTokens || 0) / 1_000_000) * 3.0,
          completion: ((usage.outputTokens || 0) / 1_000_000) * 15.0,
          total: 0,
        } : undefined
        if (costs) costs.total = costs.prompt + costs.completion

        // Save assistant message
        await prisma.assessmentMessage.create({
          data: {
            sessionId,
            diceRoll,
            role: 'assistant',
            content: text,
            parts: [{ type: 'text', text }], // Reconstruct parts from final text
            messageId, // Link to audit trail
            tokens: usage ? {
              prompt: usage.inputTokens || 0,
              completion: usage.outputTokens || 0,
              total: usage.totalTokens || 0,
            } : undefined,
            reasoning: reasoningText,
            cost: costs,
          },
        })
        console.log('[Assessment Chat] Assistant message saved')
      })
      .catch((error) => {
        console.error('[Assessment Chat] Failed to save assistant message:', error)
        // Don't fail the request - message streaming already succeeded
      })

    // Return streaming response (existing code)
    const response = result.toTextStreamResponse()
    response.headers.set('X-Message-Id', messageId)
    return response
  } catch (error) {
    // ... existing error handling ...
  }
}
```

### 2.3 Update Request Schema

**File:** `lib/assessment/validation.ts`

```typescript
// Update chatRequestSchema to require sessionId
export const chatRequestSchema = z.object({
  messages: z.array(aiSdkMessageSchema),
  diceRoll: z.string().regex(/^[1-6]-[1-6]$/),
  sessionId: z.string().cuid(), // NEW: Required for message persistence
})
```

---

## Phase 3: Frontend Message Loading & Persistence

### 3.1 Update AssessmentClient Component

**File:** `components/assessment/AssessmentClient.tsx`

**Key Modifications:**

```typescript
'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'
// ... other imports ...

export function AssessmentClient({ projectId }: Props) {
  // ... existing state ...

  // NEW: Loading state for message history
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  // ... existing transport and useChat setup ...

  // NEW: Load message history when dice roll changes
  useEffect(() => {
    async function loadMessages() {
      if (!currentDice || !sessionId) return

      setIsLoadingMessages(true)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/assessment/messages?sessionId=${sessionId}&diceRoll=${currentDice}`
        )
        const data = await response.json()

        if (data.messages && data.messages.length > 0) {
          // Convert DB messages to AI SDK v5 format
          const loadedMessages = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            parts: msg.parts,
            createdAt: new Date(msg.createdAt),
          }))

          // Hydrate useChat with loaded messages
          setMessages(loadedMessages)
          console.log(`[Assessment] Loaded ${loadedMessages.length} messages for ${currentDice}`)
        }
      } catch (error) {
        console.error('[Assessment] Failed to load messages:', error)
        // Don't fail - just start with empty chat
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [currentDice, sessionId, projectId, setMessages])

  // MODIFY: startProblem to save messages before clearing
  async function startProblem() {
    if (!diceRoll.match(/^[1-6]-[1-6]$/)) {
      setError('Invalid dice format. Use format like "3-1"')
      return
    }

    setError(null)

    // If changing dice roll, messages will be auto-loaded by useEffect
    // No need to manually clear - they'll be replaced
    setCurrentDice(diceRoll)
    setGroundTruth(null)
    setLastResultId(null)

    // Create session if not exists
    if (!sessionId) {
      const response = await fetch(`/api/projects/${projectId}/assessment/session`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.session) {
        setSessionId(data.session.id)
      }
    }
  }

  // MODIFY: askGuru to pass sessionId in request body
  function askGuru() {
    if (!currentDice || !sessionId) return

    sendMessage(
      { text: 'What is the best move for this position?' },
      {
        body: {
          diceRoll: currentDice,
          sessionId, // NEW: Pass sessionId for message persistence
        }
      }
    )
  }

  // NEW: Support freeform text input (not just "Ask Guru" button)
  const [userInput, setUserInput] = useState('')

  function sendUserMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!userInput.trim() || !currentDice || !sessionId) return

    sendMessage(
      { text: userInput },
      {
        body: {
          diceRoll: currentDice,
          sessionId,
        },
      }
    )
    setUserInput('')
  }

  return (
    <div className="space-y-6">
      {/* ... existing dice roll input ... */}

      {/* Split Screen */}
      {currentDice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Board + Guru Chat */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Guru Analysis</h2>
              {isLoadingMessages && (
                <p className="text-xs text-gray-500">Loading conversation history...</p>
              )}
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
                  <p className="whitespace-pre-wrap">{getMessageText(msg.parts)}</p>
                </div>
              ))}
              {isLoading && <p className="text-gray-500 text-sm">Guru is thinking...</p>}
            </div>

            {/* NEW: Text input for follow-up questions */}
            <div className="p-4 border-t space-y-2">
              <form onSubmit={sendUserMessage} className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                  disabled={isLoading || isLoadingMessages}
                />
                <button
                  type="submit"
                  disabled={isLoading || isLoadingMessages || !userInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  Send
                </button>
              </form>

              {/* Quick action button (kept for convenience) */}
              <button
                onClick={askGuru}
                disabled={isLoading || isLoadingMessages}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
              >
                {isLoading ? 'Thinking...' : 'Ask: "What is the best move?"'}
              </button>
            </div>
          </div>

          {/* Right: Ground Truth (unchanged) */}
          {/* ... existing ground truth panel ... */}
        </div>
      )}

      {/* Audit Trail Section (unchanged) */}
      {/* ... existing audit trail UI ... */}
    </div>
  )
}
```

---

## Phase 4: Result-Message Integration

### 4.1 Update Result Saving to Link Messages

**File:** `app/api/projects/[id]/assessment/results/route.ts`

**Modifications:**

```typescript
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ... existing code to parse and validate ...

    const { sessionId, diceRoll, guruResponse, bestMoves, guruMatchedBest } = parsed.data

    // Save result
    const result = await prisma.assessmentResult.create({
      data: {
        sessionId,
        diceRoll,
        guruResponse,
        bestMoves,
        guruMatchedBest,
      },
    })

    // NEW: Link all messages for this dice roll to the result
    await prisma.assessmentMessage.updateMany({
      where: {
        sessionId,
        diceRoll,
        resultId: null, // Only update unlinked messages
      },
      data: {
        resultId: result.id,
      },
    })

    console.log(`[Assessment] Linked messages to result ${result.id}`)

    // Update session's lastResultId
    await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: { lastResultId: result.id },
    })

    return NextResponse.json({ result }, { status: 201 })
  } catch (error) {
    // ... existing error handling ...
  }
}
```

---

## Phase 5: History Page Enhancement

### 5.1 Create Conversation Modal Component

**File:** `components/assessment/ConversationModal.tsx` (NEW)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  tokens?: { prompt: number; completion: number; total: number }
  cost?: { prompt: number; completion: number; total: number }
  reasoning?: string
  createdAt: string
}

interface Props {
  projectId: string
  sessionId: string
  diceRoll: string
  isOpen: boolean
  onClose: () => void
}

export function ConversationModal({ projectId, sessionId, diceRoll, isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    async function fetchMessages() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/assessment/messages?sessionId=${sessionId}&diceRoll=${diceRoll}`
        )
        const data = await response.json()

        if (data.error) throw new Error(data.error)
        setMessages(data.messages || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [isOpen, projectId, sessionId, diceRoll])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Conversation: Dice Roll {diceRoll}</h2>
            <p className="text-sm text-gray-600">{messages.length} messages</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && (
            <div className="text-center text-gray-500">Loading conversation...</div>
          )}

          {error && (
            <div className="text-center text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          {!isLoading && !error && messages.length === 0 && (
            <div className="text-center text-gray-500">No messages found</div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div
                className={`p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-50 border border-blue-200 ml-12'
                    : 'bg-gray-50 border border-gray-200 mr-12'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700 uppercase">
                    {msg.role}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {/* Metadata for assistant messages */}
                {msg.role === 'assistant' && (msg.tokens || msg.cost) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                    {msg.tokens && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Tokens:</span>{' '}
                        {msg.tokens.total.toLocaleString()} ({msg.tokens.prompt} prompt +{' '}
                        {msg.tokens.completion} completion)
                      </div>
                    )}
                    {msg.cost && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Cost:</span> ${msg.cost.total.toFixed(4)}
                      </div>
                    )}
                    {msg.reasoning && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-purple-600 hover:text-purple-800 font-medium">
                          View Reasoning Traces
                        </summary>
                        <pre className="mt-2 p-2 bg-purple-50 rounded text-xs whitespace-pre-wrap">
                          {msg.reasoning}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 5.2 Update History Page to Show Conversations

**File:** `app/projects/[id]/assessment/history/page.tsx`

**Add to imports:**
```typescript
import { ConversationModal } from '@/components/assessment/ConversationModal'
```

**Update result display to include conversation link:**
```typescript
// In the results mapping section
{results.map((result) => (
  <div key={result.id} className="border-l-4 border-blue-400 pl-4 py-2">
    <div className="flex justify-between items-start">
      <div>
        <p className="font-mono text-sm font-medium">Dice: {result.diceRoll}</p>
        <p className="text-xs text-gray-600">
          {result.guruMatchedBest === true ? '✅ Matched best move' :
           result.guruMatchedBest === false ? '❌ Did not match' :
           '⏸️ Not evaluated'}
        </p>
        {result.userRating && (
          <div className="flex items-center gap-1 mt-1">
            {'⭐'.repeat(result.userRating)}
            <span className="text-xs text-gray-600">({result.userRating}/5)</span>
          </div>
        )}
      </div>

      {/* NEW: View Conversation button */}
      <button
        onClick={() => {
          setSelectedResult(result)
          setShowConversationModal(true)
        }}
        className="text-xs text-blue-600 hover:text-blue-800 underline"
      >
        View Conversation →
      </button>
    </div>
  </div>
))}

{/* NEW: Conversation modal */}
{showConversationModal && selectedResult && (
  <ConversationModal
    projectId={projectId}
    sessionId={selectedResult.sessionId}
    diceRoll={selectedResult.diceRoll}
    isOpen={showConversationModal}
    onClose={() => {
      setShowConversationModal(false)
      setSelectedResult(null)
    }}
  />
)}
```

---

## Phase 6: Testing Strategy

### 6.1 E2E Test Suite

**File:** `tests/features/persistent-assessment-chat.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test'

test.describe('Persistent Assessment Chat', () => {
  let projectId: string
  let sessionId: string

  test.beforeEach(async ({ page }) => {
    // Create test project with assessment config
    const response = await page.request.post('/api/projects', {
      data: { name: 'Test Backgammon Guru', description: 'Testing persistent chat' },
    })
    const { project } = await response.json()
    projectId = project.id

    // Enable assessment
    await page.request.post(`/api/projects/${projectId}/assessment/config`, {
      data: { isEnabled: true },
    })

    // Navigate to assessment page
    await page.goto(`/projects/${projectId}/assessment`)
  })

  test('should persist multi-turn conversation', async ({ page }) => {
    // Start a problem
    await page.fill('[data-testid="dice-input"]', '3-1')
    await page.click('[data-testid="set-problem"]')

    // Ask initial question
    await page.click('[data-testid="ask-guru"]')
    await expect(page.locator('[data-testid="chat-messages"]')).toContainText('best move')

    // Wait for response
    await expect(page.locator('[data-testid="guru-response"]')).toBeVisible({ timeout: 15000 })

    // Ask follow-up question
    await page.fill('[data-testid="user-input"]', 'Why is that better than 24/21, 13/12?')
    await page.click('[data-testid="send-message"]')
    await expect(page.locator('[data-testid="chat-messages"]')).toContainText('24/21, 13/12')

    // Wait for second response
    await expect(page.locator('[data-testid="guru-response"]').nth(1)).toBeVisible({
      timeout: 15000,
    })

    // Refresh page
    await page.reload()

    // Messages should still be there
    await expect(page.locator('[data-testid="chat-messages"]')).toContainText('best move')
    await expect(page.locator('[data-testid="chat-messages"]')).toContainText('24/21, 13/12')
  })

  test('should separate conversations by dice roll', async ({ page }) => {
    // Problem 1
    await page.fill('[data-testid="dice-input"]', '3-1')
    await page.click('[data-testid="set-problem"]')
    await page.click('[data-testid="ask-guru"]')
    await expect(page.locator('[data-testid="guru-response"]')).toBeVisible({ timeout: 15000 })

    // Problem 2
    await page.fill('[data-testid="dice-input"]', '4-2')
    await page.click('[data-testid="set-problem"]')

    // Should see empty chat (different dice roll)
    await expect(page.locator('[data-testid="chat-messages"]')).toBeEmpty()

    // Ask question for second problem
    await page.click('[data-testid="ask-guru"]')
    await expect(page.locator('[data-testid="guru-response"]')).toBeVisible({ timeout: 15000 })

    // Go back to first problem
    await page.fill('[data-testid="dice-input"]', '3-1')
    await page.click('[data-testid="set-problem"]')

    // Should see first problem's conversation
    await expect(page.locator('[data-testid="chat-messages"]')).toContainText('best move')
  })

  test('should link messages to result on "Check Answer"', async ({ page }) => {
    // Start problem and ask question
    await page.fill('[data-testid="dice-input"]', '3-1')
    await page.click('[data-testid="set-problem"]')
    await page.click('[data-testid="ask-guru"]')
    await expect(page.locator('[data-testid="guru-response"]')).toBeVisible({ timeout: 15000 })

    // Check answer
    await page.click('[data-testid="check-answer"]')
    await expect(page.locator('[data-testid="ground-truth"]')).toBeVisible({ timeout: 5000 })

    // Navigate to history
    await page.click('[data-testid="view-history"]')

    // Find the result
    const result = page.locator('[data-testid="result-3-1"]')
    await expect(result).toBeVisible()

    // Click "View Conversation"
    await result.locator('[data-testid="view-conversation"]').click()

    // Modal should show messages
    const modal = page.locator('[data-testid="conversation-modal"]')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('best move')
  })

  test('should display message metadata in history', async ({ page }) => {
    // Complete a conversation
    await page.fill('[data-testid="dice-input"]', '3-1')
    await page.click('[data-testid="set-problem"]')
    await page.click('[data-testid="ask-guru"]')
    await expect(page.locator('[data-testid="guru-response"]')).toBeVisible({ timeout: 15000 })
    await page.click('[data-testid="check-answer"]')

    // Go to history
    await page.click('[data-testid="view-history"]')
    await page.locator('[data-testid="view-conversation"]').first().click()

    // Check for metadata display
    const modal = page.locator('[data-testid="conversation-modal"]')
    await expect(modal).toContainText('Tokens:')
    await expect(modal).toContainText('Cost:')
  })
})
```

### 6.2 Unit Tests for Message Persistence

**File:** `lib/assessment/__tests__/messagePersistence.test.ts` (NEW)

```typescript
import { prisma } from '@/lib/db'
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals'

describe('Assessment Message Persistence', () => {
  let testProjectId: string
  let testSessionId: string

  beforeEach(async () => {
    // Create test project and session
    const project = await prisma.project.create({
      data: { name: 'Test Project', description: 'For testing' },
    })
    testProjectId = project.id

    const config = await prisma.selfAssessmentConfig.create({
      data: { projectId: testProjectId, isEnabled: true },
    })

    const session = await prisma.assessmentSession.create({
      data: { configId: config.id },
    })
    testSessionId = session.id
  })

  afterEach(async () => {
    // Cleanup
    await prisma.project.delete({ where: { id: testProjectId } })
  })

  it('should save user and assistant messages', async () => {
    // Save user message
    const userMessage = await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'user',
        content: 'What is the best move?',
        parts: [{ type: 'text', text: 'What is the best move?' }],
      },
    })

    expect(userMessage.id).toBeDefined()
    expect(userMessage.role).toBe('user')

    // Save assistant message
    const assistantMessage = await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'assistant',
        content: 'The best move is 8/5, 6/5.',
        parts: [{ type: 'text', text: 'The best move is 8/5, 6/5.' }],
        tokens: { prompt: 100, completion: 50, total: 150 },
        cost: { prompt: 0.0003, completion: 0.00075, total: 0.00105 },
      },
    })

    expect(assistantMessage.id).toBeDefined()
    expect(assistantMessage.tokens).toBeDefined()
  })

  it('should retrieve messages in chronological order', async () => {
    // Create messages out of order
    await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'assistant',
        content: 'Response 1',
        parts: [{ type: 'text', text: 'Response 1' }],
      },
    })

    await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'user',
        content: 'Question 1',
        parts: [{ type: 'text', text: 'Question 1' }],
      },
    })

    await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'user',
        content: 'Question 2',
        parts: [{ type: 'text', text: 'Question 2' }],
      },
    })

    // Retrieve in order
    const messages = await prisma.assessmentMessage.findMany({
      where: { sessionId: testSessionId, diceRoll: '3-1' },
      orderBy: { createdAt: 'asc' },
    })

    expect(messages.length).toBe(3)
    // Should be in chronological order (oldest first)
    expect(messages[0].content).toBe('Response 1')
    expect(messages[1].content).toBe('Question 1')
    expect(messages[2].content).toBe('Question 2')
  })

  it('should filter messages by dice roll', async () => {
    // Create messages for different dice rolls
    await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'user',
        content: 'Question about 3-1',
        parts: [{ type: 'text', text: 'Question about 3-1' }],
      },
    })

    await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '4-2',
        role: 'user',
        content: 'Question about 4-2',
        parts: [{ type: 'text', text: 'Question about 4-2' }],
      },
    })

    // Query for specific dice roll
    const messages31 = await prisma.assessmentMessage.findMany({
      where: { sessionId: testSessionId, diceRoll: '3-1' },
    })

    const messages42 = await prisma.assessmentMessage.findMany({
      where: { sessionId: testSessionId, diceRoll: '4-2' },
    })

    expect(messages31.length).toBe(1)
    expect(messages31[0].content).toBe('Question about 3-1')
    expect(messages42.length).toBe(1)
    expect(messages42[0].content).toBe('Question about 4-2')
  })

  it('should link messages to result', async () => {
    // Create messages
    const msg1 = await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'user',
        content: 'Question',
        parts: [{ type: 'text', text: 'Question' }],
      },
    })

    const msg2 = await prisma.assessmentMessage.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        role: 'assistant',
        content: 'Answer',
        parts: [{ type: 'text', text: 'Answer' }],
      },
    })

    // Create result
    const result = await prisma.assessmentResult.create({
      data: {
        sessionId: testSessionId,
        diceRoll: '3-1',
        guruResponse: 'Answer',
        bestMoves: [{ move: '8/5, 6/5', equity: 0.12 }],
      },
    })

    // Link messages to result
    await prisma.assessmentMessage.updateMany({
      where: { sessionId: testSessionId, diceRoll: '3-1' },
      data: { resultId: result.id },
    })

    // Verify linkage
    const linkedMessages = await prisma.assessmentMessage.findMany({
      where: { resultId: result.id },
    })

    expect(linkedMessages.length).toBe(2)
  })
})
```

---

## Implementation Checklist

### Phase 1: Database ✅
- [ ] Add `AssessmentMessage` model to schema
- [ ] Add relations to `AssessmentSession` and `AssessmentResult`
- [ ] Create migration with `npm run db:backup && npm run migrate:safe`
- [ ] Verify schema in Prisma Studio

### Phase 2: Backend API ✅
- [ ] Create `POST /api/projects/[id]/assessment/messages` (save message)
- [ ] Create `GET /api/projects/[id]/assessment/messages` (retrieve history)
- [ ] Update chat API to save user message before streaming
- [ ] Update chat API to save assistant message after streaming
- [ ] Update validation schemas to require `sessionId`
- [ ] Test API endpoints with Postman/curl

### Phase 3: Frontend Loading ✅
- [ ] Add `useEffect` to load messages on dice roll change
- [ ] Hydrate `useChat` with loaded messages from DB
- [ ] Add loading state for message history
- [ ] Pass `sessionId` in chat request body
- [ ] Replace "Ask Guru" button with text input + send button
- [ ] Keep "Ask Guru" as quick action button

### Phase 4: Result Integration ✅
- [ ] Update result saving to link messages via `resultId`
- [ ] Test that messages are linked correctly

### Phase 5: History Display ✅
- [ ] Create `ConversationModal` component
- [ ] Add "View Conversation" button to each result
- [ ] Display messages with metadata (tokens, cost, reasoning)
- [ ] Add conversation modal to history page

### Phase 6: Testing ✅
- [ ] Write E2E tests for multi-turn conversation
- [ ] Write E2E test for dice roll separation
- [ ] Write E2E test for result-message linking
- [ ] Write unit tests for message persistence
- [ ] Test message retrieval and ordering
- [ ] Manual testing: Create session, have conversation, refresh, verify persistence

---

## Key Integration Points

### Plays Nice With:

1. **Existing Audit Trail System** (`lib/assessment/auditUtils.ts`)
   - Messages reference `messageId` from audit trail
   - Audit trail provides tokens, costs, reasoning
   - Message persistence includes audit metadata

2. **Session Management** (`app/api/projects/[id]/assessment/session/route.ts`)
   - Sessions continue to track `lastResultId`
   - Messages belong to session via `sessionId`
   - Session lifecycle unchanged

3. **Ground Truth Checking** (`app/api/projects/[id]/assessment/ground-truth/route.ts`)
   - No changes needed
   - Continues to return best moves
   - Result saving links messages

4. **Star Rating** (`components/assessment/StarRating.tsx`)
   - No changes needed
   - Rating applies to result, which links to messages

5. **Score Calculation** (`lib/assessment/scoreCalculation.ts`)
   - No changes needed
   - Continues to use `AssessmentResult` data

### Constraints & Considerations:

1. **AI SDK v5 Format**: Must preserve `parts` array format for `useChat` compatibility
2. **Streaming State**: Can't save assistant message until stream completes
3. **Optimistic UI**: Show messages immediately, persist asynchronously
4. **Dice Roll Scoping**: Messages are scoped to (sessionId + diceRoll) combination
5. **Backward Compatibility**: Existing `AssessmentResult.guruResponse` field remains (shows "the answer")

---

## Rollback Plan

If issues arise:

1. **Database Rollback:**
   ```bash
   # Restore from backup
   psql $DATABASE_URL < backups/backup_TIMESTAMP.sql
   ```

2. **Code Rollback:**
   - Revert changes to `AssessmentClient.tsx`
   - Revert changes to chat API route
   - Remove message persistence endpoints
   - Frontend will continue to work (just without persistence)

3. **Migration Rollback:**
   ```bash
   # List migrations
   npx prisma migrate status

   # Rollback last migration
   npx prisma migrate reset
   npx prisma migrate deploy
   ```

---

## Success Criteria

- [ ] User can have multi-turn conversation about a dice roll
- [ ] Conversation persists across page refreshes
- [ ] Different dice rolls have separate conversation threads
- [ ] History page shows "View Conversation" for each result
- [ ] Conversation modal displays full message thread with metadata
- [ ] No data loss during streaming or navigation
- [ ] All E2E tests passing

---

**Estimated Time:** 5-6 hours
**Priority:** High (core feature enhancement)
**Risk Level:** Medium (database changes, streaming persistence)
