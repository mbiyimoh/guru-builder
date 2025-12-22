/**
 * Progress Component
 *
 * A simple progress bar component for displaying completion percentages.
 */

import * as React from 'react';

export interface ProgressProps {
  value: number; // 0-100
  max?: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
}

export function Progress({
  value,
  max = 100,
  className = '',
  barClassName = '',
  showLabel = false,
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // Color based on percentage
  const getBarColor = () => {
    if (percentage >= 80) return 'bg-green-600';
    if (percentage >= 60) return 'bg-blue-600';
    if (percentage >= 40) return 'bg-amber-600';
    return 'bg-red-600';
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-in-out ${getBarColor()} ${barClassName}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 text-right">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
}
