/**
 * Self-Play Batch Status API
 *
 * GET - Get details for a specific batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/position-library/self-play/[batchId]
 *
 * Get details for a specific self-play batch
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  // Check admin authentication
  const { authorized, user } = await checkAdminAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  try {
    const { batchId } = await params

    const batch = await prisma.selfPlayBatch.findUnique({
      where: { id: batchId },
      include: {
        engine: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Calculate progress percentage
    const progress =
      batch.gamesRequested > 0
        ? Math.round((batch.gamesCompleted / batch.gamesRequested) * 100)
        : 0

    return NextResponse.json({
      id: batch.id,
      engine: batch.engine,
      gamesRequested: batch.gamesRequested,
      gamesCompleted: batch.gamesCompleted,
      skipOpening: batch.skipOpening,
      status: batch.status,
      progress,
      positionsStored: batch.positionsStored,
      duplicatesSkipped: batch.duplicatesSkipped,
      byPhase: {
        OPENING: batch.openingCount,
        EARLY: batch.earlyCount,
        MIDDLE: batch.middleCount,
        BEAROFF: batch.bearoffCount,
      },
      errors: batch.errors,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
    })
  } catch (error) {
    console.error('[Self-Play API] Error fetching batch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch batch' },
      { status: 500 }
    )
  }
}
