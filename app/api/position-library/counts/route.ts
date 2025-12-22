import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/position-library/counts
 * Query params: engineId (required)
 * Returns position counts grouped by game phase
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const engineId = request.nextUrl.searchParams.get('engineId')
    if (!engineId) {
      return NextResponse.json(
        { error: 'engineId query parameter is required' },
        { status: 400 }
      )
    }

    // Query position counts grouped by phase
    const counts = await prisma.positionLibrary.groupBy({
      by: ['gamePhase'],
      where: { engineId },
      _count: { id: true }
    })

    // Transform to expected format
    const result = {
      OPENING: counts.find(c => c.gamePhase === 'OPENING')?._count.id ?? 0,
      EARLY: counts.find(c => c.gamePhase === 'EARLY')?._count.id ?? 0,
      MIDDLE: counts.find(c => c.gamePhase === 'MIDDLE')?._count.id ?? 0,
      BEAROFF: counts.find(c => c.gamePhase === 'BEAROFF')?._count.id ?? 0,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Position Counts API]', error)
    return NextResponse.json(
      { error: 'Failed to fetch position counts' },
      { status: 500 }
    )
  }
}
