# Task Breakdown: Self-Assessment Board Visibility, Audit Trail & Engine Integration

**Generated:** 2025-11-17
**Source:** specs/fix-self-assessment-board-audit-engine.md
**Task Manager:** STM (Simple Task Manager)

---

## Overview

Fix three critical self-assessment issues by copying proven patterns from reference implementation. Structured as phased approach with acceptance criteria gates.

**Total Tasks:** 12
**Phases:** 4 (Pre-flight, Board Visibility, Engine Integration, Audit Trail)

---

## Phase 0: Pre-Flight Verification

### Task 0.1: Verify Claude 3.7 Sonnet Extended Thinking Support
**Description:** Test that @ai-sdk/anthropic@2.0.42 supports extended thinking with Claude 3.7 Sonnet before implementing Phase 3
**Size:** Small
**Priority:** Critical
**Dependencies:** None
**Can run parallel with:** None (blocking)

**Technical Requirements:**
- Verify `anthropic('claude-3-7-sonnet-20250219')` model exists
- Test `providerOptions.anthropic.thinking` is accepted
- Confirm `result.reasoning` promise exists on stream result
- If fails, document fallback to Claude 4.5

**Implementation Steps:**
1. Create test script in project root:
```typescript
// test-extended-thinking.ts
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

async function testExtendedThinking() {
  console.log('Testing Claude 3.7 Sonnet extended thinking...')

  try {
    const model = anthropic('claude-3-7-sonnet-20250219')
    console.log('✓ Model created successfully')

    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
      providerOptions: {
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: 1024,
          },
        },
      },
    })

    console.log('✓ streamText with thinking options accepted')
    console.log('result.reasoning exists:', 'reasoning' in result)
    console.log('result.usage exists:', 'usage' in result)

    // Don't actually call the API, just verify structure
    console.log('✓ All checks passed - ready for Phase 3')
  } catch (error) {
    console.error('✗ Extended thinking test failed:', error)
    console.log('FALLBACK: Use claude-sonnet-4-5-20250929 with same pattern')
  }
}

testExtendedThinking()
```

2. Run with: `npx ts-node test-extended-thinking.ts`
3. Document results in task completion notes

**Acceptance Criteria:**
- [ ] Test script runs without TypeScript errors
- [ ] Model instantiation succeeds
- [ ] streamText accepts thinking providerOptions
- [ ] result object has reasoning and usage properties
- [ ] OR fallback model documented if 3.7 doesn't work

---

### Task 0.2: Verify TextStreamChatTransport Header Access
**Description:** Confirm that TextStreamChatTransport onResponse callback provides access to response headers for x-message-id
**Size:** Small
**Priority:** Critical
**Dependencies:** None
**Can run parallel with:** Task 0.1

**Technical Requirements:**
- Check if TextStreamChatTransport has onResponse callback option
- Verify response.headers.get() works for custom headers
- If not supported, plan fallback (return ID in stream data)

**Implementation Steps:**
1. Check AI SDK v5 TextStreamChatTransport signature:
```typescript
import { TextStreamChatTransport } from 'ai'

// Verify constructor options
const transport = new TextStreamChatTransport({
  api: '/test',
  body: () => ({}),
  onResponse: (response) => {
    // Does this exist?
    console.log('Headers accessible:', response.headers)
  },
  onFinish: (message) => {
    // Does this exist?
    console.log('Message:', message)
  },
})
```

2. Alternative if not supported - return in stream metadata:
```typescript
// Server side - encode in response
return result.toDataStreamResponse({
  data: { messageId },
})

// Client side - extract from stream
const { data } = useChat()
// Check if data contains messageId
```

**Acceptance Criteria:**
- [ ] TextStreamChatTransport signature checked
- [ ] onResponse callback confirmed OR alternative documented
- [ ] Header access method verified
- [ ] Fallback approach ready if needed

---

