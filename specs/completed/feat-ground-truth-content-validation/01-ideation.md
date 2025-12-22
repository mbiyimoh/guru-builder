# Ground Truth Content Validation

**Slug:** feat-ground-truth-content-validation
**Author:** Claude Code
**Date:** 2025-12-10
**Branch:** preflight/feat-ground-truth-content-validation
**Related:** `specs/feat-self-assessment-system.md`, `specs/feat-self-assessment-library-architecture.md`

---

## 1) Intent & Assumptions

- **Task brief:** Integrate mathematical ground truth sources (like the GNU Backgammon engine) into the curriculum and drill generation workflow, ensuring AI-generated educational content is validated against authoritative domain-specific sources before being finalized. The LLM should actively query the ground truth engine during content creation via function calling, with post-generation verification as a safety net.

- **Assumptions:**
  - Projects using this feature already have a working AssessmentDefinition with an engine URL configured
  - The ground truth engine (e.g., GNU Backgammon MCP server) is available and responsive
  - Function calling is supported by the generation model (GPT-4o supports this)
  - Content that requires mathematical accuracy can be identified programmatically
  - The backgammon engine can handle the query volume during generation

- **Out of scope:**
  - Generic "ground truth source" interface for chess/poker/etc (backgammon-first)
  - Pre-computing entire canonical corpus upfront
  - Real-time streaming verification during user-facing drill sessions
  - Multi-engine validation (one engine per project for now)
  - Automatic corpus expansion based on generated content

---

## 2) Pre-reading Log

- `prisma/schema.prisma` (lines 224-257): AssessmentDefinition and ProjectAssessment models - existing library architecture for assessment engines
- `lib/assessment/backgammonEngine.ts`: Working MCP server integration with retry logic and response parsing
- `lib/inngest-functions.ts` (lines 587-730): 5-phase drill generation pipeline - extension point for verification
- `lib/guruFunctions/prompts/drillDesignerPrompt.ts`: Current drill prompt has no ground truth awareness
- `lib/guruFunctions/generators/drillDesigner.ts`: Uses OpenAI structured outputs, no function calling currently
- `app/api/projects/[id]/assessment/ground-truth/route.ts`: Existing endpoint for engine queries
- `lib/teaching/types.ts`: Type consolidation pattern for shared interfaces

---

## 3) Codebase Map

### Primary Components/Modules

| Component | Path | Role |
|-----------|------|------|
| Drill Generator | `lib/guruFunctions/generators/drillDesigner.ts` | GPT-4o generation, needs function calling |
| Curriculum Generator | `lib/guruFunctions/generators/curriculumGenerator.ts` | GPT-4o generation, needs function calling |
| Inngest Jobs | `lib/inngest-functions.ts` | Orchestration, add verification phase |
| Backgammon Engine | `lib/assessment/backgammonEngine.ts` | Ground truth queries |
| Assessment Models | `prisma/schema.prisma` | Add validation flags |

### Shared Dependencies

- `lib/assessment/types.ts` - BackgammonMove, BackgammonResponse types
- `lib/guruFunctions/schemas/` - Zod schemas for structured outputs
- `lib/teaching/types.ts` - Prompt configuration types

### Data Flow

```
User triggers drill generation
    ↓
Inngest job starts (LOADING_PREREQUISITES)
    ↓
Check if project has ground truth validation enabled
    ↓
If enabled: Switch to function-calling mode
    ↓
LLM generates content, calling verifyMove() tool as needed
    ↓
Post-generation: Extract all position/move claims
    ↓
Batch verify claims against engine
    ↓
If all pass: COMPLETED
If any fail: BLOCKED → Flag to user → Offer regeneration
```

### Feature Flags/Config

- `ProjectAssessment.useForContentValidation` - Per-project toggle (new field)
- `AssessmentDefinition.canValidateContent` - Engine capability flag (new field)

### Potential Blast Radius

