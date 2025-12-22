/**
 * Ground Truth Engine Health Check API
 *
 * Provides engine health status for a project's ground truth configuration.
 * Returns availability status, latency, and any error messages.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireProjectOwnership } from '@/lib/auth'
import { resolveGroundTruthConfig } from '@/lib/groundTruth/config'
import { checkEngineHealth } from '@/lib/groundTruth/executor'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    // Auth check
    try {
      await requireProjectOwnership(projectId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error'
      if (message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      throw error
    }

    // Resolve ground truth config for this project
    const config = await resolveGroundTruthConfig(projectId)

    if (!config) {
      return NextResponse.json({
        configured: false,
        available: false,
        message: 'Ground truth validation not configured for this project',
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    // Check engine health
    const healthResult = await checkEngineHealth(config)

    return NextResponse.json({
      configured: true,
      available: healthResult.available,
      latency: healthResult.latency,
      error: healthResult.error,
      engineUrl: config.engineUrl,
      checkedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/ground-truth/health] Error:', error)
    return NextResponse.json(
      {
        configured: false,
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  }
}
