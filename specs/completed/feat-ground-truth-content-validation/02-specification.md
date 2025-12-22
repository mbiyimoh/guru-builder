# Ground Truth Content Validation for Teaching Artifacts

**Status:** Draft
**Authors:** Claude Code
**Date:** 2025-12-10
**Related:** `specs/feat-ground-truth-content-validation/01-ideation.md`, `specs/feat-self-assessment-system.md`

---

## Overview

Integrate mathematical ground truth sources (like the GNU Backgammon engine) into curriculum and drill generation workflows. The LLM actively queries the ground truth engine via OpenAI function calling during content creation, with post-generation verification as a safety net. This ensures AI-generated educational content is 100% mathematically accurate before being finalized.

---

## Background/Problem Statement

The Guru Builder system currently generates teaching artifacts (Mental Models, Curriculum, Drill Series) using GPT-4o. For domains with objective mathematical truth (backgammon, chess, poker), the AI may generate incorrect answers:

- **Example:** A drill asks "What's the best move for 3-1 in the opening?" The AI might state "8/5, 6/5" but this may not be mathematically optimal according to GNU Backgammon's equity analysis.

- **Risk:** Users learning from these drills could internalize incorrect strategies, undermining the entire purpose of the guru.

The existing self-assessment system already connects to domain-specific engines (GNU Backgammon MCP server) for real-time answer checking. This feature extends that capability to the content creation pipeline itself.

---

## Goals

- Ensure 100% mathematical accuracy in generated drill answers and curriculum examples
- Integrate ground truth verification into the generation pipeline (not just post-hoc)
- Provide clear visibility into verification status for users
- Block incorrect content from being finalized
- Offer regeneration options when verification fails
- Cache engine responses to minimize API calls

---

## Non-Goals

- Generic interface for non-backgammon engines (backgammon-first, generalize later)
- Pre-computing entire canonical corpus upfront
- Real-time verification during user-facing drill sessions
- Multi-engine validation (one engine per project)
- Verifying conceptual/strategic claims (only verifiable mathematical claims)

---

## Technical Dependencies

### External Services
- **GNU Backgammon MCP Server** - Existing Heroku deployment at `https://gnubg-mcp-d1c3c7a814e8.herokuapp.com`
- **OpenAI API** - GPT-4o with function calling support

### Internal Dependencies
- `lib/assessment/backgammonEngine.ts` - Existing engine connector with retry logic
- `lib/inngest-functions.ts` - Background job orchestration
- `lib/guruFunctions/generators/drillDesigner.ts` - Current drill generation
- `prisma/schema.prisma` - Data models

### Version Requirements
- OpenAI API: Function calling support (available in GPT-4o)
- Next.js 15+, React 19+
- Prisma 5+

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DRILL GENERATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Check Config │───▶│ Engine Check │───▶│ Function-Calling │  │
│  │ (GT enabled?)│    │ (Available?) │    │   Generation     │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                   │                     │             │
│         │ No                │ No                  │             │
│         ▼                   ▼                     ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Standard   │    │    BLOCK     │    │  Post-Verify     │  │
│  │  Generation  │    │  Generation  │    │  All Claims      │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                   │             │
│                                          ┌───────┴───────┐     │
│                                          │               │     │
│                                          ▼               ▼     │
│                                   ┌──────────┐   ┌───────────┐ │
│                                   │ VERIFIED │   │  BLOCKED  │ │
│                                   │COMPLETED │   │NEEDS_REVIEW│ │
│                                   └──────────┘   └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model Changes

#### New Enum: VerificationStatus

```prisma
enum VerificationStatus {
  VERIFIED      // All mathematical claims verified against ground truth
  NEEDS_REVIEW  // Some claims failed verification, blocked for human review
  UNVERIFIED    // Generated without ground truth validation (legacy/disabled)
  FAILED        // Verification process itself encountered an error
}
```

#### Extend AssessmentDefinition

```prisma
model AssessmentDefinition {
  // ... existing fields ...

  // NEW: Can this engine be used for content validation?
  canValidateContent    Boolean   @default(false)
}
```

#### Extend ProjectAssessment

```prisma
model ProjectAssessment {
  // ... existing fields ...

  // NEW: Use this assessment's engine for content validation during generation?
  useForContentValidation Boolean @default(false)
}
```

#### Extend GuruArtifact

```prisma
model GuruArtifact {
  // ... existing fields ...

  // NEW: Verification tracking
  verificationStatus    VerificationStatus?
  verificationDetails   Json?       // { toolCalls: [], claims: [], failures: [], cachedResponses: [] }
  verificationAttempts  Int         @default(0)
  lastVerifiedAt        DateTime?
}
```

### New File Structure

```
lib/groundTruth/
├── types.ts              # Type definitions
├── tools.ts              # OpenAI function/tool definitions
├── executor.ts           # Tool execution with engine calls
├── postVerification.ts   # Claim extraction and batch verification
├── cache.ts              # Response caching with position+dice keys
└── config.ts             # Ground truth config resolution

components/artifacts/
├── VerificationBadge.tsx         # Status badge component
└── VerificationDetailsModal.tsx  # Failure review modal
```

### Function Calling Tool Definition

```typescript
// lib/groundTruth/tools.ts

import { z } from 'zod'

export const verifyBackgammonMoveToolSchema = z.object({
  position_type: z.enum(['opening', 'custom']).describe('Board position type'),
  position_hash: z.string().optional().describe('Hash of board state for custom positions'),
  dice_roll: z.string().regex(/^[1-6]-[1-6]$/).describe('Dice roll in format "X-Y"'),
  context: z.string().describe('Why this verification is needed (for audit trail)')
})

export const verifyBackgammonMoveTool = {
  type: 'function' as const,
  function: {
    name: 'verify_backgammon_move',
    description: `Query the GNU Backgammon engine for mathematically correct best moves.

CRITICAL: You MUST call this function BEFORE stating that any specific move is:
- "best", "correct", "optimal", or "recommended"
- The right answer in a drill question
- Better or worse than another move (equity comparison)

The engine returns equity-scored moves ranked from best to worst. Use the #1 ranked move as the correct answer.

