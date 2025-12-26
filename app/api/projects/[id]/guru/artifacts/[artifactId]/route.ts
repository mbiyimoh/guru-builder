/**
 * Single Guru Artifact API - Get/Delete specific artifact
 *
 * GET /api/projects/[id]/guru/artifacts/[artifactId] - Get artifact with content
 * DELETE /api/projects/[id]/guru/artifacts/[artifactId] - Delete artifact
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectOwnership } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string; artifactId: string }>;
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
 * GET /api/projects/[id]/guru/artifacts/[artifactId]
 * Get a single artifact with full content
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, artifactId } = await context.params;

    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
      const authError = handleAuthError(error);
      if (authError) return authError;
    }

    const artifact = await prisma.guruArtifact.findFirst({
      where: {
        id: artifactId,
        projectId,
      },
      include: {
        dependsOn: {
          select: {
            id: true,
            type: true,
            version: true,
          },
        },
        dependents: {
          select: {
            id: true,
            type: true,
            version: true,
            status: true,
          },
        },
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { artifact },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Guru Artifact API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch artifact",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/guru/artifacts/[artifactId]
 * Cancel or delete a specific artifact
 * - If GENERATING: marks as CANCELLED (can't stop Inngest job)
 * - If COMPLETED/FAILED/CANCELLED: deletes the artifact
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, artifactId } = await context.params;

    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
      const authError = handleAuthError(error);
      if (authError) return authError;
    }

    // Check if artifact exists and belongs to project
    const artifact = await prisma.guruArtifact.findFirst({
      where: {
        id: artifactId,
        projectId,
      },
      include: {
        dependents: {
          select: { id: true },
        },
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    // If generating, mark as cancelled (we can't actually stop the Inngest job)
    if (artifact.status === "GENERATING") {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          status: "CANCELLED",
          errorMessage: "Cancelled by user",
          progressStage: null,
          subTaskProgress: Prisma.DbNull,
        },
      });

      console.log(`[Guru Artifact API] Cancelled artifact ${artifactId}`);

      return NextResponse.json({
        message: "Artifact generation cancelled successfully",
        cancelled: true,
      });
    }

    // Check for dependents before deleting completed/failed artifacts
    if (artifact.dependents.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete artifact with dependents",
          dependentIds: artifact.dependents.map((d) => d.id),
        },
        { status: 409 }
      );
    }

    await prisma.guruArtifact.delete({
      where: { id: artifactId },
    });

    return NextResponse.json({
      message: "Artifact deleted successfully",
    });
  } catch (error) {
    console.error("[Guru Artifact API] DELETE error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete artifact",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
