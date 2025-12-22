/**
 * Dimension Suggest API
 *
 * Uses AI to suggest pedagogical dimension tags for corpus content.
 * This is a thin wrapper around the shared suggestDimensions function.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { suggestDimensions } from '@/lib/dimensions/suggestDimensions';

const requestSchema = z.object({
  content: z.string(),
  title: z.string(),
  type: z.enum(['layer', 'file']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication and project ownership
    const { id: projectId } = await params;
    await requireProjectOwnership(projectId);

    // Parse request body
    const body = await req.json();
    const { content, title, type } = requestSchema.parse(body);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Call the shared dimension suggestion logic
    const result = await suggestDimensions({
      content,
      title,
      type,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Dimension Suggest] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === 'No pedagogical dimensions configured') {
      return NextResponse.json(
        { error: 'No pedagogical dimensions configured' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
