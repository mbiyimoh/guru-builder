// app/api/projects/[id]/assessment/session/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { z } from 'zod'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    // Auth check
    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      if (message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const config = await prisma.selfAssessmentConfig.findUnique({
      where: { projectId },
    })

    if (!config || !config.isEnabled) {
      return NextResponse.json(
        { error: 'Assessment not enabled for this project' },
        { status: 400 }
      )
    }

    const session = await prisma.assessmentSession.create({
      data: { configId: config.id },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/session] Error:', error)
    return NextResponse.json({ error: 'Failed to create assessment session' }, { status: 500 })
  }
}

const patchSchema = z.object({
  sessionId: z.string(),
  action: z.enum(['end']),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    // Auth check
    try {
      await requireProjectOwnership(projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      if (message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (message === "Project not found") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const body = await request.json()

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const session = await prisma.assessmentSession.update({
      where: { id: parsed.data.sessionId },
      data: { endedAt: new Date() },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('[PATCH /api/projects/[id]/assessment/session] Error:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
