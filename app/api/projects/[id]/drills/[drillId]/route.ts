import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { softDeleteDrill, restoreDrill } from '@/lib/drills'

interface RouteParams {
  params: Promise<{ id: string; drillId: string }>
}

/**
 * GET /api/projects/[id]/drills/[drillId]
 * Get a single drill with position details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: projectId, drillId } = await params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify project ownership and fetch drill
  const drill = await prisma.drill.findFirst({
    where: {
      id: drillId,
      artifact: { project: { id: projectId, userId: user.id } },
    },
  })

  if (!drill) {
    return NextResponse.json({ error: 'Drill not found' }, { status: 404 })
  }

  // Fetch position details if linked
  let position = null
  if (drill.positionId) {
    position = await prisma.positionLibrary.findUnique({
      where: { positionId: drill.positionId },
      select: {
        id: true,
        positionId: true,
        diceRoll: true,
        asciiBoard: true,
        bestMove: true,
        bestMoveEquity: true,
      },
    })
  }

  return NextResponse.json(
    { drill, position },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * DELETE /api/projects/[id]/drills/[drillId]
 * Soft delete a drill
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: projectId, drillId } = await params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify project ownership
  const drill = await prisma.drill.findFirst({
    where: {
      id: drillId,
      artifact: { project: { id: projectId, userId: user.id } },
    },
  })

  if (!drill) {
    return NextResponse.json({ error: 'Drill not found' }, { status: 404 })
  }

  if (drill.deletedAt) {
    return NextResponse.json({ error: 'Drill already deleted' }, { status: 400 })
  }

  // Soft delete and sync
  const deleted = await softDeleteDrill(drillId)

  return NextResponse.json({ success: true, drill: deleted })
}

/**
 * PATCH /api/projects/[id]/drills/[drillId]
 * Restore a soft-deleted drill
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: projectId, drillId } = await params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify project ownership
  const drill = await prisma.drill.findFirst({
    where: {
      id: drillId,
      artifact: { project: { id: projectId, userId: user.id } },
    },
  })

  if (!drill) {
    return NextResponse.json({ error: 'Drill not found' }, { status: 404 })
  }

  if (!drill.deletedAt) {
    return NextResponse.json({ error: 'Drill is not deleted' }, { status: 400 })
  }

  // Restore and sync
  const restored = await restoreDrill(drillId)

  return NextResponse.json({ success: true, drill: restored })
}
