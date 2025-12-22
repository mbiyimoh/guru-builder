import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withProjectAuth, handleAuthError } from '@/lib/api/auth-helpers';
import { nanoid } from 'nanoid';

/**
 * GET /api/projects/[id]/publish
 * Check publish status of a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify ownership
    const authError = await withProjectAuth(projectId);
    if (authError) return authError;

    // Fetch published guru data
    const publishedGuru = await prisma.publishedGuru.findUnique({
      where: { projectId },
      select: {
        shortId: true,
        isPublished: true,
        publishedAt: true,
        revokedAt: true,
        viewCount: true,
      },
    });

    if (!publishedGuru) {
      return NextResponse.json({
        isPublished: false,
        shortId: null,
        publicUrl: null,
        publishedAt: null,
        viewCount: 0,
      });
    }

    const publicUrl = publishedGuru.isPublished ? `/g/${publishedGuru.shortId}` : null;

    return NextResponse.json({
      isPublished: publishedGuru.isPublished,
      shortId: publishedGuru.shortId,
      publicUrl,
      publishedAt: publishedGuru.publishedAt,
      revokedAt: publishedGuru.revokedAt,
      viewCount: publishedGuru.viewCount,
    });
  } catch (error: unknown) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/publish
 * Publish or re-publish a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify ownership
    const authError = await withProjectAuth(projectId);
    if (authError) return authError;

    // Check if already published
    const existing = await prisma.publishedGuru.findUnique({
      where: { projectId },
    });

    let publishedGuru;

    if (existing) {
      // Re-enable if previously revoked
      publishedGuru = await prisma.publishedGuru.update({
        where: { projectId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
          revokedAt: null,
        },
      });
    } else {
      // Create new published guru with unique shortId
      const shortId = nanoid(10);
      publishedGuru = await prisma.publishedGuru.create({
        data: {
          projectId,
          shortId,
          isPublished: true,
        },
      });
    }

    const publicUrl = `/g/${publishedGuru.shortId}`;

    return NextResponse.json({
      shortId: publishedGuru.shortId,
      publicUrl,
      publishedAt: publishedGuru.publishedAt,
    });
  } catch (error: unknown) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/publish
 * Revoke publishing (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify ownership
    const authError = await withProjectAuth(projectId);
    if (authError) return authError;

    // Check if published
    const existing = await prisma.publishedGuru.findUnique({
      where: { projectId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project is not published' }, { status: 404 });
    }

    // Revoke publishing
    await prisma.publishedGuru.update({
      where: { projectId },
      data: {
        isPublished: false,
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
