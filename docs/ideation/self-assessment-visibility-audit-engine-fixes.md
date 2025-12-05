# Self-Assessment System: Board Visibility, Audit Trails & Engine Integration Fixes

**Slug:** self-assessment-visibility-audit-engine-fixes
**Author:** Claude Code
**Date:** 2025-11-17
**Branch:** fix/self-assessment-visibility-audit-engine
**Related:**
- `docs/task-dossiers/self-assessment-fixes.md`
- `drill-mode-extraction-package/BUGFIX_SYNTHESIS_BOARD_VISIBILITY_AND_AUDIT_TRAILS.md`

---

## 1) Intent & Assumptions

**Task brief:** Fix three critical issues in the guru self-assessment system:
1. Guru says it cannot see the board position (visibility issue)
2. Context audit trail is generated as LLM text instead of extracted from API metadata (wrong pattern)
3. Ground truth section fails to display GNU Backgammon engine results (integration issue)

**Assumptions:**
- The reference implementation in `drill-mode-extraction-package/` represents the correct patterns
- GNU Backgammon engine at Heroku endpoint is functional (may need wake-up time)
- Extended thinking is available on Claude Sonnet 4.5 model
- In-memory audit storage is acceptable for MVP (not production-ready)
- ASCII board representation is currently static (opening position only)

**Out of scope:**
- Dynamic board positions beyond opening position
- Persistent audit trail storage in database
- Redis/distributed caching for production scale
- Token cost optimization beyond basic calculations
- Extended hint system from reference implementation
- User-configurable thinking budget
- Board position editor

---

## 2) Pre-reading Log

- `docs/task-dossiers/self-assessment-fixes.md`: User's bug report with 3 specific issues
- `drill-mode-extraction-package/BUGFIX_SYNTHESIS_BOARD_VISIBILITY_AND_AUDIT_TRAILS.md`: Correct patterns for board injection and audit extraction (~560 lines)
- `lib/assessment/contextComposer.ts`: **ROOT CAUSE** - diceRoll parameter received but never used meaningfully; prompts AI to fabricate audit info (lines 36-40)
- `app/api/projects/[id]/assessment/chat/route.ts`: Missing extended thinking enablement; no audit trail extraction
- `components/assessment/AssessmentClient.tsx`: Renders ASCII board locally but doesn't send to AI; no audit UI
- `lib/assessment/backgammonEngine.ts`: Decent defensive parsing but lacks detailed logging
- `lib/assessment/types.ts`: OPENING_POSITION constant exists and is correct
- `lib/assessment/asciiBoard.ts`: renderOpeningBoard() works for static display

---

## 3) Codebase Map

**Primary components/modules:**
- `/lib/assessment/contextComposer.ts` - System prompt composition (ISSUE 1 & 2)
- `/app/api/projects/[id]/assessment/chat/route.ts` - Chat API endpoint (ISSUE 2)
- `/lib/assessment/backgammonEngine.ts` - GNU engine integration (ISSUE 3)
- `/components/assessment/AssessmentClient.tsx` - Main UI component (all issues)
- `/app/api/projects/[id]/assessment/ground-truth/route.ts` - Ground truth API (ISSUE 3)

**Shared dependencies:**
- `@ai-sdk/anthropic` - Anthropic provider for Vercel AI SDK
- `ai` package - streamText, CoreMessage types
- `@/lib/db` - Prisma client for context layers
- `zod` - Request validation schemas

**Data flow:**
```
Frontend Input → API Route → Context Composer → System Prompt → Claude Model
     ↓                                                              ↓
ASCII Board (local)                                        AI Response (no board knowledge)
     ↓
Ground Truth Request → GNU Engine → Response Parsing → Display
```

**Feature flags/config:**
- `SelfAssessmentConfig.isEnabled` - Enables/disables feature
- `SelfAssessmentConfig.engineUrl` - Configurable engine URL

**Potential blast radius:**
- Context layer composition affects all chat interactions
- Audit trail changes require new API endpoints and storage
- Engine retry logic affects response times
- Extended thinking adds cost and latency

---

## 4) Root Cause Analysis

### Issue 1: Board Visibility

