// lib/drills/sync.ts
// Functions to keep Drill table and artifact JSON content in sync

import { prisma } from '@/lib/db'
import type { GamePhase, DrillTier, Prisma } from '@prisma/client'
import type {
  PhaseOrganizedDrillSeries,
  PhaseSection,
  PhaseDrill,
} from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema'

// =============================================================================
// TYPES
// =============================================================================

interface PopulateResult {
  created: number
  skipped: number
  errors: string[]
}

interface SyncResult {
  success: boolean
  error?: string
}

// =============================================================================
// POPULATE DRILLS FROM ARTIFACT
// =============================================================================

/**
 * Populate Drill table records from artifact JSON content.
 * Called after initial artifact generation.
 *
 * @param artifactId - The GuruArtifact ID
 * @returns Population result with counts
 */
export async function populateDrillsFromArtifact(
  artifactId: string
): Promise<PopulateResult> {
  const result: PopulateResult = { created: 0, skipped: 0, errors: [] }

  // Fetch artifact
  const artifact = await prisma.guruArtifact.findUnique({
    where: { id: artifactId },
    select: { id: true, type: true, content: true },
  })

  if (!artifact) {
    result.errors.push('Artifact not found')
    return result
  }

  if (artifact.type !== 'DRILL_SERIES') {
    result.errors.push('Artifact is not a drill series')
    return result
  }

  // Check if already populated
  const existingCount = await prisma.drill.count({
    where: { artifactId },
  })

  if (existingCount > 0) {
    result.skipped = existingCount
    result.errors.push('Drills already populated')
    return result
  }

  // Parse content as phase-organized
  const content = artifact.content as unknown as PhaseOrganizedDrillSeries

  if (!content.phases || !Array.isArray(content.phases)) {
    result.errors.push('Invalid drill series content structure')
    return result
  }

  // Create drill records
  const drillsToCreate: Prisma.DrillCreateManyInput[] = []

  for (const phase of content.phases) {
    let orderIndex = 0
    // Iterate through principle groups to access drills
    for (const group of phase.principleGroups) {
      for (const drill of group.drills) {
        // Collect all principle IDs (primary + universal)
        const allPrincipleIds = [drill.primaryPrincipleId, ...drill.universalPrincipleIds]

        drillsToCreate.push({
          artifactId,
          positionId: drill.positionId || null,
          gamePhase: phase.phase as GamePhase,
          orderIndex: orderIndex++,
          content: drill as unknown as Prisma.InputJsonValue,
          drillId: drill.drillId,
          tier: drill.tier as DrillTier,
          principleIds: allPrincipleIds,
        })
      }
    }
  }

  // Batch create
  await prisma.drill.createMany({
    data: drillsToCreate,
  })

  result.created = drillsToCreate.length
  return result
}

// =============================================================================
// SYNC ARTIFACT CONTENT
// =============================================================================

/**
 * Regenerate artifact JSON content from Drill table.
 * Called after drill mutations (delete, reorder, add).
 *
 * @param artifactId - The GuruArtifact ID
 * @returns Sync result
 */
