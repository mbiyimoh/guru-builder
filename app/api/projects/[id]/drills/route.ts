import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { syncArtifactContent } from '@/lib/drills'
import { z } from 'zod'
import type { GamePhase, DrillTier, Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/drills
 * List drills with optional filtering
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const artifactId = searchParams.get('artifactId')
  const phase = searchParams.get('phase') as GamePhase | null
  const includeDeleted = searchParams.get('includeDeleted') === 'true'

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const drills = await prisma.drill.findMany({
    where: {
      artifact: { projectId },
      ...(artifactId && { artifactId }),
      ...(phase && { gamePhase: phase }),
      ...(!includeDeleted && { deletedAt: null }),
    },
    orderBy: [{ gamePhase: 'asc' }, { orderIndex: 'asc' }],
  })

  return NextResponse.json(
    { drills },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * POST /api/projects/[id]/drills
 * Create new drills (add mode)
 */
const createDrillsSchema = z.object({
  artifactId: z.string(),
  drills: z.array(
    z.object({
      gamePhase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']),
      positionId: z.string().optional(),
      content: z.record(z.unknown()),
      drillId: z.string(),
      tier: z.enum(['RECOGNITION', 'APPLICATION', 'TRANSFER']),
      principleIds: z.array(z.string()),
    })
  ),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createDrillsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { artifactId, drills } = parsed.data

  // Verify artifact ownership
  const artifact = await prisma.guruArtifact.findFirst({
    where: { id: artifactId, project: { id: projectId, userId: user.id } },
  })
  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  // Get max order index per phase
  const maxIndexes = await prisma.drill.groupBy({
    by: ['gamePhase'],
    where: { artifactId, deletedAt: null },
    _max: { orderIndex: true },
  })
  const maxIndexMap = new Map(
    maxIndexes.map((m) => [m.gamePhase, m._max.orderIndex ?? -1])
  )

  // Create drills with correct ordering
  const drillsToCreate: Prisma.DrillCreateManyInput[] = drills.map((drill) => {
    const currentMax = maxIndexMap.get(drill.gamePhase as GamePhase) ?? -1
    const newIndex = currentMax + 1
    maxIndexMap.set(drill.gamePhase as GamePhase, newIndex)

    return {
      artifactId,
      positionId: drill.positionId || null,
      gamePhase: drill.gamePhase as GamePhase,
      orderIndex: newIndex,
      content: drill.content as Prisma.InputJsonValue,
      drillId: drill.drillId,
      tier: drill.tier as DrillTier,
      principleIds: drill.principleIds,
    }
  })

  await prisma.drill.createMany({ data: drillsToCreate })

  // Sync artifact content
  await syncArtifactContent(artifactId)

  return NextResponse.json({
    success: true,
    created: drillsToCreate.length,
  })
}
