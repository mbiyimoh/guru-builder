/**
 * Project Ground Truth Config API
 *
 * GET /api/projects/[id]/ground-truth-config - Get project's GT config with engine details
 * POST /api/projects/[id]/ground-truth-config - Enable a ground truth engine for project
 * DELETE /api/projects/[id]/ground-truth-config - Disable ground truth for project
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const EnableEngineSchema = z.object({
  engineId: z.string().min(1, 'Engine ID is required'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    return NextResponse.json({
      configs,
      activeConfig: activeConfig || null,
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
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    return NextResponse.json({ config }, { status: 201 })
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
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
