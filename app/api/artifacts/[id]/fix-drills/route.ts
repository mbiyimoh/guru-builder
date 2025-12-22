/**
 * Fix Failed Drills API
 *
 * POST /api/artifacts/[id]/fix-drills - Fix all failed drills using engine's correct answers
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { resolveGroundTruthConfig } from '@/lib/groundTruth/config'
import { verifyAllDrills, getFailedDrills } from '@/lib/groundTruth/verification/drillVerifier'
import { fixFailedDrills } from '@/lib/groundTruth/verification/drillFixer'
import type { PhaseOrganizedDrillSeries } from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema'

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/artifacts/[id]/fix-drills
 *
 * Fixes all failed drills in a drill series artifact using GPT-4o
 * and the ground truth engine's correct answers.
 *
 * Process:
 * 1. Load artifact and verification details
 * 2. Get failed drills with engine data
 * 3. Use GPT-4o to rewrite each failed drill
 * 4. Update artifact content with fixed drills
 * 5. Re-run verification
 * 6. Update artifact with new status
 *
 * Response:
 * Success (200): { success: true, message: string, fixResults: FixResult[], newStatus: string }
 * Error (4xx): { success: false, error: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Authenticate user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: artifactId } = await context.params

    // Fetch artifact and verify ownership
    const artifact = await prisma.guruArtifact.findUnique({
      where: { id: artifactId },
      include: { project: true }
    })

    if (!artifact) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      )
    }

    // Verify user owns the project
    if (artifact.project.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to fix this artifact' },
        { status: 403 }
      )
    }

    // Validate artifact type
    if (artifact.type !== 'DRILL_SERIES') {
      return NextResponse.json(
        { success: false, error: 'Only DRILL_SERIES artifacts can have drills fixed' },
        { status: 400 }
      )
    }

    // Validate artifact has verification data with per-drill results
    const verificationDetails = artifact.verificationDetails as {
      drills?: Array<{
        drillId: string
        verified: boolean
        skipped: boolean
        claimedMove: string
        engineData: {
          bestMove: string
          bestEquity: number
          top3: Array<{ move: string; equity: number }>
        } | null
        discrepancy: string | null
      }>
      summary?: {
        totalDrills: number
        verifiedDrills: number
        failedDrills: number
        skippedDrills: number
      }
    } | null

    if (!verificationDetails?.drills) {
      return NextResponse.json(
        { success: false, error: 'No per-drill verification data available. Please regenerate verification first.' },
        { status: 400 }
      )
    }

    // Get failed drills with engine data
    const failedDrills = verificationDetails.drills.filter(
      d => !d.verified && !d.skipped && d.engineData !== null
    )

    if (failedDrills.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No failed drills to fix' },
        { status: 400 }
      )
    }

    // Get content
    const content = artifact.content as PhaseOrganizedDrillSeries
    if (!content?.phases) {
      return NextResponse.json(
        { success: false, error: 'Invalid artifact content structure' },
        { status: 400 }
      )
    }

    console.log(`[FixDrills] Starting fix for artifact ${artifactId}: ${failedDrills.length} failed drills`)

    // Fix the failed drills using GPT-4o
    const fixResult = await fixFailedDrills(content, failedDrills as Parameters<typeof fixFailedDrills>[1])

    // Get ground truth config for re-verification
    const gtConfig = await resolveGroundTruthConfig(artifact.projectId)

    let newVerificationResult = verificationDetails
    let newStatus = artifact.verificationStatus

    // Re-verify if ground truth is available
    if (gtConfig?.enabled) {
      console.log(`[FixDrills] Re-verifying fixed content...`)
      const reVerification = await verifyAllDrills(fixResult.fixedContent, gtConfig)

      newVerificationResult = {
        drills: reVerification.drills,
        summary: reVerification.summary
      }
      newStatus = reVerification.status
    } else {
      // No ground truth, just update the summary
      const newSummary = {
        ...verificationDetails.summary!,
        verifiedDrills: (verificationDetails.summary?.verifiedDrills || 0) + fixResult.summary.successfullyFixed,
        failedDrills: (verificationDetails.summary?.failedDrills || 0) - fixResult.summary.successfullyFixed
      }

      if (newSummary.failedDrills === 0) {
        newStatus = 'VERIFIED'
      }

      newVerificationResult = {
        ...verificationDetails,
        summary: newSummary
      }
    }

    // Update artifact with fixed content and new verification status
    await prisma.guruArtifact.update({
      where: { id: artifactId },
      data: {
        content: JSON.parse(JSON.stringify(fixResult.fixedContent)),
        verificationStatus: newStatus,
        verificationDetails: JSON.parse(JSON.stringify(newVerificationResult))
      }
    })

    console.log(`[FixDrills] Complete: ${fixResult.summary.successfullyFixed}/${fixResult.summary.totalAttempted} fixed, new status: ${newStatus}`)

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixResult.summary.successfullyFixed} of ${fixResult.summary.totalAttempted} failed drills`,
      fixResults: fixResult.results,
      summary: fixResult.summary,
      newStatus,
      newVerification: newVerificationResult
    })
  } catch (error) {
    console.error('[FixDrills API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fix drills',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
