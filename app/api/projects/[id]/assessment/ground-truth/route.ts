// app/api/projects/[id]/assessment/ground-truth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import {
  getBackgammonGroundTruthWithRetry,
  parseDiceRoll,
} from '@/lib/assessment/backgammonEngine'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { groundTruthRequestSchema } from '@/lib/assessment/validation'

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

    const parsed = groundTruthRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { diceRoll } = parsed.data

    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId },
    })

    if (!config || !config.isEnabled) {
      return NextResponse.json(
        { error: 'Assessment not configured for this project' },
        { status: 404 }
      )
    }

    const dice = parseDiceRoll(diceRoll)
    if (!dice) {
      return NextResponse.json({ error: 'Invalid dice roll format' }, { status: 400 })
    }

    const bestMoves = await getBackgammonGroundTruthWithRetry(dice, config.engineUrl)

    if (bestMoves.length === 0) {
      return NextResponse.json(
        {
          error: 'No moves returned',
          debug: { diceRoll, engineUrl: config.engineUrl },
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      bestMoves,
      diceRoll,
      message: 'Ground truth retrieved successfully',
    })
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/ground-truth] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to query GNU Backgammon engine',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