- Drill generation workflow (major change - function calling)
- Curriculum generation workflow (major change - function calling)
- Inngest job definitions (add phases)
- GuruArtifact model (add verification status fields)
- Project settings UI (add toggle)
- Artifact viewer (show verification status)

---

## 4) Root Cause Analysis

N/A - This is a new feature, not a bug fix.

---

## 5) Research

### Potential Solutions

#### Solution 1: OpenAI Function Calling Integration

**Approach:** Modify drill/curriculum generators to use OpenAI's function calling (tool use) feature. Define a `verifyBackgammonMove` function that the LLM can call during generation.

**Pros:**
- LLM actively verifies as it generates
- Self-correcting by design
- Natural integration with existing OpenAI usage
- Audit trail via function call logs

**Cons:**
- Requires restructuring generation from structured outputs to function calling
- More API calls (cost increase)
- LLM might not call the tool consistently without careful prompting
- Latency increase from round-trips

**Technical Notes:**
- OpenAI supports parallel function calls in a single response
- Can combine with structured output for final response
- Tool descriptions are critical for consistent usage

#### Solution 2: Two-Phase Generation (Generate → Verify → Regenerate)

**Approach:** Generate content normally, then run a separate verification pass that extracts claims and validates them. If verification fails, regenerate with corrections.

**Pros:**
- Minimal change to existing generation flow
- Clear separation of concerns
- Can use existing structured output pattern

**Cons:**
- Might generate incorrect content that needs full regeneration
- Claim extraction requires parsing generated content (NLP challenge)
- Potentially wasteful if verification frequently fails

#### Solution 3: Hybrid - Function Calling + Post-Verification

**Approach:** Use function calling during generation (Solution 1) AND run post-verification (Solution 2) as a safety net.

**Pros:**
- Double-check ensures nothing slips through
- Function calling reduces verification failures
- Post-verification catches edge cases
- Most robust approach

**Cons:**
- Most complex implementation
- Highest API call volume
- Longer generation time

### Recommendation

**Solution 3: Hybrid approach** - This aligns with the user's requirement for "verify BEFORE creating and AFTER creating." The function calling ensures the LLM consults ground truth during generation, while post-verification provides a safety net.

**Implementation Order:**
1. Add function calling to drill generator (highest value)
2. Add post-verification phase to Inngest job
3. Add blocking/flagging workflow
4. Extend to curriculum generator
5. Add UI for verification status

---

## 6) Clarifications

### Decided by User

1. **Verification scope:** Just-in-time verification at content creation (not pre-computed corpus)
2. **Failure handling:** Block → Flag to human → Offer regeneration (in that order)
3. **Extensibility:** Backgammon-specific first, generalize later
4. **Integration method:** Function calling (LLM actively queries engine)

### Additional Decisions (Resolved)

5. **Regeneration scope:** Let user choose - present options for entire series, just failing drills, or custom approach

6. **Engine unavailability:** Block entirely. No ground truth source = no content creation. The risk of incorrect content is too high.

7. **Intentional "wrong" moves:** Handle minimally - when a drill intentionally shows a bad move (e.g., "What's wrong with this move?"), the verification should check that the lesson correctly identifies what the player SHOULD have done, not try to verify that an intentionally wrong move is "wrong". Don't over-engineer this edge case.

8. **Caching:** Yes, cache engine responses. Important note: a full "setup" = dice roll + board position (not just dice roll). Opening position is easy because position is always the same, but mid-game scenarios need full position hashing for cache keys.

---

## 7) Architecture Design

### Data Model Changes

