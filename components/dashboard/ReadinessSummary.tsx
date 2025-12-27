'use client';

/**
 * ReadinessSummary Component
 *
 * Displays a compact readiness score card on the dashboard showing:
 * - Overall readiness percentage
 * - Profile and knowledge score breakdown
 * - Critical gaps as high-priority research recommendations
 * - Suggested gaps as optional improvements
 * - Link to full readiness report
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';

interface ReadinessSummaryProps {
  projectId: string;
}

export function ReadinessSummary({ projectId }: ReadinessSummaryProps) {
  const [score, setScore] = useState<ReadinessScore | null>(null);
  const [dimensions, setDimensions] = useState<DimensionCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReadiness() {
      try {
        const res = await fetch(`/api/projects/${projectId}/readiness`);

        if (!res.ok) {
          setError(`Request failed (${res.status})`);
          return;
        }

        const data = await res.json();
        if (data.success) {
          setScore(data.score);
          setDimensions(data.dimensions);
        } else {
          setError(data.error || 'Failed to fetch readiness');
        }
      } catch (err) {
        setError('Failed to fetch readiness');
      } finally {
        setLoading(false);
      }
    }

    fetchReadiness();
  }, [projectId]);

  if (loading) {
    return <ReadinessSkeletonCard />;
  }

  if (error || !score) {
    // Silently fail - don't block dashboard
    return null;
  }

  const isReady = score.overall >= 60 && score.criticalGaps.length === 0;

  return (
    <Card className={isReady ? 'border-green-200' : 'border-amber-200'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isReady ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            Guru Readiness
          </CardTitle>
          <div className="text-2xl font-bold">{score.overall}%</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score breakdown */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Profile</div>
            <Progress value={score.profile} className="h-2 mt-1" />
          </div>
          <div>
            <div className="text-muted-foreground">Knowledge</div>
            <Progress value={score.knowledge} className="h-2 mt-1" />
          </div>
        </div>

        {/* Critical gaps as recommendations */}
        {score.criticalGaps.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-red-700 dark:text-red-400">Critical Gaps</div>
            {score.criticalGaps.slice(0, 3).map(gapKey => {
              const dim = dimensions.find(d => d.dimensionKey === gapKey);
              const gapName = dim?.dimensionName || gapKey;
              return (
                <Link
                  key={gapKey}
                  href={`/projects/${projectId}/research?topic=${encodeURIComponent(gapName)}`}
                  className="flex items-center justify-between p-2 rounded border border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:border-red-900 transition-colors"
                >
                  <span className="text-sm font-medium">{gapName}</span>
                  <Badge variant="destructive" className="text-xs">Research</Badge>
                </Link>
              );
            })}
          </div>
        )}

        {/* Suggested improvements - only show if we have fewer than 3 critical gaps */}
        {score.suggestedGaps.length > 0 && score.criticalGaps.length < 3 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-amber-700 dark:text-amber-400">Suggested</div>
            {score.suggestedGaps.slice(0, 2).map(gapKey => {
              const dim = dimensions.find(d => d.dimensionKey === gapKey);
              const gapName = dim?.dimensionName || gapKey;
              return (
                <Link
                  key={gapKey}
                  href={`/projects/${projectId}/research?topic=${encodeURIComponent(gapName)}`}
                  className="flex items-center justify-between p-2 rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:border-amber-900 transition-colors"
                >
                  <span className="text-sm">{gapName}</span>
                  <Badge variant="outline" className="text-xs">Optional</Badge>
                </Link>
              );
            })}
          </div>
        )}

        {/* Ready state - show positive message */}
        {isReady && (
          <div className="p-3 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
            <p className="text-sm text-green-700 dark:text-green-400">
              Your guru is ready for content creation! You can generate teaching artifacts now.
            </p>
          </div>
        )}

        {/* View full report link */}
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href={`/projects/${projectId}/readiness`}>
            View Full Readiness Report
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ReadinessSkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}
