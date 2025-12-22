'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PositionWithRelations } from './types'

interface PositionDetailModalProps {
  position: PositionWithRelations
  onClose: () => void
}

/**
 * Modal displaying full position details including:
 * - ASCII board representation
 * - Dice roll and best moves with equities
 * - Match metadata for imported positions
 */
export function PositionDetailModal({ position, onClose }: PositionDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Focus modal on mount
  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  // Format equity with sign
  const formatEquity = (equity: number) => {
    return equity >= 0 ? `+${equity.toFixed(3)}` : equity.toFixed(3)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="position-detail-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="position-detail-title" className="text-lg font-semibold text-gray-900">Position Details</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* ASCII Board */}
          <div className="mb-6">
            <pre className="font-mono text-xs bg-slate-900 text-green-400 p-4 rounded overflow-x-auto whitespace-pre">
              {position.asciiBoard}
            </pre>
            <div className="mt-2 text-center text-sm text-gray-600">
              Dice: <span className="font-mono font-semibold">{position.diceRoll}</span>
            </div>
          </div>

          {/* Move Analysis */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Move Analysis
            </h3>
            <div className="space-y-2">
              {/* Best Move */}
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <span className="text-xs text-green-600 font-medium">Best Move</span>
                  <div className="font-mono text-gray-900">{position.bestMove}</div>
                </div>
                <div className={cn(
                  'font-mono font-semibold',
                  position.bestMoveEquity >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatEquity(position.bestMoveEquity)}
                </div>
              </div>

              {/* Second Best */}
              {position.secondBestMove && position.secondEquity !== null && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">2nd Best</span>
                    <div className="font-mono text-gray-700">{position.secondBestMove}</div>
                  </div>
                  <div className={cn(
                    'font-mono font-medium',
                    position.secondEquity >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatEquity(position.secondEquity)}
                  </div>
                </div>
              )}

              {/* Third Best */}
              {position.thirdBestMove && position.thirdEquity !== null && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">3rd Best</span>
                    <div className="font-mono text-gray-700">{position.thirdBestMove}</div>
                  </div>
                  <div className={cn(
                    'font-mono font-medium',
                    position.thirdEquity >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatEquity(position.thirdEquity)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadata Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Position Info
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Source */}
              <div>
                <span className="text-gray-500">Source:</span>
                <span className="ml-2 font-medium">{formatSource(position.sourceType)}</span>
              </div>

              {/* Phase */}
              <div>
                <span className="text-gray-500">Phase:</span>
                <span className="ml-2 font-medium">{formatPhase(position.gamePhase)}</span>
              </div>

              {/* Position ID */}
              <div className="col-span-2">
                <span className="text-gray-500">Position ID:</span>
                <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {position.positionId}
                </span>
              </div>
            </div>

            {/* Match Metadata (if MATCH_IMPORT) */}
            {position.match && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="text-sm font-medium text-amber-800 mb-2">Match Info</h4>
                <div className="space-y-1 text-sm">
                  {/* Players */}
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700">
                      {position.match.player1Name}
                      {position.match.player1Country && (
                        <span className="ml-1 text-xs">({position.match.player1Country})</span>
                      )}
                    </span>
                    <span className="text-amber-600">vs</span>
                    <span className="text-amber-700">
                      {position.match.player2Name}
                      {position.match.player2Country && (
                        <span className="ml-1 text-xs">({position.match.player2Country})</span>
                      )}
                    </span>
                  </div>

                  {/* Tournament */}
                  {position.match.tournamentName && (
                    <div>
                      <span className="text-amber-600">Tournament:</span>
                      <span className="ml-2 text-amber-800">{position.match.tournamentName}</span>
                    </div>
                  )}

                  {/* Match Length */}
                  <div>
                    <span className="text-amber-600">Match Length:</span>
                    <span className="ml-2 text-amber-800">{position.match.matchLength} points</span>
                  </div>

                  {/* Game and Move Number */}
                  {(position.gameNumber || position.moveNumber) && (
                    <div>
                      <span className="text-amber-600">Position:</span>
                      <span className="ml-2 text-amber-800">
                        {position.gameNumber && `Game ${position.gameNumber}`}
                        {position.gameNumber && position.moveNumber && ', '}
                        {position.moveNumber && `Move ${position.moveNumber}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Archive Metadata */}
            {position.archive && (
              <div className="mt-3 text-xs text-gray-500">
                <span>Source file:</span>
                <span className="ml-1 font-mono">{position.archive.filename}</span>
                {position.archive.sourceCollection && (
                  <span className="ml-2">({position.archive.sourceCollection})</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    OPENING_CATALOG: 'Opening Catalog',
    MATCH_IMPORT: 'Match Import',
    CURATED: 'Curated',
    SELF_PLAY: 'Self-Play'
  }
  return labels[source] || source
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    OPENING: 'Opening',
    EARLY: 'Early Game',
    MIDDLE: 'Middle Game',
    BEAROFF: 'Bearoff'
  }
  return labels[phase] || phase
}
