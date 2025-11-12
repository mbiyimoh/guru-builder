'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NewResearchFormProps {
  projectId: string;
  projectName: string;
}

export function NewResearchForm({ projectId, projectName }: NewResearchFormProps) {
  const router = useRouter();
  const [instructions, setInstructions] = useState('');
  const [depth, setDepth] = useState<'QUICK' | 'MODERATE' | 'DEEP'>('MODERATE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/research-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          instructions,
          depth,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start research');
      }

      const data = await res.json();

      // Redirect to project page to see the research run
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (err) {
      console.error('Failed to start research:', err);
      setError(err instanceof Error ? err.message : 'Failed to start research');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          {/* Instructions */}
          <div>
            <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
              Research Instructions *
            </label>
            <p className="mt-1 text-sm text-gray-500">
              Describe what you want to research. Be specific about the topic, scope, and any particular aspects you're interested in.
            </p>
            <textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              required
              rows={6}
              className="mt-2 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Example: Research best practices for teaching backgammon to absolute beginners, focusing on opening moves, basic strategy, and common mistakes to avoid."
            />
            <p className="mt-1 text-xs text-gray-500">
              {instructions.length} characters
            </p>
          </div>

          {/* Research Depth */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Research Depth *
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setDepth('QUICK')}
                className={`relative rounded-lg border px-4 py-3 flex flex-col items-start hover:border-blue-400 ${
                  depth === 'QUICK'
                    ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center w-full">
                  <div className={`flex-shrink-0 ${depth === 'QUICK' ? 'text-blue-600' : 'text-gray-400'}`}>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-900">Quick</span>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-left">
                  ~2-3 minutes, fewer sources, good for quick insights
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDepth('MODERATE')}
                className={`relative rounded-lg border px-4 py-3 flex flex-col items-start hover:border-blue-400 ${
                  depth === 'MODERATE'
                    ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center w-full">
                  <div className={`flex-shrink-0 ${depth === 'MODERATE' ? 'text-blue-600' : 'text-gray-400'}`}>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-900">Moderate</span>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-left">
                  ~5-7 minutes, balanced depth, recommended for most research
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDepth('DEEP')}
                className={`relative rounded-lg border px-4 py-3 flex flex-col items-start hover:border-blue-400 ${
                  depth === 'DEEP'
                    ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center w-full">
                  <div className={`flex-shrink-0 ${depth === 'DEEP' ? 'text-blue-600' : 'text-gray-400'}`}>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-900">Deep</span>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-left">
                  ~10-15 minutes, comprehensive, maximum sources & depth
                </p>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error starting research</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">How research works</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>GPT Researcher will search the web and analyze relevant sources</li>
                    <li>A comprehensive report will be generated with citations</li>
                    <li>The system will then generate actionable recommendations</li>
                    <li>You can review and apply recommendations to your knowledge base</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !instructions.trim()}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Starting Research...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Start Research
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
