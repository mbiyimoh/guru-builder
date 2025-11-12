import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { parseSnapshotLayersData, parseSnapshotFilesData, parseChangeLogValue } from '@/lib/validation';

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ snapshotId: string }>;
}) {
  const { snapshotId } = await params;

  const snapshot = await prisma.corpusSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      applyChangesLogs: {
        include: {
          recommendation: {
            select: {
              id: true,
              action: true,
              title: true,
              targetType: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!snapshot) {
    notFound();
  }

  const changeTypeColors = {
    ADD: 'bg-green-100 text-green-800',
    EDIT: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
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
            <Link href={`/projects/${snapshot.projectId}`} className="text-gray-500 hover:text-gray-700">
              {snapshot.project.name}
            </Link>
          </li>
          <li><span className="text-gray-400">/</span></li>
          <li>
            <Link href={`/projects/${snapshot.projectId}/snapshots`} className="text-gray-500 hover:text-gray-700">
              Snapshots
            </Link>
          </li>
          <li><span className="text-gray-400">/</span></li>
          <li className="text-gray-900">Details</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{snapshot.name}</h1>
        {snapshot.description && (
          <p className="text-gray-600 mb-4">{snapshot.description}</p>
        )}
        <div className="flex gap-6 text-sm text-gray-500">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Created {new Date(snapshot.createdAt).toLocaleString()}
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {snapshot.applyChangesLogs.length} changes applied
          </div>
        </div>
      </div>

      {/* Changes Log */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Applied Changes</h2>
        </div>

        {snapshot.applyChangesLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No changes recorded
          </div>
        ) : (
          <div className="divide-y">
            {snapshot.applyChangesLogs.map((log) => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        changeTypeColors[log.changeType as keyof typeof changeTypeColors]
                      }`}
                    >
                      {log.changeType}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {log.targetType === 'LAYER' ? 'Context Layer' : 'Knowledge File'}
                      </span>
                      {log.recommendation && (
                        <span className="text-sm text-gray-500">
                          from recommendation: {log.recommendation.title}
                        </span>
                      )}
                    </div>

                    {log.changeType === 'ADD' && log.newValue && (() => {
                      const newValue = parseChangeLogValue(log.newValue);
                      if (!newValue) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <p className="text-sm text-yellow-800">Unable to display change data - data may be corrupted</p>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-green-50 p-3 rounded-md">
                          <p className="text-sm font-medium text-green-900 mb-1">Added:</p>
                          <pre className="text-xs text-green-800 whitespace-pre-wrap">
                            {JSON.stringify(newValue, null, 2)}
                          </pre>
                        </div>
                      );
                    })()}

                    {log.changeType === 'EDIT' && (() => {
                      const previousValue = parseChangeLogValue(log.previousValue);
                      const newValue = parseChangeLogValue(log.newValue);

                      if (!previousValue && !newValue) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <p className="text-sm text-yellow-800">Unable to display change data - data may be corrupted</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {previousValue && (
                            <div className="bg-red-50 p-3 rounded-md">
                              <p className="text-sm font-medium text-red-900 mb-1">Before:</p>
                              <pre className="text-xs text-red-800 whitespace-pre-wrap">
                                {JSON.stringify(previousValue, null, 2)}
                              </pre>
                            </div>
                          )}
                          {newValue && (
                            <div className="bg-green-50 p-3 rounded-md">
                              <p className="text-sm font-medium text-green-900 mb-1">After:</p>
                              <pre className="text-xs text-green-800 whitespace-pre-wrap">
                                {JSON.stringify(newValue, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {log.changeType === 'DELETE' && log.previousValue && (() => {
                      const previousValue = parseChangeLogValue(log.previousValue);
                      if (!previousValue) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <p className="text-sm text-yellow-800">Unable to display change data - data may be corrupted</p>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-red-50 p-3 rounded-md">
                          <p className="text-sm font-medium text-red-900 mb-1">Deleted:</p>
                          <pre className="text-xs text-red-800 whitespace-pre-wrap">
                            {JSON.stringify(previousValue, null, 2)}
                          </pre>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot Data (collapsed by default) */}
      <details className="mt-6 bg-white rounded-lg border">
        <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-900 hover:bg-gray-50">
          Full Snapshot Data (Before Changes)
        </summary>
        <div className="px-6 py-4 border-t">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Context Layers</h3>
              {(() => {
                const layersData = parseSnapshotLayersData(snapshot.layersData);
                if (!layersData) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Unable to display snapshot layers data - data may be corrupted
                      </p>
                    </div>
                  );
                }
                return (
                  <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                    {JSON.stringify(layersData, null, 2)}
                  </pre>
                );
              })()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Knowledge Files</h3>
              {(() => {
                const filesData = parseSnapshotFilesData(snapshot.filesData);
                if (!filesData) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Unable to display snapshot files data - data may be corrupted
                      </p>
                    </div>
                  );
                }
                return (
                  <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                    {JSON.stringify(filesData, null, 2)}
                  </pre>
                );
              })()}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
