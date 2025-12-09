'use client';

import { useState } from 'react';
import { ArtifactHeader } from './ArtifactHeader';
import { ArtifactContent } from './ArtifactContent';
import type { ArtifactDetail } from '@/lib/teaching/artifactClient';

interface ArtifactViewerProps {
  artifact: ArtifactDetail;
  projectId: string;
}

export function ArtifactViewer({ artifact, projectId }: ArtifactViewerProps) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <ArtifactHeader
        artifact={artifact}
        projectId={projectId}
        showJson={showJson}
        onToggleJson={() => setShowJson(!showJson)}
      />
      <div className="flex-1 overflow-hidden">
        <ArtifactContent
          content={artifact.content}
          markdownContent={artifact.markdownContent}
          showJson={showJson}
        />
      </div>
    </div>
  );
}
