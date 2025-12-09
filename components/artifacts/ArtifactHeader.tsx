'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GuruArtifactType, ArtifactStatus } from '@prisma/client';
import { ARTIFACT_TYPE_CONFIG } from '@/lib/teaching/constants';

interface ArtifactDetail {
  id: string;
  type: GuruArtifactType;
  version: number;
  generatedAt: string;
  status: ArtifactStatus;
}

interface ArtifactHeaderProps {
  artifact: ArtifactDetail;
  projectId: string;
  showJson?: boolean;
  onToggleJson?: () => void;
  // Phase 2: Diff toggle support
  showDiff?: boolean;
  canShowDiff?: boolean; // false for v1
  // Phase 3: ViewModeToggle slot
  children?: React.ReactNode;
}

export function ArtifactHeader({
  artifact,
  projectId,
  showJson,
  onToggleJson,
  showDiff,
  canShowDiff,
  children,
}: ArtifactHeaderProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleDiffToggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (params.has('diff')) {
      params.delete('diff');
    } else {
      params.set('diff', '');
    }
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : window.location.pathname);
  }

  const config = ARTIFACT_TYPE_CONFIG[artifact.type];

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);

      const response = await fetch(`/api/projects/${projectId}/guru/${config.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate artifact');
      }

      // Navigate back to project page after initiating regeneration
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error regenerating artifact:', error);
      alert('Failed to regenerate artifact. Please try again.');
      setIsRegenerating(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div className="border-b bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 data-testid="artifact-title" className="text-2xl font-bold text-gray-900">
            {config.label}
          </h1>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            v{artifact.version}
          </span>
          <span className="text-sm text-gray-500">
            Generated {formatTimestamp(artifact.generatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Phase 3: ViewModeToggle slot */}
          {children}

          {/* Diff toggle - only show when canShowDiff is explicitly provided */}
          {canShowDiff !== undefined && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showDiff || false}
                onChange={handleDiffToggle}
                disabled={!canShowDiff}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                data-testid="diff-toggle"
              />
              <span className={!canShowDiff ? 'text-gray-400' : ''}>
                Show Diff
              </span>
            </label>
          )}

          {/* Legacy JSON toggle - only show if provided (for backwards compatibility) */}
          {onToggleJson && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showJson || false}
                onChange={onToggleJson}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              />
              Show JSON
            </label>
          )}

          <button
            data-testid="regenerate-button"
            onClick={handleRegenerate}
            disabled={isRegenerating || artifact.status === 'GENERATING'}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400"
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
