# Fix Self-Assessment: Board Visibility, Audit Trail & Engine Integration

**Status:** Draft
**Authors:** Claude Code
**Date:** 2025-11-17
**Related Issues:** docs/task-dossiers/self-assessment-fixes.md
**Reference Patterns:** drill-mode-extraction-package/BUGFIX_SYNTHESIS_BOARD_VISIBILITY_AND_AUDIT_TRAILS.md

---

## Overview

Fix three critical implementation issues in the guru self-assessment system that deviate from the proven Backgammon Guru reference implementation. This spec follows a phased approach with acceptance criteria gates between phases to ensure stability.

**Core Issues:**
1. Guru says it cannot see board position (context not injected into system prompt)
2. Audit trail fabricated as LLM text instead of extracted from API metadata
3. GNU Backgammon engine results not displaying (insufficient error handling/logging)

---

## Background/Problem Statement

The self-assessment feature was recently implemented but deviates from patterns established in the reference Backgammon Guru project. Users report:

1. **Board Visibility:** AI responds with "I cannot see the board position" because the board state is only rendered in the frontend ASCII display, never injected into the system prompt sent to Claude.

2. **Audit Trail:** AI fabricates context audit information as part of its response text (lines 36-40 in contextComposer.ts explicitly prompt this). The correct pattern extracts REAL metadata from Claude's API response promises (`result.reasoning`, `result.usage`).

3. **Engine Integration:** Ground truth section shows no data. Insufficient logging prevents diagnosis. No retry logic for Heroku dyno cold starts (30+ second wake-up).

**Root causes identified in ideation:** `docs/ideation/self-assessment-visibility-audit-engine-fixes.md`

---

## Goals

- Fix board visibility so AI can reference specific checker positions
- Implement correct audit trail pattern using API metadata extraction
- Ensure GNU Backgammon engine reliably returns ground truth data
- Follow exact patterns from reference implementation (copy-paste where possible)
- Maintain non-regression on existing functionality (sessions, results, ratings, history)

---

## Non-Goals

- Dynamic board position editor (only support passing positions, not editing)
- Persistent audit trail storage in database (in-memory MVP for testing)
- Token cost optimization beyond basic calculations
- User-configurable thinking budget
- Hint system from reference implementation
- Production-ready distributed caching (Redis, etc.)

---

## Technical Dependencies

**Existing Dependencies:**
- `@ai-sdk/anthropic`: ^2.0.42 (already installed)
- `ai`: Vercel AI SDK v5
- `zod`: Request validation
- Prisma ORM for database

**Required for Phase 3:**
- Extended thinking support in Anthropic provider (built-in)
- `crypto.randomUUID()` for message ID generation (Node.js built-in)

**Reference Documentation:**
- Vercel AI SDK: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
- Extended thinking: Provider options with `thinking.type` and `budgetTokens`
- Stream result properties: `result.reasoning` and `result.usage` promises

---

## User Experience

### Current Flow (Broken)
1. User enters dice roll "3-1", clicks "Set Problem"
2. ASCII board renders in UI (frontend only)
3. User clicks "Ask Guru" → AI says "I cannot see the board"
4. User clicks "Check Answer" → Empty or error displayed
5. AI response includes fabricated "Context Audit Details" section

### Fixed Flow (After Implementation)
1. User enters dice roll "3-1", clicks "Set Problem"
2. ASCII board renders in UI
3. User clicks "Ask Guru" → AI analyzes position: "Looking at the opening position with Black to play 3-1, I recommend 8/5, 6/5 to make the 5-point..."
4. "View Audit Trail" button appears on AI response
5. User clicks "Check Answer" → Best moves display with equity values
6. User clicks "View Audit Trail" → Modal shows REAL token usage, costs, reasoning traces

---

## Implementation Phases

### Phase 1: Board Visibility Fix (CRITICAL)

**Goal:** AI can see and reference the board position in its response.

**Root Cause:** `lib/assessment/contextComposer.ts` lines 32-33 only output generic text `"Black to play: 3-1"`. Board state data never injected.

**Changes Required:**

