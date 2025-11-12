import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { RecommendationsView } from './RecommendationsView';
import { ResearchFindingsView } from '@/components/research/ResearchFindingsView';
import { parseResearchData } from '@/lib/validation';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default async function ResearchRunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id: projectId, runId } = await params;

  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      recommendations: {
        orderBy: { priority: 'asc' },
      },
    },
  });

  if (!run || run.projectId !== projectId) {
    notFound();
  }

  const statusColors = {
    PENDING: 'bg-gray-100 text-gray-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2 text-sm">
          <li>
            <Link href="/projects" className="text-gray-500 hover:text-gray-700">
              Projects
            </Link>
          </li>
          <li><span className="text-gray-400">/</span></li>
          <li>
            <Link href={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700">
              {run.project.name}
            </Link>
          </li>
          <li><span className="text-gray-400">/</span></li>
          <li className="text-gray-900">Research Run</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <h1 className="text-2xl font-bold text-gray-900 mr-3">Research Run</h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  statusColors[run.status]
                }`}
              >
                {run.status}
              </span>
            </div>
            <p className="text-gray-600">{run.instructions}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-500">Depth</p>
            <p className="text-lg font-semibold capitalize">{run.depth.toLowerCase()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-lg font-semibold">{new Date(run.createdAt).toLocaleDateString()}</p>
          </div>
          {run.executionTime && (
            <div>
              <p className="text-sm text-gray-500">Execution Time</p>
              <p className="text-lg font-semibold">{(run.executionTime / 1000).toFixed(1)}s</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Recommendations</p>
            <p className="text-lg font-semibold">{run.recommendations.length}</p>
          </div>
        </div>
      </div>

      {/* Research Data */}
      {run.status === 'COMPLETED' && run.researchData && (() => {
        const researchData = parseResearchData(run.researchData);
        if (!researchData) {
          return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                    Unable to Display Research Findings
                  </h3>
                  <p className="text-sm text-yellow-800">
                    The research data appears to be invalid or corrupted. Your recommendations are still available below.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return (
          <ErrorBoundary
            fallback={
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                      Unable to Display Research Findings
                    </h3>
                    <p className="text-sm text-yellow-800">
                      There was an error rendering the research findings. Your recommendations are still available below.
                    </p>
                  </div>
                </div>
              </div>
            }
          >
            <ResearchFindingsView
              researchData={researchData}
              recommendationCount={run.recommendations.length}
            />
          </ErrorBoundary>
        );
      })()}

      {/* No Recommendations Reason */}
      {run.recommendations.length === 0 && run.status === 'COMPLETED' && (() => {
        const researchData = parseResearchData(run.researchData);
        if (researchData?.noRecommendationsReason) {
          return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    No Recommendations Generated
                  </h3>
                  <p className="text-blue-800 text-sm">
                    {researchData.noRecommendationsReason}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Error Message */}
      {run.status === 'FAILED' && run.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{run.errorMessage}</p>
        </div>
      )}

      {/* Running Status */}
      {run.status === 'RUNNING' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <svg className="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <div>
              <p className="text-blue-900 font-medium">Research in progress...</p>
              <p className="text-blue-700 text-sm">This may take several minutes depending on research depth</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {run.recommendations.length > 0 && (
        <RecommendationsView recommendations={run.recommendations} projectId={projectId} runId={runId} />
      )}
    </div>
  );
}
