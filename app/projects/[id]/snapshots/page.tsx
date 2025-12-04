import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function SnapshotsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, userId: true },
  });

  if (!project) {
    notFound();
  }

  // Check ownership
  if (project.userId !== user.id) {
    redirect('/projects');
  }

  const snapshots = await prisma.corpusSnapshot.findMany({
    where: { projectId },
    include: {
      _count: {
        select: { applyChangesLogs: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Project
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold text-gray-900">Corpus Snapshots</h1>
          <p className="mt-2 text-gray-600">
            Version history for {project.name}
          </p>
        </div>
      </div>

      {/* Snapshots List */}
      {snapshots.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No snapshots yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Snapshots are created automatically when you apply recommendations.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <div className="divide-y">
            {snapshots.map((snapshot) => (
              <Link
                key={snapshot.id}
                href={`/snapshots/${snapshot.id}`}
                className="block px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{snapshot.name}</h3>
                    </div>
                    {snapshot.description && (
                      <p className="text-gray-600 text-sm mb-3">{snapshot.description}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {snapshot._count.applyChangesLogs} changes
                      </div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
