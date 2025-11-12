/**
 * Project API - Get, Update, Delete by ID
 *
 * GET /api/projects/[id] - Get project details
 * PATCH /api/projects/[id] - Update project
 * DELETE /api/projects/[id] - Delete project
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Validation schema for updating a project
const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/projects/[id]
 * Get project with full details
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        contextLayers: {
          orderBy: { priority: "asc" },
        },
        knowledgeFiles: {
          orderBy: { createdAt: "desc" },
        },
        researchRuns: {
          orderBy: { createdAt: "desc" },
          take: 10, // Last 10 research runs
        },
        _count: {
          select: {
            contextLayers: true,
            knowledgeFiles: true,
            researchRuns: true,
            snapshots: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error(`[Project API] GET error for ID:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch project",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id]
 * Update project details
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate input
    const result = updateProjectSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    // Update project
    const project = await prisma.project.update({
      where: { id },
      data: result.data,
      include: {
        _count: {
          select: {
            contextLayers: true,
            knowledgeFiles: true,
            researchRuns: true,
          },
        },
      },
    });

    return NextResponse.json({
      project,
      message: "Project updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    console.error(`[Project API] PATCH error:`, error);
    return NextResponse.json(
      {
        error: "Failed to update project",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete project and all related data
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    // Delete project (cascade will delete related data)
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Project deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    console.error(`[Project API] DELETE error:`, error);
    return NextResponse.json(
      {
        error: "Failed to delete project",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
