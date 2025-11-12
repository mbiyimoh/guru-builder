'use client';

import { useState } from 'react';
import { FullReportModal } from './FullReportModal';
import type { ResearchFindings } from '@/lib/types';

interface ResearchFindingsViewProps {
  researchData: ResearchFindings;
  recommendationCount: number;
}

export function ResearchFindingsView({ researchData, recommendationCount }: ResearchFindingsViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Calculate preview (first ~400 characters or ~5 lines)
  const PREVIEW_LENGTH = 400;
  const needsTruncation = researchData.summary.length > PREVIEW_LENGTH;
  const previewText = needsTruncation
    ? researchData.summary.substring(0, PREVIEW_LENGTH).trim() + '...'
    : researchData.summary;

  return (
    <>
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Research Summary</h2>

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

        {/* Summary Text */}
        <div className="prose max-w-none mb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
              {isExpanded ? researchData.summary : previewText}
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          {needsTruncation && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {isExpanded ? (
                <>
                  Show less
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  Show more
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Read full report
            <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

        {/* Metadata (optional) */}
        {researchData.sourcesAnalyzed > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              {researchData.sourcesAnalyzed} sources analyzed
            </p>
          </div>
        )}
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
