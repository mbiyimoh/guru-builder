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
  // Custom prompts (resolved before calling generator)
  customSystemPrompt?: string
  customUserPromptTemplate?: string
}

export interface GenerationResult<T> {
  content: T
  markdown: string
  corpusHash: string
  userPrompt: string  // The user prompt sent to GPT (for versioning)
}