```prisma
// Extend existing models

model AssessmentDefinition {
  // ... existing fields ...

  // NEW: Can this engine be used for content validation?
  canValidateContent    Boolean   @default(false)
}

model ProjectAssessment {
  // ... existing fields ...

  // NEW: Use this assessment's engine for content validation?
  useForContentValidation Boolean @default(false)
}

model GuruArtifact {
  // ... existing fields ...

  // NEW: Verification tracking
  verificationStatus    VerificationStatus?  // VERIFIED | NEEDS_REVIEW | UNVERIFIED | FAILED
  verificationDetails   Json?                // { claims: [], failures: [], toolCalls: [] }
  verificationAttempts  Int       @default(0)
  lastVerifiedAt        DateTime?
}

enum VerificationStatus {
  VERIFIED      // All claims verified against ground truth
  NEEDS_REVIEW  // Some claims failed, blocked for human review
  UNVERIFIED    // Generated without verification (engine unavailable)
  FAILED        // Verification process itself failed (error)
}
```

### Function Calling Schema

```typescript
// lib/groundTruth/tools.ts

export const verifyBackgammonMoveTool = {
  type: 'function',
  function: {
    name: 'verify_backgammon_move',
    description: `Query the GNU Backgammon engine to get the mathematically correct best moves for a given position and dice roll.

IMPORTANT: You MUST call this function BEFORE stating that any specific move is "best", "correct", or "optimal".
The engine returns equity-scored moves ranked from best to worst.

Call this whenever you are about to:
- State which move is best for a dice roll
- Create a drill question about correct moves
- Provide feedback saying a move is right or wrong
- Compare two moves in terms of equity`,

    parameters: {
      type: 'object',
      properties: {
        position: {
          type: 'string',
          enum: ['opening', 'custom'],
          description: 'The board position type. Use "opening" for standard opening position.'
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
      required: ['position', 'dice_roll', 'context']
    }
  }
}

// Tool execution handler
export async function executeVerifyBackgammonMove(
  args: { position: string; dice_roll: string; context: string },
  engineUrl: string
): Promise<ToolResult> {
  const [d1, d2] = args.dice_roll.split('-').map(Number) as [number, number]

  const moves = await getBackgammonGroundTruthWithRetry([d1, d2], engineUrl)

  return {
    success: true,
    data: {
      dice_roll: args.dice_roll,
      best_moves: moves.slice(0, 5).map((m, i) => ({
        rank: i + 1,
        move: m.move,
        equity: m.equity,
        is_best: i === 0
      })),
      note: 'Use these verified moves when creating drill content. The #1 ranked move is mathematically best.'
    }
  }
}
```

### Modified Generation Flow

```typescript
// lib/guruFunctions/generators/drillDesigner.ts (modified)

export async function generateDrillSeriesWithVerification(
  params: DrillGeneratorParams,
  groundTruthConfig?: GroundTruthConfig
): Promise<DrillGenerationResult> {

  // If ground truth validation is enabled, use function calling
  if (groundTruthConfig?.enabled) {
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
  let messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  // Agentic loop - keep going until LLM returns final content
  while (true) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: [verifyBackgammonMoveTool],
      tool_choice: 'auto',
      temperature: 0.7
    })

    const choice = response.choices[0]

    // If LLM wants to call tools, execute them
    if (choice.finish_reason === 'tool_calls') {
      const toolResults = await executeToolCalls(choice.message.tool_calls, config.engineUrl)
      toolCalls.push(...toolResults.logs)

      // Add assistant message and tool results to conversation
      messages.push(choice.message)
      messages.push(...toolResults.messages)
      continue
    }

    // If LLM is done, parse the final response
    if (choice.finish_reason === 'stop') {
      const content = parseStructuredOutput(choice.message.content, drillSeriesSchema)

      return {
        content,
        toolCalls,
        verificationDuringGeneration: true
      }
    }
  }
}
```

### Post-Verification Phase

