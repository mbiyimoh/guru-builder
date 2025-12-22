/**
 * Auto-Tag Helper
 *
 * Automatically tags corpus items with pedagogical dimensions after recommendations are applied.
 * Uses direct function calls instead of HTTP to avoid authentication issues.
 */

import { prisma } from '@/lib/db';
import { suggestDimensions } from './suggestDimensions';

export interface AutoTagParams {
  projectId: string;
  itemId: string;
  itemType: 'layer' | 'file';
  content: string;
  title: string;
}

/**
 * Auto-tag a corpus item with dimension suggestions from AI.
 * This function is non-blocking - errors are logged but not thrown.
 */
export async function autoTagCorpusItem(params: AutoTagParams): Promise<void> {
  const { projectId, itemId, itemType, content, title } = params;

  try {
    // Call the dimension suggestion logic directly (no HTTP, no auth issues)
    const data = await suggestDimensions({
      content,
      title,
      type: itemType,
    });

    if (!data.suggestions || data.suggestions.length === 0) {
      console.log(`[Auto-Tag] No dimension suggestions for ${itemType} ${itemId}`);
      return;
    }

    // Fetch dimension IDs from keys
    const dimensionKeys = data.suggestions.map((s) => s.dimension);
    const dimensions = await prisma.pedagogicalDimension.findMany({
      where: {
        key: { in: dimensionKeys },
      },
      select: {
        id: true,
        key: true,
      },
    });

    const dimensionMap = new Map(dimensions.map((d) => [d.key, d.id]));

    // Create tags for each suggestion
    const tagsCreated: string[] = [];
    for (const suggestion of data.suggestions) {
      const dimensionId = dimensionMap.get(suggestion.dimension);
      if (!dimensionId) {
        console.warn(`[Auto-Tag] Dimension key not found: ${suggestion.dimension}`);
        continue;
      }

      // Determine if this should be auto-confirmed (lowered from 0.8 to 0.6)
      const confirmedByUser = suggestion.confidence >= 0.6;

      // Check if tag already exists
      const existingTag = await prisma.corpusDimensionTag.findFirst({
        where: {
          dimensionId,
          ...(itemType === 'layer'
            ? { contextLayerId: itemId }
            : { knowledgeFileId: itemId }),
        },
      });

      if (existingTag) {
        console.log(
          `[Auto-Tag] Tag already exists: ${suggestion.dimension} for ${itemType} ${itemId}`
        );
        continue;
      }

      // Create the tag
      await prisma.corpusDimensionTag.create({
        data: {
          dimensionId,
          confidence: suggestion.confidence,
          confirmedByUser,
          ...(itemType === 'layer'
            ? { contextLayerId: itemId }
            : { knowledgeFileId: itemId }),
        },
      });

      tagsCreated.push(suggestion.dimension);
      console.log(
        `[Auto-Tag] Created tag: ${suggestion.dimension} (confidence: ${suggestion.confidence.toFixed(2)}, confirmed: ${confirmedByUser})`
      );
    }

    console.log(
      `[Auto-Tag] Successfully tagged ${itemType} ${itemId} with ${tagsCreated.length} dimension(s): ${tagsCreated.join(', ')}`
    );
  } catch (error) {
    // Log error but don't throw (non-blocking)
    console.error(`[Auto-Tag] Error tagging ${itemType} ${itemId}:`, error);
  }
}

/**
 * Auto-tag multiple corpus items in batch.
 * Useful for bulk operations or migrations.
 */
export async function autoTagCorpusItems(
  items: AutoTagParams[]
): Promise<void> {
  console.log(`[Auto-Tag] Starting batch auto-tag for ${items.length} items`);

  for (const item of items) {
    await autoTagCorpusItem(item);
  }

  console.log(`[Auto-Tag] Completed batch auto-tag for ${items.length} items`);
}
