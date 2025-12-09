/**
 * Prompt Utilities for Artifact Viewer
 *
 * Helper functions for fetching prompt configurations and detecting prompt drift
 * between artifacts and current project settings.
 */

import { prisma } from '@/lib/db';
import { hashPrompt } from '@/lib/guruFunctions/promptHasher';
import { getDefaultPrompts } from '@/lib/guruFunctions/prompts/defaults';
import type { GuruArtifactType } from '@prisma/client';
import { ArtifactTypeSlug, getArtifactTypeFromSlug } from './constants';
import type { PromptConfig } from './types';

// Re-export for convenience
export type { PromptConfig } from './types';

/**
 * Fetch current prompt configuration for a specific artifact type.
 * Merges custom config (if exists) with defaults.
 */
export async function getPromptConfigForType(
  projectId: string,
  type: ArtifactTypeSlug
): Promise<PromptConfig> {
  const dbType = getArtifactTypeFromSlug(type);
  const defaults = getDefaultPrompts(dbType);

  // Check for custom config
  const customConfig = await prisma.projectPromptConfig.findUnique({
    where: {
      projectId_artifactType: {
        projectId,
        artifactType: dbType,
      },
    },
  });

  return {
    systemPrompt: {
      current: customConfig?.customSystemPrompt ?? defaults.systemPrompt,
      default: defaults.systemPrompt,
      isCustom: !!customConfig?.customSystemPrompt,
    },
    userPrompt: {
      current: customConfig?.customUserPrompt ?? defaults.userPromptTemplate,
      default: defaults.userPromptTemplate,
      isCustom: !!customConfig?.customUserPrompt,
    },
  };
}

/**
 * Detect if current project prompts differ from the prompts used to generate an artifact.
 * Returns true if there is "drift" (prompts have changed since artifact was generated).
 */
export function detectPromptDrift(
  artifact: {
    systemPromptHash: string | null;
    userPromptHash: string | null;
  },
  currentPrompts: {
    systemPrompt: string;
    userPromptTemplate: string;
  }
): boolean {
  // If artifact has no hashes (legacy), assume no drift
  if (!artifact.systemPromptHash && !artifact.userPromptHash) {
    return false;
  }

  const currentSystemHash = hashPrompt(currentPrompts.systemPrompt);
  const currentUserHash = hashPrompt(currentPrompts.userPromptTemplate);

  // Check if either hash differs
  const systemDrift =
    artifact.systemPromptHash !== null &&
    artifact.systemPromptHash !== currentSystemHash;
  const userDrift =
    artifact.userPromptHash !== null &&
    artifact.userPromptHash !== currentUserHash;

  return systemDrift || userDrift;
}

/**
 * Determine if an artifact was generated with custom prompts.
 * Checks if promptConfigId exists or if hashes differ from defaults.
 */
export function wasGeneratedWithCustomPrompts(
  artifact: {
    systemPromptHash: string | null;
    userPromptHash: string | null;
    promptConfigId: string | null;
  },
  type: GuruArtifactType
): boolean {
  // If has promptConfigId, it used custom prompts
  if (artifact.promptConfigId) {
    return true;
  }

  // Fallback: compare hashes to defaults (only check non-null hashes)
  if (artifact.systemPromptHash || artifact.userPromptHash) {
    const defaults = getDefaultPrompts(type);
    const defaultSystemHash = hashPrompt(defaults.systemPrompt);
    const defaultUserHash = hashPrompt(defaults.userPromptTemplate);

    // Check if EITHER hash differs from defaults (ignoring nulls)
    const systemCustom = artifact.systemPromptHash
      ? artifact.systemPromptHash !== defaultSystemHash
      : false;
    const userCustom = artifact.userPromptHash
      ? artifact.userPromptHash !== defaultUserHash
      : false;

    return systemCustom || userCustom;
  }

  return false;
}
