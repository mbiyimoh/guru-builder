'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      projectId,
      instructions: formData.get('instructions') as string,
      depth: formData.get('depth') as string,
    };

    try {
      const res = await fetch('/api/research-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create research run');
      }

      const result = await res.json();
      router.push(`/projects/${projectId}/research/${result.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/projects/${projectId}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Project
      </Link>

      <div className="mt-4 bg-white rounded-lg border p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Start New Research</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
              Research Instructions
            </label>
            <textarea
              id="instructions"
              name="instructions"
              rows={6}
              required
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="What would you like to research? Be specific about what you want to learn..."
            />
            <p className="mt-2 text-sm text-gray-500">
              Example: "Research advanced backgammon opening strategies for modern tournament play"
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Research Depth
            </label>
            <div className="space-y-3">
              <label className="flex items-start p-4 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="depth"
                  value="QUICK"
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">Quick (1-2 minutes)</span>
                  <span className="block text-sm text-gray-500">~5 sources, fast overview</span>
                </div>
              </label>

              <label className="flex items-start p-4 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="depth"
                  value="MODERATE"
                  defaultChecked
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">Moderate (3-5 minutes)</span>
                  <span className="block text-sm text-gray-500">~10 sources, balanced depth</span>
                </div>
              </label>

              <label className="flex items-start p-4 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="depth"
                  value="DEEP"
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">Deep (5-10 minutes)</span>
                  <span className="block text-sm text-gray-500">~20 sources, comprehensive analysis</span>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Starting Research...' : 'Start Research'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
