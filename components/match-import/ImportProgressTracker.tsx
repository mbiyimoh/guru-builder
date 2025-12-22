'use client'

/**
 * ImportProgressTracker - Shows import progress and status
 *
 * Polls the import status API and displays progress with visual indicators.
 * Supports multiple concurrent imports.
 */

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, Loader2, FileText, Clock } from 'lucide-react'

interface ImportProgress {
  id: string
  status: string
  filename: string
  sourceCollection?: string
  totalMatches: number
  totalGames: number
  totalPositions: number
  positionsVerified: number
  progress: number
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

interface ImportProgressTrackerProps {
  importId: string
  onComplete?: () => void
  onDismiss?: () => void
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgColor: string
  icon: React.ReactNode
}> = {
  PENDING: {
    label: 'Queued',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: <Clock className="h-4 w-4" />
  },
  PARSING: {
    label: 'Parsing match file...',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: <Loader2 className="h-4 w-4 animate-spin" />
  },
  REPLAYING: {
    label: 'Extracting positions...',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: <Loader2 className="h-4 w-4 animate-spin" />
  },
  VERIFYING: {
    label: 'Verifying with GNUBG...',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: <Loader2 className="h-4 w-4 animate-spin" />
  },
  COMPLETED: {
    label: 'Complete',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: <CheckCircle className="h-4 w-4" />
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: <AlertCircle className="h-4 w-4" />
  }
}

export function ImportProgressTracker({
  importId,
  onComplete,
  onDismiss
}: ImportProgressTrackerProps) {
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/match-import/${importId}`, {
        headers: { 'Cache-Control': 'no-store' }
      })
      if (!res.ok) throw new Error('Failed to fetch progress')

      const data = await res.json()
      setProgress(data)

      if (data.status === 'COMPLETED') {
        onComplete?.()
      } else if (data.status === 'FAILED') {
        setError(data.errorMessage || 'Import failed')
      }

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch progress')
      return null
    }
  }, [importId, onComplete])

  useEffect(() => {
    // Initial fetch
    fetchProgress()

    // Poll every 2 seconds while in progress
    const interval = setInterval(async () => {
      const data = await fetchProgress()
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [fetchProgress])

  if (error && !progress) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 font-medium">Import Failed</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-3 text-sm text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        )}
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[progress.status] || STATUS_CONFIG.PENDING

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900 truncate max-w-[200px]">
            {progress.filename}
          </span>
        </div>
        <span className={`text-sm px-2 py-1 rounded flex items-center gap-1.5 ${statusConfig.bgColor} ${statusConfig.color}`}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>

      {/* Progress bar for verification */}
      {progress.status === 'VERIFYING' && progress.totalPositions > 0 && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {progress.positionsVerified.toLocaleString()} / {progress.totalPositions.toLocaleString()} positions verified ({progress.progress}%)
          </p>
        </div>
      )}

      {/* Stats */}
      {(progress.status === 'REPLAYING' || progress.status === 'VERIFYING' || progress.status === 'COMPLETED') && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-gray-50 rounded p-2">
            <div className="font-semibold text-gray-900">{progress.totalMatches}</div>
            <div className="text-gray-500 text-xs">Matches</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="font-semibold text-gray-900">{progress.totalGames}</div>
            <div className="text-gray-500 text-xs">Games</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="font-semibold text-gray-900">{progress.totalPositions.toLocaleString()}</div>
            <div className="text-gray-500 text-xs">Positions</div>
          </div>
        </div>
      )}

      {/* Success message */}
      {progress.status === 'COMPLETED' && (
        <p className="text-sm text-green-600 mt-3">
          Successfully imported {progress.positionsVerified.toLocaleString()} verified positions!
        </p>
      )}

      {/* Error message */}
      {progress.status === 'FAILED' && progress.errorMessage && (
        <p className="text-sm text-red-600 mt-3">
          {progress.errorMessage}
        </p>
      )}

      {/* Dismiss button for completed/failed */}
      {(progress.status === 'COMPLETED' || progress.status === 'FAILED') && onDismiss && (
        <button
          onClick={onDismiss}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}

/**
 * ImportProgressList - Shows multiple active imports
 */
interface ImportProgressListProps {
  importIds: string[]
  onComplete?: (importId: string) => void
  onDismiss?: (importId: string) => void
}

export function ImportProgressList({
  importIds,
  onComplete,
  onDismiss
}: ImportProgressListProps) {
  if (importIds.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Active Imports</h3>
      {importIds.map(id => (
        <ImportProgressTracker
          key={id}
          importId={id}
          onComplete={() => onComplete?.(id)}
          onDismiss={() => onDismiss?.(id)}
        />
      ))}
    </div>
  )
}
