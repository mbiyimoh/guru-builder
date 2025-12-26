/**
 * Mental Model Generation API
 *
 * POST /api/projects/[id]/guru/mental-model - Trigger mental model generation
 * GET /api/projects/[id]/guru/mental-model - Get latest mental model
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwnership } from "@/lib/auth";
import { inngest } from "@/lib/inngest";
import { z } from "zod";
import { getActiveGeneratingArtifact } from "@/lib/teaching/staleArtifactHandler";
import { getInitialProgressStage } from "@/lib/teaching/constants";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const generateMentalModelSchema = z.object({
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
 * GET /api/projects/[id]/guru/mental-model
 * Get the latest completed mental model for the project
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

    const mentalModel = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "MENTAL_MODEL",
        status: "COMPLETED",
      },
      orderBy: { version: "desc" },
    });

    // Check for active generation (auto-clears stale ones)
    const generating = await getActiveGeneratingArtifact(projectId, "MENTAL_MODEL");

    return NextResponse.json(
      {
        mentalModel,
        generating,
        hasCompleted: !!mentalModel,
        isGenerating: !!generating,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Mental Model API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch mental model",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/guru/mental-model
 * Trigger generation of a new mental model
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
    const result = generateMentalModelSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }
    const { userNotes } = result.data;

    // Check project exists and has corpus content
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contextLayers: { select: { id: true } },
        knowledgeFiles: { select: { id: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.contextLayers.length === 0 && project.knowledgeFiles.length === 0) {
      return NextResponse.json(
        { error: "Cannot generate mental model from empty corpus. Add context layers or knowledge files first." },
        { status: 400 }
      );
    }

    // Check for existing in-progress generation (auto-clears stale ones)
    const existingGeneration = await getActiveGeneratingArtifact(projectId, "MENTAL_MODEL");

    if (existingGeneration) {
      return NextResponse.json(
        {
          error: "Mental model generation already in progress",
          artifactId: existingGeneration.id,
        },
        { status: 409 }
      );
    }

    // Get next version number
    const latestVersion = await prisma.guruArtifact.findFirst({
      where: {
        projectId,
        type: "MENTAL_MODEL",
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Create placeholder artifact with initial progress stage for UI feedback
    console.log("[Mental Model API] Creating artifact...", { projectId, nextVersion });
    const artifact = await prisma.guruArtifact.create({
      data: {
        projectId,
        type: "MENTAL_MODEL",
        version: nextVersion,
        status: "GENERATING",
        progressStage: getInitialProgressStage("MENTAL_MODEL"),
        content: {},
      },
    });
    console.log("[Mental Model API] Artifact created:", artifact.id);

    // Trigger Inngest job
    console.log("[Mental Model API] Sending Inngest event guru/generate-mental-model...");
    try {
      const sendResult = await inngest.send({
        name: "guru/generate-mental-model",
        data: {
          projectId,
          artifactId: artifact.id,
          userNotes,
        },
      });
      console.log("[Mental Model API] Inngest event sent successfully:", sendResult);
    } catch (inngestError) {
      console.error("[Mental Model API] Inngest event FAILED:", inngestError);
      // Don't fail the request - we still created the artifact
    }

    return NextResponse.json({
      message: "Mental model generation started",
      artifactId: artifact.id,
      version: nextVersion,
    });
  } catch (error) {
    console.error("[Mental Model API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to start mental model generation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
