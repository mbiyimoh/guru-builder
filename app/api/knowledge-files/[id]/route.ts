/**
 * Knowledge File API - Get, Update, Delete by ID
 *
 * GET /api/knowledge-files/[id] - Get file details
 * PATCH /api/knowledge-files/[id] - Update file
 * DELETE /api/knowledge-files/[id] - Delete file
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Validation schema for updating
const updateKnowledgeFileSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/knowledge-files/[id]
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const file = await prisma.knowledgeFile.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "Knowledge file not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ file });
  } catch (error) {
    console.error(`[Knowledge File API] GET error:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch knowledge file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/knowledge-files/[id]
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate input
    const result = updateKnowledgeFileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    // Update file
    const file = await prisma.knowledgeFile.update({
      where: { id },
      data: result.data,
    });

    return NextResponse.json({
      file,
      message: "Knowledge file updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Knowledge file not found" },
        { status: 404 }
      );
    }

    console.error(`[Knowledge File API] PATCH error:`, error);
    return NextResponse.json(
      {
        error: "Failed to update knowledge file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/knowledge-files/[id]
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    await prisma.knowledgeFile.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Knowledge file deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Knowledge file not found" },
        { status: 404 }
      );
    }

    console.error(`[Knowledge File API] DELETE error:`, error);
    return NextResponse.json(
      {
        error: "Failed to delete knowledge file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
