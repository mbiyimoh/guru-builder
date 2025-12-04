'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ResearchStatusPollerProps {
  runId: string;
  projectId: string;
  initialStatus: string;
}

export default function ResearchStatusPoller({
  runId,
  projectId,
  initialStatus,
}: ResearchStatusPollerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [progressMessage, setProgressMessage] = useState('Research in progress...');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const recommendationPollCount = useRef(0);

  useEffect(() => {
    // Only poll if status is RUNNING
    if (status !== 'RUNNING') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/research-runs/${runId}`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        const newStatus = data.run.status;
        const recommendationCount = data.recommendations?.total || 0;

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
            setProgressMessage('Generating recommendations...');

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

  // Show running state with spinner
  if (status === 'RUNNING') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-center">
          <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div>
            <p className="text-blue-900 font-medium">{progressMessage}</p>
            <p className="text-blue-700 text-sm">
              This may take several minutes. Page will update automatically when complete.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-red-600 text-sm mt-2">{error}</p>
        )}
      </div>
    );
  }

  // Show completion state with button
  if (status === 'COMPLETED') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-900 font-medium">Research completed!</p>
            <p className="text-green-700 text-sm">
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <p className="text-red-900 font-medium">Research failed</p>
        <p className="text-red-700 text-sm">
          Check the error details below for more information.
        </p>
      </div>
    );
  }

  // CANCELLED or other status
  return null;
}
