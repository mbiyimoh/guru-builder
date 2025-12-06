# Research Run Functionality - Complete Guide

**Component:** Full research execution system including TypeScript web search, GPT-4o synthesis, and UI
**Last Updated:** 2025-12-04

## Overview

The Research Run functionality is the core feature of the Guru Builder system. It executes autonomous web research using Tavily API for search and GPT-4o for synthesis, then generates actionable recommendations for improving the knowledge corpus.

## Architecture

```
User clicks "Start Research" in UI
    ↓
NewResearchForm.tsx submits POST /api/research-runs
    ↓
Create ResearchRun (status: PENDING) in database
    ↓
Send Inngest event: "research/requested"
    ↓
┌─────────────────────────────────────────────────────┐
│ researchJob (lib/inngest-functions.ts)              │
│  1. Call executeResearch()                          │
│  2. Execute Tavily web search (TypeScript)          │
│  3. Synthesize findings with GPT-4o                 │
│  4. Return structured ResearchFindings              │
│  5. Save results to DB (status: COMPLETED)          │
│  6. Send "research/completed" event                 │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ recommendationGenerationJob                         │
│  1. Fetch research run + project context            │
│  2. Call OpenAI GPT-4 with structured outputs       │
│  3. Generate ADD/EDIT/DELETE recommendations        │
│  4. Save recommendations to DB                      │
└─────────────────────────────────────────────────────┘
    ↓
User reviews recommendations in UI
```

### CRITICAL: Async Job Race Condition

**Understanding the Event Chain:**

The research workflow uses TWO SEPARATE async jobs connected by events:

1. `researchJob` completes and sets status to COMPLETED (Line 79 in inngest-functions.ts)
2. Then sends `research/completed` event (Line 91)
3. Browser may poll API at this exact moment
4. Browser sees COMPLETED status, refreshes page
5. BUT: `research/completed` event triggers `recommendationGenerationJob` which runs AFTER researchJob completes
6. Recommendations are saved 10-60 seconds AFTER status becomes COMPLETED

**This means:**
- Status can be COMPLETED before recommendations exist in database
- UI must wait for recommendations, not just status change
- ResearchStatusPoller implements this pattern (lines 42-62)

**Pattern for Future Async Workflows:**

When adding new async job chains, ALWAYS:
1. Document the event sequence in this guide
2. Identify what client needs to wait for (final state, not intermediate)
3. Implement polling that checks for final state (e.g., recommendations.total > 0)
4. Add appropriate timeouts with user feedback
5. Use `force-dynamic` rendering on pages that display async results
6. Add `Cache-Control: no-store` headers to polling endpoints

## TypeScript Research Implementation

### Architecture Decision

**Design:** Pure TypeScript implementation using Tavily API for web search and GPT-4o for synthesis.

