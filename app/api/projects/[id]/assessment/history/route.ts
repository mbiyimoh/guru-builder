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

    // Get all project assessments for this project
    const projectAssessments = await prisma.projectAssessment.findMany({
      where: { projectId },
      include: {
        assessmentDefinition: true,
      },
    })

    if (projectAssessments.length === 0) {
      return NextResponse.json({ sessions: [], config: null })
    }

    // Get all sessions from all project assessments
    const sessions = await prisma.assessmentSession.findMany({
      where: {
        projectAssessmentId: { in: projectAssessments.map(pa => pa.id) },
      },
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

    // Return first enabled assessment config info for backward compatibility
    const enabledAssessment = projectAssessments.find(pa => pa.isEnabled)

    return NextResponse.json({
      sessions: sessionsWithScores,
      config: enabledAssessment ? {
        id: enabledAssessment.id,
        isEnabled: enabledAssessment.isEnabled,
        engineUrl: enabledAssessment.assessmentDefinition.engineUrl,
      } : null,
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/assessment/history] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch assessment history' }, { status: 500 })
  }
}
