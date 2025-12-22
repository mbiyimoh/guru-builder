import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ProfilePageContent } from './ProfilePageContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { currentProfile: true }
  });

  if (!project) {
    redirect('/projects');
  }

  return (
    <ProjectPageLayout
      projectId={id}
      projectName={project.name}
      title="Guru Profile"
      description="Define your teaching domain, audience, and pedagogical approach"
    >
      <ProfilePageContent
        projectId={id}
        existingProfile={project.currentProfile}
      />
    </ProjectPageLayout>
  );
}
