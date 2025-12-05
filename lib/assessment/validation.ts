// lib/assessment/validation.ts

import { z } from 'zod'

export const diceRollSchema = z
  .string()
  .regex(/^[1-6]-[1-6]$/, 'Invalid dice roll format. Use format like "3-1"')

export const moveEvaluationSchema = z.object({
  equity: z.number(),
  diff: z.number(),
  probability: z.object({
    win: z.number(),
    lose: z.number(),
    winG: z.number(),
    loseG: z.number(),
    winBG: z.number(),
    loseBG: z.number(),
  }),
  info: z.object({
    cubeful: z.boolean(),
    plies: z.number(),
  }),
})

export const backgammonMoveSchema = z.object({
  move: z.string(),
  equity: z.number(),
  evaluation: moveEvaluationSchema.optional(),
})

// DEPRECATED: Legacy config schema - kept for backwards compatibility
export const assessmentConfigSchema = z.object({
  engineUrl: z.string().url().default('https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'),
  isEnabled: z.boolean().default(true),
})

// ============================================================================
// NEW LIBRARY ARCHITECTURE SCHEMAS
// ============================================================================

// Assessment Definition schemas (user's reusable assessment library)
export const createAssessmentDefinitionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  domain: z.string().min(1, 'Domain is required'), // e.g., "backgammon", "chess"
  engineType: z.string().optional(), // e.g., "gnubg", "stockfish"
  engineUrl: z.string().url('Invalid engine URL').optional(),
})

export const updateAssessmentDefinitionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  domain: z.string().min(1).optional(),
  engineType: z.string().optional().nullable(),
  engineUrl: z.string().url().optional().nullable(),
})

export const assessmentDefinitionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  domain: z.string(),
  engineType: z.string().nullable(),
  engineUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Project Assessment schemas (linking definitions to projects)
export const createProjectAssessmentSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  assessmentDefinitionId: z.string().min(1, 'Assessment Definition ID is required'),
  isEnabled: z.boolean().default(true),
})

export const updateProjectAssessmentSchema = z.object({
  isEnabled: z.boolean().optional(),
})

export const projectAssessmentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  assessmentDefinitionId: z.string(),
  isEnabled: z.boolean(),
  createdAt: z.date(),
})

// Type exports
export type CreateAssessmentDefinitionInput = z.infer<typeof createAssessmentDefinitionSchema>
export type UpdateAssessmentDefinitionInput = z.infer<typeof updateAssessmentDefinitionSchema>
export type AssessmentDefinitionData = z.infer<typeof assessmentDefinitionSchema>
export type CreateProjectAssessmentInput = z.infer<typeof createProjectAssessmentSchema>
export type UpdateProjectAssessmentInput = z.infer<typeof updateProjectAssessmentSchema>
export type ProjectAssessmentData = z.infer<typeof projectAssessmentSchema>

export const saveResultSchema = z.object({
  sessionId: z.string(),
  diceRoll: diceRollSchema,
  guruResponse: z.string().min(1),
  bestMoves: z.array(backgammonMoveSchema),
  guruMatchedBest: z.boolean().nullable().optional(),
})

// AI SDK v5 message format with parts array
const aiSdkMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  // AI SDK v5 uses 'parts' array, not 'content' string
  parts: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
    })
  ),
  id: z.string().optional(),
  createdAt: z.any().optional(),
})

export const chatRequestSchema = z.object({
  messages: z.array(aiSdkMessageSchema),
  diceRoll: diceRollSchema,
})

export const groundTruthRequestSchema = z.object({
  diceRoll: diceRollSchema,
})

export type DiceRoll = z.infer<typeof diceRollSchema>
export type MoveEvaluationData = z.infer<typeof moveEvaluationSchema>
export type BackgammonMoveData = z.infer<typeof backgammonMoveSchema>
export type SaveResultData = z.infer<typeof saveResultSchema>