**Why TypeScript-only:**
- Deployment simplicity: No Python runtime required in production
- Single stack: All code in TypeScript for easier maintenance
- Container-friendly: Works in any Node.js Docker container
- Lazy-loading: API clients initialized on first use (avoids build-time errors)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TAVILY_API_KEY` | Yes | Tavily API key from https://tavily.com |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o synthesis |

### Depth Levels

| Depth | Sources | Content | Search Type | Expected Time |
|-------|---------|---------|-------------|---------------|
| quick | 5 | No | Basic | 5-15 seconds |
| moderate | 10 | Yes (markdown) | Basic | 10-30 seconds |
| deep | 20 | Yes (markdown) | Advanced | 20-60 seconds |

### TypeScript Research Orchestrator

**Location:** `lib/researchOrchestrator.ts`

**Key Function:**
```typescript
export async function executeResearch(options: {
  instructions: string;
  depth?: ResearchDepth;  // "quick" | "moderate" | "deep"
  timeout?: number;       // milliseconds, default 300000
}): Promise<ResearchResult>
```

**Implementation Flow:**

1. **Tavily Search:** Executes web search based on depth configuration
2. **GPT-4o Synthesis:** Generates structured research report from sources
3. **Timeout Handling:** Split timeout between search (50%) and synthesis (50%)

**Key Features:**

1. **Lazy-loaded clients:**
   ```typescript
   // Clients initialized on first use (not at import time)
   function getTavily() {
     if (!_tavily) {
       _tavily = tavily({ apiKey: process.env.TAVILY_API_KEY });
     }
     return _tavily;
   }
   ```

2. **Depth configuration:**
   ```typescript
   const DEPTH_CONFIG = {
     quick: { maxResults: 5, includeRawContent: false, searchDepth: "basic" },
     moderate: { maxResults: 10, includeRawContent: "markdown", searchDepth: "basic" },
     deep: { maxResults: 20, includeRawContent: "markdown", searchDepth: "advanced" },
   };
   ```

3. **Structured synthesis prompt:**
   - Executive Summary
   - Key Findings
   - Detailed Analysis
   - Practical Implications
   - Source Quality Assessment

**Integration Point:**
- Called by `researchJob` in `lib/inngest-functions.ts`
- Results saved to ResearchRun.researchData in database

### Legacy Python Implementation (Deprecated)

The `python/` directory contains the original Python-based research implementation using GPT Researcher. This is kept for reference but is no longer used in production. The Railway deployment does not include Python.

## UI Components

### Research Form Page

**Location:** `app/projects/[id]/research/new/page.tsx`

**Purpose:** Server component page for creating new research runs

**Features:**
- Fetches project details (id, name, description)
- Returns 404 if project doesn't exist
- Breadcrumb navigation back to project
- Renders `NewResearchForm` client component

### NewResearchForm Component

**Location:** `components/research/NewResearchForm.tsx`

**Purpose:** Client component form for configuring research runs

**Features:**

1. **Instructions Input:**
   - Large textarea (6 rows)
   - Character counter
   - Placeholder with example
   - Required field validation

2. **Depth Selection:**
   - Three visual cards: QUICK, MODERATE, DEEP
   - Each shows:
     - Icon and name
     - Time estimate
     - Description of what depth means
   - Selected state: blue border, blue background
   - Hover effects

3. **Info Box:**
   - Explains how research works
   - Lists 4 key steps in process
   - Helps set user expectations

4. **Error Handling:**
   - Error state display (red background)
   - Shows error message from API
   - Non-intrusive error UI

5. **Loading States:**
   - Submit button shows spinner when submitting
   - "Starting Research..." text
   - Disabled state during submission

6. **Form Submission:**
   - POSTs to `/api/research-runs`
   - Sends: projectId, instructions, depth
   - On success: Redirects to project page with router.refresh()
   - On error: Shows error, keeps user on page

### Project Page Research Section

**Location:** `app/projects/[id]/page.tsx` (lines 109-174)

**Features:**

1. **Header with Action Button:**
   - "Start New Research" button always visible
   - Button navigates to `/projects/{id}/research/new`
   - Blue styling matching site theme

2. **Research Run List:**
   - Shows last 5 research runs (ordered by createdAt desc)
   - Each run displays:
     - Instructions (truncated)
     - Depth (lowercase)
     - Recommendation count
     - Created date
     - Status badge (colored by status)
   - Clickable to view run details

3. **Empty State:**
   - Shows when no research runs exist
   - Search icon illustration
   - Encouraging message to start first research
   - Does NOT show button here (button is in header)

## Common Issues and Solutions

### Issue 1: Missing API Key Error

**Symptoms:**
- Research fails immediately with "TAVILY_API_KEY environment variable is not set"
- Or "OPENAI_API_KEY environment variable is not set"

**Solution:**
1. Get a Tavily API key from https://tavily.com (free tier: 1,000 searches/month)
2. Add to local `.env` file:
   ```bash
   TAVILY_API_KEY="tvly-..."
   OPENAI_API_KEY="sk-..."
   ```
3. For production (Railway), add both keys as environment variables

### Issue 2: Research Timeout

**Symptoms:**
- Research fails with "Search timeout" or "Synthesis timeout"
- Happens more often with "deep" research

**Root Cause:**
The timeout is split 50/50 between search and synthesis. Deep research with 20 sources may exceed the default timeout.

**Solution:**
Increase timeout in the research options (default is 300000ms = 5 minutes):
```typescript
// In inngest-functions.ts, increase timeout for deep research
executeResearch({
  instructions,
  depth,
  timeout: depth === 'deep' ? 600000 : 300000,  // 10 min for deep
});
```

### Issue 3: Research Runs Stuck in RUNNING Status

**Symptoms:**
- Status shows RUNNING for > 5 minutes
- No updates in Inngest dashboard
- No error message

**Debugging:**

1. **Check Inngest dashboard:**
   - Visit http://localhost:8288
   - Find the research job
   - Look for step failures or timeouts

2. **Check console logs:**
   - Look for `[Research]` prefixed messages
   - Should see: "Starting research", "Found X sources", "Synthesizing with GPT-4o"

3. **Verify API keys:**
   ```bash
   echo $TAVILY_API_KEY  # Should show tvly-...
   echo $OPENAI_API_KEY  # Should show sk-...
   ```

**Common Causes:**
- API keys not set or invalid
- Network issues
- Timeout too short for depth level

**Solutions:**
- Verify API keys are set correctly
- Check Tavily and OpenAI API status pages
- Increase timeout for deep research

### Issue 4: No Recommendations Generated

**Symptoms:**
- Research completes successfully
- researchData saved to database
- But recommendations table empty for that run

**Debugging:**

1. **Check research/completed event:**
   - Inngest dashboard → Events
   - Verify event was sent
   - Check if recommendationGenerationJob triggered

2. **Check OpenAI API key:**
   ```bash
   echo $OPENAI_API_KEY
   ```

3. **Check recommendation job logs:**
   - Inngest dashboard → Jobs → recommendationGenerationJob
   - Look for OpenAI errors
   - Check if job completed successfully

4. **Verify research data format:**
   ```bash
   # In Prisma Studio or via API
   GET /api/research-runs/[id]
   # Verify researchData is not null and has expected structure
   ```

**Common Causes:**
- OpenAI API key invalid/expired
- researchData is null (research failed but status shows COMPLETED)
- OpenAI structured outputs schema mismatch
- Network/API rate limits

**Solutions:**
- Verify OPENAI_API_KEY is valid: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`
- Check OpenAI API status page
- Review schema in corpusRecommendationGenerator.ts
- Add retry logic for transient errors

