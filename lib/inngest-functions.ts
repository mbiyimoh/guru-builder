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

/**
 * Minimum confidence threshold for recommendations to be saved to database.
 * Recommendations below this threshold are filtered out to maintain quality.
 *
 * Range: 0.0 (no confidence) to 1.0 (absolute confidence)
 * Current: 0.4 (40% confidence minimum)
 */
const MIN_RECOMMENDATION_CONFIDENCE = 0.4;

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

    // Execute research (can take 5-10 minutes for deep research)
    const result = await step.run("execute-research", async () => {
      console.log(`[Research Job ${researchId}] Starting: "${instructions}" (${depth})`);

      const researchResult = await executeResearch({
        instructions,
        depth,
        timeout: 600000, // 10 minutes max
      });

      console.log(
        `[Research Job ${researchId}] Completed in ${researchResult.executionTime}ms - Success: ${researchResult.success}`
      );

      return researchResult;
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

    // Save recommendations to database
    await step.run("save-recommendations", async () => {
      if (recommendationsResult.recommendations.length === 0) {
        console.log(`[Recommendation Job ${researchId}] No recommendations to save`);
        return;
      }

      await prisma.recommendation.createMany({
        data: recommendationsResult.recommendations.map((rec: CorpusRecommendation, index: number) => ({
          researchRunId: researchId,
          action: rec.action,
          targetType: rec.targetType,
          targetId: rec.targetId || null,
          title: rec.title,
          content: rec.content,
          reasoning: rec.reasoning,
          confidence: rec.confidence,
          impactLevel: rec.impactLevel,
          priority: index, // Use index for ordering
          status: "PENDING" as const,
        })),
      });

      console.log(`[Recommendation Job ${researchId}] Saved ${recommendationsResult.recommendations.length} recommendations to database`);
    });

    return {
      researchId,
      recommendationsGenerated: recommendationsResult.recommendations.length,
      success: true,
    };
  }
);

/**
 * Export all functions as an array for registration
 */
export const inngestFunctions = [testSimpleJob, researchJob, recommendationGenerationJob];
