import { z } from 'zod';

/**
 * Phase-Organized Drill Series Schema
 *
 * CRITICAL: This schema uses a hierarchical structure:
 * phases[] → principleGroups[] → drills[]
 *
 * Each drill has DUAL principle tagging:
 * - primaryPrincipleId: The phase-specific principle being practiced
 * - universalPrincipleIds: Universal principles also reinforced (can be empty)
 */

/**
 * Individual drill within a principle group
 * Tagged with both phase-specific and universal principles
 */
export const phaseDrillSchema = z.object({
  drillId: z.string(),
  tier: z.enum(['RECOGNITION', 'APPLICATION', 'TRANSFER']),
  methodology: z.string(),
  gamePhase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']),
  positionId: z.string(),

  // DUAL PRINCIPLE TAGGING
  primaryPrincipleId: z.string(),             // Phase-specific principle (required)
  universalPrincipleIds: z.array(z.string()), // Universal principles (can be empty array)

  // Drill content
  scenario: z.string(),
  question: z.string(),
  answerFormat: z.enum(['MULTIPLE_CHOICE', 'MOVE_SELECTION', 'POSITION_EVAL']),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCorrect: z.boolean(),
  })).nullable().optional(),
  correctAnswer: z.string(),
  explanation: z.string(),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
    partialCredit: z.string().nullable().optional(),
  }),
  hints: z.array(z.string()).nullable().optional(),
  relatedConcepts: z.array(z.string()).nullable().optional(),
});

/**
 * Principle group containing drills that practice the same principle
 * Forms the middle layer of the hierarchy
 */
export const principleDrillGroupSchema = z.object({
  principleId: z.string(),           // e.g., "point-making"
  principleName: z.string(),         // e.g., "Point-Making Priority"
  principleDescription: z.string(),
  drillCount: z.number(),
  drills: z.array(phaseDrillSchema),
});

/**
 * Phase section containing principle groups (NOT flat drills)
 * Each phase groups drills by the principles they practice
 */
export const phaseSectionSchema = z.object({
  phase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']),
  phaseTitle: z.string(),
  phaseDescription: z.string(),
  targetDrillCount: z.number(),
  actualDrillCount: z.number(),
  universalPrinciples: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
  principleGroups: z.array(principleDrillGroupSchema),  // HIERARCHICAL: drills nested within principles
});

/**
 * Main output schema for phase-organized drill series
 * Structure: phases[] → principleGroups[] → drills[]
 */
export const phaseOrganizedDrillSeriesSchema = z.object({
  drillSeriesTitle: z.string(),
  totalDrillCount: z.number(),
  estimatedCompletionMinutes: z.number(),
  phases: z.array(phaseSectionSchema),
  designThoughts: z.object({
    methodologyRationale: z.string(),
    varietyAnalysis: z.string(),
    pedagogicalNotes: z.string(),
    principleIntegration: z.string(),
  }).nullable().optional(),
});

// Export TypeScript types
export type PhaseDrill = z.infer<typeof phaseDrillSchema>;
export type PrincipleDrillGroup = z.infer<typeof principleDrillGroupSchema>;
export type PhaseSection = z.infer<typeof phaseSectionSchema>;
export type PhaseOrganizedDrillSeries = z.infer<typeof phaseOrganizedDrillSeriesSchema>;
