# Task Breakdown: Research Orchestrator TypeScript Refactor

**Generated:** 2025-12-04
**Source:** specs/feat-research-orchestrator-typescript-refactor.md

## Overview

Replace the Python subprocess-based research orchestrator with a pure TypeScript implementation using Tavily API for web search and GPT-4o for report synthesis. This fixes production failures on Railway where Python is not available.

**Total Tasks:** 5
**Phases:** 3 (Foundation, Core Implementation, Verification & Documentation)

## Dependency Graph

```
Task 1.1 (Install Package)
    ↓
Task 2.1 (Implement Orchestrator) ← Task 2.2 (Update Import)
    ↓
Task 3.1 (Local Testing)
    ↓
Task 3.2 (Production Deployment + Docs)
```

---

## Phase 1: Foundation

### Task 1.1: Install Tavily SDK Package

**Description:** Add @tavily/core package to project dependencies
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (blocking)

**Technical Requirements:**
- Package: `@tavily/core` (Official Tavily JavaScript SDK)
- npm: https://www.npmjs.com/package/@tavily/core

**Implementation Steps:**
1. Run npm install command
2. Verify package is added to package.json
3. Verify TypeScript types are available

**Commands:**
```bash
npm install @tavily/core
```

**Acceptance Criteria:**
- [ ] `@tavily/core` appears in package.json dependencies
- [ ] No TypeScript errors when importing: `import { tavily } from "@tavily/core"`
- [ ] Package lock file updated

---

## Phase 2: Core Implementation

### Task 2.1: Implement TypeScript Research Orchestrator

**Description:** Complete rewrite of lib/researchOrchestrator.ts using Tavily API + GPT-4o
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Technical Requirements:**

1. **Lazy-loaded clients** (avoid build-time initialization errors):
   - Tavily client initialized on first use
   - OpenAI client initialized on first use
   - Both throw clear errors if API keys missing

2. **Depth configuration mapping:**
   | Depth | Max Results | Include Content | Search Depth |
   |-------|-------------|-----------------|--------------|
   | quick | 5 | false | basic |
   | moderate | 10 | true | basic |
   | deep | 20 | true | advanced |

3. **Interface contract MUST be preserved exactly:**
   ```typescript
   export interface ResearchFindings {
     query: string;
     depth: ResearchDepth;
     summary: string;
     fullReport: string;
     sources: ResearchSource[];
     sourcesAnalyzed: number;
     metadata: ResearchMetadata;
     noRecommendationsReason?: string;
   }

   export interface ResearchResult {
     success: boolean;
     data?: ResearchFindings;
     error?: ResearchError;
     executionTime?: number;
   }
   ```

4. **Timeout strategy:** Split total timeout between search (timeout/2) and synthesis (timeout/2)

**Complete Implementation:**

```typescript
/**
 * Research Orchestrator (TypeScript Implementation)
 *
 * Conducts web research using Tavily API and synthesizes findings with GPT-4o.
 * Replaces the previous Python subprocess implementation.
 */

import { tavily } from "@tavily/core";
import OpenAI from "openai";
import type {
  ResearchOptions,
  ResearchResult,
  ResearchFindings,
  ResearchDepth,
  ResearchSource,
} from "./types";

// Lazy-loaded clients (avoid build-time initialization errors)
let _tavily: ReturnType<typeof tavily> | null = null;
let _openai: OpenAI | null = null;

function getTavily() {
  if (!_tavily) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY environment variable is not set");
    }
    _tavily = tavily({ apiKey });
  }
  return _tavily;
}

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// Depth configuration for Tavily search
interface TavilySearchConfig {
  maxResults: number;
  includeRawContent: boolean;
  searchDepth: "basic" | "advanced";
}

const DEPTH_CONFIG: Record<ResearchDepth, TavilySearchConfig> = {
  quick: {
    maxResults: 5,
    includeRawContent: false,
    searchDepth: "basic",
  },
  moderate: {
    maxResults: 10,
    includeRawContent: true,
    searchDepth: "basic",
  },
  deep: {
    maxResults: 20,
    includeRawContent: true,
    searchDepth: "advanced",
  },
};

/**
 * Execute research using Tavily search and GPT-4o synthesis
 */
export async function executeResearch(
  options: ResearchOptions
): Promise<ResearchResult> {
  const { instructions, depth = "moderate", timeout = 300000 } = options;
  const startTime = Date.now();
  const config = DEPTH_CONFIG[depth];

  console.log(`[Research] Starting ${depth} research: "${instructions.slice(0, 100)}..."`);

  try {
    // Step 1: Execute Tavily search
    console.log(`[Research] Executing Tavily search with ${config.maxResults} max results`);

    const searchResponse = await Promise.race([
      getTavily().search(instructions, {
        maxResults: config.maxResults,
        includeRawContent: config.includeRawContent,
        searchDepth: config.searchDepth,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timeout")), timeout / 2)
      ),
    ]);

    // Extract sources from search results
    const sources: ResearchSource[] = searchResponse.results.map((result) => ({
      url: result.url,
      title: result.title || "Untitled Source",
    }));

    console.log(`[Research] Found ${sources.length} sources`);

    // Step 2: Synthesize findings with GPT-4o
    console.log(`[Research] Synthesizing with GPT-4o`);

    const synthesisPrompt = buildSynthesisPrompt(
      instructions,
      depth,
      searchResponse.results
    );

    const completion = await Promise.race([
      getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a research analyst creating comprehensive research reports.
Your reports should be well-structured, informative, and directly address the research query.
Use markdown formatting for clarity. Include specific findings from the sources provided.`,
          },
          {
            role: "user",
            content: synthesisPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Synthesis timeout")), timeout / 2)
      ),
    ]);

    const fullReport = completion.choices[0]?.message?.content || "";
    const summary = fullReport.slice(0, 500) + (fullReport.length > 500 ? "..." : "");

    const executionTime = Date.now() - startTime;
    console.log(`[Research] Completed in ${executionTime}ms`);

    // Step 3: Return formatted result
    const findings: ResearchFindings = {
      query: instructions,
      depth,
      summary,
      fullReport,
      sources,
      sourcesAnalyzed: sources.length,
      metadata: {
        maxSources: config.maxResults,
        reportType: config.searchDepth === "advanced" ? "detailed_report" : "research_report",
        mode: "tavily",
        depth,
        status: "completed",
      },
    };

    return {
      success: true,
      data: findings,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorType = errorMessage.includes("timeout") ? "TimeoutError" : "ExecutionError";

    console.error(`[Research] Failed after ${executionTime}ms:`, errorMessage);

    return {
      success: false,
      error: {
        error: "Research execution failed",
        message: errorMessage,
        type: errorType,
      },
      executionTime,
    };
  }
}

