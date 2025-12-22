import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { SimplifiedDashboard } from '@/components/dashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      currentProfile: true,
      researchRuns: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { recommendations: true } },
        },
      },
      guruArtifacts: {
        orderBy: { generatedAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!project) {
    notFound();
  }

  if (project.userId !== user.id) {
    redirect('/projects');
  }

  // Determine if this is a new project (for Getting Started)
  const isNewProject = !project.currentProfile &&
                       project.researchRuns.length === 0;

  return (
    <SimplifiedDashboard
      project={project}
      isNewProject={isNewProject}
    />
  );
}
