/**
 * Corpus Dimension Tags API
 *
 * CRUD operations for dimension tags on corpus items
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const createTagSchema = z.object({
  dimensionId: z.string(),
  contextLayerId: z.string().optional(),
  knowledgeFileId: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  confirmedByUser: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser();

    // Parse request body
    const body = await req.json();
    const {
      dimensionId,
      contextLayerId,
      knowledgeFileId,
      confidence,
      confirmedByUser,
    } = createTagSchema.parse(body);

    // Validate that exactly one of contextLayerId or knowledgeFileId is provided
    if (
      (!contextLayerId && !knowledgeFileId) ||
      (contextLayerId && knowledgeFileId)
    ) {
      return NextResponse.json(
        { error: 'Must provide exactly one of contextLayerId or knowledgeFileId' },
        { status: 400 }
      );
    }

    // Verify dimension exists
    const dimension = await prisma.pedagogicalDimension.findUnique({
      where: { id: dimensionId },
    });

    if (!dimension) {
      return NextResponse.json(
        { error: 'Dimension not found' },
        { status: 404 }
      );
    }

    // Verify corpus item exists and user owns the project
    if (contextLayerId) {
      const layer = await prisma.contextLayer.findUnique({
        where: { id: contextLayerId },
        include: {
          project: {
            select: { userId: true },
          },
        },
      });

      if (!layer) {
        return NextResponse.json(
          { error: 'Context layer not found' },
          { status: 404 }
        );
      }

      if (layer.project.userId !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    if (knowledgeFileId) {
      const file = await prisma.knowledgeFile.findUnique({
        where: { id: knowledgeFileId },
        include: {
          project: {
            select: { userId: true },
          },
        },
      });

      if (!file) {
        return NextResponse.json(
          { error: 'Knowledge file not found' },
          { status: 404 }
        );
      }

      if (file.project.userId !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    // Check if tag already exists
    const existingTag = await prisma.corpusDimensionTag.findFirst({
      where: {
        dimensionId,
        ...(contextLayerId ? { contextLayerId } : {}),
        ...(knowledgeFileId ? { knowledgeFileId } : {}),
      },
    });

    if (existingTag) {
      return NextResponse.json(
        { error: 'Tag already exists for this dimension and corpus item' },
        { status: 409 }
      );
    }

    // Create the tag
    const tag = await prisma.corpusDimensionTag.create({
      data: {
        dimensionId,
        contextLayerId,
        knowledgeFileId,
        confidence,
        confirmedByUser,
      },
      include: {
        dimension: {
          select: {
            key: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: tag.id,
      dimensionId: tag.dimensionId,
      dimensionKey: tag.dimension.key,
      dimensionName: tag.dimension.name,
      contextLayerId: tag.contextLayerId,
      knowledgeFileId: tag.knowledgeFileId,
      confidence: tag.confidence,
      confirmedByUser: tag.confirmedByUser,
      createdAt: tag.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('[Corpus Dimension Tags API] Error:', error);

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

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