```typescript
// lib/groundTruth/postVerification.ts

interface VerificationClaim {
  drillId: string
  claimType: 'best_move' | 'correct_answer' | 'equity_comparison'
  position: string
  diceRoll: string
  claimedValue: string  // e.g., "8/5 6/5"
  location: string      // e.g., "drill.options[0].text"
}

export async function extractVerifiableClaims(
  drillSeries: DrillSeriesOutput
): Promise<VerificationClaim[]> {
  const claims: VerificationClaim[] = []

  for (const series of drillSeries.series) {
    for (const drill of series.drills) {
      // Extract dice rolls mentioned in scenarios
      const diceMatches = drill.scenario.setup.match(/\b([1-6])-([1-6])\b/g)

      // Extract move references in correct answers
      const moveMatches = extractBackgammonMoves(drill)

      // Build claims for each verifiable assertion
      for (const match of [...(diceMatches || []), ...moveMatches]) {
        claims.push({
          drillId: drill.drillId,
          claimType: 'best_move',
          position: 'opening', // TODO: detect position from context
          diceRoll: match.diceRoll,
          claimedValue: match.move,
          location: match.location
        })
      }
    }
  }

  return claims
}

export async function verifyClaimsAgainstEngine(
  claims: VerificationClaim[],
  engineUrl: string
): Promise<VerificationResult> {
  const results: ClaimResult[] = []

  // Group claims by dice roll to batch requests
  const claimsByRoll = groupBy(claims, c => c.diceRoll)

  for (const [diceRoll, rollClaims] of Object.entries(claimsByRoll)) {
    const [d1, d2] = diceRoll.split('-').map(Number) as [number, number]
    const engineMoves = await getBackgammonGroundTruthWithRetry([d1, d2], engineUrl)

    for (const claim of rollClaims) {
      const isValid = validateClaimAgainstMoves(claim, engineMoves)
      results.push({
        claim,
        isValid,
        engineBestMove: engineMoves[0]?.move,
        engineEquity: engineMoves[0]?.equity
      })
    }
  }

  const failures = results.filter(r => !r.isValid)

  return {
    totalClaims: claims.length,
    verified: results.filter(r => r.isValid).length,
    failed: failures.length,
    failures,
    allPassed: failures.length === 0
  }
}
```

### Inngest Job Modification

```typescript
// In lib/inngest-functions.ts

// Add new phase after SAVING_ARTIFACT
const drillGenerationWithVerification = inngest.createFunction(
  { id: 'drill-series-generation-v2', ... },
  { event: 'guru/generate-drill-series' },
  async ({ event, step }) => {
    // ... existing phases 1-4 ...

    // Phase 5: GENERATING_CONTENT (modified)
    const generationResult = await step.run('generate-with-tools', async () => {
      const groundTruthConfig = await getGroundTruthConfig(projectId)
      return generateDrillSeriesWithVerification(params, groundTruthConfig)
    })

    // Phase 6: POST_VERIFICATION (new)
    if (groundTruthConfig?.enabled) {
      await step.run('update-progress-verifying', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { progressStage: 'VERIFYING_CONTENT' }
        })
      })

      const verificationResult = await step.run('post-verify', async () => {
        const claims = await extractVerifiableClaims(generationResult.content)
        return verifyClaimsAgainstEngine(claims, groundTruthConfig.engineUrl)
      })

      // Phase 7: Handle verification result
      if (!verificationResult.allPassed) {
        await step.run('block-artifact', async () => {
          await prisma.guruArtifact.update({
            where: { id: artifactId },
            data: {
              status: 'BLOCKED',
              verificationStatus: 'NEEDS_REVIEW',
              verificationDetails: {
                toolCallsDuringGeneration: generationResult.toolCalls,
                postVerification: verificationResult,
                failures: verificationResult.failures,
                message: `Verification found ${verificationResult.failed} incorrect claims. Please review and regenerate.`
              }
            }
          })
        })

        // Emit event for notification/UI update
        await step.sendEvent('verification-failed', {
          name: 'guru/verification-failed',
          data: {
            artifactId,
            projectId,
            failures: verificationResult.failures
          }
        })

        return { status: 'BLOCKED', reason: 'verification_failed' }
      }
    }

    // Phase 8: SAVING_ARTIFACT (save as verified)
    await step.run('save-verified-artifact', async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: generationResult.content,
          markdownContent: generateMarkdown(generationResult.content),
          status: 'COMPLETED',
          verificationStatus: groundTruthConfig?.enabled ? 'VERIFIED' : 'UNVERIFIED',
          verificationDetails: groundTruthConfig?.enabled ? {
            toolCallsDuringGeneration: generationResult.toolCalls,
            postVerification: verificationResult,
            verifiedAt: new Date()
          } : null,
          progressStage: null
        }
      })
    })
  }
)
```

