/**
 * Recommendation Rejection API
 *
 * POST /api/recommendations/[id]/reject - Reject recommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/recommendations/[id]/reject
 * Reject a recommendation
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Check if recommendation exists and is pending
    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      select: {
        status: true,
        researchRun: {
          select: {
            project: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      );
    }

    // Check ownership through research run's project
    if (recommendation.researchRun.project.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (recommendation.status !== "PENDING") {
      return NextResponse.json(
        {
          error: "Recommendation cannot be rejected",
          details: `Recommendation status is ${recommendation.status}, can only reject PENDING recommendations`,
        },
        { status: 400 }
      );
    }

    // Update recommendation status
    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
      },
      include: {
        researchRun: {
          select: {
            id: true,
            instructions: true,
          },
        },
      },
    });

    console.log(`[Recommendation ${id}] Rejected`);

    return NextResponse.json({
      recommendation: updated,
      message: "Recommendation rejected successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      );
    }

    console.error(`[Recommendation Rejection] Error:`, error);
    return NextResponse.json(
      {
        error: "Failed to reject recommendation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