DO NOT guess or rely on your training data for backgammon move analysis - always verify with this tool.`,

    parameters: {
      type: 'object',
      properties: {
        position_type: {
          type: 'string',
          enum: ['opening', 'custom'],
          description: 'Board position type. Use "opening" for standard opening position.'
        },
        position_hash: {
          type: 'string',
          description: 'Hash of board state for custom positions. Required if position_type is "custom".'
        },
        dice_roll: {
          type: 'string',
          pattern: '^[1-6]-[1-6]$',
          description: 'The dice roll in format "X-Y" (e.g., "3-1", "6-4")'
        },
        context: {
          type: 'string',
          description: 'Brief description of why you need this verification (for audit trail)'
        }
      },
      required: ['position_type', 'dice_roll', 'context']
    }
  }
}
```

### Tool Executor

```typescript
// lib/groundTruth/executor.ts

import { getBackgammonGroundTruthWithRetry } from '@/lib/assessment/backgammonEngine'
import { getFromCache, setInCache } from './cache'
import type { ToolCallResult, VerifyMoveArgs } from './types'

export async function executeVerifyBackgammonMove(
  args: VerifyMoveArgs,
  engineUrl: string
): Promise<ToolCallResult> {
  const cacheKey = buildCacheKey(args.position_type, args.position_hash, args.dice_roll)

  // Check cache first
  const cached = await getFromCache(cacheKey)
  if (cached) {
    return {
      success: true,
      fromCache: true,
      data: cached
    }
  }

  // Parse dice roll
  const [d1, d2] = args.dice_roll.split('-').map(Number) as [number, number]

  try {
    const moves = await getBackgammonGroundTruthWithRetry([d1, d2], engineUrl)

    const result = {
      dice_roll: args.dice_roll,
      position_type: args.position_type,
      best_moves: moves.slice(0, 5).map((m, i) => ({
        rank: i + 1,
        move: m.move,
        equity: m.equity,
        is_best: i === 0
      })),
      verified_at: new Date().toISOString(),
      note: 'Use the #1 ranked move as the correct answer. Equity difference shows how much worse other moves are.'
    }

    // Cache the result
    await setInCache(cacheKey, result)

    return {
      success: true,
      fromCache: false,
      data: result
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Engine query failed'
    }
  }
}

function buildCacheKey(positionType: string, positionHash: string | undefined, diceRoll: string): string {
  // For opening position, hash is always the same
  if (positionType === 'opening') {
    return `gt:opening:${diceRoll}`
  }
  // For custom positions, include the position hash
  return `gt:custom:${positionHash}:${diceRoll}`
}
```

### Response Cache

```typescript
// lib/groundTruth/cache.ts

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// In-memory cache for current session (fast path)
const memoryCache = new Map<string, { data: unknown; expires: number }>()
const MEMORY_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Database cache for persistence across sessions
const DB_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function getFromCache(key: string): Promise<unknown | null> {
  // Check memory cache first
  const memoryCached = memoryCache.get(key)
  if (memoryCached && memoryCached.expires > Date.now()) {
    return memoryCached.data
  }

  // Check database cache
  const dbCached = await prisma.groundTruthCache.findUnique({
    where: { cacheKey: key }
  })

  if (dbCached && dbCached.expiresAt > new Date()) {
    // Populate memory cache
    memoryCache.set(key, {
      data: dbCached.response,
      expires: Date.now() + MEMORY_TTL_MS
    })
    return dbCached.response
  }

  return null
}

export async function setInCache(key: string, data: unknown): Promise<void> {
  // Set in memory cache
  memoryCache.set(key, {
    data,
    expires: Date.now() + MEMORY_TTL_MS
  })

  // Persist to database
  await prisma.groundTruthCache.upsert({
    where: { cacheKey: key },
    create: {
      cacheKey: key,
      response: data as Prisma.JsonValue,
      expiresAt: new Date(Date.now() + DB_TTL_MS)
    },
    update: {
      response: data as Prisma.JsonValue,
      expiresAt: new Date(Date.now() + DB_TTL_MS)
    }
  })
}
```

### New Prisma Model for Cache

```prisma
model GroundTruthCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique  // e.g., "gt:opening:3-1"
  response  Json                // Engine response data
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([expiresAt])
}
```

### Function Calling Response Strategy

**CRITICAL:** When using OpenAI function calling with `tool_choice: 'auto'`, the LLM alternates between tool calls and generating content. The final structured output requires a two-phase approach:

#### Phase 1: Verification-Enabled Generation (with tools)

```typescript
// During this phase, the LLM can call tools to verify moves
// The response ends when finish_reason === 'stop' (no more tool calls)
// The content is MARKDOWN with embedded JSON, not pure JSON

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
  tools: [verifyBackgammonMoveTool],
  tool_choice: 'auto',
  temperature: 0.7,
  // NO response_format here - we need the LLM to call tools first
})
```

#### Phase 2: Final JSON Extraction

When the LLM finishes (no more tool calls), the `message.content` contains the drill series wrapped in a markdown code block. We parse it with:

