/**
 * Guru Teaching Functions - Type Definitions
 *
 * Core types used across all guru teaching function generators.
 * Note: Output types (MentalModelOutput, CurriculumOutput, DrillSeriesOutput)
 * are defined in their respective schema files for Zod inference.
 */

import type { GuruProfileData } from '@/lib/guruProfile/types'

export interface CorpusItem {
  id?: string
  title: string
  content: string
}

export interface GeneratorOptions {
  projectId: string
  contextLayers: CorpusItem[]
  knowledgeFiles: CorpusItem[]
  domain: string
  userNotes?: string // Optional notes for regeneration
  // Custom prompts (resolved before calling generator)
  customSystemPrompt?: string
  customUserPromptTemplate?: string
  // Guru Profile (optional - injected into prompts when available)
  guruProfile?: GuruProfileData
}

export interface GenerationResult<T> {
  content: T
  markdown: string
  corpusHash: string
  userPrompt: string  // The user prompt sent to GPT (for versioning)
}

/**
 * Game phases supported by the drill generation system
 */
export type GamePhase = 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF'

/**
 * Configuration for drill series generation
 * Controls count, phases, and drill type distribution
 */
export interface DrillGenerationConfig {
  /** Which game phases to include (default: ['OPENING']) */
  gamePhases: GamePhase[]

  /** Target number of drills to generate (5-50, default: available positions) */
  targetDrillCount: number

  /** Proportion of "best move" drills vs principle-focused (0.0-1.0, default: 0.7) */
  directDrillRatio: number

  /** Whether to use stored positions from Position Library (default: true) */
  useExistingPositions: boolean

  /** If fetching new positions, how many to fetch (optional) */
  fetchNewPositionCount?: number

  /**
   * Maximum positions to seed per non-OPENING phase (default: 25).
   * OPENING phase always uses all 21 positions.
   * Higher values increase drill variety but use more tokens in the prompt.
   * Token budget: ~125 tokens per position, so 25 × 4 phases = ~12.5k tokens.
   */
  maxPositionsPerPhase?: number
}

/** Default configuration for drill generation */
export const DEFAULT_DRILL_CONFIG: DrillGenerationConfig = {
  gamePhases: ['OPENING'],
  targetDrillCount: 21,
  directDrillRatio: 0.7,
  useExistingPositions: true,
  maxPositionsPerPhase: 25,
}
