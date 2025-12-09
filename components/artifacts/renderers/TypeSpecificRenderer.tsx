'use client';

import { useMemo } from 'react';
import type { ArtifactDetail } from '@/lib/teaching/artifactClient';
import { MentalModelRenderer, generateMentalModelTOC } from './MentalModelRenderer';
import { CurriculumRenderer, generateCurriculumTOC } from './CurriculumRenderer';
import { DrillSeriesRenderer, generateDrillSeriesToc } from './DrillSeriesRenderer';
import { TableOfContents } from '../TableOfContents';
import { useActiveSection } from '@/lib/teaching/hooks/useActiveSection';
import type { TOCItem } from '@/lib/teaching/types/toc';
import type { MentalModelOutput } from '@/lib/guruFunctions/schemas/mentalModelSchema';
import type { CurriculumOutput } from '@/lib/guruFunctions/schemas/curriculumSchema';
import type { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema';

interface TypeSpecificRendererProps {
  artifact: ArtifactDetail;
  className?: string;
}

export function TypeSpecificRenderer({ artifact, className }: TypeSpecificRendererProps) {
  // Generate TOC based on artifact type
  const tocItems = useMemo<TOCItem[]>(() => {
    switch (artifact.type) {
      case 'MENTAL_MODEL':
        return generateMentalModelTOC(artifact.content as MentalModelOutput);
      case 'CURRICULUM':
        return generateCurriculumTOC(artifact.content as CurriculumOutput);
      case 'DRILL_SERIES':
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
        {artifact.type === 'DRILL_SERIES' && (
          <DrillSeriesRenderer content={artifact.content as DrillSeriesOutput} />
        )}
      </div>
    </div>
  );
}
