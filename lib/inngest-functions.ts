/**
 * Inngest Background Job Functions
 *
 * Defines serverless functions that run in the background for long-running tasks
 */

import { inngest } from "./inngest";
import { executeResearch } from "./researchOrchestrator";
import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import { generateCorpusRecommendations, type CorpusRecommendation } from "./corpusRecommendationGenerator";
import { PROGRESS_STAGES } from "./assessment/constants";

/**
 * Minimum confidence threshold for recommendations to be saved to database.
 * Recommendations below this threshold are filtered out to maintain quality.
 *
 * Range: 0.0 (no confidence) to 1.0 (absolute confidence)
 * Current: 0.4 (40% confidence minimum)
 */
const MIN_RECOMMENDATION_CONFIDENCE = 0.4;

/**
 * Minimum verification rate to consider a match archive import complete.
 * Allows up to 5% of positions to fail verification (e.g., due to engine timeouts)
 * without blocking the entire import.
 *
 * Range: 0.0 to 1.0
 * Current: 0.95 (95% of positions must be verified)
 */
const MIN_VERIFICATION_RATE_FOR_COMPLETION = 0.95;


/**
 * Helper to update the progress stage of a research run
 */
async function updateProgressStage(researchId: string, stage: string): Promise<void> {
  await prisma.researchRun.update({
    where: { id: researchId },
    data: { progressStage: stage },
  });
  console.log(`[Progress] ${researchId}: ${stage}`);
}

/**
 * Simple test function to verify Inngest works
 */
export const testSimpleJob = inngest.createFunction(
  { id: "test-simple-job", name: "Test Simple Job" },
  { event: "test/simple" },
  async ({ event, step }) => {
    const message = await step.run("process-message", async () => {
      return `Processed: ${event.data.message}`;
    });

    await step.sleep("wait-5-seconds", "5s");

    return {
      message,
      timestamp: new Date().toISOString(),
    };
  }
);

/**
 * Research job that executes GPT Researcher in background
 */
export const researchJob = inngest.createFunction(
  {
    id: "research-job",
    name: "Execute GPT Research",
    concurrency: {
      limit: 5, // Max 5 concurrent research jobs
    },
  },
  { event: "research/requested" },
  async ({ event, step }) => {
    const { researchId, instructions, depth } = event.data;

    // Update progress: Starting
    await step.run("progress-starting", async () => {
      await updateProgressStage(researchId, PROGRESS_STAGES.STARTING);
    });

    // Check for cancellation before expensive research
    const cancelledBeforeResearch = await step.run("check-cancelled-before-research", async () => {
      return await isResearchCancelled(researchId);
    });
    if (cancelledBeforeResearch) {
      console.log(`[Research Job ${researchId}] Job stopped - user cancelled`);
      return { researchId, cancelled: true };
    }

    // Execute research (can take 5-10 minutes for deep research)
    const result = await step.run("execute-research", async () => {
      console.log(`[Research Job ${researchId}] Starting: "${instructions}" (${depth})`);

      const researchResult = await executeResearch({
        instructions,
        depth,
        timeout: 600000, // 10 minutes max
        onProgress: async (stage: string) => {
          // Update progress in database during research execution
          await updateProgressStage(researchId, stage);
        },
      });

      console.log(
        `[Research Job ${researchId}] Completed in ${researchResult.executionTime}ms - Success: ${researchResult.success}`
      );

      return researchResult;
    });

    // Update progress: Saving research
    await step.run("progress-saving", async () => {
      await updateProgressStage(researchId, PROGRESS_STAGES.SAVING_RESEARCH);
    });

    // Save results to database (only if not cancelled)
    const saved = await step.run("save-to-database", async () => {
      // Check if user cancelled during research
      const currentStatus = await prisma.researchRun.findUnique({
        where: { id: researchId },
        select: { status: true },
      });

      if (currentStatus?.status === 'CANCELLED') {
        console.log(`[Research Job ${researchId}] Skipping save - user cancelled during research`);
        return false;
      }

      await prisma.researchRun.update({
        where: { id: researchId },
        data: {
          status: result.success ? "COMPLETED" : "FAILED",
          researchData: result.success ? (result.data as Prisma.JsonObject) : Prisma.JsonNull,
          errorMessage: result.success ? null : result.error?.message,
          completedAt: new Date(),
          executionTime: result.executionTime,
        },
      });

      console.log(`[Research Job ${researchId}] Database updated: ${result.success ? "COMPLETED" : "FAILED"}`);
      return true;
    });

    // Only send completion event if save succeeded (not cancelled)
    if (saved && result.success) {
      await step.sendEvent("send-completion-event", {
        name: "research/completed",
        data: {
          researchId,
          success: result.success,
          executionTime: result.executionTime || 0,
        },
      });
    }

    return {
      researchId,
      success: saved && result.success,
      cancelled: !saved,
      executionTime: result.executionTime,
      summary: result.success
        ? result.data?.summary
        : result.error?.message,
    };
  }
);

/**
 * Recommendation generation job that triggers after research completes
 */
