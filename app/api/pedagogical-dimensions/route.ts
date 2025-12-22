/**
 * Pedagogical Dimensions API
 *
 * GET: Fetch all pedagogical dimensions with their guiding questions
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dimensions = await prisma.pedagogicalDimension.findMany({
      orderBy: { priority: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        icon: true,
        description: true,
        question: true,
        priority: true,
        isCritical: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      dimensions,
    });
  } catch (error) {
    console.error('[GET /api/pedagogical-dimensions] Error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
