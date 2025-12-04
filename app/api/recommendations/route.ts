/**
 * Recommendations API - List
 *
 * GET /api/recommendations?researchRunId=xxx - List recommendations for research run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/recommendations
 * List recommendations for a research run
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const researchRunId = searchParams.get("researchRunId");
    const statusParam = searchParams.get("status");

    if (!researchRunId) {
      return NextResponse.json(
        { error: "researchRunId query parameter is required" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["PENDING", "APPROVED", "REJECTED", "APPLIED"] as const;
    const status = statusParam && validStatuses.includes(statusParam as typeof validStatuses[number])
      ? (statusParam as typeof validStatuses[number])
      : undefined;

    const where = {
      researchRunId,
      ...(status && { status }),
      researchRun: {
        project: {
          userId: user.id,
        },
      },
    };

    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
        researchRun: {
          select: {
            id: true,
            instructions: true,
            depth: true,
          },
        },
        contextLayer: {
          select: {
            id: true,
            title: true,
          },
        },
        knowledgeFile: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        priority: "asc",
      },
    });

    // Calculate stats
    const stats = {
      total: recommendations.length,
      pending: recommendations.filter((r) => r.status === "PENDING").length,
      approved: recommendations.filter((r) => r.status === "APPROVED").length,
      rejected: recommendations.filter((r) => r.status === "REJECTED").length,
      applied: recommendations.filter((r) => r.status === "APPLIED").length,
      byAction: {
        add: recommendations.filter((r) => r.action === "ADD").length,
        edit: recommendations.filter((r) => r.action === "EDIT").length,
        delete: recommendations.filter((r) => r.action === "DELETE").length,
      },
      byImpact: {
        low: recommendations.filter((r) => r.impactLevel === "LOW").length,
        medium: recommendations.filter((r) => r.impactLevel === "MEDIUM").length,
        high: recommendations.filter((r) => r.impactLevel === "HIGH").length,
      },
    };

    return NextResponse.json({
      recommendations,
      stats,
    });
  } catch (error) {
    console.error("[Recommendations API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch recommendations",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
