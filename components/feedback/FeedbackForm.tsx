'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  areaLabels,
  typeConfig,
  FeedbackArea,
  FeedbackType,
  CreateFeedbackSchema
} from '@/lib/feedback/validation'
import { Bug, Sparkles, Lightbulb, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const typeIcons = {
  BUG: Bug,
  ENHANCEMENT: Sparkles,
  IDEA: Lightbulb,
  QUESTION: HelpCircle,
}

interface FeedbackFormProps {
  onSubmit: (data: {
    title: string
    description: string
    area: FeedbackArea
    type: FeedbackType
  }) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}

export function FeedbackForm({ onSubmit, onCancel, isSubmitting }: FeedbackFormProps) {
  const [area, setArea] = useState<FeedbackArea | null>(null)
  const [type, setType] = useState<FeedbackType | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!area) {
      setErrors(prev => ({ ...prev, area: 'Please select an area' }))
      return
    }
    if (!type) {
      setErrors(prev => ({ ...prev, type: 'Please select a type' }))
      return
    }

    const result = CreateFeedbackSchema.safeParse({ title, description, area, type })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    await onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Area Selection */}
      <div className="space-y-2">
        <Label>What area is this about?</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(areaLabels) as [FeedbackArea, string][]).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant={area === key ? 'default' : 'outline'}
              className="justify-start h-auto py-2"
              onClick={() => setArea(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {errors.area && <p className="text-sm text-destructive">{errors.area}</p>}
      </div>

      {/* Type Selection */}
      <div className="space-y-2">
        <Label>What type of feedback?</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(typeConfig) as [FeedbackType, { label: string; icon: string }][]).map(([key, config]) => {
            const Icon = typeIcons[key]
            return (
              <Button
                key={key}
                type="button"
                variant={type === key ? 'default' : 'outline'}
                className="justify-start h-auto py-2 gap-2"
                onClick={() => setType(key)}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </Button>
            )
          })}
        </div>
        {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="title">Title</Label>
          <span className={cn(
            "text-xs",
            title.length > 200 ? "text-destructive" : "text-muted-foreground"
          )}>
            {title.length}/200
          </span>
        </div>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary of your feedback"
          maxLength={200}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="description">Description</Label>
          <span className={cn(
            "text-xs",
            description.length > 5000 ? "text-destructive" : "text-muted-foreground"
          )}>
            {description.length}/5000
          </span>
        </div>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide more details about your feedback..."
          rows={6}
          maxLength={5000}
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </div>
    </form>
  )
}