### Issue 4a: Race Condition - 0 Recommendations Immediately After Completion

**Symptoms:**
- Research completes successfully (status: COMPLETED)
- Page immediately refreshes but shows 0 recommendations
- Recommendations appear if you manually refresh 30-60 seconds later
- Database inspection shows recommendations DO exist after waiting

**Root Cause:**
This is the ASYNC JOB RACE CONDITION (see Architecture section above):
1. Research job marks status COMPLETED
2. Sends "research/completed" event
3. UI polls, sees COMPLETED, refreshes immediately
4. Recommendation generation job starts AFTER the status update
5. Recommendations saved 10-60 seconds after status change

**Solution:**
ResearchStatusPoller now correctly waits for recommendations after COMPLETED status:

```typescript
// In ResearchStatusPoller.tsx (lines 42-62)
if (newStatus === 'COMPLETED') {
  if (recommendationCount > 0) {
    // Recommendations are ready - refresh page
    router.refresh();
  } else {
    // Keep polling until recommendations appear
    recommendationPollCount.current += 1;
    setProgressMessage('Generating recommendations...');
  }
}
```

**Prevention:**
- Any async job that triggers follow-up jobs must have UI polling that waits for ALL jobs to complete
- Add `force-dynamic` rendering to pages displaying async results
- Add `Cache-Control: no-store` to polling API endpoints
- Document the event chain in this guide