**Repro steps:**
1. Navigate to assessment page
2. Enter dice roll "3-1"
3. Click "Set Problem" (ASCII board renders)
4. Click "Ask Guru"
5. Observe: Guru says "I cannot see the board position"

**Observed vs Expected:**
- **Observed:** AI generates generic response without position-specific analysis
- **Expected:** AI references specific checker positions and recommends moves based on board state

**Evidence:**
- `contextComposer.ts:32-33` - Only outputs `"Black to play: ${diceRoll}"` as generic text
- `contextComposer.ts:12` - `diceRoll` parameter received but never used for board data
- `chat/route.ts:27` - Calls composer but gets incomplete context
- ASCII board only rendered in frontend (`AssessmentClient.tsx:170`), never in system prompt

**Root-cause hypotheses:**
- **95% confident:** System prompt lacks actual board state data - AI literally cannot see the position
- **5%:** AI hallucinating despite having data (unlikely given explicit "cannot see" statement)

**Decision:** Board state data must be injected into system prompt. The AI receives generic text only.

---

### Issue 2: Audit Trail Pattern

**Repro steps:**
1. Ask guru for move recommendation
2. Observe: AI response includes "Context Audit Details" section at bottom
3. Note: Information appears fabricated, not real API metadata

**Observed vs Expected:**
- **Observed:** AI generates audit info as part of text response (fake data)
- **Expected:** Real usage tokens, reasoning traces extracted from API metadata, displayed separately

**Evidence:**
- `contextComposer.ts:36-40` - Explicitly instructs AI to output audit section
- `chat/route.ts:49-52` - `streamText()` called without extended thinking options
- No `result.usage` or `result.reasoning` promise extraction
- No message ID generation or correlation
- Reference shows: `result.reasoning.then(...)` pattern for REAL data

**Root-cause hypotheses:**
- **100% confident:** Wrong implementation pattern - prompting AI to fabricate vs extracting API metadata

**Decision:** Remove audit instructions from prompt; enable extended thinking; extract real data from promises.

---

### Issue 3: GNU Backgammon Engine

**Repro steps:**
1. Set dice roll "3-1"
2. Ask guru (or skip)
3. Click "Check Answer"
4. Observe: Ground truth section empty or error displayed

**Observed vs Expected:**
- **Observed:** No moves displayed, possible error message
- **Expected:** List of 5-10 ranked moves with equity values

**Evidence:**
- `backgammonEngine.ts:42` - Defensive parsing for `data.plays || data.moves`
- `backgammonEngine.ts:30` - Generic error handling without detailed logging
- No request/response logging to diagnose actual issue
- No retry logic for Heroku dyno cold starts (30+ second wake-up)
- Multiple possible failure points: network, parsing, CORS, timeout

**Root-cause hypotheses:**
- **40%:** Heroku dyno sleeping, request times out
- **30%:** Response structure mismatch (different field names)
- **20%:** Network/timeout issues without proper handling
- **10%:** CORS or authentication issues

**Decision:** Add comprehensive logging first to identify actual issue, then add retry logic.

---

## 5) Research

### Potential Solutions

#### Issue 1: Board Visibility

**Solution A: Structured JSON Only**
- **Description:** Inject board state as JSON object in system prompt
- **Pros:** Token-efficient (~150 tokens), highest AI accuracy, easy parsing
- **Cons:** Less human-readable for debugging
- **Estimated effort:** 30 minutes
- **Token impact:** +150 tokens/request

**Solution B: ASCII Art Only**
- **Description:** Include rendered ASCII board in system prompt
- **Pros:** Human-readable, visual representation
- **Cons:** LLMs struggle with spatial reasoning from ASCII (~200 tokens)
- **Estimated effort:** 20 minutes
- **Token impact:** +200 tokens/request

**Solution C: Hybrid (JSON + ASCII) [RECOMMENDED]**
- **Description:** Include both structured data AND visual representation
- **Pros:** Maximum clarity for AI, easy debugging, redundancy
- **Cons:** More tokens (~350)
- **Estimated effort:** 45 minutes
- **Token impact:** +350 tokens/request
- **Cost impact:** ~$0.001/request (negligible)

