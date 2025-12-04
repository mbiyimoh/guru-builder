/**
 * Test API endpoint for OpenAI Structured Outputs
 *
 * Tests recommendation generation with guaranteed valid JSON schema
 *
 * Usage:
 *   POST /api/recommendations/test
 *   Body: Optional research findings, or uses sample data
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateRecommendations,
  testRecommendationGenerator,
} from "@/lib/recommendationGenerator";
import type { ResearchFindings } from "@/lib/types";

export async function POST(request: NextRequest) {
  // Disable test endpoints in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => null);

    let result;

    if (body && body.researchFindings) {
      // Use provided research findings
      const researchFindings = body.researchFindings as ResearchFindings;
      console.log(
        `[Recommendations Test] Generating recommendations for: "${researchFindings.query}"`
      );

      result = await generateRecommendations({
        researchFindings,
        model: body.model,
        temperature: body.temperature,
      });
    } else {
      // Use sample data for testing
      console.log("[Recommendations Test] Using sample data");
      result = await testRecommendationGenerator();
    }

    console.log(
      `[Recommendations Test] Completed in ${result.executionTime}ms - Success: ${result.success}`
    );

    if (result.usage) {
      console.log(
        `[Recommendations Test] Token usage: ${result.usage.totalTokens} (prompt: ${result.usage.promptTokens}, completion: ${result.usage.completionTokens})`
      );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        usage: result.usage,
        executionTime: result.executionTime,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          executionTime: result.executionTime,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Recommendations Test] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/recommendations/test",
    method: "POST",
    description:
      "Test endpoint for OpenAI Structured Outputs (recommendation generation)",
    usage: {
      body: {
        researchFindings:
          "object (optional) - Research findings to generate recommendations from",
        model: "string (optional) - OpenAI model to use. Default: 'gpt-4o-2024-08-06'",
        temperature: "number (optional) - Temperature for generation. Default: 0.7",
      },
    },
    example: {
      researchFindings: {
        query: "How to learn chess",
        summary: "Chess requires strategic thinking...",
        fullReport: "Detailed research findings...",
        sources: [{ title: "Source", url: "https://example.com" }],
      },
    },
    notes: [
      "Requires OPENAI_API_KEY in .env file",
      "Uses OpenAI Structured Outputs for 100% valid JSON",
      "If no body provided, uses sample data for testing",
      "Returns fully structured recommendation with Zod validation",
    ],
  });
}
