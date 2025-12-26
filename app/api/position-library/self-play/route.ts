/**
 * Self-Play Position Generation API
 *
 * POST - Start a new self-play generation batch
 * GET  - List recent batches
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, checkAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { inngest } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

/**
 * POST /api/position-library/self-play
 *
 * Start a new self-play generation batch
 */
export async function POST(request: NextRequest) {
  // Positions are shared across all projects for an engine, so any authenticated user
  // can trigger self-play to contribute to the shared position library
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { engineId, gamesCount, skipOpening = true } = body

    // Validate required fields
    if (!engineId) {
      return NextResponse.json({ error: 'engineId is required' }, { status: 400 })
    }

    // Validate gamesCount (1-100)
    const games = parseInt(gamesCount, 10)
    if (isNaN(games) || games < 1 || games > 100) {
      return NextResponse.json(
        { error: 'gamesCount must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Verify engine exists and is active
    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId },
    })

    if (!engine) {
      return NextResponse.json({ error: 'Engine not found' }, { status: 404 })
    }

    if (!engine.isActive) {
      return NextResponse.json({ error: 'Engine is not active' }, { status: 400 })
    }

    // Create the batch record
    const batch = await prisma.selfPlayBatch.create({
      data: {
        engineId,
        gamesRequested: games,
        skipOpening: Boolean(skipOpening),
        status: 'PENDING',
      },
    })

    // Trigger the Inngest job
    await inngest.send({
      name: 'position-library/self-play.started',
      data: {
        batchId: batch.id,
        engineId,
        gamesCount: games,
        skipOpening: Boolean(skipOpening),
      },
    })

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      gamesRequested: games,
      skipOpening: Boolean(skipOpening),
      status: 'PENDING',
    })
  } catch (error) {
    console.error('[Self-Play API] Error starting batch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start self-play batch' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/position-library/self-play
 *
 * List recent self-play batches
 */
export async function GET() {
  // Check admin authentication
  const { authorized, user } = await checkAdminAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  try {
    const batches = await prisma.selfPlayBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        engine: {
          select: {
            name: true,
          },
        },
      },
    })

    // Get total position library stats
    const positionStats = await prisma.positionLibrary.groupBy({
      by: ['gamePhase'],
      _count: true,
    })

    const totalByPhase: Record<string, number> = {
      OPENING: 0,
      EARLY: 0,
      MIDDLE: 0,
      BEAROFF: 0,
    }
    for (const stat of positionStats) {
      totalByPhase[stat.gamePhase] = stat._count
    }

    return NextResponse.json({
      batches: batches.map((batch) => ({
        id: batch.id,
        engineName: batch.engine.name,
        gamesRequested: batch.gamesRequested,
        gamesCompleted: batch.gamesCompleted,
        positionsStored: batch.positionsStored,
        duplicatesSkipped: batch.duplicatesSkipped,
        status: batch.status,
        byPhase: {
          OPENING: batch.openingCount,
          EARLY: batch.earlyCount,
          MIDDLE: batch.middleCount,
          BEAROFF: batch.bearoffCount,
        },
        errors: batch.errors.length,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
      })),
      positionLibraryTotals: totalByPhase,
      totalPositions: Object.values(totalByPhase).reduce((a, b) => a + b, 0),
    })
  } catch (error) {
    console.error('[Self-Play API] Error listing batches:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list batches' },
      { status: 500 }
    )
  }
}
