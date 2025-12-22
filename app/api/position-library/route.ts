import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/position-library
 * List positions in the position library with optional filtering and pagination.
 *
 * Query params:
 * - engineId: Filter by ground truth engine
 * - gamePhase: Filter by game phase (OPENING, EARLY, MIDDLE, BEAROFF)
 * - limit: Number of positions to return (default: 20, max: 100)
 * - offset: Number of positions to skip (for pagination)
 */
export async function GET(request: Request) {
  try {
    // Authentication check
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gamePhase = searchParams.get('gamePhase')
    const engineId = searchParams.get('engineId')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    // Parse pagination params with defaults
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100)
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0)

    const where: Record<string, unknown> = {}
    if (gamePhase) {
      where.gamePhase = gamePhase
    }
    if (engineId) {
      where.engineId = engineId
    }

    // Get total count for pagination
    const totalCount = await prisma.positionLibrary.count({ where })

    const positions = await prisma.positionLibrary.findMany({
      where,
      orderBy: [
        { gamePhase: 'asc' },
        { diceRoll: 'asc' }
      ],
      include: {
        engine: {
          select: {
            id: true,
            name: true,
            domain: true
          }
        },
        archive: {
          select: {
            filename: true,
            sourceCollection: true
          }
        },
        match: {
          select: {
            player1Name: true,
            player1Country: true,
            player2Name: true,
            player2Country: true,
            tournamentName: true,
            matchLength: true
          }
        }
      },
      take: limit,
      skip: offset
    })

    // Get counts by phase (for the current filter, excluding gamePhase filter)
    const countsWhere: Record<string, unknown> = {}
    if (engineId) {
      countsWhere.engineId = engineId
    }

    const counts = await prisma.positionLibrary.groupBy({
      by: ['gamePhase'],
      where: countsWhere,
      _count: { id: true }
    })

    const countByPhase = counts.reduce((acc, item) => {
      acc[item.gamePhase] = item._count.id
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      positions,
      counts: countByPhase,
      total: totalCount,
      pagination: {
        limit,
        offset,
        hasMore: offset + positions.length < totalCount
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[Position Library GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}
