'use client';

import { useState, useEffect, useCallback } from 'react';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface PromptEngineerModalProps {
  roughInstructions: string;
  onClose: () => void;
  onApply: (refinedPrompt: string) => void;
}

export function PromptEngineerModal({
  roughInstructions,
  onClose,
  onApply,
}: PromptEngineerModalProps) {
  const [refinedPrompt, setRefinedPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { modalRef, handleKeyDown } = useModalAccessibility({
    onClose,
    isOpen: true,
  });

  // Fetch refined prompt with abort support
  const fetchRefinedPrompt = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/prompt-engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roughInstructions }),
        signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 429) {
          throw new Error(`Rate limited. Please wait ${errorData.retryAfter || 60} seconds.`);
        }
        throw new Error(errorData.message || errorData.error || 'Failed to engineer prompt');
      }

      const data = await res.json();
      setRefinedPrompt(data.refinedPrompt);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }
      console.error('Failed to engineer prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to engineer prompt');
    } finally {
      setIsLoading(false);
    }
  }, [roughInstructions]);

  // Fetch on mount with cleanup
  useEffect(() => {
    const abortController = new AbortController();
    fetchRefinedPrompt(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchRefinedPrompt]);

  function handleApply() {
    onApply(refinedPrompt);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-engineer-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-white">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-4">
              <h2
                id="prompt-engineer-title"
                className="text-xl font-semibold text-gray-900 mb-2"
              >
                Prompt Engineer
              </h2>
              <p className="text-sm text-gray-600">
                Your research instructions have been refined into a more structured, actionable format.
              </p>
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
        <div className="p-6 space-y-4">
          {/* Original Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Original Input
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{roughInstructions}</p>
            </div>
          </div>

          {/* Refined Output */}
          <div>
            <label htmlFor="refined-prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Refined Research Instructions
            </label>

            {isLoading ? (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-8 flex flex-col items-center justify-center">
                <svg
                  className="animate-spin h-8 w-8 text-blue-600 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-blue-700 font-medium">Engineering your prompt...</p>
                <p className="text-blue-600 text-sm mt-1">
                  Transforming your idea into structured research instructions
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800">Error engineering prompt</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    <button
                      onClick={() => fetchRefinedPrompt()}
                      className="mt-3 text-sm font-medium text-red-800 hover:text-red-900 underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  id="refined-prompt"
                  value={refinedPrompt}
                  onChange={(e) => setRefinedPrompt(e.target.value)}
                  rows={20}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Refined prompt will appear here..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  {refinedPrompt.length} characters - Feel free to edit before applying
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isLoading || !!error || !refinedPrompt.trim()}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Use This Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
