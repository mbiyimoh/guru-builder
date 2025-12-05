/**
 * Curriculum Generation API
 *
 * POST /api/projects/[id]/guru/curriculum - Trigger curriculum generation
 * GET /api/projects/[id]/guru/curriculum - Get latest curriculum
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwnership } from "@/lib/auth";
import { inngest } from "@/lib/inngest";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const generateCurriculumSchema = z.object({
  mentalModelArtifactId: z.string().optional(), // If not provided, uses latest
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
 * GET /api/projects/[id]/guru/curriculum
 * Get the latest completed curriculum for the project
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

    const curriculum = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "CURRICULUM",
        status: "COMPLETED",
      },
      orderBy: { version: "desc" },
      include: {
        dependsOn: {
          select: { id: true, type: true, version: true },
        },
      },
    });

    // Also check for any in-progress generation
    const generating = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "CURRICULUM",
        status: "GENERATING",
      },
      orderBy: { generatedAt: "desc" },
    });

    return NextResponse.json(
      {
        curriculum,
        generating,
        hasCompleted: !!curriculum,
        isGenerating: !!generating,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Curriculum API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch curriculum",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/guru/curriculum
 * Trigger generation of a new curriculum (requires mental model)
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
    const result = generateCurriculumSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }
    const { mentalModelArtifactId, userNotes } = result.data;

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
      // Use latest completed mental model
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

    // Check for existing in-progress generation
    const existingGeneration = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "CURRICULUM",
        status: "GENERATING",
      },
    });

    if (existingGeneration) {
      return NextResponse.json(
        {
          error: "Curriculum generation already in progress",
          artifactId: existingGeneration.id,
        },
        { status: 409 }
      );
    }

    // Get next version number
    const latestVersion = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "CURRICULUM",
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Create placeholder artifact
    const artifact = await prisma.guruArtifact.create({
      data: {
        projectId,
        type: "CURRICULUM",
        version: nextVersion,
        status: "GENERATING",
        content: {},
        dependsOnArtifactId: mentalModel.id,
      },
    });

    // Trigger Inngest job
    await inngest.send({
      name: "guru/generate-curriculum",
      data: {
        projectId,
        artifactId: artifact.id,
        mentalModelArtifactId: mentalModel.id,
        userNotes,
      },
    });

    return NextResponse.json({
      message: "Curriculum generation started",
      artifactId: artifact.id,
      version: nextVersion,
      basedOnMentalModel: mentalModel.id,
    });
  } catch (error) {
    console.error("[Curriculum API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to start curriculum generation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
