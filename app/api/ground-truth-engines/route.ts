/**
 * Ground Truth Engines API
 *
 * GET /api/ground-truth-engines - List all available ground truth engines
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const engines = await prisma.groundTruthEngine.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        domain: true,
        description: true,
        iconUrl: true,
        engineUrl: true,
      },
    })

    return NextResponse.json({ engines })
  } catch (error) {
    console.error('Error fetching ground truth engines:', error)
    return NextResponse.json(
      { error: 'Failed to fetch engines' },
      { status: 500 }
    )
  }
}
