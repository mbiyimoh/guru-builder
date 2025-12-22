/**
 * Artifact Regeneration API
 *
 * POST /api/artifacts/[id]/regenerate - Trigger re-generation of an artifact with NEEDS_REVIEW status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { inngest } from '@/lib/inngest';
import { GROUND_TRUTH_LIMITS } from '@/lib/groundTruth/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/artifacts/[id]/regenerate
 *
 * Triggers re-generation of an artifact that has NEEDS_REVIEW verification status.
 *
 * Request Body:
 * {
 *   reason?: string  // Optional reason for regeneration (for logging/tracking)
 * }
 *
 * Response:
 * Success (200): { success: true, message: string, artifact: { id: string, status: string } }
 * Error (4xx): { success: false, error: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: artifactId } = await context.params;

    // Parse optional request body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body is optional, continue without it
    }

    // Fetch artifact and verify ownership
    const artifact = await prisma.guruArtifact.findUnique({
      where: { id: artifactId },
      include: { project: true },
    });

    if (!artifact) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Verify user owns the project
    if (artifact.project.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to regenerate this artifact' },
        { status: 403 }
      );
    }

    // Validate artifact can be regenerated (only NEEDS_REVIEW status)
    if (artifact.verificationStatus !== 'NEEDS_REVIEW') {
      return NextResponse.json(
        {
          success: false,
          error: `Only artifacts with NEEDS_REVIEW status can be regenerated. Current status: ${artifact.verificationStatus || 'N/A'}`,
        },
        { status: 400 }
      );
    }

    // Check regeneration attempt limit
    if (
      artifact.verificationAttempts >= GROUND_TRUTH_LIMITS.MAX_REGENERATION_ATTEMPTS
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum regeneration attempts (${GROUND_TRUTH_LIMITS.MAX_REGENERATION_ATTEMPTS}) reached. Please contact support for assistance.`,
        },
        { status: 400 }
      );
    }

    // Update artifact status to GENERATING and increment attempt count
    await prisma.guruArtifact.update({
      where: { id: artifactId },
      data: {
        status: 'GENERATING',
        progressStage: 'REGENERATING',
        verificationAttempts: { increment: 1 },
        errorMessage: null, // Clear any previous error
      },
    });

    // Trigger regeneration via Inngest
    await inngest.send({
      name: 'guru/regenerate-artifact',
      data: {
        artifactId,
        projectId: artifact.projectId,
        artifactType: artifact.type,
        scope: 'all', // For MVP: only full regeneration supported
        previousFailures: artifact.verificationDetails
          ? (artifact.verificationDetails as Record<string, unknown>).failures
          : undefined,
      },
    });

    console.log(
      `[Regenerate] Artifact ${artifactId} (${artifact.type}) - Attempt ${artifact.verificationAttempts + 1}/${GROUND_TRUTH_LIMITS.MAX_REGENERATION_ATTEMPTS}${reason ? ` - Reason: ${reason}` : ''}`
    );

    return NextResponse.json({
      success: true,
      message: 'Regeneration started successfully',
      artifact: {
        id: artifactId,
        status: 'GENERATING',
        attempt: artifact.verificationAttempts + 1,
        maxAttempts: GROUND_TRUTH_LIMITS.MAX_REGENERATION_ATTEMPTS,
      },
    });
  } catch (error) {
    console.error('[Regenerate API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start regeneration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
