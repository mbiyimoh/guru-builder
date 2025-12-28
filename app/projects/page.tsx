import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { CreateProjectButton } from './CreateProjectButton';
import { ClickableCard } from '@/components/ui/clickable-card';
import { EmptyState } from '@/components/ui/empty-state';
import { FolderOpen } from 'lucide-react';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: {
          contextLayers: true,
          knowledgeFiles: true,
          researchRuns: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-2 text-muted-foreground">Manage your AI knowledge base projects</p>
        </div>
        <CreateProjectButton />
      </div>

      {projects.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-md">
          <EmptyState
            icon={<FolderOpen className="w-full h-full" />}
            title="No projects yet"
            description="Create your first guru project to get started building your AI teaching assistant."
          />
          <div className="pb-8 flex justify-center">
            <CreateProjectButton />
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ClickableCard
              key={project.id}
              href={`/projects/${project.id}`}
              className="bg-card rounded-lg border hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {project._count.contextLayers} layers
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {project._count.knowledgeFiles} files
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {project._count.researchRuns} runs
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t text-xs text-muted-foreground/60">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </div>
              </div>
            </ClickableCard>
          ))}
        </div>
      )}
    </div>
  );
}
