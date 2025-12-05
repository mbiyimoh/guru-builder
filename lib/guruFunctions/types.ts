/**
 * Guru Teaching Functions - Type Definitions
 *
 * Core types used across all guru teaching function generators.
 * Note: Output types (MentalModelOutput, CurriculumOutput, DrillSeriesOutput)
 * are defined in their respective schema files for Zod inference.
 */

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
}

export interface GenerationResult<T> {
  content: T
  markdown: string
  corpusHash: string
}
