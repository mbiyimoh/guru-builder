/**
 * Mental Model Zod Schema
 *
 * Defines the output schema for mental model generation.
 * Uses .nullable().optional() for optional fields per OpenAI strict mode requirement.
 */

import { z } from 'zod'

export const mentalModelPrincipleSchema = z.object({
  id: z.string(),
  name: z.string(),
  essence: z.string(),
  whyItMatters: z.string(),
  commonMistake: z.string(),
  recognitionPattern: z.string(),
})

export const mentalModelCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  mentalModelMetaphor: z.string().nullable().optional(),
  principles: z.array(mentalModelPrincipleSchema),
  orderInLearningPath: z.number(),
})

export const mentalModelConnectionSchema = z.object({
  fromPrinciple: z.string(),
  toPrinciple: z.string(),
  relationship: z.string(),
})

/**
 * Design rationale schema for mental model generation.
 * Captures the AI's reasoning about approach selection.
 */
export const designRationaleSchema = z.object({
  approachesConsidered: z.array(z.string()),
  selectedApproach: z.string(),
  selectionReasoning: z.string(),
  tradeoffs: z.string().nullable().optional(),
}).nullable().optional()

export const mentalModelSchema = z.object({
  domainTitle: z.string(),
  teachingApproach: z.string(),
  categories: z.array(mentalModelCategorySchema),
  principleConnections: z.array(mentalModelConnectionSchema),
  masterySummary: z.string(),
  // NEW: Design rationale documenting AI's approach selection
  designRationale: designRationaleSchema,
})

export type DesignRationale = z.infer<typeof designRationaleSchema>
export type MentalModelOutput = z.infer<typeof mentalModelSchema>
