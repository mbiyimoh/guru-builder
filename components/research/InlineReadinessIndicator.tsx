'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronRight, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ReadinessData {
  success: boolean;
  score: {
    overall: number;
    criticalGaps: string[];
  };
}

interface InlineReadinessIndicatorProps {
  projectId: string;
  refreshTrigger?: number; // Increment to force refresh
}

export function InlineReadinessIndicator({
  projectId,
  refreshTrigger = 0
}: InlineReadinessIndicatorProps) {
  const [score, setScore] = useState<ReadinessData['score'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  // Use ref to track previous score without causing dependency loops
  const previousScoreRef = useRef<number | null>(null);

  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/readiness`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data: ReadinessData = await res.json();
        if (data.success && data.score) {
          // Store previous score before updating
          if (previousScoreRef.current !== null) {
            setPreviousScore(previousScoreRef.current);
          }
          previousScoreRef.current = data.score.overall;
          setScore(data.score);
        }
      }
    } catch (error) {
      console.error('Failed to fetch readiness:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]); // Only depends on projectId (stable)

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="w-full bg-gray-50 border-b px-6 py-3">
        <div className="animate-pulse flex items-center gap-4">
          <div className="h-2 bg-gray-200 rounded flex-1 max-w-xs" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!score) return null;

  const isReady = score.overall >= 60 && score.criticalGaps.length === 0;
  const scoreImproved = previousScore !== null && score.overall > previousScore;
  const scoreDelta = previousScore !== null ? score.overall - previousScore : 0;

  return (
    <div className="w-full bg-gradient-to-r from-gray-50 to-white border-b px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Progress bar section */}
        <div className="flex items-center gap-4 flex-1">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Readiness
          </span>

          {/* Progress bar */}
          <div className="flex-1 max-w-md">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isReady ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, score.overall)}%` }}
              />
            </div>
          </div>

          {/* Score display */}
          <div className="flex items-center gap-2">
            <span
              data-testid="readiness-score"
              className={`text-lg font-bold ${
                isReady ? 'text-green-600' : 'text-amber-600'
              }`}
            >
              {Math.round(score.overall)}%
            </span>

            {/* Score improvement indicator */}
            {scoreImproved && (
              <span
                data-testid="score-improvement"
                className="flex items-center text-sm text-green-600 animate-pulse"
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                +{Math.round(scoreDelta)}%
              </span>
            )}
          </div>
        </div>

        {/* Status and link */}
        <div className="flex items-center gap-4">
          {score.criticalGaps.length > 0 && (
            <span className="flex items-center text-sm text-amber-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              {score.criticalGaps.length} critical gap{score.criticalGaps.length !== 1 ? 's' : ''}
            </span>
          )}

          <Link
            href={`/projects/${projectId}/readiness`}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View Report
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
