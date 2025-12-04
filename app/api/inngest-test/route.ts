/**
 * Test endpoint to trigger Inngest jobs
 *
 * Usage:
 *   POST /api/inngest-test?type=simple
 *   POST /api/inngest-test?type=research
 */

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export async function POST(request: NextRequest) {
  // Disable test endpoints in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "simple";

  try {
    if (type === "simple") {
      // Test simple job (5 second delay)
      const { ids } = await inngest.send({
        name: "test/simple",
        data: {
          message: "Hello from test endpoint!",
        },
      });

      return NextResponse.json({
        success: true,
        type: "simple",
        eventIds: ids,
        message: "Simple test job triggered successfully",
        note: "Job will complete in ~5 seconds",
      });
    } else if (type === "research") {
      // Test research job (1-10 minutes depending on depth)
      const body = await request.json();
      const {
        instructions = "What are the basic opening strategies in backgammon?",
        depth = "quick",
      } = body;

      const researchId = `test-${Date.now()}`;

      const { ids } = await inngest.send({
        name: "research/requested",
        data: {
          researchId,
          instructions,
          depth,
        },
      });

      return NextResponse.json({
        success: true,
        type: "research",
        researchId,
        eventIds: ids,
        message: "Research job triggered successfully",
        instructions,
        depth,
        note: "Check Inngest dashboard for job status",
      });
    } else {
      return NextResponse.json(
        {
          error: `Unknown job type: ${type}`,
          valid_types: ["simple", "research"],
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Inngest Test] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger Inngest job",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/inngest-test",
    method: "POST",
    description: "Test endpoint to trigger Inngest background jobs",
    usage: {
      simple: "POST /api/inngest-test?type=simple",
      research: "POST /api/inngest-test?type=research with body: { instructions: string, depth: 'quick' | 'moderate' | 'deep' }",
    },
    examples: [
      {
        type: "simple",
        curl: 'curl -X POST "http://localhost:3000/api/inngest-test?type=simple"',
      },
      {
        type: "research",
        curl: 'curl -X POST "http://localhost:3000/api/inngest-test?type=research" -H "Content-Type: application/json" -d \'{"instructions": "What is backgammon?", "depth": "quick"}\'',
      },
    ],
    notes: [
      "Requires Inngest Dev Server running: npx inngest-cli@latest dev",
      "Or configure production Inngest credentials in .env",
      "View job status at http://localhost:8288 (dev) or Inngest dashboard (prod)",
    ],
  });
}
