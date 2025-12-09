/**
 * Guru Artifacts API - List artifacts for a project
 *
 * GET /api/projects/[id]/guru/artifacts - Get all artifacts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwnership } from "@/lib/auth";
import { clearStaleGeneratingArtifact } from "@/lib/teaching/staleArtifactHandler";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function handleAuthError(error: unknown) {
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
  return null;
}

/**
 * GET /api/projects/[id]/guru/artifacts
 * Get all guru artifacts for a project
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
      const authError = handleAuthError(error);
      if (authError) return authError;
    }

    // Clear any stale GENERATING artifacts before querying
    await Promise.all([
      clearStaleGeneratingArtifact(projectId, "MENTAL_MODEL"),
      clearStaleGeneratingArtifact(projectId, "CURRICULUM"),
      clearStaleGeneratingArtifact(projectId, "DRILL_SERIES"),
    ]);

    const artifacts = await prisma.guruArtifact.findMany({
      where: { projectId },
      orderBy: [{ type: "asc" }, { version: "desc" }],
      select: {
        id: true,
        type: true,
        version: true,
        status: true,
        corpusHash: true,
        generatedAt: true,
        dependsOnArtifactId: true,
        errorMessage: true,
        progressStage: true,  // For progress tracking UI
        // Don't include full content in list - use individual endpoint
      },
    });

    // Group by type for easier consumption
    const grouped = {
      mentalModels: artifacts.filter((a) => a.type === "MENTAL_MODEL"),
      curricula: artifacts.filter((a) => a.type === "CURRICULUM"),
      drillSeries: artifacts.filter((a) => a.type === "DRILL_SERIES"),
    };

    // Get latest of each type (GENERATING takes precedence for progress tracking, then COMPLETED)
    const getLatest = (list: typeof artifacts) => {
      const generating = list.find((a) => a.status === "GENERATING");
      if (generating) return generating;
      return list.find((a) => a.status === "COMPLETED");
    };

    const latest = {
      mentalModel: getLatest(grouped.mentalModels),
      curriculum: getLatest(grouped.curricula),
      drillSeries: getLatest(grouped.drillSeries),
    };

    return NextResponse.json(
      {
        artifacts,
        grouped,
        latest,
        counts: {
          total: artifacts.length,
          mentalModels: grouped.mentalModels.length,
          curricula: grouped.curricula.length,
          drillSeries: grouped.drillSeries.length,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Guru Artifacts API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch artifacts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
