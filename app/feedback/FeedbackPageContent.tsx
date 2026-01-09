'use client'

import { useState } from 'react'
import { FeedbackList, FeedbackDialog } from '@/components/feedback'

interface FeedbackPageContentProps {
  userId: string
}

export function FeedbackPageContent({ userId }: FeedbackPageContentProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleFeedbackCreated = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Feedback Portal</h1>
          <p className="text-muted-foreground mt-1">
            Share your feedback, report bugs, or suggest new features
          </p>
        </div>
        <FeedbackDialog userId={userId} onFeedbackCreated={handleFeedbackCreated} />
      </div>

      {/* Feedback List */}
      <FeedbackList userId={userId} refreshKey={refreshKey} />
    </div>
  )
}
