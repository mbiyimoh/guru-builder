'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type WizardPhase = 'profile' | 'research' | 'readiness' | 'artifacts';

interface PhaseConfig {
  key: WizardPhase;
  label: string;
  path: string;
}

function getPhases(projectId?: string | null): PhaseConfig[] {
  if (projectId) {
    // Dashboard-anchored routes (new pattern)
    return [
      { key: 'profile', label: 'Define Guru', path: `/projects/${projectId}/profile` },
      { key: 'research', label: 'Build Knowledge', path: `/projects/${projectId}/research` },
      { key: 'readiness', label: 'Readiness Check', path: `/projects/${projectId}/readiness` },
      { key: 'artifacts', label: 'Create Content', path: `/projects/${projectId}/artifacts/teaching` },
    ];
  }

  // Legacy wizard routes (for initial profile creation without projectId)
  return [
    { key: 'profile', label: 'Define Guru', path: '/projects/new/profile' },
    { key: 'research', label: 'Build Knowledge', path: '/projects/new/research' },
    { key: 'readiness', label: 'Readiness Check', path: '/projects/new/readiness' },
    { key: 'artifacts', label: 'Create Content', path: '/projects/new/artifacts' },
  ];
}

interface WizardNavigationProps {
  hidePhases?: boolean;
}

export function WizardNavigation({ hidePhases = false }: WizardNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const PHASES = getPhases(projectId);

  // Determine current phase from pathname
  const currentPhaseIndex = PHASES.findIndex((phase) => pathname?.startsWith(phase.path) ||
    (projectId && pathname?.includes(`/projects/${projectId}/`)));
  const activePhaseIndex = currentPhaseIndex >= 0 ? currentPhaseIndex : 0;

  return (
    <nav className="bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Back to Projects Link - Stack above phases on mobile */}
        <div className={cn("mb-4 sm:mb-6", hidePhases && "mb-0")}>
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-block min-h-[44px] flex items-center"
          >
            ← Back to Projects
          </Link>
        </div>

        {/* Phase Navigation - conditionally hidden */}
        {!hidePhases && <div className="flex items-center justify-between">
          {PHASES.map((phase, index) => {
            const isActive = index === activePhaseIndex;
            const isCompleted = index < activePhaseIndex;
            const isFuture = index > activePhaseIndex;
            const isClickable = isCompleted || isActive;

            return (
              <div key={phase.key} className="flex items-center flex-1">
                {/* Phase Item */}
                <div className="flex items-center">
                  {isClickable ? (
                    <Link
                      href={phase.path}
                      className={cn(
                        'flex items-center space-x-2 sm:space-x-3 transition-colors min-h-[44px]',
                        isActive && 'cursor-default'
                      )}
                    >
                      {/* Icon - Always visible */}
                      <div
                        className={cn(
                          'w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0',
                          isCompleted &&
                            'bg-primary border-primary text-primary-foreground',
                          isActive &&
                            'bg-primary border-primary text-primary-foreground shadow-md',
                          isFuture &&
                            'bg-muted border-border text-muted-foreground'
                        )}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <Circle
                            className={cn(
                              'w-4 h-4 sm:w-5 sm:h-5',
                              isActive && 'fill-current'
                            )}
                          />
                        )}
                      </div>

                      {/* Label - Hidden on mobile, visible on tablet+ */}
                      <span
                        className={cn(
                          'hidden md:inline text-sm font-medium transition-colors',
                          isActive && 'text-primary',
                          isCompleted && 'text-foreground hover:text-primary',
                          isFuture && 'text-muted-foreground'
                        )}
                      >
                        {phase.label}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center space-x-2 sm:space-x-3 min-h-[44px]">
                      {/* Icon */}
                      <div
                        className={cn(
                          'w-10 h-10 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0',
                          'bg-muted border-border text-muted-foreground'
                        )}
                      >
                        <Circle className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>

                      {/* Label - Hidden on mobile */}
                      <span className="hidden md:inline text-sm font-medium text-muted-foreground">
                        {phase.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Connecting Line (except for last phase) - Thinner on mobile */}
                {index < PHASES.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 sm:mx-4 transition-colors',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>}
      </div>
    </nav>
  );
}