export const recommendationGenerationJob = inngest.createFunction(
  {
    id: "recommendation-generation",
    name: "Generate Recommendations from Research",
    concurrency: {
      limit: 3, // Max 3 concurrent generation jobs
    },
  },
  { event: "research/completed" },
  async ({ event, step }) => {
    const { researchId, success } = event.data;

    // Skip if research failed
    if (!success) {
      console.log(`[Recommendation Job] Skipping ${researchId} - research failed`);
      return { skipped: true, reason: "Research failed" };
    }

    // Update progress: Generating recommendations
    await step.run("progress-generating", async () => {
      await updateProgressStage(researchId, PROGRESS_STAGES.GENERATING_RECOMMENDATIONS);
    });

    // Fetch research run with project data
    const researchRun = await step.run("fetch-research-run", async () => {
      const run = await prisma.researchRun.findUnique({
        where: { id: researchId },
        include: {
          project: {
            include: {
              contextLayers: {
                where: { isActive: true },
                orderBy: { priority: "asc" },
              },
              knowledgeFiles: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!run || !run.researchData) {
        throw new Error("Research run not found or has no data");
      }

      return run;
    });

    // Generate recommendations
    const recommendationsResult = await step.run("generate-recommendations", async () => {
      console.log(`[Recommendation Job ${researchId}] Generating recommendations...`);

      const result = await generateCorpusRecommendations({
        researchFindings: researchRun.researchData as Record<string, unknown>,
        currentLayers: researchRun.project.contextLayers,
        currentKnowledgeFiles: researchRun.project.knowledgeFiles,
        instructions: researchRun.instructions,
      });

      // Filter recommendations by confidence threshold
      const filteredRecommendations = result.recommendations.filter(
        rec => rec.confidence >= MIN_RECOMMENDATION_CONFIDENCE
      );

      // Log filtered items for debugging
      const filteredOut = result.recommendations.filter(
        rec => rec.confidence < MIN_RECOMMENDATION_CONFIDENCE
      );
      if (filteredOut.length > 0) {
        console.log(
          `[Recommendation Job ${researchId}] Filtered out ${filteredOut.length} low-confidence recommendations:`,
          filteredOut.map(r => `"${r.title}" (${r.confidence.toFixed(2)})`)
        );
      }

      console.log(
        `[Recommendation Job ${researchId}] Generated ${result.recommendations.length} recommendations, ` +
        `filtered to ${filteredRecommendations.length} (min confidence: ${MIN_RECOMMENDATION_CONFIDENCE})`
      );

      if (result.noRecommendationsReason) {
        console.log(`[Recommendation Job ${researchId}] No recommendations reason: ${result.noRecommendationsReason}`);
      }

      return {
        ...result,
        recommendations: filteredRecommendations,
      };
    });

    // Save no-recommendations reason back to research data if present
    if (recommendationsResult.noRecommendationsReason) {
      await step.run("save-no-recommendations-reason", async () => {
        const currentData = researchRun.researchData as Record<string, unknown>;
        await prisma.researchRun.update({
          where: { id: researchId },
          data: {
            researchData: {
              ...currentData,
              noRecommendationsReason: recommendationsResult.noRecommendationsReason,
            } as Prisma.JsonObject,
          },
        });
        console.log(`[Recommendation Job ${researchId}] Saved no-recommendations reason to research data`);
      });
    }

    // Update progress: Saving recommendations
    await step.run("progress-saving-recs", async () => {
      await updateProgressStage(researchId, PROGRESS_STAGES.SAVING_RECOMMENDATIONS);
    });

    // Save recommendations to database
    await step.run("save-recommendations", async () => {
      if (recommendationsResult.recommendations.length === 0) {
        console.log(`[Recommendation Job ${researchId}] No recommendations to save`);
        return;
      }

      await prisma.recommendation.createMany({
        data: recommendationsResult.recommendations.map((rec: CorpusRecommendation, index: number) => {
          // For ADD actions, targetId should always be null (no existing target to reference)
          // For EDIT/DELETE, use targetId but convert empty strings to null
          const effectiveTargetId = rec.action === "ADD" ? null : (rec.targetId || null);

          return {
            researchRunId: researchId,
            action: rec.action,
            targetType: rec.targetType,
            // Route to correct FK based on targetType
            contextLayerId: rec.targetType === "LAYER" ? effectiveTargetId : null,
            knowledgeFileId: rec.targetType === "KNOWLEDGE_FILE" ? effectiveTargetId : null,
            title: rec.title,
            description: rec.description,
            fullContent: rec.fullContent,
            reasoning: rec.reasoning,
            confidence: rec.confidence,
            impactLevel: rec.impactLevel,
            priority: index,
            status: "PENDING" as const,
          };
        }),
      });

      console.log(`[Recommendation Job ${researchId}] Saved ${recommendationsResult.recommendations.length} recommendations to database`);
    });

    // Update progress: Complete
    await step.run("progress-complete", async () => {
      await updateProgressStage(researchId, PROGRESS_STAGES.COMPLETE);
    });

    return {
      researchId,
      recommendationsGenerated: recommendationsResult.recommendations.length,
      success: true,
    };
  }
);

// =============================================================================
// GURU TEACHING FUNCTION JOBS
// =============================================================================

/**
 * Helper to update the progress stage of a guru artifact
 */
async function updateArtifactProgress(artifactId: string, progressStage: string): Promise<void> {
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: { progressStage },
  });
  console.log(`[Artifact Progress] ${artifactId}: ${progressStage}`);
}

/**
 * Check if an artifact has been cancelled by the user.
 * Used to stop long-running jobs early when user cancels.
 */
async function isArtifactCancelled(artifactId: string): Promise<boolean> {
  const artifact = await prisma.guruArtifact.findUnique({
    where: { id: artifactId },
    select: { status: true },
  });
  return artifact?.status === 'CANCELLED';
}

/**
 * Check if a research run has been cancelled by the user.
 */
async function isResearchCancelled(researchId: string): Promise<boolean> {
  const run = await prisma.researchRun.findUnique({
    where: { id: researchId },
    select: { status: true },
  });
  return run?.status === 'CANCELLED';
}

import type { SubTaskProgress } from '@/lib/teaching/types';

/**
 * Updates sub-task progress for an artifact during generation.
 * Used to provide detailed visibility into verification phase.
 * Updates are batched (caller should call every N claims to reduce DB writes).
 */
async function updateSubTaskProgress(
  artifactId: string,
  progress: SubTaskProgress
): Promise<void> {
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: {
      subTaskProgress: {
        ...progress,
        updatedAt: new Date().toISOString()
      } as Prisma.JsonObject
    }
  });
  console.log(`[SubTask Progress] ${artifactId}: ${progress.phase} ${progress.current}/${progress.total}`);
}

import { generateMentalModel } from './guruFunctions/generators/mentalModelGenerator';
import { generateCurriculum } from './guruFunctions/generators/curriculumGenerator';
import { generateDrillSeriesWithValidation } from './guruFunctions/generators/drillDesigner';
import type { MentalModelOutput } from './guruFunctions/schemas/mentalModelSchema';
import type { CurriculumOutput } from './guruFunctions/schemas/curriculumSchema';
import {
  MENTAL_MODEL_PHASE_KEYS,
  CURRICULUM_PHASE_KEYS,
  DRILL_SERIES_PHASE_KEYS,
} from './teaching/constants';
import { hashPrompt } from './guruFunctions/promptHasher';
import { resolvePromptsForProject } from './guruFunctions/promptResolver';
import { resolveGroundTruthConfig } from './groundTruth/config';
import { extractVerifiableClaims, extractCurriculumClaims } from './groundTruth/claimExtraction';
import { verifyClaimsAgainstGroundTruth } from './groundTruth/verification/batchVerifier';
import { verifyAllDrills } from './groundTruth/verification/drillVerifier';
import type { PhaseOrganizedDrillSeries } from './guruFunctions/schemas/phaseOrganizedDrillSchema';
import { seedPositionsByPhase, getPositionIdsFromSeeded } from './positionLibrary';
import { DEFAULT_DRILL_CONFIG, type DrillGenerationConfig, type GamePhase } from './guruFunctions/types';

/**
 * Valid game phases for config validation
 */
const VALID_GAME_PHASES: Set<GamePhase> = new Set(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']);

/**
 * Normalize and validate drill config from event data.
 * Ensures all values are within safe ranges and have sensible defaults.
 */
function normalizeDrillConfig(config?: Partial<DrillGenerationConfig>): DrillGenerationConfig {
  if (!config) return DEFAULT_DRILL_CONFIG;

  // Validate and filter game phases
  const rawPhases = Array.isArray(config.gamePhases) ? config.gamePhases : [];
  const validPhases = rawPhases.filter((phase): phase is GamePhase => VALID_GAME_PHASES.has(phase as GamePhase));
  const gamePhases = validPhases.length > 0 ? validPhases : DEFAULT_DRILL_CONFIG.gamePhases;

  // Clamp targetDrillCount to safe range (5-50)
  const targetDrillCount = Math.max(5, Math.min(50, config.targetDrillCount ?? DEFAULT_DRILL_CONFIG.targetDrillCount));

  // Clamp directDrillRatio to 0-1 range
  const directDrillRatio = Math.max(0, Math.min(1, config.directDrillRatio ?? DEFAULT_DRILL_CONFIG.directDrillRatio));

  // Boolean validation for useExistingPositions
  const useExistingPositions = typeof config.useExistingPositions === 'boolean'
    ? config.useExistingPositions
    : DEFAULT_DRILL_CONFIG.useExistingPositions;

  // Optional: fetchNewPositionCount (only if valid positive number)
  const fetchNewPositionCount = typeof config.fetchNewPositionCount === 'number' && config.fetchNewPositionCount > 0
    ? Math.min(50, config.fetchNewPositionCount)
    : undefined;

  return {
    gamePhases,
    targetDrillCount,
    directDrillRatio,
    useExistingPositions,
    ...(fetchNewPositionCount && { fetchNewPositionCount }),
  };
}

/**
 * Mental Model generation job
 */
export const mentalModelGenerationJob = inngest.createFunction(
  {
    id: 'mental-model-generation',
    name: 'Generate Mental Model',
    concurrency: { limit: 3 },
  },
  { event: 'guru/generate-mental-model' },
  async ({ event, step }) => {
    const { projectId, artifactId, userNotes } = event.data;

    // Phase 1: Composing Corpus
    await step.run('progress-composing', async () => {
      await updateArtifactProgress(artifactId, MENTAL_MODEL_PHASE_KEYS.COMPOSING_CORPUS);
    });

    // Fetch project with corpus
    const project = await step.run('fetch-project', async () => {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: 'asc' } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    if (!project) {
      await step.run('mark-failed-no-project', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', errorMessage: 'Project not found', progressStage: null },
        });
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    // Fetch guru profile
    const guruProfile = await step.run('fetch-guru-profile', async () => {
      const projectWithProfile = await prisma.project.findUnique({
        where: { id: projectId },
        include: { currentProfile: true }
      });
      const profileData = projectWithProfile?.currentProfile?.profileData;
      return profileData ? (profileData as import('@/lib/guruProfile/types').GuruProfileData) : undefined;
    });

    // Resolve custom prompts for this project
    const prompts = await step.run('resolve-prompts', async () => {
      return await resolvePromptsForProject(projectId, 'MENTAL_MODEL');
    });

    // Phase 2: Analyzing Structure
    await step.run('progress-analyzing', async () => {
      await updateArtifactProgress(artifactId, MENTAL_MODEL_PHASE_KEYS.ANALYZING_STRUCTURE);
    });

    // Phase 3: Extracting Principles (main generation)
    await step.run('progress-extracting', async () => {
      await updateArtifactProgress(artifactId, MENTAL_MODEL_PHASE_KEYS.EXTRACTING_PRINCIPLES);
    });

    // Check for cancellation before expensive generation
    const cancelledBeforeGeneration = await step.run('check-cancelled-before-generation', async () => {
      return await isArtifactCancelled(artifactId);
    });
    if (cancelledBeforeGeneration) {
      console.log(`[Mental Model ${artifactId}] Job stopped - user cancelled`);
      return { artifactId, cancelled: true };
    }

    // Generate mental model
    let result;
    try {
      result = await step.run('generate-mental-model', async () => {
        return await generateMentalModel({
          projectId,
          contextLayers: project.contextLayers.map(l => ({ title: l.title, content: l.content })),
          knowledgeFiles: project.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
          domain: project.name,
          userNotes,
          // Pass custom prompts if configured
          customSystemPrompt: prompts.isCustomSystem ? prompts.systemPrompt : undefined,
          customUserPromptTemplate: prompts.isCustomUser ? prompts.userPromptTemplate ?? undefined : undefined,
          // Pass guru profile if available (convert null to undefined)
          guruProfile: guruProfile ?? undefined,
        });
      });
    } catch (error) {
      await step.run('mark-failed-generation', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Generation failed',
            progressStage: null,
          },
        });
      });
      throw error;
    }

    // Phase 4: Building Framework
    await step.run('progress-building', async () => {
      await updateArtifactProgress(artifactId, MENTAL_MODEL_PHASE_KEYS.BUILDING_FRAMEWORK);
    });

    // Phase 5: Saving Artifact
    await step.run('progress-saving', async () => {
      await updateArtifactProgress(artifactId, MENTAL_MODEL_PHASE_KEYS.SAVING_ARTIFACT);
    });

    // Save artifact with prompt hashes (only if not cancelled)
    const saved = await step.run('save-artifact', async () => {
      // Check if user cancelled during generation
      const currentStatus = await prisma.guruArtifact.findUnique({
        where: { id: artifactId },
        select: { status: true },
      });

      if (currentStatus?.status === 'CANCELLED') {
        console.log(`[Mental Model ${artifactId}] Skipping save - user cancelled during generation`);
        return false;
      }

      // Hash prompts for versioning (use resolved prompts which may be custom)
      const systemPromptHash = hashPrompt(prompts.systemPrompt);
      const userPromptHash = hashPrompt(result.userPrompt);

      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result.content as unknown as Prisma.JsonObject,
          markdownContent: result.markdown,
          corpusHash: result.corpusHash,
          systemPromptHash,
          userPromptHash,
          promptConfigId: prompts.configId,  // Store reference to custom config if used
          status: 'COMPLETED',
          progressStage: null,  // Clear on completion
        },
      });
      return true;
    });

    return { artifactId, success: saved, cancelled: !saved };
  }
);

