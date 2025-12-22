import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';

// PATCH - Confirm a dimension tag
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const tagId = params.id;

    // Fetch the tag with its associated corpus item to verify ownership
    const tag = await prisma.corpusDimensionTag.findUnique({
      where: { id: tagId },
      include: {
        contextLayer: { select: { projectId: true, project: { select: { userId: true } } } },
        knowledgeFile: { select: { projectId: true, project: { select: { userId: true } } } },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Check ownership
    const ownerId = tag.contextLayer?.project?.userId || tag.knowledgeFile?.project?.userId;
    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the tag to confirmed
    const updatedTag = await prisma.corpusDimensionTag.update({
      where: { id: tagId },
      data: { confirmedByUser: true },
      include: {
        dimension: { select: { key: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      tag: {
        id: updatedTag.id,
        dimensionKey: updatedTag.dimension.key,
        dimensionName: updatedTag.dimension.name,
        confidence: updatedTag.confidence,
        confirmedByUser: updatedTag.confirmedByUser,
      },
    });
  } catch (error) {
    console.error('Error confirming dimension tag:', error);
    return NextResponse.json(
      { error: 'Failed to confirm tag' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a dimension tag
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const tagId = params.id;

    // Fetch the tag with its associated corpus item to verify ownership
    const tag = await prisma.corpusDimensionTag.findUnique({
      where: { id: tagId },
      include: {
        contextLayer: { select: { project: { select: { userId: true } } } },
        knowledgeFile: { select: { project: { select: { userId: true } } } },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Check ownership
    const ownerId = tag.contextLayer?.project?.userId || tag.knowledgeFile?.project?.userId;
    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the tag
    await prisma.corpusDimensionTag.delete({
      where: { id: tagId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dimension tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