### Issue 5: Tavily "Query is too long" Error

**Symptoms:**
- Research fails immediately with error: "Query is too long. Max query length is 400 characters."
- Happens when research instructions > 400 characters
- Even after GPT optimization step

**Root Cause:**
Tavily API has a strict 400-character limit on search queries. GPT-4o doesn't always follow the 350-character limit precisely when optimizing queries, sometimes returning 500+ character queries.

**Solution (CRITICAL - Already Implemented):**
Always enforce truncation programmatically in `lib/researchOrchestrator.ts:109-112`:

```typescript
const rawOptimizedQuery = completion.choices[0]?.message?.content?.trim() || instructions;

// Always enforce the max length - GPT doesn't always follow the 350 char request precisely
const optimizedQuery = rawOptimizedQuery.slice(0, TAVILY_MAX_QUERY_LENGTH);  // TAVILY_MAX_QUERY_LENGTH = 400
```

**Why This Pattern:**
- Never trust AI to follow character limits precisely
- Always enforce limits programmatically as a safety net
- Better to truncate mid-sentence than fail the entire research run

**Location:** `lib/researchOrchestrator.ts:77-117`

### Issue 6: FK Constraint Violation - "new row violates check constraint recommendation_target_check"

**Symptoms:**
- Research completes successfully
- Recommendation generation job fails with:
  ```
  Error: new row for relation "Recommendation" violates check constraint "recommendation_target_check"
  Detail: Failing row contains (..., , null).
  ```
- Happens specifically with ADD action recommendations

**Root Cause:**
For ADD recommendations, `targetId` is empty string `""` instead of `null`. PostgreSQL check constraints use `IS NULL`, which fails for empty strings. The constraint requires both `contextLayerId` and `knowledgeFileId` to be NULL for ADD actions.

**Solution (CRITICAL - Already Implemented):**
Convert empty strings to null for ADD actions in `lib/inngest-functions.ts:262-283`:

```typescript
await prisma.recommendation.createMany({
  data: recommendationsResult.recommendations.map((rec: CorpusRecommendation, index: number) => {
    // For ADD actions, targetId should always be null (no existing target to reference)
    // For EDIT/DELETE, use targetId but convert empty strings to null
    const effectiveTargetId = rec.action === "ADD" ? null : (rec.targetId || null);

    return {
      contextLayerId: rec.targetType === "LAYER" ? effectiveTargetId : null,
      knowledgeFileId: rec.targetType === "KNOWLEDGE_FILE" ? effectiveTargetId : null,
      // ...
    };
  }),
});
```

**Key Insight:**
Empty string `""` is NOT NULL in PostgreSQL. Always convert empty strings to `null` for nullable FK fields.

**Why This Matters:**
- ADD actions create new items (no existing target to reference)
- EDIT/DELETE actions modify existing items (need targetId)
- Database check constraint enforces this at the DB level
- Application code must ensure correct null handling

**Related:** See `.claude/CLAUDE.md` "Prisma Polymorphic Associations" for the full pattern.

## Testing Research Functionality

### Manual Testing Flow

1. **Start servers:**
   ```bash
   # Terminal 1: Next.js
   PORT=3002 npm run dev

   # Terminal 2: Inngest
   npx inngest-cli dev
   ```

2. **Navigate to project:**
   - Go to http://localhost:3002/projects
   - Click on a project (or create one)

3. **Start research:**
   - Click "Start New Research" button
   - Enter instructions: "Research opening strategies in backgammon"
   - Select depth: MODERATE
   - Click "Start Research"

4. **Monitor progress:**
   - Wait for redirect to project page
   - Click on the research run to see progress page
   - Page auto-updates every 5 seconds when research completes (no manual refresh needed)
   - Or watch Inngest dashboard: http://localhost:8288

5. **Verify results:**
   - Check research run shows COMPLETED status
   - Verify recommendations were generated
   - Check report makes sense for the query

