/**
 * Guru Artifacts API - List artifacts for a project
 *
 * GET /api/projects/[id]/guru/artifacts - Get all artifacts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwnership } from "@/lib/auth";

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
        // Don't include full content in list - use individual endpoint
      },
    });

    // Group by type for easier consumption
    const grouped = {
      mentalModels: artifacts.filter((a) => a.type === "MENTAL_MODEL"),
      curricula: artifacts.filter((a) => a.type === "CURRICULUM"),
      drillSeries: artifacts.filter((a) => a.type === "DRILL_SERIES"),
    };

    // Get latest completed of each type
    const latest = {
      mentalModel: grouped.mentalModels.find((a) => a.status === "COMPLETED"),
      curriculum: grouped.curricula.find((a) => a.status === "COMPLETED"),
      drillSeries: grouped.drillSeries.find((a) => a.status === "COMPLETED"),
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