/**
 * Curriculum generation job
 */
export const curriculumGenerationJob = inngest.createFunction(
  {
    id: 'curriculum-generation',
    name: 'Generate Curriculum',
    concurrency: { limit: 3 },
  },
  { event: 'guru/generate-curriculum' },
  async ({ event, step }) => {
    const { projectId, artifactId, mentalModelArtifactId, userNotes } = event.data;

    // Phase 1: Loading Prerequisites
    await step.run('progress-loading', async () => {
      await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.LOADING_PREREQUISITES);
    });

    // Fetch project with corpus
    const project = await step.run('fetch-project', async () => {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: 'asc' } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    if (!project) {
      await step.run('mark-failed-no-project', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', errorMessage: 'Project not found', progressStage: null },
        });
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    // Fetch mental model artifact
    const mentalModelArtifact = await step.run('fetch-mental-model', async () => {
      return await prisma.guruArtifact.findUnique({
        where: { id: mentalModelArtifactId },
      });
    });

    if (!mentalModelArtifact || mentalModelArtifact.status !== 'COMPLETED') {
      await step.run('mark-failed-no-mental-model', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', errorMessage: 'Mental model not found or not completed', progressStage: null },
        });
      });
      throw new Error('Mental model required for curriculum generation');
    }

    // Fetch guru profile
    const guruProfile = await step.run('fetch-guru-profile', async () => {
      const projectWithProfile = await prisma.project.findUnique({
        where: { id: projectId },
        include: { currentProfile: true }
      });
      const profileData = projectWithProfile?.currentProfile?.profileData;
      return profileData ? (profileData as import('@/lib/guruProfile/types').GuruProfileData) : undefined;
    });

    // Resolve custom prompts for this project
    const prompts = await step.run('resolve-prompts', async () => {
      return await resolvePromptsForProject(projectId, 'CURRICULUM');
    });

    // Phase 2: Analyzing Mental Model
    await step.run('progress-analyzing', async () => {
      await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.ANALYZING_MENTAL_MODEL);
    });

    // Phase 3: Designing Path (main generation)
    await step.run('progress-designing', async () => {
      await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.DESIGNING_PATH);
    });

    // Check for cancellation before expensive generation
    const cancelledBeforeGeneration = await step.run('check-cancelled-before-generation', async () => {
      return await isArtifactCancelled(artifactId);
    });
    if (cancelledBeforeGeneration) {
      console.log(`[Curriculum ${artifactId}] Job stopped - user cancelled`);
      return { artifactId, cancelled: true };
    }

    // Generate curriculum
    let result;
    try {
      result = await step.run('generate-curriculum', async () => {
        return await generateCurriculum({
          projectId,
          contextLayers: project.contextLayers.map(l => ({ title: l.title, content: l.content })),
          knowledgeFiles: project.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
          domain: project.name,
          userNotes,
          mentalModel: mentalModelArtifact.content as unknown as MentalModelOutput,
          // Pass custom prompts if configured
          customSystemPrompt: prompts.isCustomSystem ? prompts.systemPrompt : undefined,
          customUserPromptTemplate: prompts.isCustomUser ? prompts.userPromptTemplate ?? undefined : undefined,
          // Pass guru profile if available (convert null to undefined)
          guruProfile: guruProfile ?? undefined,
        });
      });
    } catch (error) {
      await step.run('mark-failed-generation', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Generation failed',
            progressStage: null,
          },
        });
      });
      throw error;
    }

    // Phase 4: Structuring Modules
    await step.run('progress-structuring', async () => {
      await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.STRUCTURING_MODULES);
    });

    // Check if ground truth verification is enabled
    const gtConfig = await step.run('check-ground-truth-config', async () => {
      return await resolveGroundTruthConfig(projectId);
    });

    // Phase 4.5: Verification (if enabled)
    let verificationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'UNVERIFIED' | 'FAILED' | null = null;
    let verificationDetails: Record<string, unknown> | null = null;

    if (gtConfig?.enabled) {
      await step.run('progress-verifying', async () => {
        await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.VERIFYING_CONTENT);
      });

      try {
        // Extract verifiable claims from curriculum content
        const claims = await step.run('extract-curriculum-claims', async () => {
          return extractCurriculumClaims(result.content);
        });

        console.log(`[Curriculum ${artifactId}] Extracted ${claims.length} verifiable claims`);

        // Verify claims against ground truth (if any claims were extracted)
        if (claims.length > 0) {
          // Initialize sub-task progress for verification phase
          await step.run('init-subtask-progress', async () => {
            await updateSubTaskProgress(artifactId, {
              phase: 'VERIFYING_CONTENT',
              current: 0,
              total: claims.length,
              currentClaimText: 'Starting verification...'
            });
          });

          const verificationResult = await step.run('verify-curriculum-claims', async () => {
            return await verifyClaimsAgainstGroundTruth(claims, gtConfig);
          });

          // Update sub-task progress to show completion
          await step.run('complete-subtask-progress', async () => {
            await updateSubTaskProgress(artifactId, {
              phase: 'VERIFYING_CONTENT',
              current: claims.length,
              total: claims.length,
              currentClaimText: `Verified ${verificationResult.summary.verifiedClaims}/${claims.length} claims`
            });
          });

          console.log(
            `[Curriculum ${artifactId}] Verification complete: ${verificationResult.status} ` +
            `(${verificationResult.summary.verifiedClaims}/${verificationResult.summary.totalClaims} verified)`
          );

          verificationStatus = verificationResult.status;
          verificationDetails = {
            toolCalls: verificationResult.toolCalls,
            claims: verificationResult.claims,
            summary: verificationResult.summary,
          };
        } else {
          // No claims to verify - mark as unverified (no content to check)
          console.log(`[Curriculum ${artifactId}] No verifiable claims found in curriculum content`);
          verificationStatus = 'UNVERIFIED';
          verificationDetails = {
            message: 'No verifiable claims found in curriculum content',
            summary: { totalClaims: 0, verifiedClaims: 0, failedClaims: 0, cachedResponses: 0 },
          };
        }
      } catch (error) {
        console.error(`[Curriculum ${artifactId}] Verification error:`, error);
        verificationStatus = 'FAILED';
        verificationDetails = {
          error: error instanceof Error ? error.message : 'Unknown verification error',
        };
      }
    }

    // Phase 5: Saving Artifact
    await step.run('progress-saving', async () => {
      await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.SAVING_ARTIFACT);
    });

    // Save artifact with prompt hashes and verification results (only if not cancelled)
    const saved = await step.run('save-artifact', async () => {
      // Check if user cancelled during generation
      const currentStatus = await prisma.guruArtifact.findUnique({
        where: { id: artifactId },
        select: { status: true },
      });

      if (currentStatus?.status === 'CANCELLED') {
        console.log(`[Curriculum ${artifactId}] Skipping save - user cancelled during generation`);
        return false;
      }

      // Hash prompts for versioning (use resolved prompts which may be custom)
      const systemPromptHash = hashPrompt(prompts.systemPrompt);
      const userPromptHash = hashPrompt(result.userPrompt);

      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result.content as unknown as Prisma.JsonObject,
          markdownContent: result.markdown,
          corpusHash: result.corpusHash,
          systemPromptHash,
          userPromptHash,
          promptConfigId: prompts.configId,  // Store reference to custom config if used
          status: 'COMPLETED',
          progressStage: null,  // Clear on completion
          // Verification results (if ground truth was enabled)
          ...(verificationStatus && {
            verificationStatus,
            verificationDetails: verificationDetails as Prisma.JsonObject,
            verificationAttempts: 1,
            lastVerifiedAt: new Date(),
          }),
        },
      });
      return true;
    });

    return { artifactId, success: saved, cancelled: !saved };
  }
);

