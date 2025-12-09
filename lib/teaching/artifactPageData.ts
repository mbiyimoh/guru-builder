import { ArtifactTypeSlug } from './constants';
import { getArtifactSummariesWithVersions, getArtifactContent } from './artifactClient';
import type { ArtifactDetail, ArtifactSummary } from './artifactClient';

export interface ArtifactPageData {
  artifact: ArtifactDetail;
  previousArtifact: ArtifactDetail | null;
  allVersions: ArtifactSummary[];
  showDiff: boolean;
}

/**
 * Shared data fetching logic for all artifact viewer pages.
 * Handles version selection, diff fetching, and proper type mapping.
 */
export async function fetchArtifactPageData(
  projectId: string,
  type: ArtifactTypeSlug,
  searchParams: { v?: string; diff?: string }
): Promise<ArtifactPageData | null> {
  const { v, diff } = searchParams;

  // 1. Fetch all versions
  const summaries = await getArtifactSummariesWithVersions(projectId);

  // 2. Get versions for this type (type-safe mapping)
  const typeToGroupKey: Record<ArtifactTypeSlug, keyof typeof summaries.grouped> = {
    'mental-model': 'mentalModels',
    'curriculum': 'curricula',
    'drill-series': 'drillSeries',
  };

  const typeToLatestKey: Record<ArtifactTypeSlug, keyof typeof summaries.latest> = {
    'mental-model': 'mentalModel',
    'curriculum': 'curriculum',
    'drill-series': 'drillSeries',
  };

  const versions = summaries.grouped[typeToGroupKey[type]];
  const latestVersion = summaries.latest[typeToLatestKey[type]];

  // 3. Determine target version
  const requestedVersion = v ? parseInt(v) : null;
  const targetArtifact = requestedVersion
    ? versions.find((ver) => ver.version === requestedVersion)
    : latestVersion;

  if (!targetArtifact) {
    return null; // Page will render NoArtifactPlaceholder
  }

  // 4. Fetch full content
  const { artifact } = await getArtifactContent(projectId, targetArtifact.id);

  // 5. Fetch previous version if diff requested
  let previousArtifact: ArtifactDetail | null = null;
  if (diff !== undefined && artifact.version > 1) {
    const prevVersion = versions.find((ver) => ver.version === artifact.version - 1);
    if (prevVersion) {
      const prevData = await getArtifactContent(projectId, prevVersion.id);
      previousArtifact = prevData.artifact;
    }
  }

  return {
    artifact,
    previousArtifact,
    allVersions: versions,
    showDiff: diff !== undefined,
  };
}
