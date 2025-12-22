/**
 * Migration Script: Convert Legacy Curriculum Artifacts to Phase-Aligned Structure
 *
 * This script migrates curriculum artifacts from the old structure:
 *   modules[].lessons[]
 *
 * To the new phase-aligned structure:
 *   universalPrinciplesModule.principleUnits[].lessons[]
 *   phaseModules[].principleUnits[].lessons[]
 *
 * Usage:
 *   npx ts-node scripts/migrate-curriculum-artifacts.ts [--dry-run] [--project-id <id>]
 *
 * Options:
 *   --dry-run      Show what would be migrated without making changes
 *   --project-id   Migrate only artifacts for a specific project
 */

import { PrismaClient, GuruArtifactType, Prisma } from '@prisma/client';
import {
  UNIVERSAL_PRINCIPLES,
  PHASE_PRINCIPLES,
  getPrincipleById,
} from '../lib/backgammon';
import type { CurriculumOutput, PrincipleUnit, Lesson, PhaseModule, LessonMetadata } from '../lib/guruFunctions/schemas/curriculumSchema';

const prisma = new PrismaClient();

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const projectIdIndex = args.indexOf('--project-id');
const projectId = projectIdIndex !== -1 ? args[projectIdIndex + 1] : undefined;

// Type for legacy lesson
interface LegacyLesson {
  lessonId: string;
  principleId?: string;
  type: string;
  title: string;
  content: {
    headline: string;
    essence: string;
    expandedContent: string;
  };
  metadata?: {
    difficultyTier: string;
    estimatedMinutes: number;
  };
}

// Type for legacy module
interface LegacyModule {
  moduleId: string;
  categoryId?: string;
  title: string;
  subtitle?: string;
  learningObjectives?: string[];
  prerequisites?: string[];
  lessons: LegacyLesson[];
}

// Type for legacy curriculum structure
interface LegacyCurriculumOutput {
  curriculumTitle: string;
  targetAudience: string;
  estimatedDuration: string;
  modules?: LegacyModule[];
  learningPath?: {
    recommended: string[];
  };
  designRationale?: {
    approachesConsidered: string[];
    selectedApproach: string;
    selectionReasoning: string;
    engagementStrategy?: string;
    progressionLogic?: string;
  };
}

/**
 * Check if curriculum is already in new format
 */
function isNewFormat(content: unknown): content is CurriculumOutput {
  const c = content as CurriculumOutput;
  return (
    c &&
    typeof c === 'object' &&
    'universalPrinciplesModule' in c &&
    'phaseModules' in c &&
    Array.isArray(c.phaseModules)
  );
}

/**
 * Check if curriculum is in legacy format
 */
function isLegacyFormat(content: unknown): content is LegacyCurriculumOutput {
  const c = content as LegacyCurriculumOutput;
  return (
    c &&
    typeof c === 'object' &&
    'modules' in c &&
    Array.isArray(c.modules) &&
    !('universalPrinciplesModule' in c)
  );
}

/**
 * Infer principle ID from lesson content
 */
function inferPrincipleId(lesson: LegacyLesson): string {
  // If lesson already has principleId, use it
  if (lesson.principleId) {
    return lesson.principleId;
  }

  // Try to infer from title or content
  const searchText = `${lesson.title} ${lesson.content?.headline || ''} ${lesson.content?.essence || ''}`.toLowerCase();

  // Check universal principles
  for (const p of UNIVERSAL_PRINCIPLES) {
    if (searchText.includes(p.id.replace('-', ' ')) || searchText.includes(p.name.toLowerCase())) {
      return p.id;
    }
  }

  // Check phase-specific principles
  for (const principles of Object.values(PHASE_PRINCIPLES)) {
    for (const p of principles) {
      if (searchText.includes(p.id.replace('-', ' ')) || searchText.includes(p.name.toLowerCase())) {
        return p.id;
      }
    }
  }

  // Default to first universal principle if can't infer
  return 'pip-count';
}

/**
 * Create a principle unit from lessons
 */
function createPrincipleUnit(principleId: string, lessons: Lesson[]): PrincipleUnit {
  const principle = getPrincipleById(principleId);
  return {
    principleId,
    principleName: principle?.name || principleId,
    principleDescription: principle?.description || '',
    lessonCount: lessons.length,
    lessons,
  };
}

/**
 * Migrate a legacy curriculum to new format
 */