/**
 * Build the synthesis prompt for GPT-4o
 */
function buildSynthesisPrompt(
  instructions: string,
  depth: ResearchDepth,
  results: Array<{ title: string; url: string; content: string; score: number }>
): string {
  const depthDescription = {
    quick: "concise overview",
    moderate: "comprehensive summary",
    deep: "detailed, in-depth analysis",
  };

  const sourcesText = results
    .map(
      (r, i) =>
        `### Source ${i + 1}: ${r.title}\nURL: ${r.url}\nRelevance: ${(r.score * 100).toFixed(0)}%\n\n${r.content || "(No content extracted)"}`
    )
    .join("\n\n---\n\n");

  return `# Research Request

**Query:** ${instructions}
**Depth:** ${depth} (${depthDescription[depth]})
**Sources Analyzed:** ${results.length}

---

# Source Materials

${sourcesText}

---

# Your Task

Create a ${depthDescription[depth]} research report based on the sources above.

## Report Structure

1. **Executive Summary** (2-3 sentences)
2. **Key Findings** (bullet points of main discoveries)
3. **Detailed Analysis** (synthesize information from sources)
4. **Practical Implications** (how this applies in practice)
5. **Source Quality Assessment** (brief note on reliability of sources)

## Guidelines

- Cite sources by number when making claims (e.g., "According to Source 1...")
- Focus on answering the original research query
- Highlight consensus across sources
- Note any contradictions or gaps in the research
- Use markdown formatting (headers, bullets, bold)

Write the report now:`;
}

/**
 * Test the research orchestrator with a simple query
 */
export async function testResearchOrchestrator(): Promise<ResearchResult> {
  return executeResearch({
    instructions: "What are the basic opening strategies in backgammon?",
    depth: "quick",
    timeout: 120000,
  });
}
```

**Acceptance Criteria:**
- [ ] File `lib/researchOrchestrator.ts` completely rewritten with new implementation
- [ ] Lazy-loaded Tavily client with `TAVILY_API_KEY` check
- [ ] Lazy-loaded OpenAI client with `OPENAI_API_KEY` check
- [ ] DEPTH_CONFIG correctly maps quick/moderate/deep to Tavily parameters
- [ ] `executeResearch()` function signature unchanged
- [ ] `ResearchResult` return type unchanged
- [ ] Timeout handling splits timeout between search and synthesis
- [ ] Error handling returns proper `ResearchError` structure
- [ ] `buildSynthesisPrompt()` creates structured prompt for GPT-4o
- [ ] `testResearchOrchestrator()` function preserved for manual testing
- [ ] Console logging matches pattern: `[Research] ...`
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`

---

### Task 2.2: Update Inngest Functions Import

**Description:** Update the import in lib/inngest-functions.ts (no other changes needed)
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** None

**Technical Requirements:**
- Only change line 8 of `lib/inngest-functions.ts`
- The import statement remains the same (just verifying it still works)
- No changes to function calls or types

**Implementation:**
The import on line 8 should remain:
```typescript
import { executeResearch } from "./researchOrchestrator";
```

