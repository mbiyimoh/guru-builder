// components/artifacts/ReadinessWarning.tsx
'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  projectId: string;
  score: number;
}

export function ReadinessWarning({ projectId, score }: Props) {
  return (
    <div className="mx-6 mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800" data-testid="readiness-warning">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-amber-800 dark:text-amber-200">
            Low Readiness Score ({score}%)
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Your project's readiness score is below 60%. Generated artifacts may lack depth.
            Consider adding more research before generating.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/readiness`}>
                View Readiness Details
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
