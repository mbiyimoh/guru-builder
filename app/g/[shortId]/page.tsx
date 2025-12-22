import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import PublicGuruView from '@/components/public/PublicGuruView';
import type { GuruProfileData } from '@/lib/guruProfile/types';

interface PageProps {
  params: Promise<{ shortId: string }>;
}

export default async function PublicGuruPage({ params }: PageProps) {
  const { shortId } = await params;

  // Fetch published guru with related data
  const publishedGuru = await prisma.publishedGuru.findUnique({
    where: { shortId },
    include: {
      project: {
        include: {
          currentProfile: true,
          guruArtifacts: {
            where: {
              status: 'COMPLETED',
            },
            orderBy: {
              generatedAt: 'desc',
            },
            select: {
              id: true,
              type: true,
              status: true,
              generatedAt: true,
            },
          },
        },
      },
    },
  });

  // Check if published guru exists and is active
  if (!publishedGuru || !publishedGuru.isPublished) {
    notFound();
  }

  // Increment view count (fire and forget)
  prisma.publishedGuru
    .update({
      where: { shortId },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })
    .catch(() => {
      // Silently fail - don't block page load for analytics
    });

  const { project } = publishedGuru;

  // Extract profile data
  const profile = project.currentProfile?.profileData as GuruProfileData | null;

  if (!profile) {
    notFound();
  }

  // Transform artifacts for display
  const artifacts = project.guruArtifacts.map((artifact) => ({
    id: artifact.id,
    type: artifact.type,
    status: artifact.status,
    createdAt: artifact.generatedAt,
  }));

  return (
    <PublicGuruView
      profile={profile}
      artifacts={artifacts}
      projectName={project.name}
    />
  );
}
