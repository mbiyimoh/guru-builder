'use client';

import { useState } from 'react';
import { ArtifactDetail, ArtifactSummary } from '@/lib/teaching/artifactClient';
import { getArtifactSlug } from '@/lib/teaching/constants';
import { ArtifactHeader } from './ArtifactHeader';
import VersionHistoryPanel from './VersionHistoryPanel';
import DiffContent from './DiffContent';
import { ViewModeToggle, ViewMode } from './ViewModeToggle';
import { TypeSpecificRenderer } from './renderers/TypeSpecificRenderer';

interface ArtifactViewerWithVersionsProps {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  projectId: string;
  showDiff: boolean;
}

export function ArtifactViewerWithVersions({
  artifact,
  previousArtifact,
  allVersions,
  projectId,
  showDiff,
}: ArtifactViewerWithVersionsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');

  const artifactSlug = getArtifactSlug(artifact.type);
  const canShowDiff = artifact.version > 1;

  // Get content as string for diff
  const currentContent = artifact.markdownContent || JSON.stringify(artifact.content, null, 2);
  const previousContent = previousArtifact?.markdownContent ||
    (previousArtifact ? JSON.stringify(previousArtifact.content, null, 2) : null);

  return (
    <div className="flex h-full" data-testid="artifact-viewer-with-versions">
      {/* Version History Panel */}
      <VersionHistoryPanel
        projectId={projectId}
        artifactType={artifactSlug}
        versions={allVersions}
        currentVersion={artifact.version}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ArtifactHeader
          artifact={artifact}
          projectId={projectId}
          showDiff={showDiff}
          canShowDiff={canShowDiff}
        >
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </ArtifactHeader>

        <div className="flex-1 overflow-hidden">
          {viewMode === 'json' && (
            <div className="h-full p-4 overflow-auto">
              <pre className="bg-gray-100 p-4 rounded-lg text-sm">
                {JSON.stringify(artifact.content, null, 2)}
              </pre>
            </div>
          )}
          {viewMode === 'markdown' && (
            <div className="h-full p-4 overflow-auto">
              <DiffContent
                currentContent={currentContent}
                previousContent={previousContent}
                showDiff={showDiff && canShowDiff}
              />
            </div>
          )}
          {viewMode === 'rendered' && (
            <TypeSpecificRenderer
              artifact={artifact}
              className="h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
