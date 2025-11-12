/**
 * End-to-End Phase 1 POC Endpoint
 *
 * This endpoint demonstrates the complete workflow combining all three core technologies:
 * 1. GPT Researcher (Python subprocess) - Autonomous research
 * 2. Inngest (Background jobs) - Long-running task orchestration
 * 3. OpenAI Structured Outputs - Guaranteed valid JSON recommendations
 *
 * Workflow:
 * 1. API receives research request
 * 2. Triggers Inngest background job
 * 3. Inngest job spawns Python subprocess for GPT Researcher
 * 4. Research results passed to OpenAI for structured recommendations
 * 5. Recommendations saved and returned
 *
 * Usage:
 *   POST /api/poc/end-to-end
 *   Body: { "topic": "string", "depth": "quick" | "moderate" | "deep" }
 */

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import type { ResearchDepth } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      topic,
      depth = "quick",
    }: { topic: string; depth: ResearchDepth } = body;

    // Validate inputs
    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        {
          error: "Missing or invalid 'topic' field",
          usage: "POST /api/poc/end-to-end with body: { topic: string, depth?: 'quick' | 'moderate' | 'deep' }",
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

    // Generate unique ID for this POC run
    const pocId = `poc-${Date.now()}`;

    // Trigger Inngest background job
    // In production, this would track the job and save results to database
    console.log(`[POC ${pocId}] Starting end-to-end workflow for topic: "${topic}" (${depth})`);

    const { ids } = await inngest.send({
      name: "research/requested",
      data: {
        researchId: pocId,
        instructions: `Research how to learn and master ${topic}. Focus on learning strategies, resources, practice methods, and progression paths.`,
        depth,
      },
    });

    console.log(`[POC ${pocId}] Inngest job triggered with event IDs:`, ids);

    return NextResponse.json({
      success: true,
      pocId,
      topic,
      depth,
      eventIds: ids,
      message: "End-to-end POC workflow initiated successfully",
      workflow: [
        "✓ API request received",
        "✓ Inngest background job triggered",
        "⏳ Job will execute GPT Researcher (Python subprocess)",
        "⏳ Research results will be processed by OpenAI Structured Outputs",
        "⏳ Final recommendations will be generated",
      ],
      notes: [
        "This is a background job - check Inngest dashboard for status",
        "Expected completion time depends on depth:",
        "  - quick: 1-2 minutes",
        "  - moderate: 3-5 minutes",
        "  - deep: 5-10 minutes",
        "In Phase 2, results will be saved to database and accessible via API",
        "For now, check server logs and Inngest dashboard for results",
      ],
      monitoring: {
        inngestDashboard: process.env.NODE_ENV === "development"
          ? "http://localhost:8288"
          : "https://app.inngest.com",
        serverLogs: `Look for [Research Job ${pocId}] in console`,
      },
    });
  } catch (error) {
    console.error("[POC End-to-End] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate end-to-end POC",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/poc/end-to-end",
    method: "POST",
    description:
      "End-to-end Phase 1 POC demonstrating all three core technologies working together",
    technologies: {
      1: "GPT Researcher (Python) - Autonomous research with web scraping",
      2: "Inngest - Serverless background job orchestration",
      3: "OpenAI Structured Outputs - Guaranteed valid JSON schemas",
    },
    workflow: [
      "1. API receives research topic",
      "2. Triggers Inngest background job",
      "3. Inngest spawns Python subprocess",
      "4. GPT Researcher conducts autonomous research",
      "5. Research findings returned to Inngest job",
      "6. OpenAI processes findings into structured recommendations",
      "7. Results logged (Phase 2 will save to database)",
    ],
    usage: {
      body: {
        topic: "string (required) - What to learn (e.g., 'backgammon', 'chess', 'piano')",
        depth: "string (optional) - Research depth: 'quick', 'moderate', or 'deep'. Default: 'quick'",
      },
    },
    example: {
      topic: "backgammon strategy",
      depth: "quick",
    },
    requirements: [
      "OPENAI_API_KEY in .env file",
      "Inngest Dev Server running (npx inngest-cli@latest dev)",
      "Python virtual environment with GPT Researcher installed",
    ],
    testing: {
      startInngestDev: "npx inngest-cli@latest dev",
      curlExample:
        'curl -X POST http://localhost:3000/api/poc/end-to-end -H "Content-Type: application/json" -d \'{"topic": "backgammon", "depth": "quick"}\'',
      monitorJobs: "http://localhost:8288 (Inngest Dev Server)",
    },
  });
}
