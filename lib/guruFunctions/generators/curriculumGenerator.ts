/**
 * Curriculum Generator
 *
 * Generates a progressive disclosure curriculum from a mental model using GPT-4o.
 * Requires a completed mental model as a dependency.
 */

import { zodResponseFormat } from 'openai/helpers/zod'
import { curriculumSchema, type CurriculumOutput } from '../schemas/curriculumSchema'
import type { MentalModelOutput } from '../schemas/mentalModelSchema'
import { buildCurriculumPrompt } from '../prompts/curriculumPrompt'
import { CREATIVE_TEACHING_SYSTEM_PROMPT } from '../prompts/creativeSystemPrompt'
import { composeCorpusSummary, computeCorpusHash } from '../corpusHasher'
import type { GeneratorOptions, GenerationResult } from '../types'

// Lazy-load OpenAI client to avoid build-time errors
let openaiClient: import('openai').default | null = null

function getOpenAIClient(): import('openai').default {
  if (!openaiClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai').default
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient!
}

export interface CurriculumGeneratorOptions extends GeneratorOptions {
  mentalModel: MentalModelOutput
}

/**
 * Generate a curriculum from a mental model and corpus content.
 */
export async function generateCurriculum(
  options: CurriculumGeneratorOptions
): Promise<GenerationResult<CurriculumOutput>> {
  const {
    contextLayers,
    knowledgeFiles,
    domain,
    userNotes,
    mentalModel,
    customSystemPrompt,
    customUserPromptTemplate,
  } = options

  // Validate inputs
  if (!mentalModel) {
    throw new Error('Mental model is required to generate curriculum')
  }

  if (contextLayers.length === 0 && knowledgeFiles.length === 0) {
    throw new Error('Cannot generate curriculum from empty corpus')
  }

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)

  // Build user prompt - use custom template if provided, otherwise default builder
  let userPrompt: string
  if (customUserPromptTemplate) {
    // Substitute variables in custom template
    userPrompt = customUserPromptTemplate
      .replace(/\{\{domain\}\}/g, domain)
      .replace(/\{\{corpusSummary\}\}/g, corpusSummary)
      .replace(/\{\{userNotes\}\}/g, userNotes || '')
      .replace(/\{\{mentalModel\}\}/g, JSON.stringify(mentalModel, null, 2))
  } else {
    userPrompt = buildCurriculumPrompt({
      domain,
      corpusSummary,
      mentalModel,
      userNotes,
    })
  }

  // Use custom system prompt if provided
  const systemPrompt = customSystemPrompt ?? CREATIVE_TEACHING_SYSTEM_PROMPT

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'curriculum',
        schema: zodResponseFormat(curriculumSchema, 'curriculum').json_schema.schema,
        strict: true,
      },
    },
    temperature: 0.7,
  })

  const rawContent = completion.choices[0].message.content
  if (!rawContent) {
    throw new Error('No content in curriculum response')
  }

  // Parse and validate with Zod
  const parsed = JSON.parse(rawContent)
  const content = curriculumSchema.parse(parsed)

  const markdown = renderCurriculumMarkdown(content)

  return {
    content,
    markdown,
    corpusHash,
    userPrompt,
  }
}

/**
 * Render curriculum as readable Markdown.
 */
export function renderCurriculumMarkdown(curriculum: CurriculumOutput): string {
  const lines: string[] = []

  lines.push(`# ${curriculum.curriculumTitle}`)
  lines.push('')
  lines.push(`**Target Audience:** ${curriculum.targetAudience}`)
  lines.push('')
  lines.push(`**Estimated Duration:** ${curriculum.estimatedDuration}`)
  lines.push('')

  // Design Rationale section (new)
  if (curriculum.designRationale) {
    lines.push('---')
    lines.push('')
    lines.push('## Design Rationale')
    lines.push('')
    lines.push(`**Approaches Considered:** ${curriculum.designRationale.approachesConsidered.join(', ')}`)
    lines.push('')
    lines.push(`**Selected Approach:** ${curriculum.designRationale.selectedApproach}`)
    lines.push('')
    lines.push(`**Why This Approach:** ${curriculum.designRationale.selectionReasoning}`)
    lines.push('')
    if (curriculum.designRationale.engagementStrategy) {
      lines.push(`**Engagement Strategy:** ${curriculum.designRationale.engagementStrategy}`)
      lines.push('')
    }
    if (curriculum.designRationale.progressionLogic) {
      lines.push(`**Progression Logic:** ${curriculum.designRationale.progressionLogic}`)
      lines.push('')
    }
  }

  // Learning path
  lines.push('## Learning Path')
  lines.push('')
  lines.push(`Recommended order: ${curriculum.learningPath.recommended.join(' → ')}`)
  lines.push('')

  // Modules
  for (const module of curriculum.modules) {
    lines.push(`---`)
    lines.push('')
    lines.push(`## Module: ${module.title}`)
    lines.push('')
    lines.push(`*${module.subtitle}*`)
    lines.push('')

    if (module.prerequisites.length > 0) {
      lines.push(`**Prerequisites:** ${module.prerequisites.join(', ')}`)
      lines.push('')
    }

    lines.push('### Learning Objectives')
    lines.push('')
    module.learningObjectives.forEach((obj, i) => {
      lines.push(`${i + 1}. ${obj}`)
    })
    lines.push('')

    // Lessons
    lines.push('### Lessons')
    lines.push('')

    for (const lesson of module.lessons) {
      const typeEmoji = {
        CONCEPT: '💡',
        EXAMPLE: '📖',
        CONTRAST: '⚖️',
        PRACTICE: '🎯',
      }[lesson.type]

      lines.push(`#### ${typeEmoji} ${lesson.title} (${lesson.type})`)
      lines.push('')
      lines.push(`**${lesson.content.headline}**`)
      lines.push('')
      lines.push(lesson.content.essence)
      lines.push('')

      if (lesson.content.expandedContent) {
        lines.push('<details>')
        lines.push('<summary>Learn more...</summary>')
        lines.push('')
        lines.push(lesson.content.expandedContent)
        lines.push('')
        lines.push('</details>')
        lines.push('')
      }

      lines.push(`*Difficulty: ${lesson.metadata.difficultyTier} | ~${lesson.metadata.estimatedMinutes} min*`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
