/**
 * Response Parser - Usage Examples
 *
 * Demonstrates how to use the response parser functions with real-world scenarios.
 * These examples show integration with the ground truth verification system.
 */

import { z } from 'zod'
import { drillSeriesSchema } from '../guruFunctions/schemas/drillSeriesSchema'
import type { ChatCompletion } from 'openai/resources/chat/completions'
import {
  parseStructuredDrillOutput,
  extractToolCalls,
  isGenerationComplete,
  parseToolCallArguments,
  extractErrorMessage,
} from './responseParser'

/**
 * Example 1: Parsing drill series from various GPT-4o response formats
 */
export function exampleParseDrillSeries() {
  // Scenario 1: Pure JSON response
  const pureJsonResponse = JSON.stringify({
    drillSeriesTitle: 'Opening Play Mastery',
    targetPrinciples: ['control', 'timing'],
    totalDrills: 3,
    estimatedCompletionMinutes: 15,
    series: [],
    designThoughts: null,
  })

  const result1 = parseStructuredDrillOutput(pureJsonResponse, drillSeriesSchema)
  if (result1.success && result1.data) {
    console.log('Parsed drill series:', result1.data.drillSeriesTitle)
  }

  // Scenario 2: JSON wrapped in markdown
  const markdownResponse = `
Here's the drill series I generated:

\`\`\`json
{
  "drillSeriesTitle": "Opening Play Mastery",
  "targetPrinciples": ["control", "timing"],
  "totalDrills": 3,
  "estimatedCompletionMinutes": 15,
  "series": [],
  "designThoughts": null
}
\`\`\`

This series focuses on fundamental opening strategies.
  `

  const result2 = parseStructuredDrillOutput(markdownResponse, drillSeriesSchema)
  if (result2.success && result2.data) {
    console.log('Extracted from markdown:', result2.data.drillSeriesTitle)
  } else {
    console.error('Parse failed:', result2.error)
  }

  // Scenario 3: JSON embedded in prose
  const proseResponse = `I've analyzed the curriculum and created a drill series: {"drillSeriesTitle": "Opening Play Mastery", "targetPrinciples": ["control"], "totalDrills": 3, "estimatedCompletionMinutes": 15, "series": [], "designThoughts": null} which should help students master these concepts.`

  const result3 = parseStructuredDrillOutput(proseResponse, drillSeriesSchema)
  if (result3.success && result3.data) {
    console.log('Extracted from prose:', result3.data.drillSeriesTitle)
  }
}

/**
 * Example 2: Handling tool calls in agentic loop
 */
export function exampleHandleToolCalls(response: ChatCompletion) {
  // Check if generation is complete
  if (isGenerationComplete(response)) {
    // Extract final drill series
    const content = response.choices[0]?.message.content
    const result = parseStructuredDrillOutput(content, drillSeriesSchema)

    if (result.success) {
      return { type: 'complete', data: result.data }
    } else {
      return { type: 'error', error: result.error }
    }
  }

  // Extract and process tool calls
  const toolCalls = extractToolCalls(response)

  if (toolCalls.length === 0) {
    return { type: 'error', error: 'Unexpected state: not complete but no tool calls' }
  }

  return { type: 'tool_calls', calls: toolCalls }
}

/**
 * Example 3: Validating tool call arguments with schema
 */
export function exampleValidateToolArguments() {
  // Define schema for position verification tool
  const positionSchema = z.object({
    positionId: z.string(),
    cube: z.string(),
    matchScore: z.string().optional(),
  })

  // Parse and validate tool call arguments
  const toolCallArgs = JSON.stringify({
    positionId: 'pos_123',
    cube: '1',
    matchScore: '0-0',
  })

  const result = parseToolCallArguments(toolCallArgs, positionSchema)

  if (result.success && result.data) {
    console.log('Valid position verification:', result.data.positionId)
    return result.data
  } else {
    console.error('Invalid arguments:', result.error)
    return null
  }
}

/**
 * Example 4: Handling errors in responses
 */
export function exampleHandleResponseErrors(response: ChatCompletion) {
  // Check for response-level errors first
  const errorMsg = extractErrorMessage(response)

  if (errorMsg) {
    console.error('Response error:', errorMsg)

    // Handle specific error types
    if (errorMsg.includes('Content filtered')) {
      // Re-run with modified prompt
      return { action: 'retry_with_safer_prompt' }
    } else if (errorMsg.includes('truncated')) {
      // Increase max_tokens or simplify request
      return { action: 'increase_token_limit' }
    } else if (errorMsg.includes('content filter')) {
      // Skip this drill and continue
      return { action: 'skip_and_continue' }
    }
  }

  // No errors, proceed with normal processing
  return { action: 'continue' }
}

/**
 * Example 5: Complete agentic loop with ground truth verification
 */