1. **Add BoardPosition type** (`lib/assessment/types.ts`):
```typescript
export interface BoardPosition {
  board: BackgammonBoard
  player: 'x' | 'o'
  dice: [number, number]
  positionName: string // e.g., "Standard Opening Position"
}
```

2. **Create composeBoardStatePrompt()** (`lib/assessment/contextComposer.ts`):

Copy pattern from BUGFIX_SYNTHESIS lines 86-121:
```typescript
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

3. **Update composeAssessmentContext()** to inject board state:

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
    throw new Error('No active context layers found.')
  }

  let systemPrompt = `# BACKGAMMON GURU KNOWLEDGE BASE\n\n`

  layers.forEach((layer) => {
    systemPrompt += `## ${layer.title}\n\n${layer.content}\n\n---\n\n`
  })

  // CRITICAL FIX: Inject actual board state
  const dice = diceRoll.split('-').map(Number) as [number, number]
  systemPrompt += '\n\n' + composeBoardStatePrompt(dice)

  return {
    systemPrompt,
    layerCount: layers.length,
  }
}
```

**Acceptance Criteria (Gate to Phase 2):**
- [ ] AI response includes references to specific checker positions (e.g., "checkers on the 8-point")
- [ ] AI recommends moves with standard notation (e.g., "8/5, 6/5")
- [ ] No "I cannot see the board" statements
- [ ] Server console shows system prompt contains JSON board data + ASCII representation
- [ ] TypeScript compiles without errors

**Verification Test:**
```bash
# Manual test:
1. Set dice "3-1", click "Set Problem"
2. Click "Ask Guru"
3. AI response should mention specific positions like "8-point", "6-point", "13-point"
4. Server logs should show system prompt with ### Board State section
```

---

### Phase 2: GNU Engine Integration Fix (HIGH)

**Goal:** Reliably fetch and display ground truth from GNU Backgammon engine.

**Issue:** No detailed logging, no retry logic for Heroku dyno sleeping.

**Changes Required:**

1. **Add comprehensive logging and retry** (`lib/assessment/backgammonEngine.ts`):

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

2. **Update ground-truth route** (`app/api/projects/[id]/assessment/ground-truth/route.ts`):

```typescript
// Use retry-enabled function
const bestMoves = await getBackgammonGroundTruthWithRetry(dice, config.engineUrl)

// Better error response
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

**Acceptance Criteria (Gate to Phase 3):**
- [ ] Server logs show `[GNUBG]` request/response details
- [ ] Retry logic activates on failure (visible in logs)
- [ ] Best moves display with equity values in UI
- [ ] Timeout after 30 seconds with clear error message
- [ ] 3 retry attempts before final failure
- [ ] TypeScript compiles without errors

**Verification Test:**
```bash
# Manual test:
1. Set dice "3-1", click "Set Problem"
2. Click "Check Answer"
3. Best moves should display (e.g., "1. 8/5, 6/5  +0.1234")
4. Server logs should show full request/response
5. If engine sleeping, logs show retry attempts
```

---

### Phase 3: Audit Trail Implementation (MEDIUM)

**Goal:** Extract real audit data from Claude API metadata, not fabricated LLM text.

**Root Cause:** Lines 36-40 in contextComposer.ts prompt AI to generate audit info. Wrong pattern.

**Changes Required:**

1. **Remove audit instructions from contextComposer.ts:**

Delete these lines (currently 36-40):
```typescript
// DELETE THESE LINES
systemPrompt += `IMPORTANT: At the end of your response, include a "Context Audit Details" section...`
```

2. **Create in-memory audit store** (`lib/assessment/auditStore.ts`):

Copy pattern from BUGFIX_SYNTHESIS lines 335-403:
```typescript
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

3. **Update chat route** (`app/api/projects/[id]/assessment/chat/route.ts`):

Copy pattern from BUGFIX_SYNTHESIS lines 164-199, 273-298:
```typescript
import { randomUUID } from 'crypto'
import { storeAuditTrail, createPlaceholderAuditTrail } from '@/lib/assessment/auditStore'

// Inside POST handler:
const messageId = randomUUID()

const contextResult = await composeAssessmentContext(projectId, diceRoll)

