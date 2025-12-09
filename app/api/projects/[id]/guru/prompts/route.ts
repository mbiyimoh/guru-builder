import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { getDefaultPrompts } from '@/lib/guruFunctions/prompts/defaults'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/projects/[id]/guru/prompts
 * Get all prompt configurations for a project
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  try {
    await requireProjectOwnership(projectId)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get custom configs
    const configs = await prisma.projectPromptConfig.findMany({
      where: { projectId },
    })

    // Build response with defaults and custom overrides
    const artifactTypes = ['MENTAL_MODEL', 'CURRICULUM', 'DRILL_SERIES'] as const

    const promptConfigs = artifactTypes.map(type => {
      const custom = configs.find(c => c.artifactType === type)
      const defaults = getDefaultPrompts(type)

      return {
        artifactType: type,
        systemPrompt: {
          current: custom?.customSystemPrompt ?? defaults.systemPrompt,
          isCustom: !!custom?.customSystemPrompt,
          default: defaults.systemPrompt,
        },
        userPrompt: {
          current: custom?.customUserPrompt ?? defaults.userPromptTemplate,
          isCustom: !!custom?.customUserPrompt,
          default: defaults.userPromptTemplate,
        },
        updatedAt: custom?.updatedAt ?? null,
      }
    })

    return NextResponse.json({ promptConfigs })
  } catch (error) {
    console.error('[GET /prompts] Error fetching prompt configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt configurations. Please try again.' },
      { status: 500 }
    )
  }
}
