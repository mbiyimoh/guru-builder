import { redirect } from 'next/navigation';
import { getArtifactSummaries } from '@/lib/teaching/artifactClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeachingArtifactsLandingPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const data = await getArtifactSummaries(projectId);
  const { mentalModel, curriculum, drillSeries } = data.latest;

  // Redirect to first available artifact in priority order
  if (mentalModel) {
    redirect(`/projects/${projectId}/artifacts/teaching/mental-model`);
  }
  if (curriculum) {
    redirect(`/projects/${projectId}/artifacts/teaching/curriculum`);
  }
  if (drillSeries) {
    redirect(`/projects/${projectId}/artifacts/teaching/drill-series`);
  }

  // If no artifacts exist, redirect to mental model page (shows placeholder)
  redirect(`/projects/${projectId}/artifacts/teaching/mental-model`);
}
