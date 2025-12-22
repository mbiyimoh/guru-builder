'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ProjectPageErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  pageName: string;
  errorContext?: string;
}

export function ProjectPageError({
  error,
  reset,
  pageName,
  errorContext = "We encountered an error while loading this page. This might be a temporary issue with the database connection."
}: ProjectPageErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error(`[${pageName} Page Error]`, error);
  }, [error, pageName]);

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="max-w-md rounded-lg bg-white p-8 shadow-lg border">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Failed to Load {pageName}
            </h2>
          </div>

          <p className="mb-6 text-sm text-gray-600">
            {errorContext}
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => reset()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={() => router.back()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>

          {error.digest && (
            <p className="mt-4 text-xs text-gray-400">
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
