import { ArtifactViewerWithVersions } from '@/components/artifacts/ArtifactViewerWithVersions';
import NoArtifactPlaceholder from '@/components/artifacts/NoArtifactPlaceholder';
import { fetchArtifactPageData } from '@/lib/teaching/artifactPageData';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; diff?: string }>;
}

export default async function MentalModelPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const resolvedSearchParams = await searchParams;

  const data = await fetchArtifactPageData(projectId, 'mental-model', resolvedSearchParams);

  if (!data) {
    return <NoArtifactPlaceholder type="mental-model" projectId={projectId} />;
  }

  return (
    <ArtifactViewerWithVersions
      artifact={data.artifact}
      previousArtifact={data.previousArtifact}
      allVersions={data.allVersions}
      projectId={projectId}
      showDiff={data.showDiff}
      promptInfo={data.promptInfo}
    />
  );
}
