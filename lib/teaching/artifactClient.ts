import type { GuruArtifactType, ArtifactStatus, VerificationStatus } from '@prisma/client';
import { ArtifactTypeSlug, getApiKeyFromSlug } from './constants';
import { prisma } from '@/lib/db';
import { requireProjectOwnership } from '@/lib/auth';
import { clearStaleGeneratingArtifact } from './staleArtifactHandler';

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
  // Prompt versioning fields
  systemPromptHash: string | null;
  userPromptHash: string | null;
  promptConfigId: string | null;
  // Ground truth verification fields
  verificationStatus: VerificationStatus | null;
  verificationDetails: unknown;
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
 * Fetch artifact summaries for a project (server-side using Prisma directly)
 */
export async function getArtifactSummaries(projectId: string): Promise<ArtifactSummariesResponse> {
  try {
    // Verify project ownership
    await requireProjectOwnership(projectId);

    // Clear any stale GENERATING artifacts
    await Promise.all([
      clearStaleGeneratingArtifact(projectId, 'MENTAL_MODEL'),
      clearStaleGeneratingArtifact(projectId, 'CURRICULUM'),
      clearStaleGeneratingArtifact(projectId, 'DRILL_SERIES'),
    ]);

    const artifacts = await prisma.guruArtifact.findMany({
      where: { projectId },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
      select: {
        id: true,
        type: true,
        version: true,
        status: true,
        corpusHash: true,
        generatedAt: true,
        errorMessage: true,
        progressStage: true,
      },
    });

    // Transform dates to strings for consistency
    const transformedArtifacts: ArtifactSummary[] = artifacts.map((a) => ({
      ...a,
      generatedAt: a.generatedAt?.toISOString() ?? '',
    }));

    // Group by type
    const grouped = {
      mentalModels: transformedArtifacts.filter((a) => a.type === 'MENTAL_MODEL'),
      curricula: transformedArtifacts.filter((a) => a.type === 'CURRICULUM'),
      drillSeries: transformedArtifacts.filter((a) => a.type === 'DRILL_SERIES'),
    };

    // Get latest of each type (GENERATING takes precedence, then COMPLETED)
    const getLatest = (list: ArtifactSummary[]) => {
      const generating = list.find((a) => a.status === 'GENERATING');
      if (generating) return generating;
      return list.find((a) => a.status === 'COMPLETED') ?? null;
    };

    const latest = {
      mentalModel: getLatest(grouped.mentalModels),
      curriculum: getLatest(grouped.curricula),
      drillSeries: getLatest(grouped.drillSeries),
    };

    return {
      artifacts: transformedArtifacts,
      grouped,
      latest,
      counts: {
        total: artifacts.length,
        mentalModels: grouped.mentalModels.length,
        curricula: grouped.curricula.length,
        drillSeries: grouped.drillSeries.length,
      },
    };
  } catch (error) {
    console.error('[ArtifactClient] Failed to fetch summaries:', error);
    return {
      artifacts: [],
      grouped: { mentalModels: [], curricula: [], drillSeries: [] },
      latest: { mentalModel: null, curriculum: null, drillSeries: null },
      counts: { total: 0, mentalModels: 0, curricula: 0, drillSeries: 0 },
    };
  }
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
 * Fetch full artifact content by ID (server-side using Prisma directly)
 */
export async function getArtifactContent(
  projectId: string,
  artifactId: string
): Promise<{ artifact: ArtifactDetail }> {
  // Verify project ownership
  await requireProjectOwnership(projectId);

  const artifact = await prisma.guruArtifact.findFirst({
    where: {
      id: artifactId,
      projectId, // Ensure artifact belongs to the project
    },
  });

  if (!artifact) {
    throw new Error('Artifact not found');
  }

  return {
    artifact: {
      id: artifact.id,
      type: artifact.type,
      version: artifact.version,
      status: artifact.status,
      generatedAt: artifact.generatedAt?.toISOString() ?? '',
      corpusHash: artifact.corpusHash,
      errorMessage: artifact.errorMessage,
      progressStage: artifact.progressStage,
      content: artifact.content,
      markdownContent: artifact.markdownContent,
      // Prompt versioning fields
      systemPromptHash: artifact.systemPromptHash,
      userPromptHash: artifact.userPromptHash,
      promptConfigId: artifact.promptConfigId,
      // Ground truth verification fields
      verificationStatus: artifact.verificationStatus,
      verificationDetails: artifact.verificationDetails,
    },
  };
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
