/**
 * USAGE EXAMPLE for VerificationDetailsModal
 *
 * This file demonstrates how to integrate the VerificationDetailsModal
 * component into an artifact viewer page.
 */

'use client'

import { useState } from 'react'
import { VerificationDetailsModal } from './VerificationDetailsModal'
import { VerificationBadge } from './VerificationBadge'
import type { VerificationStatus } from '@prisma/client'
import type { ToolCallResult, ClaimVerificationResult } from '@/lib/groundTruth/types'

/**
 * Example artifact data structure (from database)
 */
interface ExampleArtifact {
  id: string
  type: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'
  verificationStatus: VerificationStatus | null
  verificationDetails: {
    toolCalls: ToolCallResult[]
    claims: ClaimVerificationResult[]
    summary: {
      totalClaims: number
      verifiedClaims: number
      failedClaims: number
      cachedResponses: number
    }
  } | null
}

/**
 * Example: Artifact viewer component with verification details
 */
export function ExampleArtifactViewer({ artifact }: { artifact: ExampleArtifact }) {
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)

  return (
    <div className="space-y-4">
      {/* Header with verification badge */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Artifact: {artifact.type}</h1>

        {/* Clickable verification badge opens modal */}
        {artifact.verificationStatus && (
          <VerificationBadge
            status={artifact.verificationStatus}
            size="md"
            showTooltip={true}
            onClick={() => setIsDetailsModalOpen(true)}
          />
        )}
      </div>

      {/* Artifact content goes here */}
      <div className="border rounded-lg p-4">
        {/* Your artifact rendering logic */}
      </div>

      {/* Verification Details Modal */}
      <VerificationDetailsModal
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        verificationDetails={artifact.verificationDetails}
        status={artifact.verificationStatus}
      />
    </div>
  )
}

/**
 * Example: Server-side data fetching for artifact page
 *
 * NOTE: In real implementation, import prisma from your actual prisma client location
 */
export async function exampleFetchArtifactWithVerification(artifactId: string) {
  // Example query structure - adjust prisma import path as needed in your actual code
  // const { prisma } = await import('@/lib/prisma')

  // const artifact = await prisma.teachingArtifact.findUnique({
  //   where: { id: artifactId },
  //   select: {
  //     id: true,
  //     type: true,
  //     content: true,
  //     verificationStatus: true,
  //     verificationDetails: true, // This is stored as JSON in the database
  //   },
  // })

  // if (!artifact) {
  //   throw new Error('Artifact not found')
  // }

  // return artifact

  // Mock return for example purposes
  return {
    id: artifactId,
    type: 'DRILL_SERIES' as const,
    verificationStatus: 'VERIFIED' as const,
    verificationDetails: mockVerificationDetails,
  }
}

/**
 * Example: Mock verification details for testing
 */
export const mockVerificationDetails = {
  toolCalls: [
    {
      toolName: 'analyzePosition',
      arguments: { position_id: 'XGID=-b----E-C---eE---c-e----B-:0:0:1:00:0:0:3:0:10' },
      result: { bestMove: '24/20 13/9', equity: 0.547 },
      cached: false,
      executionTime: 127,
    },
    {
      toolName: 'validateMove',
      arguments: { position_id: 'XGID=...', move: '24/20 13/9' },
      result: { valid: true, isOptimal: true },
      cached: true,
      executionTime: 0,
    },
    {
      toolName: 'evaluateEquity',
      arguments: { position_id: 'XGID=...', move: '13/9 6/2' },
      result: { equity: 0.312, rank: 3 },
      cached: false,
      executionTime: 94,
    },
  ],
  claims: [
    {
      claim: {
        id: 'claim-1',
        type: 'move_recommendation' as const,
        content: 'The best move is 24/20 13/9',
        location: {
          drillIndex: 0,
          sectionName: 'Opening Position Analysis',
        },
        extractedMove: '24/20 13/9',
      },
      verified: true,
      cached: false,
    },
    {
      claim: {
        id: 'claim-2',
        type: 'move_recommendation' as const,
        content: 'Playing 13/9 6/2 is suboptimal',
        location: {
          drillIndex: 1,
          sectionName: 'Common Mistakes',
        },
        extractedMove: '13/9 6/2',
      },
      verified: false,
      discrepancy: 'Engine analysis shows this move has equity 0.312, only slightly worse than optimal (0.547). This is not considered a significant error.',
      cached: false,
    },
  ],
  summary: {
    totalClaims: 2,
    verifiedClaims: 1,
    failedClaims: 1,
    cachedResponses: 1,
  },
}

/**
 * Example: Integration in Next.js app router page
 */
export function ExamplePageComponent() {
  // In a real page, this would come from server component props
  const [artifact] = useState<ExampleArtifact>({
    id: 'artifact-123',
    type: 'DRILL_SERIES',
    verificationStatus: 'NEEDS_REVIEW',
    verificationDetails: mockVerificationDetails,
  })

  return <ExampleArtifactViewer artifact={artifact} />
}

/**
 * Example: Button to manually trigger modal (alternative to badge click)
 */
export function ExampleManualTrigger({ artifact }: { artifact: ExampleArtifact }) {
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsDetailsModalOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        disabled={!artifact.verificationDetails}
      >
        View Verification Details
      </button>

      <VerificationDetailsModal
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        verificationDetails={artifact.verificationDetails}
        status={artifact.verificationStatus}
      />
    </>
  )
}
