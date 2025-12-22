/**
 * Readiness Score API
 *
 * GET: Calculate and return readiness score and dimension coverage for a project
 * POST: Re-assess all corpus items by running dimension tagging, then return fresh score
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProjectAuth } from '@/lib/api/auth-helpers';
import { calculateReadinessScore } from '@/lib/readiness/scoring';
import { autoTagCorpusItems, type AutoTagParams } from '@/lib/dimensions';
import { prisma } from '@/lib/db';

// Timeout for re-assessment (leave buffer for serverless limits)
const REASSESS_TIMEOUT_MS = 55000; // 55 seconds

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    // Auth check
    const authError = await withProjectAuth(projectId);
    if (authError) return authError;

    // Calculate readiness score
    const { score, dimensions } = await calculateReadinessScore(projectId);

    return NextResponse.json(
      {
        success: true,
        score,
        dimensions,
      },
      {
        headers: {
          'Cache-Control': 'no-store', // Always calculate fresh scores
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/projects/[id]/readiness] Error:', error);

    // Handle specific error cases
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Re-assess all corpus items
 *
 * Fetches all context layers and knowledge files, runs dimension tagging on each,
 * then returns the fresh readiness score.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    // Auth check
    const authError = await withProjectAuth(projectId);
    if (authError) return authError;

    // Fetch all corpus items
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contextLayers: { select: { id: true, title: true, content: true } },
        knowledgeFiles: { select: { id: true, title: true, content: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build items list for batch tagging
    const items: AutoTagParams[] = [
      ...project.contextLayers.map((layer) => ({
        projectId,
        itemId: layer.id,
        itemType: 'layer' as const,
        content: layer.content,
        title: layer.title,
      })),
      ...project.knowledgeFiles.map((file) => ({
        projectId,
        itemId: file.id,
        itemType: 'file' as const,
        content: file.content,
        title: file.title,
      })),
    ];

    // Run batch tagging with timeout protection
    console.log(
      `[Re-assessment] Processing ${items.length} items with ${REASSESS_TIMEOUT_MS}ms timeout`
    );

    let timedOut = false;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Re-assessment timed out')),
        REASSESS_TIMEOUT_MS
      )
    );

    try {
      await Promise.race([autoTagCorpusItems(items), timeoutPromise]);
    } catch (err) {
      if (err instanceof Error && err.message === 'Re-assessment timed out') {
        console.warn(
          `[Re-assessment] Timed out after ${REASSESS_TIMEOUT_MS}ms. Some items may not be tagged.`
        );
        timedOut = true;
        // Continue to score calculation with partial results
      } else {
        throw err; // Re-throw other errors
      }
    }

    // Calculate fresh score (will include whatever tags were created before timeout)
    const { score, dimensions } = await calculateReadinessScore(projectId);

    return NextResponse.json({
      success: true,
      itemsProcessed: items.length,
      score,
      dimensions,
      warning: timedOut
        ? 'Re-assessment partially completed due to timeout. Some items may not have been tagged.'
        : undefined,
    });
  } catch (error) {
    console.error('[POST /api/projects/[id]/readiness] Error:', error);

    // Handle specific error cases
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
