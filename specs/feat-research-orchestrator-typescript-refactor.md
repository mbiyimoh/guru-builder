# Research Orchestrator TypeScript Refactor

## Status
Draft

## Authors
- Claude Code (2025-12-04)

## Related
- Ideation: `docs/ideation/refactor-research-orchestrator-python-to-typescript.md`
- Production Error: "spawn /app/python/venv/bin/python ENOENT"
- Developer Guide: `developer-guides/05-research-run-functionality-guide.md`

---

## Overview

Replace the Python subprocess-based research orchestrator with a pure TypeScript implementation using Tavily API for web search and GPT-4o for report synthesis. This eliminates the Python dependency that fails in the Railway production Docker container.

---

## Background/Problem Statement

### Current State
The research orchestrator (`lib/researchOrchestrator.ts`) spawns a Python subprocess that runs GPT Researcher to conduct web research. The Python script (`python/research_agent.py`) uses the `gpt-researcher` library.

### Problem
When deployed to Railway, research runs fail immediately with:
```
Error: spawn /app/python/venv/bin/python ENOENT
```

This occurs because the Railway Docker container only includes Node.js - there is no Python installation or virtual environment.

### Root Cause
The Dockerfile builds a Node.js application without Python. Adding Python would significantly increase image size and complexity for a single feature.

### Solution
Rewrite the research orchestrator in TypeScript using:
1. **Tavily API** - AI-first web search that returns RAG-ready content
2. **GPT-4o** - Synthesize search results into a research report

This approach:
- Eliminates Python dependency entirely
- Reduces complexity (one runtime)
- Uses modern TypeScript tooling already in the project
- Is production-ready for containerized deployment

---

## Goals

- Replace Python subprocess with pure TypeScript implementation
- Preserve the exact `ResearchResult` interface contract (no breaking changes)
- Support all three depth levels (quick, moderate, deep)
- Enable research to work in Railway production environment
- Maintain similar research quality to the Python implementation

---

## Non-Goals

- Changing the recommendation generation workflow
- Modifying `corpusRecommendationGenerator.ts`
- UI changes
- Database schema changes
- Deleting Python files (kept as deprecated reference)
- Adding fallback providers (out of scope for initial implementation)

---

## Technical Dependencies

### New Package
- **@tavily/core** - Official Tavily JavaScript SDK
  - npm: https://www.npmjs.com/package/@tavily/core
  - Docs: https://docs.tavily.com/sdk/javascript/quick-start
  - GitHub: https://github.com/tavily-ai/tavily-js

### Existing Packages (already installed)
- **ai** (v5.0.89) - Vercel AI SDK for LLM integration
- **@ai-sdk/openai** (v2.0.64) - OpenAI provider for Vercel AI SDK
- **openai** (v6.8.1) - OpenAI client (using existing pattern)
- **zod** (v3.24.1) - Schema validation

### Environment Variables
- `OPENAI_API_KEY` - Existing, required for GPT-4o synthesis
- `TAVILY_API_KEY` - **New**, required for web search

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    inngest-functions.ts                         │
│                    researchJob handler                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  researchOrchestrator.ts                        │
│                  executeResearch(options)                       │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ 1. Tavily    │ →  │ 2. GPT-4o    │ →  │ 3. Format        │  │
│  │    Search    │    │    Synthesis │    │    Response      │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                   ResearchResult { success, data, error }
```

### Data Flow

1. `inngest-functions.ts` calls `executeResearch({ instructions, depth })`
2. Research orchestrator queries Tavily API with depth-appropriate parameters
3. Search results are formatted and sent to GPT-4o for synthesis
4. GPT-4o generates a structured research report
5. Response is formatted to match `ResearchFindings` interface
6. Return `ResearchResult` with timing information

### Interface Contract (Unchanged)

```typescript
// lib/types.ts - MUST NOT CHANGE
export type ResearchDepth = "quick" | "moderate" | "deep";

export interface ResearchSource {
  url: string;
  title: string;
}

export interface ResearchMetadata {
  maxSources?: number;
  maxIterations?: number;
  reportType?: string;
  mode?: string;
  depth?: ResearchDepth;
  status?: string;
}

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

export interface ResearchError {
  error: string;
  message?: string;
  type?: string;
}

export interface ResearchOptions {
  instructions: string;
  depth?: ResearchDepth;
  timeout?: number;
}