```typescript
// lib/groundTruth/responseParser.ts

/**
 * Extract JSON from LLM response that may contain markdown formatting.
 * The LLM typically returns content like:
 *
 * ```json
 * { "series": [...] }
 * ```
 *
 * Or plain JSON directly.
 */
export function parseStructuredDrillOutput(content: string): DrillSeriesOutput {
  // Try parsing as plain JSON first
  try {
    return drillSeriesOutputSchema.parse(JSON.parse(content))
  } catch {
    // Content might be wrapped in markdown code blocks
  }

  // Extract JSON from markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      return drillSeriesOutputSchema.parse(JSON.parse(jsonMatch[1].trim()))
    } catch (e) {
      throw new Error(`Failed to parse extracted JSON: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  // Try to find JSON object boundaries
  const jsonStart = content.indexOf('{')
  const jsonEnd = content.lastIndexOf('}')
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const extracted = content.substring(jsonStart, jsonEnd + 1)
    try {
      return drillSeriesOutputSchema.parse(JSON.parse(extracted))
    } catch (e) {
      throw new Error(`Failed to parse bounded JSON: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  throw new Error('No valid JSON found in LLM response. Content preview: ' + content.substring(0, 200))
}
```

#### Alternative: Hybrid Two-Call Approach

If JSON extraction proves unreliable, use a hybrid approach:

```typescript
async function generateWithFunctionCallingHybrid(
  params: DrillGeneratorParams,
  config: GroundTruthConfig
): Promise<DrillGenerationResult> {
  // PHASE 1: Generate with verification (collect verified moves)
  const { verifiedMoves, toolCalls, iterations } = await runVerificationPhase(params, config)

  // PHASE 2: Final structured generation (no tools, with JSON mode)
  const finalResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildFinalGenerationSystemPrompt(params) },
      {
        role: 'user',
        content: `Generate the drill series using ONLY these verified moves:\n\n${
          JSON.stringify(verifiedMoves, null, 2)
        }\n\nEach drill answer MUST use exactly the moves provided above.`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3, // Lower temperature for structured output
  })

  const content = drillSeriesOutputSchema.parse(
    JSON.parse(finalResponse.choices[0].message.content!)
  )

  return { content, toolCalls, verificationDuringGeneration: true, iterations }
}
```

**Recommendation:** Start with the single-call approach (`parseStructuredDrillOutput`). If >10% of generations fail to parse, switch to the hybrid approach.

### Tool Call Limits and Safety

```typescript
// lib/groundTruth/constants.ts

export const GROUND_TRUTH_LIMITS = {
  /** Maximum tool calls per generation to prevent infinite loops */
  MAX_TOOL_CALLS: 100,

  /** Maximum iterations of the agentic loop */
  MAX_ITERATIONS: 50,

  /** Maximum regeneration attempts for a single artifact */
  MAX_REGENERATION_ATTEMPTS: 5,

  /** Timeout for individual engine queries (ms) */
  ENGINE_QUERY_TIMEOUT: 10000,

  /** Timeout for entire generation with verification (ms) */
  GENERATION_TIMEOUT: 300000, // 5 minutes
}
```

**Enforcement in agentic loop:**

```typescript
async function generateWithFunctionCalling(
  params: DrillGeneratorParams,
  config: GroundTruthConfig
): Promise<DrillGenerationResult> {
  const toolCalls: ToolCallLog[] = []
  let totalToolCalls = 0
  let iterations = 0

  while (iterations < GROUND_TRUTH_LIMITS.MAX_ITERATIONS) {
    iterations++

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: [verifyBackgammonMoveTool],
      tool_choice: 'auto',
      temperature: 0.7
    })

    const choice = response.choices[0]

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      // ENFORCE TOOL CALL LIMIT
      totalToolCalls += choice.message.tool_calls.length
      if (totalToolCalls > GROUND_TRUTH_LIMITS.MAX_TOOL_CALLS) {
        throw new Error(
          `Generation exceeded maximum tool calls (${GROUND_TRUTH_LIMITS.MAX_TOOL_CALLS}). ` +
          `This may indicate an issue with the prompt or engine responses.`
        )
      }

      const toolResults = await executeToolCalls(choice.message.tool_calls, config.engineUrl)
      toolCalls.push(...toolResults.logs)
      // ... rest of loop
    }
    // ... rest of function
  }
}
```

### Modified Drill Generator

```typescript
// lib/guruFunctions/generators/drillDesigner.ts (modified)

import { verifyBackgammonMoveTool, executeVerifyBackgammonMove } from '@/lib/groundTruth'
import type { GroundTruthConfig } from '@/lib/groundTruth/types'

export async function generateDrillSeries(
  params: DrillGeneratorParams,
  groundTruthConfig?: GroundTruthConfig
): Promise<DrillGenerationResult> {
  // If ground truth validation is enabled, use function calling
  if (groundTruthConfig?.enabled) {
    // First, verify engine is available
    const engineAvailable = await checkEngineAvailability(groundTruthConfig.engineUrl)
    if (!engineAvailable) {
      throw new GroundTruthUnavailableError(
        'Ground truth engine is unavailable. Content generation blocked to prevent incorrect content.'
      )
    }

    return generateWithFunctionCalling(params, groundTruthConfig)
  }

  // Otherwise, use existing structured output approach
  return generateWithStructuredOutput(params)
}

async function generateWithFunctionCalling(
  params: DrillGeneratorParams,
  config: GroundTruthConfig
): Promise<DrillGenerationResult> {
  const { systemPrompt, userPrompt } = buildPromptsWithVerificationInstructions(params)

  const toolCalls: ToolCallLog[] = []
  let messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  // Agentic loop - keep going until LLM returns final content
  let iterations = 0
  const MAX_ITERATIONS = 50 // Safety limit

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: [verifyBackgammonMoveTool],
      tool_choice: 'auto',
      temperature: 0.7
    })

    const choice = response.choices[0]

    // If LLM wants to call tools, execute them
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolResults = await executeToolCalls(
        choice.message.tool_calls,
        config.engineUrl
      )

      toolCalls.push(...toolResults.logs)

      // Add assistant message with tool calls
      messages.push(choice.message)

      // Add tool results
      for (const result of toolResults.messages) {
        messages.push(result)
      }

      continue
    }

    // If LLM is done (no tool calls), parse the final response
    if (choice.finish_reason === 'stop' && choice.message.content) {
      const content = parseStructuredDrillOutput(choice.message.content)

      return {
        content,
        toolCalls,
        verificationDuringGeneration: true,
        iterations
      }
    }
  }

  throw new Error(`Generation exceeded ${MAX_ITERATIONS} iterations`)
}

async function executeToolCalls(
  toolCalls: ChatCompletionMessageToolCall[],
  engineUrl: string
): Promise<{ logs: ToolCallLog[]; messages: ChatCompletionToolMessageParam[] }> {
  const logs: ToolCallLog[] = []
  const messages: ChatCompletionToolMessageParam[] = []

  for (const toolCall of toolCalls) {
    if (toolCall.function.name === 'verify_backgammon_move') {
      const args = JSON.parse(toolCall.function.arguments)
      const startTime = Date.now()

      const result = await executeVerifyBackgammonMove(args, engineUrl)

      logs.push({
        id: toolCall.id,
        function: toolCall.function.name,
        args,
        result,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.data || { error: result.error })
      })
    }
  }

  return { logs, messages }
}
```

### Post-Verification Pipeline

```typescript
// lib/groundTruth/postVerification.ts

import type { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema'

interface VerifiableClaim {
  drillId: string
  claimType: 'best_move' | 'correct_answer' | 'move_comparison'
  positionType: 'opening' | 'custom'
  positionHash?: string
  diceRoll: string
  claimedMove: string
  location: string  // e.g., "series[0].drills[2].options[0]"
}

interface VerificationResult {
  totalClaims: number
  verified: number
  failed: number
  failures: ClaimFailure[]
  allPassed: boolean
  details: ClaimResult[]
}

interface ClaimFailure {
  claim: VerifiableClaim
  engineBestMove: string
  engineEquity: number
  claimedMoveEquity?: number
  equityLoss?: number
}

// ============================================================================
// Move Extraction and Position Identification
// ============================================================================

/**
 * Backgammon move notation patterns.
 *
 * Standard notation: "8/5 6/5" or "24/21 13/11"
 * Variations:
 * - Slash separator: "8/5"
 * - Dash separator: "8-5"
 * - Comma between moves: "8/5, 6/5"
 * - Space between moves: "8/5 6/5"
 * - Combined with hits: "8/5* 6/5"
 * - Bar entries: "bar/24 bar/23"
 * - Bear offs: "6/off 5/off" or "6/0 5/0"
 *
 * This regex captures the full move sequence (may be 1-4 checker movements).
 */
const BACKGAMMON_MOVE_PATTERNS = {
  /** Matches a single point-to-point move like "8/5" or "24-21" */
  SINGLE_MOVE: /\b(bar|\d{1,2})[\/-](\d{1,2}|off)\*?\b/i,

  /** Matches a full move (potentially compound like "8/5 6/5" or "6/3(2)") */
  FULL_MOVE: /\b(?:bar|\d{1,2})[\/-](?:\d{1,2}|off)\*?(?:\s*,?\s*(?:bar|\d{1,2})[\/-](?:\d{1,2}|off)\*?){0,3}\b/gi,

  /** Matches dice roll notation like "3-1" or "6-6" */
  DICE_ROLL: /\b([1-6])-([1-6])\b/,
}

/**
 * Extract backgammon move notation from drill option text.
 *
 * @example
 * extractBackgammonMove("Play 8/5, 6/5 to secure the 5-point")
 * // Returns: "8/5, 6/5"
 *
 * extractBackgammonMove("13/11, 6/5 - building your board")
 * // Returns: "13/11, 6/5"
 *
 * extractBackgammonMove("The correct answer is 24/21 13/11")
 * // Returns: "24/21 13/11"
 */
export function extractBackgammonMove(text: string): string | null {
  const match = text.match(BACKGAMMON_MOVE_PATTERNS.FULL_MOVE)
  if (!match || match.length === 0) return null

  // Return the first full move match (drills typically have one move per option)
  return match[0]
}

/**
 * Normalize move notation to a consistent format.
 * Handles variations in separators, spacing, and hit markers.
 *
 * @example
 * normalizeMove("8-5, 6-5")   // "8/5 6/5"
 * normalizeMove("8/5  6/5")  // "8/5 6/5"
 * normalizeMove("8/5* 6/5")  // "8/5 6/5" (hit marker removed for comparison)
 */
export function normalizeMove(move: string): string {
  return move
    .replace(/-/g, '/')           // Standardize to slash separator
    .replace(/\*/g, '')           // Remove hit markers for comparison
    .replace(/,/g, ' ')           // Replace commas with spaces
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .trim()
    .toLowerCase()
}

// ============================================================================
// Position Hash Generation (for custom positions)
// ============================================================================

/**
 * Position hash format for GNU Backgammon.
 *
 * For MVP, we only support opening positions (no custom positions).
 * When custom position support is added, use GNU BG's position ID format.
 *
 * GNU Backgammon position ID is a Base64-encoded 10-byte string that
 * encodes the complete board state including:
 * - Checker positions for both players
 * - Bar and borne-off counts
 *
 * Format: "4HPwATDgc/ABMA" (14 characters)
 *
 * @see https://www.gnu.org/software/gnubg/manual/html_node/A-technical-description-of-the-Position-ID.html
 */
export interface PositionIdentifier {
  type: 'opening' | 'custom'
  hash?: string  // Only present for custom positions
}

/**
 * Detect position type from drill scenario text.
 *
 * Looks for cues that indicate the position is NOT an opening position:
 * - "midgame", "backgame", "prime", "race", "bearing off"
 * - Specific point counts that differ from opening
 * - References to previous moves
 */
export function detectPositionType(scenarioSetup: string): PositionIdentifier {
  const lowered = scenarioSetup.toLowerCase()

  // Keywords indicating non-opening positions
  const nonOpeningKeywords = [
    'midgame', 'mid-game', 'middle game',
    'backgame', 'back game',
    'priming', 'prime',
    'bearing off', 'bear off', 'bearoff',
    'race', 'racing',
    'after', 'following', 'previous move',
    'blitz', 'holding game',
  ]

  const isNonOpening = nonOpeningKeywords.some(kw => lowered.includes(kw))

  if (isNonOpening) {
    // For MVP: Log warning and treat as unverifiable
    console.warn(
      `Custom position detected in scenario but custom verification not yet supported: "${scenarioSetup.substring(0, 100)}..."`
    )
    return { type: 'custom', hash: undefined }
  }

  // Keywords strongly indicating opening position
  const openingKeywords = [
    'opening', 'first move', 'initial',
    'you roll', 'roll a', 'rolled a',  // Common opening phrasing
  ]

  const isOpening = openingKeywords.some(kw => lowered.includes(kw))

  // Default to opening if unclear (most drills for beginners/intermediates are opening-focused)
  return { type: isOpening ? 'opening' : 'opening' }  // Conservative default
}

/**
 * Generate GNU BG position ID from board state.
 *
 * NOTE: For MVP, this is a placeholder. Full implementation would require
 * parsing the scenario text to reconstruct board state, then encoding it.
 *
 * Future implementation reference:
 * @see https://github.com/gnubg/gnubg/blob/master/positionid.c
 */
export function generatePositionHash(_boardDescription: string): string | undefined {
  // MVP: Return undefined to indicate custom positions not yet supported
  // Full implementation would parse board description and encode as position ID
  console.warn('Custom position hash generation not yet implemented')
  return undefined
}

// ============================================================================
// Claim Extraction
// ============================================================================

/**
 * Extract all verifiable backgammon claims from drill series content
 */
export function extractVerifiableClaims(
  drillSeries: DrillSeriesOutput
): VerifiableClaim[] {
  const claims: VerifiableClaim[] = []

  for (const [seriesIdx, series] of drillSeries.series.entries()) {
    for (const [drillIdx, drill] of series.drills.entries()) {
      // Extract dice roll from scenario setup
      const diceMatch = drill.scenario.setup.match(/\b([1-6])-([1-6])\b/)
      if (!diceMatch) continue

      const diceRoll = `${diceMatch[1]}-${diceMatch[2]}`

      // Find the correct answer option
      const correctOption = drill.options.find(opt => opt.isCorrect)
      if (!correctOption) continue

      // Extract move notation from correct answer
      const moveMatch = extractBackgammonMove(correctOption.text)
      if (!moveMatch) continue

      // Detect position type from scenario description
      const positionInfo = detectPositionType(drill.scenario.setup)

      // Skip custom positions for MVP (can't verify without position hash)
      if (positionInfo.type === 'custom' && !positionInfo.hash) {
        console.log(`Skipping verification for custom position drill: ${drill.drillId}`)
        continue
      }

      claims.push({
        drillId: drill.drillId,
        claimType: 'correct_answer',
        positionType: positionInfo.type,
        positionHash: positionInfo.hash,
        diceRoll,
        claimedMove: normalizeMove(moveMatch),
        location: `series[${seriesIdx}].drills[${drillIdx}].options[${drill.options.indexOf(correctOption)}]`
      })
    }
  }

  return claims
}

/**
 * Verify all claims against the ground truth engine
 */
export async function verifyClaimsAgainstEngine(
  claims: VerifiableClaim[],
  engineUrl: string
): Promise<VerificationResult> {
  const results: ClaimResult[] = []

  // Group claims by cache key to minimize engine calls
  const claimsByKey = groupBy(claims, c =>
    `${c.positionType}:${c.positionHash || 'default'}:${c.diceRoll}`
  )

  for (const [key, groupedClaims] of Object.entries(claimsByKey)) {
    // Get engine response (may be cached)
    const [posType, posHash, diceRoll] = key.split(':')
    const engineResult = await executeVerifyBackgammonMove({
      position_type: posType as 'opening' | 'custom',
      position_hash: posHash !== 'default' ? posHash : undefined,
      dice_roll: diceRoll,
      context: 'Post-generation verification'
    }, engineUrl)

    if (!engineResult.success) {
      // Mark all claims in this group as failed to verify
      for (const claim of groupedClaims) {
        results.push({
          claim,
          isValid: false,
          error: engineResult.error
        })
      }
      continue
    }

    const bestMoves = engineResult.data.best_moves

    // Verify each claim against engine response
    for (const claim of groupedClaims) {
      const isValid = validateClaimAgainstMoves(claim.claimedMove, bestMoves)

      results.push({
        claim,
        isValid,
        engineBestMove: bestMoves[0]?.move,
        engineBestEquity: bestMoves[0]?.equity,
        claimedMoveRank: findMoveRank(claim.claimedMove, bestMoves)
      })
    }
  }

  const failures = results
    .filter(r => !r.isValid)
    .map(r => ({
      claim: r.claim,
      engineBestMove: r.engineBestMove!,
      engineEquity: r.engineBestEquity!,
      claimedMoveEquity: r.claimedMoveRank
        ? bestMoves[r.claimedMoveRank - 1]?.equity
        : undefined
    }))

  return {
    totalClaims: claims.length,
    verified: results.filter(r => r.isValid).length,
    failed: failures.length,
    failures,
    allPassed: failures.length === 0,
    details: results
  }
}

/**
 * Check if claimed move matches the best move (allowing for notation variations)
 */
function validateClaimAgainstMoves(
  claimedMove: string,
  engineMoves: Array<{ move: string; equity: number }>
): boolean {
  const normalizedClaim = normalizeMove(claimedMove)
  const normalizedBest = normalizeMove(engineMoves[0]?.move || '')

  return normalizedClaim === normalizedBest
}

function normalizeMove(move: string): string {
  // Normalize notation: "8/5 6/5" -> "8/5 6/5"
  // Handle variations: "8-5, 6-5" -> "8/5 6/5"
  return move
    .replace(/-/g, '/')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
```

### Inngest Job Modification

```typescript
// In lib/inngest-functions.ts - drill series generation

export const drillSeriesGeneration = inngest.createFunction(
  {
    id: 'drill-series-generation',
    concurrency: { limit: 3 }
  },
  { event: 'guru/generate-drill-series' },
  async ({ event, step }) => {
    const { projectId, artifactId, mentalModelArtifactId, curriculumArtifactId, userNotes } = event.data

    // Phase 1: LOADING_PREREQUISITES
    const prerequisites = await step.run('load-prerequisites', async () => {
      // ... existing prerequisite loading ...

      // NEW: Check for ground truth config
      const groundTruthConfig = await getGroundTruthConfig(projectId)

      return { ...existingData, groundTruthConfig }
    })

    // Phase 2-4: Existing phases...

    // Phase 5: GENERATING_CONTENT (modified)
    const generationResult = await step.run('generate-content', async () => {
      await updateProgress(artifactId, 'GENERATING_CONTENT')

      try {
        return await generateDrillSeries(
          {
            domain: project.name,
            corpusSummary,
            mentalModel,
            curriculum,
            userNotes
          },
          prerequisites.groundTruthConfig
        )
      } catch (error) {
        if (error instanceof GroundTruthUnavailableError) {
          // Block generation - engine unavailable
          await prisma.guruArtifact.update({
            where: { id: artifactId },
            data: {
              status: 'FAILED',
              verificationStatus: 'FAILED',
              errorMessage: error.message,
              progressStage: null
            }
          })
          throw error
        }
        throw error
      }
    })

    // Phase 6: VERIFYING_CONTENT (new - only if GT enabled)
    if (prerequisites.groundTruthConfig?.enabled) {
      const verificationResult = await step.run('verify-content', async () => {
        await updateProgress(artifactId, 'VERIFYING_CONTENT')

        const claims = extractVerifiableClaims(generationResult.content)
        return verifyClaimsAgainstEngine(
          claims,
          prerequisites.groundTruthConfig!.engineUrl
        )
      })

      // Handle verification failures
      if (!verificationResult.allPassed) {
        await step.run('block-artifact', async () => {
          await prisma.guruArtifact.update({
            where: { id: artifactId },
            data: {
              status: 'BLOCKED',
              verificationStatus: 'NEEDS_REVIEW',
              verificationDetails: {
                generationToolCalls: generationResult.toolCalls,
                postVerification: verificationResult,
                blockedAt: new Date().toISOString(),
                message: `Post-verification found ${verificationResult.failed} incorrect claim(s).`
              },
              verificationAttempts: { increment: 1 },
              progressStage: null
            }
          })
        })

        // Emit event for notification
        await step.sendEvent('notify-verification-failed', {
          name: 'guru/verification-failed',
          data: {
            artifactId,
            projectId,
            failureCount: verificationResult.failed,
            failures: verificationResult.failures
          }
        })

        return { status: 'BLOCKED', reason: 'verification_failed' }
      }
    }

    // Phase 7: SAVING_ARTIFACT
    await step.run('save-artifact', async () => {
      const verificationStatus = prerequisites.groundTruthConfig?.enabled
        ? 'VERIFIED'
        : 'UNVERIFIED'

      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: generationResult.content,
          markdownContent: generateDrillMarkdown(generationResult.content),
          status: 'COMPLETED',
          verificationStatus,
          verificationDetails: prerequisites.groundTruthConfig?.enabled
            ? {
                generationToolCalls: generationResult.toolCalls,
                postVerification: { allPassed: true },
                verifiedAt: new Date().toISOString()
              }
            : null,
          lastVerifiedAt: prerequisites.groundTruthConfig?.enabled
            ? new Date()
            : null,
          progressStage: null
        }
      })
    })

    return { status: 'COMPLETED' }
  }
)
```

### Ground Truth Config Resolution

```typescript
// lib/groundTruth/config.ts

export interface GroundTruthConfig {
  enabled: boolean
  engineUrl: string
  engineType: string
  assessmentDefinitionId: string
}

export async function getGroundTruthConfig(
  projectId: string
): Promise<GroundTruthConfig | null> {
  // Find enabled ProjectAssessment with content validation enabled
  const projectAssessment = await prisma.projectAssessment.findFirst({
    where: {
      projectId,
      isEnabled: true,
      useForContentValidation: true,
      assessmentDefinition: {
        canValidateContent: true
      }
    },
    include: {
      assessmentDefinition: true
    }
  })

  if (!projectAssessment || !projectAssessment.assessmentDefinition.engineUrl) {
    return null
  }

  return {
    enabled: true,
    engineUrl: projectAssessment.assessmentDefinition.engineUrl,
    engineType: projectAssessment.assessmentDefinition.engineType || 'unknown',
    assessmentDefinitionId: projectAssessment.assessmentDefinitionId
  }
}

export async function checkEngineAvailability(engineUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${engineUrl}/health`, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}
```

### UI Components

#### VerificationBadge

```typescript
// components/artifacts/VerificationBadge.tsx

'use client'

import { CheckCircle, AlertTriangle, HelpCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VerificationStatus } from '@prisma/client'

interface VerificationBadgeProps {
  status: VerificationStatus | null
  failureCount?: number
  onClick?: () => void
  className?: string
}

const statusConfig = {
  VERIFIED: {
    icon: CheckCircle,
    label: 'Verified',
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'All mathematical claims verified'
  },
  NEEDS_REVIEW: {
    icon: AlertTriangle,
    label: 'Needs Review',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Some claims failed verification'
  },
  UNVERIFIED: {
    icon: HelpCircle,
    label: 'Unverified',
    color: 'text-gray-500 bg-gray-50 border-gray-200',
    description: 'Generated without ground truth validation'
  },
  FAILED: {
    icon: XCircle,
    label: 'Verification Failed',
    color: 'text-red-600 bg-red-50 border-red-200',
    description: 'Verification process encountered an error'
  }
}

export function VerificationBadge({
  status,
  failureCount,
  onClick,
  className
}: VerificationBadgeProps) {
  if (!status) return null

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium',
        'transition-colors',
        onClick && 'hover:opacity-80 cursor-pointer',
        !onClick && 'cursor-default',
        config.color,
        className
      )}
      title={config.description}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
      {status === 'NEEDS_REVIEW' && failureCount && (
        <span className="text-xs">({failureCount})</span>
      )}
    </button>
  )
}
```

#### VerificationDetailsModal

```typescript
// components/artifacts/VerificationDetailsModal.tsx

