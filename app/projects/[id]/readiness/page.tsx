import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ReadinessPageContent } from './ReadinessPageContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReadinessPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true }
  });

  if (!project) {
    redirect('/projects');
  }

  return (
    <ProjectPageLayout
      projectId={id}
      projectName={project.name}
      title="Readiness Assessment"
      description="Evaluate if your guru is ready for content creation"
    >
      <ReadinessPageContent projectId={id} />
    </ProjectPageLayout>
  );
}
