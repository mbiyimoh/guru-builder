/**
 * Progress Component
 *
 * A simple progress bar component for displaying completion percentages.
 * Features shimmer animation for visual feedback and smooth transitions.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps {
  value: number; // 0-100
  max?: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  /** Use primary color instead of status-based colors */
  usePrimary?: boolean;
}

export function Progress({
  value,
  max = 100,
  className = '',
  barClassName = '',
  showLabel = false,
  usePrimary = false,
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // Color based on percentage (or primary if specified)
  const getBarColor = () => {
    if (usePrimary) return 'bg-primary';
    if (percentage >= 80) return 'bg-emerald-600';
    if (percentage >= 60) return 'bg-primary';
    if (percentage >= 40) return 'bg-amber-600';
    return 'bg-red-600';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="relative w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out relative overflow-hidden',
            getBarColor(),
            barClassName
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-muted-foreground text-right">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
}
