/**
 * Snapshots API - List
 *
 * GET /api/projects/[id]/snapshots - List snapshots for a project
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
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
