import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/match-import/scrape
 *
 * Triggers the automated scraper to fetch match archives from a collection
 * (currently only Hardy's Backgammon Pages) and import them directly into
 * the position library.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { collection, engineId } = body as {
      collection?: string
      engineId?: string
    }

    // Validate collection
    if (!collection || collection !== 'Hardy') {
      return NextResponse.json(
        { error: 'Invalid collection. Currently only "Hardy" is supported.' },
        { status: 400 }
      )
    }

    // Validate engineId
    if (!engineId) {
      return NextResponse.json(
        { error: 'engineId is required' },
        { status: 400 }
      )
    }

    // Verify the engine exists
    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId },
    })

    if (!engine) {
      return NextResponse.json(
        { error: 'Ground truth engine not found' },
        { status: 404 }
      )
    }

    // Trigger the scraper job
    const eventId = await inngest.send({
      name: 'match-archive/scrape.started',
      data: {
        collection: 'Hardy',
        engineId,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Scrape job started for ${collection} collection`,
      eventId,
      collection,
      engineId,
    })
  } catch (error) {
    console.error('[API] Failed to start scrape job:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start scrape job' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/match-import/scrape
 *
 * Returns information about the available collections and current scrape status.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get counts of archives by collection
    const archiveCounts = await prisma.matchArchive.groupBy({
      by: ['sourceCollection'],
      _count: true,
    })

    // Get total positions by collection
    const positionCounts = await prisma.positionLibrary.groupBy({
      by: ['sourceType'],
      where: {
        sourceType: 'MATCH_IMPORT',
      },
      _count: true,
    })

    const collections = [
      {
        id: 'Hardy',
        name: "Hardy's Backgammon Pages",
        url: 'https://www.hardyhuebener.de/engl/matches.html',
        estimatedMatches: 100,
        estimatedPositions: 14000,
        importedArchives: archiveCounts.find(c => c.sourceCollection === 'Hardy')?._count ?? 0,
        status: 'available',
      },
      {
        id: 'BigBrother',
        name: 'Big Brother Collection',
        estimatedMatches: 3000,
        estimatedPositions: 600000,
        importedArchives: archiveCounts.find(c => c.sourceCollection === 'BigBrother')?._count ?? 0,
        status: 'coming_soon',
      },
      {
        id: 'LittleSister',
        name: 'LittleSister Collection',
        estimatedMatches: 20000,
        estimatedPositions: 4000000,
        importedArchives: archiveCounts.find(c => c.sourceCollection === 'LittleSister')?._count ?? 0,
        status: 'coming_soon',
      },
    ]

    const totalImportedPositions = positionCounts.reduce((sum, c) => sum + c._count, 0)

    return NextResponse.json({
      collections,
      totalImportedPositions,
    })
  } catch (error) {
    console.error('[API] Failed to get scrape info:', error)
    return NextResponse.json(
      { error: 'Failed to get scrape information' },
      { status: 500 }
    )
  }
}
