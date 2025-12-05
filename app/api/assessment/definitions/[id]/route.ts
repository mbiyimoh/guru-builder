/**
 * Assessment Definition API - Individual operations
 *
 * GET /api/assessment/definitions/[id] - Get single definition
 * PATCH /api/assessment/definitions/[id] - Update definition
 * DELETE /api/assessment/definitions/[id] - Delete definition
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { updateAssessmentDefinitionSchema } from '@/lib/assessment/validation'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/assessment/definitions/[id]
 * Get a single assessment definition with its project assignments
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const definition = await prisma.assessmentDefinition.findUnique({
      where: { id },
      include: {
        projectAssessments: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            projectAssessments: true,
          },
        },
      },
    })

    if (!definition) {
      return NextResponse.json(
        { error: 'Assessment definition not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (definition.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ definition })
  } catch (error) {
    console.error('[Assessment Definition API] GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch assessment definition',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/assessment/definitions/[id]
 * Update an assessment definition
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const existing = await prisma.assessmentDefinition.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Assessment definition not found' },
        { status: 404 }
      )
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const result = updateAssessmentDefinitionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.format(),
        },
        { status: 400 }
      )
    }

    const definition = await prisma.assessmentDefinition.update({
      where: { id },
      data: result.data,
      include: {
        _count: {
          select: {
            projectAssessments: true,
          },
        },
      },
    })

    return NextResponse.json({
      definition,
      message: 'Assessment definition updated successfully',
    })
  } catch (error) {
    console.error('[Assessment Definition API] PATCH error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update assessment definition',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assessment/definitions/[id]
 * Delete an assessment definition and all its project assignments
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const existing = await prisma.assessmentDefinition.findUnique({
      where: { id },
      select: { userId: true, name: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Assessment definition not found' },
        { status: 404 }
      )
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete (cascade will remove project assignments and sessions)
    await prisma.assessmentDefinition.delete({
      where: { id },
    })

    return NextResponse.json({
      message: `Assessment definition "${existing.name}" deleted successfully`,
    })
  } catch (error) {
    console.error('[Assessment Definition API] DELETE error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete assessment definition',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