/**
 * Drill series generation job
 */
export const drillSeriesGenerationJob = inngest.createFunction(
  {
    id: 'drill-series-generation',
    name: 'Generate Drill Series',
    concurrency: { limit: 3 },
  },
  { event: 'guru/generate-drill-series' },
  async ({ event, step }) => {
    const { projectId, artifactId, mentalModelArtifactId, curriculumArtifactId, userNotes, drillConfig: rawDrillConfig } = event.data;

    // Normalize drill config to ensure values are within safe ranges
    const drillConfig = normalizeDrillConfig(rawDrillConfig);

    // Phase 1: Loading Prerequisites
    await step.run('progress-loading', async () => {
      await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.LOADING_PREREQUISITES);
    });

    // Fetch project with corpus
    const project = await step.run('fetch-project', async () => {
      return await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true }, orderBy: { priority: 'asc' } },
          knowledgeFiles: { where: { isActive: true } },
        },
      });
    });

    if (!project) {
      await step.run('mark-failed-no-project', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', errorMessage: 'Project not found', progressStage: null },
        });
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    // Fetch prerequisite artifacts
    const [mentalModelArtifact, curriculumArtifact] = await step.run('fetch-prerequisites', async () => {
      return await Promise.all([
        prisma.guruArtifact.findUnique({ where: { id: mentalModelArtifactId } }),
        prisma.guruArtifact.findUnique({ where: { id: curriculumArtifactId } }),
      ]);
    });

    if (!mentalModelArtifact || mentalModelArtifact.status !== 'COMPLETED') {
      await step.run('mark-failed-no-mental-model', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', errorMessage: 'Mental model not found or not completed', progressStage: null },
        });
      });
      throw new Error('Mental model required for drill series generation');
    }

    if (!curriculumArtifact || curriculumArtifact.status !== 'COMPLETED') {
      await step.run('mark-failed-no-curriculum', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', errorMessage: 'Curriculum not found or not completed', progressStage: null },
        });
      });
      throw new Error('Curriculum required for drill series generation');
    }

    // Fetch guru profile
    const guruProfile = await step.run('fetch-guru-profile', async () => {
      const projectWithProfile = await prisma.project.findUnique({
        where: { id: projectId },
        include: { currentProfile: true }
      });
      const profileData = projectWithProfile?.currentProfile?.profileData;
      return profileData ? (profileData as import('@/lib/guruProfile/types').GuruProfileData) : undefined;
    });

    // Resolve custom prompts for this project
    const prompts = await step.run('resolve-prompts', async () => {
      return await resolvePromptsForProject(projectId, 'DRILL_SERIES');
    });

    // Check if ground truth is enabled and seed positions if available
    const seededPositions = await step.run('seed-positions', async () => {
      const gtConfig = await resolveGroundTruthConfig(projectId);
      if (!gtConfig?.enabled) {
        console.log(`[Drill Series ${artifactId}] Ground truth not enabled, skipping position seeding`);
        return null;
      }

      // Calculate dynamic position limit based on drill count and phases
      // This reduces token usage by loading only what's needed
      const phasesCount = drillConfig?.gamePhases?.length ?? 1;
      const targetDrills = drillConfig?.targetDrillCount ?? 21;
      const positionsPerPhase = Math.ceil(targetDrills / phasesCount) + 2; // +2 buffer for variety

      // Cap at user-specified max or default of 25
      const dynamicLimit = Math.min(
        positionsPerPhase,
        drillConfig?.maxPositionsPerPhase ?? 25
      );

      console.log(`[Drill Series ${artifactId}] Dynamic position limit: ${dynamicLimit}/phase (${targetDrills} drills ÷ ${phasesCount} phases + 2 buffer)`);

      // Fetch positions from the Position Library (filtered by requested game phases)
      const positions = await seedPositionsByPhase(
        gtConfig.engineId,
        drillConfig?.gamePhases,
        dynamicLimit
      );
      if (!positions) {
        console.log(`[Drill Series ${artifactId}] No positions found, using standard generation`);
        return null;
      }

      const totalPositions = positions.OPENING.length + positions.EARLY.length + positions.MIDDLE.length + positions.BEAROFF.length;
      console.log(`[Drill Series ${artifactId}] Seeded ${totalPositions} positions (OPENING=${positions.OPENING.length}, EARLY=${positions.EARLY.length}, MIDDLE=${positions.MIDDLE.length}, BEAROFF=${positions.BEAROFF.length})`);
      return positions;
    });

    // Phase 2: Analyzing Curriculum
    await step.run('progress-analyzing', async () => {
      await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.ANALYZING_CURRICULUM);
    });

    // Phase 3: Designing Exercises
    await step.run('progress-designing', async () => {
      await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.DESIGNING_EXERCISES);
    });

    // Phase 4: Generating Content (main generation)
    await step.run('progress-generating', async () => {
      await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.GENERATING_CONTENT);
    });

    // Check for cancellation before expensive generation
    const cancelledBeforeGeneration = await step.run('check-cancelled-before-generation', async () => {
      return await isArtifactCancelled(artifactId);
    });
    if (cancelledBeforeGeneration) {
      console.log(`[Drill Series ${artifactId}] Job stopped - user cancelled`);
      return { artifactId, cancelled: true };
    }

    // Initialize sub-task progress for generation phase (shows target drill count to users)
    await step.run('init-generation-progress', async () => {
      await updateSubTaskProgress(artifactId, {
        phase: 'GENERATING_CONTENT',
        current: 0,
        total: drillConfig.targetDrillCount,
        currentClaimText: `Generating ${drillConfig.targetDrillCount} drills...`
      });
    });

    // Generate drill series with validation
    let result;
    try {
      result = await step.run('generate-drill-series', async () => {
        console.log(`[Drill Series ${artifactId}] Starting generation with validation (target: ${drillConfig.targetDrillCount} drills)`);

        return await generateDrillSeriesWithValidation({
          projectId,
          contextLayers: project.contextLayers.map(l => ({ title: l.title, content: l.content })),
          knowledgeFiles: project.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
          domain: project.name,
          userNotes,
          mentalModel: mentalModelArtifact.content as unknown as MentalModelOutput,
          curriculum: curriculumArtifact.content as unknown as CurriculumOutput,
          // Pass custom prompts if configured
          customSystemPrompt: prompts.isCustomSystem ? prompts.systemPrompt : undefined,
          customUserPromptTemplate: prompts.isCustomUser ? prompts.userPromptTemplate ?? undefined : undefined,
          // Pass guru profile if available (convert null to undefined)
          guruProfile: guruProfile ?? undefined,
          // Pass seeded positions for scenario-based drills
          seededPositions,
          // Pass drill configuration (required for validation)
          drillConfig,
        });
      });

      // Log validation results
      if (result.validationWarning) {
        console.warn(`[Drill Series ${artifactId}] Validation warning:`, result.validationWarning);
        console.log(`[Drill Series ${artifactId}] Accepted partial result after ${result.retryCount} retry attempts`);
      } else {
        console.log(`[Drill Series ${artifactId}] Validation passed (${result.retryCount === 0 ? 'first attempt' : `after ${result.retryCount} retries`})`);
      }

      // Calculate actual drill count from generated content
      const actualDrillCount = result.content.phases?.reduce(
        (sum: number, phase: { principleGroups: Array<{ drills: unknown[] }> }) => sum + phase.principleGroups.reduce(
          (groupSum: number, group: { drills: unknown[] }) => groupSum + group.drills.length, 0
        ), 0
      ) || 0;

      // Update generation progress to show completion
      await step.run('complete-generation-progress', async () => {
        await updateSubTaskProgress(artifactId, {
          phase: 'GENERATING_CONTENT',
          current: actualDrillCount,
          total: drillConfig.targetDrillCount,
          currentClaimText: `Generated ${actualDrillCount} drills`
        });
      });
    } catch (error) {
      await step.run('mark-failed-generation', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Generation failed',
            progressStage: null,
          },
        });
      });
      throw error;
    }

    // Check if ground truth verification is enabled
    const gtConfig = await step.run('check-ground-truth-config', async () => {
      return await resolveGroundTruthConfig(projectId);
    });

    // Phase 4.5: Per-Drill Verification (if enabled)
    if (gtConfig?.enabled) {
      await step.run('progress-verifying', async () => {
        await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.VERIFYING_CONTENT);
      });

      try {
        // Cast content to phase-organized schema
        const drillContent = result.content as unknown as PhaseOrganizedDrillSeries;

        // Count total drills for progress tracking
        const totalDrills = drillContent.phases?.reduce(
          (sum, phase) => sum + phase.principleGroups.reduce(
            (groupSum, group) => groupSum + group.drills.length, 0
          ), 0
        ) || 0;

        console.log(`[Drill Series ${artifactId}] Starting per-drill verification for ${totalDrills} drills`);

        // Initialize sub-task progress for verification phase
        if (totalDrills > 0) {
          await step.run('init-subtask-progress', async () => {
            await updateSubTaskProgress(artifactId, {
              phase: 'VERIFYING_CONTENT',
              current: 0,
              total: totalDrills,
              currentClaimText: 'Verifying drills against ground truth...'
            });
          });
        }

        // Verify ALL drills against ground truth (not just extracted claims)
        const verificationResult = await step.run('verify-all-drills', async () => {
          return await verifyAllDrills(drillContent, gtConfig);
        });

        // Update sub-task progress to show completion
        if (totalDrills > 0) {
          await step.run('complete-subtask-progress', async () => {
            await updateSubTaskProgress(artifactId, {
              phase: 'VERIFYING_CONTENT',
              current: totalDrills,
              total: totalDrills,
              currentClaimText: `Verified ${verificationResult.summary.verifiedDrills}/${totalDrills} drills`
            });
          });
        }

        console.log(
          `[Drill Series ${artifactId}] Per-drill verification complete: ${verificationResult.status} ` +
          `(${verificationResult.summary.verifiedDrills} verified, ${verificationResult.summary.failedDrills} failed, ${verificationResult.summary.skippedDrills} skipped)`
        );

        // Update artifact with per-drill verification results
        await step.run('save-verification', async () => {
          await prisma.guruArtifact.update({
            where: { id: artifactId },
            data: {
              verificationStatus: verificationResult.status,
              verificationDetails: {
                drills: verificationResult.drills,
                summary: verificationResult.summary,
              } as unknown as Prisma.JsonObject,
              verificationAttempts: 1,
              lastVerifiedAt: new Date(),
            },
          });
        });
      } catch (verificationError) {
        // Log verification error but don't fail the entire generation
        console.error(
          `[Drill Series ${artifactId}] Per-drill verification failed:`,
          verificationError instanceof Error ? verificationError.message : 'Unknown error'
        );

        // Mark verification as failed in database
        await step.run('mark-verification-failed', async () => {
          await prisma.guruArtifact.update({
            where: { id: artifactId },
            data: {
              verificationStatus: 'FAILED',
              verificationDetails: {
                error: verificationError instanceof Error ? verificationError.message : 'Unknown error',
              } as unknown as Prisma.JsonObject,
              verificationAttempts: 1,
              lastVerifiedAt: new Date(),
            },
          });
        });
      }
    } else {
      console.log(`[Drill Series ${artifactId}] Ground truth verification not enabled, skipping`);
    }

    // Phase 5: Saving Artifact
    await step.run('progress-saving', async () => {
      await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.SAVING_ARTIFACT);
    });

    // Save artifact with prompt hashes, positionsUsed, and validation metadata (only if not cancelled)
    const saved = await step.run('save-artifact', async () => {
      // Check if user cancelled during generation
      const currentStatus = await prisma.guruArtifact.findUnique({
        where: { id: artifactId },
        select: { status: true },
      });

      if (currentStatus?.status === 'CANCELLED') {
        console.log(`[Drill Series ${artifactId}] Skipping save - user cancelled during generation`);
        return false;
      }

      // Hash prompts for versioning (use resolved prompts which may be custom)
      const systemPromptHash = hashPrompt(prompts.systemPrompt);
      const userPromptHash = hashPrompt(result.userPrompt);

      // Get position IDs if positions were seeded
      const positionsUsed = getPositionIdsFromSeeded(seededPositions);

      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          content: result.content as unknown as Prisma.JsonObject,
          markdownContent: result.markdown,
          corpusHash: result.corpusHash,
          systemPromptHash,
          userPromptHash,
          promptConfigId: prompts.configId,  // Store reference to custom config if used
          positionsUsed: positionsUsed.length > 0 ? positionsUsed : [],
          // Store validation metadata
          validationWarning: result.validationWarning ?? null,
          validationRetryCount: result.retryCount,
          status: 'COMPLETED',
          progressStage: null,  // Clear on completion
        },
      });
      return true;
    });

    // Only populate drill table if save succeeded (artifact not cancelled)
    if (saved) {
      // Phase 6: Populate Drill Table (two-table architecture sync)
      await step.run('populate-drill-table', async () => {
        const { populateDrillsFromArtifact } = await import('./drills/sync');
        const populateResult = await populateDrillsFromArtifact(artifactId);
        console.log(`[Drill Series ${artifactId}] Populated ${populateResult.created} drill records (skipped: ${populateResult.skipped})`);
        if (populateResult.errors.length > 0) {
          console.warn(`[Drill Series ${artifactId}] Population warnings: ${populateResult.errors.join(', ')}`);
        }
      });
    }

    return { artifactId, success: saved, cancelled: !saved };
  }
);

