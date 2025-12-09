'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GuruArtifactType, ArtifactStatus } from '@prisma/client';
import { ARTIFACT_TYPE_CONFIG } from '@/lib/teaching/constants';
import type { PromptInfo } from '@/lib/teaching/types';

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
  // Prompt integration
  promptInfo?: PromptInfo;
  onEditPrompts?: () => void;
}

export function ArtifactHeader({
  artifact,
  projectId,
  showJson,
  onToggleJson,
  showDiff,
  canShowDiff,
  children,
  promptInfo,
  onEditPrompts,
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

          {/* Prompt indicator badges */}
          {promptInfo && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Custom/Default badge */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  promptInfo.isCustom
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
                title={
                  promptInfo.isCustom
                    ? 'This artifact was generated using customized prompts'
                    : 'This artifact was generated using default prompts'
                }
              >
                {promptInfo.isCustom ? 'Custom Prompts' : 'Default Prompts'}
              </span>

              {/* Drift warning badge */}
              {promptInfo.hasPromptDrift && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                  title="Project prompts have changed since this was generated. Regenerate to use current prompts."
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Prompts Changed
                </span>
              )}
            </div>
          )}
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

          {/* Edit prompts button */}
          {onEditPrompts && (
            <button
              onClick={onEditPrompts}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              title="View or edit the prompts used to generate this content"
              data-testid="edit-prompts-button"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              View/Edit Prompts
            </button>
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
