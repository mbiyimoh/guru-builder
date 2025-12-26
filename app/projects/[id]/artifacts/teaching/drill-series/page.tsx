import { UnifiedArtifactPage } from '@/components/artifacts/UnifiedArtifactPage';
import { getArtifactSummaries } from '@/lib/teaching/artifactClient';
import { fetchArtifactPageData } from '@/lib/teaching/artifactPageData';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; diff?: string }>;
}

export default async function DrillSeriesPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const resolvedSearchParams = await searchParams;

  // Fetch all data in parallel
  const [summaries, pageData] = await Promise.all([
    getArtifactSummaries(projectId),
    fetchArtifactPageData(projectId, 'drill-series', resolvedSearchParams).catch(() => null),
  ]);

  // Default prompt info if no artifact exists
  const defaultPromptInfo = {
    isCustom: false,
    hasPromptDrift: false,
    currentConfig: {
      systemPrompt: { current: '', default: '', isCustom: false },
      userPrompt: { current: '', default: '', isCustom: false },
    },
  };

  return (
    <UnifiedArtifactPage
      projectId={projectId}
      artifactType="drill-series"
      initialArtifact={pageData?.artifact ?? null}
      initialPromptInfo={pageData?.promptInfo ?? defaultPromptInfo}
      allArtifactsSummary={summaries}
      allVersions={pageData?.allVersions ?? []}
    />
  );
}
