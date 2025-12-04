import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { calculateSessionScore } from '@/lib/assessment/scoreCalculation'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

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

    // Get config first
    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId },
    })

    if (!config) {
      return NextResponse.json({ sessions: [], config: null })
    }

    // Get all sessions with their results
    const sessions = await prisma.assessmentSession.findMany({
      where: { configId: config.id },
      orderBy: { startedAt: 'desc' },
      include: {
        results: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            diceRoll: true,
            guruMatchedBest: true,
            userRating: true,
            createdAt: true,
          },
        },
      },
    })

    // Calculate scores for each session
    const sessionsWithScores = sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      lastResultId: session.lastResultId,
      resultCount: session.results.length,
      score: calculateSessionScore(session.results),
      results: session.results,
    }))

    return NextResponse.json({
      sessions: sessionsWithScores,
      config: {
        id: config.id,
        isEnabled: config.isEnabled,
        engineUrl: config.engineUrl,
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/assessment/history] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch assessment history' }, { status: 500 })
  }
}
