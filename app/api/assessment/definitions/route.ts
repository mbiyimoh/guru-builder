/**
 * Assessment Definitions API - List and Create
 *
 * GET /api/assessment/definitions - List user's assessment definitions
 * POST /api/assessment/definitions - Create new assessment definition
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { createAssessmentDefinitionSchema } from '@/lib/assessment/validation'

/**
 * GET /api/assessment/definitions
 * List all assessment definitions for the current user
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const definitions = await prisma.assessmentDefinition.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            projectAssessments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      definitions,
      total: definitions.length,
    })
  } catch (error) {
    console.error('[Assessment Definitions API] GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch assessment definitions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/assessment/definitions
 * Create a new assessment definition for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const result = createAssessmentDefinitionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.format(),
        },
        { status: 400 }
      )
    }

    const { name, description, domain, engineType, engineUrl } = result.data

    // Create assessment definition
    const definition = await prisma.assessmentDefinition.create({
      data: {
        userId: user.id,
        name,
        description,
        domain,
        engineType,
        engineUrl,
      },
      include: {
        _count: {
          select: {
            projectAssessments: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        definition,
        message: 'Assessment definition created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Assessment Definitions API] POST error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create assessment definition',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