### UI Components

```typescript
// components/artifacts/VerificationBadge.tsx

interface VerificationBadgeProps {
  status: VerificationStatus | null
  details?: VerificationDetails
  onRegenerate?: () => void
}

export function VerificationBadge({ status, details, onRegenerate }: VerificationBadgeProps) {
  if (!status) return null

  const configs = {
    VERIFIED: {
      icon: CheckCircle,
      label: 'Verified',
      color: 'text-green-600 bg-green-50',
      description: 'All mathematical claims verified against ground truth'
    },
    NEEDS_REVIEW: {
      icon: AlertTriangle,
      label: 'Needs Review',
      color: 'text-amber-600 bg-amber-50',
      description: `${details?.failures?.length} claims failed verification`
    },
    UNVERIFIED: {
      icon: HelpCircle,
      label: 'Unverified',
      color: 'text-gray-500 bg-gray-50',
      description: 'Generated without ground truth validation'
    },
    FAILED: {
      icon: XCircle,
      label: 'Verification Failed',
      color: 'text-red-600 bg-red-50',
      description: 'Verification process encountered an error'
    }
  }

  const config = configs[status]
  const Icon = config.icon

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1 rounded-full', config.color)}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{config.label}</span>

      {status === 'NEEDS_REVIEW' && onRegenerate && (
        <Button size="sm" variant="outline" onClick={onRegenerate}>
          Regenerate
        </Button>
      )}
    </div>
  )
}
```

---

## 8) Implementation Phases

### Phase 1: Data Model & Configuration (1-2 days)
- Add `canValidateContent` to AssessmentDefinition
- Add `useForContentValidation` to ProjectAssessment
- Add verification fields to GuruArtifact
- Migration script
- UI toggle in project settings

### Phase 2: Function Calling Infrastructure (2-3 days)
- Create `lib/groundTruth/tools.ts` with tool definitions
- Create `lib/groundTruth/executor.ts` for tool execution
- Unit tests for tool execution
- Audit logging for tool calls

### Phase 3: Drill Generation Integration (3-4 days)
- Modify `drillDesigner.ts` to support function calling mode
- Update prompts with verification instructions
- Agentic loop implementation
- Integration tests

### Phase 4: Post-Verification Pipeline (2-3 days)
- Claim extraction logic
- Batch verification against engine
- Update Inngest job with verification phase
- Handle verification failures (blocking, flagging)

### Phase 5: UI & User Experience (2-3 days)
- VerificationBadge component
- Verification details modal
- Regeneration workflow
- Progress stage UI for "Verifying content..."

### Phase 6: Curriculum Extension (2-3 days)
- Apply same pattern to curriculum generator
- Curriculum-specific claim extraction
- Testing

### Phase 7: Polish & Edge Cases (1-2 days)
- Engine unavailability handling
- Rate limiting for engine calls
- Timeout handling
- Documentation

---

## 9) Open Questions for Spec Phase

1. Should we implement a "dry run" mode that shows what would be verified without blocking?
2. Should verification results be visible to users in the drill viewer (e.g., "This answer verified by GNU Backgammon")?
3. How should we handle drills that intentionally show "wrong" moves for learning purposes (e.g., "What's wrong with this move?")?
4. Should we cache engine responses to reduce API calls for repeated dice rolls?