function migrateCurriculum(legacy: LegacyCurriculumOutput): CurriculumOutput {
  const universalPrincipleIds = UNIVERSAL_PRINCIPLES.map(p => p.id);
  const allLessons: Lesson[] = [];

  // Extract all lessons and infer principle IDs
  for (const module of legacy.modules || []) {
    for (const lesson of module.lessons || []) {
      const principleId = inferPrincipleId(lesson);
      allLessons.push({
        lessonId: lesson.lessonId,
        principleId,
        type: lesson.type as 'CONCEPT' | 'EXAMPLE' | 'CONTRAST' | 'PRACTICE',
        title: lesson.title,
        content: lesson.content,
        metadata: {
          difficultyTier: (lesson.metadata?.difficultyTier as 'FOUNDATION' | 'EXPANSION' | 'MASTERY') || 'FOUNDATION',
          estimatedMinutes: lesson.metadata?.estimatedMinutes || 5,
        },
      });
    }
  }

  // Group lessons by principle
  const lessonsByPrinciple = new Map<string, Lesson[]>();
  for (const lesson of allLessons) {
    const existing = lessonsByPrinciple.get(lesson.principleId) || [];
    existing.push(lesson);
    lessonsByPrinciple.set(lesson.principleId, existing);
  }

  // Create universal principles module
  const universalPrincipleUnits: PrincipleUnit[] = universalPrincipleIds.map(id => {
    const lessons = lessonsByPrinciple.get(id) || [];
    return createPrincipleUnit(id, lessons);
  });

  const universalPrinciplesModule = {
    moduleTitle: 'Foundational Principles',
    moduleDescription: 'Core concepts that apply across all game phases',
    principleUnits: universalPrincipleUnits,
    totalLessons: universalPrincipleUnits.reduce((sum, u) => sum + u.lessonCount, 0),
  };

  // Create phase modules
  const phases: Array<'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF'> = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'];
  const phaseModules: PhaseModule[] = phases.map(phase => {
    const phasePrinciples = PHASE_PRINCIPLES[phase] || [];
    const principleUnits: PrincipleUnit[] = phasePrinciples.map(p => {
      const lessons = lessonsByPrinciple.get(p.id) || [];
      return createPrincipleUnit(p.id, lessons);
    });

    return {
      phase,
      phaseTitle: `${phase.charAt(0) + phase.slice(1).toLowerCase()} Game`,
      phaseDescription: `Principles and strategies for the ${phase.toLowerCase()} phase`,
      phaseIntroLesson: null,
      principleUnits,
      totalLessons: principleUnits.reduce((sum, u) => sum + u.lessonCount, 0),
    };
  });

  // Build learning path from original or generate new one
  const learningPath = {
    recommended: legacy.learningPath?.recommended || allLessons.map(l => l.lessonId),
  };

  return {
    curriculumTitle: legacy.curriculumTitle,
    targetAudience: legacy.targetAudience,
    estimatedDuration: legacy.estimatedDuration,
    universalPrinciplesModule,
    phaseModules,
    learningPath,
    designRationale: legacy.designRationale || null,
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Curriculum Artifact Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  if (projectId) {
    console.log(`Project filter: ${projectId}`);
  }
  console.log('');

  // Find curriculum artifacts
  const whereClause: Prisma.GuruArtifactWhereInput = {
    type: GuruArtifactType.CURRICULUM
  };
  if (projectId) {
    whereClause.projectId = projectId;
  }

  const artifacts = await prisma.guruArtifact.findMany({
    where: whereClause,
    orderBy: { generatedAt: 'desc' },
    include: {
      project: {
        select: { name: true },
      },
    },
  });

  console.log(`Found ${artifacts.length} curriculum artifact(s)\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const artifact of artifacts) {
    const projectName = artifact.project?.name || 'Unknown';
    const prefix = `[${projectName}] Artifact ${artifact.id.slice(0, 8)}...`;

    try {
      if (isNewFormat(artifact.content)) {
        console.log(`${prefix} Already in new format - SKIPPED`);
        skippedCount++;
        continue;
      }

      if (!isLegacyFormat(artifact.content)) {
        console.log(`${prefix} Unrecognized format - SKIPPED`);
        skippedCount++;
        continue;
      }

      const legacy = artifact.content as LegacyCurriculumOutput;
      const legacyLessonCount = (legacy.modules || []).reduce(
        (sum, m) => sum + (m.lessons || []).length,
        0
      );

      const migrated = migrateCurriculum(legacy);
      const migratedLessonCount =
        migrated.universalPrinciplesModule.totalLessons +
        migrated.phaseModules.reduce((sum, m) => sum + m.totalLessons, 0);

      console.log(`${prefix}`);
      console.log(`  Legacy: ${(legacy.modules || []).length} modules, ${legacyLessonCount} lessons`);
      console.log(`  New: Universal + ${migrated.phaseModules.length} phase modules, ${migratedLessonCount} lessons`);

      if (!isDryRun) {
        await prisma.guruArtifact.update({
          where: { id: artifact.id },
          data: { content: migrated as unknown as Prisma.InputJsonValue },
        });
        console.log(`  Status: MIGRATED`);
      } else {
        console.log(`  Status: WOULD MIGRATE (dry run)`);
      }

      migratedCount++;
    } catch (error) {
      console.log(`${prefix} ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total artifacts:  ${artifacts.length}`);
  console.log(`Migrated:         ${migratedCount}`);
  console.log(`Skipped:          ${skippedCount}`);
  console.log(`Errors:           ${errorCount}`);

  if (isDryRun && migratedCount > 0) {
    console.log('\nRun without --dry-run to apply migrations.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