/**
 * Artifact Regeneration job - handles re-generation of artifacts that need review
 */
export const artifactRegenerationJob = inngest.createFunction(
  {
    id: 'artifact-regeneration',
    name: 'Regenerate Artifact',
    retries: 1,
  },
  { event: 'guru/regenerate-artifact' },
  async ({ event, step }) => {
    const { artifactId, projectId, artifactType, scope, previousFailures } = event.data;

    console.log(`[Regenerate] Starting regeneration for artifact ${artifactId} (${artifactType}) - Scope: ${scope}`);

    try {
      // Get the original artifact to understand its dependencies
      const artifact = await step.run('fetch-artifact', async () => {
        return await prisma.guruArtifact.findUnique({
          where: { id: artifactId },
          include: {
            project: true,
            dependsOn: true, // Get the artifact this one depends on
          },
        });
      });

      if (!artifact) {
        throw new Error(`Artifact not found: ${artifactId}`);
      }

      // Route to appropriate generator based on artifact type
      switch (artifactType) {
        case 'MENTAL_MODEL': {
          // Mental model has no dependencies, just regenerate
          console.log(`[Regenerate] Triggering mental model generation for ${artifactId}`);

          await step.sendEvent('trigger-mental-model', {
            name: 'guru/generate-mental-model',
            data: {
              projectId,
              artifactId, // Reuse same artifact ID to update in place
            },
          });
          break;
        }

        case 'CURRICULUM': {
          // Curriculum depends on mental model - find the latest completed one
          const mentalModel = await step.run('find-mental-model', async () => {
            return await prisma.guruArtifact.findFirst({
              where: {
                projectId,
                type: 'MENTAL_MODEL',
                status: 'COMPLETED',
              },
              orderBy: { version: 'desc' },
            });
          });

          if (!mentalModel) {
            throw new Error('No completed mental model found for curriculum regeneration');
          }

          console.log(`[Regenerate] Triggering curriculum generation for ${artifactId} based on mental model ${mentalModel.id}`);

          await step.sendEvent('trigger-curriculum', {
            name: 'guru/generate-curriculum',
            data: {
              projectId,
              artifactId, // Reuse same artifact ID to update in place
              mentalModelArtifactId: mentalModel.id,
            },
          });
          break;
        }

        case 'DRILL_SERIES': {
          // Drill series depends on both mental model and curriculum
          const [mentalModel, curriculum] = await step.run('find-dependencies', async () => {
            return await Promise.all([
              prisma.guruArtifact.findFirst({
                where: {
                  projectId,
                  type: 'MENTAL_MODEL',
                  status: 'COMPLETED',
                },
                orderBy: { version: 'desc' },
              }),
              prisma.guruArtifact.findFirst({
                where: {
                  projectId,
                  type: 'CURRICULUM',
                  status: 'COMPLETED',
                },
                orderBy: { version: 'desc' },
              }),
            ]);
          });

          if (!mentalModel) {
            throw new Error('No completed mental model found for drill series regeneration');
          }

          if (!curriculum) {
            throw new Error('No completed curriculum found for drill series regeneration');
          }

          console.log(
            `[Regenerate] Triggering drill series generation for ${artifactId} based on mental model ${mentalModel.id} and curriculum ${curriculum.id}`
          );

          await step.sendEvent('trigger-drill-series', {
            name: 'guru/generate-drill-series',
            data: {
              projectId,
              artifactId, // Reuse same artifact ID to update in place
              mentalModelArtifactId: mentalModel.id,
              curriculumArtifactId: curriculum.id,
            },
          });
          break;
        }

        default: {
          throw new Error(`Unknown artifact type: ${artifactType}`);
        }
      }

      console.log(`[Regenerate] Successfully triggered regeneration for ${artifactId}`);

      return {
        success: true,
        artifactId,
        artifactType,
        scope,
      };

    } catch (error) {
      console.error(`[Regenerate] Failed to regenerate artifact ${artifactId}:`, error);

      // Mark artifact as failed
      await step.run('mark-failed', async () => {
        await prisma.guruArtifact.update({
          where: { id: artifactId },
          data: {
            status: 'FAILED',
            progressStage: null,
            errorMessage: error instanceof Error ? error.message : 'Regeneration failed',
          },
        });
      });

      throw error;
    }
  }
);

