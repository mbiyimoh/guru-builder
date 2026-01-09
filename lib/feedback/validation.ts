import { z } from 'zod'

export const FeedbackAreaSchema = z.enum([
  'PROJECTS',
  'RESEARCH',
  'ARTIFACTS',
  'PROFILE',
  'READINESS',
  'UI_UX',
  'OTHER'
])

export const FeedbackTypeSchema = z.enum([
  'BUG',
  'ENHANCEMENT',
  'IDEA',
  'QUESTION'
])

export const FeedbackStatusSchema = z.enum([
  'OPEN',
  'IN_REVIEW',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED'
])

export const CreateFeedbackSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be 200 characters or less')
    .transform(s => s.trim()),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be 5000 characters or less')
    .transform(s => s.trim()),
  area: FeedbackAreaSchema,
  type: FeedbackTypeSchema,
})

export const VoteActionSchema = z.object({
  action: z.enum(['upvote', 'remove'])
})

// TypeScript types
export type FeedbackArea = z.infer<typeof FeedbackAreaSchema>
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>
export type VoteActionInput = z.infer<typeof VoteActionSchema>

// Area labels for display
export const areaLabels: Record<FeedbackArea, string> = {
  PROJECTS: 'Projects',
  RESEARCH: 'Research & Recommendations',
  ARTIFACTS: 'Teaching Artifacts',
  PROFILE: 'Guru Profile',
  READINESS: 'Readiness Assessment',
  UI_UX: 'User Interface',
  OTHER: 'Other'
}

// Type labels and icons for display
export const typeConfig: Record<FeedbackType, { label: string; icon: string }> = {
  BUG: { label: 'Bug Report', icon: 'Bug' },
  ENHANCEMENT: { label: 'Enhancement', icon: 'Sparkles' },
  IDEA: { label: 'Feature Idea', icon: 'Lightbulb' },
  QUESTION: { label: 'Question', icon: 'HelpCircle' }
}
