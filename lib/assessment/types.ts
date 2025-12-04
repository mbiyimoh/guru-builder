// lib/assessment/types.ts

export interface BackgammonBoard {
  o: Record<string, number>
  x: Record<string, number>
}

export const OPENING_POSITION: BackgammonBoard = {
  o: { '6': 5, '8': 3, '13': 5, '24': 2 },
  x: { '6': 5, '8': 3, '13': 5, '24': 2 },
}

export interface BoardPosition {
  board: BackgammonBoard
  player: 'x' | 'o'
  dice: [number, number]
  positionName: string // e.g., "Standard Opening Position"
}

export interface BackgammonRequest {
  board: BackgammonBoard
  dice: [number, number]
  player: 'x' | 'o'
  cubeful: boolean
  'max-moves': number
  'score-moves': boolean
}

// Detailed evaluation from GNU Backgammon engine
export interface MoveEvaluation {
  equity: number // Equity value (same as BackgammonMove.equity)
  diff: number // Difference from best move (0 for best move)
  probability: {
    win: number // Probability of winning (0-1)
    lose: number // Probability of losing (0-1)
    winG: number // Probability of winning gammon (0-1)
    loseG: number // Probability of losing gammon (0-1)
    winBG: number // Probability of winning backgammon (0-1)
    loseBG: number // Probability of losing backgammon (0-1)
  }
  info: {
    cubeful: boolean // Whether equity is cubeful
    plies: number // Search depth in plies
  }
}

export interface BackgammonMove {
  move: string
  equity: number
  evaluation?: MoveEvaluation // Full evaluation details (optional)
}

export interface BackgammonResponse {
  plays: BackgammonMove[]
}

export interface AssessmentResultData {
  diceRoll: string
  position: string
  guruResponse: string
  bestMoves: BackgammonMove[]
  guruMatchedBest?: boolean
}