export async function exampleAgenticLoop(
  openaiClient: unknown, // OpenAI client
  messages: unknown[], // Conversation history
  tools: unknown[], // Available tools
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const MAX_ITERATIONS = 50
  let iteration = 0

  while (iteration < MAX_ITERATIONS) {
    iteration++

    // Make API call (pseudo-code - actual implementation in generatorWithVerification.ts)
    const response = await (async () => {
      // Simulated response - replace with actual OpenAI call
      return {} as ChatCompletion
    })()

    // Check for response errors
    const errorMsg = extractErrorMessage(response)
    if (errorMsg) {
      return { success: false, error: errorMsg }
    }

    // Check if complete
    if (isGenerationComplete(response)) {
      const content = response.choices[0]?.message.content
      const result = parseStructuredDrillOutput(content, drillSeriesSchema)

      if (result.success) {
        return { success: true, result: result.data }
      } else {
        return { success: false, error: result.error }
      }
    }

    // Process tool calls
    const toolCalls = extractToolCalls(response)

    for (const call of toolCalls) {
      // Execute tool and add result to messages
      console.log(`Executing tool: ${call.name}`)

      // Validate arguments based on tool type
      if (call.name === 'verify_position') {
        const schema = z.object({
          positionId: z.string(),
          cube: z.string(),
        })

        const validationResult = parseToolCallArguments(call.arguments, schema)
        if (!validationResult.success) {
          return { success: false, error: `Invalid tool arguments: ${validationResult.error}` }
        }

        // Execute verification with validated args
        // const toolResult = await verifyPosition(validationResult.data)
      }
    }

    // Continue loop with updated messages
  }

  return { success: false, error: 'Max iterations reached' }
}

/**
 * Example 6: Error recovery strategies
 */
export function exampleErrorRecovery(content: string | null | undefined) {
  // Try parsing with schema
  const result = parseStructuredDrillOutput(content, drillSeriesSchema)

  if (result.success) {
    return { recovered: false, data: result.data }
  }

  // Strategy 1: Try with relaxed schema (fewer required fields)
  const relaxedSchema = z.object({
    drillSeriesTitle: z.string(),
    series: z.array(z.unknown()),
  })

  const relaxedResult = parseStructuredDrillOutput(content, relaxedSchema)
  if (relaxedResult.success) {
    console.warn('Recovered with relaxed schema - some fields may be missing')
    return { recovered: true, data: relaxedResult.data, warning: 'partial_data' }
  }

  // Strategy 2: Extract any JSON and log for debugging
  try {
    const anyJson = JSON.parse(content || '{}')
    console.error('Found JSON but failed schema validation:', anyJson)
    return {
      recovered: true,
      data: anyJson,
      warning: 'unvalidated_data',
      error: result.error
    }
  } catch {
    // No valid JSON at all
    return {
      recovered: false,
      error: result.error,
      rawContent: content
    }
  }
}

/**
 * Example 7: Testing different response formats
 */
export const responseFormatExamples = {
  // Format 1: Pure JSON
  pureJson: JSON.stringify({
    drillSeriesTitle: 'Test Series',
    targetPrinciples: ['test'],
    totalDrills: 1,
    estimatedCompletionMinutes: 5,
    series: [],
    designThoughts: null,
  }),

  // Format 2: JSON in code block
  markdownJson: `
\`\`\`json
{
  "drillSeriesTitle": "Test Series",
  "targetPrinciples": ["test"],
  "totalDrills": 1,
  "estimatedCompletionMinutes": 5,
  "series": [],
  "designThoughts": null
}
\`\`\`
  `,

  // Format 3: Code block without language
  plainCodeBlock: `
\`\`\`
{
  "drillSeriesTitle": "Test Series",
  "targetPrinciples": ["test"],
  "totalDrills": 1,
  "estimatedCompletionMinutes": 5,
  "series": [],
  "designThoughts": null
}
\`\`\`
  `,

  // Format 4: Embedded in text
  embeddedJson: `Here is the drill series: {"drillSeriesTitle": "Test Series", "targetPrinciples": ["test"], "totalDrills": 1, "estimatedCompletionMinutes": 5, "series": [], "designThoughts": null} as requested.`,

  // Format 5: Multiple blocks (uses first valid)
  multipleBlocks: `
First attempt (invalid):
\`\`\`json
{ broken }
\`\`\`

Second attempt (valid):
\`\`\`json
{
  "drillSeriesTitle": "Test Series",
  "targetPrinciples": ["test"],
  "totalDrills": 1,
  "estimatedCompletionMinutes": 5,
  "series": [],
  "designThoughts": null
}
\`\`\`
  `,
}

/**
 * Test all format examples
 */
export function testAllFormats() {
  const formats = Object.entries(responseFormatExamples)

  for (const [name, content] of formats) {
    const result = parseStructuredDrillOutput(content, drillSeriesSchema)

    if (result.success) {
      console.log(`✓ ${name}: Successfully parsed`)
    } else {
      console.error(`✗ ${name}: Failed - ${result.error}`)
    }
  }
}
