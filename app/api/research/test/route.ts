/**
 * Test API endpoint for research orchestrator
 *
 * Tests the Next.js → Python subprocess integration
 *
 * Usage:
 *   POST /api/research/test
 *   Body: { "instructions": "research query", "depth": "quick" | "moderate" | "deep" }
 *
 * Example:
 *   curl -X POST http://localhost:3000/api/research/test \
 *     -H "Content-Type: application/json" \
 *     -d '{"instructions": "What is backgammon?", "depth": "quick"}'
 */

import { NextRequest, NextResponse } from "next/server";
import { executeResearch } from "@/lib/researchOrchestrator";
import type { ResearchDepth } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instructions, depth = "quick" } = body;

    // Validate inputs
    if (!instructions || typeof instructions !== "string") {
      return NextResponse.json(
        {
          error: "Missing or invalid 'instructions' field",
          usage: "POST /api/research/test with body: { instructions: string, depth?: 'quick' | 'moderate' | 'deep' }",
        },
        { status: 400 }
      );
    }

    const validDepths: ResearchDepth[] = ["quick", "moderate", "deep"];
    if (!validDepths.includes(depth)) {
      return NextResponse.json(
        {
          error: `Invalid depth: ${depth}`,
          valid_depths: validDepths,
        },
        { status: 400 }
      );
    }

    // Execute research
    console.log(`[Research Test] Starting research: "${instructions}" (${depth})`);
    const result = await executeResearch({
      instructions,
      depth,
      timeout: 120000, // 2 minutes for testing
    });

    console.log(
      `[Research Test] Completed in ${result.executionTime}ms - Success: ${result.success}`
    );

    // Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
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
    console.error("[Research Test] Error:", error);
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
    endpoint: "/api/research/test",
    method: "POST",
    description: "Test endpoint for research orchestrator (Next.js → Python integration)",
    usage: {
      body: {
        instructions: "string (required) - Research query or instructions",
        depth: "string (optional) - Research depth: 'quick', 'moderate', or 'deep'. Default: 'quick'",
      },
    },
    example: {
      instructions: "What are the basic opening strategies in backgammon?",
      depth: "quick",
    },
    notes: [
      "Requires OPENAI_API_KEY in .env file for full functionality",
      "Falls back to POC mode if GPT Researcher not fully configured",
      "Timeout: 2 minutes",
    ],
  });
}
