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
import { RESEARCH_MODEL } from "./assessment/constants";

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
  includeRawContent: false | "markdown" | "text";
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
    includeRawContent: "markdown",
    searchDepth: "basic",
  },
  deep: {
    maxResults: 20,
    includeRawContent: "markdown",
    searchDepth: "advanced",
  },
};

// Tavily API has a 400 character limit on queries
const TAVILY_MAX_QUERY_LENGTH = 400;

/**
 * Optimize long research instructions into a concise search query for Tavily
 * Tavily has a 400 character limit, so we use GPT to extract key search terms
 */
async function optimizeSearchQuery(instructions: string): Promise<string> {
  // If instructions are short enough, use them directly
  if (instructions.length <= TAVILY_MAX_QUERY_LENGTH) {
    return instructions;
  }

  console.log(`[Research] Instructions too long (${instructions.length} chars), optimizing search query...`);

  const completion = await getOpenAI().chat.completions.create({
    model: RESEARCH_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a search query optimizer. Convert detailed research instructions into a concise, effective web search query.

Rules:
- Maximum 350 characters (leave room for safety margin)
- Extract the core research topic and key terms
- Use natural language that works well for web search
- Preserve domain-specific terminology
- Do NOT include instructions like "research" or "find information about"
- Output ONLY the optimized query, nothing else`,
      },
      {
        role: "user",
        content: `Convert these research instructions into an optimized search query:\n\n${instructions}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  const rawOptimizedQuery = completion.choices[0]?.message?.content?.trim() || instructions;

  // Always enforce the max length - GPT doesn't always follow the 350 char request precisely
  const optimizedQuery = rawOptimizedQuery.slice(0, TAVILY_MAX_QUERY_LENGTH);

  console.log(`[Research] Optimized query (${optimizedQuery.length} chars): "${optimizedQuery.slice(0, 100)}..."`);

  return optimizedQuery;
}

/**
 * Generate a concise, scannable summary from the full research report
 * Returns formatted intro sentence + bullet points (no raw markdown symbols)
 */
async function generateSummary(fullReport: string, query: string): Promise<string> {
  if (!fullReport || fullReport.length < 100) {
    console.warn(`[Research] Summary generation skipped - report too short (${fullReport?.length || 0} chars)`);
    return "Research completed. See full report for details.";
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: RESEARCH_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a research summarizer. Create a brief, scannable summary of research findings.

Format Requirements:
- Start with ONE introductory sentence (max 100 chars)
- Follow with 3-4 bullet points of key findings
- Each bullet should start with "• " (bullet character)
- Each bullet should be 60-100 characters
- Total output MUST be under 500 characters
- Use plain text only - NO markdown formatting (no #, ##, **, etc.)
- Write for quick scanning, not deep reading`
        },
        {
          role: "user",
          content: `Summarize this research report about "${query}":\n\n${fullReport.slice(0, 3000)}`
        }
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) {
      return "Research completed. See full report for details.";
    }

    // Ensure we don't exceed 600 chars (with some buffer)
    return summary.length > 600 ? summary.slice(0, 597) + "..." : summary;
  } catch (error) {
    console.error("[Research] Failed to generate summary:", error);
    // Fallback to simple truncation if GPT call fails
    return fullReport.slice(0, 500) + (fullReport.length > 500 ? "..." : "");
  }
}

/**
 * Execute research using Tavily search and GPT-4o synthesis
 */
export async function executeResearch(
  options: ResearchOptions
): Promise<ResearchResult> {
  const { instructions, depth = "moderate", timeout = 300000, onProgress } = options;
  const startTime = Date.now();
  const config = DEPTH_CONFIG[depth];

  console.log(`[Research] Starting ${depth} research: "${instructions.slice(0, 100)}..."`);

  try {
    // Step 1: Optimize search query if instructions are too long for Tavily
    if (instructions.length > TAVILY_MAX_QUERY_LENGTH) {
      await onProgress?.("Optimizing search query...");
    }
    const searchQuery = await optimizeSearchQuery(instructions);

    // Step 2: Execute Tavily search
    await onProgress?.("Searching the web for sources...");
    console.log(`[Research] Executing Tavily search with ${config.maxResults} max results`);

    const searchResponse = await Promise.race([
      getTavily().search(searchQuery, {
        maxResults: config.maxResults,
        includeRawContent: config.includeRawContent,
        searchDepth: config.searchDepth,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timeout")), timeout / 3)
      ),
    ]);

    // Extract sources from search results
    const sources: ResearchSource[] = searchResponse.results.map((result) => ({
      url: result.url,
      title: result.title || "Untitled Source",
    }));

    console.log(`[Research] Found ${sources.length} sources`);

    // Step 3: Synthesize findings with GPT-4o
    await onProgress?.("Synthesizing research report...");
    console.log(`[Research] Synthesizing with GPT-4o`);

    const synthesisPrompt = buildSynthesisPrompt(
      instructions,
      depth,
      searchResponse.results
    );

    const completion = await Promise.race([
      getOpenAI().chat.completions.create({
        model: RESEARCH_MODEL,
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
    ]); // Synthesis gets more time since it's the most important step

    const fullReport = completion.choices[0]?.message?.content || "";

    // Generate a proper standalone summary (not truncation)
    await onProgress?.("Generating summary...");
    const summary = await generateSummary(fullReport, instructions);

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
