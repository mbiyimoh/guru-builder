'use client';

import { useState } from 'react';
import { FullReportModal } from './FullReportModal';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText } from 'lucide-react';
import type { ResearchFindings } from '@/lib/types';

interface ResearchFindingsViewProps {
  researchData: ResearchFindings;
  recommendationCount: number;
}

/**
 * Extract key takeaways from a summary text.
 * Tries to find existing bullet points first, falls back to sentences.
 */
function extractKeyTakeaways(summary: string, maxPoints: number = 4): string[] {
  // Handle empty or very short summaries
  if (!summary?.trim() || summary.length < 50) {
    return summary?.trim() ? [summary.trim()] : ['Research completed. See full report for details.'];
  }

  // Try to find existing bullet points (-, •, *, or numbered)
  const bulletMatch = summary.match(/^[\s]*[-•*]\s+.+$/gm);
  if (bulletMatch && bulletMatch.length >= 2) {
    return bulletMatch
      .slice(0, maxPoints)
      .map(b => b.replace(/^[\s]*[-•*]\s+/, '').trim())
      .filter(b => b.length > 0);
  }

  // Try numbered lists (1., 2., etc.)
  const numberedMatch = summary.match(/^[\s]*\d+[.)]\s+.+$/gm);
  if (numberedMatch && numberedMatch.length >= 2) {
    return numberedMatch
      .slice(0, maxPoints)
      .map(b => b.replace(/^[\s]*\d+[.)]\s+/, '').trim())
      .filter(b => b.length > 0);
  }

  // Fall back to extracting sentences
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300) // Filter reasonable length sentences
    .slice(0, maxPoints);

  // If we got sentences, return them
  if (sentences.length >= 2) {
    return sentences;
  }

  // Last resort: split by newlines or return truncated summary
  const lines = summary.split(/\n+/).filter(l => l.trim().length > 20);
  if (lines.length >= 2) {
    return lines.slice(0, maxPoints).map(l => l.trim());
  }

  // Absolute fallback
  return [summary.substring(0, 250) + (summary.length > 250 ? '...' : '')];
}

export function ResearchFindingsView({ researchData, recommendationCount }: ResearchFindingsViewProps) {
  const [showModal, setShowModal] = useState(false);

  const keyTakeaways = extractKeyTakeaways(researchData.summary);

  return (
    <>
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Research Summary</h2>
        </div>

        {/* No Recommendations Warning (if applicable) */}
        {recommendationCount === 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  No Recommendations Generated
                </h3>
                <p className="text-sm text-blue-800">
                  The system analyzed the research findings and determined no changes to the knowledge corpus are needed at this time.
                </p>
                {researchData.noRecommendationsReason && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-sm text-blue-900 font-medium mb-1">Reason:</p>
                    <p className="text-sm text-blue-800">{researchData.noRecommendationsReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Key Takeaways - Bulleted List */}
        <div className="mb-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Key Findings</h3>
          <ul className="space-y-2.5">
            {keyTakeaways.map((point, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sources Count */}
        {researchData.sourcesAnalyzed > 0 && (
          <p className="text-sm text-gray-500 mb-4">
            Based on {researchData.sourcesAnalyzed} sources analyzed
          </p>
        )}

        {/* Read Full Report CTA */}
        <Button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Read full report
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Full Report Modal */}
      {showModal && (
        <FullReportModal
          query={researchData.query}
          summary={researchData.summary}
          fullReport={researchData.fullReport}
          sources={researchData.sources}
          sourcesAnalyzed={researchData.sourcesAnalyzed}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
