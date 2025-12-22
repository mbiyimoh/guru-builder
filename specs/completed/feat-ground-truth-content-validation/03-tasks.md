# Task Breakdown: Ground Truth Content Validation
Generated: 2025-12-10
Source: specs/feat-ground-truth-content-validation/02-specification.md
Last Decompose: 2025-12-10

---

## Overview

This document provides a detailed task breakdown for implementing the Ground Truth Content Validation feature, which integrates mathematical ground truth sources (like the GNU Backgammon engine) into curriculum and drill generation workflows. The LLM actively queries the ground truth engine via OpenAI function calling during content creation, with post-generation verification as a safety net.

---

## Phase 1: Data Model & Configuration

### Task 1.1: Add Prisma Schema Changes

**Size:** Medium
**Priority:** High
**Dependencies:** None

**Description:** Add new database models and fields to support ground truth content validation, including verification status tracking and cache storage.

**Technical Requirements:**
- New `VerificationStatus` enum
- New `GroundTruthCache` model
- Extend `AssessmentDefinition` with `canValidateContent` field
- Extend `ProjectAssessment` with `useForContentValidation` field
- Extend `GuruArtifact` with verification tracking fields

**Implementation:**

```prisma
// Add to prisma/schema.prisma

enum VerificationStatus {
  VERIFIED      // All mathematical claims verified against ground truth
  NEEDS_REVIEW  // Some claims failed verification, blocked for human review
  UNVERIFIED    // Generated without ground truth validation (legacy/disabled)
  FAILED        // Verification process itself encountered an error
}

model GroundTruthCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique  // e.g., "gt:opening:3-1"
  response  Json                // Engine response data
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([expiresAt])
}

model AssessmentDefinition {
  // ... existing fields ...

  // NEW: Can this engine be used for content validation?
  canValidateContent    Boolean   @default(false)
}

model ProjectAssessment {
  // ... existing fields ...

  // NEW: Use this assessment's engine for content validation during generation?
  useForContentValidation Boolean @default(false)
}

model GuruArtifact {
  // ... existing fields ...

  // NEW: Verification tracking
  verificationStatus    VerificationStatus?
  verificationDetails   Json?       // { toolCalls: [], claims: [], failures: [], cachedResponses: [] }
  verificationAttempts  Int         @default(0)
  lastVerifiedAt        DateTime?
}
```

**Acceptance Criteria:**
- [ ] All Prisma schema changes added successfully
- [ ] TypeScript types generated correctly
- [ ] No breaking changes to existing queries
- [ ] `VerificationStatus` enum has all 4 states

---

### Task 1.2: Create Database Migration

**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1

**Description:** Create and test the database migration to apply the schema changes safely.

**Technical Requirements:**
- Use safe migration script (`npm run migrate:safe`)
- Create timestamped backup before migration
- Test migration on backup database first
- Verify data integrity after migration

**Implementation:**

```bash
# Step 1: Create backup (MANDATORY)
npm run db:backup

# Step 2: Create migration
npm run migrate:safe -- add-ground-truth-validation

# Step 3: Review generated migration SQL
# Check prisma/migrations/[timestamp]_add_ground_truth_validation/migration.sql

# Step 4: Apply migration
npx prisma migrate deploy

# Step 5: Regenerate Prisma client
npx prisma generate
```

**Acceptance Criteria:**
- [ ] Backup created successfully before migration
- [ ] Migration SQL reviewed and approved
- [ ] Migration applied without errors
- [ ] Prisma client regenerated with new types
- [ ] All existing data preserved

---

### Task 1.3: Update AssessmentDefinition with Content Validation Flag

**Size:** Small
**Priority:** Medium
**Dependencies:** Task 1.2

**Description:** Update the existing GNU Backgammon AssessmentDefinition record to enable content validation capability.

**Technical Requirements:**
- Set `canValidateContent = true` for GNU Backgammon assessment
- Verify engine URL is still valid
- Add database seed/migration for this data

**Implementation:**

```typescript
// prisma/seed.ts or one-time script

await prisma.assessmentDefinition.updateMany({
  where: {
    name: 'GNU Backgammon Assessment'
  },
  data: {
    canValidateContent: true
  }
})

// Verify
const gnuBgAssessment = await prisma.assessmentDefinition.findFirst({
  where: { name: 'GNU Backgammon Assessment' }
})

console.log(`GNU BG canValidateContent: ${gnuBgAssessment?.canValidateContent}`)
```

**Acceptance Criteria:**
- [ ] GNU Backgammon AssessmentDefinition has `canValidateContent = true`
- [ ] Engine URL is still accessible
- [ ] Other assessment definitions remain unchanged

---

### Task 1.4: Add Content Validation Toggle to UI

**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 1.2

**Description:** Add a toggle switch to the project settings page that allows users to enable/disable content validation for a project's assessment.

**Technical Requirements:**
- Add toggle to project settings assessment section
- Only show toggle if assessment's `canValidateContent = true`
- Show confirmation dialog explaining impact
- Update ProjectAssessment record via API

**Implementation:**