'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { VerificationDetails, ClaimFailure } from '@/lib/groundTruth/types'

interface VerificationDetailsModalProps {
  open: boolean
  onClose: () => void
  details: VerificationDetails | null
  onRegenerate: (scope: 'all' | 'failed' | string[]) => void
  isRegenerating?: boolean
}

export function VerificationDetailsModal({
  open,
  onClose,
  details,
  onRegenerate,
  isRegenerating
}: VerificationDetailsModalProps) {
  if (!details) return null

  const failures = details.postVerification?.failures || []

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Verification Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800">
              <strong>{failures.length}</strong> claim(s) failed verification.
              The content has been blocked to prevent incorrect information.
            </p>
          </div>

          {/* Failure List */}
          <div className="space-y-3">
            <h3 className="font-medium">Failed Claims</h3>
            {failures.map((failure, idx) => (
              <FailureCard key={idx} failure={failure} />
            ))}
          </div>

          {/* Regeneration Options */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-medium">Regeneration Options</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onRegenerate('failed')}
                disabled={isRegenerating}
                variant="outline"
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isRegenerating && 'animate-spin')} />
                Regenerate Failed Drills Only
              </Button>
              <Button
                onClick={() => onRegenerate('all')}
                disabled={isRegenerating}
                variant="outline"
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isRegenerating && 'animate-spin')} />
                Regenerate Entire Series
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Regeneration will query the ground truth engine to ensure correct answers.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FailureCard({ failure }: { failure: ClaimFailure }) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium">Drill: {failure.claim.drillId}</span>
        <span className="text-xs text-muted-foreground">{failure.claim.location}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Claimed move:</span>
          <span className="ml-2 font-mono text-red-600">{failure.claim.claimedMove}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Correct move:</span>
          <span className="ml-2 font-mono text-green-600">{failure.engineBestMove}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Dice roll: {failure.claim.diceRoll} | Engine equity: {failure.engineEquity?.toFixed(3)}
      </div>
    </div>
  )
}
```

### API Endpoints

#### Enable/Disable Content Validation

```typescript
// app/api/assessment/project-assessments/[id]/route.ts (extend existing)

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await req.json()
  const { isEnabled, useForContentValidation } = body

  // Validate ownership and update
  const projectAssessment = await prisma.projectAssessment.update({
    where: { id: params.id },
    data: {
      ...(isEnabled !== undefined && { isEnabled }),
      ...(useForContentValidation !== undefined && { useForContentValidation })
    },
    include: {
      assessmentDefinition: true
    }
  })

  // If enabling content validation, verify engine supports it
  if (useForContentValidation && !projectAssessment.assessmentDefinition.canValidateContent) {
    return NextResponse.json(
      { error: 'Assessment engine does not support content validation' },
      { status: 400 }
    )
  }

  return NextResponse.json(projectAssessment)
}
```

#### Regenerate Failed Content

```typescript
// app/api/projects/[id]/guru/artifacts/[artifactId]/regenerate/route.ts