export async function syncArtifactContent(artifactId: string): Promise<SyncResult> {
  // Fetch current artifact for structure
  const artifact = await prisma.guruArtifact.findUnique({
    where: { id: artifactId },
    select: { id: true, content: true },
  })

  if (!artifact) {
    return { success: false, error: 'Artifact not found' }
  }

  const currentContent = artifact.content as unknown as PhaseOrganizedDrillSeries

  // Fetch all non-deleted drills, ordered
  const drills = await prisma.drill.findMany({
    where: { artifactId, deletedAt: null },
    orderBy: [{ gamePhase: 'asc' }, { orderIndex: 'asc' }],
  })

  // Group drills by phase
  const drillsByPhase = new Map<string, Array<{ content: unknown; orderIndex: number }>>()

  for (const drill of drills) {
    const phase = drill.gamePhase
    if (!drillsByPhase.has(phase)) {
      drillsByPhase.set(phase, [])
    }
    drillsByPhase.get(phase)!.push({
      content: drill.content,
      orderIndex: drill.orderIndex,
    })
  }

  // Rebuild phases array preserving original phase metadata
  const newPhases: PhaseSection[] = currentContent.phases.map((originalPhase) => {
    const phaseDrills = drillsByPhase.get(originalPhase.phase) || []

    // Sort by orderIndex and extract content
    const sortedDrills = phaseDrills
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((d) => d.content as PhaseDrill)

    // Rebuild principle groups by grouping drills by their primary principle
    const drillsByPrinciple = new Map<string, PhaseDrill[]>()

    for (const drill of sortedDrills) {
      if (!drillsByPrinciple.has(drill.primaryPrincipleId)) {
        drillsByPrinciple.set(drill.primaryPrincipleId, [])
      }
      drillsByPrinciple.get(drill.primaryPrincipleId)!.push(drill)
    }

    // Reconstruct principle groups maintaining original metadata
    const newPrincipleGroups = originalPhase.principleGroups.map((originalGroup) => {
      const groupDrills = drillsByPrinciple.get(originalGroup.principleId) || []
      return {
        ...originalGroup,
        drills: groupDrills,
        drillCount: groupDrills.length,
      }
    }).filter((group) => group.drills.length > 0) // Remove empty groups

    const totalDrills = newPrincipleGroups.reduce((sum, group) => sum + group.drills.length, 0)

    return {
      ...originalPhase,
      principleGroups: newPrincipleGroups,
      actualDrillCount: totalDrills,
    }
  })

  // Calculate new totals
  const totalDrillCount = newPhases.reduce(
    (sum, p) => sum + p.principleGroups.reduce((groupSum, g) => groupSum + g.drills.length, 0),
    0
  )

  // Update artifact
  const updatedContent: PhaseOrganizedDrillSeries = {
    ...currentContent,
    phases: newPhases,
    totalDrillCount,
  }

  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: { content: updatedContent as unknown as object },
  })

  return { success: true }
}

// =============================================================================
// REORDER DRILLS
// =============================================================================

/**
 * Ensure drills in a phase have contiguous orderIndex values.
 * Called after deletion to prevent gaps.
 *
 * @param artifactId - The GuruArtifact ID
 * @param phase - The game phase to reorder
 */
export async function reorderDrillsInPhase(
  artifactId: string,
  phase: GamePhase
): Promise<void> {
  // Fetch non-deleted drills for phase, ordered
  const drills = await prisma.drill.findMany({
    where: { artifactId, gamePhase: phase, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, orderIndex: true },
  })

  // Update each to have contiguous index
  await prisma.$transaction(
    drills.map((drill, index) =>
      prisma.drill.update({
        where: { id: drill.id },
        data: { orderIndex: index },
      })
    )
  )
}

// =============================================================================
// SOFT DELETE DRILL
// =============================================================================

/**
 * Soft delete a drill by setting deletedAt.
 *
 * @param drillId - The Drill record ID
 * @returns The deleted drill
 */
export async function softDeleteDrill(drillId: string) {
  const drill = await prisma.drill.update({
    where: { id: drillId },
    data: { deletedAt: new Date() },
  })

  // Reorder remaining drills in phase
  await reorderDrillsInPhase(drill.artifactId, drill.gamePhase)

  // Sync artifact content
  await syncArtifactContent(drill.artifactId)

  return drill
}

// =============================================================================
// RESTORE DRILL
// =============================================================================

/**
 * Restore a soft-deleted drill.
 *
 * @param drillId - The Drill record ID
 * @returns The restored drill
 */
export async function restoreDrill(drillId: string) {
  // Get current drill to know its phase
  const currentDrill = await prisma.drill.findUnique({
    where: { id: drillId },
    select: { artifactId: true, gamePhase: true },
  })

  if (!currentDrill) {
    throw new Error('Drill not found')
  }

  // Get max order index for phase
  const maxDrill = await prisma.drill.findFirst({
    where: {
      artifactId: currentDrill.artifactId,
      gamePhase: currentDrill.gamePhase,
      deletedAt: null,
    },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })

  const newOrderIndex = (maxDrill?.orderIndex ?? -1) + 1

  // Restore drill with new order index
  const drill = await prisma.drill.update({
    where: { id: drillId },
    data: { deletedAt: null, orderIndex: newOrderIndex },
  })

  // Sync artifact content
  await syncArtifactContent(drill.artifactId)

  return drill
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { PopulateResult, SyncResult }
