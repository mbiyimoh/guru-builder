'use client';

/**
 * GTStatusIndicator Component
 *
 * Displays Ground Truth engine status on the dashboard.
 * Only shows when GT is enabled for the project.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface GTStatusIndicatorProps {
  projectId: string;
}

interface GTConfig {
  activeConfig: {
    engine: {
      name: string;
      domain: string;
    };
  } | null;
  positionLibrary: {
    total: number;
  } | null;
}

export function GTStatusIndicator({ projectId }: GTStatusIndicatorProps) {
  const [config, setConfig] = useState<GTConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/ground-truth-config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  // Don't show anything if loading or no GT enabled
  if (loading || !config?.activeConfig) {
    return null;
  }

  const { engine } = config.activeConfig;
  const positionCount = config.positionLibrary?.total || 0;

  return (
    <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                Accuracy Verification Active
              </div>
              <div className="text-sm text-muted-foreground">
                {engine.name} • {positionCount} positions available
              </div>
            </div>
          </div>
          <Link
            href={`/projects/${projectId}/artifacts/teaching`}
            className="text-sm text-green-600 hover:underline"
          >
            View Details →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
