/**
 * Default Prompts Module
 *
 * Exports default system and user prompts for all artifact types.
 * Used when no custom prompts are configured for a project.
 */

import { CREATIVE_TEACHING_SYSTEM_PROMPT } from './creativeSystemPrompt'
import { buildMentalModelPrompt } from './mentalModelPrompt'
import { buildCurriculumPrompt } from './curriculumPrompt'
import { buildDrillDesignerPrompt } from './drillDesignerPrompt'

export type ArtifactType = 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'

export interface PromptDefaults {
  systemPrompt: string
  userPromptTemplate: string  // The template before variable substitution
}

/**
 * Get the default system prompt (shared across all artifact types)
 */
export function getDefaultSystemPrompt(): string {
  return CREATIVE_TEACHING_SYSTEM_PROMPT
}

/**
 * Get the default user prompt template for an artifact type.
 * This returns the template with placeholder markers for documentation.
 */
export function getDefaultUserPromptTemplate(artifactType: ArtifactType): string {
  switch (artifactType) {
    case 'MENTAL_MODEL':
      return buildMentalModelPrompt({
        domain: '{{domain}}',
        corpusSummary: '{{corpusSummary}}',
        corpusWordCount: 0,
        userNotes: '{{userNotes}}',
      })
    case 'CURRICULUM':
      // For curriculum, we need to pass a placeholder mental model
      // The actual mental model will be JSON stringified in the prompt
      return buildCurriculumPrompt({
        domain: '{{domain}}',
        corpusSummary: '{{corpusSummary}}',
        mentalModel: {
          domainTitle: '{{mentalModel.domainTitle}}',
          teachingApproach: '{{mentalModel.teachingApproach}}',
          categories: [],
          principleConnections: [],
          masterySummary: '{{mentalModel.masterySummary}}',
        },
        userNotes: '{{userNotes}}',
      })
    case 'DRILL_SERIES':
      // For drills, we need placeholder mental model and curriculum
      return buildDrillDesignerPrompt({
        domain: '{{domain}}',
        corpusSummary: '{{corpusSummary}}',
        mentalModel: {
          domainTitle: '{{mentalModel.domainTitle}}',
          teachingApproach: '{{mentalModel.teachingApproach}}',
          categories: [],
          principleConnections: [],
          masterySummary: '{{mentalModel.masterySummary}}',
        },
        curriculum: {
          curriculumTitle: '{{curriculum.curriculumTitle}}',
          targetAudience: '{{curriculum.targetAudience}}',
          estimatedDuration: '{{curriculum.estimatedDuration}}',
          modules: [],
          learningPath: { recommended: [] },
        },
        userNotes: '{{userNotes}}',
      })
  }
}

/**
 * Get both default prompts for an artifact type.
 */
export function getDefaultPrompts(artifactType: ArtifactType): PromptDefaults {
  return {
    systemPrompt: getDefaultSystemPrompt(),
    userPromptTemplate: getDefaultUserPromptTemplate(artifactType),
  }
}
