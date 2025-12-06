/**
 * Apply Recommendations Logic
 *
 * Handles applying approved recommendations to the corpus with snapshot creation
 */

import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

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

    // 3. Apply each recommendation in a transaction (all-or-nothing)
    const changes = await prisma.$transaction(async (tx) => {
      const changeStats = {
        added: 0,
        edited: 0,
        deleted: 0,
      };

      for (const rec of recommendations) {
        await applySingleRecommendationWithTx(tx, rec, snapshot.id);

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
      }

      return changeStats;
    });

    return {
      success: true,
      snapshotId: snapshot.id,
      appliedCount: recommendations.length,
      changes,
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
) {
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
    }
  }
}
