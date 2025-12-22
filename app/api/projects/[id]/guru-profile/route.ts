/**
 * Guru Profile API
 *
 * GET: Fetch the current guru profile for a project
 * POST: Save/update the guru profile for a project
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { guruProfileDataSchema, type GuruProfileData } from '@/lib/guruProfile/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    // Auth check
    try {
      await requireProjectOwnership(projectId)
    } catch (error) {
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
      throw error
    }

    // Get project with current profile
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        currentProfile: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.currentProfile) {
      return NextResponse.json({
        hasProfile: false,
        profile: null,
      })
    }

    return NextResponse.json({
      hasProfile: true,
      profile: {
        id: project.currentProfile.id,
        profileData: project.currentProfile.profileData as GuruProfileData,
        rawBrainDump: project.currentProfile.rawBrainDump,
        synthesisMode: project.currentProfile.synthesisMode,
        lightAreas: project.currentProfile.lightAreas,
        version: project.currentProfile.version,
        createdAt: project.currentProfile.createdAt,
        updatedAt: project.currentProfile.updatedAt,
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/guru-profile] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    // Auth check
    try {
      await requireProjectOwnership(projectId)
    } catch (error) {
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
      throw error
    }

    const body = await request.json()
    const { profileData, rawBrainDump, synthesisMode, lightAreas } = body

    // Validate profile data
    const parseResult = guruProfileDataSchema.safeParse(profileData)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid profile data', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Create new profile
    const newProfile = await prisma.guruProfile.create({
      data: {
        projectId,
        profileData: parseResult.data,
        rawBrainDump: rawBrainDump || '',
        synthesisMode: synthesisMode || 'TEXT',
        lightAreas: lightAreas || [],
      },
    })

    // Update project to point to new profile
    await prisma.project.update({
      where: { id: projectId },
      data: { currentProfileId: newProfile.id },
    })

    return NextResponse.json({
      success: true,
      profile: {
        id: newProfile.id,
        profileData: newProfile.profileData,
        createdAt: newProfile.createdAt,
      },
    })
  } catch (error) {
    console.error('[POST /api/projects/[id]/guru-profile] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
