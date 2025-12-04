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

export const assessmentConfigSchema = z.object({
  engineUrl: z.string().url().default('https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'),
  isEnabled: z.boolean().default(true),
})

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