export async function POST(
  req: Request,
  { params }: { params: { id: string; artifactId: string } }
) {
  const session = await getSession()
  if (!session) return unauthorized()

  await requireProjectOwnership(params.id, session.userId)

  const body = await req.json()
  const { scope } = body // 'all' | 'failed' | string[]

  const artifact = await prisma.guruArtifact.findUnique({
    where: { id: params.artifactId }
  })

  if (!artifact || artifact.projectId !== params.id) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  if (artifact.verificationStatus !== 'NEEDS_REVIEW') {
    return NextResponse.json(
      { error: 'Only artifacts with NEEDS_REVIEW status can be regenerated' },
      { status: 400 }
    )
  }

  // Reset artifact status and trigger regeneration
  await prisma.guruArtifact.update({
    where: { id: params.artifactId },
    data: {
      status: 'GENERATING',
      progressStage: 'LOADING_PREREQUISITES',
      verificationAttempts: { increment: 1 }
    }
  })

  // Trigger regeneration event
  await inngest.send({
    name: 'guru/regenerate-artifact',
    data: {
      artifactId: params.artifactId,
      projectId: params.id,
      scope,
      previousFailures: artifact.verificationDetails?.failures
    }
  })

  return NextResponse.json({ status: 'regenerating' })
}
```

---

## User Experience

### Enabling Ground Truth Validation

1. Navigate to project settings
2. In the Assessment section, find the configured assessment (e.g., "GNU Backgammon Assessment")
3. Toggle "Use for Content Validation" to ON
4. A confirmation explains: "Drill and curriculum generation will verify all mathematical claims against the GNU Backgammon engine. Generation will be blocked if the engine is unavailable."

### During Generation

1. User triggers drill generation
2. Progress UI shows normal phases, then "Verifying content..."
3. If all claims pass: Artifact marked COMPLETED with green "Verified" badge
4. If claims fail: Artifact marked BLOCKED with amber "Needs Review" badge

### Reviewing Failed Verification

1. User clicks "Needs Review" badge on artifact
2. Modal shows:
   - Summary: "3 claims failed verification"
   - List of failures with claimed vs. correct moves
   - Regeneration options: "Regenerate Failed Drills" or "Regenerate Entire Series"
3. User selects regeneration scope
4. System regenerates with ground truth verification

### Artifact Viewer

- All artifacts show verification badge in header (next to prompt badges)
- Clicking badge opens details modal
- Verified artifacts show "All 47 claims verified against GNU Backgammon"
- Unverified artifacts show "Generated without ground truth validation"

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/groundTruth/tools.test.ts

describe('verifyBackgammonMoveTool', () => {
  // Purpose: Verify tool schema matches OpenAI function calling requirements
  it('should have valid OpenAI tool schema', () => {
    expect(verifyBackgammonMoveTool.type).toBe('function')
    expect(verifyBackgammonMoveTool.function.parameters.required).toContain('dice_roll')
  })

  // Purpose: Ensure dice roll validation catches invalid inputs
  it('should validate dice roll format', () => {
    expect(() => verifyBackgammonMoveToolSchema.parse({
      position_type: 'opening',
      dice_roll: '7-1', // Invalid - 7 is not a valid die
      context: 'test'
    })).toThrow()
  })
})

// __tests__/groundTruth/postVerification.test.ts

describe('extractVerifiableClaims', () => {
  // Purpose: Verify claim extraction finds dice rolls and moves in drill content
  it('should extract claims from drill scenarios', () => {
    const mockDrillSeries = createMockDrillSeries([
      { setup: 'You roll 3-1 in the opening.', correctAnswer: '8/5, 6/5' }
    ])

    const claims = extractVerifiableClaims(mockDrillSeries)

    expect(claims).toHaveLength(1)
    expect(claims[0].diceRoll).toBe('3-1')
    expect(claims[0].claimedMove).toBe('8/5 6/5')
  })

  // Purpose: Ensure move normalization handles notation variations
  it('should normalize move notation variations', () => {
    expect(normalizeMove('8/5 6/5')).toBe('8/5 6/5')
    expect(normalizeMove('8-5, 6-5')).toBe('8/5 6/5')
    expect(normalizeMove('8/5  6/5')).toBe('8/5 6/5') // Extra space
  })
})

describe('validateClaimAgainstMoves', () => {
  // Purpose: Verify correct moves pass validation
  it('should return true when claimed move matches best move', () => {
    const engineMoves = [{ move: '8/5 6/5', equity: 0.235 }]
    expect(validateClaimAgainstMoves('8/5 6/5', engineMoves)).toBe(true)
  })

  // Purpose: Verify incorrect moves fail validation
  it('should return false when claimed move differs from best', () => {
    const engineMoves = [{ move: '8/5 6/5', equity: 0.235 }]
    expect(validateClaimAgainstMoves('13/10 6/5', engineMoves)).toBe(false)
  })
})
```

