/**
 * Response Parser for Function Calling
 *
 * Extracts structured JSON from GPT-4o responses that may contain markdown,
 * prose, or mixed content. Handles various response formats robustly.
 *
 * CRITICAL: This parser is designed to handle the unpredictable nature of
 * GPT-4o responses when using function calling. The model may return:
 * 1. Pure JSON
 * 2. JSON wrapped in markdown code blocks
 * 3. JSON mixed with explanatory prose
 * 4. Multiple JSON blocks
 *
 * The parser tries multiple extraction strategies in order of reliability.
 */

import { z } from 'zod'
import type { ChatCompletion } from 'openai/resources/chat/completions'

/**
 * Result of parsing an OpenAI response
 */
export interface ParseResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Extracted tool call from OpenAI response
 */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/**
 * Parse structured drill output from GPT-4o response.
 *
 * Handles various response formats including:
 * - Pure JSON
 * - JSON in markdown code blocks (```json or ```)
 * - JSON mixed with prose
 * - Multiple JSON blocks (uses first valid one)
 *
 * @param content - Raw string content from GPT-4o
 * @param schema - Zod schema to validate against
 * @returns ParseResult with success flag and data or error
 *
 * @example
 * ```typescript
 * const result = parseStructuredDrillOutput(response.choices[0].message.content, drillSeriesSchema)
 * if (result.success) {
 *   console.log('Parsed drill series:', result.data)
 * } else {
 *   console.error('Parse error:', result.error)
 * }
 * ```
 */
export function parseStructuredDrillOutput<T>(
  content: string | null | undefined,
  schema: z.ZodSchema<T>
): ParseResult<T> {
  // Handle null/undefined content
  if (!content) {
    return {
      success: false,
      error: 'Response content is null or undefined'
    }
  }

  // Strategy 1: Try direct JSON parse
  // This is the most reliable when GPT-4o returns pure JSON
  try {
    const parsed = JSON.parse(content.trim())
    const validated = schema.safeParse(parsed)
    if (validated.success) {
      return { success: true, data: validated.data }
    }
    // Store validation error for fallback strategies
    const directParseError = validated.error.message

    // If direct parse had schema errors, we'll still try other strategies
    // in case there's better JSON elsewhere in the response
  } catch {
    // Not pure JSON, continue to other strategies
  }

  // Strategy 2: Extract from markdown code blocks
  // GPT-4o often wraps JSON in ```json or ``` blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g
  const matches = Array.from(content.matchAll(codeBlockRegex))

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const validated = schema.safeParse(parsed)
      if (validated.success) {
        return { success: true, data: validated.data }
      }
    } catch {
      // This block wasn't valid JSON, try next
      continue
    }
  }

  // Strategy 3: Find JSON-like structures in text
  // Sometimes GPT-4o embeds JSON in prose without markdown
  const jsonPatterns = [
    // Drill series pattern - look for drillSeriesTitle
    /\{[\s\S]*?"drillSeriesTitle"[\s\S]*?\}/,
    // Generic object with nested arrays (common for all artifacts)
    /\{[\s\S]*?"series"[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/,
    // Curriculum pattern
    /\{[\s\S]*?"modules"[\s\S]*?\}/,
    // Mental model pattern
    /\{[\s\S]*?"title"[\s\S]*?"principles"[\s\S]*?\}/,
    // Array of objects fallback
    /\[[\s\S]*?\{[\s\S]*?\}[\s\S]*?\]/,
  ]

  for (const pattern of jsonPatterns) {
    const match = content.match(pattern)
    if (match) {
      try {
        // Extract balanced braces to get complete JSON
        const extracted = extractBalancedJson(match[0])
        if (extracted) {
          const parsed = JSON.parse(extracted)
          const validated = schema.safeParse(parsed)
          if (validated.success) {
            return { success: true, data: validated.data }
          }
        }
      } catch {
        // Pattern matched but wasn't valid JSON
        continue
      }
    }
  }

  return {
    success: false,
    error: 'Could not extract valid JSON from response. Tried direct parse, markdown blocks, and pattern matching.'
  }
}

/**
 * Extract balanced JSON from a string that may have incomplete braces.
 * Attempts to find the longest valid JSON structure starting from the beginning.
 *
 * @param text - Text containing JSON (possibly incomplete)
 * @returns Balanced JSON string or null if none found
 */
function extractBalancedJson(text: string): string | null {
  let depth = 0
  let inString = false
  let escapeNext = false
  let start = -1

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{' || char === '[') {
      if (start === -1) start = i
      depth++
    } else if (char === '}' || char === ']') {
      depth--
      if (depth === 0 && start !== -1) {
        // Found complete balanced structure
        return text.substring(start, i + 1)
      }
    }
  }

  return null
}

/**
 * Extract tool calls from OpenAI response.
 * Returns all tool call requests that GPT-4o wants to make.
 *
 * @param response - OpenAI ChatCompletion response
 * @returns Array of tool calls with parsed arguments
 *
 * @example
 * ```typescript
 * const toolCalls = extractToolCalls(response)
 * for (const call of toolCalls) {
 *   console.log(`Tool: ${call.name}, Args:`, call.arguments)
 * }
 * ```
 */
export function extractToolCalls(response: ChatCompletion): ToolCall[] {
  const message = response.choices[0]?.message
  if (!message?.tool_calls) {
    return []
  }

  const toolCalls: ToolCall[] = []

  for (const toolCall of message.tool_calls) {
    if (toolCall.type !== 'function') continue

    try {
      const args = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments

      toolCalls.push({
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: args
      })
    } catch (error) {
      // Skip invalid tool call arguments
      console.warn(`Failed to parse tool call arguments for ${toolCall.function.name}:`, error)
      continue
    }
  }

  return toolCalls
}

/**
 * Check if response indicates completion (no more tool calls needed).
 * Returns true when GPT-4o has finished generating and doesn't need more tool calls.
 *
 * @param response - OpenAI ChatCompletion response
 * @returns true if generation is complete, false if more tool calls expected
 *
 * @example
 * ```typescript
 * if (isGenerationComplete(response)) {
 *   // Extract final output
 *   const result = parseStructuredDrillOutput(response.choices[0].message.content, schema)
 * } else {
 *   // Process tool calls and continue
 *   const toolCalls = extractToolCalls(response)
 * }
 * ```
 */
export function isGenerationComplete(response: ChatCompletion): boolean {
  const message = response.choices[0]?.message

  // Check if there are pending tool calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    return false
  }

  // Check finish reason
  const finishReason = response.choices[0]?.finish_reason

  // "stop" means natural completion, no more tool calls
  // "tool_calls" means waiting for tool responses
  // "length" means hit token limit (treat as incomplete)
  return finishReason === 'stop'
}

