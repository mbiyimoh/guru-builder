'use client'

import { useState, useEffect, useCallback } from 'react'
import { FeedbackCard } from './FeedbackCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import {
  areaLabels,
  typeConfig,
  FeedbackArea,
  FeedbackType,
  FeedbackStatus
} from '@/lib/feedback/validation'

interface FeedbackItem {
  id: string
  title: string
  description: string
  area: FeedbackArea
  type: FeedbackType
  status: FeedbackStatus
  upvoteCount: number
  hasUserUpvoted: boolean
  createdAt: string
  user: { id: string; name: string | null }
}

interface FeedbackListProps {
  userId: string
  refreshKey?: number
}

export function FeedbackList({ userId, refreshKey }: FeedbackListProps) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sort, setSort] = useState('popular')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Suppress unused variable warning - userId passed for future use
  void userId

  const fetchFeedback = useCallback(async (cursor?: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (areaFilter !== 'all') params.set('area', areaFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (cursor) params.set('cursor', cursor)

      const response = await fetch(`/api/feedback?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()

      if (cursor) {
        setFeedback(prev => [...prev, ...data.feedback])
      } else {
        setFeedback(data.feedback)
      }
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching feedback:', error)
    } finally {
      setIsLoading(false)
    }
  }, [sort, areaFilter, typeFilter])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback, refreshKey])

  const loadMore = () => {
    if (nextCursor && !isLoading) {
      fetchFeedback(nextCursor)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>

        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            {Object.entries(areaLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(typeConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="ml-auto">
          {feedback.length} items
        </Badge>
      </div>

      {/* List */}
      {isLoading && feedback.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No feedback found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to share your thoughts!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <FeedbackCard key={item.id} {...item} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
