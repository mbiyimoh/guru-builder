'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Gamepad2,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelfPlayBatch {
  id: string
  engineName: string
  gamesRequested: number
  gamesCompleted: number
  positionsStored: number
  duplicatesSkipped: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  byPhase: {
    OPENING: number
    EARLY: number
    MIDDLE: number
    BEAROFF: number
  }
  errors: number
  createdAt: string
  completedAt: string | null
}

interface SelfPlayStats {
  batches: SelfPlayBatch[]
  positionLibraryTotals: {
    OPENING: number
    EARLY: number
    MIDDLE: number
    BEAROFF: number
  }
  totalPositions: number
}

interface Props {
  engineId: string
  onPositionsGenerated?: () => void
}

/**
 * Self-Play Position Generator Component
 *
 * Allows admins to generate positions by simulating games using GNUBG.
 * These positions are stored in the Position Library for drill generation.
 */
export function SelfPlayGenerator({ engineId, onPositionsGenerated }: Props) {
  const [gamesCount, setGamesCount] = useState(10)
  const [skipOpening, setSkipOpening] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [stats, setStats] = useState<SelfPlayStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)

  // Fetch recent batches and stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/position-library/self-play')
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError('Admin access required')
          return
        }
        throw new Error('Failed to fetch self-play stats')
      }
      const data = await response.json()
      setStats(data)
      setError(null)

      // Check if there's an active batch
      const runningBatch = data.batches.find(
        (b: SelfPlayBatch) => b.status === 'RUNNING' || b.status === 'PENDING'
      )
      if (runningBatch) {
        setActiveBatchId(runningBatch.id)
      } else {
        setActiveBatchId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Poll for updates when there's an active batch
  useEffect(() => {
    if (!activeBatchId) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/position-library/self-play/${activeBatchId}`)
        if (!response.ok) return

        const batch = await response.json()

        // Update stats with new batch info
        setStats((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            batches: prev.batches.map((b) =>
              b.id === activeBatchId
                ? {
                    ...b,
                    gamesCompleted: batch.gamesCompleted,
                    positionsStored: batch.positionsStored,
                    duplicatesSkipped: batch.duplicatesSkipped,
                    status: batch.status,
                    byPhase: batch.byPhase,
                    errors: batch.errors?.length ?? 0,
                    completedAt: batch.completedAt,
                  }
                : b
            ),
          }
        })

        // Clear active batch when completed or failed
        if (batch.status === 'COMPLETED' || batch.status === 'FAILED') {
          setActiveBatchId(null)
          setIsGenerating(false)
          onPositionsGenerated?.()
          // Refresh full stats
          fetchStats()
        }
      } catch {
        // Silent fail on polling errors
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [activeBatchId, fetchStats, onPositionsGenerated])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/position-library/self-play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          gamesCount,
          skipOpening,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start self-play generation')
      }

      const data = await response.json()
      setActiveBatchId(data.batchId)

      // Add new batch to stats immediately
      setStats((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          batches: [
            {
              id: data.batchId,
              engineName: 'GNUBG',
              gamesRequested: data.gamesRequested,
              gamesCompleted: 0,
              positionsStored: 0,
              duplicatesSkipped: 0,
              status: 'PENDING',
              byPhase: { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 },
              errors: 0,
              createdAt: new Date().toISOString(),
              completedAt: null,
            },
            ...prev.batches.slice(0, 19), // Keep last 20
          ],
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  const getStatusIcon = (status: SelfPlayBatch['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'RUNNING':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'PENDING':
        return <AlertCircle className="h-4 w-4 text-amber-500" />
    }
  }

  const getStatusBadgeClass = (status: SelfPlayBatch['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700'
      case 'FAILED':
        return 'bg-red-100 text-red-700'
      case 'RUNNING':
        return 'bg-blue-100 text-blue-700'
      case 'PENDING':
        return 'bg-amber-100 text-amber-700'
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading self-play stats...</span>
        </div>
      </div>
    )
  }

  if (error === 'Admin access required') {
    return null // Hide component for non-admins
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center gap-2 mb-3">
        <Gamepad2 className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-medium text-gray-900">Self-Play Generator</span>
      </div>

      {/* Generation Form */}
      <div className="flex items-end gap-3 mb-4">
        <div className="flex-1">
          <label htmlFor="gamesCount" className="block text-xs text-muted-foreground mb-1">
            Games to simulate
          </label>
          <input
            id="gamesCount"
            type="number"
            min={1}
            max={100}
            value={gamesCount}
            onChange={(e) => setGamesCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
            disabled={isGenerating}
            className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="skipOpening"
            type="checkbox"
            checked={skipOpening}
            onChange={(e) => setSkipOpening(e.target.checked)}
            disabled={isGenerating}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="skipOpening" className="text-xs text-muted-foreground">
            Skip opening
          </label>
          <div className="group relative">
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Opening positions are already catalogued
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || activeBatchId !== null}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1.5" />
              Generate
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 rounded text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Active Batch Progress */}
      {activeBatchId && stats?.batches[0] && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Generation in Progress</span>
            <span className="text-xs text-blue-700">
              {stats.batches[0].gamesCompleted} / {stats.batches[0].gamesRequested} games
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(stats.batches[0].gamesCompleted / stats.batches[0].gamesRequested) * 100}%`,
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-blue-700">
            <span>{stats.batches[0].positionsStored} positions stored</span>
            <span>{stats.batches[0].duplicatesSkipped} duplicates skipped</span>
          </div>
        </div>
      )}

      {/* Recent Batches */}
      {stats && stats.batches.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Recent Batches</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {stats.batches.slice(0, 5).map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between p-2 bg-white rounded border text-sm"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(batch.status)}
                  <span className="text-gray-700">
                    {batch.gamesCompleted}/{batch.gamesRequested} games
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    +{batch.positionsStored} positions
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      getStatusBadgeClass(batch.status)
                    )}
                  >
                    {batch.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
