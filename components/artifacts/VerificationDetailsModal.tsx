'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock, Database, SkipForward, Wrench, Loader2 } from 'lucide-react'
import { VerificationBadge } from './VerificationBadge'
import { cn } from '@/lib/utils'
import type { ToolCallResult, ClaimVerificationResult } from '@/lib/groundTruth/types'
import type { DrillVerificationResult } from '@/lib/groundTruth/verification/drillVerifier'
import type { VerificationStatus } from '@prisma/client'

/**
 * Per-drill verification details (new format)
 */
interface PerDrillVerificationDetails {
  drills: DrillVerificationResult[]
  summary: {
    totalDrills: number
    verifiedDrills: number
    failedDrills: number
    skippedDrills: number
    cachedResponses?: number
  }
}

/**
 * Claim-based verification details (legacy format)
 */
interface ClaimVerificationDetails {
  toolCalls: ToolCallResult[]
  claims: ClaimVerificationResult[]
  summary: {
    totalClaims: number
    verifiedClaims: number
    failedClaims: number
    cachedResponses: number
  }
}

/**
 * Props for VerificationDetailsModal component
 */
interface VerificationDetailsModalProps {
  /** Whether modal is open */
  open: boolean
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void
  /** Detailed verification results to display (supports both formats) */
  verificationDetails: PerDrillVerificationDetails | ClaimVerificationDetails | null
  /** Overall verification status */
  status: VerificationStatus | null
  /** Artifact ID (required for fix button) */
  artifactId?: string
  /** Callback when drills are fixed */
  onDrillsFixed?: () => void
}

/**
 * Type guard to check if verification details are per-drill format
 */
function isPerDrillFormat(details: PerDrillVerificationDetails | ClaimVerificationDetails): details is PerDrillVerificationDetails {
  return 'drills' in details && Array.isArray(details.drills)
}

/**
 * Modal that displays detailed verification information for an artifact.
 *
 * Supports two verification formats:
 * 1. Per-drill verification (new): Shows each drill's verification result with Fix button
 * 2. Claim-based verification (legacy): Shows extracted claims and discrepancies
 *
 * Shows:
 * - Summary statistics (verified/failed/skipped drills or claims)
 * - Failed verification details with discrepancies
 * - Engine query history (tool calls) for legacy format
 * - "Fix Failed Drills" button for per-drill format
 */
