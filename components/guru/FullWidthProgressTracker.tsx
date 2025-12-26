'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPhasesForArtifactType, type ArtifactType } from '@/lib/teaching/constants';
import type { SubTaskProgress } from '@/lib/teaching/types';

interface FullWidthProgressTrackerProps {
  artifactType: ArtifactType;
  currentStage: string | null;
  subTaskProgress: SubTaskProgress | null;
  isComplete: boolean;
  onFadeComplete?: () => void;
}

/**
 * Full-width progress tracker that displays beneath artifact tiles during generation.
 * Shows phase timeline with current phase highlighted and sub-task visibility for verification.
 */
export function FullWidthProgressTracker({
  artifactType,
  currentStage,
  subTaskProgress,
  isComplete,
  onFadeComplete
}: FullWidthProgressTrackerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showingSummary, setShowingSummary] = useState(false);
  const phases = getPhasesForArtifactType(artifactType);

  // When currentStage is null but we're not complete, show first phase as in-progress
  // This handles the initial state when artifact is created but Inngest hasn't started yet
  const currentIndex = isComplete
    ? phases.length
    : currentStage
      ? phases.findIndex(p => p.key === currentStage)
      : 0;  // Default to first phase when generation just started

  // Handle completion fade-out
  useEffect(() => {
    if (isComplete && !showingSummary) {
      setShowingSummary(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onFadeComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, showingSummary, onFadeComplete]);

  if (!isVisible) return null;

  const isVerifying = currentStage === 'VERIFYING_CONTENT';
  const isValidating = currentStage === 'VALIDATING_OUTPUT';
  const isGeneratingContent = currentStage === 'GENERATING_CONTENT';
  const artifactLabel = artifactType === 'MENTAL_MODEL' ? 'Mental Model'
    : artifactType === 'CURRICULUM' ? 'Curriculum'
    : 'Drill Series';

  return (
    <div className={cn(
      "w-full mt-6 p-6 bg-muted/50 rounded-lg border transition-opacity duration-500",
      showingSummary && "opacity-50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          )}
          <span className="font-medium">
            {isComplete ? `${artifactLabel} Generated` : `Generating ${artifactLabel}...`}
          </span>
        </div>
        {subTaskProgress && isVerifying && !isComplete && (
          <span className="text-sm text-muted-foreground">
            Claim {subTaskProgress.current}/{subTaskProgress.total}
          </span>
        )}
        {subTaskProgress && isValidating && !isComplete && subTaskProgress.current > 0 && (
          <span className="text-sm text-muted-foreground">
            Retry {subTaskProgress.current}/{subTaskProgress.total}
          </span>
        )}
      </div>

      {/* Phase Timeline */}
      <div className="relative mb-4">
        {/* Progress bar background */}
        <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded-full" />
        {/* Progress bar filled */}
        <div
          className="absolute top-4 left-0 h-1 bg-blue-600 rounded-full transition-all duration-500"
          style={{
            width: isComplete
              ? '100%'
              : `${Math.max(0, (currentIndex / (phases.length - 1)) * 100)}%`
          }}
        />

        {/* Phase indicators */}
        <div className="relative flex justify-between">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex || isComplete;
            const isCurrent = index === currentIndex && !isComplete;

            return (
              <div key={phase.key} className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                  isCompleted && "bg-blue-600 text-white",
                  isCurrent && "bg-blue-100 text-blue-700 ring-2 ring-blue-300 animate-pulse",
                  !isCompleted && !isCurrent && "bg-gray-100 text-gray-400"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    phase.icon
                  )}
                </div>
                <span className={cn(
                  "mt-2 text-xs text-center",
                  isCompleted && "text-blue-700 font-medium",
                  isCurrent && "text-blue-600 font-semibold",
                  !isCompleted && !isCurrent && "text-gray-400"
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-task detail for generation phase (drill series) */}
      {isGeneratingContent && subTaskProgress && !isComplete && (
        <div className="mt-4 p-3 bg-background rounded border">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <span className="text-muted-foreground">Progress:</span>
            <span className="font-medium">
              {subTaskProgress.currentClaimText || `Generating ${subTaskProgress.total} drills (this may take 30-60s)...`}
            </span>
          </div>
          {/* Mini progress bar for drills */}
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${subTaskProgress.total > 0 ? (subTaskProgress.current / subTaskProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Sub-task detail for verification phase */}
      {isVerifying && subTaskProgress && !isComplete && (
        <div className="mt-4 p-3 bg-background rounded border">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-muted-foreground">Verifying:</span>
            <span className="font-mono text-xs truncate flex-1">
              {subTaskProgress.currentClaimText || 'Processing...'}
            </span>
          </div>
          {/* Mini progress bar for claims */}
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${subTaskProgress.total > 0 ? (subTaskProgress.current / subTaskProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Sub-task detail for validation phase */}
      {isValidating && subTaskProgress && !isComplete && (
        <div className="mt-4 p-3 bg-background rounded border">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-muted-foreground">Validating:</span>
            <span className="text-xs flex-1">
              {subTaskProgress.currentClaimText || 'Checking drill count and structure...'}
            </span>
          </div>
          {subTaskProgress.current > 0 && (
            <div className="mt-2 text-xs text-amber-600">
              Retrying generation (attempt {subTaskProgress.current}/{subTaskProgress.total})
            </div>
          )}
        </div>
      )}

      {/* Completion summary */}
      {isComplete && showingSummary && (
        <div className="text-center text-sm text-green-600 font-medium">
          {subTaskProgress
            ? `Verified ${subTaskProgress.total} claims successfully`
            : 'Generation complete'
          }
        </div>
      )}
    </div>
  );
}
