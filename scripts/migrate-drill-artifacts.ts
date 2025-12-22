// scripts/migrate-drill-artifacts.ts
// Migration script: Convert legacy principle-based drill artifacts to phase-organized format.
//
// Run: npx tsx scripts/migrate-drill-artifacts.ts

import { prisma } from '@/lib/db'
import { populateDrillsFromArtifact } from '@/lib/drills/sync'
import type { PhaseOrganizedDrillSeries, PhaseDrill } from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema'

// =============================================================================
// LEGACY TYPES
// =============================================================================

interface LegacyDrill {
  drillId: string
  tier: string
  methodology: string
  scenario: { setup: string; question: string }
  options: Array<{ id: string; text: string; isCorrect: boolean }>
  feedback: {
    correct: { brief: string; principleReinforcement: string }
    incorrect: { brief: string; principleReminder: string; tryAgainHint: string }
  }
  asciiWireframe?: string
}

interface LegacyDrillSeries {
  drillSeriesTitle: string
  totalDrills: number
  estimatedCompletionMinutes: number
  targetPrinciples: string[]
  series: Array<{
    seriesId: string
    principleName: string
    seriesDescription: string
    drills: LegacyDrill[]
  }>
  practiceSequences?: Array<{
    name: string
    description: string
    drillIds: string[]
  }>
  designThoughts?: {
    methodologyRationale: string
    varietyAnalysis: string
    pedagogicalNotes: string
    distinctiveElements?: string
  }
}

// =============================================================================
// CONVERSION LOGIC
// =============================================================================

function convertLegacyDrillToPhase(legacy: LegacyDrill, principleId: string): PhaseDrill {
  return {
    drillId: legacy.drillId,
    tier: legacy.tier as 'RECOGNITION' | 'APPLICATION' | 'TRANSFER',
    methodology: legacy.methodology,
    gamePhase: 'OPENING', // Default to OPENING for legacy drills
    positionId: 'legacy-migration', // Legacy drills don't have position references
    primaryPrincipleId: principleId,
    universalPrincipleIds: [], // Legacy drills don't have universal principles
    scenario: legacy.scenario.setup,
    question: legacy.scenario.question,
    answerFormat: 'MULTIPLE_CHOICE',
    options: legacy.options,
    correctAnswer: legacy.options.find(o => o.isCorrect)?.text || '',
    explanation: legacy.feedback.correct.principleReinforcement,
    feedback: {
      correct: legacy.feedback.correct.brief,
      incorrect: legacy.feedback.incorrect.brief,
      partialCredit: null,
    },
    hints: legacy.feedback.incorrect.tryAgainHint ? [legacy.feedback.incorrect.tryAgainHint] : null,
    relatedConcepts: null,
  }
}

function convertLegacyToPhaseOrganized(legacy: LegacyDrillSeries): PhaseOrganizedDrillSeries {
  // Group drills by principle
  const drillsByPrinciple = new Map<string, PhaseDrill[]>()

  for (const series of legacy.series) {
    // Map legacy principle names to our new principle IDs
    const principleId = mapPrincipleNameToId(series.principleName)

    if (!drillsByPrinciple.has(principleId)) {
      drillsByPrinciple.set(principleId, [])
    }

    for (const drill of series.drills) {
      drillsByPrinciple.get(principleId)!.push(convertLegacyDrillToPhase(drill, principleId))
    }
  }

  // Create principle groups
  const principleGroups = Array.from(drillsByPrinciple.entries()).map(([principleId, drills]) => ({
    principleId,
    principleName: getPrincipleNameById(principleId),
    principleDescription: `Drills focused on ${getPrincipleNameById(principleId)}`,
    drillCount: drills.length,
    drills,
  }))

  const totalDrills = principleGroups.reduce((sum, g) => sum + g.drills.length, 0)

  // Create phase-organized structure with all drills in OPENING phase
  const phases = [
    {
      phase: 'OPENING' as const,
      phaseTitle: 'Opening Phase',
      phaseDescription: 'Drills migrated from legacy format. All drills default to Opening phase.',
      targetDrillCount: totalDrills,
      actualDrillCount: totalDrills,
      universalPrinciples: [
        { id: 'pip-count', name: 'Pip Count' },
        { id: 'risk-reward', name: 'Risk-Reward Balance' },
      ],
      principleGroups,
    },
  ]

  return {
    drillSeriesTitle: legacy.drillSeriesTitle,
    totalDrillCount: totalDrills,
    estimatedCompletionMinutes: legacy.estimatedCompletionMinutes,
    phases,
    designThoughts: legacy.designThoughts
      ? {
          methodologyRationale: legacy.designThoughts.methodologyRationale,
          varietyAnalysis: legacy.designThoughts.varietyAnalysis,
          pedagogicalNotes: legacy.designThoughts.pedagogicalNotes,
          principleIntegration: legacy.designThoughts.distinctiveElements || 'Migrated from legacy format',
        }
      : null,
  }
}

