'use client'

import { useState } from 'react'

interface Props {
  resultId: string
  initialRating?: number
  onRatingChange?: (rating: number) => void
}

export function StarRating({ resultId, initialRating, onRatingChange }: Props) {
  const [rating, setRating] = useState(initialRating || 0)
  const [hover, setHover] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!initialRating)
  const [error, setError] = useState<string | null>(null)

  async function handleClick(value: number) {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/assessment/results/${resultId}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: value }),
      })

      if (response.ok) {
        setRating(value)
        setSubmitted(true)
        onRatingChange?.(value)
      } else {
        const data = await response.json().catch(() => ({}))
        if (response.status === 404) {
          setError('Result not found')
        } else if (response.status === 400) {
          setError('Invalid rating')
        } else {
          setError(data.error || 'Failed to save rating')
        }
      }
    } catch (error) {
      console.error('Failed to save rating:', error)
      setError('Network error - please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            disabled={isSubmitting}
            className={`text-2xl transition-colors ${
              isSubmitting ? 'cursor-wait' : 'cursor-pointer'
            }`}
            aria-label={`Rate ${star} stars`}
          >
            <svg
              className={`w-6 h-6 ${
                star <= (hover || rating)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 fill-gray-300'
              }`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {submitted && !error && (
        <p className="text-xs text-gray-500">
          {isSubmitting ? 'Saving...' : `Rated ${rating}/5`}
        </p>
      )}
    </div>
  )
}
