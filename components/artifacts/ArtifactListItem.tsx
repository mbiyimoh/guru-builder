'use client';

import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ArtifactSummary } from '@/lib/teaching/artifactClient';

interface ArtifactTypeConfig {
  key: 'mental-model' | 'curriculum' | 'drill-series';
  label: string;
  icon: LucideIcon;
  apiKey: 'mentalModel' | 'curriculum' | 'drillSeries';
  description: string;
}

interface Props {
  type: ArtifactTypeConfig;
  artifact: ArtifactSummary | null;
  isSelected: boolean;
  isGenerating: boolean;
  onClick: () => void;
}

export function ArtifactListItem({
  type,
  artifact,
  isSelected,
  isGenerating,
  onClick,
}: Props) {
  const hasArtifact = !!artifact;
  const Icon = type.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-lg text-left transition-colors
        ${isSelected
          ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 border'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }
      `}
      data-testid={`artifact-item-${type.key}`}
    >
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${hasArtifact
            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
          }
        `}>
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{type.label}</span>
            {isGenerating ? (
              <Badge variant="secondary" className="text-xs">Generating...</Badge>
            ) : hasArtifact ? (
              <Badge variant="default" className="text-xs">v{artifact.version}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Not Generated</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {type.description}
          </p>
        </div>
      </div>
    </button>
  );
}
