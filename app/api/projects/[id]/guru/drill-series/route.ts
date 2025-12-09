/**
 * Drill Series Generation API
 *
 * POST /api/projects/[id]/guru/drill-series - Trigger drill series generation
 * GET /api/projects/[id]/guru/drill-series - Get latest drill series
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwnership } from "@/lib/auth";
import { inngest } from "@/lib/inngest";
import { z } from "zod";
import { getActiveGeneratingArtifact } from "@/lib/teaching/staleArtifactHandler";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const generateDrillSeriesSchema = z.object({
  mentalModelArtifactId: z.string().optional(), // If not provided, uses latest
  curriculumArtifactId: z.string().optional(), // If not provided, uses latest
  userNotes: z.string().optional(),
});

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
 * GET /api/projects/[id]/guru/drill-series
 * Get the latest completed drill series for the project
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

    const drillSeries = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "DRILL_SERIES",
        status: "COMPLETED",
      },
      orderBy: { version: "desc" },
      include: {
        dependsOn: {
          select: { id: true, type: true, version: true },
        },
      },
    });

    // Check for active generation (auto-clears stale ones)
    const generating = await getActiveGeneratingArtifact(projectId, "DRILL_SERIES");

    return NextResponse.json(
      {
        drillSeries,
        generating,
        hasCompleted: !!drillSeries,
        isGenerating: !!generating,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Drill Series API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch drill series",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/guru/drill-series
 * Trigger generation of a new drill series (requires mental model and curriculum)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
      const authError = handleAuthError(error);
      if (authError) return authError;
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const result = generateDrillSeriesSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }
    const { mentalModelArtifactId, curriculumArtifactId, userNotes } = result.data;

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Find mental model to use
    let mentalModel;
    if (mentalModelArtifactId) {
      mentalModel = await prisma.guruArtifact.findFirst({
        where: {
          id: mentalModelArtifactId,
          projectId,
          type: "MENTAL_MODEL",
          status: "COMPLETED",
        },
      });

      if (!mentalModel) {
        return NextResponse.json(
          { error: "Specified mental model not found or not completed" },
          { status: 400 }
        );
      }
    } else {
      mentalModel = await prisma.guruArtifact.findFirst({
        where: {
          projectId,
          type: "MENTAL_MODEL",
          status: "COMPLETED",
        },
        orderBy: { version: "desc" },
      });

      if (!mentalModel) {
        return NextResponse.json(
          { error: "No completed mental model found. Generate a mental model first." },
          { status: 400 }
        );
      }
    }

    // Find curriculum to use
    let curriculum;
    if (curriculumArtifactId) {
      curriculum = await prisma.guruArtifact.findFirst({
        where: {
          id: curriculumArtifactId,
          projectId,
          type: "CURRICULUM",
          status: "COMPLETED",
        },
      });

      if (!curriculum) {
        return NextResponse.json(
          { error: "Specified curriculum not found or not completed" },
          { status: 400 }
        );
      }
    } else {
      curriculum = await prisma.guruArtifact.findFirst({
        where: {
          projectId,
          type: "CURRICULUM",
          status: "COMPLETED",
        },
        orderBy: { version: "desc" },
      });

      if (!curriculum) {
        return NextResponse.json(
          { error: "No completed curriculum found. Generate a curriculum first." },
          { status: 400 }
        );
      }
    }

    // Check for existing in-progress generation (auto-clears stale ones)
    const existingGeneration = await getActiveGeneratingArtifact(projectId, "DRILL_SERIES");

    if (existingGeneration) {
      return NextResponse.json(
        {
          error: "Drill series generation already in progress",
          artifactId: existingGeneration.id,
        },
        { status: 409 }
      );
    }

    // Get next version number
    const latestVersion = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "DRILL_SERIES",
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Create placeholder artifact (depends on curriculum)
    const artifact = await prisma.guruArtifact.create({
      data: {
        projectId,
        type: "DRILL_SERIES",
        version: nextVersion,
        status: "GENERATING",
        content: {},
        dependsOnArtifactId: curriculum.id,
      },
    });

    // Trigger Inngest job
    await inngest.send({
      name: "guru/generate-drill-series",
      data: {
        projectId,
        artifactId: artifact.id,
        mentalModelArtifactId: mentalModel.id,
        curriculumArtifactId: curriculum.id,
        userNotes,
      },
    });

    return NextResponse.json({
      message: "Drill series generation started",
      artifactId: artifact.id,
      version: nextVersion,
      basedOnMentalModel: mentalModel.id,
      basedOnCurriculum: curriculum.id,
    });
  } catch (error) {
    console.error("[Drill Series API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to start drill series generation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
