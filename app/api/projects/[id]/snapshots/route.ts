/**
 * Snapshots API - List
 *
 * GET /api/projects/[id]/snapshots - List snapshots for a project
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectOwnership } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/projects/[id]/snapshots
 * List all snapshots for a project
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: projectId } = await context.params;

    // Auth check
    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
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
    }

    // Fetch snapshots
    const snapshots = await prisma.corpusSnapshot.findMany({
      where: { projectId },
      include: {
        _count: {
          select: {
            applyChangesLogs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        name: snapshot.name,
        description: snapshot.description,
        createdAt: snapshot.createdAt,
        changesCount: snapshot._count.applyChangesLogs,
      })),
      total: snapshots.length,
    });
  } catch (error) {
    console.error("[Snapshots API] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch snapshots",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
