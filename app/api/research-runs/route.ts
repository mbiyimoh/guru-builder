/**
 * Research Runs API - List and Create
 *
 * GET /api/research-runs?projectId=xxx - List research runs for project
 * POST /api/research-runs - Create and trigger new research run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest";
import { z } from "zod";

// Validation schema
const createResearchRunSchema = z.object({
  projectId: z.string().cuid(),
  instructions: z.string().min(10, "Instructions must be at least 10 characters"),
  depth: z.enum(["QUICK", "MODERATE", "DEEP"]).default("MODERATE"),
});

/**
 * GET /api/research-runs
 * List research runs for a project
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");
    const statusParam = searchParams.get("status");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query parameter is required" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
    const status = statusParam && validStatuses.includes(statusParam as typeof validStatuses[number])
      ? (statusParam as typeof validStatuses[number])
      : undefined;

    const where = {
      projectId,
      ...(status && { status }),
    };

    const runs = await prisma.researchRun.findMany({
      where,
      include: {
        _count: {
          select: {
            recommendations: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate stats
    const stats = {
      total: runs.length,
      pending: runs.filter((r) => r.status === "PENDING").length,
      running: runs.filter((r) => r.status === "RUNNING").length,
      completed: runs.filter((r) => r.status === "COMPLETED").length,
      failed: runs.filter((r) => r.status === "FAILED").length,
    };

    return NextResponse.json({
      runs,
      stats,
    });
  } catch (error) {
    console.error("[Research Runs API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch research runs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/research-runs
 * Create new research run and trigger background job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = createResearchRunSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    const { projectId, instructions, depth } = result.data;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Create research run
    const run = await prisma.researchRun.create({
      data: {
        projectId,
        instructions,
        depth,
        status: "PENDING",
      },
    });

    // Trigger Inngest background job
    try {
      const { ids } = await inngest.send({
        name: "research/requested",
        data: {
          researchId: run.id,
          instructions,
          depth: depth.toLowerCase() as "quick" | "moderate" | "deep",
        },
      });

      console.log(`[Research Run ${run.id}] Triggered Inngest job:`, ids);

      // Update status to RUNNING
      await prisma.researchRun.update({
        where: { id: run.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
        },
      });
    } catch (inngestError) {
      console.error(`[Research Run ${run.id}] Failed to trigger Inngest:`, inngestError);

      // Mark as failed
      await prisma.researchRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: `Failed to trigger background job: ${inngestError instanceof Error ? inngestError.message : "Unknown error"}`,
        },
      });

      return NextResponse.json(
        {
          error: "Failed to trigger research job",
          message: inngestError instanceof Error ? inngestError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        run,
        message: "Research run created and job triggered successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Research Runs API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to create research run",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
