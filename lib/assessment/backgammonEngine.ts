// lib/assessment/backgammonEngine.ts

import { BackgammonMove, BackgammonResponse, OPENING_POSITION } from './types'

const DEFAULT_ENGINE_URL = 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com'

// Interfaces for actual GNU Backgammon engine response structure
interface EnginePlayMove {
  from: string
  to: string
}

interface EngineEvaluation {
  eq?: number
  equity?: number
  diff?: number
  info?: {
    cubeful: boolean
    plies: number
  }
  probability?: {
    win: number
    lose: number
    winG?: number
    loseG?: number
    winBG?: number
    loseBG?: number
  }
}

interface EngineResponse {
  play: EnginePlayMove[]
  evaluation: EngineEvaluation
}

/**
 * Query GNU Backgammon engine for best moves
 */
export async function getBackgammonGroundTruth(
  diceRoll: [number, number],
  engineUrl: string = DEFAULT_ENGINE_URL
): Promise<BackgammonMove[]> {
  console.log('[GNUBG] Requesting best moves for dice:', diceRoll)
  console.log('[GNUBG] Engine URL:', engineUrl)

  const requestBody = {
    board: OPENING_POSITION,
    dice: diceRoll,
    player: 'x',
    cubeful: false,
    'max-moves': 10,
    'score-moves': true,
  }

  console.log('[GNUBG] Request body:', JSON.stringify(requestBody, null, 2))

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${engineUrl}/plays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    console.log('[GNUBG] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GNUBG] Error response:', errorText)
      throw new Error(`Engine request failed: ${response.status} ${response.statusText}`)
    }

    const rawData = await response.text()
    console.log('[GNUBG] Raw response:', rawData.substring(0, 200) + '...')

    let data = JSON.parse(rawData)

    // CRITICAL: The engine returns double-encoded JSON!
    // First parse gives us a string, second parse gives us the actual array
    if (typeof data === 'string') {
      console.log('[GNUBG] Double-encoded JSON detected, parsing again...')
      data = JSON.parse(data)
    }

    console.log('[GNUBG] Parsed data type:', typeof data, 'is array:', Array.isArray(data))

    // Engine returns ARRAY directly: [{evaluation: {...}, play: [...]}]
    // NOT an object with plays property
    const plays = Array.isArray(data) ? data : (data.plays || data.moves || [])

    if (!Array.isArray(plays)) {
      console.error('[GNUBG] Data structure:', JSON.stringify(data).substring(0, 200))
      throw new Error(`Invalid response structure. Expected array, got: ${typeof data}`)
    }

    console.log('[GNUBG] Found', plays.length, 'plays to parse')

    // Parse and validate moves from engine response
    // Engine returns: [{evaluation: {eq: 0.118}, play: [{from: "8", to: "4"}]}]
    const validatedMoves: BackgammonMove[] = plays.map((item: EngineResponse) => {
      // Extract play array and equity from evaluation
      const playArray = item.play || []
      const evaluation = item.evaluation || { eq: 0 }
      const equity = evaluation.eq || evaluation.equity || 0

      // Convert play array to move notation (e.g., "8/4 6/4")
      const moveNotation = playArray
        .map((p: EnginePlayMove) => `${p.from}/${p.to}`)
        .join(' ')

      return {
        move: moveNotation || 'Unknown',
        equity: Number(equity),
        // Preserve full evaluation if probability data exists
        evaluation: evaluation.probability
          ? {
              equity: Number(equity),
              diff: evaluation.diff ?? 0,
              probability: {
                win: evaluation.probability.win ?? 0,
                lose: evaluation.probability.lose ?? 0,
                winG: evaluation.probability.winG ?? 0,
                loseG: evaluation.probability.loseG ?? 0,
                winBG: evaluation.probability.winBG ?? 0,
                loseBG: evaluation.probability.loseBG ?? 0,
              },
              info: {
                cubeful: evaluation.info?.cubeful ?? false,
                plies: evaluation.info?.plies ?? 0,
              },
            }
          : undefined,
      }
    })

    console.log('[GNUBG] Validated moves:', validatedMoves)
    return validatedMoves
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Engine request timed out after 30 seconds')
    }
    throw error
  }
}

/**
 * Query GNU Backgammon engine with retry logic
 * Handles Heroku dyno cold starts and transient failures
 */
export async function getBackgammonGroundTruthWithRetry(
  diceRoll: [number, number],
  engineUrl: string = DEFAULT_ENGINE_URL,
  maxRetries: number = 3
): Promise<BackgammonMove[]> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[GNUBG] Attempt ${attempt}/${maxRetries}`)
      const result = await getBackgammonGroundTruth(diceRoll, engineUrl)

      if (result.length === 0) {
        throw new Error('Engine returned empty moves array')
      }

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[GNUBG] Attempt ${attempt} failed:`, lastError.message)

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        console.log(`[GNUBG] Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('All retry attempts failed')
}

/**
 * Parse dice roll string into tuple (e.g., "3-1" -> [3, 1])
 */
export function parseDiceRoll(input: string): [number, number] | null {
  const match = input.match(/^(\d)-(\d)$/)
  if (!match) return null

  const die1 = parseInt(match[1], 10)
  const die2 = parseInt(match[2], 10)

  if (die1 < 1 || die1 > 6 || die2 < 1 || die2 > 6) return null
  return [die1, die2]
}

/**
 * Format dice roll for display
 */
export function formatDiceRoll(dice: [number, number]): string {
  return `${dice[0]}-${dice[1]}`
}
