'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UpvoteButtonProps {
  feedbackId: string
  initialUpvotes: number
  initialHasUpvoted: boolean
}

export function UpvoteButton({
  feedbackId,
  initialUpvotes,
  initialHasUpvoted,
}: UpvoteButtonProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes)
  const [hasUpvoted, setHasUpvoted] = useState(initialHasUpvoted)
  const [isLoading, setIsLoading] = useState(false)

  const handleVote = async () => {
    if (isLoading) return

    // Optimistic update
    const previousUpvotes = upvotes
    const previousHasUpvoted = hasUpvoted
    const newHasUpvoted = !hasUpvoted

    setHasUpvoted(newHasUpvoted)
    setUpvotes(prev => newHasUpvoted ? prev + 1 : prev - 1)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/feedback/${feedbackId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: newHasUpvoted ? 'upvote' : 'remove'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to vote')
      }

      const data = await response.json()
      setUpvotes(data.upvoteCount)
      setHasUpvoted(data.hasUserUpvoted)
    } catch {
      // Rollback on error
      setUpvotes(previousUpvotes)
      setHasUpvoted(previousHasUpvoted)
      alert('Failed to vote. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={hasUpvoted ? 'default' : 'outline'}
      size="sm"
      onClick={handleVote}
      disabled={isLoading}
      className={cn(
        'gap-1.5',
        hasUpvoted && 'bg-primary text-primary-foreground'
      )}
    >
      <ThumbsUp className={cn('h-4 w-4', hasUpvoted && 'fill-current')} />
      <span>{upvotes}</span>
    </Button>
  )
}
