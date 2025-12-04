'use client'

import { useEffect } from 'react'
import { BackgammonMove } from '@/lib/assessment/types'

interface Props {
  move: BackgammonMove | null
  isOpen: boolean
  onClose: () => void
  rank: number // Position in best moves list (1-indexed)
}

export function MoveDetailModal({ move, isOpen, onClose, rank }: Props) {
  // Keyboard handler and body scroll lock
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  if (!move?.evaluation) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="bg-white rounded-lg max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 id="modal-title" className="text-xl font-bold">
              Move Details
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close modal">
              ✕
            </button>
          </div>
          <p className="text-gray-500">No detailed evaluation available for this move.</p>
        </div>
      </div>
    )
  }

  const { evaluation } = move
  const prob = evaluation.probability

  // Format percentage helper
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`

  // Calculate probability breakdown with validation
  const winSingle = Math.max(0, prob.win - prob.winG)
  const winGammonOnly = Math.max(0, prob.winG - prob.winBG)
  const loseSingle = Math.max(0, prob.lose - prob.loseG)
  const loseGammonOnly = Math.max(0, prob.loseG - prob.loseBG)

  // Validate probability hierarchy
  const totalOutcome = prob.win + prob.lose
  if (Math.abs(totalOutcome - 1.0) > 0.01) {
    console.warn('[MoveDetailModal] Invalid probabilities: win + lose ≠ 1.0', {
      totalOutcome,
      prob,
    })
  }
  if (prob.winG > prob.win || prob.winBG > prob.winG) {
    console.error('[MoveDetailModal] Invalid win probabilities hierarchy', prob)
  }
  if (prob.loseG > prob.lose || prob.loseBG > prob.loseG) {
    console.error('[MoveDetailModal] Invalid lose probabilities hierarchy', prob)
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="modal-title" className="text-xl font-bold">
            Move #{rank}: {move.move}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Equity Summary */}
          <section>
            <h3 className="font-semibold mb-2">Equity</h3>
            <div className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Equity Score:</span>
                <span className={`font-mono font-bold ${evaluation.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {evaluation.equity >= 0 ? '+' : ''}{evaluation.equity.toFixed(4)}
                </span>
              </div>
              {evaluation.diff !== 0 && (
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-600">Difference from best:</span>
                  <span className="font-mono text-red-600">
                    {evaluation.diff.toFixed(4)}
                  </span>
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                {evaluation.info.cubeful ? 'Cubeful' : 'Cubeless'} · {evaluation.info.plies} ply analysis
              </div>
            </div>
          </section>

          {/* Win/Lose Probabilities */}
          <section>
            <h3 className="font-semibold mb-2">Outcome Probabilities</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Win */}
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <div className="text-sm text-green-800 font-medium mb-2">Win</div>
                <div className="text-2xl font-bold text-green-600">{pct(prob.win)}</div>
                <div className="mt-2 space-y-1 text-xs text-green-700">
                  <div className="flex justify-between">
                    <span>Single:</span>
                    <span>{pct(winSingle)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gammon:</span>
                    <span>{pct(winGammonOnly)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Backgammon:</span>
                    <span>{pct(prob.winBG)}</span>
                  </div>
                </div>
              </div>

              {/* Lose */}
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <div className="text-sm text-red-800 font-medium mb-2">Lose</div>
                <div className="text-2xl font-bold text-red-600">{pct(prob.lose)}</div>
                <div className="mt-2 space-y-1 text-xs text-red-700">
                  <div className="flex justify-between">
                    <span>Single:</span>
                    <span>{pct(loseSingle)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gammon:</span>
                    <span>{pct(loseGammonOnly)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Backgammon:</span>
                    <span>{pct(prob.loseBG)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Raw Probability Table */}
          <section>
            <h3 className="font-semibold mb-2">Detailed Breakdown</h3>
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="py-2">Outcome</th>
                  <th className="py-2 text-right">Probability</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 text-green-700">Win</td>
                  <td className="py-2 text-right font-mono">{pct(prob.win)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-green-600 pl-4">Win Gammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.winG)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-green-500 pl-4">Win Backgammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.winBG)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-red-700">Lose</td>
                  <td className="py-2 text-right font-mono">{pct(prob.lose)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-red-600 pl-4">Lose Gammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.loseG)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-red-500 pl-4">Lose Backgammon</td>
                  <td className="py-2 text-right font-mono">{pct(prob.loseBG)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  )
}