## Phase 1: Board Visibility Fix (CRITICAL)

### Task 1.1: Add BoardPosition Type Definition
**Description:** Add type interface for dynamic board positions to support future extensibility
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None

**Technical Requirements:**
- Add to `lib/assessment/types.ts`
- Support for any board configuration, not just opening position
- Include player, dice, and position name

**Implementation:**
```typescript
// Add to lib/assessment/types.ts

export interface BoardPosition {
  board: BackgammonBoard
  player: 'x' | 'o'
  dice: [number, number]
  positionName: string // e.g., "Standard Opening Position"
}
```

**Acceptance Criteria:**
- [ ] Type added to types.ts
- [ ] TypeScript compiles without errors
- [ ] Type is exported and usable

---

### Task 1.2: Create composeBoardStatePrompt Function
**Description:** Create function to generate hybrid JSON + ASCII board representation for system prompt injection
**Size:** Medium
**Priority:** Critical
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Technical Requirements:**
- Function in `lib/assessment/contextComposer.ts`
- Takes dice roll, optional board (defaults to opening), optional position name
- Returns formatted string with both JSON structure and ASCII visualization
- Includes explicit "You CAN see the board" instruction

**Implementation:**
```typescript
// Add to lib/assessment/contextComposer.ts

import { OPENING_POSITION, BackgammonBoard } from './types'
import { renderOpeningBoard } from './asciiBoard'

export function composeBoardStatePrompt(
  dice: [number, number],
  board: BackgammonBoard = OPENING_POSITION,
  positionName: string = 'Standard Opening Position'
): string {
  const asciiBoard = renderOpeningBoard(dice)

  return `
---

# CURRENT POSITION - ASSESSMENT MODE