### Integration Tests

```typescript
// __tests__/groundTruth/integration.test.ts

describe('Ground Truth Generation Integration', () => {
  // Purpose: Verify function calling loop works end-to-end
  it('should generate drills with function calling verification', async () => {
    // Mock OpenAI to return tool calls then final content
    mockOpenAI.mockImplementationOnce(() => ({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          tool_calls: [{
            id: 'call_1',
            function: {
              name: 'verify_backgammon_move',
              arguments: JSON.stringify({
                position_type: 'opening',
                dice_roll: '3-1',
                context: 'Creating drill question'
              })
            }
          }]
        }
      }]
    }))

    mockOpenAI.mockImplementationOnce(() => ({
      choices: [{
        finish_reason: 'stop',
        message: { content: JSON.stringify(mockDrillContent) }
      }]
    }))

    const result = await generateDrillSeries(params, groundTruthConfig)

    expect(result.toolCalls).toHaveLength(1)
    expect(result.verificationDuringGeneration).toBe(true)
  })

  // Purpose: Verify generation blocks when engine is unavailable
  it('should throw GroundTruthUnavailableError when engine is down', async () => {
    mockEngineHealth.mockResolvedValue(false)

    await expect(
      generateDrillSeries(params, groundTruthConfig)
    ).rejects.toThrow(GroundTruthUnavailableError)
  })
})
```

