# Refactor Research Orchestrator: Python to TypeScript

**Slug:** refactor-research-orchestrator-python-to-typescript
**Author:** Claude Code
**Date:** 2025-12-04
**Branch:** preflight/refactor-research-orchestrator-python-to-typescript
**Related:** Production error "spawn /app/python/venv/bin/python ENOENT"

---

## 1) Intent & Assumptions

- **Task brief:** Replace the Python subprocess-based research orchestrator with a pure TypeScript implementation. The current system spawns `python/research_agent.py` using GPT Researcher, which fails in production because the Railway Docker container doesn't include Python/venv. We need a TypeScript solution using web search APIs and OpenAI for synthesis.

- **Assumptions:**
  - The existing `ResearchFindings` interface contract must be preserved (no breaking changes to consumers)
  - Vercel AI SDK is already installed and working (used in `corpusRecommendationGenerator.ts`)
  - OpenAI API key is available in production
  - A new API key for web search (Tavily, Exa, or Serper) will be added
  - The three depth levels (quick/moderate/deep) should map to different search/synthesis parameters

- **Out of scope:**
  - Changes to `inngest-functions.ts` beyond updating the import
  - Changes to `corpusRecommendationGenerator.ts`
  - Changes to the recommendation generation workflow
  - UI changes
  - Database schema changes
  - The Python files can remain (will be deprecated, not deleted)

---

## 2) Pre-reading Log

- `lib/researchOrchestrator.ts`: Current implementation spawns Python subprocess with `child_process.spawn()`. Hardcodes path to `python/venv/bin/python`. Returns `ResearchResult` type.

- `lib/types.ts`: Defines `ResearchFindings`, `ResearchResult`, `ResearchOptions`, `ResearchDepth`. Must preserve these interfaces exactly.

- `lib/inngest-functions.ts:58-72`: Calls `executeResearch()` from researchOrchestrator. Only consumer of the research orchestrator. Saves results to `ResearchRun.researchData`.

- `lib/corpusRecommendationGenerator.ts`: Consumes `researchFindings` as `Record<string, unknown>`. Uses OpenAI with Zod structured outputs. Shows pattern for lazy-loaded OpenAI client.

- `python/research_agent.py`: Uses GPT Researcher library. Configures depth via max_sources (5/10/20) and max_iterations (2/4/6). Returns JSON with query, summary, fullReport, sources, metadata.

- `developer-guides/05-research-run-functionality-guide.md`: Comprehensive documentation of current Python architecture. Documents stdout capture, subprocess isolation, and environment setup.

---

## 3) Codebase Map

### Primary Components/Modules
| File | Role |
|------|------|
| `lib/researchOrchestrator.ts` | **TARGET** - Spawns Python, needs complete rewrite |
| `lib/types.ts` | Type definitions - preserve interfaces |
| `lib/inngest-functions.ts` | Calls `executeResearch()` - import only |
| `python/research_agent.py` | Python implementation - will be deprecated |

### Shared Dependencies
- **OpenAI client pattern:** Lazy-loaded in `corpusRecommendationGenerator.ts:12-19`
- **Zod schemas:** Used for structured outputs
- **Vercel AI SDK:** Already installed (`ai` package)

### Data Flow
```
inngest-functions.ts
    → executeResearch(options: ResearchOptions)
    → [NEW: TypeScript web search + synthesis]
    → ResearchResult { success, data: ResearchFindings, error, executionTime }
    → Save to ResearchRun.researchData
    → Trigger recommendation generation
```

### Feature Flags/Config
- `ResearchDepth`: "quick" | "moderate" | "deep"
- Environment variables needed:
  - `OPENAI_API_KEY` (existing)
  - `TAVILY_API_KEY` (new) or `EXA_API_KEY` or `SERPER_API_KEY`

### Potential Blast Radius
**LOW** - This is a well-isolated module:
- Only `inngest-functions.ts` imports `executeResearch()`
- Interface contract (`ResearchResult`) remains unchanged
- No database schema changes
- No UI changes
- Downstream consumers (`corpusRecommendationGenerator`) unaffected

---

## 4) Root Cause Analysis

- **Repro steps:**
  1. Deploy application to Railway
  2. Navigate to a project
  3. Click "Start Research"
  4. Research run fails immediately

- **Observed vs Expected:**
  - **Observed:** Error "spawn /app/python/venv/bin/python ENOENT"
  - **Expected:** Research should execute and return findings

- **Evidence:**
  - `lib/researchOrchestrator.ts:22-28` hardcodes Python venv path:
    ```typescript
    const VENV_PYTHON_PATH = path.join(
      process.cwd(),
      "python",
      "venv",
      "bin",
      "python"
    );
    ```
  - Railway Dockerfile doesn't include Python environment
  - Error is ENOENT (file not found) on spawn

- **Root-cause hypotheses:**
  1. **Python not in Docker image** (100% confidence) - The Dockerfile only builds Node.js, no Python installation
  2. Architecture mismatch - N/A, file doesn't exist at all

- **Decision:** The root cause is that Python and its dependencies are not available in the production Docker container. Rather than adding Python complexity to the Docker build, we should eliminate the Python dependency entirely.

---

## 5) Research

### Potential Solutions

#### 1. Tavily API + GPT-4o (RECOMMENDED)

**How it works:** Tavily is an AI-first search API that returns RAG-ready content. We'd call Tavily to search, then use GPT-4o to synthesize findings into a report.

**Pros:**
- RAG-optimized content (pre-processed for LLMs)
- Single API handles search + extraction + ranking
- Native Vercel AI SDK integration (`@tavily/ai-sdk`)
- Free tier: 1,000 searches/month
- Fast: single API call
- SOC 2 certified

