/**
 * Research Run API - Get, Cancel by ID
 *
 * GET /api/research-runs/[id] - Get run details with recommendations
 * DELETE /api/research-runs/[id] - Cancel/delete research run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/research-runs/[id]
 * Get research run with recommendations
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const run = await prisma.researchRun.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
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

    // Calculate recommendation stats
    const recommendationStats = {
      total: run.recommendations.length,
      pending: run.recommendations.filter((r) => r.status === "PENDING").length,
      approved: run.recommendations.filter((r) => r.status === "APPROVED").length,
      rejected: run.recommendations.filter((r) => r.status === "REJECTED").length,
      applied: run.recommendations.filter((r) => r.status === "APPLIED").length,
    };

    return NextResponse.json({
      run,
      recommendationStats,
    });
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
 * Cancel/delete research run
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    // Check if run exists and is not completed
    const run = await prisma.researchRun.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Research run not found" },
        { status: 404 }
      );
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
