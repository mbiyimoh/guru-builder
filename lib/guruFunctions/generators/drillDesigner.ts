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
  const {
    contextLayers,
    knowledgeFiles,
    domain,
    userNotes,
    mentalModel,
    curriculum,
    customSystemPrompt,
    customUserPromptTemplate,
  } = options

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

  // Build user prompt - use custom template if provided, otherwise default builder
  let userPrompt: string
  if (customUserPromptTemplate) {
    // Substitute variables in custom template
    userPrompt = customUserPromptTemplate
      .replace(/\{\{domain\}\}/g, domain)
      .replace(/\{\{corpusSummary\}\}/g, corpusSummary)
      .replace(/\{\{userNotes\}\}/g, userNotes || '')
      .replace(/\{\{mentalModel\}\}/g, JSON.stringify(mentalModel, null, 2))
      .replace(/\{\{curriculum\}\}/g, JSON.stringify(curriculum, null, 2))
  } else {
    userPrompt = buildDrillDesignerPrompt({
      domain,
      corpusSummary,
      mentalModel,
      curriculum,
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
    userPrompt,
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

  // Design Thoughts section (new)
  if (drillSeries.designThoughts) {
    lines.push('---')
    lines.push('')
    lines.push('## Design Thoughts')
    lines.push('')
    lines.push(`**Methodology Rationale:** ${drillSeries.designThoughts.methodologyRationale}`)
    lines.push('')
    lines.push(`**Variety Analysis:** ${drillSeries.designThoughts.varietyAnalysis}`)
    lines.push('')
    lines.push(`**Pedagogical Notes:** ${drillSeries.designThoughts.pedagogicalNotes}`)
    lines.push('')
    if (drillSeries.designThoughts.distinctiveElements) {
      lines.push(`**Distinctive Elements:** ${drillSeries.designThoughts.distinctiveElements}`)
      lines.push('')
    }
  }

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
