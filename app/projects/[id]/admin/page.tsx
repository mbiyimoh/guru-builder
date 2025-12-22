import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ContextLayerManager } from '@/components/context-layers/ContextLayerManager';
import { KnowledgeFileManager } from '@/components/knowledge-files/KnowledgeFileManager';
import { ProjectAssessmentManager } from '@/components/assessment/ProjectAssessmentManager';
import { GuruTeachingManager } from '@/components/guru/GuruTeachingManager';
import { GuruProfileSection } from '@/components/guru/GuruProfileSection';
import { GroundTruthEngineManager } from '@/components/ground-truth/GroundTruthEngineManager';
import { MigrationBannerWrapper } from '@/components/wizard/MigrationBannerWrapper';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      contextLayers: {
        where: { isActive: true },
        orderBy: { priority: 'asc' },
      },
      knowledgeFiles: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      },
      researchRuns: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          _count: {
            select: { recommendations: true },
          },
        },
      },
      currentProfile: {
        select: { id: true },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Check ownership
  if (project.userId !== user.id) {
    redirect('/projects');
  }

  // Determine if project has content that would benefit from wizard
  const hasGuruProfile = !!project.currentProfile
  const hasCorpusContent = project.contextLayers.length > 0 || project.knowledgeFiles.length > 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/projects"
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </Link>
        <div className="flex justify-between items-start mt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="mt-2 text-gray-600">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Migration Banner - Encourage trying new wizard */}
      <MigrationBannerWrapper
        projectId={id}
        projectName={project.name}
        hasGuruProfile={hasGuruProfile}
        hasCorpusContent={hasCorpusContent}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Context Layers</p>
              <p className="text-2xl font-semibold text-gray-900">{project.contextLayers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Knowledge Files</p>
              <p className="text-2xl font-semibold text-gray-900">{project.knowledgeFiles.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Research Runs</p>
              <p className="text-2xl font-semibold text-gray-900">{project.researchRuns.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Guru Profile - Auto-prompts for new projects */}
      <div className="mb-8">
        <GuruProfileSection projectId={id} autoPrompt={true} />
      </div>

      {/* Self-Assessment */}
      <div className="mb-8">
        <ProjectAssessmentManager projectId={id} />
      </div>

      {/* Ground Truth Engine */}
      <div className="mb-8">
        <GroundTruthEngineManager projectId={id} />
      </div>

      {/* Guru Teaching Pipeline */}
      <div className="mb-8">
        <GuruTeachingManager projectId={id} />
      </div>

      {/* Recent Research Runs */}
      <div className="bg-white rounded-lg border mb-8">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Recent Research Runs</h2>
            <Link
              href={`/projects/${id}/research/new`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start New Research
            </Link>
          </div>
        </div>
        {project.researchRuns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No research runs yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first research run.</p>
          </div>
        ) : (
          <div className="divide-y">
            {project.researchRuns.map((run) => (
              <Link
                key={run.id}
                href={`/projects/${id}/research/${run.id}`}
                className="block px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {run.instructions}
                    </p>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="capitalize">{run.depth.toLowerCase()}</span>
                      <span>•</span>
                      <span>{run._count.recommendations} recommendations</span>
                      <span>•</span>
                      <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        run.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : run.status === 'RUNNING'
                          ? 'bg-blue-100 text-blue-800'
                          : run.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Context Layers */}
      <div className="mb-8">
        <ContextLayerManager projectId={id} />
      </div>

      {/* Knowledge Files */}
      <KnowledgeFileManager projectId={id} />
    </div>
  );
}
