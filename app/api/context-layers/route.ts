/**
 * Context Layers API - List and Create
 *
 * GET /api/context-layers?projectId=xxx - List layers for project
 * POST /api/context-layers - Create new context layer
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";

// Validation schema
const createContextLayerSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  priority: z.number().int().min(1),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/context-layers
 * List context layers for a project
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
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query parameter is required" },
        { status: 400 }
      );
    }

    const layers = await prisma.contextLayer.findMany({
      where: {
        projectId,
        project: {
          userId: user.id,
        },
      },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({
      layers,
      total: layers.length,
      activeCount: layers.filter((l) => l.isActive).length,
    });
  } catch (error) {
    console.error("[Context Layers API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch context layers",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/context-layers
 * Create new context layer
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const result = createContextLayerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    // Check project ownership
    const project = await prisma.project.findUnique({
      where: { id: result.data.projectId },
      select: { userId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Check for priority conflict
    const existingLayer = await prisma.contextLayer.findFirst({
      where: {
        projectId: result.data.projectId,
        priority: result.data.priority,
      },
    });

    if (existingLayer) {
      return NextResponse.json(
        {
          error: "Priority conflict",
          message: `A context layer with priority ${result.data.priority} already exists. Please choose a different priority.`,
        },
        { status: 409 }
      );
    }

    // Create context layer
    const layer = await prisma.contextLayer.create({
      data: result.data,
    });

    return NextResponse.json(
      {
        layer,
        message: "Context layer created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Context Layers API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to create context layer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
