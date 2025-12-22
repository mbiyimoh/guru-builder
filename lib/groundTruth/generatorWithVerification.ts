/**
 * Ground Truth Module - Generator with Verification
 *
 * Implements an agentic loop for drill series generation with ground truth
 * verification. The AI can call tools to verify positions/moves before
 * generating final content.
 */

import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { GROUND_TRUTH_TOOLS, type GroundTruthToolName } from './tools'
import { executeGroundTruthTool, checkEngineHealth } from './executor'
import { GROUND_TRUTH_LIMITS, type GroundTruthConfig, type ToolCallResult } from './types'

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
 * Result of generation with ground truth verification.
 */
export interface GenerationResult {
  /** Final content from GPT */
  content: string
  /** All tool calls made during generation */
  toolCalls: ToolCallResult[]
  /** Number of agentic loop iterations */
  iterations: number
  /** Total tokens used across all iterations */
  totalTokens: number
}

/**
 * Convert ground truth tool definitions to OpenAI format.
 */
function convertToolsToOpenAIFormat(): ChatCompletionTool[] {
  return GROUND_TRUTH_TOOLS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }))
}

/**
 * Generate drill series with ground truth verification using agentic loop.
 *
 * This function implements a multi-turn conversation where:
 * 1. GPT generates content or requests tool calls
 * 2. Tool calls are executed against the ground truth engine
 * 3. Results are fed back to GPT for next iteration
 * 4. Loop continues until GPT produces final content without tool calls
 *
 * @param systemPrompt - System prompt with verification instructions
 * @param userPrompt - User prompt with generation requirements
 * @param config - Ground truth configuration
 * @returns Generation result with content, tool calls, and metadata
 *
 * @throws Error if max iterations or tool calls exceeded
 * @throws Error if OpenAI API fails
 *
 * @example
 * const result = await generateDrillSeriesWithGroundTruth(
 *   "You are a backgammon teaching expert...",
 *   "Generate drills for opening positions...",
 *   config
 * )
 * console.log(`Generated after ${result.iterations} iterations`)
 * console.log(`Made ${result.toolCalls.length} tool calls`)
 */
export async function generateDrillSeriesWithGroundTruth(
  systemPrompt: string,
  userPrompt: string,
  config: GroundTruthConfig
): Promise<GenerationResult> {
  const openai = getOpenAIClient()
  const toolCalls: ToolCallResult[] = []
  let iterations = 0
  let totalTokens = 0

  // Check engine health before starting tool-based generation
  const healthCheck = await checkEngineHealth(config)

  if (!healthCheck.available) {
    console.warn(`[GroundTruth] Engine unavailable: ${healthCheck.error}. Falling back to standard generation without tool calling`)

    // Fall back to standard generation without tools
    // Add explicit JSON output instruction
    const jsonSystemPrompt = systemPrompt + '\n\nIMPORTANT: You MUST output your response as valid JSON only. Do not include any text before or after the JSON object. Do not use markdown code blocks.'

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: jsonSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 8000,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in fallback response from GPT')
    }

    return {
      content,
      toolCalls: [], // No tool calls in fallback mode
      iterations: 1,
      totalTokens: completion.usage?.total_tokens || 0
    }
  }

  console.log(`[GroundTruth] Engine available (latency: ${healthCheck.latency}ms), using tool-enabled generation`)

  // Add JSON output instruction to system prompt
  const jsonSystemPrompt = systemPrompt + '\n\nIMPORTANT: When you have finished using tools and are ready to provide your final response, you MUST output ONLY valid JSON. Do not include any text, explanations, or markdown code blocks before or after the JSON object.'

  // Initialize conversation with system and user messages
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: jsonSystemPrompt },
    { role: 'user', content: userPrompt },
  ]

  // Convert tools to OpenAI format
  const tools = convertToolsToOpenAIFormat()

  // Agentic loop
  while (iterations < GROUND_TRUTH_LIMITS.MAX_ITERATIONS) {
    iterations++

    // Call GPT with current conversation history
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto', // Let GPT decide when to use tools
      temperature: 0.7,
      max_tokens: 8000,
    })

    // Track token usage
    if (completion.usage) {
      totalTokens += completion.usage.total_tokens
    }

    const choice = completion.choices[0]
    if (!choice) {
      throw new Error('No completion choice returned from OpenAI')
    }

    const message = choice.message

    // Check if GPT wants to make tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Enforce tool call limit
      if (toolCalls.length + message.tool_calls.length > GROUND_TRUTH_LIMITS.MAX_TOOL_CALLS) {
        throw new Error(
          `Exceeded maximum tool calls (${GROUND_TRUTH_LIMITS.MAX_TOOL_CALLS}). ` +
          `Current: ${toolCalls.length}, Requested: ${message.tool_calls.length}`
        )
      }

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.tool_calls,
      })

      // Execute each tool call
      const toolResults: ChatCompletionMessageParam[] = []

      for (const toolCall of message.tool_calls) {
        // Only handle function tool calls (not custom tools)
        if (toolCall.type !== 'function') {
          continue
        }

        // Type narrow to ensure we have function property
        if (!('function' in toolCall)) {
          continue
        }

        // TypeScript doesn't narrow union types properly, so we need explicit assertion
        type FunctionToolCall = typeof toolCall & { function: { name: string; arguments: string } }
        const funcToolCall = toolCall as FunctionToolCall

        // Validate tool name
        const toolName = funcToolCall.function.name as GroundTruthToolName

        // Parse arguments
        let args: Record<string, unknown>
        try {
          args = JSON.parse(funcToolCall.function.arguments)
        } catch (error) {
          // Invalid JSON in arguments
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: false,
              error: `Invalid JSON in tool arguments: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }),
          })
          continue
        }

        // Execute tool
        const callResult = await executeGroundTruthTool(toolName, args, config)
        toolCalls.push(callResult)

        // Add tool result to conversation
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(callResult.result),
        })
      }

      // Add all tool results to conversation history
      messages.push(...toolResults)

    } else {
      // No tool calls - GPT has produced final content
      const finalContent = message.content

      if (!finalContent) {
        throw new Error('No content in final response from GPT')
      }

      return {
        content: finalContent,
        toolCalls,
        iterations,
        totalTokens,
      }
    }
  }

  // Exceeded max iterations
  throw new Error(
    `Exceeded maximum iterations (${GROUND_TRUTH_LIMITS.MAX_ITERATIONS}). ` +
    `The AI did not produce final content within the iteration limit.`
  )
}

/**
 * Get statistics summary from generation result.
 *
 * @param result - Generation result
 * @returns Human-readable statistics
 */
export function getGenerationStats(result: GenerationResult): string {
  const cachedCalls = result.toolCalls.filter(tc => tc.cached).length
  const uncachedCalls = result.toolCalls.length - cachedCalls

  return [
    `Iterations: ${result.iterations}`,
    `Tool Calls: ${result.toolCalls.length} (${cachedCalls} cached, ${uncachedCalls} fresh)`,
    `Total Tokens: ${result.totalTokens.toLocaleString()}`,
  ].join(' | ')
}