```typescript
// app/projects/[id]/settings/page.tsx (or assessment settings component)

'use client'

import { Switch } from '@/components/ui/switch'
import { useState } from 'react'

export function ContentValidationToggle({
  projectAssessment,
  assessmentDefinition
}: {
  projectAssessment: ProjectAssessment
  assessmentDefinition: AssessmentDefinition
}) {
  const [enabled, setEnabled] = useState(projectAssessment.useForContentValidation)
  const [isUpdating, setIsUpdating] = useState(false)

  if (!assessmentDefinition.canValidateContent) {
    return null // Don't show toggle if engine doesn't support it
  }

  async function handleToggle(checked: boolean) {
    setIsUpdating(true)
    try {
      const response = await fetch(
        `/api/assessment/project-assessments/${projectAssessment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useForContentValidation: checked })
        }
      )

      if (response.ok) {
        setEnabled(checked)
        toast.success(
          checked
            ? 'Content validation enabled. Future drill/curriculum generation will verify mathematical claims.'
            : 'Content validation disabled.'
        )
      }
    } catch (error) {
      toast.error('Failed to update content validation setting')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-0.5">
        <label className="text-sm font-medium">Use for Content Validation</label>
        <p className="text-sm text-muted-foreground">
          Verify all mathematical claims against {assessmentDefinition.name} during generation.
          Generation will be blocked if the engine is unavailable.
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
      />
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Toggle appears in project settings for assessments that support validation
- [ ] Toggle updates `useForContentValidation` field via API
- [ ] Confirmation message explains impact
- [ ] Toggle disabled while updating
- [ ] Success/error toast notifications work

---

### Task 1.5: Extend PATCH API Endpoint for ProjectAssessment

**Size:** Small
**Priority:** Medium
**Dependencies:** Task 1.2

**Description:** Update the existing ProjectAssessment PATCH endpoint to accept and validate the `useForContentValidation` field.

**Technical Requirements:**
- Accept `useForContentValidation` in request body
- Validate that assessment definition supports content validation
- Return error if trying to enable for unsupported engine
- Require ownership verification

**Implementation:**

```typescript
// app/api/assessment/project-assessments/[id]/route.ts (extend existing)

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body = await req.json()
  const { isEnabled, useForContentValidation } = body

  // Get current record to verify ownership and check constraints
  const current = await prisma.projectAssessment.findUnique({
    where: { id: params.id },
    include: {
      assessmentDefinition: true,
      project: true
    }
  })

  if (!current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify ownership
  if (current.project.userId !== session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Validate content validation capability
  if (useForContentValidation && !current.assessmentDefinition.canValidateContent) {
    return NextResponse.json(
      { error: 'Assessment engine does not support content validation' },
      { status: 400 }
    )
  }

  // Update
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

  return NextResponse.json(projectAssessment)
}
```

**Acceptance Criteria:**
- [ ] Endpoint accepts `useForContentValidation` field
- [ ] Validation prevents enabling for unsupported engines
- [ ] Ownership verification works
- [ ] Returns updated ProjectAssessment with assessmentDefinition included
- [ ] Error messages are clear and helpful

---

## Phase 2: Function Calling Infrastructure

### Task 2.1: Create Ground Truth Module Structure

**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2

**Description:** Create the `lib/groundTruth/` module with all necessary type definitions and constants.

**Technical Requirements:**
- Create `lib/groundTruth/` directory
- Define all TypeScript interfaces
- Export types for use across the codebase
- Define constants for limits and timeouts

**Implementation:**

```typescript
// lib/groundTruth/types.ts

export interface GroundTruthConfig {
  enabled: boolean
  engineUrl: string
  engineType: string
  assessmentDefinitionId: string
}

export interface VerifyMoveArgs {
  position_type: 'opening' | 'custom'
  position_hash?: string
  dice_roll: string
  context: string
}

export interface ToolCallResult {
  success: boolean
  fromCache?: boolean
  data?: {
    dice_roll: string
    position_type: string
    best_moves: Array<{
      rank: number
      move: string
      equity: number
      is_best: boolean
    }>
    verified_at: string
    note: string
  }
  error?: string
}

export interface ToolCallLog {
  id: string
  function: string
  args: VerifyMoveArgs
  result: ToolCallResult
  durationMs: number
  timestamp: string
}

export interface VerifiableClaim {
  drillId: string
  claimType: 'best_move' | 'correct_answer' | 'move_comparison'
  positionType: 'opening' | 'custom'
  positionHash?: string
  diceRoll: string
  claimedMove: string
  location: string  // e.g., "series[0].drills[2].options[0]"
}

export interface ClaimFailure {
  claim: VerifiableClaim
  engineBestMove: string
  engineEquity: number
  claimedMoveEquity?: number
  equityLoss?: number
}

export interface ClaimResult {
  claim: VerifiableClaim
  isValid: boolean
  error?: string
  engineBestMove?: string
  engineBestEquity?: number
  claimedMoveRank?: number
}

export interface VerificationResult {
  totalClaims: number
  verified: number
  failed: number
  failures: ClaimFailure[]
  allPassed: boolean
  details: ClaimResult[]
}

export interface VerificationDetails {
  generationToolCalls?: ToolCallLog[]
  postVerification?: VerificationResult
  blockedAt?: string
  verifiedAt?: string
  message?: string
}

export class GroundTruthUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroundTruthUnavailableError'
  }
}

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

export const TAVILY_MAX_QUERY_LENGTH = 400
```

**Acceptance Criteria:**
- [ ] All type definitions created and exported
- [ ] Constants defined with appropriate values
- [ ] Custom error class for ground truth unavailability
- [ ] No TypeScript errors in module

---

### Task 2.2: Implement OpenAI Tool Definitions

**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1

**Description:** Create the OpenAI function calling tool schema for backgammon move verification.

**Technical Requirements:**
- Define Zod schema for tool arguments
- Create OpenAI-compatible tool definition
- Add comprehensive descriptions for LLM guidance
- Validate dice roll format with regex

**Implementation:**

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

**Acceptance Criteria:**
- [ ] Zod schema validates tool arguments correctly
- [ ] OpenAI tool definition has all required fields
- [ ] Dice roll regex validates format correctly
- [ ] Tool description guides LLM to use it appropriately
- [ ] Unit tests for schema validation pass

---

### Task 2.3: Implement Tool Executor

**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2

**Description:** Create the tool executor that handles calling the backgammon engine and managing responses.

**Technical Requirements:**
- Integrate with existing `backgammonEngine.ts` connector
- Build cache keys from position and dice roll
- Check cache before engine call
- Handle engine errors gracefully
- Store successful results in cache

**Implementation:**

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
      data: cached as ToolCallResult['data']
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

**Acceptance Criteria:**
- [ ] Tool executor calls backgammon engine correctly
- [ ] Cache is checked before making engine calls
- [ ] Successful results are cached
- [ ] Engine errors are handled gracefully
- [ ] Cache keys are built correctly for opening/custom positions
- [ ] Integration tests with mock engine pass

---

### Task 2.4: Implement Cache Layer

**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2, Task 2.1

**Description:** Create a two-tier caching system (memory + database) for ground truth engine responses.

**Technical Requirements:**
- In-memory cache for fast lookups (5 min TTL)
- Database cache for persistence (24 hour TTL)
- Automatic expiration handling
- Upsert pattern for database updates
- Type-safe Prisma JSON handling

**Implementation:**

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

**Acceptance Criteria:**
- [ ] Memory cache stores responses with 5 min TTL
- [ ] Database cache persists responses with 24 hour TTL
- [ ] Cache hits return data from memory when available
- [ ] Cache misses populate memory from database
- [ ] Expired entries are ignored
- [ ] Upsert pattern updates existing cache entries
- [ ] Unit tests for cache behavior pass

---

### Task 2.5: Implement Ground Truth Config Resolution

**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1

**Description:** Create helper functions to resolve ground truth configuration from project settings and check engine availability.

**Technical Requirements:**
- Query ProjectAssessment with filters for enabled validation
- Include AssessmentDefinition in response
- Return null if no validation is configured
- Implement health check for engine availability
- Add timeout to health check (5 seconds)

**Implementation:**

```typescript
// lib/groundTruth/config.ts

import { prisma } from '@/lib/prisma'
import type { GroundTruthConfig } from './types'

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

**Acceptance Criteria:**
- [ ] Config resolution queries correct fields
- [ ] Returns null when no validation configured
- [ ] Includes assessment definition in response
- [ ] Engine health check works with timeout
- [ ] Health check returns false on timeout or error
- [ ] Unit tests with mock Prisma pass

---

## Phase 3: Drill Generation Integration

### Task 3.1: Create Response Parser for Function Calling

**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2

**Description:** Create a parser that extracts structured drill output from LLM responses that may contain markdown formatting.

**Technical Requirements:**
- Try parsing as plain JSON first
- Extract JSON from markdown code blocks
- Handle various markdown formats
- Fall back to boundary detection
- Validate with Zod schema

**Implementation:**

```typescript
// lib/groundTruth/responseParser.ts

import { drillSeriesOutputSchema } from '@/lib/guruFunctions/schemas/drillSeriesSchema'
import type { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema'

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

**Acceptance Criteria:**
- [ ] Parses plain JSON correctly
- [ ] Extracts JSON from markdown code blocks
- [ ] Handles various markdown formats (with/without language tag)
- [ ] Falls back to boundary detection
- [ ] Throws clear error on parse failure
- [ ] Unit tests for all formats pass

---

### Task 3.2: Create Prompt Builder with Verification Instructions

**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2

**Description:** Modify the drill generation prompts to include instructions for using the verification tool.

**Technical Requirements:**
- Add instructions to system prompt for when/how to use tool
- Emphasize tool usage for mathematical claims
- Guide LLM to batch verifications where possible
- Maintain existing prompt structure and quality

**Implementation:**

```typescript
// lib/guruFunctions/generators/drillDesigner.ts (new function)

function buildPromptsWithVerificationInstructions(params: DrillGeneratorParams): {
  systemPrompt: string
  userPrompt: string
} {
  const systemPrompt = `You are an expert backgammon teacher creating drill questions for students.

CRITICAL INSTRUCTION: You have access to a ground truth verification tool that queries the GNU Backgammon engine.

WHEN TO USE THE TOOL:
- BEFORE stating any specific move is "best", "correct", "optimal", or "recommended"
- BEFORE creating any drill question where the answer is a specific move
- BEFORE comparing the equity of different moves
- BEFORE making any mathematical claim about move quality

HOW TO USE THE TOOL:
1. Call verify_backgammon_move with the dice roll
2. Wait for the engine response with ranked moves
3. Use ONLY the #1 ranked move as the correct answer
4. Do NOT deviate from the engine's recommendation

DO NOT:
- Guess or rely on your training data for move analysis
- State that a move is correct without verification
- Create drill answers without checking the engine first

After verifying all moves, generate the complete drill series as a JSON object with the structure defined in the user prompt.`

  const userPrompt = `Create a drill series for ${params.domain} students.

Corpus context:
${params.corpusSummary}

Mental Model:
${params.mentalModel}

Curriculum:
${params.curriculum}

Additional notes:
${params.userNotes || 'None'}

IMPORTANT: For EACH drill question, you MUST:
1. Call verify_backgammon_move to get the correct answer
2. Use the #1 ranked move from the engine as the correct option
3. Generate 3-4 plausible wrong options

After verifying all answers, return the complete drill series in this JSON format:
{
  "series": [
    {
      "themeId": "theme-1",
      "themeName": "Theme name",
      "drills": [
        {
          "drillId": "unique-id",
          "scenario": {
            "setup": "Scenario description with dice roll",
            "visualAid": "Optional diagram"
          },
          "question": "What should you do?",
          "options": [
            { "text": "Move description", "isCorrect": true },
            { "text": "Wrong move 1", "isCorrect": false },
            { "text": "Wrong move 2", "isCorrect": false }
          ],
          "feedback": {
            "correct": "Explanation of why this is correct",
            "incorrect": "What makes the other moves wrong"
          }
        }
      ]
    }
  ]
}`

  return { systemPrompt, userPrompt }
}
```

**Acceptance Criteria:**
- [ ] System prompt emphasizes tool usage
- [ ] Instructions explain when to use tool
- [ ] Instructions explain how to use tool results
- [ ] User prompt maintains existing drill structure
- [ ] Prompts guide LLM to verify before answering
- [ ] No degradation in drill quality

---

### Task 3.3: Implement Tool Call Executor Loop

**Size:** Large
**Priority:** High
**Dependencies:** Task 2.3, Task 3.2

**Description:** Create the agentic loop that executes tool calls from the LLM and feeds results back for continued generation.

**Technical Requirements:**
- Implement iterative loop with tool_choice: 'auto'
- Execute tool calls and format results for LLM
- Track all tool calls for audit trail
- Enforce iteration and tool call limits
- Handle finish_reason states correctly
- Support message history accumulation

**Implementation:**

```typescript
// lib/guruFunctions/generators/drillDesigner.ts (new function)

import { openai } from '@/lib/openai'
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'openai/resources/chat/completions'
import { verifyBackgammonMoveTool } from '@/lib/groundTruth/tools'
import { executeVerifyBackgammonMove } from '@/lib/groundTruth/executor'
import { GROUND_TRUTH_LIMITS } from '@/lib/groundTruth/constants'
import type { ToolCallLog } from '@/lib/groundTruth/types'

interface ToolExecutionResult {
  logs: ToolCallLog[]
  messages: ChatCompletionToolMessageParam[]
}

async function executeToolCalls(
  toolCalls: ChatCompletionMessageToolCall[],
  engineUrl: string
): Promise<ToolExecutionResult> {
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

async function generateWithFunctionCalling(
  params: DrillGeneratorParams,
  config: GroundTruthConfig
): Promise<DrillGenerationResult> {
  const { systemPrompt, userPrompt } = buildPromptsWithVerificationInstructions(params)

  const toolCalls: ToolCallLog[] = []
  let totalToolCalls = 0
  let messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  // Agentic loop - keep going until LLM returns final content
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

    // If LLM wants to call tools, execute them
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      // ENFORCE TOOL CALL LIMIT
      totalToolCalls += choice.message.tool_calls.length
      if (totalToolCalls > GROUND_TRUTH_LIMITS.MAX_TOOL_CALLS) {
        throw new Error(
          `Generation exceeded maximum tool calls (${GROUND_TRUTH_LIMITS.MAX_TOOL_CALLS}). ` +
          `This may indicate an issue with the prompt or engine responses.`
        )
      }

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

  throw new Error(`Generation exceeded ${GROUND_TRUTH_LIMITS.MAX_ITERATIONS} iterations`)
}
```

**Acceptance Criteria:**
- [ ] Agentic loop executes tool calls correctly
- [ ] Tool results are formatted for LLM consumption
- [ ] Message history accumulates properly
- [ ] Iteration limit prevents infinite loops
- [ ] Tool call limit prevents runaway costs
- [ ] Final content is parsed correctly
- [ ] All tool calls are logged for audit
- [ ] Integration tests with mock OpenAI pass

---

### Task 3.4: Modify Main Drill Generator Entry Point

**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.3

**Description:** Update the main `generateDrillSeries` function to route to function calling when ground truth is enabled.

**Technical Requirements:**
- Accept optional `groundTruthConfig` parameter
- Check engine availability before generation
- Route to function calling or standard generation
- Throw `GroundTruthUnavailableError` when engine is down
- Maintain backward compatibility for non-validated generation

**Implementation:**

```typescript
// lib/guruFunctions/generators/drillDesigner.ts (modify existing function)

import { GroundTruthUnavailableError } from '@/lib/groundTruth/types'
import { checkEngineAvailability, type GroundTruthConfig } from '@/lib/groundTruth/config'

export interface DrillGenerationResult {
  content: DrillSeriesOutput
  toolCalls?: ToolCallLog[]
  verificationDuringGeneration?: boolean
  iterations?: number
}

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
  const content = await generateWithStructuredOutput(params)

  return {
    content,
    verificationDuringGeneration: false
  }
}

async function generateWithStructuredOutput(
  params: DrillGeneratorParams
): Promise<DrillSeriesOutput> {
  // Existing implementation (no changes)
  // ...
}
```

**Acceptance Criteria:**
- [ ] Function accepts optional ground truth config
- [ ] Routes to function calling when enabled
- [ ] Routes to standard generation when disabled
- [ ] Checks engine availability before generation
- [ ] Throws GroundTruthUnavailableError when engine down
- [ ] Backward compatible with existing code
- [ ] Unit tests for routing logic pass

---

## Phase 4: Post-Verification Pipeline

### Task 4.1: Implement Move Extraction and Normalization

**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1

**Description:** Create functions to extract and normalize backgammon move notation from drill content.

**Technical Requirements:**
- Regex patterns for backgammon move notation
- Handle various notation formats (slash, dash, comma separators)
- Normalize to consistent format for comparison
- Extract dice rolls from scenario text
- Support hit markers and bear-off notation

**Implementation:**

```typescript
// lib/groundTruth/postVerification.ts (part 1)

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
```

**Acceptance Criteria:**
- [ ] Regex patterns match all standard notation formats
- [ ] Move extraction finds moves in drill text
- [ ] Normalization produces consistent format
- [ ] Hit markers and bear-offs handled correctly
- [ ] Unit tests for all patterns pass

---

### Task 4.2: Implement Position Detection

**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 4.1

**Description:** Create functions to detect whether a drill uses opening or custom board positions.

**Technical Requirements:**
- Keyword-based detection for position types
- Default to opening position when ambiguous
- Log warnings for custom positions (not supported in MVP)
- Prepare interface for future position hash support

**Implementation:**

```typescript
// lib/groundTruth/postVerification.ts (part 2)

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
```

**Acceptance Criteria:**
- [ ] Opening positions detected correctly
- [ ] Custom positions logged with warning
- [ ] Default to opening when ambiguous
- [ ] Position hash generation returns undefined (MVP)
- [ ] Unit tests for detection logic pass

---

### Task 4.3: Implement Claim Extraction from Drill Content

**Size:** Medium
**Priority:** High
**Dependencies:** Task 4.1, Task 4.2

**Description:** Extract all verifiable mathematical claims from generated drill series content.

**Technical Requirements:**
- Iterate through all drills in series
- Extract dice roll from scenario
- Find correct answer option
- Extract move from answer text
- Detect position type
- Skip custom positions in MVP
- Build location string for error reporting

**Implementation:**

```typescript
// lib/groundTruth/postVerification.ts (part 3)

import type { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema'
import type { VerifiableClaim } from './types'

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
```

**Acceptance Criteria:**
- [ ] Claims extracted from all drills in series
- [ ] Dice rolls extracted correctly
- [ ] Correct answer options found
- [ ] Moves extracted from answer text
- [ ] Position types detected
- [ ] Custom positions skipped with log message
- [ ] Location strings built for error reporting
- [ ] Unit tests with mock drill series pass

---

### Task 4.4: Implement Batch Claim Verification

**Size:** Large
**Priority:** High
**Dependencies:** Task 4.3, Task 2.3

**Description:** Verify all extracted claims against the ground truth engine, batching by cache key to minimize engine calls.

**Technical Requirements:**
- Group claims by position + dice roll cache key
- Execute one engine call per unique cache key
- Compare claimed moves to engine best move
- Track pass/fail for each claim
- Build detailed verification result
- Handle engine errors gracefully

**Implementation:**

```typescript
// lib/groundTruth/postVerification.ts (part 4)

import { executeVerifyBackgammonMove } from './executor'
import type { VerificationResult, ClaimResult, ClaimFailure } from './types'

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

    const bestMoves = engineResult.data!.best_moves

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

/**
 * Find rank of claimed move in engine results (1-indexed)
 */
function findMoveRank(
  claimedMove: string,
  engineMoves: Array<{ move: string; equity: number }>
): number | undefined {
  const normalizedClaim = normalizeMove(claimedMove)
  const index = engineMoves.findIndex(m => normalizeMove(m.move) === normalizedClaim)
  return index >= 0 ? index + 1 : undefined
}

/**
 * Group array by key function
 */
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
```

**Acceptance Criteria:**
- [ ] Claims grouped by cache key correctly
- [ ] One engine call per unique key
- [ ] Move comparison handles normalization
- [ ] Pass/fail tracked for each claim
- [ ] Failures include detailed information
- [ ] Engine errors handled gracefully
- [ ] Verification result has all required fields
- [ ] Integration tests with mock engine pass

---

### Task 4.5: Update Inngest Job with Verification Phase

**Size:** Large
**Priority:** High
**Dependencies:** Task 3.4, Task 4.4

**Description:** Modify the drill series generation Inngest job to include the verification phase and handle blocking/failure states.

**Technical Requirements:**
- Load ground truth config in prerequisites phase
- Pass config to drill generator
- Add VERIFYING_CONTENT progress stage
- Extract and verify claims after generation
- Block artifact on verification failure
- Save verification details to artifact
- Emit notification event on failure
- Mark as VERIFIED on success

**Implementation:**

```typescript
// In lib/inngest-functions.ts - drill series generation (modified)

import { getGroundTruthConfig } from '@/lib/groundTruth/config'
import { extractVerifiableClaims, verifyClaimsAgainstEngine } from '@/lib/groundTruth/postVerification'
import { GroundTruthUnavailableError } from '@/lib/groundTruth/types'

export const drillSeriesGeneration = inngest.createFunction(
  {
    id: 'drill-series-generation',
    concurrency: { limit: 3 }
  },
  { event: 'guru/generate-drill-series' },
  async ({ event, step }) => {
    const { projectId, artifactId, mentalModelArtifactId, curriculumArtifactId, userNotes } = event.data

    // Phase 1: LOADING_PREREQUISITES (modified)
    const prerequisites = await step.run('load-prerequisites', async () => {
      // ... existing prerequisite loading ...

      // NEW: Check for ground truth config
      const groundTruthConfig = await getGroundTruthConfig(projectId)

      return { ...existingData, groundTruthConfig }
    })

    // Phase 2-4: Existing phases (no changes)...

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
          prerequisites.groundTruthConfig || undefined
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

    // Phase 7: SAVING_ARTIFACT (modified)
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

**Acceptance Criteria:**
- [ ] Ground truth config loaded in prerequisites
- [ ] Config passed to drill generator
- [ ] VERIFYING_CONTENT progress stage shown
- [ ] Claims extracted after generation
- [ ] Verification runs against engine
- [ ] Artifact blocked on failure with details
- [ ] Notification event emitted on failure
- [ ] Artifact marked VERIFIED on success
- [ ] Verification details saved to artifact
- [ ] Integration tests with mock Inngest pass

---

### Task 4.6: Add VERIFYING_CONTENT to Progress Stages

**Size:** Small
**Priority:** Medium
**Dependencies:** Task 4.5

**Description:** Add the new VERIFYING_CONTENT progress stage to the GuruArtifact type system and UI.

**Technical Requirements:**
- Add to ProgressStage type (if not already dynamic)
- Update progress UI to display "Verifying content..."
- Add appropriate icon/color for verification stage
- Ensure progress polling continues during verification

**Implementation:**

```typescript
// If ProgressStage is an enum in Prisma, add to schema.prisma:
// enum ProgressStage {
//   ...
//   VERIFYING_CONTENT
// }

// Otherwise, if it's a string field, just use the value directly in code

// Update progress display component
// components/artifacts/ArtifactProgressDisplay.tsx (or similar)

const progressStageLabels: Record<string, { label: string; icon: React.ComponentType }> = {
  // ... existing stages ...
  VERIFYING_CONTENT: {
    label: 'Verifying content...',
    icon: CheckCircle
  }
}
```

**Acceptance Criteria:**
- [ ] VERIFYING_CONTENT stage recognized by system
- [ ] Progress UI shows "Verifying content..." message
- [ ] Appropriate icon/color displayed
- [ ] Progress polling continues during stage
- [ ] No UI errors with new stage

---

## Phase 5: UI & Regeneration

### Task 5.1: Create VerificationBadge Component

**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2

**Description:** Create a badge component that displays the verification status of an artifact.

**Technical Requirements:**
- Display different styles for each VerificationStatus
- Show failure count for NEEDS_REVIEW status
- Support click handler to open details
- Use shadcn/ui styling patterns
- Show tooltip with status description

**Implementation:**

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

**Acceptance Criteria:**
- [ ] Badge displays correctly for all status types
- [ ] Icons match status meaning
- [ ] Colors follow status semantics
- [ ] Failure count shown for NEEDS_REVIEW
- [ ] Click handler works when provided
- [ ] Tooltip shows status description
- [ ] Component follows shadcn/ui patterns

---

### Task 5.2: Create VerificationDetailsModal Component

**Size:** Large
**Priority:** High
**Dependencies:** Task 5.1

**Description:** Create a modal component that shows detailed verification failures and regeneration options.

**Technical Requirements:**
- Display summary of failures
- List each failed claim with details
- Show claimed vs correct moves
- Display dice roll and equity information
- Provide regeneration options (failed only / entire series)
- Handle loading state during regeneration
- Use shadcn/ui Dialog component

**Implementation:**

```typescript
// components/artifacts/VerificationDetailsModal.tsx

'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
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

**Acceptance Criteria:**
- [ ] Modal opens when triggered
- [ ] Summary shows failure count
- [ ] Each failure displays with details
- [ ] Claimed vs correct moves clearly shown
- [ ] Regeneration buttons work
- [ ] Loading state shows during regeneration
- [ ] Modal closes properly
- [ ] Component follows shadcn/ui patterns

---

### Task 5.3: Add Verification Badge to Artifact Viewers

**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 5.1, Task 5.2

**Description:** Integrate the VerificationBadge into artifact viewer pages (drill series, curriculum, mental model).

**Technical Requirements:**
- Add badge to artifact header next to prompt badges
- Load verification details from artifact
- Open modal on badge click
- Handle null verification status gracefully
- Calculate failure count from verification details

**Implementation:**

```typescript
// app/projects/[id]/guru/artifacts/[artifactId]/page.tsx (drill series viewer)
// Similar changes for curriculum and mental model viewers

'use client'

import { useState } from 'react'
import { VerificationBadge } from '@/components/artifacts/VerificationBadge'
import { VerificationDetailsModal } from '@/components/artifacts/VerificationDetailsModal'
import type { VerificationDetails } from '@/lib/groundTruth/types'

export default function DrillSeriesViewerPage({ artifact }: { artifact: GuruArtifact }) {
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)

  const verificationDetails = artifact.verificationDetails as VerificationDetails | null
  const failureCount = verificationDetails?.postVerification?.failures?.length || 0

  async function handleRegenerate(scope: 'all' | 'failed' | string[]) {
    // Call regeneration API
    const response = await fetch(
      `/api/projects/${artifact.projectId}/guru/artifacts/${artifact.id}/regenerate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      }
    )

    if (response.ok) {
      toast.success('Regeneration started. Refresh page to see progress.')
      setIsVerificationModalOpen(false)
      router.refresh()
    }
  }

  return (
    <div>
      {/* Artifact Header */}
      <div className="flex items-center gap-2">
        <h1>{artifact.name}</h1>

        {/* Existing prompt badges */}
        {/* ... */}

        {/* NEW: Verification badge */}
        <VerificationBadge
          status={artifact.verificationStatus}
          failureCount={failureCount}
          onClick={
            artifact.verificationStatus === 'NEEDS_REVIEW' || artifact.verificationStatus === 'VERIFIED'
              ? () => setIsVerificationModalOpen(true)
              : undefined
          }
        />
      </div>

      {/* Artifact content */}
      {/* ... */}

      {/* Verification Details Modal */}
      <VerificationDetailsModal
        open={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        details={verificationDetails}
        onRegenerate={handleRegenerate}
      />
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Badge appears in artifact header
- [ ] Badge positioned next to prompt badges
- [ ] Click opens modal for NEEDS_REVIEW status
- [ ] Click opens modal for VERIFIED status (showing success)
- [ ] Failure count calculated correctly
- [ ] Null status handled gracefully
- [ ] Modal integration works

---

### Task 5.4: Create Regenerate API Endpoint

**Size:** Medium
**Priority:** High
**Dependencies:** Task 4.5

**Description:** Create an API endpoint that triggers artifact regeneration with ground truth validation.

**Technical Requirements:**
- Accept regeneration scope (all / failed / specific drill IDs)
- Verify artifact is in NEEDS_REVIEW status
- Verify ownership
- Reset artifact to GENERATING status
- Increment verification attempts counter
- Trigger Inngest regeneration event
- Enforce max regeneration attempts limit

**Implementation:**

```typescript
// app/api/projects/[id]/guru/artifacts/[artifactId]/regenerate/route.ts

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest'
import { NextResponse } from 'next/server'
import { GROUND_TRUTH_LIMITS } from '@/lib/groundTruth/constants'

async function requireProjectOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  })
  if (!project) {
    throw new Error('Project not found or unauthorized')
  }
  return project
}

export async function POST(
  req: Request,
  { params }: { params: { id: string; artifactId: string } }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireProjectOwnership(params.id, session.userId)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

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

  // Check max attempts
  if (artifact.verificationAttempts >= GROUND_TRUTH_LIMITS.MAX_REGENERATION_ATTEMPTS) {
    return NextResponse.json(
      {
        error: `Maximum regeneration attempts (${GROUND_TRUTH_LIMITS.MAX_REGENERATION_ATTEMPTS}) exceeded. Please contact support.`
      },
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

**Acceptance Criteria:**
- [ ] Endpoint accepts scope parameter
- [ ] Ownership verified
- [ ] Only NEEDS_REVIEW artifacts can be regenerated
- [ ] Max attempts enforced
- [ ] Artifact reset to GENERATING status
- [ ] Verification attempts incremented
- [ ] Inngest event triggered
- [ ] Error messages are clear

---

### Task 5.5: Implement Regeneration Inngest Handler

**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 5.4, Task 4.5

**Description:** Create an Inngest function that handles artifact regeneration, optionally filtering to only regenerate failed drills.

**Technical Requirements:**
- Handle 'all' scope (full regeneration)
- Handle 'failed' scope (partial regeneration - future enhancement)
- Handle specific drill IDs (future enhancement)
- For MVP: Only support 'all' scope
- Reuse existing drill generation function
- Pass previous failures for context (future)

**Implementation:**

```typescript
// lib/inngest-functions.ts (new function)

export const artifactRegeneration = inngest.createFunction(
  {
    id: 'artifact-regeneration',
    concurrency: { limit: 3 }
  },
  { event: 'guru/regenerate-artifact' },
  async ({ event, step }) => {
    const { artifactId, projectId, scope, previousFailures } = event.data

    // For MVP: Only support 'all' scope
    // Future: Implement partial regeneration for 'failed' scope
    if (scope !== 'all') {
      throw new Error(`Regeneration scope "${scope}" not yet implemented. Only "all" is supported.`)
    }

    // Load artifact to get original parameters
    const artifact = await step.run('load-artifact', async () => {
      return prisma.guruArtifact.findUniqueOrThrow({
        where: { id: artifactId },
        include: {
          project: true
        }
      })
    })

    // Trigger full regeneration by reusing the standard generation flow
    // The existing drill series generation function will handle verification
    await step.sendEvent('trigger-generation', {
      name: 'guru/generate-drill-series',
      data: {
        projectId,
        artifactId,
        mentalModelArtifactId: artifact.mentalModelArtifactId,
        curriculumArtifactId: artifact.curriculumArtifactId,
        userNotes: artifact.userNotes
      }
    })

    return { status: 'regeneration-triggered' }
  }
)
```

**Acceptance Criteria:**
- [ ] Regeneration event handled
- [ ] 'all' scope supported
- [ ] Non-'all' scopes throw clear error
- [ ] Original artifact parameters retrieved
- [ ] Standard generation flow triggered
- [ ] Previous failures logged for future use
- [ ] Integration tests with mock Inngest pass

---

## Phase 6: Curriculum Extension (Deferrable)

### Task 6.1: Apply Function Calling to Curriculum Generator

**Size:** Large
**Priority:** Low (Deferrable)
**Dependencies:** Phase 3 tasks

**Description:** Extend the function calling pattern to curriculum generation for verifying example moves and practice scenarios.

**Technical Requirements:**
- Identify mathematical claims in curriculum structure
- Apply same verification tool to curriculum examples
- Update curriculum generator with function calling mode
- Create curriculum-specific prompt instructions
- Handle verification failures in curriculum context

**Implementation:**

```typescript
// lib/guruFunctions/generators/curriculumDesigner.ts (modified)

// Similar pattern to drillDesigner.ts:
// 1. Accept groundTruthConfig parameter
// 2. Check engine availability
// 3. Use function calling mode when enabled
// 4. Parse curriculum output from markdown/JSON hybrid
// 5. Return generation result with tool calls

// Details deferred until Phase 6 implementation
```

**Acceptance Criteria:**
- [ ] Curriculum generator accepts ground truth config
- [ ] Function calling mode implemented
- [ ] Verification tool used for curriculum examples
- [ ] Curriculum-specific prompts created
- [ ] Verification failures handled appropriately
- [ ] Tests pass

---

### Task 6.2: Implement Curriculum Claim Extraction

**Size:** Medium
**Priority:** Low (Deferrable)
**Dependencies:** Task 6.1

**Description:** Create curriculum-specific claim extraction that finds verifiable mathematical claims in curriculum examples and practice scenarios.

**Technical Requirements:**
- Extract moves from practice scenario examples
- Handle curriculum-specific structure
- Skip conceptual/strategic sections
- Focus on concrete move analysis examples

**Implementation:**

```typescript
// lib/groundTruth/postVerification.ts (new function)

export function extractCurriculumVerifiableClaims(
  curriculum: CurriculumOutput
): VerifiableClaim[] {
  // Implementation deferred
  // Similar to drill claim extraction but for curriculum structure
  return []
}
```

**Acceptance Criteria:**
- [ ] Claims extracted from curriculum examples
- [ ] Conceptual sections skipped
- [ ] Move analysis examples verified
- [ ] Tests pass

---

### Task 6.3: Update Curriculum Inngest Job with Verification

**Size:** Medium
**Priority:** Low (Deferrable)
**Dependencies:** Task 6.1, Task 6.2

**Description:** Add verification phase to curriculum generation Inngest job, similar to drill series.

**Technical Requirements:**
- Load ground truth config
- Pass to curriculum generator
- Add verification phase
- Handle blocking on failure
- Save verification details

**Implementation:**

```typescript
// lib/inngest-functions.ts - curriculum generation (modified)

// Similar modifications to drill series generation:
// 1. Load ground truth config in prerequisites
// 2. Pass to generator
// 3. Add VERIFYING_CONTENT phase
// 4. Extract and verify claims
// 5. Block on failure or mark VERIFIED

// Details deferred until Phase 6 implementation
```

**Acceptance Criteria:**
- [ ] Config loaded and passed
- [ ] Verification phase added
- [ ] Claims verified
- [ ] Failures handled
- [ ] Tests pass

---

## Phase 7: Polish & Edge Cases

### Task 7.1: Add Engine Health Monitoring

**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.5

**Description:** Create monitoring and alerting for ground truth engine health and availability.

**Technical Requirements:**
- Periodic health checks
- Log health status
- Alert on consecutive failures
- Display engine status in project settings
- Cache health check results briefly

**Implementation:**

```typescript
// lib/groundTruth/monitoring.ts

import { checkEngineAvailability } from './config'

interface EngineHealthStatus {
  engineUrl: string
  isHealthy: boolean
  lastChecked: Date
  consecutiveFailures: number
}

const healthCache = new Map<string, EngineHealthStatus>()
const HEALTH_CHECK_INTERVAL_MS = 60 * 1000 // 1 minute

export async function getEngineHealth(engineUrl: string): Promise<EngineHealthStatus> {
  const cached = healthCache.get(engineUrl)
  const now = new Date()

  // Return cached if recent
  if (cached && (now.getTime() - cached.lastChecked.getTime()) < HEALTH_CHECK_INTERVAL_MS) {
    return cached
  }

  // Perform health check
  const isHealthy = await checkEngineAvailability(engineUrl)

  const status: EngineHealthStatus = {
    engineUrl,
    isHealthy,
    lastChecked: now,
    consecutiveFailures: isHealthy
      ? 0
      : (cached?.consecutiveFailures || 0) + 1
  }

  healthCache.set(engineUrl, status)

  // Alert if multiple consecutive failures
  if (status.consecutiveFailures >= 3) {
    console.error(`[Ground Truth] Engine unhealthy for ${status.consecutiveFailures} consecutive checks: ${engineUrl}`)
    // Future: Send alert notification
  }

  return status
}
```

**Acceptance Criteria:**
- [ ] Health checks performed periodically
- [ ] Results cached to avoid excessive checks
- [ ] Consecutive failures tracked
- [ ] Alerts logged for unhealthy engines
- [ ] Health status queryable by UI

---

### Task 7.2: Add Engine Status to Project Settings

**Size:** Small
**Priority:** Low
**Dependencies:** Task 7.1

**Description:** Display ground truth engine health status in project settings UI.

**Technical Requirements:**
- Show green/red indicator for engine health
- Display last checked timestamp
- Show consecutive failure count
- Auto-refresh periodically
- Manual refresh button

**Implementation:**

```typescript
// components/settings/EngineHealthIndicator.tsx

'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EngineHealthIndicator({ engineUrl }: { engineUrl: string }) {
  const [health, setHealth] = useState<EngineHealthStatus | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function checkHealth() {
    setIsRefreshing(true)
    const response = await fetch(`/api/ground-truth/health?engineUrl=${encodeURIComponent(engineUrl)}`)
    const data = await response.json()
    setHealth(data)
    setIsRefreshing(false)
  }

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [engineUrl])

  if (!health) return null

  return (
    <div className="flex items-center gap-2">
      {health.isHealthy ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
      <span className="text-sm">
        {health.isHealthy ? 'Engine healthy' : `Engine unavailable (${health.consecutiveFailures} failures)`}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={checkHealth}
        disabled={isRefreshing}
      >
        <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
      </Button>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Health indicator shows status
- [ ] Auto-refreshes periodically
- [ ] Manual refresh works
- [ ] Consecutive failures shown
- [ ] Last checked timestamp visible

---

### Task 7.3: Implement Graceful Degradation for Engine Unavailability

**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.4

**Description:** Handle scenarios where the engine becomes unavailable during generation or verification.

**Technical Requirements:**
- Clear error messages for engine unavailability
- Don't allow generation to start if engine is down
- Handle mid-generation engine failures
- Provide user guidance on next steps
- Log errors for debugging

**Implementation:**

```typescript
// lib/groundTruth/errorHandling.ts

export class GroundTruthEngineError extends Error {
  constructor(
    message: string,
    public readonly engineUrl: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'GroundTruthEngineError'
  }

  getUserMessage(): string {
    return `The ground truth engine at ${this.engineUrl} is currently unavailable. ` +
      `Content generation has been blocked to ensure accuracy. Please try again later or ` +
      `disable content validation in project settings if you need to generate content immediately.`
  }
}

// Use in generator:
try {
  const engineAvailable = await checkEngineAvailability(config.engineUrl)
  if (!engineAvailable) {
    throw new GroundTruthEngineError(
      'Engine health check failed',
      config.engineUrl
    )
  }
} catch (error) {
  if (error instanceof GroundTruthEngineError) {
    // Log and show user-friendly message
    console.error(`[Ground Truth] ${error.message}`, error)
    throw new GroundTruthUnavailableError(error.getUserMessage())
  }
  throw error
}
```

**Acceptance Criteria:**
- [ ] Clear error messages for users
- [ ] Generation blocked when engine down
- [ ] Mid-generation failures handled
- [ ] Guidance provided to users
- [ ] Errors logged for debugging

---

### Task 7.4: Add Cache Warming Script

**Size:** Small
**Priority:** Low
**Dependencies:** Task 2.4

**Description:** Create a script to pre-warm the cache with all 21 opening roll responses.

**Technical Requirements:**
- Query engine for all opening rolls (1-1 through 6-6)
- Store results in cache
- Run as one-time setup or cron job
- Handle failures gracefully
- Log progress

**Implementation:**

```typescript
// scripts/warmGroundTruthCache.ts

import { executeVerifyBackgammonMove } from '@/lib/groundTruth/executor'

const OPENING_ROLLS = [
  '1-1', '1-2', '1-3', '1-4', '1-5', '1-6',
  '2-2', '2-3', '2-4', '2-5', '2-6',
  '3-3', '3-4', '3-5', '3-6',
  '4-4', '4-5', '4-6',
  '5-5', '5-6',
  '6-6'
]

async function warmCache(engineUrl: string) {
  console.log(`Warming cache for ${OPENING_ROLLS.length} opening rolls...`)

  let succeeded = 0
  let failed = 0

  for (const roll of OPENING_ROLLS) {
    try {
      console.log(`Fetching ${roll}...`)
      await executeVerifyBackgammonMove({
        position_type: 'opening',
        dice_roll: roll,
        context: 'Cache warming'
      }, engineUrl)
      succeeded++
    } catch (error) {
      console.error(`Failed to fetch ${roll}:`, error)
      failed++
    }
  }

  console.log(`Cache warming complete: ${succeeded} succeeded, ${failed} failed`)
}

// Run with: npx tsx scripts/warmGroundTruthCache.ts
const ENGINE_URL = process.env.GNU_BG_ENGINE_URL || 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'
warmCache(ENGINE_URL)
```

**Acceptance Criteria:**
- [ ] Script queries all 21 opening rolls
- [ ] Results cached in database
- [ ] Progress logged
- [ ] Failures handled gracefully
- [ ] Can run as one-time or scheduled

---

### Task 7.5: Update Documentation

**Size:** Medium
**Priority:** High
**Dependencies:** All Phase 1-5 tasks

**Description:** Update project documentation with ground truth validation feature.

**Technical Requirements:**
- Add section to CLAUDE.md
- Create developer guide
- Update user-facing help text
- Document API endpoints
- Add troubleshooting guide

**Implementation:**

```markdown
# Updates to .claude/CLAUDE.md

## Ground Truth Content Validation

**CRITICAL for teaching artifact generation:**

The system supports mathematical ground truth validation for domains with objective answers (backgammon, chess, poker). The LLM actively queries domain-specific engines during content creation via OpenAI function calling.

**Key Components:**
- `lib/groundTruth/` - Core validation infrastructure
- `verify_backgammon_move` tool - OpenAI function for engine queries
- Post-verification pipeline - Safety net after generation
- Response caching - Two-tier (memory + database)

**How it works:**

1. **Pre-generation check:** Verify engine is available
2. **Function calling mode:** LLM calls verification tool before making mathematical claims
3. **Post-verification:** Extract all claims and batch verify
4. **Block on failure:** Artifact marked NEEDS_REVIEW if claims fail
5. **Regeneration:** User can regenerate failed content

**Enabling for a project:**
1. Navigate to project settings
2. Toggle "Use for Content Validation" for an assessment
3. Future drill/curriculum generation will verify claims

**Verification Status:**
- VERIFIED - All claims checked and correct
- NEEDS_REVIEW - Some claims failed, blocked
- UNVERIFIED - Generated without validation
- FAILED - Verification process error

**Developer Guide:** `developer-guides/08-ground-truth-validation-guide.md`

---

# New file: developer-guides/08-ground-truth-validation-guide.md

# Ground Truth Content Validation - Developer Guide

## Overview

This guide covers the ground truth content validation system for teaching artifacts.

## Architecture

[Full architecture details from spec]

## Implementation Details

[Code examples and patterns]

## Testing

[Testing strategies and examples]

## Troubleshooting

[Common issues and solutions]
```

**Acceptance Criteria:**
- [ ] CLAUDE.md updated with ground truth section
- [ ] Developer guide created
- [ ] User help text added to UI
- [ ] API endpoints documented
- [ ] Troubleshooting guide complete

---

### Task 7.6: Create E2E Tests

**Size:** Large
**Priority:** Medium
**Dependencies:** All Phase 1-5 tasks

**Description:** Create comprehensive E2E tests for the ground truth validation flow.

**Technical Requirements:**
- Test enabling validation in settings
- Test verified generation flow
- Test failed verification flow
- Test regeneration
- Mock engine responses
- Test cache behavior
- Test error scenarios

**Implementation:**

```typescript
// e2e/ground-truth-validation.spec.ts

import { test, expect } from '@playwright/test'

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
    // Set up mock engine to return incorrect answer
    await mockEngineWithIncorrectAnswer(page)

    // Generate drills
    await page.goto('/projects/test-project/guru')
    await page.getByRole('button', { name: 'Generate Drill Series' }).click()

    // Verify blocked state
    await expect(page.getByText('Needs Review')).toBeVisible()

    // Open details modal
    await page.getByRole('button', { name: /Needs Review/ }).click()

    // Verify modal content
    await expect(page.getByText('claims failed verification')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Regenerate Failed Drills Only' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Regenerate Entire Series' })).toBeVisible()
  })

  // Purpose: Verify regeneration works
  test('should successfully regenerate failed content', async ({ page }) => {
    // Start with failed artifact
    await setupFailedArtifact(page)

    // Open verification modal
    await page.getByRole('button', { name: /Needs Review/ }).click()

    // Trigger regeneration
    await page.getByRole('button', { name: 'Regenerate Entire Series' }).click()

    // Verify regeneration starts
    await expect(page.getByText('Generating')).toBeVisible()

    // Wait for completion
    await expect(page.getByText('Verified')).toBeVisible({ timeout: 60000 })
  })

  // Purpose: Verify engine unavailable blocks generation
  test('should block generation when engine is unavailable', async ({ page }) => {
    // Mock engine as unavailable
    await mockEngineUnavailable(page)

    // Enable validation
    await page.goto('/projects/test-project/settings')
    await page.getByRole('switch', { name: 'Use for Content Validation' }).click()

    // Try to generate
    await page.goto('/projects/test-project/guru')
    await page.getByRole('button', { name: 'Generate Drill Series' }).click()

    // Verify error shown
    await expect(page.getByText(/engine is unavailable/i)).toBeVisible()
  })
})
```

**Acceptance Criteria:**
- [ ] E2E test for verified generation passes
- [ ] E2E test for failed verification passes
- [ ] E2E test for regeneration passes
- [ ] E2E test for engine unavailable passes
- [ ] Mock engine responses work correctly
- [ ] Tests clean up after themselves
- [ ] Tests run reliably in CI

---

## Summary Statistics

**Total Tasks:** 39
- Phase 1 (Data Model & Configuration): 5 tasks
- Phase 2 (Function Calling Infrastructure): 5 tasks
- Phase 3 (Drill Generation Integration): 4 tasks
- Phase 4 (Post-Verification Pipeline): 6 tasks
- Phase 5 (UI & Regeneration): 5 tasks
- Phase 6 (Curriculum Extension - Deferrable): 3 tasks
- Phase 7 (Polish & Edge Cases): 6 tasks

**Size Distribution:**
- Small: 12 tasks
- Medium: 16 tasks
- Large: 6 tasks

**Priority Distribution:**
- High: 22 tasks
- Medium: 11 tasks
- Low: 6 tasks

**Critical Path:**
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 7.5 (Documentation)

**Deferrable:**
All of Phase 6 (Curriculum Extension) can be implemented after Phase 5 is complete and tested.

---

## Notes for Implementation

1. **Start with Phase 1** to establish database foundation
2. **Phase 2 builds infrastructure** that all subsequent phases depend on
3. **Phase 3 is the core value** - drill generation with verification
4. **Phase 4 adds safety net** - post-verification catches anything function calling missed
5. **Phase 5 completes user experience** - UI and regeneration
6. **Phase 6 is optional** - can defer curriculum validation until drill validation is proven
7. **Phase 7 adds polish** - monitoring, documentation, edge cases

**Testing Strategy:**
- Unit tests as you go (built into each task)
- Integration tests after Phase 4
- E2E tests after Phase 5
- Load/performance tests optional

**Deployment Strategy:**
- Can deploy incrementally after each phase
- Feature flag recommended for initial rollout
- Phase 1-2 can deploy without user-facing changes
- Phase 3-5 should deploy together for cohesive UX