export interface ResearchResult {
  success: boolean;
  data?: ResearchFindings;
  error?: ResearchError;
  executionTime?: number;
}
```

### Depth Configuration

Map depth levels to Tavily search parameters:

| Depth | Max Results | Include Content | Search Depth | Typical Use |
|-------|-------------|-----------------|--------------|-------------|
| quick | 5 | false | basic | Fast overview, minimal sources |
| moderate | 10 | true | basic | Balanced research |
| deep | 20 | true | advanced | Comprehensive research |

```typescript
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
```

### Implementation

#### File: `lib/researchOrchestrator.ts` (Complete Rewrite)

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

#### File: `lib/inngest-functions.ts` (Import Update Only)

Change line 8 from:
```typescript
import { executeResearch } from "./researchOrchestrator";
```

No other changes needed - the function signature and return type are identical.

### Error Handling

| Error Scenario | Error Type | Handling |
|----------------|------------|----------|
| Missing TAVILY_API_KEY | ConfigError | Throw immediately with clear message |
| Missing OPENAI_API_KEY | ConfigError | Throw immediately with clear message |
| Tavily API failure | ExecutionError | Return error in ResearchResult |
| GPT-4o API failure | ExecutionError | Return error in ResearchResult |
| Search timeout | TimeoutError | Return error with timeout message |
| Synthesis timeout | TimeoutError | Return error with timeout message |

### Timeout Strategy

Total timeout is split between search and synthesis:
- Search phase: timeout / 2
- Synthesis phase: timeout / 2

Default timeout remains 300,000ms (5 minutes) as configured in `inngest-functions.ts`.

---

## User Experience

No user-facing changes. The research flow remains identical:
1. User clicks "Start Research"
2. Research runs in background via Inngest
3. Recommendations are generated upon completion
4. User reviews recommendations

The only difference is that research now works in production on Railway.

---

## Testing Strategy

### Unit Tests

Create `lib/__tests__/researchOrchestrator.test.ts`:

```typescript
// Purpose: Verify the research orchestrator correctly integrates with
// Tavily and OpenAI APIs and produces valid ResearchResult objects

describe("researchOrchestrator", () => {
  describe("executeResearch", () => {
    // Purpose: Verify depth config is correctly mapped to Tavily parameters
    it("should use correct Tavily config for each depth level", async () => {
      // Mock Tavily to capture config
      // Verify quick: 5 results, moderate: 10, deep: 20
    });

    // Purpose: Verify the ResearchFindings structure matches expected interface
    it("should return properly structured ResearchFindings", async () => {
      // Execute with mocked APIs
      // Verify all required fields present
    });

    // Purpose: Verify error handling returns proper ResearchError
    it("should return ResearchError on Tavily failure", async () => {
      // Mock Tavily to throw
      // Verify error structure
    });

    // Purpose: Verify timeout handling works correctly
    it("should return TimeoutError when timeout exceeded", async () => {
      // Mock slow response
      // Verify timeout error
    });
  });
});
```

### Integration Tests

Create `lib/__tests__/researchOrchestrator.integration.test.ts`:

```typescript
// Purpose: Verify end-to-end research flow with real APIs
// Run with: TAVILY_API_KEY=xxx OPENAI_API_KEY=xxx npm test

describe("researchOrchestrator integration", () => {
  // Purpose: Verify complete research flow produces valid output
  it("should complete a quick research run", async () => {
    const result = await executeResearch({
      instructions: "What is TypeScript?",
      depth: "quick",
      timeout: 60000,
    });

    expect(result.success).toBe(true);
    expect(result.data?.sources.length).toBeGreaterThan(0);
    expect(result.data?.fullReport).toBeTruthy();
  });
});
```

### Manual E2E Testing

1. **Local testing with Inngest dev server:**
   ```bash
   # Terminal 1
   PORT=3002 npm run dev

   # Terminal 2
   npx inngest-cli dev
   ```

2. **Test each depth level:**
   - Navigate to a project
   - Click "Start New Research"
   - Test with "quick", "moderate", "deep"
   - Verify recommendations are generated

3. **Production verification:**
   - Deploy to Railway with `TAVILY_API_KEY`
   - Execute research run
   - Verify no Python errors

### Mocking Strategy

For unit tests, mock both external services:

```typescript
jest.mock("@tavily/core", () => ({
  tavily: jest.fn(() => ({
    search: jest.fn().mockResolvedValue({
      results: [
        {
          title: "Test Result",
          url: "https://example.com",
          content: "Test content",
          score: 0.9,
        },
      ],
    }),
  })),
}));

