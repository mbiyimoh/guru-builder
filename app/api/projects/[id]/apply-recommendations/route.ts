/**
 * Apply Recommendations API
 *
 * POST /api/projects/[id]/apply-recommendations - Apply approved recommendations to corpus
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRecommendations } from "@/lib/applyRecommendations";
import { requireProjectOwnership } from "@/lib/auth";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Validation schema
const applyRecommendationsSchema = z.object({
  recommendationIds: z.array(z.string().cuid()).min(1, "At least one recommendation ID is required"),
  snapshotName: z.string().optional(),
  snapshotDescription: z.string().optional(),
});

/**
 * POST /api/projects/[id]/apply-recommendations
 * Apply approved recommendations to the corpus
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: projectId } = await context.params;

    // Auth check
    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      if (message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const body = await request.json();

    // Validate input
    const result = applyRecommendationsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    const { recommendationIds, snapshotName, snapshotDescription } = result.data;

    // Apply recommendations
    const applyResult = await applyRecommendations({
      projectId,
      recommendationIds,
      snapshotName,
      snapshotDescription,
    });

    if (!applyResult.success) {
      return NextResponse.json(
        {
          error: "Failed to apply recommendations",
          message: applyResult.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      snapshotId: applyResult.snapshotId,
      appliedCount: applyResult.appliedCount,
      changes: applyResult.changes,
      message: `Successfully applied ${applyResult.appliedCount} recommendations`,
    });
  } catch (error) {
    console.error("[Apply Recommendations API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to apply recommendations",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
