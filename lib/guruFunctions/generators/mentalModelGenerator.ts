/**
 * Mental Model Generator
 *
 * Generates a principle-based mental model from a guru's corpus using GPT-4o.
 */

import { zodResponseFormat } from 'openai/helpers/zod'
import { mentalModelSchema, type MentalModelOutput } from '../schemas/mentalModelSchema'
import { buildMentalModelPrompt } from '../prompts/mentalModelPrompt'
import { composeCorpusSummary, computeCorpusHash, countCorpusWords } from '../corpusHasher'
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

/**
 * Generate a mental model from corpus content.
 */
export async function generateMentalModel(
  options: GeneratorOptions
): Promise<GenerationResult<MentalModelOutput>> {
  const { contextLayers, knowledgeFiles, domain, userNotes } = options

  // Validate corpus has content
  if (contextLayers.length === 0 && knowledgeFiles.length === 0) {
    throw new Error('Cannot generate mental model from empty corpus')
  }

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)
  const corpusWordCount = countCorpusWords(contextLayers, knowledgeFiles)

  const prompt = buildMentalModelPrompt({
    domain,
    corpusSummary,
    corpusWordCount,
    userNotes,
  })

  const openai = getOpenAIClient()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert instructional designer creating mental models for teaching.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'mental_model',
        schema: zodResponseFormat(mentalModelSchema, 'mental_model').json_schema.schema,
        strict: true,
      },
    },
    temperature: 0.7,
  })

  const rawContent = completion.choices[0].message.content
  if (!rawContent) {
    throw new Error('No content in mental model response')
  }

  // Parse and validate with Zod
  const parsed = JSON.parse(rawContent)
  const content = mentalModelSchema.parse(parsed)

  const markdown = renderMentalModelMarkdown(content)

  return {
    content,
    markdown,
    corpusHash,
  }
}

/**
 * Render mental model as readable Markdown.
 */
export function renderMentalModelMarkdown(model: MentalModelOutput): string {
  const lines: string[] = []

  lines.push(`# ${model.domainTitle}`)
  lines.push('')
  lines.push(`**Teaching Approach:** ${model.teachingApproach}`)
  lines.push('')

  // Categories and principles
  const sortedCategories = [...model.categories].sort(
    (a, b) => a.orderInLearningPath - b.orderInLearningPath
  )

  for (const category of sortedCategories) {
    lines.push(`## ${category.orderInLearningPath}. ${category.name}`)
    lines.push('')
    lines.push(category.description)
    lines.push('')

    if (category.mentalModelMetaphor) {
      lines.push(`> **Mental Model:** ${category.mentalModelMetaphor}`)
      lines.push('')
    }

    for (const principle of category.principles) {
      lines.push(`### ${principle.name}`)
      lines.push('')
      lines.push(`**Essence:** ${principle.essence}`)
      lines.push('')
      lines.push(`**Why It Matters:** ${principle.whyItMatters}`)
      lines.push('')
      lines.push(`**Common Mistake:** ${principle.commonMistake}`)
      lines.push('')
      lines.push(`**Recognition Pattern:** ${principle.recognitionPattern}`)
      lines.push('')
    }
  }

  // Principle connections
  if (model.principleConnections.length > 0) {
    lines.push('---')
    lines.push('')
    lines.push('## Principle Connections')
    lines.push('')
    model.principleConnections.forEach(conn => {
      lines.push(`- **${conn.fromPrinciple}** ↔ **${conn.toPrinciple}**: ${conn.relationship}`)
    })
    lines.push('')
  }

  // Mastery summary
  lines.push('---')
  lines.push('')
  lines.push('## Mastery Summary')
  lines.push('')
  lines.push(model.masterySummary)

  return lines.join('\n')
}
