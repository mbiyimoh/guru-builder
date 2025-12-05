/**
 * Drill Designer Generator
 *
 * Generates deliberate practice drills from mental model and curriculum using GPT-4o.
 * Requires both mental model and curriculum as dependencies.
 */

import { zodResponseFormat } from 'openai/helpers/zod'
import { drillSeriesSchema, type DrillSeriesOutput } from '../schemas/drillSeriesSchema'
import type { MentalModelOutput } from '../schemas/mentalModelSchema'
import type { CurriculumOutput } from '../schemas/curriculumSchema'
import { buildDrillDesignerPrompt } from '../prompts/drillDesignerPrompt'
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

export interface DrillDesignerOptions extends GeneratorOptions {
  mentalModel: MentalModelOutput
  curriculum: CurriculumOutput
}

/**
 * Generate drill series from mental model and curriculum.
 */
export async function generateDrillSeries(
  options: DrillDesignerOptions
): Promise<GenerationResult<DrillSeriesOutput>> {
  const { contextLayers, knowledgeFiles, domain, userNotes, mentalModel, curriculum } = options

  // Validate inputs
  if (!mentalModel) {
    throw new Error('Mental model is required to generate drills')
  }

  if (!curriculum) {
    throw new Error('Curriculum is required to generate drills')
  }

  if (contextLayers.length === 0 && knowledgeFiles.length === 0) {
    throw new Error('Cannot generate drills from empty corpus')
  }

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)

  const prompt = buildDrillDesignerPrompt({
    domain,
    corpusSummary,
    mentalModel,
    curriculum,
    userNotes,
  })

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert in deliberate practice drill design for skill development.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'drill_series',
        schema: zodResponseFormat(drillSeriesSchema, 'drill_series').json_schema.schema,
        strict: true,
      },
    },
    temperature: 0.7,
  })

  const rawContent = completion.choices[0].message.content
  if (!rawContent) {
    throw new Error('No content in drill series response')
  }

  // Parse and validate with Zod
  const parsed = JSON.parse(rawContent)
  const content = drillSeriesSchema.parse(parsed)

  const markdown = renderDrillSeriesMarkdown(content)

  return {
    content,
    markdown,
    corpusHash,
  }
}

/**
 * Render drill series as readable Markdown with ASCII wireframes.
 */
export function renderDrillSeriesMarkdown(drillSeries: DrillSeriesOutput): string {
  const lines: string[] = []

  lines.push(`# ${drillSeries.drillSeriesTitle}`)
  lines.push('')
  lines.push(`**Total Drills:** ${drillSeries.totalDrills}`)
  lines.push('')
  lines.push(`**Estimated Time:** ${drillSeries.estimatedCompletionMinutes} minutes`)
  lines.push('')
  lines.push(`**Target Principles:** ${drillSeries.targetPrinciples.join(', ')}`)
  lines.push('')

  // Series
  for (const series of drillSeries.series) {
    lines.push('---')
    lines.push('')
    lines.push(`## ${series.principleName}`)
    lines.push('')
    lines.push(series.seriesDescription)
    lines.push('')

    // Drills
    for (const drill of series.drills) {
      const tierEmoji = {
        RECOGNITION: '👁️',
        APPLICATION: '🎯',
        TRANSFER: '🚀',
      }[drill.tier]

      lines.push(`### ${tierEmoji} Drill: ${drill.tier}`)
      lines.push('')
      lines.push(`*~${drill.metadata.estimatedSeconds} seconds*`)
      lines.push('')

      // Scenario
      lines.push('**Scenario:**')
      lines.push('')
      lines.push(drill.scenario.setup)
      lines.push('')

      // ASCII wireframe if present
      if (drill.asciiWireframe) {
        lines.push('```')
        lines.push(drill.asciiWireframe)
        lines.push('```')
        lines.push('')
      }

      lines.push(`**Question:** ${drill.scenario.question}`)
      lines.push('')

      // Options
      lines.push('**Options:**')
      lines.push('')
      for (const option of drill.options) {
        const marker = option.isCorrect ? '✓' : '○'
        lines.push(`- ${marker} **${option.id}:** ${option.text}`)
      }
      lines.push('')

      // Feedback (collapsed)
      lines.push('<details>')
      lines.push('<summary>View Feedback</summary>')
      lines.push('')
      lines.push('**Correct:**')
      lines.push(`> ${drill.feedback.correct.brief}`)
      lines.push('')
      lines.push(`*Principle: ${drill.feedback.correct.principleReinforcement}*`)
      lines.push('')
      lines.push('**If Incorrect:**')
      lines.push(`> ${drill.feedback.incorrect.brief}`)
      lines.push('')
      lines.push(`*Remember: ${drill.feedback.incorrect.principleReminder}*`)
      lines.push('')
      lines.push(`💡 Hint: ${drill.feedback.incorrect.tryAgainHint}`)
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  // Practice sequences if present
  if (drillSeries.practiceSequences && drillSeries.practiceSequences.length > 0) {
    lines.push('---')
    lines.push('')
    lines.push('## Practice Sequences')
    lines.push('')
    for (const seq of drillSeries.practiceSequences) {
      lines.push(`### ${seq.name}`)
      lines.push('')
      lines.push(seq.description)
      lines.push('')
      lines.push(`Drills: ${seq.drillIds.join(' → ')}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
