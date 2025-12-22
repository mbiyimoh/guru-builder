/**
 * Ground Truth Module - Tool Executor
 *
 * Executes tool calls against the ground truth engine API with
 * caching, error handling, and timeout protection.
 */

import type { GroundTruthConfig, ToolCallResult } from './types'
import { GROUND_TRUTH_LIMITS } from './types'
import { checkCache, cacheResponse, buildCacheKey } from './cache'

/**
 * MCP server response format from GNU Backgammon engine.
 */
interface EngineResponse {
  success: boolean
  data?: {
    bestMoves?: Array<{
      move: string
      equity: number
      winChance: number
    }>
    positionType?: string
    equity?: number
    matchEquity?: number
    isOptimal?: boolean
  }
  error?: string
}

/**
 * Known ground truth tools that can be executed.
 */
const VALID_TOOLS = [
  'analyze_position',
  'evaluate_move',
  'get_equity',
  'calculate_match_equity'
] as const

type ValidTool = typeof VALID_TOOLS[number]

/**
 * Validate that tool name is known and arguments are provided.
 *
 * @param toolName - Tool name to validate
 * @param args - Arguments to validate
 * @returns True if valid, false otherwise
 */
function validateToolArgs(toolName: string, args: unknown): args is Record<string, unknown> {
  if (!VALID_TOOLS.includes(toolName as ValidTool)) {
    return false
  }

  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return false
  }

  return true
}

/**
 * Build MCP request payload for the GNU Backgammon engine.
 *
 * Maps tool names to engine-compatible formats and validates
 * required arguments.
 *
 * @param toolName - Name of the tool to call
 * @param args - Tool arguments
 * @returns MCP request object
 */
function buildMCPRequest(
  toolName: string,
  args: Record<string, unknown>
): { tool: string; args: Record<string, unknown> } {
  // Map OpenAI tool names to engine tool names
  const toolMapping: Record<string, string> = {
    'analyze_position': 'analyze_position',
    'evaluate_move': 'evaluate_move',
    'get_equity': 'get_equity',
    'calculate_match_equity': 'calculate_match_equity'
  }

  const engineTool = toolMapping[toolName] || toolName

  // Pass arguments as-is - engine will validate
  return {
    tool: engineTool,
    args
  }
}

/**
 * Health check result for ground truth engine.
 */
export interface EngineHealthResult {
  /** Whether engine is available and responding */
  available: boolean
  /** Response latency in milliseconds (if available) */
  latency?: number
  /** Error message if unavailable */
  error?: string
}

/**
 * Check if the ground truth engine is available and responding.
 *
 * Performs a lightweight health check with a short timeout to quickly
 * determine if the engine is reachable before attempting heavy operations.
 *
 * @param config - Ground truth configuration with engine URL
 * @returns Health check result with availability status
 *
 * @example
 * const health = await checkEngineHealth(config)
 * if (!health.available) {
 *   console.warn(`Engine unavailable: ${health.error}`)
 *   // Fall back to generation without verification
 * }
 */
export async function checkEngineHealth(config: GroundTruthConfig): Promise<EngineHealthResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s health check timeout

    const response = await fetch(`${config.engineUrl}/health`, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      return {
        available: true,
        latency: Date.now() - startTime
      }
    }

    return {
      available: false,
      error: `Engine returned status ${response.status}`
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Fetch with timeout protection using AbortController.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Response promise
 * @throws Error if request times out or fails
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Engine request timed out after ${timeoutMs}ms`)
    }

    throw error
  }
}

/**
 * Execute a ground truth tool call against the engine API.
 *
 * This function:
 * 1. Validates tool name and arguments
 * 2. Checks cache for existing response
 * 3. Makes HTTP request to engine if not cached
 * 4. Validates response format
 * 5. Caches successful responses
 * 6. Returns standardized result with metadata
 *
 * @param toolName - Name of the tool to execute
 * @param args - Tool arguments
 * @param config - Ground truth configuration with engine URL
 * @returns Tool call result with response and metadata
 *
 * @example
 * const result = await executeGroundTruthTool('analyze_position', {
 *   position: 'XGID=abcd123',
 *   dice: [3, 1]
 * }, config)
 */
export async function executeGroundTruthTool(
  toolName: string,
  args: Record<string, unknown>,
  config: GroundTruthConfig
): Promise<ToolCallResult> {
  const startTime = Date.now()

  // 1. Validate tool name and arguments
  if (!validateToolArgs(toolName, args)) {
    return {
      toolName,
      arguments: args,
      result: {
        success: false,
        error: `Invalid tool name or arguments. Valid tools: ${VALID_TOOLS.join(', ')}`
      },
      cached: false,
      executionTime: Date.now() - startTime
    }
  }

  // 2. Check cache first
  const cacheKey = buildCacheKey(
    toolName,
    JSON.stringify(args)
  )

  const cachedResult = await checkCache(cacheKey)
  if (cachedResult !== null) {
    return {
      toolName,
      arguments: args,
      result: cachedResult,
      cached: true,
      executionTime: 0
    }
  }

  // 3. Build MCP request
  const mcpRequest = buildMCPRequest(toolName, args)

  try {
    // 4. Execute with timeout protection
    const response = await fetchWithTimeout(
      `${config.engineUrl}/api/mcp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mcpRequest)
      },
      GROUND_TRUTH_LIMITS.ENGINE_QUERY_TIMEOUT
    )

    // 5. Parse and validate response
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Engine returned ${response.status}: ${errorText}`)
    }

    const engineResponse: EngineResponse = await response.json()

    // Check if engine returned an error
    if (!engineResponse.success || engineResponse.error) {
      return {
        toolName,
        arguments: args,
        result: {
          success: false,
          error: engineResponse.error || 'Engine returned unsuccessful response'
        },
        cached: false,
        executionTime: Date.now() - startTime
      }
    }

    // 6. Cache successful response (TTL: 24 hours)
    const TTL_MS = 24 * 60 * 60 * 1000
    await cacheResponse(cacheKey, engineResponse, TTL_MS)

    // 7. Return result
    return {
      toolName,
      arguments: args,
      result: engineResponse,
      cached: false,
      executionTime: Date.now() - startTime
    }

  } catch (error) {
    // Error handling - log warning and return graceful failure
    // Don't throw - allow generation to continue without verification
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error during engine request'

    console.warn(`[GroundTruth] Tool execution failed [${toolName}]: ${errorMessage}`)

    return {
      toolName,
      arguments: args,
      result: {
        success: false,
        error: errorMessage,
        unavailable: true  // Flag for graceful degradation
      },
      cached: false,
      executionTime: Date.now() - startTime
    }
  }
}
