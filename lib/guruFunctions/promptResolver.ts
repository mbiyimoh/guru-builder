/**
 * Prompt Resolver Service
 *
 * Resolves prompts for a project, checking for custom configurations
 * and falling back to defaults.
 */

import { prisma } from '@/lib/db'
import { getDefaultSystemPrompt, type ArtifactType } from './prompts/defaults'

export interface ResolvedPrompts {
  systemPrompt: string
  isCustomSystem: boolean
  userPromptTemplate: string | null  // null means use default builder
  isCustomUser: boolean
  configId: string | null  // ID of the ProjectPromptConfig if exists
}

/**
 * Get the prompts to use for a specific project and artifact type.
 * Falls back gracefully to defaults if database query fails.
 */
export async function resolvePromptsForProject(
  projectId: string,
  artifactType: ArtifactType
): Promise<ResolvedPrompts> {
  try {
    // Check for custom config
    const config = await prisma.projectPromptConfig.findUnique({
      where: {
        projectId_artifactType: {
          projectId,
          artifactType,
        },
      },
    })

    return {
      systemPrompt: config?.customSystemPrompt ?? getDefaultSystemPrompt(),
      isCustomSystem: !!config?.customSystemPrompt,
      userPromptTemplate: config?.customUserPrompt ?? null,
      isCustomUser: !!config?.customUserPrompt,
      configId: config?.id ?? null,
    }
  } catch (error) {
    console.error(`[PromptResolver] Failed to resolve prompts for ${projectId}/${artifactType}:`, error)
    // Gracefully fall back to defaults on database error
    return {
      systemPrompt: getDefaultSystemPrompt(),
      isCustomSystem: false,
      userPromptTemplate: null,
      isCustomUser: false,
      configId: null,
    }
  }
}

/**
 * Check if a project has any custom prompts.
 */
export async function hasCustomPrompts(projectId: string): Promise<boolean> {
  const count = await prisma.projectPromptConfig.count({
    where: {
      projectId,
      OR: [
        { customSystemPrompt: { not: null } },
        { customUserPrompt: { not: null } },
      ],
    },
  })
  return count > 0
}
