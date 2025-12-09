/**
 * Curriculum Zod Schema
 *
 * Defines the output schema for curriculum generation.
 * Uses .nullable().optional() for optional fields per OpenAI strict mode requirement.
 */

import { z } from 'zod'

export const lessonContentSchema = z.object({
  headline: z.string(),
  essence: z.string(),
  expandedContent: z.string(),
})

export const lessonMetadataSchema = z.object({
  difficultyTier: z.enum(['FOUNDATION', 'EXPANSION', 'MASTERY']),
  estimatedMinutes: z.number(),
})

export const lessonSchema = z.object({
  lessonId: z.string(),
  principleId: z.string(),
  type: z.enum(['CONCEPT', 'EXAMPLE', 'CONTRAST', 'PRACTICE']),
  title: z.string(),
  content: lessonContentSchema,
  metadata: lessonMetadataSchema,
})

export const curriculumModuleSchema = z.object({
  moduleId: z.string(),
  categoryId: z.string(),
  title: z.string(),
  subtitle: z.string(),
  learningObjectives: z.array(z.string()),
  prerequisites: z.array(z.string()),
  lessons: z.array(lessonSchema),
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

export const curriculumSchema = z.object({
  curriculumTitle: z.string(),
  targetAudience: z.string(),
  estimatedDuration: z.string(),
  modules: z.array(curriculumModuleSchema),
  learningPath: z.object({
    recommended: z.array(z.string()),
  }),
  // NEW: Design rationale documenting curriculum design decisions
  designRationale: curriculumDesignRationaleSchema,
})

export type LessonContent = z.infer<typeof lessonContentSchema>
export type LessonMetadata = z.infer<typeof lessonMetadataSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type CurriculumModule = z.infer<typeof curriculumModuleSchema>
export type CurriculumDesignRationale = z.infer<typeof curriculumDesignRationaleSchema>
export type CurriculumOutput = z.infer<typeof curriculumSchema>
