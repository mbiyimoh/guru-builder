'use client';

import { useMemo } from 'react';
import type { ArtifactDetail } from '@/lib/teaching/artifactClient';
import { MentalModelRenderer, generateMentalModelTOC } from './MentalModelRenderer';
import { CurriculumRenderer, generateCurriculumTOC } from './CurriculumRenderer';
import { DrillSeriesRenderer, generateDrillSeriesToc } from './DrillSeriesRenderer';
import {
  PhaseOrganizedDrillRenderer,
  generatePhaseOrganizedDrillTOC,
} from './PhaseOrganizedDrillRenderer';
import { TableOfContents } from '../TableOfContents';
import { useActiveSection } from '@/lib/teaching/hooks/useActiveSection';
import type { TOCItem } from '@/lib/teaching/types/toc';
import type { MentalModelOutput } from '@/lib/guruFunctions/schemas/mentalModelSchema';
import type { CurriculumOutput } from '@/lib/guruFunctions/schemas/curriculumSchema';
import type { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema';
import type { PhaseOrganizedDrillSeries } from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema';

interface TypeSpecificRendererProps {
  artifact: ArtifactDetail;
  /** Project ID for position attribution in phase-organized drills */
  projectId?: string;
  onDeleteDrill?: (drillId: string) => void;
  className?: string;
}

/**
 * Check if drill series content is phase-organized (new format) vs legacy (series-based).
 * Phase-organized format has a 'phases' array, legacy has 'series' array.
 */
function isPhaseOrganizedDrillSeries(content: unknown): content is PhaseOrganizedDrillSeries {
  return (
    typeof content === 'object' &&
    content !== null &&
    'phases' in content &&
    Array.isArray((content as { phases: unknown }).phases)
  );
}

export function TypeSpecificRenderer({
  artifact,
  projectId,
  onDeleteDrill,
  className,
}: TypeSpecificRendererProps) {
  // Determine if drill series is phase-organized (new) or legacy format
  const isPhaseOrganized =
    artifact.type === 'DRILL_SERIES' && isPhaseOrganizedDrillSeries(artifact.content);

  // Generate TOC based on artifact type
  const tocItems = useMemo<TOCItem[]>(() => {
    switch (artifact.type) {
      case 'MENTAL_MODEL':
        return generateMentalModelTOC(artifact.content as MentalModelOutput);
      case 'CURRICULUM':
        return generateCurriculumTOC(artifact.content as CurriculumOutput);
      case 'DRILL_SERIES':
        // Use appropriate TOC generator based on format
        if (isPhaseOrganizedDrillSeries(artifact.content)) {
          return generatePhaseOrganizedDrillTOC(artifact.content);
        }
        return generateDrillSeriesToc(artifact.content as DrillSeriesOutput);
      default:
        return [];
    }
  }, [artifact.type, artifact.content]);

  // Extract all section IDs for scroll tracking
  const sectionIds = useMemo(() => {
    const ids: string[] = [];
    function extractIds(items: TOCItem[]) {
      items.forEach((item) => {
        ids.push(item.id);
        if (item.children) extractIds(item.children);
      });
    }
    extractIds(tocItems);
    return ids;
  }, [tocItems]);

  const activeId = useActiveSection(sectionIds);

  // Handle empty/invalid content
  if (!artifact.content) {
    return (
      <div className={`flex items-center justify-center ${className || ''}`} data-testid="type-specific-renderer">
        <div className="p-8 text-center text-gray-500">
          <p>No content available for this artifact.</p>
          <p className="text-sm mt-2">Try regenerating the artifact.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${className || ''}`} data-testid="type-specific-renderer">
      {/* Table of Contents */}
      <TableOfContents items={tocItems} activeId={activeId} />

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-y-auto" id="artifact-content-scroll">
        {artifact.type === 'MENTAL_MODEL' && (
          <MentalModelRenderer content={artifact.content as MentalModelOutput} />
        )}
        {artifact.type === 'CURRICULUM' && (
          <CurriculumRenderer content={artifact.content as CurriculumOutput} />
        )}
        {artifact.type === 'DRILL_SERIES' && isPhaseOrganized && (
          <PhaseOrganizedDrillRenderer
            content={artifact.content as PhaseOrganizedDrillSeries}
            projectId={projectId}
            onDeleteDrill={onDeleteDrill}
          />
        )}
        {artifact.type === 'DRILL_SERIES' && !isPhaseOrganized && (
          <DrillSeriesRenderer content={artifact.content as DrillSeriesOutput} />
        )}
      </div>
    </div>
  );
}
