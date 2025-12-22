'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Trash2, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPrincipleById } from '@/lib/backgammon'
import { PositionAttributionPanel } from './PositionAttributionPanel'
import type { PhaseDrill } from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema'

// =============================================================================
// TYPES
// =============================================================================

interface DrillCardWithPositionProps {
  id: string
  drill: PhaseDrill
  drillNumber: number
  totalDrills: number
  projectId: string
  onDelete?: () => void
}

// =============================================================================
// TIER COLORS
// =============================================================================

const TIER_COLORS: Record<string, string> = {
  RECOGNITION: 'bg-green-100 text-green-700',
  APPLICATION: 'bg-blue-100 text-blue-700',
  TRANSFER: 'bg-purple-100 text-purple-700',
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DrillCardWithPosition({
  id,
  drill,
  drillNumber,
  totalDrills,
  projectId,
  onDelete,
}: DrillCardWithPositionProps) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [showPosition, setShowPosition] = useState(false)

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`drill-card-with-position-${drill.drillId}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">
            Drill {drillNumber} of {totalDrills}
          </span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
              {drill.methodology}
            </span>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded', TIER_COLORS[drill.tier])}>
              {drill.tier}
            </span>
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete drill"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Principle tags for this drill */}
        <div className="flex flex-wrap gap-1">
          {/* Primary principle */}
          {(() => {
            const p = getPrincipleById(drill.primaryPrincipleId)
            return p ? (
              <span
                key={drill.primaryPrincipleId}
                className="px-1.5 py-0.5 text-xs rounded bg-blue-200 text-blue-700 font-medium"
                title={`Primary: ${p.description}`}
              >
                {p.name}
              </span>
            ) : null
          })()}

          {/* Universal principles */}
          {drill.universalPrincipleIds.map((pid: string) => {
            const p = getPrincipleById(pid)
            return p ? (
              <span
                key={pid}
                className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600"
                title={p.description}
              >
                {p.name}
              </span>
            ) : null
          })}
        </div>
      </div>

      {/* Scenario & Question */}
      <div className="p-4">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Scenario</h4>
          <p className="text-gray-700">{drill.scenario}</p>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Question</h4>
          <p className="font-medium text-gray-900">{drill.question}</p>
        </div>

        {/* Options (if multiple choice) */}
        {drill.options && drill.options.length > 0 && (
          <div className="space-y-2">
            {drill.options.map((option) => (
              <div
                key={option.id}
                className={cn(
                  'p-3 rounded border',
                  option.isCorrect
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-600 shrink-0">
                    {option.id})
                  </span>
                  <span className={option.isCorrect ? 'text-green-800' : 'text-gray-700'}>
                    {option.text}
                  </span>
                  {option.isCorrect && (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 ml-auto" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Non-multiple choice answer display */}
        {(!drill.options || drill.options.length === 0) && drill.correctAnswer && (
          <div className="p-3 rounded border border-green-300 bg-green-50">
            <span className="text-sm font-medium text-green-700">Correct Answer:</span>{' '}
            <span className="text-green-800">{drill.correctAnswer}</span>
          </div>
        )}
      </div>

      {/* Feedback Toggle */}
      <button
        onClick={() => setShowFeedback(!showFeedback)}
        className="w-full p-3 text-left text-sm text-blue-700 hover:bg-blue-50 border-t border-gray-100 flex items-center justify-between"
      >
        {showFeedback ? 'Hide Feedback' : 'Show Feedback'}
        {showFeedback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Feedback */}
      {showFeedback && (
        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-1">Correct Response</h4>
            <p className="text-gray-700 text-sm">{drill.feedback.correct}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-1">Incorrect Response</h4>
            <p className="text-gray-700 text-sm">{drill.feedback.incorrect}</p>
          </div>
          {drill.feedback.partialCredit && (
            <div>
              <h4 className="text-sm font-medium text-amber-700 mb-1">Partial Credit</h4>
              <p className="text-gray-700 text-sm">{drill.feedback.partialCredit}</p>
            </div>
          )}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Explanation</h4>
            <p className="text-gray-700 text-sm">{drill.explanation}</p>
          </div>
          {drill.hints && drill.hints.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Hints</h4>
              <ul className="list-disc list-inside text-gray-700 text-sm">
                {drill.hints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Position Attribution Toggle */}
      {drill.positionId && (
        <>
          <button
            onClick={() => setShowPosition(!showPosition)}
            className="w-full p-3 text-left text-sm text-purple-700 hover:bg-purple-50 border-t border-gray-100 flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Position: {drill.positionId}
            </span>
            {showPosition ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showPosition && (
            <PositionAttributionPanel
              positionId={drill.positionId}
              projectId={projectId}
            />
          )}
        </>
      )}
    </div>
  )
}

export default DrillCardWithPosition
