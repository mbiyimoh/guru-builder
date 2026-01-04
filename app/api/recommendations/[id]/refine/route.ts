/**
 * Recommendation Refinement API
 *
 * POST /api/recommendations/[id]/refine - Refine a pending recommendation based on user guidance
 */

import { NextRequest, NextResponse } from 'next/server';

// Disable Next.js caching for this mutation endpoint
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { refineRecommendation, RefinementError } from '@/lib/recommendations/refineRecommendation';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/recommendations/[id]/refine
 * Refine a pending recommendation with user guidance
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { refinementPrompt } = body;

    // Validate prompt
    if (!refinementPrompt || typeof refinementPrompt !== 'string') {
      return NextResponse.json(
        { error: 'Refinement prompt is required' },
        { status: 400 }
      );
    }

    // Sanitize input: trim, collapse whitespace, remove control characters
    const sanitizedPrompt = refinementPrompt
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    if (sanitizedPrompt.length === 0) {
      return NextResponse.json(
        { error: 'Refinement prompt cannot be empty' },
        { status: 400 }
      );
    }

    if (sanitizedPrompt.length > 2000) {
      return NextResponse.json(
        { error: 'Refinement prompt must be 2000 characters or less' },
        { status: 400 }
      );
    }

    // Fetch recommendation with ownership check
    const recommendation = await prisma.recommendation.findFirst({
      where: { id },
      include: {
        researchRun: {
          include: {
            project: true
          }
        }
      }
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (recommendation.researchRun.project.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check status
    if (recommendation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending recommendations can be refined' },
        { status: 409 }
      );
    }

    console.log(`[Recommendation ${id}] Refining with prompt: "${sanitizedPrompt.substring(0, 50)}..."`);

    const refined = await refineRecommendation(recommendation, sanitizedPrompt);

    // Update recommendation in database
    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        title: refined.title,
        description: refined.description,
        fullContent: refined.fullContent,
        reasoning: refined.reasoning,
      }
    });

    console.log(`[Recommendation ${id}] Refined successfully`);

    return NextResponse.json(
      {
        success: true,
        recommendation: updated
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    );
  } catch (error) {
    console.error('Error refining recommendation:', error);

    // Handle RefinementError with specific messaging
    if (error instanceof RefinementError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable
        },
        { status: error.code === 'RATE_LIMIT' ? 429 : 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to refine recommendation' },
      { status: 500 }
    );
  }
}
