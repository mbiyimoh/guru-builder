// app/api/projects/[id]/assessment/config/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { z } from 'zod'

const patchSchema = z.object({
  isEnabled: z.boolean(),
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

    const config = await prisma.selfAssessmentConfig.upsert({
      where: { projectId },
      update: { isEnabled: parsed.data.isEnabled },
      create: {
        projectId,
        isEnabled: parsed.data.isEnabled,
      },
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('[PATCH /api/projects/[id]/assessment/config] Error:', error)
    return NextResponse.json({ error: 'Failed to update assessment config' }, { status: 500 })
  }
}

export async function GET(
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

    return NextResponse.json({ config: config || null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/assessment/config] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch assessment config' }, { status: 500 })
  }
}
