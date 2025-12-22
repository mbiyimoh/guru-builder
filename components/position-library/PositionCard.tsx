'use client'

import { cn } from '@/lib/utils'
import type { PositionWithRelations } from './types'

interface PositionCardProps {
  position: PositionWithRelations
  onClick: () => void
}

/**
 * Compact card displaying a position summary.
 * Shows dice roll, best move with equity, source badge, and game phase.
 */
export function PositionCard({ position, onClick }: PositionCardProps) {
  const formattedEquity = position.bestMoveEquity >= 0
    ? `+${position.bestMoveEquity.toFixed(3)}`
    : position.bestMoveEquity.toFixed(3)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border bg-white',
        'hover:border-purple-300 hover:shadow-sm transition-all',
        'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1'
      )}
    >
      {/* Dice Roll */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-mono font-semibold text-gray-900">
          {position.diceRoll}
        </span>
        <SourceBadge source={position.sourceType} />
      </div>

      {/* Best Move with Equity */}
      <div className="text-sm text-gray-700 font-mono truncate mb-2">
        {position.bestMove}{' '}
        <span className={cn(
          'font-medium',
          position.bestMoveEquity >= 0 ? 'text-green-600' : 'text-red-600'
        )}>
          ({formattedEquity})
        </span>
      </div>

      {/* Game Phase Badge */}
      <PhaseBadge phase={position.gamePhase} />
    </button>
  )
}

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { label: string; className: string }> = {
    OPENING_CATALOG: {
      label: 'CATALOG',
      className: 'bg-blue-100 text-blue-700'
    },
    MATCH_IMPORT: {
      label: 'MATCH',
      className: 'bg-amber-100 text-amber-700'
    },
    CURATED: {
      label: 'CURATED',
      className: 'bg-purple-100 text-purple-700'
    },
    SELF_PLAY: {
      label: 'SELF-PLAY',
      className: 'bg-gray-100 text-gray-700'
    }
  }

  const { label, className } = config[source] || {
    label: source,
    className: 'bg-gray-100 text-gray-600'
  }

  return (
    <span className={cn('px-1.5 py-0.5 text-xs font-medium rounded', className)}>
      {label}
    </span>
  )
}

function PhaseBadge({ phase }: { phase: string }) {
  const config: Record<string, { label: string; className: string }> = {
    OPENING: {
      label: 'Opening',
      className: 'bg-emerald-100 text-emerald-700'
    },
    EARLY: {
      label: 'Early',
      className: 'bg-sky-100 text-sky-700'
    },
    MIDDLE: {
      label: 'Middle',
      className: 'bg-orange-100 text-orange-700'
    },
    BEAROFF: {
      label: 'Bearoff',
      className: 'bg-rose-100 text-rose-700'
    }
  }

  const { label, className } = config[phase] || {
    label: phase,
    className: 'bg-gray-100 text-gray-600'
  }

  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded', className)}>
      {label}
    </span>
  )
}
