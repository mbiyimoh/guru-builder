import type { GuruArtifactType, ArtifactStatus } from '@prisma/client';
import { ArtifactTypeSlug, getApiKeyFromSlug } from './constants';

export interface ArtifactSummary {
  id: string;
  type: GuruArtifactType;
  version: number;
  status: ArtifactStatus;
  generatedAt: string;
  corpusHash: string | null;
  errorMessage: string | null;
  progressStage: string | null;
}

export interface ArtifactDetail extends ArtifactSummary {
  content: unknown;
  markdownContent: string | null;
}

export interface ArtifactSummariesResponse {
  artifacts: ArtifactSummary[];
  grouped: {
    mentalModels: ArtifactSummary[];
    curricula: ArtifactSummary[];
    drillSeries: ArtifactSummary[];
  };
  latest: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  };
  counts: {
    total: number;
    mentalModels: number;
    curricula: number;
    drillSeries: number;
  };
}

/**
 * Fetch artifact summaries for a project (server-side)
 */
export async function getArtifactSummaries(projectId: string): Promise<ArtifactSummariesResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/guru/artifacts`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      artifacts: [],
      grouped: { mentalModels: [], curricula: [], drillSeries: [] },
      latest: { mentalModel: null, curriculum: null, drillSeries: null },
      counts: { total: 0, mentalModels: 0, curricula: 0, drillSeries: 0 },
    };
  }

  return res.json();
}

/**
 * Fetch artifact summaries with all versions grouped by type.
 * Use this when you need access to version history.
 * Alias for getArtifactSummaries with clearer semantic intent.
 */
export async function getArtifactSummariesWithVersions(
  projectId: string
): Promise<ArtifactSummariesResponse> {
  return getArtifactSummaries(projectId);
}

/**
 * Fetch full artifact content by ID (server-side)
 */
export async function getArtifactContent(
  projectId: string,
  artifactId: string
): Promise<{ artifact: ArtifactDetail }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/guru/artifacts/${artifactId}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch artifact content');
  }

  return res.json();
}

/**
 * Get latest artifact for a specific type by slug
 */
export async function getLatestArtifactForType(
  projectId: string,
  type: ArtifactTypeSlug
): Promise<ArtifactSummary | null> {
  const summaries = await getArtifactSummaries(projectId);
  const apiKey = getApiKeyFromSlug(type);
  return summaries.latest[apiKey];
}

/**
 * Get full artifact data for a page (summary + content if exists)
 */
export async function getArtifactPageData(
  projectId: string,
  type: ArtifactTypeSlug
): Promise<{ artifact: ArtifactDetail | null }> {
  const latest = await getLatestArtifactForType(projectId, type);

  if (!latest) {
    return { artifact: null };
  }

  const { artifact } = await getArtifactContent(projectId, latest.id);
  return { artifact };
}
