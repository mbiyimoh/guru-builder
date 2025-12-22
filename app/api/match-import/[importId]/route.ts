/**
 * Match Import Status API
 *
 * GET - Get import status and progress for a specific archive
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ importId: string }>
}

/**
 * GET /api/match-import/[importId]
 *
 * Get the current status and progress of an import.
 *
 * Response:
 * - id: Archive ID
 * - status: Current import status
 * - progress: Percentage complete (0-100)
 * - filename: Original filename
 * - matches: List of imported matches
 * - ...other archive fields
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { importId } = await params

    const archive = await prisma.matchArchive.findUnique({
      where: { id: importId },
      include: {
        matches: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            tournamentName: true,
            matchLength: true,
            player1Name: true,
            player1Country: true,
            player2Name: true,
            player2Country: true,
            totalGames: true,
            winner: true,
            createdAt: true
          }
        }
      }
    })

    if (!archive) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    // Calculate progress percentage
    const progress = archive.totalPositions > 0
      ? Math.round((archive.positionsVerified / archive.totalPositions) * 100)
      : 0

    return NextResponse.json({
      id: archive.id,
      status: archive.importStatus,
      filename: archive.filename,
      sourceCollection: archive.sourceCollection,
      totalMatches: archive.totalMatches,
      totalGames: archive.totalGames,
      totalPositions: archive.totalPositions,
      positionsVerified: archive.positionsVerified,
      progress,
      errorMessage: archive.errorMessage,
      createdAt: archive.createdAt,
      completedAt: archive.completedAt,
      matches: archive.matches
    }, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('[Import Status API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch import status' },
      { status: 500 }
    )
  }
}
