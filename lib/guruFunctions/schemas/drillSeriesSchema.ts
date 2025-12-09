/**
 * Drill Series Zod Schema
 *
 * Defines the output schema for drill series generation.
 * Uses .nullable().optional() for optional fields per OpenAI strict mode requirement.
 */

import { z } from 'zod'

export const drillOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
  commonMistake: z.string().nullable().optional(),
})

export const drillScenarioSchema = z.object({
  setup: z.string(),
  visual: z.string().nullable().optional(),
  question: z.string(),
})

export const correctFeedbackSchema = z.object({
  brief: z.string(),
  principleReinforcement: z.string(),
  expanded: z.string().nullable().optional(),
})

export const incorrectFeedbackSchema = z.object({
  brief: z.string(),
  principleReminder: z.string(),
  commonMistakeAddress: z.string(),
  tryAgainHint: z.string(),
})

export const drillFeedbackSchema = z.object({
  correct: correctFeedbackSchema,
  incorrect: incorrectFeedbackSchema,
})

export const drillMetadataSchema = z.object({
  estimatedSeconds: z.number(),
  prerequisiteDrills: z.array(z.string()),
  tags: z.array(z.string()),
})

export const drillSchema = z.object({
  drillId: z.string(),
  tier: z.enum(['RECOGNITION', 'APPLICATION', 'TRANSFER']),
  scenario: drillScenarioSchema,
  options: z.array(drillOptionSchema),
  correctAnswer: z.string(),
  feedback: drillFeedbackSchema,
  asciiWireframe: z.string().nullable().optional(),
  metadata: drillMetadataSchema,
})

export const principleSeriesSchema = z.object({
  seriesId: z.string(),
  principleId: z.string(),
  principleName: z.string(),
  seriesDescription: z.string(),
  drills: z.array(drillSchema),
})

export const practiceSequenceSchema = z.object({
  name: z.string(),
  description: z.string(),
  drillIds: z.array(z.string()),
})

export const drillSeriesSchema = z.object({
  drillSeriesTitle: z.string(),
  targetPrinciples: z.array(z.string()),
  totalDrills: z.number(),
  estimatedCompletionMinutes: z.number(),
  series: z.array(principleSeriesSchema),
  practiceSequences: z.array(practiceSequenceSchema).nullable().optional(), // Made optional per simplification
})

export type DrillOption = z.infer<typeof drillOptionSchema>
export type DrillScenario = z.infer<typeof drillScenarioSchema>
export type DrillFeedback = z.infer<typeof drillFeedbackSchema>
export type DrillMetadata = z.infer<typeof drillMetadataSchema>
export type Drill = z.infer<typeof drillSchema>
export type PrincipleSeries = z.infer<typeof principleSeriesSchema>
export type PracticeSequence = z.infer<typeof practiceSequenceSchema>
export type DrillSeriesOutput = z.infer<typeof drillSeriesSchema>
