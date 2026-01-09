'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FeedbackForm } from './FeedbackForm'
import { Plus } from 'lucide-react'
import { FeedbackArea, FeedbackType } from '@/lib/feedback/validation'

interface FeedbackDialogProps {
  userId: string
  onFeedbackCreated?: () => void
}

export function FeedbackDialog({ userId, onFeedbackCreated }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Suppress unused variable warning - userId passed for future use
  void userId

  const handleSubmit = async (data: {
    title: string
    description: string
    area: FeedbackArea
    type: FeedbackType
  }) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit feedback')
      }

      alert('Feedback submitted successfully!')
      setOpen(false)
      onFeedbackCreated?.()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add New Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
        </DialogHeader>
        <FeedbackForm
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  )
}