### E2E Tests

```typescript
// e2e/ground-truth-validation.spec.ts

test.describe('Ground Truth Content Validation', () => {
  // Purpose: Verify complete user flow from enabling to verified content
  test('should generate verified drill series with ground truth', async ({ page }) => {
    // Enable ground truth validation
    await page.goto('/projects/test-project/settings')
    await page.getByRole('switch', { name: 'Use for Content Validation' }).click()
    await expect(page.getByText('Content validation enabled')).toBeVisible()

    // Generate drills
    await page.goto('/projects/test-project/guru')
    await page.getByRole('button', { name: 'Generate Drill Series' }).click()

    // Wait for completion
    await expect(page.getByText('Verifying content...')).toBeVisible()
    await expect(page.getByText('Verified')).toBeVisible({ timeout: 60000 })

    // Verify badge is shown
    const badge = page.getByRole('button', { name: /Verified/ })
    await expect(badge).toHaveClass(/bg-green/)
  })

  // Purpose: Verify blocked content shows regeneration options
  test('should show regeneration options when verification fails', async ({ page }) => {
    // Trigger generation with mock that will fail
    await generateDrillsWithMockedFailure(page)

    // Verify blocked state
    await expect(page.getByText('Needs Review')).toBeVisible()

    // Open details modal
    await page.getByRole('button', { name: /Needs Review/ }).click()

    // Verify modal content
    await expect(page.getByText('claims failed verification')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Regenerate Failed Drills Only' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Regenerate Entire Series' })).toBeVisible()
  })
})
```

