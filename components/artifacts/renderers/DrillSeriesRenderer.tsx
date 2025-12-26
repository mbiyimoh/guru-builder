'use client';

import type { DrillSeriesOutput } from '@/lib/guruFunctions/schemas/drillSeriesSchema';
import { DrillCard } from './cards/DrillCard';
import type { TOCItem } from '@/lib/teaching/types/toc';

interface DrillSeriesRendererProps {
  content: DrillSeriesOutput;
  className?: string;
}

export function DrillSeriesRenderer({ content, className }: DrillSeriesRendererProps) {
  // Guard against incomplete content (during generation or on error)
  if (!content || !content.series || !Array.isArray(content.series)) {
    return (
      <div className={className} data-testid="drill-series-renderer">
        <div className="p-8 text-center text-gray-500">
          <p>Content is being generated...</p>
          <p className="text-sm mt-2">This usually takes 30-60 seconds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="drill-series-renderer">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.drillSeriesTitle}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            <strong>{content.totalDrills}</strong> drills
          </span>
          <span>
            ~<strong>{content.estimatedCompletionMinutes}</strong> min total
          </span>
        </div>
        {content.targetPrinciples.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {content.targetPrinciples.map((principle, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
              >
                {principle}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Design Thoughts */}
      {content.designThoughts && (
        <section id="design-thoughts" className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h2 className="text-lg font-semibold text-amber-800 mb-3">
            Design Thoughts
          </h2>
          <div className="space-y-2 text-sm">
            <p>
              <strong className="text-amber-700">Methodology Rationale:</strong>{' '}
              <span className="text-gray-700">{content.designThoughts.methodologyRationale}</span>
            </p>
            <p>
              <strong className="text-amber-700">Variety Analysis:</strong>{' '}
              <span className="text-gray-700">{content.designThoughts.varietyAnalysis}</span>
            </p>
            <p>
              <strong className="text-amber-700">Pedagogical Notes:</strong>{' '}
              <span className="text-gray-700">{content.designThoughts.pedagogicalNotes}</span>
            </p>
            {content.designThoughts.distinctiveElements && (
              <p>
                <strong className="text-amber-700">Distinctive Elements:</strong>{' '}
                <span className="text-gray-700">{content.designThoughts.distinctiveElements}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Series */}
      {content.series.map((series) => (
        <section
          key={series.seriesId}
          id={`series-${series.seriesId}`}
          className="mb-12"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white bg-blue-700 px-4 py-3 rounded-r-lg border-l-8 border-blue-900 -ml-4">
              {series.principleName}
            </h2>
            <p className="text-gray-600 mt-2 px-4">{series.seriesDescription}</p>
          </div>

          {/* Drills */}
          <div className="space-y-4 px-4">
            {series.drills.map((drill, index) => (
              <DrillCard
                key={drill.drillId}
                id={`drill-${drill.drillId}`}
                drill={drill}
                drillNumber={index + 1}
                totalDrills={series.drills.length}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Practice Sequences */}
      {content.practiceSequences && content.practiceSequences.length > 0 && (
        <section
          id="practice-sequences"
          className="p-4 bg-purple-50 border border-purple-200 rounded-lg"
        >
          <h2 className="text-lg font-semibold text-purple-800 mb-3">
            Practice Sequences
          </h2>
          <div className="space-y-3">
            {content.practiceSequences.map((seq, i) => (
              <div key={i} className="bg-white p-3 rounded border border-purple-100">
                <h3 className="font-medium text-purple-700">{seq.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{seq.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Drills: {seq.drillIds.join(' → ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Generate TOC items for drill series
 * Returns empty array if content is null/undefined or incomplete (mid-generation)
 */
export function generateDrillSeriesToc(content: DrillSeriesOutput | null | undefined): TOCItem[] {
  // Guard against null/undefined content (happens during generation or on error)
  if (!content || !content.series) {
    return [];
  }

  const items: TOCItem[] = [];

  // Add Design Thoughts to TOC if present
  if (content.designThoughts) {
    items.push({ id: 'design-thoughts', label: 'Design Thoughts', level: 1 });
  }

  content.series.forEach((s) => {
    items.push({
      id: `series-${s.seriesId}`,
      label: s.principleName,
      level: 1,
      children: s.drills?.map((d, i) => ({
        id: `drill-${d.drillId}`,
        label: `Drill ${i + 1}`,
        level: 2,
      })) || [],
    });
  });

  if (content.practiceSequences && content.practiceSequences.length > 0) {
    items.push({ id: 'practice-sequences', label: 'Practice Sequences', level: 1 });
  }

  return items;
}
