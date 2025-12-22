import { NextResponse } from 'next/server'
import { populateOpeningPositions } from '@/lib/positionLibrary'
import { resolveGroundTruthConfig } from '@/lib/groundTruth/config'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/position-library/populate
 * Trigger population of opening positions from the ground truth engine.
 *
 * Request body:
 * - projectId: string (required) - Project to use for ground truth config
 *
 * Or:
 * - engineId: string (required) - Direct engine ID to use
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, engineId: directEngineId } = body

    let engineConfig: { engineId: string; engineUrl: string } | null = null

    // Either use projectId to resolve config, or direct engineId
    if (projectId) {
      const gtConfig = await resolveGroundTruthConfig(projectId)
      if (!gtConfig?.enabled) {
        return NextResponse.json(
          { error: 'Ground truth not enabled for this project' },
          { status: 400 }
        )
      }
      engineConfig = {
        engineId: gtConfig.engineId,
        engineUrl: gtConfig.engineUrl
      }
    } else if (directEngineId) {
      const engine = await prisma.groundTruthEngine.findUnique({
        where: { id: directEngineId }
      })
      if (!engine) {
        return NextResponse.json(
          { error: 'Engine not found' },
          { status: 404 }
        )
      }
      engineConfig = {
        engineId: engine.id,
        engineUrl: engine.engineUrl
      }
    } else {
      return NextResponse.json(
        { error: 'Either projectId or engineId is required' },
        { status: 400 }
      )
    }

    console.log(`[Position Library] Starting population for engine ${engineConfig.engineId}`)

    // Populate opening positions
    const result = await populateOpeningPositions({
      engineId: engineConfig.engineId,
      engineUrl: engineConfig.engineUrl,
      enabled: true,
      domain: 'backgammon',
      engineName: '',
      configId: ''
    })

    console.log(`[Position Library] Population complete: ${result.populated} positions, ${result.errors.length} errors`)

    return NextResponse.json({
      success: true,
      populated: result.populated,
      errors: result.errors,
      message: result.errors.length === 0
        ? `Successfully populated ${result.populated} opening positions`
        : `Populated ${result.populated} positions with ${result.errors.length} errors`
    })
  } catch (error) {
    console.error('[Position Library Populate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Population failed' },
      { status: 500 }
    )
  }
}