**Cons:**
- New dependency/API key required
- Cost at scale ($0.004-0.008/search)

**Cost estimate:** ~$0.04 per research run (10 searches + GPT-4o synthesis)

**Code pattern:**
```typescript
import { tavily } from "@tavily/core";
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const searchResults = await tvly.search(query, { maxResults: 10 });

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: `Synthesize these findings into a research report:\n${JSON.stringify(searchResults)}`
});
```

---

#### 2. OpenAI Responses API with Built-in Web Search

**How it works:** OpenAI's new Responses API includes `web_search_preview` tool that handles search automatically.

**Pros:**
- Simplest integration (one API)
- No external search service needed
- Citations included automatically
- No per-search fees

**Cons:**
- New API mode (Responses API, not Chat Completions)
- Preview status - may change
- Less control over search behavior
- Not available on Azure OpenAI

**Code pattern:**
```typescript
const response = await client.responses.create({
  model: "gpt-4o",
  tools: [{ type: "web_search_preview" }],
  input: instructions
});
```

---

#### 3. Exa Neural Search + GPT-4o

**How it works:** Exa uses neural embeddings for semantic search. Supports multiple modes (fast/auto/deep) with live crawling.

**Pros:**
- Highest quality semantic search
- Similarity search capability
- Multiple search modes matching our depth levels
- Live crawling for fresh content
- Native Vercel AI SDK support (`@exalabs/ai-sdk`)

**Cons:**
- 2-5x more expensive than Tavily
- More configuration complexity
- Credit system requires tracking

**Cost estimate:** ~$0.10-0.25 per research run

---

#### 4. Serper API + Custom Scraping

**How it works:** Serper provides Google search results. We'd need to separately fetch/scrape URLs for content.

**Pros:**
- Cheapest option ($0.001/search)
- Google-quality results
- Generous free tier (2,500 queries)

**Cons:**
- Only returns snippets, not full content
- Requires additional scraping step
- More implementation complexity
- Scraping can be unreliable

**Cost estimate:** ~$0.01 per research run (search only) + scraping costs

---

#### 5. Perplexity Sonar Deep Research

**How it works:** All-in-one research API with autonomous multi-step research.

**Pros:**
- Complete solution (search + synthesis + citations)
- Highest quality reports
- Autonomous research mode

**Cons:**
- Most expensive (10-50x Tavily)
- Vendor lock-in
- Less customization

**Cost estimate:** ~$0.15-0.50 per research run

---

#### 6. Add Python to Docker

**How it works:** Modify Dockerfile to install Python, create venv, install gpt-researcher.

**Pros:**
- No code changes to research orchestrator
- Keeps existing implementation

**Cons:**
- Increases Docker image size significantly
- Adds Python dependency management complexity
- Two runtime environments to maintain
- GPT Researcher has many dependencies

**Not recommended** - Adds complexity without solving the fundamental architecture issue.

---

### Recommendation

**Option 1: Tavily API + GPT-4o** is the recommended approach because:

1. **Best cost/quality balance:** ~$0.04/research run
2. **Simplest migration:** RAG-ready output matches current interface
3. **Native SDK support:** `@tavily/ai-sdk` works with Vercel AI SDK
4. **Free tier for testing:** 1,000 searches/month
5. **Low blast radius:** Only changes one file
6. **Production-ready:** SOC 2 certified, enterprise SLAs available

Implementation would:
1. Install `@tavily/core` package
2. Create new `lib/researchOrchestratorV2.ts` with TypeScript implementation
3. Use Tavily for web search based on depth level
4. Use GPT-4o to synthesize findings into report format
5. Return identical `ResearchResult` interface
6. Update import in `inngest-functions.ts`
7. Add `TAVILY_API_KEY` to environment variables

---

## 6) Clarifications

1. **Search provider choice:** Should we use Tavily (recommended), Exa (higher quality, higher cost), or OpenAI's built-in web search (simpler but less control)?

>> Tavily

2. **Depth level mapping:** The current Python implementation uses:
   - Quick: 5 sources, 2 iterations
   - Moderate: 10 sources, 4 iterations
   - Deep: 20 sources, 6 iterations

   Should the TypeScript version match these exactly, or can we adjust based on the new API capabilities?

>> we can adjust if it makes sense (so long as we are maintianing that same basic mental model framework of shallow vs moderate vs deep research runs)

3. **Fallback behavior:** If the search API fails, should we:
   - Return an error immediately?
   - Attempt synthesis with partial results?
   - Fall back to a different provider?

>> for now, just return an error. hopefully that is pretty rare

4. **Python code removal:** Should we delete the Python directory and files, or leave them as deprecated reference code?

>> deprecated for now / until the typescript stuff has been working for a while and we're confident we no longer need the reference

5. **Environment variable naming:** Should we use `TAVILY_API_KEY` (matches their docs) or something more generic like `SEARCH_API_KEY`?

>> match their docs

---

## Implementation Estimate

| Task | Effort |
|------|--------|
| Create `researchOrchestratorV2.ts` | 2-3 hours |
| Update `inngest-functions.ts` import | 5 minutes |
| Add Tavily package + env var | 15 minutes |
| Testing (local + production) | 1-2 hours |
| Update documentation | 30 minutes |
| **Total** | **4-6 hours** |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tavily API outage | Low | High | Could add fallback to Serper |
| Different search quality | Medium | Medium | Test thoroughly before deploy |
| Cost overruns | Low | Low | Monitor usage, add alerts |
| Interface mismatch | Low | High | Comprehensive type checking |

---

## Next Steps

1. User decides on clarifications above
2. Create spec document with implementation details
3. Implement in isolated branch
4. Test locally with Inngest dev server
5. Deploy to Railway with new env var
6. Verify research runs work in production