// =============================================================================
// MATCH ARCHIVE IMPORT FUNCTIONS
// =============================================================================

import {
  parseJellyFishMatch,
  enrichMatchMetadata,
  replayMatch,
  classifyPhase,
  generateAsciiBoard,
  boardStateToMCPFormat,
  generatePositionIdFromBoard,
  readArchiveFile,
} from './matchImport'
import type { ParsedMatch, DiceRoll } from './matchImport'
import {
  discoverHardyArchives,
  downloadArchive,
  filterAlreadyImported,
  storeArchiveFile,
} from './matchImport'
import type { DiscoveredArchive } from './matchImport'
import { getPlaysForPosition, formatMove } from './groundTruth/mcpClient'
import type { GroundTruthConfig } from './groundTruth/types'

/**
 * Scrape match archives from Hardy's Backgammon Pages.
 *
 * This job discovers all .txt files on Hardy's site, filters out already-imported
 * ones, then downloads and processes each one incrementally (saving to DB after
 * each download to avoid losing progress on failures).
 */
export const scrapeMatchArchivesJob = inngest.createFunction(
  {
    id: 'scrape-match-archives',
    name: 'Scrape Match Archives',
    retries: 1,
  },
  { event: 'match-archive/scrape.started' },
  async ({ event, step }) => {
    const { collection, engineId } = event.data as {
      collection: 'Hardy'
      engineId: string
    }

    // Step 1: Discover all archives from the collection
    const archives = await step.run('discover-archives', async () => {
      if (collection === 'Hardy') {
        return discoverHardyArchives()
      }
      throw new Error(`Unknown collection: ${collection}`)
    })

    console.log(`[Scraper] Discovered ${archives.length} archives from ${collection}`)

    // Step 2: Filter out already-imported archives
    const scrapeResult = await step.run('filter-imported', async () => {
      return filterAlreadyImported(archives, prisma)
    })

    console.log(
      `[Scraper] ${scrapeResult.alreadyImported} already imported, ${scrapeResult.toProcess.length} to process`
    )

    if (scrapeResult.toProcess.length === 0) {
      return {
        collection,
        discovered: scrapeResult.discovered,
        alreadyImported: scrapeResult.alreadyImported,
        processed: 0,
        failed: 0,
        message: 'All archives already imported',
      }
    }

    // Step 3: Process each archive individually
    // Each archive is processed in its own step for incremental progress
    // Rate limiting: 1 second delay between downloads to be respectful to Hardy's server
    const DOWNLOAD_DELAY_MS = 1000
    let processed = 0
    let failed = 0
    const failures: Array<{ filename: string; error: string }> = []

    for (let i = 0; i < scrapeResult.toProcess.length; i++) {
      const archive = scrapeResult.toProcess[i]

      try {
        await step.run(`import-${archive.filename}`, async () => {
          // Download the file
          const content = await downloadArchive(archive.url)

          // Create the MatchArchive record
          const record = await prisma.matchArchive.create({
            data: {
              filename: archive.filename,
              sourceUrl: archive.url,
              sourceCollection: collection,
              importStatus: 'PENDING',
              totalMatches: 0,
              totalGames: 0,
              totalPositions: 0,
              positionsVerified: 0,
            },
          })

          // Store the file content locally
          await storeArchiveFile(record.id, content)

          // Trigger the existing import job to process this archive
          await inngest.send({
            name: 'match-archive/import.started',
            data: {
              archiveId: record.id,
              engineId,
            },
          })

          return { archiveId: record.id, filename: archive.filename }
        })

        processed++

        // Rate limiting: delay between downloads (skip on last item)
        if (i < scrapeResult.toProcess.length - 1) {
          await step.sleep(`rate-limit-${i}`, DOWNLOAD_DELAY_MS)
        }
      } catch (error) {
        failed++
        failures.push({
          filename: archive.filename,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error(`[Scraper] Failed to process ${archive.filename}:`, error)
        // Continue processing other archives
      }
    }

    return {
      collection,
      discovered: scrapeResult.discovered,
      alreadyImported: scrapeResult.alreadyImported,
      processed,
      failed,
      failures: failures.slice(0, 10), // Only include first 10 failures in response
      message:
        failed > 0
          ? `Processed ${processed} archives with ${failed} failures`
          : `Successfully processed ${processed} archives`,
    }
  }
)

/**
 * Match archive import job - parses file, replays games, stores positions
 */
export const matchArchiveImportJob = inngest.createFunction(
  {
    id: 'match-archive-import',
    name: 'Import Match Archive',
    retries: 3,
  },
  { event: 'match-archive/import.started' },
  async ({ event, step }) => {
    const { archiveId, engineId } = event.data

    // Step 1: Update status to parsing
    await step.run('update-status-parsing', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: { importStatus: 'PARSING' }
      })
    })

    // Step 2: Parse the match file
    const parseResult = await step.run('parse-match-file', async () => {
      const archive = await prisma.matchArchive.findUnique({
        where: { id: archiveId }
      })
      if (!archive) throw new Error('Archive not found')

      const content = await readArchiveFile(archiveId)
      const result = parseJellyFishMatch(content)

      if (!result.success || !result.match) {
        throw new Error(`Parse failed: ${result.errors.map(e => e.message).join(', ')}`)
      }

      return enrichMatchMetadata(result.match, archive.filename, archive.sourceCollection || undefined)
    })

    // Step 3: Create ImportedMatch records
    const matchIds = await step.run('create-match-records', async () => {
      const ids: string[] = []

      // Create one ImportedMatch per match (first game of each match)
      // For single-match files, there's one ImportedMatch
      const importedMatch = await prisma.importedMatch.create({
        data: {
          archiveId,
          tournamentName: parseResult.metadata.tournamentName,
          matchLength: parseResult.matchLength,
          player1Name: parseResult.games[0]?.player1.name || 'Player 1',
          player1Country: parseResult.games[0]?.player1.country,
          player2Name: parseResult.games[0]?.player2.name || 'Player 2',
          player2Country: parseResult.games[0]?.player2.country,
          totalGames: parseResult.games.length,
        }
      })
      ids.push(importedMatch.id)

      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          totalMatches: 1,
          totalGames: parseResult.games.length
        }
      })

      return ids
    })

    // Step 4: Update status to replaying
    await step.run('update-status-replaying', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: { importStatus: 'REPLAYING' }
      })
    })

    // Step 5: Replay all games and extract positions
    const positionIds = await step.run('replay-and-store-positions', async () => {
      // Cast parseResult back to ParsedMatch since Inngest step.run serializes/deserializes
      const replayResult = replayMatch(parseResult as unknown as ParsedMatch)
      const ids: string[] = []

      // Filter out OPENING positions (we use the opening catalog for those)
      const positions = replayResult.positions.filter(pos => {
        const phase = classifyPhase(pos)
        return phase.phase !== 'OPENING'
      })

      // Store each position
      for (const pos of positions) {
        const positionId = generatePositionIdFromBoard(pos.board, pos.dice as [number, number], pos.player)
        const diceRoll = `${pos.dice[0]}-${pos.dice[1]}`
        const phase = classifyPhase(pos)

        try {
          // Store board config as metadata for later verification
          const boardConfig = boardStateToMCPFormat(pos.board)

          await prisma.positionLibrary.upsert({
            where: { positionId },
            create: {
              positionId,
              gamePhase: phase.phase,
              diceRoll,
              bestMove: '',  // Will be filled during verification
              bestMoveEquity: 0,
              asciiBoard: generateAsciiBoard(pos.board),
              sourceType: 'MATCH_IMPORT',
              engineId,
              archiveId,
              matchId: matchIds[0],
              gameNumber: pos.gameNumber,
              moveNumber: pos.moveNumber,
              probabilityBreakdown: {
                metadata: {
                  board: boardConfig as { x: Record<string, number>; o: Record<string, number> },
                  dice: pos.dice,
                  player: pos.player,
                  pipCountX: pos.pipCountX,
                  pipCountO: pos.pipCountO,
                }
              } as Prisma.InputJsonValue
            },
            update: {} // Skip if already exists (deduplication)
          })
          ids.push(positionId)
        } catch (error) {
          console.error(`[Match Import] Failed to store position ${positionId}:`, error)
        }
      }

      return ids
    })

    // Step 6: Update status and queue verification
    await step.run('update-status-verifying', async () => {
      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          importStatus: 'VERIFYING',
          totalPositions: positionIds.length
        }
      })
    })

    // Step 7: Send verification events in batches
    const BATCH_SIZE = 50
    const batches: string[][] = []
    for (let i = 0; i < positionIds.length; i += BATCH_SIZE) {
      batches.push(positionIds.slice(i, i + BATCH_SIZE))
    }

    for (let i = 0; i < batches.length; i++) {
      await step.sendEvent(`send-verification-batch-${i}`, {
        name: 'match-archive/verify-batch',
        data: {
          archiveId,
          positionIds: batches[i],
          batchNumber: i + 1,
          totalBatches: batches.length,
          engineId
        }
      })
    }

    // If no positions to verify, mark as complete
    if (positionIds.length === 0) {
      await step.run('mark-complete-no-positions', async () => {
        await prisma.matchArchive.update({
          where: { id: archiveId },
          data: {
            importStatus: 'COMPLETED',
            completedAt: new Date()
          }
        })
      })
    }

    return {
      success: true,
      archiveId,
      positionsQueued: positionIds.length,
      batches: batches.length
    }
  }
)

