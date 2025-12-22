import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ResearchPageContent } from './ResearchPageContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResearchPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      currentProfile: true,
      researchRuns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          _count: { select: { recommendations: true } }
        }
      }
    }
  });

  if (!project) {
    redirect('/projects');
  }

  return (
    <ProjectPageLayout
      projectId={id}
      projectName={project.name}
      title="Research Knowledge"
      description="Run research to discover and gather knowledge for your guru"
    >
      <ResearchPageContent
        projectId={id}
        profile={project.currentProfile}
        researchRuns={project.researchRuns}
      />
    </ProjectPageLayout>
  );
}
