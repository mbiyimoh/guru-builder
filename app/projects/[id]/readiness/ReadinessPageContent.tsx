'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Loader2, Zap } from 'lucide-react';
import { TourPageButton } from '@/lib/onboarding/TourPageButton';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';

interface GTStatus {
  enabled: boolean;
  engineName: string | null;
  positionCount: number;
}

interface Props {
  projectId: string;
}

export function ReadinessPageContent({ projectId }: Props) {
  const [score, setScore] = useState<ReadinessScore | null>(null);
  const [dimensions, setDimensions] = useState<DimensionCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reassessing, setReassessing] = useState(false);
  const [gtStatus, setGtStatus] = useState<GTStatus>({
    enabled: false,
    engineName: null,
    positionCount: 0,
  });

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

  // Fetch GT status
  useEffect(() => {
    async function fetchGTStatus() {
      try {
        const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const data = await res.json();
        const activeConfig = data.activeConfig;

        if (activeConfig?.isEnabled && activeConfig?.engine?.id) {
          // Fetch position counts
          const countsRes = await fetch(
            `/api/position-library/counts?engineId=${activeConfig.engine.id}`,
            { credentials: 'include' }
          );
          const counts = countsRes.ok
            ? await countsRes.json()
            : { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 };

          const totalPositions = Object.values(counts).reduce(
            (a: number, b: unknown) => a + (b as number),
            0
          );

          setGtStatus({
            enabled: true,
            engineName: activeConfig.engine.name,
            positionCount: totalPositions,
          });
        }
      } catch (err) {
        // Silently fail - GT status is optional
        console.error('Failed to fetch GT status:', err);
      }
    }
    fetchGTStatus();
  }, [projectId]);

  const handleReassess = async () => {
    setReassessing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/readiness`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      if (data.success && data.score && data.dimensions) {
        setScore(data.score);
        setDimensions(data.dimensions);
        // Show warning if re-assessment timed out (partial results)
        if (data.warning) {
          alert(data.warning);
        }
      } else {
        throw new Error(data.error || 'Invalid response from server');
      }
    } catch (err) {
      console.error('Re-assessment failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to re-assess readiness';
      alert(message);
    } finally {
      setReassessing(false);
    }
  };

  if (loading) {
    return <ReadinessSkeleton />;
  }

  if (error || !score) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{error || 'Unable to load readiness data'}</p>
        </CardContent>
      </Card>
    );
  }

  const isReady = score.overall >= 60 && score.criticalGaps.length === 0;

  return (
    <div className="space-y-6">
      {/* Page Header with Tour Button */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Readiness Score</h1>
        <TourPageButton tourId="readiness" />
      </div>

      {/* Overall Score */}
      <Card data-tour="overall-score" className={isReady ? 'border-green-200' : 'border-amber-200'}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {isReady ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
              Overall Readiness
            </span>
            <span className="text-4xl font-bold">{score.overall}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={score.overall} className="h-4 mb-6" />

          <div data-tour="score-breakdown" className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Profile Completeness</div>
              <Progress value={score.profile} className="h-2" />
              <div className="text-sm mt-1">{score.profile}%</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Knowledge Coverage</div>
              <Progress value={score.knowledge} className="h-2" />
              <div className="text-sm mt-1">{score.knowledge}%</div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded bg-muted/50">
            {isReady ? (
              <p className="text-green-700 dark:text-green-400">
                Your guru is ready for content creation! You can generate teaching artifacts now.
              </p>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">
                More research needed before content creation. Address the critical gaps below.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GT Status */}
      {gtStatus.enabled && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">
              Accuracy Tools Enabled
            </span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
            {gtStatus.engineName} connected with {gtStatus.positionCount} positions
          </p>
        </div>
      )}

      {/* Critical Gaps */}
      {score.criticalGaps.length > 0 && (
        <Card data-tour="critical-gaps" className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-700 dark:text-red-400">
              Critical Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {score.criticalGaps.map(gapKey => {
              const dim = dimensions.find(d => d.dimensionKey === gapKey);
              return (
                <div
                  key={gapKey}
                  className="flex items-center justify-between p-4 rounded border border-red-200 bg-red-50 dark:bg-red-950/30"
                >
                  <div>
                    <div className="font-medium">{dim?.dimensionName || gapKey}</div>
                    <div className="text-sm text-muted-foreground">
                      {dim?.confirmedCount || 0} confirmed items
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/projects/${projectId}/research`}>
                      Research This
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Dimension Coverage */}
      <Card data-tour="dimension-coverage">
        <CardHeader>
          <CardTitle className="text-lg">Dimension Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dimensions.map(dim => (
            <div key={dim.dimensionKey} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{dim.dimensionName}</span>
                  {dim.isCritical && (
                    <Badge variant="destructive" className="text-xs">Critical</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {dim.confirmedCount} / {dim.itemCount} ({dim.coveragePercent}%)
                </span>
              </div>
              <Progress value={dim.coveragePercent} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/research`}>
              Add More Research
            </Link>
          </Button>
          <Button
            data-tour="reassess-button"
            variant="outline"
            onClick={handleReassess}
            disabled={reassessing}
          >
            {reassessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Re-assessing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-assess Readiness
              </>
            )}
          </Button>
        </div>
        <Button asChild disabled={!isReady}>
          <Link href={`/projects/${projectId}/artifacts/teaching`}>
            Continue to Content Creation
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-8">
          <div className="h-8 bg-muted rounded animate-pulse mb-4" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
