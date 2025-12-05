/**
 * Data Migration Script: SelfAssessmentConfig -> AssessmentDefinition + ProjectAssessment
 *
 * This script migrates existing self-assessment configurations to the new library architecture.
 *
 * For each existing SelfAssessmentConfig:
 * 1. Creates an AssessmentDefinition owned by the project's owner
 * 2. Creates a ProjectAssessment linking the definition to the project
 * 3. Updates existing AssessmentSessions to reference the new ProjectAssessment
 *
 * Run with: npx ts-node scripts/migrate-assessment-library.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateAssessmentLibrary() {
  console.log('Starting Assessment Library Migration...\n');

  // Get all existing SelfAssessmentConfigs with their projects and sessions
  const configs = await prisma.selfAssessmentConfig.findMany({
    include: {
      project: {
        include: {
          user: true,
        },
      },
      sessions: true,
    },
  });

  console.log(`Found ${configs.length} existing SelfAssessmentConfig records to migrate.\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const config of configs) {
    try {
      // Skip if project has no user (orphan project)
      if (!config.project.user) {
        console.log(`⚠️  Skipping config ${config.id} - Project "${config.project.name}" has no owner`);
        skippedCount++;
        continue;
      }

      const userId = config.project.userId!;
      const projectId = config.projectId;

      // Check if migration already done (ProjectAssessment exists for this project)
      const existingPA = await prisma.projectAssessment.findFirst({
        where: { projectId },
      });

      if (existingPA) {
        console.log(`⏭️  Skipping config ${config.id} - ProjectAssessment already exists for project "${config.project.name}"`);
        skippedCount++;
        continue;
      }

      console.log(`📦 Migrating config for project "${config.project.name}"...`);

      // Create the AssessmentDefinition
      const definition = await prisma.assessmentDefinition.create({
        data: {
          userId,
          name: `${config.project.name} - Self Assessment`,
          description: `Migrated from legacy SelfAssessmentConfig. Original engine URL: ${config.engineUrl}`,
          domain: 'backgammon', // All existing configs are for backgammon
          engineType: 'gnubg',
          engineUrl: config.engineUrl,
        },
      });

      console.log(`   ✅ Created AssessmentDefinition: ${definition.id}`);

      // Create the ProjectAssessment linking definition to project
      const projectAssessment = await prisma.projectAssessment.create({
        data: {
          projectId,
          assessmentDefinitionId: definition.id,
          isEnabled: config.isEnabled,
        },
      });

      console.log(`   ✅ Created ProjectAssessment: ${projectAssessment.id}`);

      // Update existing sessions to reference the new ProjectAssessment
      if (config.sessions.length > 0) {
        const updateResult = await prisma.assessmentSession.updateMany({
          where: { configId: config.id },
          data: { projectAssessmentId: projectAssessment.id },
        });

        console.log(`   ✅ Updated ${updateResult.count} sessions to new ProjectAssessment`);
      }

      migratedCount++;
      console.log(`   ✅ Migration complete for "${config.project.name}"\n`);

    } catch (error) {
      console.error(`❌ Error migrating config ${config.id}:`, error);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('Migration Summary:');
  console.log(`   ✅ Migrated: ${migratedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('========================================\n');

  if (migratedCount > 0) {
    console.log('Next steps:');
    console.log('1. Verify the migration by checking the database');
    console.log('2. Test the new assessment flow with a project');
    console.log('3. Once verified, the legacy SelfAssessmentConfig can be deprecated');
  }
}

// Run the migration
migrateAssessmentLibrary()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