/**
 * Parse tool call arguments safely with schema validation.
 * Handles both string and object arguments.
 *
 * @param argumentsJson - Tool call arguments (string or object)
 * @param schema - Zod schema to validate against
 * @returns ParseResult with validated arguments
 *
 * @example
 * ```typescript
 * const positionSchema = z.object({
 *   positionId: z.string(),
 *   cube: z.string()
 * })
 * const result = parseToolCallArguments(toolCall.function.arguments, positionSchema)
 * if (result.success) {
 *   await verifyPosition(result.data)
 * }
 * ```
 */
export function parseToolCallArguments<T>(
  argumentsJson: string | Record<string, unknown>,
  schema: z.ZodSchema<T>
): ParseResult<T> {
  try {
    // Parse if string, otherwise use directly
    const parsed = typeof argumentsJson === 'string'
      ? JSON.parse(argumentsJson)
      : argumentsJson

    // Validate with schema
    const validated = schema.safeParse(parsed)

    if (validated.success) {
      return { success: true, data: validated.data }
    } else {
      return {
        success: false,
        error: `Schema validation failed: ${validated.error.message}`
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Extract error message from failed OpenAI response.
 * Provides human-readable error messages for debugging.
 *
 * @param response - OpenAI ChatCompletion response
 * @returns Error message or null if no error
 */
export function extractErrorMessage(response: ChatCompletion): string | null {
  const message = response.choices[0]?.message

  // Check for refusal (safety filter)
  if (message?.refusal) {
    return `Content filtered: ${message.refusal}`
  }

  // Check for incomplete response
  const finishReason = response.choices[0]?.finish_reason
  if (finishReason === 'length') {
    return 'Response truncated: hit token limit'
  }

  if (finishReason === 'content_filter') {
    return 'Response blocked by content filter'
  }

  return null
}

/**
 * Type guard to check if parsed output is an object.
 *
 * @param value - Value to check
 * @returns True if value is a non-null object (not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type guard to check if parsed output is an array.
 *
 * @param value - Value to check
 * @returns True if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}
