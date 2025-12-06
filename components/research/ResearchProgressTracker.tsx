'use client';

import { PROGRESS_STAGES } from '@/lib/assessment/constants';

// Define the ordered phases for the progress tracker
const RESEARCH_PHASES = [
  { key: 'STARTING', label: 'Starting', icon: '1' },
  { key: 'SEARCHING', label: 'Searching', icon: '2' },
  { key: 'SYNTHESIZING', label: 'Synthesizing', icon: '3' },
  { key: 'SAVING_RESEARCH', label: 'Saving Research', icon: '4' },
  { key: 'GENERATING_RECOMMENDATIONS', label: 'Generating Recs', icon: '5' },
  { key: 'SAVING_RECOMMENDATIONS', label: 'Saving Recs', icon: '6' },
] as const;

// Map progress stage strings to phase keys
function getPhaseKeyFromStage(stage: string): string {
  // Find matching key by checking if stage includes the key's associated text
  if (stage.includes('Starting')) return 'STARTING';
  if (stage.includes('Optimizing')) return 'STARTING'; // Part of starting
  if (stage.includes('Searching')) return 'SEARCHING';
  if (stage.includes('Analyzing')) return 'SEARCHING'; // Part of search
  if (stage.includes('Synthesizing')) return 'SYNTHESIZING';
  if (stage.includes('Saving research')) return 'SAVING_RESEARCH';
  if (stage.includes('Generating')) return 'GENERATING_RECOMMENDATIONS';
  if (stage.includes('Saving recommendations')) return 'SAVING_RECOMMENDATIONS';
  if (stage.includes('Complete')) return 'COMPLETE';
  return 'STARTING';
}

function getPhaseIndex(phaseKey: string): number {
  const index = RESEARCH_PHASES.findIndex(p => p.key === phaseKey);
  return index === -1 ? 0 : index;
}

interface ResearchProgressTrackerProps {
  currentStage: string;
  isComplete?: boolean;
}

export function ResearchProgressTracker({ currentStage, isComplete = false }: ResearchProgressTrackerProps) {
  const currentPhaseKey = isComplete ? 'COMPLETE' : getPhaseKeyFromStage(currentStage);
  const currentIndex = isComplete ? RESEARCH_PHASES.length : getPhaseIndex(currentPhaseKey);

  return (
    <div className="w-full">
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
              : `${(currentIndex / (RESEARCH_PHASES.length - 1)) * 100}%`
          }}
        />

        {/* Phase indicators */}
        <div className="relative flex justify-between">
          {RESEARCH_PHASES.map((phase, index) => {
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
                    mt-2 text-xs font-medium text-center max-w-[80px]
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status message */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          {isComplete ? (
            <span className="text-green-600 font-medium">Research complete!</span>
          ) : (
            <span className="text-blue-600">{currentStage}</span>
          )}
        </p>
      </div>
    </div>
  );
}
