'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { PROGRESS_STAGES } from '@/lib/assessment/constants';
import { ResearchProgressTracker } from '@/components/research/ResearchProgressTracker';
import { Button } from '@/components/ui/button';

interface ResearchStatusPollerProps {
  runId: string;
  projectId: string;
  initialStatus: string;
  initialProgressStage?: string | null;
}

export default function ResearchStatusPoller({
  runId,
  projectId,
  initialStatus,
  initialProgressStage,
}: ResearchStatusPollerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [progressStage, setProgressStage] = useState(initialProgressStage || PROGRESS_STAGES.STARTING);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const router = useRouter();
  const recommendationPollCount = useRef(0);

  // Handle cancellation
  const handleCancel = useCallback(async () => {
    setIsCancelling(true);

    try {
      const res = await fetch(`/api/research-runs/${runId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to cancel');
      }

      // Success - polling will detect CANCELLED status or we can just refresh
      setStatus('CANCELLED');
      router.refresh();
    } catch (err) {
      setIsCancelling(false);
      setError(err instanceof Error ? err.message : 'Failed to cancel research');
    }
  }, [runId, router]);

  useEffect(() => {
    // Only poll if status is RUNNING
    if (status !== 'RUNNING') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/research-runs/${runId}`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        const newStatus = data.run.status;
        const newProgressStage = data.run.progressStage;
        const recommendationCount = data.recommendations?.total || 0;

        // Update progress stage if available
        if (newProgressStage) {
          setProgressStage(newProgressStage);
        }

        if (newStatus === 'RUNNING') {
          // Still running, keep polling
          return;
        }

        if (newStatus === 'COMPLETED') {
          // Research completed, but wait for recommendations to be generated
          // The recommendation generation job runs AFTER research completes
          if (recommendationCount > 0) {
            // Recommendations are ready - refresh page
            setStatus(newStatus);
            clearInterval(pollInterval);
            router.refresh();
          } else {
            // Recommendations not ready yet - keep polling
            recommendationPollCount.current += 1;
            setProgressStage('Generating recommendations...');

            // Timeout after 60 seconds (12 polls at 5s interval)
            if (recommendationPollCount.current >= 12) {
              console.log('Recommendation generation timeout - refreshing anyway');
              setStatus(newStatus);
              clearInterval(pollInterval);
              router.refresh();
            }
          }
        } else {
          // FAILED or CANCELLED - stop polling immediately
          setStatus(newStatus);
          clearInterval(pollInterval);
          router.refresh();
        }
      } catch (err) {
        setError('Failed to check research status');
        clearInterval(pollInterval);
      }
    }, 5000); // 5 second interval

    return () => clearInterval(pollInterval);
  }, [runId, status, router]);

  // Show running state with visual progress tracker
  if (status === 'RUNNING') {
    return (
      <div className="bg-card border rounded-lg p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div>
              <p className="font-medium">Research in Progress</p>
              <p className="text-muted-foreground text-sm">
                This may take several minutes. Page will update automatically when complete.
              </p>
            </div>
          </div>
          {/* Cancel button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        </div>

        {/* Visual Progress Tracker */}
        <div className="mt-6 px-4">
          <ResearchProgressTracker currentStage={progressStage} />
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-4">{error}</p>
        )}
      </div>
    );
  }

  // Show completion state with button
  if (status === 'COMPLETED') {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-900 dark:text-green-100 font-medium">Research completed!</p>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Review the findings and recommendations below.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/research/${runId}#recommendations`}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            View Results
          </Link>
        </div>
      </div>
    );
  }

  // Show failure state
  if (status === 'FAILED') {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-6 mb-6">
        <p className="text-red-900 dark:text-red-100 font-medium">Research failed</p>
        <p className="text-red-700 dark:text-red-300 text-sm">
          Check the error details below for more information.
        </p>
      </div>
    );
  }

  // Show cancelled state
  if (status === 'CANCELLED') {
    return (
      <div className="bg-muted border rounded-lg p-6 mb-6">
        <p className="font-medium">Research cancelled</p>
        <p className="text-muted-foreground text-sm">
          This research run was cancelled. You can start a new research run.
        </p>
      </div>
    );
  }

  // Other status
  return null;
}
