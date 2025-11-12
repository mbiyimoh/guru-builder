/**
 * Context Layer API - Get, Update, Delete by ID
 *
 * GET /api/context-layers/[id] - Get layer details
 * PATCH /api/context-layers/[id] - Update layer
 * DELETE /api/context-layers/[id] - Delete layer
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Validation schema for updating
const updateContextLayerSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  priority: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/context-layers/[id]
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const layer = await prisma.contextLayer.findUnique({
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

    if (!layer) {
      return NextResponse.json(
        { error: "Context layer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ layer });
  } catch (error) {
    console.error(`[Context Layer API] GET error:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch context layer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/context-layers/[id]
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate input
    const result = updateContextLayerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.format(),
        },
        { status: 400 }
      );
    }

    // If priority is being updated, check for conflicts
    if (result.data.priority !== undefined) {
      const currentLayer = await prisma.contextLayer.findUnique({
        where: { id },
        select: { projectId: true, priority: true },
      });

      if (!currentLayer) {
        return NextResponse.json(
          { error: "Context layer not found" },
          { status: 404 }
        );
      }

      // Only check if priority is actually changing
      if (currentLayer.priority !== result.data.priority) {
        const existingLayer = await prisma.contextLayer.findFirst({
          where: {
            projectId: currentLayer.projectId,
            priority: result.data.priority,
            id: { not: id },
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
      }
    }

    // Update layer
    const layer = await prisma.contextLayer.update({
      where: { id },
      data: result.data,
    });

    return NextResponse.json({
      layer,
      message: "Context layer updated successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Context layer not found" },
        { status: 404 }
      );
    }

    console.error(`[Context Layer API] PATCH error:`, error);
    return NextResponse.json(
      {
        error: "Failed to update context layer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/context-layers/[id]
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    await prisma.contextLayer.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Context layer deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Context layer not found" },
        { status: 404 }
      );
    }

    console.error(`[Context Layer API] DELETE error:`, error);
    return NextResponse.json(
      {
        error: "Failed to delete context layer",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
