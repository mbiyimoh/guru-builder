'use client';

import { getPhasesForArtifactType, type ArtifactType, type TeachingPhase } from '@/lib/teaching/constants';

interface TeachingProgressTrackerProps {
  artifactType: ArtifactType;
  currentStage: string | null;
  isComplete?: boolean;
}

function getPhaseIndex(phases: TeachingPhase[], stageKey: string | null): number {
  if (!stageKey) return 0;
  const index = phases.findIndex(p => p.key === stageKey);
  return index === -1 ? 0 : index;
}

export function TeachingProgressTracker({
  artifactType,
  currentStage,
  isComplete = false
}: TeachingProgressTrackerProps) {
  const phases = getPhasesForArtifactType(artifactType);
  const currentIndex = isComplete ? phases.length : getPhaseIndex(phases, currentStage);

  return (
    <div className="w-full py-4" data-testid="teaching-progress-tracker">
      {/* Progress bar container */}
      <div className="relative">
        {/* Background track */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full" />

        {/* Completed track */}
        <div
          className="absolute top-5 left-0 h-1 bg-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{
            width: isComplete
              ? '100%'
              : `${(currentIndex / (phases.length - 1)) * 100}%`
          }}
        />

        {/* Phase indicators */}
        <div className="relative flex justify-between">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex || isComplete;
            const isCurrent = index === currentIndex && !isComplete;

            return (
              <div key={phase.key} className="flex flex-col items-center">
                {/* Circle indicator */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    text-sm font-semibold transition-all duration-300
                    ${isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                        ? 'bg-blue-100 text-blue-700 ring-4 ring-blue-200 animate-pulse'
                        : 'bg-gray-100 text-gray-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    phase.icon
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-2 text-xs font-medium text-center max-w-[70px]
                    ${isCompleted
                      ? 'text-blue-700'
                      : isCurrent
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-400'
                    }
                  `}
                >
                  {phase.label}
                </span>

                {/* Time estimate (only show for current phase) */}
                {isCurrent && (
                  <span className="mt-1 text-xs text-gray-500">
                    {phase.estimatedTime}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status message */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          {isComplete ? (
            <span className="text-green-600 font-medium">Generation complete!</span>
          ) : (
            <span className="text-blue-600">
              {phases[currentIndex]?.label || 'Starting...'}...
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
