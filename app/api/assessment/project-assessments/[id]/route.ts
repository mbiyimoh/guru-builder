/**
 * Project Assessment API - Individual operations
 *
 * GET /api/assessment/project-assessments/[id] - Get single assignment
 * PATCH /api/assessment/project-assessments/[id] - Update (enable/disable)
 * DELETE /api/assessment/project-assessments/[id] - Remove assignment
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { updateProjectAssessmentSchema } from '@/lib/assessment/validation'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/assessment/project-assessments/[id]
 * Get a single project assessment with session count
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const projectAssessment = await prisma.projectAssessment.findUnique({
      where: { id },
      include: {
        assessmentDefinition: true,
        project: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        _count: {
          select: {
            sessions: true,
          },
        },
      },
    })

    if (!projectAssessment) {
      return NextResponse.json(
        { error: 'Project assessment not found' },
        { status: 404 }
      )
    }

    // Verify ownership via project
    if (projectAssessment.project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ projectAssessment })
  } catch (error) {
    console.error('[Project Assessment API] GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch project assessment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/assessment/project-assessments/[id]
 * Update project assessment (typically to enable/disable)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership via project
    const existing = await prisma.projectAssessment.findUnique({
      where: { id },
      include: {
        project: {
          select: { userId: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Project assessment not found' },
        { status: 404 }
      )
    }

    if (existing.project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const result = updateProjectAssessmentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.format(),
        },
        { status: 400 }
      )
    }

    const projectAssessment = await prisma.projectAssessment.update({
      where: { id },
      data: result.data,
      include: {
        assessmentDefinition: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      projectAssessment,
      message: 'Project assessment updated successfully',
    })
  } catch (error) {
    console.error('[Project Assessment API] PATCH error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update project assessment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assessment/project-assessments/[id]
 * Remove an assessment from a project
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership via project
    const existing = await prisma.projectAssessment.findUnique({
      where: { id },
      include: {
        project: {
          select: { userId: true, name: true },
        },
        assessmentDefinition: {
          select: { name: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Project assessment not found' },
        { status: 404 }
      )
    }

    if (existing.project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete (cascade will remove sessions)
    await prisma.projectAssessment.delete({
      where: { id },
    })

    return NextResponse.json({
      message: `Assessment "${existing.assessmentDefinition.name}" removed from project "${existing.project.name}"`,
    })
  } catch (error) {
    console.error('[Project Assessment API] DELETE error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete project assessment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