**Recommendation:** Solution C provides best accuracy with minimal cost impact.

---

#### Issue 2: Audit Trail

**Solution A: In-Memory Store (MVP)**
- **Description:** Store audit data in Map, extract from API promises, serve via endpoint
- **Pros:** Simple, fast, no infrastructure changes
- **Cons:** Lost on server restart, not production-ready
- **Estimated effort:** 2-3 hours
- **Components:** auditStore.ts, audit API endpoint, frontend modal

**Solution B: Database Storage**
- **Description:** Persist audit trails in PostgreSQL via Prisma
- **Pros:** Permanent, queryable, survives restarts
- **Cons:** Schema migration required, more complex
- **Estimated effort:** 4-5 hours
- **Components:** Schema migration, model creation, API endpoints

**Solution C: Skip Audit Trail (Minimal)**
- **Description:** Just remove the fabricated audit instructions
- **Pros:** Fastest, fixes the incorrect pattern
- **Cons:** No audit visibility, loses debugging capability
- **Estimated effort:** 10 minutes

**Recommendation:** Solution A for MVP with clear path to Solution B for production.

---

#### Issue 3: GNU Engine Integration

**Solution A: Comprehensive Logging**
- **Description:** Log all request/response details to diagnose issue
- **Pros:** Identifies actual problem, essential first step
- **Cons:** Verbose logs
- **Estimated effort:** 30 minutes

**Solution B: Retry with Exponential Backoff**
- **Description:** Retry failed requests with increasing delays
- **Pros:** Handles Heroku wake-up, transient failures
- **Cons:** Slower on failures (up to 30+ seconds)
- **Estimated effort:** 45 minutes

**Solution C: Timeout Handling**
- **Description:** Add AbortController with configurable timeout
- **Pros:** Prevents hanging requests, better UX
- **Cons:** May fail on slow engine responses
- **Estimated effort:** 20 minutes

**Solution D: Health Check Endpoint**
- **Description:** Pre-flight check to verify engine availability
- **Pros:** Proactive error detection, better UX
- **Cons:** Additional network request
- **Estimated effort:** 30 minutes

**Recommendation:** Solutions A + B + C combined. Logging first to diagnose, then resilience.

---

### Implementation Priority

1. **Issue 1 (Board Visibility)** - 45 minutes - **CRITICAL**
   - Blocks entire feature functionality
   - Root cause is clear and fix is straightforward
   - Immediate user impact

2. **Issue 3 (Engine Integration)** - 2 hours - **HIGH**
   - Add logging FIRST to diagnose actual issue
   - May reveal related problems
   - Blocks assessment validation

3. **Issue 2 (Audit Trail)** - 3-4 hours - **MEDIUM**
   - More infrastructure changes
   - Nice-to-have for debugging
   - Can be phased (remove bad pattern first, add good pattern later)

---

## 6) Clarification

**Clarifications needed from user:**

1. **Audit Trail Persistence:** Should audit trails be stored in-memory (MVP, lost on restart) or database (production-ready, requires migration)?
   - In-memory: Faster implementation, good for development
   - Database: Persistent, queryable, production-ready

2. **Extended Thinking Budget:** What token budget for Claude's extended thinking? (Minimum 1024, recommend 5000)
   - Higher budget = more detailed reasoning traces but higher cost
   - Lower budget = cheaper but less visibility into AI reasoning

3. **Engine Retry Policy:** How many retries for GNU Backgammon engine? (Recommend 3 with exponential backoff)
   - More retries = higher success rate but longer wait times
   - Fewer retries = faster failure but may miss transient issues

4. **Scope of Board Representation:** Should we support only opening position (current), or plan for dynamic positions?
   - Opening only: Simpler, matches current scope
   - Dynamic: More complex, requires board state passing from frontend

5. **Model Selection:** Continue with Claude Sonnet 4.5 or switch to 3.7 Sonnet (reference uses 3.7)?
   - 4.5: Latest model, potentially better reasoning
   - 3.7: Proven working in reference implementation

6. **Cost Tracking Accuracy:** Is rough token estimation (length/4) acceptable, or need proper tokenizer?
   - Rough: Simpler, ~80% accurate
   - Proper: Requires tiktoken-like library, more complexity

