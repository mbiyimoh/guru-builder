/**
 * Project Ground Truth Config API
 *
 * GET /api/projects/[id]/ground-truth-config - Get project's GT config with engine details
 * POST /api/projects/[id]/ground-truth-config - Enable a ground truth engine for project
 * DELETE /api/projects/[id]/ground-truth-config - Disable ground truth for project
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { z } from 'zod'
import { POSITION_LIBRARY_THRESHOLDS } from '@/lib/teaching/constants'

const { MINIMUM_POSITIONS, WARNING_THRESHOLD } = POSITION_LIBRARY_THRESHOLDS

const EnableEngineSchema = z.object({
  engineId: z.string().min(1, 'Engine ID is required'),
})

function handleAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Error'
  if (message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (message === 'Forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (message === 'Project not found') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    try {
      await requireProjectOwnership(projectId)
    } catch (error) {
      const authError = handleAuthError(error)
      if (authError) return authError
    }

    // Get project's ground truth configs with engine details
    const configs = await prisma.projectGroundTruthConfig.findMany({
      where: { projectId },
      include: {
        engine: {
          select: {
            id: true,
            name: true,
            domain: true,
            description: true,
            iconUrl: true,
            engineUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Find the active (enabled) config
    const activeConfig = configs.find(c => c.isEnabled && c.engine.isActive)

    // Fetch position library stats if enabled
    let positionLibrary = null
    if (activeConfig?.engineId) {
      const counts = await prisma.positionLibrary.groupBy({
        by: ['gamePhase'],
        where: { engineId: activeConfig.engineId },
        _count: true,
      })

      const byPhase: Record<string, number> = {
        OPENING: 0,
        EARLY: 0,
        MIDDLE: 0,
        BEAROFF: 0,
      }
      for (const c of counts) {
        byPhase[c.gamePhase] = c._count
      }

      const total = Object.values(byPhase).reduce((a, b) => a + b, 0)
      const nonOpeningTotal = total - byPhase.OPENING

      positionLibrary = {
        total,
        byPhase,
        sufficientForDrills: nonOpeningTotal >= MINIMUM_POSITIONS,
        warning: nonOpeningTotal < WARNING_THRESHOLD && nonOpeningTotal >= MINIMUM_POSITIONS
          ? `Position library has only ${nonOpeningTotal} non-opening positions. Consider generating more for better drill variety.`
          : null,
      }
    }

    return NextResponse.json({
      configs,
      activeConfig: activeConfig || null,
      positionLibrary,
    })
  } catch (error) {
    console.error('Error fetching ground truth config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    try {
      await requireProjectOwnership(projectId)
    } catch (error) {
      const authError = handleAuthError(error)
      if (authError) return authError
    }

    const body = await request.json()
    const parsed = EnableEngineSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { engineId } = parsed.data

    // Verify engine exists and is active
    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId },
    })

    if (!engine || !engine.isActive) {
      return NextResponse.json(
        { error: 'Engine not found or inactive' },
        { status: 404 }
      )
    }

    // Disable any existing enabled configs for this project
    await prisma.projectGroundTruthConfig.updateMany({
      where: { projectId, isEnabled: true },
      data: { isEnabled: false },
    })

    // Create or update config for this engine
    const config = await prisma.projectGroundTruthConfig.upsert({
      where: {
        projectId_engineId: { projectId, engineId },
      },
      update: {
        isEnabled: true,
      },
      create: {
        projectId,
        engineId,
        isEnabled: true,
      },
      include: {
        engine: {
          select: {
            id: true,
            name: true,
            domain: true,
            description: true,
            iconUrl: true,
            engineUrl: true,
          },
        },
      },
    })

    // Fetch position library stats for the newly enabled engine
    const counts = await prisma.positionLibrary.groupBy({
      by: ['gamePhase'],
      where: { engineId },
      _count: true,
    })

    const byPhase: Record<string, number> = {
      OPENING: 0,
      EARLY: 0,
      MIDDLE: 0,
      BEAROFF: 0,
    }
    for (const c of counts) {
      byPhase[c.gamePhase] = c._count
    }

    const total = Object.values(byPhase).reduce((a, b) => a + b, 0)
    const nonOpeningTotal = total - byPhase.OPENING

    const positionLibrary = {
      total,
      byPhase,
      sufficientForDrills: nonOpeningTotal >= MINIMUM_POSITIONS,
      warning: nonOpeningTotal < WARNING_THRESHOLD && nonOpeningTotal >= MINIMUM_POSITIONS
        ? `Position library has only ${nonOpeningTotal} non-opening positions. Consider generating more for better drill variety.`
        : null,
    }

    return NextResponse.json({ config, positionLibrary }, { status: 201 })
  } catch (error) {
    console.error('Error enabling ground truth engine:', error)
    return NextResponse.json(
      { error: 'Failed to enable engine' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    try {
      await requireProjectOwnership(projectId)
    } catch (error) {
      const authError = handleAuthError(error)
      if (authError) return authError
    }

    // Disable all ground truth configs for this project
    await prisma.projectGroundTruthConfig.updateMany({
      where: { projectId },
      data: { isEnabled: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disabling ground truth:', error)
    return NextResponse.json(
      { error: 'Failed to disable ground truth' },
      { status: 500 }
    )
  }
}