/**
 * Verify positions against GNUBG in throttled batches
 */
export const verifyPositionBatchJob = inngest.createFunction(
  {
    id: 'verify-position-batch',
    name: 'Verify Position Batch',
    concurrency: {
      limit: 3  // Max 3 concurrent batch verifications
    },
    throttle: {
      limit: 10,
      period: '1s'
    }
  },
  { event: 'match-archive/verify-batch' },
  async ({ event, step }) => {
    const { archiveId, positionIds, batchNumber, totalBatches, engineId } = event.data

    // Get engine config
    const engineConfig = await step.run('get-engine-config', async () => {
      const engine = await prisma.groundTruthEngine.findUnique({
        where: { id: engineId }
      })

      if (!engine) {
        throw new Error(`Engine not found: ${engineId}`)
      }

      return {
        enabled: true,
        engineUrl: engine.engineUrl,
        engineId: engine.id,
        engineName: engine.name,
        domain: engine.domain,
        configId: ''
      } as GroundTruthConfig
    })

    let verified = 0
    let errors = 0

    // Verify each position
    for (const positionId of positionIds) {
      await step.run(`verify-${positionId}`, async () => {
        try {
          const position = await prisma.positionLibrary.findUnique({
            where: { positionId }
          })

          if (!position) {
            console.warn(`[Verify] Position not found: ${positionId}`)
            return
          }

          // Skip if already verified
          if (position.bestMove && position.bestMove !== '') {
            verified++
            return
          }

          // Extract board config from stored metadata
          const probBreakdown = position.probabilityBreakdown as {
            metadata?: {
              board: { x: Record<string, number>; o: Record<string, number> }
              dice: DiceRoll
              player: 'x' | 'o'
            }
          } | null

          if (!probBreakdown?.metadata?.board) {
            console.error(`[Verify] No board metadata for position ${positionId}`)
            errors++
            return
          }

          const { board, dice, player } = probBreakdown.metadata

          // Query GNUBG for best moves
          const moves = await getPlaysForPosition(
            {
              board,
              cubeful: false,
              dice: dice as [number, number],
              player,
              'max-moves': 3
            },
            engineConfig
          )

          if (moves && moves.length > 0) {
            await prisma.positionLibrary.update({
              where: { positionId },
              data: {
                bestMove: formatMove(moves[0].play),
                bestMoveEquity: moves[0].evaluation.eq,
                secondBestMove: moves[1] ? formatMove(moves[1].play) : null,
                secondEquity: moves[1]?.evaluation.eq ?? null,
                thirdBestMove: moves[2] ? formatMove(moves[2].play) : null,
                thirdEquity: moves[2]?.evaluation.eq ?? null,
                probabilityBreakdown: {
                  ...probBreakdown,
                  best: moves[0].evaluation.probability,
                  second: moves[1]?.evaluation.probability ?? null,
                  third: moves[2]?.evaluation.probability ?? null
                }
              }
            })
            verified++
          }
        } catch (error) {
          console.error(`[Verify] Failed for ${positionId}:`, error)
          errors++
        }
      })

      // Small delay between verifications to avoid overwhelming the engine
      await step.sleep(`delay-${positionId}`, '100ms')
    }

    // Update archive stats
    await step.run('update-archive-stats', async () => {
      const archive = await prisma.matchArchive.findUnique({
        where: { id: archiveId }
      })

      if (!archive) return

      const newVerified = archive.positionsVerified + verified

      await prisma.matchArchive.update({
        where: { id: archiveId },
        data: {
          positionsVerified: newVerified
        }
      })

      // Check if all batches are done (this is the final batch)
      if (batchNumber === totalBatches) {
        // Re-fetch to get accurate count (already includes our update from above)
        const finalArchive = await prisma.matchArchive.findUnique({
          where: { id: archiveId }
        })

        if (finalArchive) {
          // Mark complete if 95%+ verified (allowing some failures)
          // Note: finalArchive.positionsVerified already includes this batch's verified count
          const verificationRate = finalArchive.totalPositions > 0
            ? finalArchive.positionsVerified / finalArchive.totalPositions
            : 1

          if (verificationRate >= MIN_VERIFICATION_RATE_FOR_COMPLETION) {
            await prisma.matchArchive.update({
              where: { id: archiveId },
              data: {
                importStatus: 'COMPLETED',
                completedAt: new Date()
              }
            })
          } else {
            console.warn(
              `[Match Import ${archiveId}] Import incomplete: ${finalArchive.positionsVerified}/${finalArchive.totalPositions} verified (${Math.round(verificationRate * 100)}%)`
            )
          }
        }
      }
    })

    return {
      batchNumber,
      totalBatches,
      verified,
      errors
    }
  }
)