### Automated Testing (Future)

**Unit Tests:**
- `research_agent.py`: Test with mocked GPT Researcher
- `researchOrchestrator.ts`: Test subprocess spawn and JSON parsing
- `NewResearchForm.tsx`: Test form validation and submission

**Integration Tests:**
- Full research flow with POC mode
- Database persistence of results
- Inngest event triggering

**E2E Tests:**
- Complete user flow from form to recommendations
- Error handling scenarios
- Multiple concurrent research runs

## Performance Considerations

### Research Execution Time

**Expected timings:**
- QUICK: 1-3 minutes (5 sources, 2 iterations)
- MODERATE: 5-7 minutes (10 sources, 4 iterations)
- DEEP: 10-15 minutes (20 sources, 6 iterations)

**Factors affecting time:**
- Number of sources to scrape
- Network latency
- Web page load times
- OpenAI API response times

### Resource Usage

**Memory:**
- Python subprocess: ~200-500MB per research run
- Node.js: Minimal overhead (just JSON parsing)

**CPU:**
- Mostly waiting on network I/O
- Python: Light processing for scraping and parsing
- GPT Researcher handles parallelization internally

**Concurrency:**
- Max 5 concurrent research jobs (configured in inngest-functions.ts)
- Prevents API rate limits and resource exhaustion
- Inngest queues additional requests

### Optimization Opportunities

1. **Caching:**
   - Cache research results by instructions hash
   - Expire after 7 days (research goes stale)
   - Saves time and API costs

2. **Progressive Results:**
   - **Current:** Basic auto-refresh (polls every 5 seconds for completion status)
   - **Future:** Stream research findings as they're discovered
   - Update UI with partial results during research (not just on completion)
   - Requires WebSocket or SSE implementation

3. **Parallel Recommendation Generation:**
   - Generate recommendations per category in parallel
   - Requires refactoring OpenAI calls
   - Could reduce latency by 2-3x

## Configuration Reference

### Environment Variables

**Required:**
- `TAVILY_API_KEY` - Tavily API key for web search (https://tavily.com)
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o synthesis
- `DATABASE_URL` - PostgreSQL connection string

### Research Depth Configuration

Edit in `lib/researchOrchestrator.ts` if needed:

```typescript
const DEPTH_CONFIG: Record<ResearchDepth, TavilySearchConfig> = {
  quick: {
    maxResults: 5,
    includeRawContent: false,
    searchDepth: "basic",
  },
  moderate: {
    maxResults: 10,
    includeRawContent: "markdown",
    searchDepth: "basic",
  },
  deep: {
    maxResults: 20,
    includeRawContent: "markdown",
    searchDepth: "advanced",
  },
};
```

### Inngest Job Configuration

Edit in `lib/inngest-functions.ts` if needed:

```typescript
export const researchJob = inngest.createFunction(
  {
    id: "research-job",
    concurrency: {
      limit: 5,  // Max concurrent research executions
    },
    timeout: 600000,  // 10 minutes (adjust for DEEP research)
  },
  // ...
);

export const recommendationGenerationJob = inngest.createFunction(
  {
    id: "recommendation-generation-job",
    concurrency: {
      limit: 3,  // Max concurrent recommendation generations
    },
  },
  // ...
);
```

## Debugging Checklist

When research isn't working:

- [ ] `TAVILY_API_KEY` set in environment
- [ ] `OPENAI_API_KEY` set in environment
- [ ] Next.js dev server running
- [ ] Inngest dev server running
- [ ] Database accessible: `npx prisma studio`
- [ ] No port conflicts: `lsof -i :3002` and `lsof -i :8288`
- [ ] Logs show no errors: Check console and Inngest dashboard
- [ ] TypeScript compiles: `npx tsc --noEmit`

---

**Related Guides:**
- `01-overall-architecture.md` - System overview
- `02-research-workflow-guide.md` - Background job details
- `04-recommendation-system-guide.md` - Recommendation generation
