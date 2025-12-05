/**
 * Project Assessments API - Link definitions to projects
 *
 * GET /api/assessment/project-assessments - List assignments (optionally by project)
 * POST /api/assessment/project-assessments - Assign definition to project
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { createProjectAssessmentSchema } from '@/lib/assessment/validation'

/**
 * GET /api/assessment/project-assessments
 * List project assessments, optionally filtered by projectId
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // Build where clause
    const where = projectId
      ? {
          projectId,
          project: { userId: user.id },
        }
      : {
          project: { userId: user.id },
        }

    const projectAssessments = await prisma.projectAssessment.findMany({
      where,
      include: {
        assessmentDefinition: {
          select: {
            id: true,
            name: true,
            description: true,
            domain: true,
            engineType: true,
            engineUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      projectAssessments,
      total: projectAssessments.length,
    })
  } catch (error) {
    console.error('[Project Assessments API] GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch project assessments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/assessment/project-assessments
 * Link an assessment definition to a project
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const result = createProjectAssessmentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.format(),
        },
        { status: 400 }
      )
    }

    const { projectId, assessmentDefinitionId, isEnabled } = result.data

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true, name: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify assessment definition ownership
    const definition = await prisma.assessmentDefinition.findUnique({
      where: { id: assessmentDefinitionId },
      select: { userId: true, name: true },
    })

    if (!definition) {
      return NextResponse.json(
        { error: 'Assessment definition not found' },
        { status: 404 }
      )
    }

    if (definition.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if already linked
    const existing = await prisma.projectAssessment.findUnique({
      where: {
        projectId_assessmentDefinitionId: {
          projectId,
          assessmentDefinitionId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        {
          error: 'Assessment definition is already linked to this project',
          existingId: existing.id,
        },
        { status: 409 }
      )
    }

    // Create the link
    const projectAssessment = await prisma.projectAssessment.create({
      data: {
        projectId,
        assessmentDefinitionId,
        isEnabled,
      },
      include: {
        assessmentDefinition: {
          select: {
            id: true,
            name: true,
            description: true,
            domain: true,
            engineType: true,
            engineUrl: true,
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

    return NextResponse.json(
      {
        projectAssessment,
        message: `Assessment "${definition.name}" linked to project "${project.name}"`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Project Assessments API] POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create project assessment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
