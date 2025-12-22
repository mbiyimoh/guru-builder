import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
    positionId: string
  }>
}

/**
 * GET /api/projects/[id]/positions/[positionId]
 * Fetch a single position with match/archive context for attribution display.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: projectId, positionId } = await params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get the project's ground truth config to find which engine is configured
  const gtConfig = await prisma.projectGroundTruthConfig.findFirst({
    where: {
      projectId: projectId,
      isEnabled: true,
    },
    select: { engineId: true },
  })

  if (!gtConfig) {
    return NextResponse.json({ error: 'No ground truth engine configured' }, { status: 400 })
  }

  // Fetch position that belongs to the configured engine
  const position = await prisma.positionLibrary.findFirst({
    where: {
      positionId: positionId,
      engineId: gtConfig.engineId,
    },
  })

  if (!position) {
    // Check if position exists with a different engine
    const positionWithDifferentEngine = await prisma.positionLibrary.findFirst({
      where: { positionId: positionId },
      select: { engineId: true },
    })

    if (positionWithDifferentEngine) {
      return NextResponse.json(
        {
          error: 'Position exists but was generated with a different ground truth engine',
          details: {
            requestedEngine: gtConfig.engineId,
            positionEngine: positionWithDifferentEngine.engineId,
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ error: 'Position not found' }, { status: 404 })
  }

  // Fetch match and archive separately if IDs exist
  let matchData = null
  let archiveData = null

  if (position.matchId) {
    const match = await prisma.importedMatch.findUnique({
      where: { id: position.matchId },
      select: {
        player1Name: true,
        player1Country: true,
        player2Name: true,
        player2Country: true,
        tournamentName: true,
        matchLength: true,
      },
    })
    if (match) {
      matchData = {
        player1Name: match.player1Name,
        player1Country: match.player1Country,
        player2Name: match.player2Name,
        player2Country: match.player2Country,
        tournamentName: match.tournamentName,
        matchLength: match.matchLength,
      }
    }
  }

  if (position.archiveId) {
    const archive = await prisma.matchArchive.findUnique({
      where: { id: position.archiveId },
      select: {
        filename: true,
        sourceCollection: true,
      },
    })
    if (archive) {
      archiveData = {
        filename: archive.filename,
        sourceCollection: archive.sourceCollection,
      }
    }
  }

  return NextResponse.json(
    {
      position: {
        id: position.id,
        positionId: position.positionId,
        gamePhase: position.gamePhase,
        diceRoll: position.diceRoll,
        asciiBoard: position.asciiBoard,
        bestMove: position.bestMove,
        bestMoveEquity: position.bestMoveEquity,
        secondBestMove: position.secondBestMove,
        secondEquity: position.secondEquity,
        thirdBestMove: position.thirdBestMove,
        thirdEquity: position.thirdEquity,
        sourceType: position.sourceType,
        gameNumber: position.gameNumber,
        moveNumber: position.moveNumber,
        match: matchData,
        archive: archiveData,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