jest.mock("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: "# Test Report\n\nTest content" } }],
        }),
      },
    },
  })),
}));
```

---

## Performance Considerations

### Expected Performance

| Depth | Expected Duration | API Calls |
|-------|-------------------|-----------|
| quick | 5-15 seconds | 1 Tavily + 1 GPT-4o |
| moderate | 10-30 seconds | 1 Tavily + 1 GPT-4o |
| deep | 20-60 seconds | 1 Tavily + 1 GPT-4o |

### Comparison to Python Implementation

- **Python (GPT Researcher):** 1-15 minutes depending on depth
- **TypeScript (Tavily + GPT-4o):** 5-60 seconds

The TypeScript implementation is significantly faster because:
1. Tavily aggregates search results in a single call
2. No subprocess spawn overhead
3. No Python interpreter startup time
4. Parallel timeout handling

### API Cost Estimates

| Depth | Tavily Cost | GPT-4o Cost | Total |
|-------|-------------|-------------|-------|
| quick | ~$0.004 | ~$0.02 | ~$0.024 |
| moderate | ~$0.008 | ~$0.03 | ~$0.038 |
| deep | ~$0.016 | ~$0.04 | ~$0.056 |

---

## Security Considerations

### API Key Management

- `TAVILY_API_KEY` must be stored securely in Railway environment variables
- Never log or expose API keys
- Keys are loaded lazily to avoid build-time exposure

### Input Validation

- Research instructions are passed directly to Tavily
- No SQL/NoSQL injection risk (no database queries with user input)
- Tavily handles URL validation for extracted content

### Output Sanitization

- GPT-4o output is stored as-is (markdown)
- Frontend already handles markdown rendering safely via `react-markdown`
- No XSS risk as output is not rendered as raw HTML

---

## Documentation

### Files to Update

1. **`developer-guides/05-research-run-functionality-guide.md`**
   - Update architecture diagram
   - Remove Python setup instructions
   - Add Tavily API configuration
   - Update troubleshooting section

2. **`.claude/CLAUDE.md`**
   - Add `TAVILY_API_KEY` to environment variables section
   - Update troubleshooting for new implementation

3. **`README.md`** (if exists)
   - Update environment variable requirements

### New Documentation

Add to developer guide:

```markdown
## TypeScript Research Implementation

The research orchestrator uses Tavily API for web search and GPT-4o for synthesis.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| TAVILY_API_KEY | Yes | Tavily API key from https://tavily.com |
| OPENAI_API_KEY | Yes | OpenAI API key (existing) |

### Depth Levels

| Depth | Sources | Content | Search Type |
|-------|---------|---------|-------------|
| quick | 5 | No | Basic |
| moderate | 10 | Yes | Basic |
| deep | 20 | Yes | Advanced |
```

---

## Implementation Phases

### Phase 1: Core Implementation

1. Install `@tavily/core` package
2. Rewrite `lib/researchOrchestrator.ts` with TypeScript implementation
3. Add `TAVILY_API_KEY` to local `.env`
4. Test locally with Inngest dev server
5. Verify all three depth levels work

### Phase 2: Production Deployment

1. Add `TAVILY_API_KEY` to Railway environment variables
2. Deploy to Railway
3. Verify research runs succeed in production
4. Monitor initial research runs for issues

### Phase 3: Documentation & Cleanup

1. Update developer guide
2. Update CLAUDE.md with new env var
3. Add deprecation notice to Python files
4. Remove Python references from active documentation

---

## Open Questions

None - all clarifications have been resolved in the ideation phase.

---

## References

- [Tavily JavaScript SDK](https://www.npmjs.com/package/@tavily/core)
- [Tavily Documentation](https://docs.tavily.com/sdk/javascript/quick-start)
- [Tavily GitHub](https://github.com/tavily-ai/tavily-js)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- Ideation Document: `docs/ideation/refactor-research-orchestrator-python-to-typescript.md`
- Current Implementation: `lib/researchOrchestrator.ts`
- Python Reference: `python/research_agent.py` (deprecated)
