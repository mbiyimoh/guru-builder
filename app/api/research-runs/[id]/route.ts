/**
 * Research Run API - Get, Cancel by ID
 *
 * GET /api/research-runs/[id] - Get run details with recommendations
 * DELETE /api/research-runs/[id] - Cancel/delete research run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/research-runs/[id]
 * Get research run with recommendations (requires ownership)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const run = await prisma.researchRun.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        recommendations: {
          orderBy: {
            priority: "asc",
          },
        },
        _count: {
          select: {
            recommendations: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Research run not found" },
        { status: 404 }
      );
    }

    // Check ownership through project
    if (run.project.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate recommendation stats
    const recommendationStats = {
      total: run.recommendations.length,
      pending: run.recommendations.filter((r) => r.status === "PENDING").length,
      approved: run.recommendations.filter((r) => r.status === "APPROVED").length,
      rejected: run.recommendations.filter((r) => r.status === "REJECTED").length,
      applied: run.recommendations.filter((r) => r.status === "APPLIED").length,
    };

    return NextResponse.json(
      {
        run,
        recommendationStats,
        // Include total for polling clients that check for recommendation generation completion
        recommendations: {
          total: run.recommendations.length,
        },
      },
      {
        headers: {
          // Prevent caching to ensure polling gets fresh data
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error(`[Research Run API] GET error:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch research run",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/research-runs/[id]
 * Cancel/delete research run (requires ownership)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if run exists and get project ownership
    const run = await prisma.researchRun.findUnique({
      where: { id },
      select: {
        status: true,
        project: {
          select: { userId: true },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Research run not found" },
        { status: 404 }
      );
    }

    // Check ownership through project
    if (run.project.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If running, mark as cancelled (we can't actually stop the Inngest job)
    if (run.status === "RUNNING" || run.status === "PENDING") {
      await prisma.researchRun.update({
        where: { id },
        data: {
          status: "CANCELLED",
          errorMessage: "Cancelled by user",
        },
      });

      return NextResponse.json({
        message: "Research run cancelled successfully",
      });
    }

    // If completed or failed, delete it
    await prisma.researchRun.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Research run deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Research run not found" },
        { status: 404 }
      );
    }

    console.error(`[Research Run API] DELETE error:`, error);
    return NextResponse.json(
      {
        error: "Failed to delete research run",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
