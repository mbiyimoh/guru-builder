'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Server,
  Clock,
  Plus,
  Trash2,
  Zap,
  Upload,
  Globe,
  Database,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MatchImportModal, ImportProgressList } from '@/components/match-import'
import { PositionLibraryBrowser } from '@/components/position-library'
import type { GamePhase } from '@/components/position-library'

interface GroundTruthEngine {
  id: string
  name: string
  domain: string
  description: string | null
  iconUrl: string | null
  engineUrl: string
}

interface ProjectGroundTruthConfig {
  id: string
  projectId: string
  engineId: string
  isEnabled: boolean
  engine: GroundTruthEngine & { isActive: boolean }
}

interface EngineHealthData {
  configured: boolean
  available: boolean
  latency?: number
  error?: string
  engineUrl?: string
  checkedAt?: string
}

interface PositionStats {
  OPENING: number
  EARLY: number
  MIDDLE: number
  BEAROFF: number
}

interface ArchiveStats {
  totalArchives: number
  totalPositions: number
}

interface Props {
  projectId: string
}

/**
 * Ground Truth Engine Manager
 *
 * Allows users to browse available ground truth engines and enable
 * them for their project. Shows engine status when enabled.
 */
export function GroundTruthEngineManager({ projectId }: Props) {
  const [engines, setEngines] = useState<GroundTruthEngine[]>([])
  const [activeConfig, setActiveConfig] = useState<ProjectGroundTruthConfig | null>(null)
  const [health, setHealth] = useState<EngineHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabling, setEnabling] = useState<string | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [activeImports, setActiveImports] = useState<string[]>([])
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null)
  const [positionStats, setPositionStats] = useState<PositionStats | null>(null)
  const [archiveStats, setArchiveStats] = useState<ArchiveStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [browserInitialPhase, setBrowserInitialPhase] = useState<GamePhase | undefined>(undefined)

  // Fetch available engines and project config
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [enginesRes, configRes] = await Promise.all([
        fetch('/api/ground-truth-engines'),
        fetch(`/api/projects/${projectId}/ground-truth-config`),
      ])

      // Check for errors
      if (!enginesRes.ok) {
        console.error('Failed to fetch engines:', enginesRes.status, await enginesRes.text())
        setEngines([])
      } else {
        const enginesData = await enginesRes.json()
        setEngines(enginesData.engines || [])
      }

      if (!configRes.ok) {
        console.error('Failed to fetch config:', configRes.status)
        setActiveConfig(null)
      } else {
        const configData = await configRes.json()
        setActiveConfig(configData.activeConfig || null)
      }
    } catch (error) {
      console.error('Error fetching ground truth data:', error)
      setEngines([])
      setActiveConfig(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Fetch engine health status with improved error handling
  const fetchHealth = useCallback(async () => {
    if (!activeConfig) return

    setCheckingHealth(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/ground-truth/health`)

      if (!response.ok) {
        let errorMessage = 'Failed to check health'
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.'
        } else if (response.status === 500) {
          errorMessage = 'Server error. Try again in a few moments.'
        } else if (response.status === 504) {
          errorMessage = 'Health check timed out. The engine may be slow or unreachable.'
        }
        setHealth({
          configured: true,
          available: false,
          error: errorMessage,
        })
        return
      }

      const data = await response.json()
      setHealth(data)
    } catch (error) {
      let errorMessage = 'Failed to check health'

      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to reach server. Check your connection.'
      } else if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Health check timed out. The engine may be slow or unreachable.'
        } else {
          errorMessage = error.message
        }
      }

      setHealth({
        configured: true,
        available: false,
        error: errorMessage,
      })
    } finally {
      setCheckingHealth(false)
    }
  }, [projectId, activeConfig])

  // Fetch position library and archive stats
  const fetchLibraryStats = useCallback(async () => {
    if (!activeConfig) return

    setLoadingStats(true)
    try {
      // Fetch position counts and archive stats in parallel
      const [positionsRes, archivesRes] = await Promise.all([
        fetch(`/api/position-library/counts?engineId=${activeConfig.engineId}`),
        fetch('/api/match-import/scrape'),
      ])

      if (positionsRes.ok) {
        const positionsData = await positionsRes.json()
        setPositionStats(positionsData)
      }

      if (archivesRes.ok) {
        const archivesData = await archivesRes.json()
        // Calculate totals from collections data
        const totalArchives = archivesData.collections?.reduce(
          (sum: number, c: { importedArchives: number }) => sum + c.importedArchives,
          0
        ) ?? 0
        setArchiveStats({
          totalArchives,
          totalPositions: archivesData.totalImportedPositions ?? 0,
        })
      }
    } catch (error) {
      console.error('Error fetching library stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [activeConfig])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (activeConfig) {
      fetchHealth()
      fetchLibraryStats()
      // Auto-refresh health every 30 seconds
      const interval = setInterval(fetchHealth, 30000)
      // Auto-refresh stats every 10 seconds (for scrape progress)
      const statsInterval = setInterval(fetchLibraryStats, 10000)
      return () => {
        clearInterval(interval)
        clearInterval(statsInterval)
      }
    } else {
      setHealth(null)
      setPositionStats(null)
      setArchiveStats(null)
    }
  }, [activeConfig, fetchHealth, fetchLibraryStats])

  const handleEnableEngine = async (engineId: string) => {
    setEnabling(engineId)
    try {
      const response = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineId }),
      })

      if (response.ok) {
        await fetchData()
        setShowSelector(false)
      } else {
        const error = await response.json()
        console.error('Failed to enable engine:', error)
      }
    } catch (error) {
      console.error('Error enabling engine:', error)
    } finally {
      setEnabling(null)
    }
  }

  const handleDisableEngine = async () => {
    setDisabling(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setActiveConfig(null)
        setHealth(null)
      } else {
        const error = await response.json()
        console.error('Failed to disable engine:', error)
      }
    } catch (error) {
      console.error('Error disabling engine:', error)
    } finally {
      setDisabling(false)
    }
  }

  const handleImportStarted = (importId: string) => {
    setActiveImports(prev => [...prev, importId])
  }

  const handleImportComplete = (importId: string) => {
    // Keep in list for a short time to show completion, then remove
    setTimeout(() => {
      setActiveImports(prev => prev.filter(id => id !== importId))
    }, 5000)
  }

  const handleImportDismiss = (importId: string) => {
    setActiveImports(prev => prev.filter(id => id !== importId))
  }

  const handleScrapeHardy = async () => {
    if (!activeConfig) return

    setIsScraping(true)
    setScrapeMessage(null)

    try {
      const response = await fetch('/api/match-import/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'Hardy',
          engineId: activeConfig.engineId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start scrape')
      }

      await response.json()
      setScrapeMessage(
        `Scrape started! Fetching ~100 matches from Hardy's Backgammon Pages. This may take 2-3 minutes. Watch the Library Stats below for progress.`
      )

      // Trigger immediate stats refresh
      fetchLibraryStats()

      // Clear message after 60 seconds (scrape should be well underway by then)
      setTimeout(() => setScrapeMessage(null), 60000)
    } catch (error) {
      setScrapeMessage(
        `Error: ${error instanceof Error ? error.message : 'Failed to start scrape'}`
      )
    } finally {
      setIsScraping(false)
    }
  }

  const handleOpenBrowser = (phase?: GamePhase) => {
    setBrowserInitialPhase(phase)
    setShowBrowser(true)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading ground truth engines...</span>
        </div>
      </div>
    )
  }

  // Engine is enabled - show status card
  if (activeConfig) {
    const engine = activeConfig.engine
    const StatusIcon = health?.available ? CheckCircle2 : health?.error ? XCircle : AlertCircle
    const statusColor = health?.available ? 'text-green-500' : health?.error ? 'text-red-500' : 'text-amber-500'
    const statusBg = health?.available
      ? 'bg-green-50 border-green-200'
      : health?.error
        ? 'bg-red-50 border-red-200'
        : 'bg-amber-50 border-amber-200'

    return (
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Ground Truth Engine</h2>
            <button
              onClick={handleDisableEngine}
              disabled={disabling}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {disabling ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Disable
            </button>
          </div>
        </div>

        <div className={cn('p-4 m-4 border rounded-lg', statusBg)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {engine.name}
                  <span className={cn('ml-2 text-sm font-normal', statusColor)}>
                    {health?.available ? 'Online' : health?.error ? 'Offline' : 'Checking...'}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">{engine.domain}</p>
                {engine.description && (
                  <p className="text-sm text-gray-600 mt-1">{engine.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {health && (
                <StatusIcon className={cn('h-5 w-5', statusColor)} />
              )}
              <button
                onClick={() => fetchHealth()}
                disabled={checkingHealth}
                className="p-2 hover:bg-white/50 rounded transition-colors"
                title="Refresh status"
              >
                <RefreshCw className={cn('h-4 w-4', checkingHealth && 'animate-spin')} />
              </button>
            </div>
          </div>

          {health && (
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
          )}
        </div>

        {/* Position Library Import Section */}
        <div className="px-6 pb-4 border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Position Library</p>
              <p className="text-xs text-muted-foreground">
                Import match archives to populate the position library for drills.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleScrapeHardy}
                disabled={isScraping}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                title="Automatically fetch ~100 matches from Hardy's Backgammon Pages"
              >
                {isScraping ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-1.5" />
                )}
                Scrape Hardy&apos;s
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Upload File
              </button>
            </div>
          </div>

          {/* Scrape Status Message */}
          {scrapeMessage && (
            <div
              className={cn(
                'mb-3 p-2 rounded text-sm',
                scrapeMessage.startsWith('Error')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              )}
            >
              {scrapeMessage}
            </div>
          )}

          {/* Active Imports */}
          <ImportProgressList
            importIds={activeImports}
            onComplete={handleImportComplete}
            onDismiss={handleImportDismiss}
          />

          {/* Position Library Stats */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">Library Stats</span>
              </div>
              {loadingStats && (
                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>

            {positionStats || archiveStats ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Archive Stats */}
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Archives:</span>
                  <span className="font-medium">{archiveStats?.totalArchives ?? 0}</span>
                </div>

                {/* Total Positions - Clickable */}
                <button
                  onClick={() => handleOpenBrowser()}
                  className="flex items-center gap-2 hover:text-purple-600 transition-colors"
                >
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Positions:</span>
                  <span className="font-medium underline underline-offset-2 decoration-dotted">
                    {(positionStats?.OPENING ?? 0) +
                      (positionStats?.EARLY ?? 0) +
                      (positionStats?.MIDDLE ?? 0) +
                      (positionStats?.BEAROFF ?? 0)}
                  </span>
                </button>

                {/* Phase Breakdown - Clickable */}
                {positionStats && (
                  <>
                    <div className="col-span-2 border-t pt-2 mt-1">
                      <p className="text-xs text-muted-foreground mb-1">By Game Phase (click to browse):</p>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <button
                          onClick={() => handleOpenBrowser('OPENING')}
                          className="text-center p-1 bg-white rounded border hover:border-purple-300 hover:bg-purple-50 transition-colors"
                        >
                          <div className="font-medium">{positionStats.OPENING}</div>
                          <div className="text-muted-foreground">Opening</div>
                        </button>
                        <button
                          onClick={() => handleOpenBrowser('EARLY')}
                          className="text-center p-1 bg-white rounded border hover:border-purple-300 hover:bg-purple-50 transition-colors"
                        >
                          <div className="font-medium">{positionStats.EARLY}</div>
                          <div className="text-muted-foreground">Early</div>
                        </button>
                        <button
                          onClick={() => handleOpenBrowser('MIDDLE')}
                          className="text-center p-1 bg-white rounded border hover:border-purple-300 hover:bg-purple-50 transition-colors"
                        >
                          <div className="font-medium">{positionStats.MIDDLE}</div>
                          <div className="text-muted-foreground">Middle</div>
                        </button>
                        <button
                          onClick={() => handleOpenBrowser('BEAROFF')}
                          className="text-center p-1 bg-white rounded border hover:border-purple-300 hover:bg-purple-50 transition-colors"
                        >
                          <div className="font-medium">{positionStats.BEAROFF}</div>
                          <div className="text-muted-foreground">Bearoff</div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No positions imported yet. Use the scraper or upload match files to build your library.
              </p>
            )}
          </div>
        </div>

        <div className="px-6 pb-4">
          <p className="text-sm text-muted-foreground">
            Teaching content generated for this project will be verified against {engine.name} for accuracy.
          </p>
        </div>

        {/* Import Modal */}
        <MatchImportModal
          engineId={activeConfig.engineId}
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportStarted={handleImportStarted}
        />

        {/* Position Library Browser */}
        {showBrowser && (
          <PositionLibraryBrowser
            engineId={activeConfig.engineId}
            initialPhase={browserInitialPhase}
            onClose={() => {
              setShowBrowser(false)
              setBrowserInitialPhase(undefined)
            }}
          />
        )}
      </div>
    )
  }

  // No engine enabled - show selector
  return (
    <div className="bg-white rounded-lg border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Ground Truth Engine</h2>
      </div>

      {!showSelector ? (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Server className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="font-medium text-gray-900">No Engine Configured</p>
              <p className="text-sm text-muted-foreground">
                Add a ground truth engine to verify teaching content accuracy.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSelector(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Ground Truth Engine
          </button>
        </div>
      ) : (
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-medium text-gray-700">Available Engines</p>
            <button
              onClick={() => setShowSelector(false)}
              className="text-sm text-muted-foreground hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          {engines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ground truth engines available.</p>
          ) : (
            <div className="space-y-3">
              {engines.map((engine) => (
                <div
                  key={engine.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Zap className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{engine.name}</p>
                      <p className="text-sm text-muted-foreground">{engine.domain}</p>
                      {engine.description && (
                        <p className="text-sm text-gray-600 mt-1">{engine.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnableEngine(engine.id)}
                    disabled={enabling === engine.id}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:opacity-50"
                  >
                    {enabling === engine.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Enable
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
