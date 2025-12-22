'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PositionCard } from './PositionCard'
import { PositionDetailModal } from './PositionDetailModal'
import type { PositionWithRelations, PositionLibraryResponse, GamePhase } from './types'

const PHASES: GamePhase[] = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']
const ITEMS_PER_PAGE = 20

interface PositionLibraryBrowserProps {
  engineId: string
  initialPhase?: GamePhase
  onClose: () => void
}

/**
 * Main browser component for exploring positions in the Position Library.
 * Features phase filter tabs, paginated grid, and detail modal.
 */
export function PositionLibraryBrowser({
  engineId,
  initialPhase,
  onClose
}: PositionLibraryBrowserProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [selectedPhase, setSelectedPhase] = useState<GamePhase | null>(initialPhase || null)
  const [positions, setPositions] = useState<PositionWithRelations[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<PositionWithRelations | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // ESC key handler (only when detail modal not open)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedPosition) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, selectedPosition])

  // Focus modal on mount
  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  const fetchPositions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        engineId,
        limit: ITEMS_PER_PAGE.toString(),
        offset: ((page - 1) * ITEMS_PER_PAGE).toString()
      })

      if (selectedPhase) {
        params.set('gamePhase', selectedPhase)
      }

      const response = await fetch(`/api/position-library?${params}`)

      if (!response.ok) {
        let errorMessage = 'Failed to fetch positions'
        if (response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.'
        } else if (response.status === 403) {
          errorMessage = 'Access denied.'
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again in a few moments.'
        }
        throw new Error(errorMessage)
      }

      const data: PositionLibraryResponse = await response.json()

      setPositions(data.positions)
      setCounts(data.counts)
      setTotalCount(data.total)
      setHasMore(data.pagination.hasMore)
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection.')
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      setLoading(false)
    }
  }, [engineId, selectedPhase, page])

  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

  // Reset to page 1 when phase changes
  const handlePhaseChange = (phase: GamePhase | null) => {
    setSelectedPhase(phase)
    setPage(1)
  }

  // Calculate total positions across all phases
  const totalPositions = Object.values(counts).reduce((sum, count) => sum + count, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="browser-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Browser Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 id="browser-title" className="text-lg font-semibold text-gray-900">Position Library Browser</h2>
            <p className="text-sm text-gray-500">
              {totalPositions} positions total
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close browser"
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Phase Tabs */}
        <div className="px-6 py-3 border-b bg-gray-50 shrink-0">
          <div className="flex flex-wrap gap-2">
            {/* All Phases Tab */}
            <button
              onClick={() => handlePhaseChange(null)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedPhase === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border hover:bg-gray-50 text-gray-700'
              )}
            >
              All ({totalPositions})
            </button>

            {/* Individual Phase Tabs */}
            {PHASES.map((phase) => (
              <button
                key={phase}
                onClick={() => handlePhaseChange(phase)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  selectedPhase === phase
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border hover:bg-gray-50 text-gray-700'
                )}
              >
                {formatPhaseLabel(phase)} ({counts[phase] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading positions...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchPositions}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Retry
              </button>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No positions found for this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position}
                  onClick={() => setSelectedPosition(position)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 border-t bg-gray-50 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={cn(
                    'p-2 rounded transition-colors',
                    page === 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers(page, totalPages).map((pageNum, idx) => (
                    pageNum === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum as number)}
                        className={cn(
                          'w-8 h-8 rounded text-sm font-medium transition-colors',
                          page === pageNum
                            ? 'bg-purple-600 text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                        )}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!hasMore}
                  className={cn(
                    'p-2 rounded transition-colors',
                    !hasMore
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Position Detail Modal */}
      {selectedPosition && (
        <PositionDetailModal
          position={selectedPosition}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </div>
  )
}

function formatPhaseLabel(phase: GamePhase): string {
  const labels: Record<GamePhase, string> = {
    OPENING: 'Opening',
    EARLY: 'Early',
    MIDDLE: 'Middle',
    BEAROFF: 'Bearoff'
  }
  return labels[phase]
}

/**
 * Generate page numbers with ellipsis for large page counts.
 * Shows: 1, ..., current-1, current, current+1, ..., last
 */
function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | string)[] = []

  // Always show first page
  pages.push(1)

  if (current > 3) {
    pages.push('...')
  }

  // Show pages around current
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    if (!pages.includes(i)) {
      pages.push(i)
    }
  }

  if (current < total - 2) {
    pages.push('...')
  }

  // Always show last page
  if (!pages.includes(total)) {
    pages.push(total)
  }

  return pages
}
