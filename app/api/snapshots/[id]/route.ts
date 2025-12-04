/**
 * Snapshot Detail API
 *
 * GET /api/snapshots/[id] - Get snapshot details
 * DELETE /api/snapshots/[id] - Delete snapshot
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/snapshots/[id]
 * Get detailed snapshot information including full state data
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const snapshot = await prisma.corpusSnapshot.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            userId: true,
          },
        },
        applyChangesLogs: {
          include: {
            recommendation: {
              select: {
                id: true,
                action: true,
                title: true,
                targetType: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    // Check ownership through project
    if (snapshot.project.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        name: snapshot.name,
        description: snapshot.description,
        createdAt: snapshot.createdAt,
        projectId: snapshot.projectId,
        layersData: snapshot.layersData,
        filesData: snapshot.filesData,
        changes: snapshot.applyChangesLogs.map((log) => ({
          id: log.id,
          changeType: log.changeType,
          targetType: log.targetType,
          targetId: log.targetId,
          createdAt: log.createdAt,
          recommendation: log.recommendation,
        })),
      },
    });
  } catch (error) {
    console.error("[Snapshot Detail API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch snapshot",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/snapshots/[id]
 * Delete a snapshot
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Check if snapshot exists
    const snapshot = await prisma.corpusSnapshot.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        project: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    // Check ownership through project
    if (snapshot.project.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Delete snapshot (cascade will delete associated logs)
    await prisma.corpusSnapshot.delete({
      where: { id },
    });

    console.log(`[Snapshot ${id}] Deleted: ${snapshot.name}`);

    return NextResponse.json({
      message: "Snapshot deleted successfully",
      deletedSnapshot: snapshot,
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    console.error("[Snapshot Detail API] DELETE error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete snapshot",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
