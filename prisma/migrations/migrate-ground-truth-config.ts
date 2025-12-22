/**
 * Migration: Ground Truth Config
 *
 * Migrates existing ground truth configurations from the old assessment-based
 * system (ProjectAssessment.useForContentValidation) to the new standalone
 * system (ProjectGroundTruthConfig).
 *
 * Run with: npm run migrate:ground-truth
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Migrating Ground Truth configurations from Assessments...\n')

  // 1. Ensure GNU Backgammon engine exists - auto-seed if missing
  console.log('Ensuring ground truth engines exist...')

  const gnubgEngine = await prisma.groundTruthEngine.upsert({
    where: { id: 'gnubg-engine' },
    update: { isActive: true },
    create: {
      id: 'gnubg-engine',
      name: 'GNU Backgammon',
      domain: 'backgammon',
      engineUrl: 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com',
      description: 'World-class backgammon analysis engine powered by GNU Backgammon. Provides position evaluation, move analysis, and match equity calculations.',
      iconUrl: '/icons/backgammon.svg',
      isActive: true,
    },
  })

  console.log(`Using engine: ${gnubgEngine.name} (${gnubgEngine.id})`)

  // 2. Find all projects with ground truth enabled via old system
  const oldConfigs = await prisma.projectAssessment.findMany({
    where: {
      useForContentValidation: true,
      isEnabled: true,
      assessmentDefinition: {
        canValidateContent: true,
      },
    },
    include: {
      project: true,
      assessmentDefinition: true,
    },
  })

  console.log(`Found ${oldConfigs.length} projects using old ground truth system\n`)

  if (oldConfigs.length === 0) {
    console.log('No projects to migrate. Done!')
    return
  }

  // 3. Migrate each to new system
  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const oldConfig of oldConfigs) {
    try {
      // Check if already migrated
      const existing = await prisma.projectGroundTruthConfig.findFirst({
        where: {
          projectId: oldConfig.projectId,
          engineId: gnubgEngine.id,
        },
      })

      if (existing) {
        console.log(`  [SKIP] Project "${oldConfig.project.name}" - already migrated`)
        skipped++
        continue
      }

      // Create new config
      await prisma.projectGroundTruthConfig.create({
        data: {
          projectId: oldConfig.projectId,
          engineId: gnubgEngine.id,
          isEnabled: true,
        },
      })

      console.log(`  [OK] Migrated project "${oldConfig.project.name}"`)
      migrated++
    } catch (error) {
      console.error(`  [FAIL] Project "${oldConfig.project.name}":`, error)
      failed++
    }
  }

  console.log('\n--- Migration Summary ---')
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Skipped (already migrated): ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log('')

  if (failed > 0) {
    console.error('Some migrations failed. Check errors above.')
    process.exit(1)
  }

  console.log('Migration complete!')
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
