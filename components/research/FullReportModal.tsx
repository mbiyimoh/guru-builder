'use client';

import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface FullReportModalProps {
  query: string;
  summary: string;
  fullReport: string;
  sources?: Array<{ url: string; title: string }>;
  sourcesAnalyzed: number;
  onClose: () => void;
}

export function FullReportModal({
  query,
  summary,
  fullReport,
  sources,
  sourcesAnalyzed,
  onClose,
}: FullReportModalProps) {
  const { modalRef, handleKeyDown } = useModalAccessibility({
    onClose,
    isOpen: true,
  });

  return (
    <div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-white">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-4">
              <h2 id="modal-title" className="text-xl font-semibold text-gray-900 mb-2">
                Research Report
              </h2>
              <p className="text-sm text-gray-600">{query}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 flex-shrink-0"
              aria-label="Close modal"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
            </div>
          </div>

          {/* Full Report Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Full Report</h3>
            <div className="prose max-w-none">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                  {fullReport}
                </pre>
              </div>
            </div>
          </div>

          {/* Sources Section */}
          {sources && sources.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Sources ({sourcesAnalyzed} analyzed)
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {sources.map((source, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-gray-500 mr-2">{idx + 1}.</span>
                      <div className="flex-1">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                          title={source.url}
                        >
                          {source.title || source.url}
                        </a>
                        {source.title && (
                          <div className="text-xs text-gray-500 mt-1 break-all">
                            {source.url}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : sourcesAnalyzed > 0 ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Sources ({sourcesAnalyzed} analyzed)
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-600 text-sm">
                  Source information not available, but {sourcesAnalyzed} sources were analyzed during research.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
