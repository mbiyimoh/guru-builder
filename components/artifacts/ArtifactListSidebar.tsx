'use client';

import { Brain, BookOpen, Target } from 'lucide-react';
import { ArtifactListItem } from './ArtifactListItem';
import type { ArtifactSummariesResponse } from '@/lib/teaching/artifactClient';

interface Props {
  artifacts: ArtifactSummariesResponse;
  selectedType: string | null;
  onSelect: (type: 'mental-model' | 'curriculum' | 'drill-series') => void;
  generating: string | null;
}

const ARTIFACT_TYPES = [
  {
    key: 'mental-model' as const,
    label: 'Mental Model',
    icon: Brain,
    apiKey: 'mentalModel' as const,
    description: 'Core concepts and principles',
  },
  {
    key: 'curriculum' as const,
    label: 'Curriculum',
    icon: BookOpen,
    apiKey: 'curriculum' as const,
    description: 'Structured learning path',
  },
  {
    key: 'drill-series' as const,
    label: 'Drill Series',
    icon: Target,
    apiKey: 'drillSeries' as const,
    description: 'Practice exercises',
  },
];

export function ArtifactListSidebar({
  artifacts,
  selectedType,
  onSelect,
  generating
}: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900" data-testid="artifact-list-sidebar">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Teaching Artifacts</h2>
        <p className="text-sm text-muted-foreground">
          {artifacts.counts.total} artifact{artifacts.counts.total !== 1 ? 's' : ''} generated
        </p>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {ARTIFACT_TYPES.map((type) => {
          const artifact = artifacts.latest[type.apiKey];
          const isGenerating = generating === type.key;

          return (
            <ArtifactListItem
              key={type.key}
              type={type}
              artifact={artifact}
              isSelected={selectedType === type.key}
              isGenerating={isGenerating}
              onClick={() => onSelect(type.key)}
            />
          );
        })}
      </div>
    </div>
  );
}
