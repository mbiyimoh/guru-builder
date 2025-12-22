/**
 * Curriculum Zod Schema
 *
 * STRUCTURE: Mirrors drill series hierarchy
 * - Drills: phases[].principleGroups[].drills[]
 * - Curriculum: universalPrinciplesModule + phaseModules[].principleUnits[].lessons[]
 *
 * Universal principles are taught FIRST, then phase-specific principles.
 * Uses .nullable().optional() for optional fields per OpenAI strict mode requirement.
 */

import { z } from 'zod'

/**
 * Lesson content structure
 * Three-tier content: headline, essence, expanded
 */
export const lessonContentSchema = z.object({
  headline: z.string(),
  essence: z.string(),
  expandedContent: z.string(),
})

/**
 * Lesson metadata
 */
export const lessonMetadataSchema = z.object({
  difficultyTier: z.enum(['FOUNDATION', 'EXPANSION', 'MASTERY']),
  estimatedMinutes: z.number(),
})

/**
 * Individual lesson schema
 * Each lesson teaches one principle through a specific pedagogical approach
 */
export const lessonSchema = z.object({
  lessonId: z.string(),
  principleId: z.string(),
  type: z.enum(['CONCEPT', 'EXAMPLE', 'CONTRAST', 'PRACTICE']),
  title: z.string(),
  content: lessonContentSchema,
  metadata: lessonMetadataSchema,
})

/**
 * Principle Unit schema
 * Groups lessons that teach the same principle (mirrors drill principleGroups)
 */
export const principleUnitSchema = z.object({
  principleId: z.string(),
  principleName: z.string(),
  principleDescription: z.string(),
  lessonCount: z.number(),
  lessons: z.array(lessonSchema),
})

/**
 * Phase Module schema
 * Contains principle units for a specific game phase (mirrors drill phases)
 */
export const phaseModuleSchema = z.object({
  phase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']),
  phaseTitle: z.string(),
  phaseDescription: z.string(),
  phaseIntroLesson: lessonSchema.nullable().optional(),
  principleUnits: z.array(principleUnitSchema),
  totalLessons: z.number(),
})

/**
 * Universal Principles Module schema
 * Taught FIRST before any phase-specific content
 */
export const universalPrinciplesModuleSchema = z.object({
  moduleTitle: z.string(),
  moduleDescription: z.string(),
  principleUnits: z.array(principleUnitSchema),
  totalLessons: z.number(),
})

/**
 * Design rationale schema for curriculum generation.
 * Captures curriculum-specific design decisions.
 */
export const curriculumDesignRationaleSchema = z.object({
  approachesConsidered: z.array(z.string()),  // e.g., ["Mastery-Based", "Challenge-First", "Story-Integrated"]
  selectedApproach: z.string(),
  selectionReasoning: z.string(),
  engagementStrategy: z.string().nullable().optional(),  // How engagement is maintained
  progressionLogic: z.string().nullable().optional(),    // Why lessons are ordered this way
}).nullable().optional()

/**
 * Main Curriculum schema
 * Structure: universalPrinciplesModule + phaseModules[].principleUnits[].lessons[]
 */
export const curriculumSchema = z.object({
  curriculumTitle: z.string(),
  targetAudience: z.string(),
  estimatedDuration: z.string(),

  // Universal principles taught FIRST
  universalPrinciplesModule: universalPrinciplesModuleSchema,

  // Phase modules with nested principle units (mirrors drill structure)
  phaseModules: z.array(phaseModuleSchema),

  // Recommended learning order
  learningPath: z.object({
    recommended: z.array(z.string()),
  }),

  // Design rationale documenting curriculum design decisions
  designRationale: curriculumDesignRationaleSchema,
})

// Export TypeScript types
export type LessonContent = z.infer<typeof lessonContentSchema>
export type LessonMetadata = z.infer<typeof lessonMetadataSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type PrincipleUnit = z.infer<typeof principleUnitSchema>
export type PhaseModule = z.infer<typeof phaseModuleSchema>
export type UniversalPrinciplesModule = z.infer<typeof universalPrinciplesModuleSchema>
export type CurriculumDesignRationale = z.infer<typeof curriculumDesignRationaleSchema>
export type CurriculumOutput = z.infer<typeof curriculumSchema>
