/**
 * Mental Model Generator
 *
 * Generates a principle-based mental model from a guru's corpus using GPT-4o.
 */

import { zodResponseFormat } from 'openai/helpers/zod'
import { mentalModelSchema, type MentalModelOutput } from '../schemas/mentalModelSchema'
import { buildMentalModelPrompt } from '../prompts/mentalModelPrompt'
import { CREATIVE_TEACHING_SYSTEM_PROMPT } from '../prompts/creativeSystemPrompt'
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
  const {
    contextLayers,
    knowledgeFiles,
    domain,
    userNotes,
    customSystemPrompt,
    customUserPromptTemplate,
  } = options

  // Validate corpus has content
  if (contextLayers.length === 0 && knowledgeFiles.length === 0) {
    throw new Error('Cannot generate mental model from empty corpus')
  }

  const corpusSummary = composeCorpusSummary(contextLayers, knowledgeFiles)
  const corpusHash = computeCorpusHash(contextLayers, knowledgeFiles)
  const corpusWordCount = countCorpusWords(contextLayers, knowledgeFiles)

  // Build user prompt - use custom template if provided, otherwise default builder
  let userPrompt: string
  if (customUserPromptTemplate) {
    // Substitute variables in custom template
    userPrompt = customUserPromptTemplate
      .replace(/\{\{domain\}\}/g, domain)
      .replace(/\{\{corpusSummary\}\}/g, corpusSummary)
      .replace(/\{\{corpusWordCount\}\}/g, String(corpusWordCount))
      .replace(/\{\{userNotes\}\}/g, userNotes || '')
  } else {
    userPrompt = buildMentalModelPrompt({
      domain,
      corpusSummary,
      corpusWordCount,
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
    userPrompt,
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

  // Design Rationale section (new)
  if (model.designRationale) {
    lines.push('---')
    lines.push('')
    lines.push('## Design Rationale')
    lines.push('')
    lines.push(`**Approaches Considered:** ${model.designRationale.approachesConsidered.join(', ')}`)
    lines.push('')
    lines.push(`**Selected Approach:** ${model.designRationale.selectedApproach}`)
    lines.push('')
    lines.push(`**Why This Approach:** ${model.designRationale.selectionReasoning}`)
    lines.push('')
    if (model.designRationale.tradeoffs) {
      lines.push(`**Trade-offs:** ${model.designRationale.tradeoffs}`)
      lines.push('')
    }
  }

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
