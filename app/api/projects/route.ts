/**
 * Projects API - List and Create
 *
 * GET /api/projects - List user's projects
 * POST /api/projects - Create new project
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

// Validation schema for creating a project
const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
});

/**
 * GET /api/projects
 * List user's projects with their counts
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            contextLayers: true,
            knowledgeFiles: true,
            researchRuns: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      projects,
      total: projects.length,
    });
  } catch (error) {
    console.error("[Projects API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch projects",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const result = createProjectSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    const { name, description } = result.data;

    // Create project assigned to current user
    const project = await prisma.project.create({
      data: {
        name,
        description,
        userId: user.id,
      },
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

    return NextResponse.json(
      {
        project,
        message: "Project created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Projects API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to create project",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
