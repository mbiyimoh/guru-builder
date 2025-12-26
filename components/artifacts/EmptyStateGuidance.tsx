// components/artifacts/EmptyStateGuidance.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, BookOpen, Target, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { DebugTerminal, useDebugLogs } from '@/components/guru/DebugTerminal';

type ArtifactTypeSlug = 'mental-model' | 'curriculum' | 'drill-series';

interface Props {
  projectId: string;
  onGenerate: (type: ArtifactTypeSlug) => void;
  // Error callback (replaces blocking alert())
  onError?: (message: string) => void;
}

const STEPS = [
  {
    number: 1,
    type: 'mental-model' as const,
    icon: Brain,
    title: 'Mental Model',
    description: 'Start with the foundational concepts and principles that form the core of your teaching domain.',
    action: 'Generate Mental Model',
  },
  {
    number: 2,
    type: 'curriculum' as const,
    icon: BookOpen,
    title: 'Curriculum',
    description: 'Create a structured learning path that builds on the mental model with progressive lessons.',
    action: 'Generate Curriculum',
    requires: 'Mental Model',
  },
  {
    number: 3,
    type: 'drill-series' as const,
    icon: Target,
    title: 'Drill Series',
    description: 'Design practice exercises that reinforce concepts and develop practical skills.',
    action: 'Generate Drills',
    requires: 'Curriculum',
  },
];

export function EmptyStateGuidance({ projectId, onGenerate, onError }: Props) {
  const [loading, setLoading] = useState<ArtifactTypeSlug | null>(null);

  // Debug logging - matches ArtifactDetailPanel pattern
  const { logs, log, clearLogs } = useDebugLogs();

  const handleGenerate = async (type: ArtifactTypeSlug) => {
    setLoading(type);

    const endpoint = `/api/projects/${projectId}/guru/${type}`;
    const body = { userNotes: '' }; // Explicit empty notes for consistency with ArtifactDetailPanel

    log.info('Generate', `Starting ${type} generation...`, { endpoint, body });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        log.success('Generate', `${type} generation triggered`, result);
        // Success - notify parent to show progress tracker
        onGenerate(type);
      } else {
        const errorText = await res.text();
        log.error('Generate', `Generation failed: ${res.status}`, { statusText: res.statusText, body: errorText });
        if (onError) {
          onError(`Generation failed: ${errorText}`);
        }
        setLoading(null);
      }
    } catch (err) {
      log.error('Generate', 'Generation exception', { error: String(err) });
      if (onError) {
        onError('Generation failed. Please try again.');
      }
      setLoading(null);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background" data-testid="empty-state-guidance">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
            <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Create Your Teaching Artifacts</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Generate AI-powered learning materials for your guru. Start with the Mental Model,
            then build upon it with Curriculum and Drills.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map((step, index) => {
            const isLoading = loading === step.type;
            const isDisabled = index > 0 || loading !== null;

            return (
              <Card key={step.type} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                      {step.number}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <step.icon className="w-5 h-5 text-muted-foreground" />
                        <h3 className="font-semibold">{step.title}</h3>
                        {step.requires && (
                          <span className="text-xs text-muted-foreground">
                            (requires {step.requires})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.description}
                      </p>
                    </div>

                    <Button
                      onClick={() => handleGenerate(step.type)}
                      disabled={isDisabled}
                      className="flex-shrink-0"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          {step.action}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Debug Terminal - development only, matches ArtifactDetailPanel pattern */}
        {process.env.NODE_ENV === 'development' && (
          <DebugTerminal
            logs={logs}
            maxHeight="200px"
            title="Debug Terminal"
            onClear={clearLogs}
          />
        )}
      </div>
    </div>
  );
}
