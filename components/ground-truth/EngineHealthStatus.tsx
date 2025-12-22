'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Server, Clock, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EngineHealthData {
  configured: boolean
  available: boolean
  latency?: number
  error?: string
  engineUrl?: string
  checkedAt?: string
}

interface Props {
  projectId: string
  /** Refresh interval in ms. Set to 0 to disable auto-refresh. Default: 30000 (30s) */
  refreshInterval?: number
  /** Compact mode for embedding in other components */
  compact?: boolean
  /** Callback when health status changes */
  onStatusChange?: (status: EngineHealthData) => void
}

/**
 * Ground Truth Engine Health Status Component
 *
 * Displays real-time health status of the ground truth verification engine.
 * Shows connection status, latency, and provides manual refresh capability.
 */
export function EngineHealthStatus({
  projectId,
  refreshInterval = 30000,
  compact = false,
  onStatusChange,
}: Props) {
  const [health, setHealth] = useState<EngineHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Use ref to track if initial load is done (avoids circular dependency)
  const isInitialLoad = useRef(true)

  const fetchHealth = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true)
    } else if (isInitialLoad.current) {
      setLoading(true)
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/ground-truth/health`)
      const data = await response.json()
      setHealth(data)
      onStatusChange?.(data)
    } catch (error) {
      const errorData = {
        configured: false,
        available: false,
        error: error instanceof Error ? error.message : 'Failed to check engine health',
      }
      setHealth(errorData)
      onStatusChange?.(errorData)
    } finally {
      setLoading(false)
      setRefreshing(false)
      isInitialLoad.current = false
    }
  }, [projectId, onStatusChange])

  useEffect(() => {
    fetchHealth()

    if (refreshInterval > 0) {
      const interval = setInterval(() => fetchHealth(), refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchHealth, refreshInterval])

  const handleManualRefresh = () => {
    fetchHealth(true)
  }

  if (loading) {
    return (
      <div className={cn(
        'flex items-center gap-2 text-muted-foreground',
        compact ? 'text-sm' : 'p-4 border rounded-lg'
      )}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Checking engine status...</span>
      </div>
    )
  }

  if (!health?.configured) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="h-4 w-4" />
          <span>Not configured</span>
        </div>
      )
    }

    return (
      <div className="p-4 border border-dashed rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Ground Truth Engine</p>
            <p className="text-sm text-muted-foreground">
              Not configured. Enable content validation in an assessment to activate.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const StatusIcon = health.available ? CheckCircle2 : health.error?.includes('timeout') ? AlertCircle : XCircle
  const statusColor = health.available ? 'text-green-500' : health.error?.includes('timeout') ? 'text-amber-500' : 'text-red-500'
  const statusBg = health.available ? 'bg-green-50 border-green-200' : health.error?.includes('timeout') ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon className={cn('h-4 w-4', statusColor)} />
        <span className={health.available ? 'text-green-700' : 'text-red-700'}>
          {health.available ? 'Engine Online' : 'Engine Offline'}
        </span>
        {health.latency && (
          <span className="text-muted-foreground">({health.latency}ms)</span>
        )}
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
        </button>
      </div>
    )
  }

  return (
    <div className={cn('p-4 border rounded-lg', statusBg)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon className={cn('h-5 w-5', statusColor)} />
          <div>
            <p className="font-medium">
              Ground Truth Engine
              <span className={cn('ml-2 text-sm font-normal', health.available ? 'text-green-700' : 'text-red-700')}>
                {health.available ? 'Online' : 'Offline'}
              </span>
            </p>
            {health.engineUrl && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <ExternalLink className="h-3 w-3" />
                {health.engineUrl}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="p-2 hover:bg-white/50 rounded transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm">
        {health.latency !== undefined && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Latency: {health.latency}ms</span>
          </div>
        )}
        {health.error && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{health.error}</span>
          </div>
        )}
        {health.checkedAt && (
          <div className="text-xs text-muted-foreground ml-auto">
            Last checked: {new Date(health.checkedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
}