## Board State (Structured Data)
\`\`\`json
{
  "position": "${positionName}",
  "player_to_move": "Black",
  "dice_roll": [${dice[0]}, ${dice[1]}],
  "checkers": {
    "black": ${JSON.stringify(board.x)},
    "white": ${JSON.stringify(board.o)}
  }
}
\`\`\`

## Visual Representation
\`\`\`
${asciiBoard}
\`\`\`

## Your Task
Analyze the position above and recommend the best move(s) for Black with dice roll ${dice[0]}-${dice[1]}.

**Requirements:**
1. Specify exact checker movements (e.g., "8/5, 6/5" or "13/10, 24/21")
2. Explain the strategic reasoning based on your knowledge base
3. Reference specific principles that justify your choice
4. Consider alternative moves and why they're inferior

IMPORTANT: You CAN see the complete board state above. Use this information in your analysis.
`.trim()
}
```

**Acceptance Criteria:**
- [ ] Function created in contextComposer.ts
- [ ] Returns string with JSON block containing board data
- [ ] Returns string with ASCII board visualization
- [ ] Includes dice roll in both formats
- [ ] Contains explicit "You CAN see" instruction
- [ ] TypeScript compiles without errors

---

### Task 1.3: Update composeAssessmentContext to Inject Board State
**Description:** Modify main context composition function to append board state to system prompt
**Size:** Medium
**Priority:** Critical
**Dependencies:** Task 1.2
**Can run parallel with:** None

**Technical Requirements:**
- Update existing `composeAssessmentContext()` function
- Parse dice roll string into tuple
- Call `composeBoardStatePrompt()` and append to system prompt
- Remove old generic "Black to play" text

**Implementation:**
Replace the current implementation in `lib/assessment/contextComposer.ts`:

```typescript
export async function composeAssessmentContext(
  projectId: string,
  diceRoll: string
): Promise<AssessmentContextResult> {
  const layers = await prisma.contextLayer.findMany({
    where: { projectId, isActive: true },
    orderBy: { priority: 'asc' },
    select: { title: true, content: true },
  })

  if (layers.length === 0) {
    throw new Error('No active context layers found. Cannot assess guru without knowledge.')
  }

  let systemPrompt = `# BACKGAMMON GURU KNOWLEDGE BASE\n\n`

  layers.forEach((layer) => {
    systemPrompt += `## ${layer.title}\n\n`
    systemPrompt += `${layer.content}\n\n---\n\n`
  })

  // CRITICAL FIX: Inject actual board state instead of generic text
  const dice = diceRoll.split('-').map(Number) as [number, number]
  systemPrompt += '\n\n' + composeBoardStatePrompt(dice)

  return {
    systemPrompt,
    layerCount: layers.length,
  }
}
```

**Files to modify:**
- `lib/assessment/contextComposer.ts` - Replace lines 24-40

**What to remove:**
```typescript
// DELETE these lines (old implementation):
systemPrompt += `\n# ASSESSMENT MODE\n\n`
systemPrompt += `You are being tested on your backgammon knowledge. A standard opening position is shown.\n`
systemPrompt += `Black to play: ${diceRoll}\n\n`
systemPrompt += `Provide your recommended move(s) with clear reasoning based on the principles in your knowledge base.\n`
systemPrompt += `Be specific about which checkers to move and why.\n\n`
systemPrompt += `IMPORTANT: At the end of your response, include a "Context Audit Details" section that lists:\n`
systemPrompt += `- Which specific context layers you consulted\n`
systemPrompt += `- Key principles from each layer that influenced your recommendation\n`
systemPrompt += `- Any gaps in your knowledge base that affected your analysis\n`
```

**Acceptance Criteria:**
- [ ] Old generic text removed
- [ ] Dice roll parsed from string to tuple
- [ ] composeBoardStatePrompt() called and appended
- [ ] System prompt now includes JSON + ASCII board
- [ ] TypeScript compiles without errors
- [ ] No "Context Audit Details" instructions (removed for Phase 3)

---

### Task 1.4: Test Phase 1 - Board Visibility Validation
**Description:** Manually verify AI can see and reference board position
**Size:** Small
**Priority:** Critical
**Dependencies:** Task 1.3
**Can run parallel with:** None

**Test Steps:**
1. Restart dev server: `npm run clean && PORT=3002 npm run dev`
2. Navigate to assessment page for a project with context layers
3. Enter dice "3-1", click "Set Problem"
4. Click "Ask Guru"
5. Verify AI response

**Acceptance Criteria:**
- [ ] AI response mentions specific positions like "8-point", "6-point", "13-point", "24-point"
- [ ] AI recommends moves with standard notation (e.g., "8/5, 6/5" or "13/10, 24/21")
- [ ] NO "I cannot see the board" statements
- [ ] Server console shows system prompt contains "# CURRENT POSITION" section
- [ ] Server console shows JSON board data in prompt
- [ ] TypeScript compiles without errors
- [ ] GATE PASSED: Ready for Phase 2

---

## Phase 2: GNU Engine Integration Fix (HIGH)

### Task 2.1: Add Comprehensive Logging to Engine Client
**Description:** Add detailed request/response logging to diagnose engine failures
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.4 (Phase 1 complete)
**Can run parallel with:** None

**Technical Requirements:**
- Log all request details before sending
- Log response status and headers
- Log raw response body before parsing
- Log parsed JSON structure
- Log validated moves array

**Implementation:**
Replace `getBackgammonGroundTruth` in `lib/assessment/backgammonEngine.ts`:

```typescript
export async function getBackgammonGroundTruth(
  diceRoll: [number, number],
  engineUrl: string = DEFAULT_ENGINE_URL
): Promise<BackgammonMove[]> {
  console.log('[GNUBG] Requesting best moves for dice:', diceRoll)
  console.log('[GNUBG] Engine URL:', engineUrl)

  const requestBody = {
    board: OPENING_POSITION,
    dice: diceRoll,
    player: 'x',
    cubeful: false,
    'max-moves': 10,
    'score-moves': true,
  }

  console.log('[GNUBG] Request body:', JSON.stringify(requestBody, null, 2))

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${engineUrl}/plays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    console.log('[GNUBG] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GNUBG] Error response:', errorText)
      throw new Error(`Engine request failed: ${response.status} ${response.statusText}`)
    }

    const rawData = await response.text()
    console.log('[GNUBG] Raw response:', rawData)

    const data = JSON.parse(rawData)
    console.log('[GNUBG] Parsed response:', JSON.stringify(data, null, 2))

    const plays = data.plays || data.moves || []
    if (!Array.isArray(plays)) {
      throw new Error(`Invalid response structure. Keys: ${Object.keys(data).join(', ')}`)
    }

    // Validate each move
    const validatedMoves: BackgammonMove[] = plays.map((play: any, index: number) => {
      const moveStr = play.move || play.play || play.notation || ''
      let equity = play.equity || play.eq || play.value || 0
      if (typeof equity !== 'number') {
        equity = parseFloat(String(equity)) || 0
      }
      return { move: String(moveStr), equity: Number(equity) }
    })

    console.log('[GNUBG] Validated moves:', validatedMoves)
    return validatedMoves
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Engine request timed out after 30 seconds')
    }
    throw error
  }
}
```

**Acceptance Criteria:**
- [ ] All console.log statements added with [GNUBG] prefix
- [ ] Request body logged before fetch
- [ ] Response status logged
- [ ] Raw response text logged before JSON parse
- [ ] Parsed structure logged
- [ ] Validated moves array logged
- [ ] 30-second timeout implemented with AbortController
- [ ] TypeScript compiles without errors

---

### Task 2.2: Add Retry Logic with Exponential Backoff
**Description:** Implement retry wrapper for engine requests to handle Heroku dyno cold starts
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** None

**Technical Requirements:**
- 3 retry attempts
- Exponential backoff: 1s, 2s, 4s delays
- Log each attempt and failure
- Return result on first success
- Throw last error after all retries exhausted

**Implementation:**
Add to `lib/assessment/backgammonEngine.ts`:

```typescript
export async function getBackgammonGroundTruthWithRetry(
  diceRoll: [number, number],
  engineUrl: string = DEFAULT_ENGINE_URL,
  maxRetries: number = 3
): Promise<BackgammonMove[]> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[GNUBG] Attempt ${attempt}/${maxRetries}`)
      const result = await getBackgammonGroundTruth(diceRoll, engineUrl)

      if (result.length === 0) {
        throw new Error('Engine returned empty moves array')
      }

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[GNUBG] Attempt ${attempt} failed:`, lastError.message)

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        console.log(`[GNUBG] Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('All retry attempts failed')
}
```

**Acceptance Criteria:**
- [ ] Function exported from backgammonEngine.ts
- [ ] Logs attempt number (e.g., "Attempt 1/3")
- [ ] Exponential backoff: 1000ms, 2000ms, 4000ms
- [ ] Returns on first success
- [ ] Throws last error after all retries fail
- [ ] Treats empty array as error (triggers retry)
- [ ] TypeScript compiles without errors

---

### Task 2.3: Update Ground Truth Route to Use Retry Function
**Description:** Modify API route to use retry-enabled engine function
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** None

**Implementation:**
Update `app/api/projects/[id]/assessment/ground-truth/route.ts`:

```typescript
// Change import
import {
  parseDiceRoll,
  getBackgammonGroundTruthWithRetry  // Changed from getBackgammonGroundTruth
} from '@/lib/assessment/backgammonEngine'

// In POST handler, replace:
// const bestMoves = await getBackgammonGroundTruth(dice, config.engineUrl)
// With:
const bestMoves = await getBackgammonGroundTruthWithRetry(dice, config.engineUrl)

// Add better error response:
if (bestMoves.length === 0) {
  return NextResponse.json(
    {
      error: 'No moves returned',
      debug: { diceRoll, engineUrl: config.engineUrl },
    },
    { status: 502 }
  )
}
```

**Acceptance Criteria:**
- [ ] Import changed to getBackgammonGroundTruthWithRetry
- [ ] Function call updated
- [ ] Better error response with debug info
- [ ] TypeScript compiles without errors

---

### Task 2.4: Test Phase 2 - Engine Integration Validation
**Description:** Verify engine reliably returns and displays ground truth data
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.3
**Can run parallel with:** None

**Test Steps:**
1. Restart dev server
2. Set dice "3-1", click "Set Problem"
3. Click "Check Answer"
4. Monitor server logs for [GNUBG] entries

**Acceptance Criteria:**
- [ ] Server logs show `[GNUBG] Requesting best moves` with request details
- [ ] Server logs show `[GNUBG] Response status: 200` (or error details if failed)
- [ ] Server logs show `[GNUBG] Validated moves` array
- [ ] Best moves display in UI with equity values (e.g., "1. 8/5, 6/5  +0.1234")
- [ ] If engine sleeping, logs show retry attempts ("Attempt 1/3", "Retrying in...")
- [ ] Timeout after 30 seconds shows clear error
- [ ] TypeScript compiles without errors
- [ ] GATE PASSED: Ready for Phase 3

---

## Phase 3: Audit Trail Implementation (MEDIUM)

### Task 3.1: Create In-Memory Audit Store
**Description:** Create module to store and retrieve audit trails in memory
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.4 (Phase 2 complete)
**Can run parallel with:** None

**Implementation:**
Create new file `lib/assessment/auditStore.ts`:

```typescript
// lib/assessment/auditStore.ts

export interface AuditTrailData {
  messageId: string
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    reasoningTokens: number
  }
  reasoning: Array<{ text: string }>
  reasoningText: string
  costs: {
    input: number
    output: number
    total: number
  }
  contextLayers: number
  timestamp: string
}

const auditStore = new Map<string, AuditTrailData>()

export function createPlaceholderAuditTrail(data: {
  messageId: string
  model: string
  contextLayers: number
  systemPromptTokens: number
}) {
  auditStore.set(data.messageId, {
    messageId: data.messageId,
    model: data.model,
    usage: {
      inputTokens: data.systemPromptTokens,
      outputTokens: 0,
      totalTokens: data.systemPromptTokens,
      reasoningTokens: 0,
    },
    reasoning: [],
    reasoningText: '',
    costs: { input: 0, output: 0, total: 0 },
    contextLayers: data.contextLayers,
    timestamp: new Date().toISOString(),
  })
}

export function storeAuditTrail(data: AuditTrailData) {
  auditStore.set(data.messageId, data)
}

export function getAuditTrail(messageId: string): AuditTrailData | undefined {
  return auditStore.get(messageId)
}

export function cleanupOldAuditTrails(maxAgeMs: number = 3600000) {
  const now = Date.now()
  for (const [key, value] of auditStore.entries()) {
    if (now - new Date(value.timestamp).getTime() > maxAgeMs) {
      auditStore.delete(key)
    }
  }
}
```

**Acceptance Criteria:**
- [ ] File created at lib/assessment/auditStore.ts
- [ ] AuditTrailData interface exported
- [ ] createPlaceholderAuditTrail function creates placeholder entry
- [ ] storeAuditTrail function updates entry with real data
- [ ] getAuditTrail function retrieves by messageId
- [ ] cleanupOldAuditTrails removes entries older than maxAgeMs
- [ ] TypeScript compiles without errors

---

### Task 3.2: Update Chat Route with Extended Thinking and Audit Extraction
**Description:** Enable extended thinking, generate message IDs, extract real API metadata
**Size:** Large
**Priority:** Medium
**Dependencies:** Task 3.1, Task 0.1 (model verification)
**Can run parallel with:** None

**Implementation:**
Update `app/api/projects/[id]/assessment/chat/route.ts`:

```typescript
// Add imports at top
import { randomUUID } from 'crypto'
import { storeAuditTrail, createPlaceholderAuditTrail } from '@/lib/assessment/auditStore'

// Inside POST handler, after parsing request:
const messageId = randomUUID()

const contextResult = await composeAssessmentContext(projectId, diceRoll)

// Create placeholder immediately
createPlaceholderAuditTrail({
  messageId,
  model: 'claude-3-7-sonnet-20250219',
  contextLayers: contextResult.layerCount,
  systemPromptTokens: Math.ceil(contextResult.systemPrompt.length / 4),
})

// Convert messages (existing code)
const coreMessages: CoreMessage[] = uiMessages.map((msg) => ({
  role: msg.role,
  content: msg.parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join(''),
}))

const messages: CoreMessage[] = [
  { role: 'system', content: contextResult.systemPrompt },
  ...coreMessages,
]

// Switch to Claude 3.7 Sonnet with extended thinking
const model = anthropic('claude-3-7-sonnet-20250219')

const result = streamText({
  model,
  messages,
  providerOptions: {
    anthropic: {
      thinking: {
        type: 'enabled',
        budgetTokens: 5000,
      },
    },
  },
})

// Extract REAL audit data asynchronously (non-blocking)
Promise.all([result.reasoning, result.usage])
  .then(([reasoning, usage]) => {
    const costs = {
      input: (usage.inputTokens / 1_000_000) * 3.0,
      output: (usage.outputTokens / 1_000_000) * 15.0,
      total: 0,
    }
    costs.total = costs.input + costs.output

    storeAuditTrail({
      messageId,
      model: 'claude-3-7-sonnet-20250219',
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        reasoningTokens: (usage as any).reasoningTokens || 0,
      },
      reasoning: reasoning || [],
      reasoningText: reasoning?.map((r) => r.text).join('\n\n') || '',
      costs,
      contextLayers: contextResult.layerCount,
      timestamp: new Date().toISOString(),
    })

    console.log('[Audit] Captured for message:', messageId)
    console.log('  Input tokens:', usage.inputTokens)
    console.log('  Output tokens:', usage.outputTokens)
    console.log('  Total cost: $' + costs.total.toFixed(6))
  })
  .catch((error) => {
    console.error('[Audit] Failed to capture:', error)
  })

// Return with message ID header
return result.toTextStreamResponse({
  headers: {
    'x-message-id': messageId,
  },
})
```

**Acceptance Criteria:**
- [ ] randomUUID imported from crypto
- [ ] Audit store functions imported
- [ ] Message ID generated before streaming
- [ ] Placeholder audit created immediately
- [ ] Model switched to claude-3-7-sonnet-20250219
- [ ] Extended thinking enabled with budgetTokens: 5000
- [ ] Promises extracted asynchronously (non-blocking)
- [ ] Cost calculation uses real token counts
- [ ] Audit trail updated with real data
- [ ] Console logs show [Audit] captured message
- [ ] Response includes x-message-id header
- [ ] TypeScript compiles without errors

---

### Task 3.3: Create Audit Retrieval API Endpoint
**Description:** Create GET endpoint to fetch audit trail data by message ID
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 3.1
**Can run parallel with:** Task 3.2

**Implementation:**
Create new file `app/api/projects/[id]/assessment/audit/[messageId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuditTrail } from '@/lib/assessment/auditStore'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; messageId: string }> }
) {
  const { messageId } = await context.params

  const auditTrail = getAuditTrail(messageId)

  if (!auditTrail) {
    return NextResponse.json({ error: 'Audit trail not found' }, { status: 404 })
  }

  return NextResponse.json({ auditTrail })
}
```

**Acceptance Criteria:**
- [ ] File created at correct nested path
- [ ] Uses Next.js 15 async params pattern
- [ ] Imports getAuditTrail from store
- [ ] Returns 404 if not found
- [ ] Returns audit trail data if found
- [ ] TypeScript compiles without errors

---

### Task 3.4: Create Context Audit Modal Component
**Description:** Create modal component to display audit trail data
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.3
**Can run parallel with:** None

**Implementation:**
Create new file `components/assessment/ContextAuditModal.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { AuditTrailData } from '@/lib/assessment/auditStore'

interface Props {
  projectId: string
  messageId: string | null
  isOpen: boolean
  onClose: () => void
}

export function ContextAuditModal({ projectId, messageId, isOpen, onClose }: Props) {
  const [auditTrail, setAuditTrail] = useState<AuditTrailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && messageId) {
      setLoading(true)
      setError(null)
      fetch(`/api/projects/${projectId}/assessment/audit/${messageId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error)
          setAuditTrail(data.auditTrail)
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen, messageId, projectId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Context Audit Trail</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>

        {loading && <p>Loading audit data...</p>}
        {error && <p className="text-red-600">Error: {error}</p>}

        {auditTrail && (
          <div className="space-y-4">
            <section>
              <h3 className="font-semibold">Model</h3>
              <p className="font-mono text-sm">{auditTrail.model}</p>
            </section>

            <section>
              <h3 className="font-semibold">Token Usage</h3>
              <div className="font-mono text-sm">
                <p>Input: {auditTrail.usage.inputTokens.toLocaleString()}</p>
                <p>Output: {auditTrail.usage.outputTokens.toLocaleString()}</p>
                <p>Total: {auditTrail.usage.totalTokens.toLocaleString()}</p>
                {auditTrail.usage.reasoningTokens > 0 && (
                  <p>Reasoning: {auditTrail.usage.reasoningTokens.toLocaleString()}</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Cost</h3>
              <div className="font-mono text-sm">
                <p>Input: ${auditTrail.costs.input.toFixed(6)}</p>
                <p>Output: ${auditTrail.costs.output.toFixed(6)}</p>
                <p className="font-bold">Total: ${auditTrail.costs.total.toFixed(6)}</p>
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Context Layers Used</h3>
              <p>{auditTrail.contextLayers} layer(s)</p>
            </section>

            {auditTrail.reasoningText && (
              <section>
                <h3 className="font-semibold">Reasoning Traces</h3>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-60">
                  {auditTrail.reasoningText}
                </pre>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] File created at components/assessment/ContextAuditModal.tsx
- [ ] Uses 'use client' directive
- [ ] Fetches audit data when modal opens
- [ ] Shows loading state
- [ ] Shows error state
- [ ] Displays model name
- [ ] Displays token usage with toLocaleString() formatting
- [ ] Displays costs with 6 decimal places
- [ ] Displays context layers count
- [ ] Displays reasoning traces if present
- [ ] Modal has close button
- [ ] TypeScript compiles without errors

---

### Task 3.5: Update AssessmentClient to Capture Message ID and Show Audit Button
**Description:** Add state and UI for capturing message IDs and displaying View Audit Trail button
**Size:** Large
**Priority:** Medium
**Dependencies:** Task 3.4
**Can run parallel with:** None

**Implementation:**
Update `components/assessment/AssessmentClient.tsx`:

```typescript
// Add imports
import { ContextAuditModal } from './ContextAuditModal'

// Add state variables (after existing useState declarations)
const [messageAuditIds, setMessageAuditIds] = useState<Record<string, string>>({})
const [showAuditModal, setShowAuditModal] = useState(false)
const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
const pendingMessageIdRef = useRef<string | null>(null)

// Update transport to capture headers (replace existing useMemo)
const transport = useMemo(
  () =>
    new TextStreamChatTransport({
      api: `/api/projects/${projectId}/assessment/chat`,
      body: () => ({ diceRoll: currentDiceRef.current || '' }),
      onResponse: (response) => {
        const messageId = response.headers.get('x-message-id')
        if (messageId) {
          pendingMessageIdRef.current = messageId
        }
      },
      onFinish: (message) => {
        if (pendingMessageIdRef.current && message?.id) {
          setMessageAuditIds((prev) => ({
            ...prev,
            [message.id]: pendingMessageIdRef.current!,
          }))
          pendingMessageIdRef.current = null
        }
      },
    }),
  [projectId]
)

// In the message rendering section, add button after message text:
{messages.map((msg) => (
  <div
    key={msg.id}
    className={`p-3 rounded-lg text-sm ${
      msg.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'
    }`}
  >
    <p className="whitespace-pre-wrap">{getMessageText(msg.parts)}</p>
    {msg.role === 'assistant' && messageAuditIds[msg.id] && (
      <button
        onClick={() => {
          setSelectedAuditId(messageAuditIds[msg.id])
          setShowAuditModal(true)
        }}
        className="text-xs text-blue-600 hover:underline mt-2"
      >
        View Audit Trail
      </button>
    )}
  </div>
))}

// Add modal at end of return statement (before closing </div>):
<ContextAuditModal
  projectId={projectId}
  messageId={selectedAuditId}
  isOpen={showAuditModal}
  onClose={() => setShowAuditModal(false)}
/>
```

**Acceptance Criteria:**
- [ ] ContextAuditModal imported
- [ ] New state variables for audit tracking added
- [ ] pendingMessageIdRef created with useRef
- [ ] Transport onResponse captures x-message-id header
- [ ] Transport onFinish associates audit ID with message
- [ ] View Audit Trail button rendered for assistant messages with audit IDs
- [ ] Button click opens modal with correct audit ID
- [ ] Modal component added to render tree
- [ ] TypeScript compiles without errors

---

### Task 3.6: Test Phase 3 - Audit Trail Validation
**Description:** Verify complete audit trail flow from API metadata extraction to modal display
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.5
**Can run parallel with:** None

**Test Steps:**
1. Restart dev server: `npm run clean && PORT=3002 npm run dev`
2. Set dice "3-1", click "Set Problem"
3. Click "Ask Guru"
4. Wait for response to complete
5. Check for View Audit Trail button
6. Click button and verify modal contents

**Acceptance Criteria:**
- [ ] AI response contains ONLY move recommendation (NO "Context Audit Details" section)
- [ ] "View Audit Trail" button appears after assistant message
- [ ] Server logs show `[Audit] Captured for message: {uuid}`
- [ ] Server logs show exact input/output token counts (not estimates)
- [ ] Modal opens when button clicked
- [ ] Modal displays exact token counts (e.g., 1,847 not 2,000)
- [ ] Modal displays precise costs (e.g., $0.005541 not $0.01)
- [ ] Reasoning traces show actual Claude thinking (messy, exploratory text)
- [ ] Existing session/results/rating flow still works
- [ ] TypeScript compiles without errors
- [ ] ALL PHASES COMPLETE

---

## Summary

**Total Tasks:** 12
- Pre-flight: 2 tasks
- Phase 1 (Board Visibility): 4 tasks
- Phase 2 (Engine Integration): 4 tasks
- Phase 3 (Audit Trail): 6 tasks

**Critical Path:**
0.1 → 1.1 → 1.2 → 1.3 → 1.4 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 3.3/3.4 → 3.5 → 3.6

**Parallel Opportunities:**
- Task 0.1 and 0.2 can run in parallel
- Task 3.3 and 3.4 can run in parallel (but both need 3.1)

**Phase Gates:**
- After Task 1.4: Verify board visibility before Phase 2
- After Task 2.4: Verify engine integration before Phase 3
- After Task 3.6: All features complete and validated

**Risk Areas:**
- Task 0.1: May require fallback to Claude 4.5
- Task 0.2: May need alternative header passing method
- Task 3.2: Complex async promise extraction
