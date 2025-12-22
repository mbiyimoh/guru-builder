'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArtifactDetail, ArtifactSummary } from '@/lib/teaching/artifactClient';
import { ArtifactHeader } from './ArtifactHeader';
import DiffContent from './DiffContent';
import { ViewModeToggle, ViewMode } from './ViewModeToggle';
import { TypeSpecificRenderer } from './renderers/TypeSpecificRenderer';
import { PromptEditorModal } from '@/components/guru/PromptEditorModal';
import type { PromptInfo } from '@/lib/teaching/types';

interface ArtifactViewerWithVersionsProps {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  projectId: string;
  showDiff: boolean;
  promptInfo: PromptInfo;
}

export function ArtifactViewerWithVersions({
  artifact,
  previousArtifact,
  allVersions,
  projectId,
  showDiff,
  promptInfo,
}: ArtifactViewerWithVersionsProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  const canShowDiff = artifact.version > 1;

  // Map artifact type to the format expected by PromptEditorModal
  const artifactTypeForModal = artifact.type as 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';

  const handlePromptSave = () => {
    setIsPromptModalOpen(false);
    // Refresh to show updated prompt info
    router.refresh();
  };

  const handlePromptSaveAndRegenerate = () => {
    setIsPromptModalOpen(false);
    // Navigate to project page where regeneration will show
    router.push(`/projects/${projectId}`);
  };

  // Get content as string for diff
  const currentContent = artifact.markdownContent || JSON.stringify(artifact.content, null, 2);
  const previousContent = previousArtifact?.markdownContent ||
    (previousArtifact ? JSON.stringify(previousArtifact.content, null, 2) : null);

  return (
    <div className="flex h-full" data-testid="artifact-viewer-with-versions">
      {/* Main Content Area - Full width now that sidebar is removed */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ArtifactHeader
          artifact={artifact}
          projectId={projectId}
          showDiff={showDiff}
          canShowDiff={canShowDiff}
          promptInfo={promptInfo}
          onEditPrompts={() => setIsPromptModalOpen(true)}
          versions={allVersions}
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

      {/* Prompt Editor Modal */}
      {isPromptModalOpen && (
        <PromptEditorModal
          projectId={projectId}
          artifactType={artifactTypeForModal}
          systemPrompt={promptInfo.currentConfig.systemPrompt}
          userPrompt={promptInfo.currentConfig.userPrompt}
          onClose={() => setIsPromptModalOpen(false)}
          onSave={handlePromptSave}
          onSaveAndRegenerate={handlePromptSaveAndRegenerate}
        />
      )}
    </div>
  );
}
