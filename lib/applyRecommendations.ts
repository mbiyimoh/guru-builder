/**
 * Apply Recommendations Logic
 *
 * Handles applying approved recommendations to the corpus with snapshot creation
 */

import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import { autoTagCorpusItem } from "./dimensions/autoTag";
import { calculateReadinessScore } from "./readiness/scoring";

// Auto-tag timeout to prevent blocking indefinitely
// Rationale: Auto-tagging typically takes 1-2s per item via OpenAI API.
// With parallelization, even 5-10 items complete in ~3s total.
// 10s timeout ensures the request doesn't hang if OpenAI is slow/rate-limited.
const AUTO_TAG_TIMEOUT_MS = 10000;

export interface ApplyRecommendationsOptions {
  projectId: string;
  recommendationIds: string[];
  snapshotName?: string;
  snapshotDescription?: string;
}

export interface ApplyRecommendationsResult {
  success: boolean;
  snapshotId: string;
  appliedCount: number;
  changes: {
    added: number;
    edited: number;
    deleted: number;
  };
  readinessScore?: {
    overall: number;
    previousOverall?: number;
    criticalGaps: string[];
  };
  error?: string;
}

/**
 * Apply approved recommendations to corpus
 */
export async function applyRecommendations(
  options: ApplyRecommendationsOptions
): Promise<ApplyRecommendationsResult> {
  const { projectId, recommendationIds, snapshotName, snapshotDescription } = options;

  try {
    // 1. Fetch approved recommendations
    const recommendations = await prisma.recommendation.findMany({
      where: {
        id: { in: recommendationIds },
        status: "APPROVED",
      },
      include: {
        researchRun: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (recommendations.length === 0) {
      throw new Error("No approved recommendations found");
    }

    // Verify all recommendations belong to the project
    const invalidRecs = recommendations.filter(
      (r) => r.researchRun.projectId !== projectId
    );
    if (invalidRecs.length > 0) {
      throw new Error("Some recommendations do not belong to this project");
    }

    // 2. Create snapshot of current state
    const layers = await prisma.contextLayer.findMany({
      where: { projectId },
    });

    const files = await prisma.knowledgeFile.findMany({
      where: { projectId },
    });

    const snapshot = await prisma.corpusSnapshot.create({
      data: {
        projectId,
        name: snapshotName || `Auto-snapshot ${new Date().toISOString()}`,
        description: snapshotDescription || `Before applying ${recommendations.length} recommendations`,
        layersData: layers as unknown as Prisma.JsonArray,
        filesData: files as unknown as Prisma.JsonArray,
      },
    });

    console.log(`[Apply Changes] Created snapshot ${snapshot.id}`);

    // 3. Get current readiness score before applying (for comparison)
    let previousReadinessScore: number | undefined;
    try {
      const { score: prevScore } = await calculateReadinessScore(projectId);
      previousReadinessScore = prevScore.overall;
    } catch (error) {
      console.warn("[Apply Changes] Could not get previous readiness score:", error);
    }

    // 4. Apply each recommendation in a transaction (all-or-nothing)
    // Collect items that need auto-tagging
    const itemsToTag: Array<{
      itemId: string;
      itemType: "layer" | "file";
      content: string;
      title: string;
    }> = [];

    const changes = await prisma.$transaction(async (tx) => {
      const changeStats = {
        added: 0,
        edited: 0,
        deleted: 0,
      };

      for (const rec of recommendations) {
        const appliedItemId = await applySingleRecommendationWithTx(tx, rec, snapshot.id);

        if (rec.action === "ADD") changeStats.added++;
        else if (rec.action === "EDIT") changeStats.edited++;
        else if (rec.action === "DELETE") changeStats.deleted++;

        // Mark as applied
        await tx.recommendation.update({
          where: { id: rec.id },
          data: {
            status: "APPLIED",
            appliedAt: new Date(),
          },
        });

        console.log(`[Apply Changes] Applied recommendation ${rec.id} (${rec.action})`);

        // Collect items for auto-tagging (will be done after transaction)
        if (appliedItemId && (rec.action === "ADD" || rec.action === "EDIT")) {
          itemsToTag.push({
            itemId: appliedItemId,
            itemType: rec.targetType === "LAYER" ? "layer" : "file",
            content: rec.fullContent,
            title: rec.title,
          });
        }
      }

      return changeStats;
    });

    // 5. Auto-tag items with timeout (blocking to ensure tags exist before readiness calculation)
    if (itemsToTag.length > 0) {
      console.log(`[Apply Changes] Auto-tagging ${itemsToTag.length} items (blocking with ${AUTO_TAG_TIMEOUT_MS}ms timeout)...`);

      const autoTagPromises = itemsToTag.map((item) =>
        autoTagCorpusItem({
          projectId,
          itemId: item.itemId,
          itemType: item.itemType,
          content: item.content,
          title: item.title,
        }).catch((error) => {
          console.error(`[Apply Changes] Auto-tag failed for ${item.itemType} ${item.itemId}:`, error);
        })
      );

      // Wait for all auto-tags with timeout (don't let it block forever)
      await Promise.race([
        Promise.all(autoTagPromises),
        new Promise((resolve) => setTimeout(resolve, AUTO_TAG_TIMEOUT_MS)),
      ]);

      console.log("[Apply Changes] Auto-tagging complete (or timed out)");
    }

    // 6. Calculate fresh readiness score after auto-tagging
    let readinessScore: ApplyRecommendationsResult["readinessScore"];
    try {
      const { score: newScore } = await calculateReadinessScore(projectId);
      readinessScore = {
        overall: newScore.overall,
        previousOverall: previousReadinessScore,
        criticalGaps: newScore.criticalGaps,
      };
      console.log(`[Apply Changes] Readiness updated: ${previousReadinessScore ?? "?"} → ${newScore.overall}`);
    } catch (error) {
      console.error("[Apply Changes] Could not calculate new readiness score:", error);
    }

    return {
      success: true,
      snapshotId: snapshot.id,
      appliedCount: recommendations.length,
      changes,
      readinessScore,
    };
  } catch (error) {
    console.error("[Apply Changes] Error:", error);
    return {
      success: false,
      snapshotId: "",
      appliedCount: 0,
      changes: { added: 0, edited: 0, deleted: 0 },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Apply a single recommendation within a transaction
 * Returns the ID of the created/updated item (null for DELETE actions)
 */
async function applySingleRecommendationWithTx(
  tx: Prisma.TransactionClient,
  recommendation: {
    id: string;
    action: string;
    targetType: string;
    contextLayerId: string | null;
    knowledgeFileId: string | null;
    title: string;
    fullContent: string;
    researchRun: {
      projectId: string;
    };
  },
  snapshotId: string
): Promise<string | null> {
  const { action, targetType, contextLayerId, knowledgeFileId, title, fullContent, researchRun } = recommendation;
  const projectId = researchRun.projectId;

  // Derive targetId from the appropriate FK field
  const targetId = targetType === "LAYER" ? contextLayerId : knowledgeFileId;

  if (targetType === "LAYER") {
    if (action === "ADD") {
      // Create new context layer
      const layer = await tx.contextLayer.create({
        data: {
          projectId,
          title,
          content: fullContent,
          priority: 999, // Add at end, user can reorder
          isActive: true,
        },
      });

      // Log the change
      await tx.applyChangesLog.create({
        data: {
          snapshotId,
          recommendationId: recommendation.id,
          changeType: "ADD",
          targetType: "LAYER",
          targetId: layer.id,
          newValue: layer as unknown as Prisma.JsonObject,
        },
      });

      return layer.id;
    } else if (action === "EDIT" && targetId) {
      // Get current value
      const currentLayer = await tx.contextLayer.findUnique({
        where: { id: targetId },
      });

      // Update layer
      const updated = await tx.contextLayer.update({
        where: { id: targetId },
        data: {
          title,
          content: fullContent,
        },
      });

      // Log the change
      await tx.applyChangesLog.create({
        data: {
          snapshotId,
          recommendationId: recommendation.id,
          changeType: "EDIT",
          targetType: "LAYER",
          targetId: updated.id,
          previousValue: currentLayer as unknown as Prisma.JsonObject,
          newValue: updated as unknown as Prisma.JsonObject,
        },
      });

      return updated.id;
    } else if (action === "DELETE" && targetId) {
      // Get current value
      const currentLayer = await tx.contextLayer.findUnique({
        where: { id: targetId },
      });

      // Delete layer
      await tx.contextLayer.delete({
        where: { id: targetId },
      });

      // Log the change
      await tx.applyChangesLog.create({
        data: {
          snapshotId,
          recommendationId: recommendation.id,
          changeType: "DELETE",
          targetType: "LAYER",
          targetId,
          previousValue: currentLayer as unknown as Prisma.JsonObject,
        },
      });

      return null; // DELETE actions don't need tagging
    }
  } else if (targetType === "KNOWLEDGE_FILE") {
    if (action === "ADD") {
      // Create new knowledge file
      const file = await tx.knowledgeFile.create({
        data: {
          projectId,
          title,
          content: fullContent,
          isActive: true,
        },
      });

      // Log the change
      await tx.applyChangesLog.create({
        data: {
          snapshotId,
          recommendationId: recommendation.id,
          changeType: "ADD",
          targetType: "KNOWLEDGE_FILE",
          targetId: file.id,
          newValue: file as unknown as Prisma.JsonObject,
        },
      });

      return file.id;
    } else if (action === "EDIT" && targetId) {
      // Get current value
      const currentFile = await tx.knowledgeFile.findUnique({
        where: { id: targetId },
      });

      // Update file
      const updated = await tx.knowledgeFile.update({
        where: { id: targetId },
        data: {
          title,
          content: fullContent,
        },
      });

      // Log the change
      await tx.applyChangesLog.create({
        data: {
          snapshotId,
          recommendationId: recommendation.id,
          changeType: "EDIT",
          targetType: "KNOWLEDGE_FILE",
          targetId: updated.id,
          previousValue: currentFile as unknown as Prisma.JsonObject,
          newValue: updated as unknown as Prisma.JsonObject,
        },
      });

      return updated.id;
    } else if (action === "DELETE" && targetId) {
      // Get current value
      const currentFile = await tx.knowledgeFile.findUnique({
        where: { id: targetId },
      });

      // Delete file
      await tx.knowledgeFile.delete({
        where: { id: targetId },
      });

      // Log the change
      await tx.applyChangesLog.create({
        data: {
          snapshotId,
          recommendationId: recommendation.id,
          changeType: "DELETE",
          targetType: "KNOWLEDGE_FILE",
          targetId,
          previousValue: currentFile as unknown as Prisma.JsonObject,
        },
      });

      return null; // DELETE actions don't need tagging
    }
  }

  // Fallback for unhandled cases
  return null;
}
