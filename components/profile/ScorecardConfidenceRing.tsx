'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScorecardConfidenceRingProps {
  confidence: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZES = {
  sm: { width: 48, strokeWidth: 4, fontSize: 'text-sm' },
  md: { width: 64, strokeWidth: 5, fontSize: 'text-lg' },
  lg: { width: 80, strokeWidth: 6, fontSize: 'text-xl' },
};

export function ScorecardConfidenceRing({
  confidence,
  size = 'md',
  showLabel = true,
}: ScorecardConfidenceRingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const { width, strokeWidth, fontSize } = SIZES[size];

  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(confidence, 0), 1);

  // Animate on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  // Color based on confidence level
  const getColor = () => {
    if (confidence >= 0.8) return 'stroke-green-500';
    if (confidence >= 0.6) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  const getBgColor = () => {
    if (confidence >= 0.8) return 'stroke-green-100 dark:stroke-green-900/30';
    if (confidence >= 0.6) return 'stroke-amber-100 dark:stroke-amber-900/30';
    return 'stroke-red-100 dark:stroke-red-900/30';
  };

  const strokeDashoffset = circumference - (animatedProgress * circumference);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={width}
        height={width}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={getBgColor()}
        />
        {/* Progress circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(getColor(), 'transition-all duration-700 ease-out')}
        />
      </svg>
      {showLabel && (
        <div className={cn('absolute inset-0 flex items-center justify-center', fontSize)}>
          <span className="font-bold">{Math.round(confidence * 100)}</span>
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      )}
    </div>
  );
}
