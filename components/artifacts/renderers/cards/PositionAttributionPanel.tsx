'use client'

import { useEffect, useState } from 'react'
import { formatEquity, formatPhase, getPhaseBadgeClass, formatSource, getSourceBadgeClass } from '@/lib/positionLibrary/formatting'
import { Loader2, AlertCircle } from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface PositionDetails {
  id: string
  positionId: string
  gamePhase: string
  diceRoll: string
  asciiBoard: string
  bestMove: string
  bestMoveEquity: number
  secondBestMove?: string | null
  secondEquity?: number | null
  thirdBestMove?: string | null
  thirdEquity?: number | null
  sourceType: string
  gameNumber?: number | null
  moveNumber?: number | null
  match?: {
    player1Name: string
    player1Country?: string | null
    player2Name: string
    player2Country?: string | null
    tournamentName?: string | null
    matchLength: number
  } | null
  archive?: {
    filename: string
    sourceCollection?: string | null
  } | null
}

interface PositionAttributionPanelProps {
  positionId: string
  projectId: string
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PositionAttributionPanel({
  positionId,
  projectId,
}: PositionAttributionPanelProps) {
  const [position, setPosition] = useState<PositionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPosition() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/projects/${projectId}/positions/${positionId}`
        )

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch position')
        }

        const data = await response.json()
        setPosition(data.position)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchPosition()
  }, [positionId, projectId])

  // Loading state
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center text-gray-500">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading position...
      </div>
    )
  }

  // Error state
  if (error || !position) {
    return (
      <div className="p-4 flex items-center justify-center text-red-500">
        <AlertCircle className="w-4 h-4 mr-2" />
        {error || 'Position not found'}
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 border-t space-y-4">
      {/* Position ID and badges */}
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-xs bg-gray-200 px-2 py-1 rounded font-mono">
          {position.positionId}
        </code>
        <span className={getPhaseBadgeClass(position.gamePhase)}>
          {formatPhase(position.gamePhase)}
        </span>
        <span className={getSourceBadgeClass(position.sourceType)}>
          {formatSource(position.sourceType)}
        </span>
        <span className="text-xs text-gray-500">
          Dice: {position.diceRoll}
        </span>
      </div>

      {/* ASCII Board */}
      <pre className="font-mono text-xs bg-slate-900 text-green-400 p-3 rounded overflow-x-auto whitespace-pre">
        {position.asciiBoard}
      </pre>

      {/* Move Analysis */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-green-700 font-medium">
            Best: {position.bestMove}
          </span>
          <span className="font-mono text-green-600">
            {formatEquity(position.bestMoveEquity)}
          </span>
        </div>
        {position.secondBestMove && typeof position.secondEquity === 'number' && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>2nd: {position.secondBestMove}</span>
            <span className="font-mono">
              {formatEquity(position.secondEquity)}
            </span>
          </div>
        )}
        {position.thirdBestMove && typeof position.thirdEquity === 'number' && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>3rd: {position.thirdBestMove}</span>
            <span className="font-mono">
              {formatEquity(position.thirdEquity)}
            </span>
          </div>
        )}
      </div>

      {/* Match Context */}
      {position.match && (
        <div className="p-3 bg-amber-50 rounded border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>{position.match.player1Name}</strong>
            {position.match.player1Country && (
              <span className="text-amber-600"> ({position.match.player1Country})</span>
            )}
            {' vs '}
            <strong>{position.match.player2Name}</strong>
            {position.match.player2Country && (
              <span className="text-amber-600"> ({position.match.player2Country})</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-amber-600">
            {position.match.tournamentName && (
              <span>{position.match.tournamentName}</span>
            )}
            <span>{position.match.matchLength}-point match</span>
            {position.gameNumber && (
              <span>Game {position.gameNumber}</span>
            )}
            {position.moveNumber && (
              <span>Move {position.moveNumber}</span>
            )}
          </div>
        </div>
      )}

      {/* Archive Source */}
      {position.archive && (
        <div className="text-xs text-gray-500">
          Source: {position.archive.filename}
          {position.archive.sourceCollection && (
            <span> ({position.archive.sourceCollection})</span>
          )}
        </div>
      )}
    </div>
  )
}

export default PositionAttributionPanel
