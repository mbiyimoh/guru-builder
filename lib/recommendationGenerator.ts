/**
 * Recommendation Generator using OpenAI Structured Outputs
 *
 * Takes research findings and generates structured learning recommendations
 * using OpenAI's Structured Outputs feature for guaranteed JSON validity
 */

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { recommendationSchema, type Recommendation } from "./validation";
import type { ResearchFindings } from "./types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateRecommendationsOptions {
  researchFindings: ResearchFindings;
  model?: string;
  temperature?: number;
}

export interface GenerateRecommendationsResult {
  success: boolean;
  data?: Recommendation;
  error?: {
    message: string;
    type: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  executionTime?: number;
}

/**
 * Generate structured learning recommendations from research findings
 */
export async function generateRecommendations(
  options: GenerateRecommendationsOptions
): Promise<GenerateRecommendationsResult> {
  const {
    researchFindings,
    model = "gpt-4o-2024-08-06",
    temperature = 0.7,
  } = options;

  const startTime = Date.now();

  try {
    // Construct prompt from research findings
    const prompt = `Based on the following research findings about "${researchFindings.query}", generate comprehensive learning recommendations.

RESEARCH SUMMARY:
${researchFindings.summary}

FULL RESEARCH REPORT:
${researchFindings.fullReport}

SOURCES (${researchFindings.sourcesAnalyzed} analyzed):
${researchFindings.sources.map((s, i) => `${i + 1}. ${s.title} - ${s.url}`).join("\n")}

Generate a comprehensive, structured learning plan that includes:
1. A clear learning path with phases and milestones
2. Curated resources (books, courses, videos, tools)
3. Specific practice drills with duration and frequency
4. Common pitfalls to avoid
5. Expert tips for accelerated learning
6. Next steps after completing the initial path

Focus on practical, actionable recommendations that a motivated learner can follow.`;

    // Call OpenAI with Structured Outputs
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert learning coach who creates personalized, comprehensive learning plans based on research. Your recommendations are practical, well-structured, and evidence-based.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema" as const,
        json_schema: {
          name: "recommendation",
          schema: zodResponseFormat(recommendationSchema, "recommendation").json_schema.schema,
          strict: true,
        },
      },
      temperature,
    });

    const executionTime = Date.now() - startTime;

    // Extract structured data
    const content = completion.choices[0].message.content;
    if (!content) {
      return {
        success: false,
        error: {
          message: "No content in OpenAI response",
          type: "ParseError",
        },
        executionTime,
      };
    }

    const recommendation = recommendationSchema.parse(JSON.parse(content));

    // Extract usage statistics
    const usage = completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined;

    return {
      success: true,
      data: recommendation,
      usage,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        type: error instanceof Error ? error.constructor.name : "UnknownError",
      },
      executionTime,
    };
  }
}

/**
 * Test the recommendation generator with sample research findings
 */
export async function testRecommendationGenerator(): Promise<GenerateRecommendationsResult> {
  // Sample research findings for testing
  const sampleFindings: ResearchFindings = {
    query: "How to learn backgammon strategy",
    depth: "quick",
    summary:
      "Backgammon is a two-player board game where strategy involves understanding probability, position play, and the doubling cube. Beginners should focus on basic opening moves, safe plays, and when to hit opponent pieces.",
    fullReport: `# Learning Backgammon Strategy

## Introduction
Backgammon combines luck (dice rolls) with strategic decision-making. Success requires understanding probability, tactical position play, and psychological aspects of the doubling cube.

## Key Concepts
1. **Opening Moves**: Learn the standard opening plays for each dice combination
2. **Position Play**: Understand safe plays vs aggressive plays
3. **Probability**: Know the odds of hitting, being hit, and making points
4. **The Doubling Cube**: Strategic use of doubling to maximize wins

## Learning Path
- Start with basic rules and movement
- Master opening plays (24/13 combinations)
- Practice probability calculations
- Study endgame positions (bearing off)
- Learn doubling cube strategy

## Practice Recommendations
- Play against computer opponents (GNU Backgammon)
- Analyze your games with software
- Study master-level games
- Join online communities for discussion`,
    sources: [
      {
        url: "https://bkgm.com/articles/",
        title: "Backgammon Galore - Strategy Articles",
      },
      {
        url: "https://www.gnu.org/software/gnubg/",
        title: "GNU Backgammon - Free Software",
      },
    ],
    sourcesAnalyzed: 2,
    metadata: {
      mode: "POC",
      depth: "quick",
    },
  };

  return generateRecommendations({
    researchFindings: sampleFindings,
  });
}