export function VerificationDetailsModal({
  open,
  onOpenChange,
  verificationDetails,
  status,
  artifactId,
  onDrillsFixed
}: VerificationDetailsModalProps) {
  const [isFixing, setIsFixing] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)

  // Don't render if no verification details available
  if (!verificationDetails) return null

  // Determine format and render appropriately
  const isPerDrill = isPerDrillFormat(verificationDetails)

  const handleFixDrills = async () => {
    if (!artifactId) return

    setIsFixing(true)
    setFixError(null)

    try {
      const response = await fetch(`/api/artifacts/${artifactId}/fix-drills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fix drills')
      }

      // Notify parent to refresh
      onDrillsFixed?.()
      onOpenChange(false)
    } catch (error) {
      setFixError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsFixing(false)
    }
  }

  if (isPerDrill) {
    return (
      <PerDrillVerificationModal
        open={open}
        onOpenChange={onOpenChange}
        details={verificationDetails}
        status={status}
        isFixing={isFixing}
        fixError={fixError}
        onFixDrills={handleFixDrills}
        canFix={!!artifactId && status === 'NEEDS_REVIEW'}
      />
    )
  }

  // Legacy claim-based format
  return (
    <ClaimVerificationModal
      open={open}
      onOpenChange={onOpenChange}
      details={verificationDetails}
      status={status}
    />
  )
}

/**
 * Per-drill verification modal (new format)
 */
interface PerDrillModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  details: PerDrillVerificationDetails
  status: VerificationStatus | null
  isFixing: boolean
  fixError: string | null
  onFixDrills: () => void
  canFix: boolean
}

function PerDrillVerificationModal({
  open,
  onOpenChange,
  details,
  status,
  isFixing,
  fixError,
  onFixDrills,
  canFix
}: PerDrillModalProps) {
  const { drills, summary } = details

  // Get failed drills (not skipped, not verified, has engine data)
  const failedDrills = drills.filter(d => !d.verified && !d.skipped)
  const skippedDrills = drills.filter(d => d.skipped)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Drill Verification Details
            <VerificationBadge status={status} size="sm" showTooltip={false} />
          </DialogTitle>
        </DialogHeader>

        {/* Summary Statistics Section */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
          <SummaryCard
            icon={CheckCircle2}
            label="Verified"
            value={summary.verifiedDrills}
            className="text-green-600"
          />
          <SummaryCard
            icon={XCircle}
            label="Failed"
            value={summary.failedDrills}
            className="text-red-600"
          />
          <SummaryCard
            icon={SkipForward}
            label="Skipped"
            value={summary.skippedDrills}
            className="text-gray-500"
          />
          <SummaryCard
            icon={Database}
            label="Cached"
            value={summary.cachedResponses || 0}
            className="text-purple-600"
          />
        </div>

        {/* Fix Error Display */}
        {fixError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Error fixing drills: {fixError}
          </div>
        )}

        {/* Failed Drills Section */}
        {failedDrills.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-red-700">
              Failed Drills ({failedDrills.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {failedDrills.map((drill, i) => (
                <FailedDrillCard key={drill.drillId || i} drill={drill} />
              ))}
            </div>
          </div>
        )}

        {/* Skipped Drills Info */}
        {skippedDrills.length > 0 && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 text-gray-600">
              <SkipForward className="h-4 w-4" />
              <span className="text-sm">
                {skippedDrills.length} drills skipped (non-opening positions - verification not yet supported)
              </span>
            </div>
          </div>
        )}

        {/* Fix Failed Drills Button */}
        {canFix && summary.failedDrills > 0 && (
          <div className="flex justify-center pt-4 border-t">
            <Button
              onClick={onFixDrills}
              disabled={isFixing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isFixing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fixing {summary.failedDrills} drills...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  Fix {summary.failedDrills} Failed Drills
                </>
              )}
            </Button>
          </div>
        )}

        {/* Success state - all verified */}
        {summary.failedDrills === 0 && summary.verifiedDrills > 0 && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-green-700 font-medium">
              All {summary.verifiedDrills} drills verified!
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Legacy claim-based verification modal
 */
interface ClaimModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  details: ClaimVerificationDetails
  status: VerificationStatus | null
}

function ClaimVerificationModal({
  open,
  onOpenChange,
  details,
  status
}: ClaimModalProps) {
  const toolCalls = details.toolCalls || []
  const claims = details.claims || []
  const summary = details.summary || {
    totalClaims: 0,
    verifiedClaims: 0,
    failedClaims: 0,
    cachedResponses: 0,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Verification Details
            <VerificationBadge status={status} size="sm" showTooltip={false} />
          </DialogTitle>
        </DialogHeader>

        {/* Summary Statistics Section */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
          <SummaryCard
            icon={CheckCircle2}
            label="Verified"
            value={summary.verifiedClaims}
            className="text-green-600"
          />
          <SummaryCard
            icon={XCircle}
            label="Failed"
            value={summary.failedClaims}
            className="text-red-600"
          />
          <SummaryCard
            icon={Clock}
            label="Tool Calls"
            value={toolCalls.length}
            className="text-blue-600"
          />
          <SummaryCard
            icon={Database}
            label="Cached"
            value={summary.cachedResponses}
            className="text-purple-600"
          />
        </div>

        {/* Failed Claims Section - Only show if there are failures */}
        {summary.failedClaims > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-red-700">Failed Verifications</h3>
            <div className="space-y-2">
              {claims.filter(c => !c.verified).map((claim, i) => (
                <FailedClaimCard key={i} claim={claim} />
              ))}
            </div>
          </div>
        )}

        {/* Tool Calls Section - Show engine query history */}
        {toolCalls.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Engine Queries ({toolCalls.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {toolCalls.slice(0, 20).map((call, i) => (
                <ToolCallCard key={i} call={call} />
              ))}
              {toolCalls.length > 20 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  + {toolCalls.length - 20} more queries...
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Summary card component for displaying metric with icon
 */
interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  className?: string
}

function SummaryCard({ icon: Icon, label, value, className }: SummaryCardProps) {
  return (
    <div className="text-center">
      <Icon className={cn('h-6 w-6 mx-auto mb-1', className)} />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Card displaying a failed drill verification
 */
interface FailedDrillCardProps {
  drill: DrillVerificationResult
}

function FailedDrillCard({ drill }: FailedDrillCardProps) {
  return (
    <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
      <div className="flex items-start gap-2">
        <XCircle className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Drill ID and Phase */}
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {drill.drillId}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {drill.phase}
            </Badge>
            <Badge variant="outline" className="text-xs text-gray-500">
              {drill.principleId}
            </Badge>
          </div>

          {/* Claimed vs Correct Answer */}
          <p className="text-sm font-medium text-red-900">
            Claimed: <span className="font-mono">{drill.claimedMove}</span>
          </p>

          {/* Engine's correct answer */}
          {drill.engineData && (
            <div className="mt-1 text-xs text-red-700">
              <p>
                Best move: <span className="font-mono font-semibold">{drill.engineData.bestMove}</span>
                {' '}(eq: {drill.engineData.bestEquity.toFixed(3)})
              </p>
              {drill.engineData.top3.length > 1 && (
                <p className="text-gray-600 mt-0.5">
                  Top 3: {drill.engineData.top3.map(m => m.move).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Discrepancy reason if no engine data */}
          {!drill.engineData && drill.discrepancy && (
            <p className="text-xs text-red-700 mt-1">{drill.discrepancy}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Card displaying a failed verification claim (legacy format)
 */
interface FailedClaimCardProps {
  claim: ClaimVerificationResult
}

function FailedClaimCard({ claim }: FailedClaimCardProps) {
  return (
    <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
      <div className="flex items-start gap-2">
        <XCircle className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Display extracted move or content */}
          <p className="text-sm font-medium text-red-900 break-words">
            {claim.claim.extractedMove || claim.claim.content}
          </p>
          {/* Show discrepancy reason if available */}
          {claim.discrepancy && (
            <p className="text-xs text-red-700 mt-1">{claim.discrepancy}</p>
          )}
          {/* Show claim location context */}
          {claim.claim.location && (
            <div className="text-xs text-muted-foreground mt-1">
              {claim.claim.location.sectionName && (
                <span>Section: {claim.claim.location.sectionName}</span>
              )}
              {claim.claim.location.drillIndex !== undefined && (
                <span className="ml-2">Drill #{claim.claim.location.drillIndex + 1}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Card displaying a single tool call to the engine
 */
interface ToolCallCardProps {
  call: ToolCallResult
}

function ToolCallCard({ call }: ToolCallCardProps) {
  return (
    <div className="p-2 border rounded text-xs font-mono bg-background">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">{call.toolName}</span>
        <div className="flex items-center gap-2">
          {call.cached && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
              cached
            </Badge>
          )}
          <span className="text-muted-foreground">{call.executionTime}ms</span>
        </div>
      </div>
      {/* Show tool arguments */}
      <div className="mt-1 text-muted-foreground truncate">
        {JSON.stringify(call.arguments)}
      </div>
    </div>
  )
}
