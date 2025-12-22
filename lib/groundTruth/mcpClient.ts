/**
 * MCP Client for Ground Truth Engine
 *
 * Implements the MCP Streamable HTTP transport protocol for communicating
 * with the GNU Backgammon engine.
 *
 * Protocol: JSON-RPC 2.0 over HTTP with session management
 * Reference: https://spec.modelcontextprotocol.io/specification/2024-11-05/transport/
 */

import type { GroundTruthConfig } from './types'

interface MCPResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number | null
  result?: T
  error?: {
    code: number
    message: string
  }
}

interface MCPSession {
  sessionId: string
  config: GroundTruthConfig
  initialized: boolean
}

/**
 * Active MCP sessions by engine URL
 */
const sessions = new Map<string, MCPSession>()

/**
 * Initialize a new MCP session with the engine.
 */
async function initSession(config: GroundTruthConfig): Promise<MCPSession> {
  const existingSession = sessions.get(config.engineUrl)
  if (existingSession?.initialized) {
    return existingSession
  }

  // Send initialize request
  const initResponse = await fetch(`${config.engineUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'guru-builder',
          version: '1.0.0'
        }
      }
    })
  })

  if (!initResponse.ok) {
    throw new Error(`MCP init failed: ${initResponse.status}`)
  }

  const sessionId = initResponse.headers.get('Mcp-Session-Id')
  if (!sessionId) {
    throw new Error('No session ID in MCP response')
  }

  // Send initialized notification
  await fetch(`${config.engineUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    })
  })

  const session: MCPSession = {
    sessionId,
    config,
    initialized: true
  }

  sessions.set(config.engineUrl, session)
  return session
}

/**
 * Make an MCP tool call.
 */
async function callTool<T = unknown>(
  session: MCPSession,
  toolName: string,
  args: Record<string, unknown>,
  requestId: number = 2
): Promise<MCPResponse<{ content: Array<{ type: string; text: string }> }>> {
  const response = await fetch(`${session.config.engineUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': session.sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`MCP call failed: ${response.status} - ${errorText}`)
  }

  return response.json()
}

/**
 * Opening move analysis result from GNUBG
 */
export interface OpeningMoveResult {
  play: Array<{ from: string; to: string }>
  evaluation: {
    eq: number  // Equity
    diff: number  // Difference from best
    probability: {
      win: number
      winG: number
      winBG: number
      lose: number
      loseG: number
      loseBG: number
    }
  }
}

/**
 * Get best moves for an opening roll from GNUBG.
 *
 * @param die1 - First die value (1-6)
 * @param die2 - Second die value (1-6)
 * @param config - Ground truth engine configuration
 * @param max - Maximum number of moves to return (default 3)
 * @returns Array of moves with evaluations, best first
 */
export async function getOpeningMoves(
  die1: number,
  die2: number,
  config: GroundTruthConfig,
  max: number = 3
): Promise<OpeningMoveResult[]> {
  const session = await initSession(config)

  const response = await callTool(session, 'opening', {
    die1,
    die2,
    max
  })

  if (response.error) {
    throw new Error(`MCP error: ${response.error.message}`)
  }

  if (!response.result?.content?.[0]?.text) {
    throw new Error('Empty response from engine')
  }

  // Parse the JSON string inside the text content
  const moves: OpeningMoveResult[] = JSON.parse(response.result.content[0].text)
  return moves
}

/**
 * Format move array to standard notation (e.g., "8/5 6/5")
 */
export function formatMove(play: Array<{ from: string; to: string }>): string {
  return play.map(p => `${p.from}/${p.to}`).join(' ')
}

/**
 * Clear session for an engine (useful for reconnection)
 */
export function clearSession(engineUrl: string): void {
  sessions.delete(engineUrl)
}

/**
 * Board position format for the 'plays' tool.
 * Point numbers are 1-24 from X's perspective.
 * Each key is the point number as string, value is checker count.
 */
export interface BoardPosition {
  x: Record<string, number>  // X (White) checker positions
  o: Record<string, number>  // O (Black) checker positions
}

/**
 * Full board configuration for the 'plays' tool
 */
export interface PlaysBoardConfig {
  board: BoardPosition
  cubeful: boolean
  dice: [number, number]
  player: 'x' | 'o'
  'max-moves'?: number
  'score-moves'?: boolean
}

/**
 * Result from the 'plays' tool - same structure as opening moves
 */
export interface PlaysResult {
  play: Array<{ from: string; to: string }>
  evaluation: {
    eq: number
    diff: number
    info?: {
      cubeful: boolean
      plies: number
    }
    probability: {
      win: number
      winG: number
      winBG: number
      lose: number
      loseG: number
      loseBG: number
    }
  }
}

/**
 * Get best moves for an arbitrary board position from GNUBG.
 *
 * This uses the 'plays' tool which can analyze any backgammon position,
 * unlike 'opening' which only works for the opening position.
 *
 * @param boardConfig - Full board configuration including position, dice, player
 * @param config - Ground truth engine configuration
 * @returns Array of moves with evaluations, best first
 */
export async function getPlaysForPosition(
  boardConfig: PlaysBoardConfig,
  config: GroundTruthConfig
): Promise<PlaysResult[]> {
  const session = await initSession(config)

  const response = await callTool(session, 'plays', {
    board: boardConfig
  })

  if (response.error) {
    throw new Error(`MCP error: ${response.error.message}`)
  }

  if (!response.result?.content?.[0]?.text) {
    throw new Error('Empty response from engine')
  }

  // Parse the JSON string inside the text content
  const moves: PlaysResult[] = JSON.parse(response.result.content[0].text)
  return moves
}