// Create placeholder immediately
createPlaceholderAuditTrail({
  messageId,
  model: 'claude-3-7-sonnet-20250219',
  contextLayers: contextResult.layerCount,
  systemPromptTokens: Math.ceil(contextResult.systemPrompt.length / 4),
})

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

// Extract REAL audit data asynchronously
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

4. **Create audit retrieval endpoint** (`app/api/projects/[id]/assessment/audit/[messageId]/route.ts`):

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

5. **Update AssessmentClient.tsx to capture message ID:**

```typescript
const [messageAuditIds, setMessageAuditIds] = useState<Record<string, string>>({})
const [showAuditModal, setShowAuditModal] = useState(false)
const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
const pendingMessageIdRef = useRef<string | null>(null)

// Update transport to capture headers
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

// Add button in message render:
{messageAuditIds[msg.id] && (
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
```

6. **Create ContextAuditModal component** (`components/assessment/ContextAuditModal.tsx`):

Copy pattern from BUGFIX_SYNTHESIS lines 332-382:
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

**Acceptance Criteria (Final):**
- [ ] AI response contains ONLY move recommendation (no audit text section)
- [ ] "View Audit Trail" button appears after each assistant message
- [ ] Modal displays exact token counts (not round estimates like 1000, 500)
- [ ] Reasoning traces show actual Claude thinking (messy, exploratory text)
- [ ] Cost calculated from real usage (precise decimal values)
- [ ] Server logs show `[Audit] Captured for message: {uuid}`
- [ ] TypeScript compiles without errors
- [ ] Existing session/results/rating flow still works

**Verification Test:**
```bash
# Manual test:
1. Set dice "3-1", click "Set Problem"
2. Click "Ask Guru"
3. Response should NOT include "Context Audit Details" section
4. "View Audit Trail" button should appear
5. Click button → Modal shows:
   - Exact token counts (e.g., 1,847 not 2,000)
   - Precise cost (e.g., $0.005541 not $0.01)
   - Reasoning traces (if enabled) showing Claude's actual thinking
```

---

## Testing Strategy

### Unit Tests

**Phase 1:**
```typescript
describe('composeBoardStatePrompt', () => {
  it('includes JSON board structure', () => {
    const result = composeBoardStatePrompt([3, 1])
    expect(result).toContain('"black":')
    expect(result).toContain('"dice_roll": [3, 1]')
  })

  it('includes ASCII board', () => {
    const result = composeBoardStatePrompt([3, 1])
    expect(result).toContain('13  14  15  16  17  18') // Point numbers
  })

  it('supports custom positions', () => {
    const customBoard = { o: { '1': 2 }, x: { '24': 2 } }
    const result = composeBoardStatePrompt([6, 6], customBoard, 'Custom Position')
    expect(result).toContain('Custom Position')
  })
})
```

**Phase 2:**
```typescript
describe('getBackgammonGroundTruthWithRetry', () => {
  it('retries on failure', async () => {
    // Mock fetch to fail twice, then succeed
    const result = await getBackgammonGroundTruthWithRetry([3, 1])
    expect(result.length).toBeGreaterThan(0)
    // Check logs for retry attempts
  })

  it('times out after 30 seconds', async () => {
    // Mock slow response
    await expect(getBackgammonGroundTruth([3, 1])).rejects.toThrow('timed out')
  })
})
```

**Phase 3:**
```typescript
describe('auditStore', () => {
  it('stores and retrieves audit trails', () => {
    const data = { messageId: 'test-123', /* ... */ }
    storeAuditTrail(data)
    const retrieved = getAuditTrail('test-123')
    expect(retrieved).toEqual(data)
  })

  it('cleans up old entries', () => {
    // Create old entry
    cleanupOldAuditTrails(0) // Immediate cleanup
    expect(getAuditTrail('old-id')).toBeUndefined()
  })
})
```

### Integration Tests

```typescript
describe('Assessment Chat API', () => {
  it('returns x-message-id header', async () => {
    const response = await POST(request)
    expect(response.headers.get('x-message-id')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('injects board state into system prompt', async () => {
    // Verify contextComposer output contains board data
  })
})
```

