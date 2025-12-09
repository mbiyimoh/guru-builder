/**
 * Stale Artifact Handler
 *
 * Detects and clears stuck GENERATING artifacts that have exceeded
 * the timeout threshold. This prevents "already in progress" errors
 * from blocking retry attempts after timeouts/crashes.
 */

import { prisma } from '@/lib/db';
import type { GuruArtifactType } from '@prisma/client';

// Clear 30 seconds before frontend timeout (10 min) to ensure clean UX handoff
const STALE_THRESHOLD_MS = 9.5 * 60 * 1000;

interface StaleCheckResult {
  hadStaleArtifact: boolean;
  clearedArtifactId: string | null;
}

/**
 * Check for and clear stale GENERATING artifacts.
 *
 * If a GENERATING artifact is older than the threshold, it's marked as FAILED
 * to allow retry attempts to proceed.
 *
 * @param projectId - The project to check
 * @param artifactType - The artifact type to check (MENTAL_MODEL, CURRICULUM, DRILL_SERIES)
 * @returns Object indicating if a stale artifact was found and cleared
 */
export async function clearStaleGeneratingArtifact(
  projectId: string,
  artifactType: GuruArtifactType
): Promise<StaleCheckResult> {
  const existingGeneration = await prisma.guruArtifact.findFirst({
    where: {
      projectId,
      type: artifactType,
      status: 'GENERATING',
    },
  });

  if (!existingGeneration) {
    return { hadStaleArtifact: false, clearedArtifactId: null };
  }

  // Check if it's stale (older than threshold)
  const ageMs = Date.now() - new Date(existingGeneration.generatedAt).getTime();

  if (ageMs > STALE_THRESHOLD_MS) {
    // Mark as failed so retry can proceed
    await prisma.guruArtifact.update({
      where: { id: existingGeneration.id },
      data: {
        status: 'FAILED',
        errorMessage: `Generation exceeded time limit (${Math.round(ageMs / 60000)} minutes). Please try again.`,
        progressStage: null,
      },
    });

    console.log(
      `[Stale Artifact] Cleared stuck ${artifactType} artifact ${existingGeneration.id} ` +
      `(age: ${Math.round(ageMs / 60000)}m, threshold: ${STALE_THRESHOLD_MS / 60000}m)`
    );

    return { hadStaleArtifact: true, clearedArtifactId: existingGeneration.id };
  }

  // Not stale - generation is still in progress
  return { hadStaleArtifact: false, clearedArtifactId: null };
}

/**
 * Check if there's an active (non-stale) GENERATING artifact.
 * If stale, it will be auto-cleared first.
 *
 * @param projectId - The project to check
 * @param artifactType - The artifact type to check
 * @returns The active generating artifact if one exists (after clearing any stale ones)
 */
export async function getActiveGeneratingArtifact(
  projectId: string,
  artifactType: GuruArtifactType
) {
  // First, clear any stale artifacts
  await clearStaleGeneratingArtifact(projectId, artifactType);

  // Now check for any remaining active generation
  return prisma.guruArtifact.findFirst({
    where: {
      projectId,
      type: artifactType,
      status: 'GENERATING',
    },
  });
}
