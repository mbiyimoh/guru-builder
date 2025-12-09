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

    // Save results to database
    await step.run("save-to-database", async () => {
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
    });

    // Send completion event for recommendation generation
    await step.sendEvent("send-completion-event", {
      name: "research/completed",
      data: {
        researchId,
        success: result.success,
        executionTime: result.executionTime || 0,
      },
    });

    return {
      researchId,
      success: result.success,
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

import { generateMentalModel } from './guruFunctions/generators/mentalModelGenerator';
import { generateCurriculum } from './guruFunctions/generators/curriculumGenerator';
import { generateDrillSeries } from './guruFunctions/generators/drillDesigner';
import type { MentalModelOutput } from './guruFunctions/schemas/mentalModelSchema';
import type { CurriculumOutput } from './guruFunctions/schemas/curriculumSchema';
import {
  MENTAL_MODEL_PHASE_KEYS,
  CURRICULUM_PHASE_KEYS,
  DRILL_SERIES_PHASE_KEYS,
} from './teaching/constants';
import { hashPrompt } from './guruFunctions/promptHasher';
import { resolvePromptsForProject } from './guruFunctions/promptResolver';

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

    // Save artifact with prompt hashes
    await step.run('save-artifact', async () => {
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
    });

    return { artifactId, success: true };
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

    // Phase 5: Saving Artifact
    await step.run('progress-saving', async () => {
      await updateArtifactProgress(artifactId, CURRICULUM_PHASE_KEYS.SAVING_ARTIFACT);
    });

    // Save artifact with prompt hashes
    await step.run('save-artifact', async () => {
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
    });

    return { artifactId, success: true };
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
    const { projectId, artifactId, mentalModelArtifactId, curriculumArtifactId, userNotes } = event.data;

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

    // Resolve custom prompts for this project
    const prompts = await step.run('resolve-prompts', async () => {
      return await resolvePromptsForProject(projectId, 'DRILL_SERIES');
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

    // Generate drill series
    let result;
    try {
      result = await step.run('generate-drill-series', async () => {
        return await generateDrillSeries({
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

    // Phase 5: Saving Artifact
    await step.run('progress-saving', async () => {
      await updateArtifactProgress(artifactId, DRILL_SERIES_PHASE_KEYS.SAVING_ARTIFACT);
    });

    // Save artifact with prompt hashes
    await step.run('save-artifact', async () => {
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
    });

    return { artifactId, success: true };
  }
);

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
];