### E2E Tests

```typescript
test('complete assessment flow with audit trail', async ({ page }) => {
  await page.goto('/projects/test-project/assessment')
  await page.fill('input[placeholder*="3-1"]', '3-1')
  await page.click('text=Set Problem')

  // Phase 1: Board visibility
  await page.click('text=Ask Guru')
  await expect(page.locator('.bg-gray-100')).toContainText(/\d+\s*\/\s*\d+/) // Move notation

  // Phase 2: Engine integration
  await page.click('text=Check Answer')
  await expect(page.locator('text=Best Moves')).toBeVisible()

  // Phase 3: Audit trail
  await page.click('text=View Audit Trail')
  await expect(page.locator('text=Token Usage')).toBeVisible()
  await expect(page.locator('text=Input:')).toContainText(/\d{3,}/) // Real numbers
})
```

---

## Performance Considerations

**Phase 1:**
- Additional ~350 tokens for board state in system prompt
- Negligible cost increase (~$0.001/request)
- No latency impact

**Phase 2:**
- Retry logic can add up to 30+ seconds on cold start
- Exponential backoff: 1s, 2s, 4s delays
- Total max wait: ~37 seconds (worst case)

**Phase 3:**
- Extended thinking adds 2-5 seconds latency
- 5000 token budget = up to $0.075 additional cost per request
- In-memory store has no persistence overhead
- Cleanup function should run periodically (every hour)

**Mitigation:**
- Show loading indicators during retries
- Display retry count in UI ("Attempt 2/3...")
- Consider disabling extended thinking for production cost savings
- Implement audit cleanup on server startup

---

## Security Considerations

1. **In-Memory Store:** Data lost on server restart (acceptable for MVP)
2. **No Authentication:** Audit endpoint accessible without auth (add if needed for production)
3. **Message ID Exposure:** UUIDs are unpredictable, low risk
4. **Cost Tracking:** Shows actual usage to users (transparency, not security issue)
5. **CORS:** Engine calls are server-side only, no browser CORS issues

---

## Documentation

**To Update:**
- `docs/ideation/self-assessment-visibility-audit-engine-fixes.md` - Mark as implemented
- `developer-guides/` - Add section on audit trail pattern
- `CLAUDE.md` - Document extended thinking configuration
- README - Update assessment feature description

---

## Open Questions

1. **Extended Thinking Model Compatibility:** Does Claude 3.7 Sonnet support thinking with current @ai-sdk/anthropic@2.0.42?
   - If not, may need to update package version
   - Or use Claude 4.5 with different config

2. **TextStreamChatTransport Headers:** Does AI SDK v5's TextStreamChatTransport support custom response headers?
   - May need to use different transport or response method
   - Alternative: `result.toUIMessageStreamResponse()` instead

3. **Cost Accuracy:** Claude 3.7 Sonnet pricing may have changed
   - $3/1M input, $15/1M output needs verification
   - Update calculateCosts() accordingly

---

## References

- **Ideation Document:** `docs/ideation/self-assessment-visibility-audit-engine-fixes.md`
- **Reference Patterns:** `drill-mode-extraction-package/BUGFIX_SYNTHESIS_BOARD_VISIBILITY_AND_AUDIT_TRAILS.md`
- **Task Dossier:** `docs/task-dossiers/self-assessment-fixes.md`
- **Vercel AI SDK Anthropic Provider:** https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
- **Extended Thinking Docs:** https://ai-sdk.dev/cookbook/guides/claude-4
- **GNU Backgammon Engine:** https://gnubg-mcp-d1c3c7a814e8.herokuapp.com

---

## Summary

This phased specification fixes three critical self-assessment issues by copying proven patterns from the reference Backgammon Guru implementation. Each phase has clear acceptance criteria that must pass before proceeding, ensuring stability and measurable progress.

**Phase 1 (45 min):** Board visibility - inject structured data into system prompt
**Phase 2 (2 hours):** Engine integration - add logging, retry, timeout handling
**Phase 3 (3-4 hours):** Audit trail - extract real API metadata, not fabricated text

Total implementation: ~6-7 hours with testing and validation between phases.
