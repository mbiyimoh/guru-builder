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

  // Refined pastel color palette - intentional, soft tones
  const getBarColor = () => {
    if (usePrimary) return 'bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400';
    // Soft sage/teal for excellent (80%+)
    if (percentage >= 80) return 'bg-gradient-to-r from-emerald-400 to-teal-400';
    // Soft blue/indigo for good (60-79%)
    if (percentage >= 60) return 'bg-gradient-to-r from-sky-400 to-indigo-400';
    // Soft amber/peach for needs attention (40-59%)
    if (percentage >= 40) return 'bg-gradient-to-r from-amber-300 to-orange-300';
    // Soft rose/coral for low (<40%)
    return 'bg-gradient-to-r from-rose-300 to-pink-400';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="relative w-full h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden',
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