No changes needed - just verify it still works after Task 2.1.

**Acceptance Criteria:**
- [ ] `lib/inngest-functions.ts` imports from updated `researchOrchestrator.ts`
- [ ] TypeScript compiles without errors
- [ ] No runtime import errors

---

## Phase 3: Verification & Documentation

### Task 3.1: Local Testing with Inngest Dev Server

**Description:** Test all three depth levels locally to verify the implementation works
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1, Task 2.2
**Can run parallel with:** None

**Technical Requirements:**

1. **Environment setup:**
   - Add `TAVILY_API_KEY` to local `.env` file
   - Ensure `OPENAI_API_KEY` is already present

2. **Test procedure:**
   ```bash
   # Terminal 1: Start Next.js
   PORT=3002 npm run dev

   # Terminal 2: Start Inngest dev server
   npx inngest-cli dev
   ```

3. **Test each depth level:**
   - Navigate to a project in the UI
   - Click "Start New Research"
   - Test with depth: "quick" - verify completes in <30s
   - Test with depth: "moderate" - verify completes in <60s
   - Test with depth: "deep" - verify completes in <120s

4. **Verify output:**
   - Research run shows COMPLETED status
   - Recommendations are generated
   - Sources are populated
   - Full report contains synthesized content

**Acceptance Criteria:**
- [ ] `TAVILY_API_KEY` added to `.env`
- [ ] Quick research completes successfully
- [ ] Moderate research completes successfully
- [ ] Deep research completes successfully
- [ ] Each depth returns appropriate number of sources (5/10/20)
- [ ] Recommendations are generated after research completes
- [ ] No Python-related errors in logs
- [ ] Inngest dashboard shows successful job execution

---

### Task 3.2: Production Deployment and Documentation

**Description:** Deploy to Railway and update documentation
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.1
**Can run parallel with:** None

**Technical Requirements:**

1. **Railway Environment Variables:**
   - Add `TAVILY_API_KEY` to Railway environment variables
   - Verify `OPENAI_API_KEY` is already present

2. **Deployment:**
   - Commit changes to git
   - Push to trigger Railway deployment
   - Wait for deployment to complete

3. **Production Verification:**
   - Navigate to production URL
   - Execute a research run
   - Verify no "spawn python" errors
   - Verify recommendations are generated

4. **Documentation Updates:**

   **File: `.claude/CLAUDE.md`**
   Add to Environment Variables section:
   ```markdown
   **For Research (web search):**
   ```bash
   TAVILY_API_KEY="tvly-..."  # Tavily API key for web search
   ```
   ```

   **File: `developer-guides/05-research-run-functionality-guide.md`**
   Update the architecture section to reflect TypeScript implementation:
   ```markdown
   ## TypeScript Research Implementation

   The research orchestrator uses Tavily API for web search and GPT-4o for synthesis.

   ### Environment Variables

   | Variable | Required | Description |
   |----------|----------|-------------|
   | TAVILY_API_KEY | Yes | Tavily API key from https://tavily.com |
   | OPENAI_API_KEY | Yes | OpenAI API key (existing) |

   ### Depth Levels

   | Depth | Sources | Content | Search Type | Expected Time |
   |-------|---------|---------|-------------|---------------|
   | quick | 5 | No | Basic | 5-15 seconds |
   | moderate | 10 | Yes | Basic | 10-30 seconds |
   | deep | 20 | Yes | Advanced | 20-60 seconds |
   ```

**Acceptance Criteria:**
- [ ] `TAVILY_API_KEY` added to Railway environment variables
- [ ] Deployment completes successfully
- [ ] Production research run succeeds (no Python errors)
- [ ] Recommendations generated in production
- [ ] `.claude/CLAUDE.md` updated with `TAVILY_API_KEY`
- [ ] Developer guide updated with TypeScript implementation details
- [ ] Git commit with descriptive message

---

## Execution Strategy

### Recommended Order

1. **Task 1.1** - Install package (2 minutes)
2. **Task 2.1** - Implement orchestrator (30-45 minutes)
3. **Task 2.2** - Verify import (2 minutes)
4. **Task 3.1** - Local testing (15-20 minutes)
5. **Task 3.2** - Production deployment + docs (20 minutes)

### Parallel Opportunities

None - this is a sequential implementation with each task depending on the previous.

### Risk Mitigation

1. **Tavily SDK types may differ** - Verify actual response structure during implementation
2. **API rate limits** - Monitor during testing, add delays if needed
3. **Quality regression** - Compare output quality to previous Python implementation

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Foundation | 1.1 Install Package | High |
| Core Implementation | 2.1 Implement Orchestrator, 2.2 Update Import | High |
| Verification | 3.1 Local Testing, 3.2 Production Deploy | High |

**Total Estimated Implementation:** ~1-1.5 hours
**Critical Path:** All tasks are sequential