// =============================================================================
// SELF-PLAY POSITION GENERATION
// =============================================================================

import { runSelfPlayBatch } from './positionLibrary/selfPlayGenerator'
import type { SelfPlayConfig, GeneratedPosition } from './positionLibrary/selfPlayGenerator'

/**
 * Self-play position generation job
 *
 * Simulates backgammon games using GNUBG engine and stores all positions
 * to the Position Library for scenario-based drill generation.
 */
export const selfPlayGenerationJob = inngest.createFunction(
  {
    id: 'self-play-generation',
    name: 'Self-Play Position Generation',
    concurrency: { limit: 1 }, // Only one self-play job at a time
    retries: 2,
  },
  { event: 'position-library/self-play.started' },
  async ({ event, step }) => {
    const { batchId, engineId, gamesCount, skipOpening } = event.data as {
      batchId: string
      engineId: string
      gamesCount: number
      skipOpening: boolean
    }

    // Step 1: Update batch status to RUNNING
    await step.run('update-status-running', async () => {
      await prisma.selfPlayBatch.update({
        where: { id: batchId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })
    })

    // Step 2: Get engine config
    const engineConfig = await step.run('get-engine-config', async () => {
      const engine = await prisma.groundTruthEngine.findUnique({
        where: { id: engineId },
      })

      if (!engine) {
        throw new Error(`Engine not found: ${engineId}`)
      }

      if (!engine.isActive) {
        throw new Error(`Engine is not active: ${engine.name}`)
      }

      return {
        enabled: true,
        engineUrl: engine.engineUrl,
        engineId: engine.id,
        engineName: engine.name,
        domain: engine.domain,
        configId: '',
      } as GroundTruthConfig
    })

    // Step 3: Run self-play simulation
    const result = await step.run('simulate-games', async () => {
      const config: SelfPlayConfig = {
        gamesCount,
        skipOpening,
        engineConfig,
        batchId,
        onProgress: async (progress) => {
          // Update batch progress in database
          // Note: This runs frequently, so we batch updates every 5 games
          if (progress.gamesCompleted % 5 === 0 || progress.gamesCompleted === gamesCount) {
            await prisma.selfPlayBatch.update({
              where: { id: batchId },
              data: {
                gamesCompleted: progress.gamesCompleted,
                positionsStored: progress.positionsStored,
                duplicatesSkipped: progress.duplicatesSkipped,
              },
            })
          }
        },
      }

      return runSelfPlayBatch(config)
    })

    // Step 4: Filter against existing positions in database
    // Cast result.positions back to GeneratedPosition[] since Inngest serializes step results
    const generatedPositions = result.positions as unknown as GeneratedPosition[]

    const newPositions = await step.run('filter-existing', async () => {
      if (generatedPositions.length === 0) return [] as GeneratedPosition[]

      // Get existing position IDs from database
      const positionIds = generatedPositions.map((p) => p.positionId)
      const existingPositions = await prisma.positionLibrary.findMany({
        where: { positionId: { in: positionIds } },
        select: { positionId: true },
      })

      const existingIds = new Set(existingPositions.map((p) => p.positionId))
      const filtered = generatedPositions.filter((p) => !existingIds.has(p.positionId))

      console.log(
        `[Self-Play ${batchId}] Filtered: ${generatedPositions.length} generated, ${existingIds.size} already exist, ${filtered.length} new`
      )

      return filtered
    }) as GeneratedPosition[]

    // Step 5: Store new positions in database
    const storeResult = await step.run('store-positions', async () => {
      if (newPositions.length === 0) {
        return { stored: 0, byPhase: { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 } }
      }

      const byPhase: Record<string, number> = { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 }

      // Store in batches of 50
      const BATCH_SIZE = 50
      let stored = 0

      for (let i = 0; i < newPositions.length; i += BATCH_SIZE) {
        const batch = newPositions.slice(i, i + BATCH_SIZE)

        await prisma.positionLibrary.createMany({
          data: batch.map((pos) => ({
            positionId: pos.positionId,
            gamePhase: pos.gamePhase,
            diceRoll: pos.diceRoll,
            bestMove: pos.bestMove,
            bestMoveEquity: pos.bestMoveEquity,
            secondBestMove: pos.secondBestMove,
            secondEquity: pos.secondEquity,
            thirdBestMove: pos.thirdBestMove,
            thirdEquity: pos.thirdEquity,
            probabilityBreakdown: pos.probabilityBreakdown as Prisma.InputJsonValue,
            asciiBoard: pos.asciiBoard,
            sourceType: 'SELF_PLAY',
            engineId,
            selfPlayBatchId: batchId,
            selfPlayGameNum: pos.gameNumber,
            selfPlayMoveNum: pos.moveNumber,
          })),
          skipDuplicates: true,
        })

        // Count by phase
        for (const pos of batch) {
          byPhase[pos.gamePhase]++
        }

        stored += batch.length
      }

      return { stored, byPhase }
    })

    // Step 6: Mark batch as complete
    await step.run('mark-complete', async () => {
      const totalDuplicates =
        result.duplicatesSkipped + (result.positions.length - newPositions.length)

      await prisma.selfPlayBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          gamesCompleted: gamesCount,
          positionsStored: storeResult.stored,
          duplicatesSkipped: totalDuplicates,
          openingCount: storeResult.byPhase.OPENING,
          earlyCount: storeResult.byPhase.EARLY,
          middleCount: storeResult.byPhase.MIDDLE,
          bearoffCount: storeResult.byPhase.BEAROFF,
          errors: result.errors,
          completedAt: new Date(),
        },
      })
    })

    console.log(
      `[Self-Play ${batchId}] Complete: ${gamesCount} games, ${storeResult.stored} positions stored ` +
        `(OPENING=${storeResult.byPhase.OPENING}, EARLY=${storeResult.byPhase.EARLY}, ` +
        `MIDDLE=${storeResult.byPhase.MIDDLE}, BEAROFF=${storeResult.byPhase.BEAROFF})`
    )

    return {
      success: true,
      batchId,
      gamesPlayed: gamesCount,
      positionsStored: storeResult.stored,
      duplicatesSkipped: result.duplicatesSkipped + (result.positions.length - newPositions.length),
      byPhase: storeResult.byPhase,
      errors: result.errors.length,
    }
  }
)

/**
 * Export all functions as an array for registration
 */
export const inngestFunctions = [
  testSimpleJob,
  researchJob,
  recommendationGenerationJob,
  mentalModelGenerationJob,
  curriculumGenerationJob,
  drillSeriesGenerationJob,
  artifactRegenerationJob,
  scrapeMatchArchivesJob,
  matchArchiveImportJob,
  verifyPositionBatchJob,
  selfPlayGenerationJob,
];
