'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { TierBadge } from '../badges';
import type { Drill } from '@/lib/guruFunctions/schemas/drillSeriesSchema';

interface DrillCardProps {
  id: string;
  drill: Drill;
  drillNumber: number;
  totalDrills: number;
}

export function DrillCard({ id, drill, drillNumber, totalDrills }: DrillCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`drill-card-${drill.drillId}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">
            Drill {drillNumber} of {totalDrills}
          </span>
          <TierBadge tier={drill.tier} />
        </div>

        {/* Scenario */}
        <div className="mb-4">
          <p className="text-gray-700">{drill.scenario.setup}</p>
          {drill.asciiWireframe && (
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-x-auto">
              {drill.asciiWireframe}
            </pre>
          )}
        </div>

        {/* Question */}
        <p className="font-medium text-gray-900">{drill.scenario.question}</p>
      </div>

      {/* Options */}
      <div className="p-4 space-y-2">
        {drill.options.map((option) => (
          <div
            key={option.id}
            className={`p-3 rounded border ${
              option.isCorrect
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
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

      {/* Feedback Toggle */}
      <button
        onClick={() => setShowFeedback(!showFeedback)}
        className="w-full p-3 text-left text-sm text-blue-700 hover:bg-blue-50 border-t border-gray-100 flex items-center justify-between"
      >
        {showFeedback ? 'Hide Feedback' : 'Show Feedback'}
        {showFeedback ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Feedback */}
      {showFeedback && (
        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-1">
              Correct Answer Feedback
            </h4>
            <p className="text-gray-700 text-sm">{drill.feedback.correct.brief}</p>
            <p className="text-gray-600 text-sm mt-1">
              <strong>Principle:</strong> {drill.feedback.correct.principleReinforcement}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-1">
              Incorrect Answer Guidance
            </h4>
            <p className="text-gray-700 text-sm">{drill.feedback.incorrect.brief}</p>
            <p className="text-gray-600 text-sm mt-1">
              <strong>Reminder:</strong> {drill.feedback.incorrect.principleReminder}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              <strong>Hint:</strong> {drill.feedback.incorrect.tryAgainHint}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