---

## 7) Files to Modify

### Issue 1: Board Visibility
- **Modify:** `/lib/assessment/contextComposer.ts`
  - Add `composeBoardStatePrompt()` function
  - Inject board state + ASCII into system prompt
  - Remove lines 36-40 (audit instructions)

### Issue 2: Audit Trail (if approved)
- **Modify:** `/app/api/projects/[id]/assessment/chat/route.ts`
  - Enable extended thinking via providerOptions
  - Generate message ID
  - Extract usage and reasoning promises
  - Add x-message-id header to response

- **Create:** `/lib/assessment/auditStore.ts`
  - In-memory Map for audit data
  - CRUD functions for audit trails
  - Cleanup function for old entries

- **Create:** `/app/api/projects/[id]/assessment/audit/[messageId]/route.ts`
  - GET endpoint for retrieving audit data
  - Returns usage, reasoning, costs

- **Modify:** `/components/assessment/AssessmentClient.tsx`
  - Capture x-message-id from response headers
  - Associate audit ID with message
  - Add "View Audit Trail" button
  - Implement audit modal component

### Issue 3: Engine Integration
- **Modify:** `/lib/assessment/backgammonEngine.ts`
  - Add comprehensive request/response logging
  - Add AbortController timeout (30s)
  - Add retry logic with exponential backoff
  - Improve response structure validation

- **Modify:** `/app/api/projects/[id]/assessment/ground-truth/route.ts`
  - Use retry-enabled function
  - Add detailed error responses with debug info
  - Include suggestions for common failures

- **Create (optional):** `/app/api/projects/[id]/assessment/engine-health/route.ts`
  - Health check endpoint for engine availability

---

## 8) Risk Assessment

**High Risk:**
- Extended thinking may not be available on Claude 4.5 (need to verify)
- In-memory audit store not suitable for production
- Engine retries add significant latency (up to 30+ seconds)

**Medium Risk:**
- Additional tokens for board state increase costs slightly
- Audit trail extraction patterns may differ from documentation
- Response header access in TextStreamChatTransport needs verification

**Low Risk:**
- Board state injection is straightforward string concatenation
- Logging additions are non-breaking
- Error handling improvements are defensive

---

## 9) Success Criteria

### Issue 1 (Board Visibility)
- AI response includes specific position references ("checkers on the 8-point")
- AI recommends moves with notation ("8/5, 6/5")
- No more "I cannot see the board" statements

### Issue 2 (Audit Trail)
- AI response contains ONLY move recommendation (no audit text)
- Click "View Audit Trail" opens modal with real data
- Token counts are exact numbers (e.g., 1,847), not estimates
- Reasoning traces show actual Claude thinking process

### Issue 3 (Engine Integration)
- Best moves display with equity values after clicking "Check Answer"
- Detailed error messages when engine fails
- Server logs show request/response data for debugging
- Retry logic handles Heroku wake-up gracefully

---

## 10) Next Steps

1. **User Decision:** Clarify the 6 items in Clarification section
2. **Phase 1:** Implement Issue 1 (Board Visibility) - 45 minutes
3. **Phase 2:** Implement Issue 3 (Engine Integration) - 2 hours
4. **Phase 3:** Implement Issue 2 (Audit Trail) - 3-4 hours
5. **Testing:** E2E tests for each fix
6. **Documentation:** Update developer guide with new patterns

---

## Appendix: Quick Reference

### Code Patterns from Reference

**Board Injection Pattern:**
```typescript
let systemPrompt = await composeBaseContext()
systemPrompt += '\n\n' + composeBoardStatePrompt(drillContext)
```

**Audit Extraction Pattern:**
```typescript
const result = streamText({
  model,
  messages,
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 5000 }
    }
  }
})

Promise.all([result.reasoning, result.usage])
  .then(([reasoning, usage]) => {
    storeAuditTrail({ messageId, usage, reasoning })
  })
```

**Response with Message ID:**
```typescript
return result.toUIMessageStreamResponse({
  headers: { 'x-message-id': messageId }
})
```
