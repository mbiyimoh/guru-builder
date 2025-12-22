/**
 * Ground Truth Module - Configuration Resolution
 *
 * Resolves ground truth configuration from project settings.
 *
 * Ground truth is enabled when a project has a ProjectGroundTruthConfig
 * linking it to an active GroundTruthEngine.
 */

import { prisma } from '@/lib/db'
import type { GroundTruthConfig } from './types'

/**
 * Resolve ground truth configuration for a project.
 *
 * Finds an enabled ProjectGroundTruthConfig linking the project to
 * an active GroundTruthEngine.
 *
 * @param projectId - Project ID to load config for
 * @returns Ground truth config or null if not configured
 */
export async function resolveGroundTruthConfig(
  projectId: string
): Promise<GroundTruthConfig | null> {
  // Find enabled ground truth config for this project
  const gtConfig = await prisma.projectGroundTruthConfig.findFirst({
    where: {
      projectId,
      isEnabled: true,
      engine: {
        isActive: true
      }
    },
    include: {
      engine: true
    }
  })

  if (!gtConfig) return null

  return {
    enabled: true,
    engineUrl: gtConfig.engine.engineUrl,
    engineId: gtConfig.engine.id,
    engineName: gtConfig.engine.name,
    domain: gtConfig.engine.domain,
    configId: gtConfig.id
  }
}
