/**
 * Knowledge Files API - List and Create
 *
 * GET /api/knowledge-files?projectId=xxx - List files for project
 * POST /api/knowledge-files - Create new knowledge file
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";

// Validation schema
const createKnowledgeFileSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  content: z.string().min(1),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/knowledge-files
 * List knowledge files for a project
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

    const files = await prisma.knowledgeFile.findMany({
      where: {
        projectId,
        project: {
          userId: user.id,
        },
      },
      orderBy: [
        { category: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Group by category
    const grouped = files.reduce((acc, file) => {
      const category = file.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(file);
      return acc;
    }, {} as Record<string, typeof files>);

    return NextResponse.json({
      files,
      grouped,
      total: files.length,
      activeCount: files.filter((f) => f.isActive).length,
    });
  } catch (error) {
    console.error("[Knowledge Files API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch knowledge files",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/knowledge-files
 * Create new knowledge file
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
    const result = createKnowledgeFileSchema.safeParse(body);
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

    // Create knowledge file
    const file = await prisma.knowledgeFile.create({
      data: result.data,
    });

    return NextResponse.json(
      {
        file,
        message: "Knowledge file created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Knowledge Files API] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to create knowledge file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
