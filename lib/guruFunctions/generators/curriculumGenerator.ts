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
  const { contextLayers, knowledgeFiles, domain, userNotes, mentalModel } = options

  // Validate inputs
  if (!mentalModel) {
    throw new Error('Mental model is required to generate curriculum')
  }

  if (contextLayers.length === 0 && knowledgeFiles.length === 0) {
    throw new Error('Cannot generate curriculum from empty corpus')
  }

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)

  const prompt = buildCurriculumPrompt({
    domain,
    corpusSummary,
    mentalModel,
    userNotes,
  })

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert curriculum designer creating progressive disclosure learning content.',
      },
      {
        role: 'user',
        content: prompt,
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