---

## Performance Considerations

### Latency Impact

- **Function calling adds round-trips:** Each tool call adds ~500ms-2s latency
- **Mitigation:** Encourage LLM to batch verifications; cache aggressively
- **Expected:** Generation time increases from ~30s to ~60-90s with verification

### Engine Load

- **Concern:** Many concurrent generations could overwhelm GNU Backgammon server
- **Mitigation:** Response caching with 24-hour TTL; opening positions are finite (21 rolls)
- **Monitoring:** Track cache hit rate; alert if > 50% cache misses

### Cost Impact

- **More API calls:** Function calling increases OpenAI token usage ~20-30%
- **Mitigation:** Cache reduces redundant engine calls; batch verifications where possible

---

## Security Considerations

### Engine URL Validation

- Only allow HTTPS URLs for engine endpoints
- Validate engine URLs against allowlist in production

### Cache Poisoning Prevention

- Cache keys include position hash to prevent cross-position contamination
- Expire cache entries after 24 hours

### Rate Limiting

- Limit verification tool calls per generation (max 100)
- Limit regeneration attempts per artifact (max 5)

---

## Documentation

### Updates Required

- **CLAUDE.md:** Add Ground Truth Validation section to Agent Protocols
- **Developer Guide:** Create `developer-guides/08-ground-truth-validation-guide.md`
- **User Documentation:** Add help text for ground truth toggle in settings

---

## Implementation Phases

### Phase 1: Data Model & Configuration
- Add Prisma schema changes
- Create migration
- Add `useForContentValidation` toggle to ProjectAssessment UI
- Add `canValidateContent` to AssessmentDefinition

### Phase 2: Function Calling Infrastructure
- Create `lib/groundTruth/` module
- Implement tool definitions and executor
- Add caching layer
- Unit tests

### Phase 3: Drill Generation Integration
- Modify `drillDesigner.ts` for function calling mode
- Update prompts with verification instructions
- Add agentic loop with tool execution
- Integration tests

### Phase 4: Post-Verification Pipeline
- Implement claim extraction
- Add batch verification
- Update Inngest job with verification phase
- Handle blocking and failure states

### Phase 5: UI & Regeneration
- VerificationBadge component
- VerificationDetailsModal component
- Regeneration API endpoint
- Progress UI for "Verifying content..."

### Phase 6: Curriculum Extension
- Apply function calling pattern to curriculum generator
- Curriculum-specific claim extraction
- Testing

### Phase 7: Polish & Edge Cases
- Engine health monitoring
- Graceful degradation patterns
- Documentation updates
- E2E tests

---

## Open Questions

1. **Dry run mode:** Should we implement a preview mode that shows what would be verified without blocking? This could help users understand the verification scope before committing to generation.

2. **Verification attribution:** Should drills display "Answer verified by GNU Backgammon" to build user trust? Or does this clutter the learning experience?

3. **Partial verification:** For drills about strategy (not specific moves), should we skip verification entirely or flag as "conceptual - not verified"?

4. **Cache warming:** Should we pre-warm the cache with all 21 opening rolls on deployment? This would eliminate cold-start latency for the most common cases.

---

## References

- [OpenAI Function Calling Documentation](https://platform.openai.com/docs/guides/function-calling)
- [GNU Backgammon](https://www.gnu.org/software/gnubg/)
- `specs/feat-self-assessment-system.md` - Existing assessment architecture
- `specs/feat-ground-truth-content-validation/01-ideation.md` - Ideation document
- `lib/assessment/backgammonEngine.ts` - Existing engine connector
