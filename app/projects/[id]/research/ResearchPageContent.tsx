'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Lightbulb, Search, Loader2 } from 'lucide-react';
import { ResearchChatAssistant, type ResearchChatAssistantRef } from '@/components/wizard/research/ResearchChatAssistant';
import { InlineReadinessIndicator } from '@/components/research/InlineReadinessIndicator';
import type { GuruProfile, ResearchRun } from '@prisma/client';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';
import type { ResearchPlan } from '@/lib/research/chat-types';
import type { GuruProfileData } from '@/lib/guruProfile/types';

interface Props {
  projectId: string;
  profile: GuruProfile | null;
  researchRuns: (ResearchRun & { _count: { recommendations: number } })[];
}

export function ResearchPageContent({ projectId, profile, researchRuns }: Props) {
  const router = useRouter();
  const chatRef = useRef<ResearchChatAssistantRef>(null);
  const [readiness, setReadiness] = useState<{
    score: ReadinessScore;
    dimensions: DimensionCoverage[];
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [readinessRefreshTrigger, setReadinessRefreshTrigger] = useState(0);

  // Fetch readiness data for suggested topics
  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/readiness`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReadiness({ score: data.score, dimensions: data.dimensions });
        }
      }
    } catch (err) {
      console.error('Failed to fetch readiness:', err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  // Extract GuruProfileData from the profileData JSON field
  const guruProfileData: GuruProfileData | null = profile?.profileData
    ? (profile.profileData as GuruProfileData)
    : null;

  // Handle research plan execution
  const handleExecutePlan = async (plan: ResearchPlan) => {
    setIsExecuting(true);
    try {
      // Build instructions from the plan - combine objective with focus areas for context
      const instructions = plan.focusAreas.length > 0
        ? `${plan.objective}\n\nFocus areas: ${plan.focusAreas.join(', ')}`
        : plan.objective;

      const response = await fetch('/api/research-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          instructions,
          depth: plan.depth,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start research');
      }

      const data = await response.json();

      // Navigate to research run page - API returns { run: { id: ... } }
      router.push(`/projects/${projectId}/research/${data.run.id}`);
    } catch (error) {
      console.error('Failed to execute research plan:', error);
      alert(`Failed to start research. ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle clicking a gap to pre-fill the chat
  const handleGapClick = (gapName: string) => {
    chatRef.current?.setInputMessage(`I want to research more about ${gapName}`);
  };

  return (
    <div className="space-y-8">
      {/* Inline Readiness Indicator */}
      <InlineReadinessIndicator
        projectId={projectId}
        refreshTrigger={readinessRefreshTrigger}
      />

      {/* Gap Suggestions */}
      {readiness && (readiness.score.criticalGaps.length > 0 || readiness.score.suggestedGaps.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suggested Research Topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Critical Gaps */}
            {readiness.score.criticalGaps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Critical Knowledge Gaps</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {readiness.score.criticalGaps.map(gapKey => {
                    const dim = readiness.dimensions.find(d => d.dimensionKey === gapKey);
                    return (
                      <button
                        key={gapKey}
                        onClick={() => handleGapClick(dim?.dimensionName || gapKey)}
                        className="text-left"
                      >
                        <Card className="border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer">
                          <CardContent className="p-3">
                            <div className="font-medium text-sm">{dim?.dimensionName || gapKey}</div>
                            <Badge variant="destructive" className="mt-1.5 text-xs">High Priority</Badge>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggested Gaps */}
            {readiness.score.suggestedGaps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lightbulb className="w-4 h-4" />
                  <span className="font-medium">Recommended Research Areas</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {readiness.score.suggestedGaps.map(gapKey => {
                    const dim = readiness.dimensions.find(d => d.dimensionKey === gapKey);
                    return (
                      <button
                        key={gapKey}
                        onClick={() => handleGapClick(dim?.dimensionName || gapKey)}
                        className="text-left"
                      >
                        <Card className="border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer">
                          <CardContent className="p-3">
                            <div className="font-medium text-sm">{dim?.dimensionName || gapKey}</div>
                            <Badge variant="outline" className="mt-1.5 text-xs">Suggested</Badge>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Research Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Research Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isExecuting ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Starting research...</span>
            </div>
          ) : (
            <ResearchChatAssistant
              ref={chatRef}
              projectId={projectId}
              guruProfile={guruProfileData}
              onExecutePlan={handleExecutePlan}
            />
          )}
        </CardContent>
      </Card>

      {/* Research History */}
      {researchRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Research History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {researchRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => router.push(`/projects/${projectId}/research/${run.id}`)}
                  className="flex items-center justify-between p-3 rounded border w-full text-left hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <div className="font-medium">
                      {run.instructions.length > 60
                        ? run.instructions.slice(0, 60) + '...'
                        : run.instructions}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {run._count.recommendations} recommendations
                    </div>
                  </div>
                  <Badge variant={run.status === 'COMPLETED' ? 'default' : 'secondary'}>
                    {run.status}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
