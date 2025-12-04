// app/api/projects/[id]/assessment/results/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { saveResultSchema } from '@/lib/assessment/validation'
import { errorResponse, validationErrorResponse } from '@/lib/apiHelpers'

export async function POST(
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

    const body = await request.json()

    const parsed = saveResultSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.format())
    }

    const { sessionId, diceRoll, guruResponse, bestMoves, guruMatchedBest } = parsed.data

    // Use transaction to ensure both operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Verify session exists first
      const session = await tx.assessmentSession.findUnique({
        where: { id: sessionId },
      })

      if (!session) {
        throw new Error('SESSION_NOT_FOUND')
      }

      const newResult = await tx.assessmentResult.create({
        data: {
          sessionId,
          diceRoll,
          guruResponse,
          bestMoves,
          guruMatchedBest,
        },
      })

      // Update session's lastResultId for "Continue Session" feature
      await tx.assessmentSession.update({
        where: { id: sessionId },
        data: { lastResultId: newResult.id },
      })

      return newResult
    })

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof Error && error.message === 'SESSION_NOT_FOUND') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return errorResponse('save assessment result', error)
  }
}