/**
 * Helper to get principle name by ID
 */
function getPrincipleNameById(id: string): string {
  const names: Record<string, string> = {
    'pip-count': 'Pip Count',
    'risk-reward': 'Risk-Reward Balance',
    'cube-timing': 'Cube Timing',
    'point-making': 'Point Making',
    'tempo-development': 'Tempo Development',
    'blitz-defense': 'Blitz Defense',
    'prime-strategy': 'Prime Strategy',
    'back-game': 'Back Game',
  }
  return names[id] || id
}

/**
 * Map legacy principle names to new principle IDs.
 * Returns 'pip-count' as default if no match found.
 */
function mapPrincipleNameToId(principleName: string): string {
  const nameToId: Record<string, string> = {
    'pip count': 'pip-count',
    'pip count awareness': 'pip-count',
    'risk vs reward': 'risk-reward',
    'risk reward': 'risk-reward',
    'cube timing': 'cube-timing',
    'cube decision': 'cube-timing',
    'point-making': 'point-making',
    'point making': 'point-making',
    'tempo': 'tempo-development',
    'development': 'tempo-development',
    'priming': 'priming',
    'prime': 'priming',
    'anchoring': 'anchoring',
    'anchor': 'anchoring',
    'attack': 'attack-timing',
    'back game': 'back-game',
    'backgame': 'back-game',
    'race': 'race-efficiency',
    'bearing off': 'race-efficiency',
    'bearoff': 'race-efficiency',
    'contact': 'contact-bearoff',
  }

  const normalized = principleName.toLowerCase().trim()
  return nameToId[normalized] || 'pip-count'
}

// =============================================================================
// MAIN MIGRATION FUNCTION
// =============================================================================

async function migrateDrillArtifacts() {
  console.log('='.repeat(60))
  console.log('Drill Artifact Migration Script')
  console.log('='.repeat(60))
  console.log('')

  const drillArtifacts = await prisma.guruArtifact.findMany({
    where: { type: 'DRILL_SERIES' },
    include: { project: { select: { id: true, name: true } } },
  })

  console.log(`Found ${drillArtifacts.length} drill series artifact(s) to check\n`)

  let migrated = 0
  let skipped = 0
  let alreadyPhaseOrganized = 0
  let errors = 0
  let drillsPopulated = 0

  for (const artifact of drillArtifacts) {
    const content = artifact.content as Record<string, unknown>
    const projectName = artifact.project?.name || 'Unknown Project'

    // Check if already phase-organized (has 'phases' array)
    if (content.phases && Array.isArray(content.phases)) {
      console.log(`[PHASE-ORG] ${artifact.id.slice(0, 8)}... - "${projectName}" - Already phase-organized`)

      // Still need to populate Drill table if not done
      const drillCount = await prisma.drill.count({ where: { artifactId: artifact.id } })
      if (drillCount === 0) {
        try {
          const result = await populateDrillsFromArtifact(artifact.id)
          console.log(`           ↳ Populated ${result.created} drill records`)
          drillsPopulated += result.created
        } catch (err) {
          console.log(`           ↳ Failed to populate: ${err}`)
        }
      }

      alreadyPhaseOrganized++
      continue
    }

    // Check if legacy format (has 'series' array)
    if (!content.series || !Array.isArray(content.series)) {
      console.log(`[SKIP]     ${artifact.id.slice(0, 8)}... - "${projectName}" - Unrecognized format`)
      skipped++
      continue
    }

    console.log(`[MIGRATE]  ${artifact.id.slice(0, 8)}... - "${projectName}"`)

    try {
      // Convert legacy to phase-organized
      const legacy = content as unknown as LegacyDrillSeries
      const newContent = convertLegacyToPhaseOrganized(legacy)

      // Update artifact
      await prisma.guruArtifact.update({
        where: { id: artifact.id },
        data: { content: newContent as unknown as object },
      })

      // Populate Drill table
      const result = await populateDrillsFromArtifact(artifact.id)

      console.log(`           ↳ Converted ${newContent.totalDrillCount} drills, populated ${result.created} records`)
      drillsPopulated += result.created
      migrated++
    } catch (err) {
      console.error(`           ↳ FAILED: ${err}`)
      errors++
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('Migration Summary')
  console.log('='.repeat(60))
  console.log(`  Migrated from legacy:    ${migrated}`)
  console.log(`  Already phase-organized: ${alreadyPhaseOrganized}`)
  console.log(`  Skipped (unrecognized):  ${skipped}`)
  console.log(`  Errors:                  ${errors}`)
  console.log(`  Drill records created:   ${drillsPopulated}`)
  console.log('')

  await prisma.$disconnect()
}

// Run migration
migrateDrillArtifacts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
