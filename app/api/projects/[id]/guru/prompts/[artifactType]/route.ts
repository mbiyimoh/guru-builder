import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { z } from 'zod'
import type { GuruArtifactType } from '@prisma/client'

type RouteContext = { params: Promise<{ id: string; artifactType: string }> }

const VALID_ARTIFACT_TYPES = ['MENTAL_MODEL', 'CURRICULUM', 'DRILL_SERIES']

// Defense-in-depth: Prevent potential script injection in prompts
// While prompts are only used server-side for OpenAI calls, this prevents
// any future display contexts from being vulnerable
const DANGEROUS_PATTERN = /<script|javascript:|on\w+\s*=/i

const updatePromptSchema = z.object({
  systemPrompt: z.string()
    .max(50000)
    .refine(val => !val || !DANGEROUS_PATTERN.test(val), {
      message: 'Prompt contains potentially dangerous content'
    })
    .nullable()
    .optional(),
  userPrompt: z.string()
    .max(50000)
    .refine(val => !val || !DANGEROUS_PATTERN.test(val), {
      message: 'Prompt contains potentially dangerous content'
    })
    .nullable()
    .optional(),
})

/**
 * PUT /api/projects/[id]/guru/prompts/[artifactType]
 * Update prompts for a specific artifact type
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id: projectId, artifactType } = await context.params

  // Validate artifact type
  if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
    return NextResponse.json({ error: 'Invalid artifact type' }, { status: 400 })
  }

  try {
    await requireProjectOwnership(projectId)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const result = updatePromptSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request body', details: result.error.issues }, { status: 400 })
  }

  const { systemPrompt, userPrompt } = result.data

  try {
    // Import hash utility
    const { hashPrompt } = await import('@/lib/guruFunctions/promptHasher')

    // Check if config exists (to determine change type)
    const existingConfig = await prisma.projectPromptConfig.findUnique({
      where: {
        projectId_artifactType: { projectId, artifactType: artifactType as GuruArtifactType },
      },
    })

    const changeType = existingConfig ? 'UPDATED' : 'CREATED'

    // Upsert the config
    const config = await prisma.projectPromptConfig.upsert({
      where: {
        projectId_artifactType: {
          projectId,
          artifactType: artifactType as GuruArtifactType,
        },
      },
      create: {
        projectId,
        artifactType: artifactType as GuruArtifactType,
        customSystemPrompt: systemPrompt,
        customUserPrompt: userPrompt,
      },
      update: {
        customSystemPrompt: systemPrompt,
        customUserPrompt: userPrompt,
      },
    })

    // Record history for tracking changes over time
    await prisma.promptConfigHistory.create({
      data: {
        configId: config.id,
        systemPrompt: systemPrompt,
        userPrompt: userPrompt,
        changeType,
        systemPromptHash: systemPrompt ? hashPrompt(systemPrompt) : null,
        userPromptHash: userPrompt ? hashPrompt(userPrompt) : null,
      },
    })

    return NextResponse.json({
      message: 'Prompts updated',
      config: {
        artifactType: config.artifactType,
        hasCustomSystem: !!config.customSystemPrompt,
        hasCustomUser: !!config.customUserPrompt,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    console.error('[PUT /prompts/[artifactType]] Error updating prompts:', error)
    return NextResponse.json(
      { error: 'Failed to update prompts. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/guru/prompts/[artifactType]
 * Reset prompts to defaults for a specific artifact type
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: projectId, artifactType } = await context.params

  if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
    return NextResponse.json({ error: 'Invalid artifact type' }, { status: 400 })
  }

  try {
    await requireProjectOwnership(projectId)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find existing config to record reset in history
    const existingConfig = await prisma.projectPromptConfig.findUnique({
      where: {
        projectId_artifactType: { projectId, artifactType: artifactType as GuruArtifactType },
      },
    })

    if (existingConfig) {
      // Record the reset in history before deleting
      await prisma.promptConfigHistory.create({
        data: {
          configId: existingConfig.id,
          systemPrompt: null,
          userPrompt: null,
          changeType: 'RESET',
          systemPromptHash: null,
          userPromptHash: null,
        },
      })
    }

    await prisma.projectPromptConfig.deleteMany({
      where: {
        projectId,
        artifactType: artifactType as GuruArtifactType,
      },
    })

    return NextResponse.json({ message: 'Prompts reset to defaults' })
  } catch (error) {
    console.error('[DELETE /prompts/[artifactType]] Error resetting prompts:', error)
    return NextResponse.json(
      { error: 'Failed to reset prompts. Please try again.' },
      { status: 500 }
    )
  }
}
