import TeachingArtifactNav from '@/components/artifacts/TeachingArtifactNav';
import { getArtifactSummaries, type ArtifactSummary } from '@/lib/teaching/artifactClient';

export const dynamic = 'force-dynamic';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function TeachingArtifactLayout({ children, params }: LayoutProps) {
  const { id: projectId } = await params;

  let artifacts: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  } = { mentalModel: null, curriculum: null, drillSeries: null };

  try {
    const data = await getArtifactSummaries(projectId);
    artifacts = data.latest;
  } catch (error) {
    console.error('Failed to fetch artifact summaries:', error);
  }

  return (
    <div className="flex h-screen bg-white">
      <TeachingArtifactNav
        projectId={projectId}
        artifacts={artifacts}
      />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
