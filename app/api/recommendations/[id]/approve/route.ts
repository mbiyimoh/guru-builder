/**
 * Recommendation Approval API
 *
 * POST /api/recommendations/[id]/approve - Approve recommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/recommendations/[id]/approve
 * Approve a recommendation
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    // Check if recommendation exists and is pending
    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      );
    }

    if (recommendation.status !== "PENDING") {
      return NextResponse.json(
        {
          error: "Recommendation cannot be approved",
          details: `Recommendation status is ${recommendation.status}, can only approve PENDING recommendations`,
        },
        { status: 400 }
      );
    }

    // Update recommendation status
    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: "APPROVED",
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

    console.log(`[Recommendation ${id}] Approved`);

    return NextResponse.json({
      recommendation: updated,
      message: "Recommendation approved successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      );
    }

    console.error(`[Recommendation Approval] Error:`, error);
    return NextResponse.json(
      {
        error: "Failed to approve recommendation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
