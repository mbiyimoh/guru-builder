import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UpvoteButton } from './UpvoteButton'
import {
  areaLabels,
  typeConfig,
  FeedbackArea,
  FeedbackType,
  FeedbackStatus
} from '@/lib/feedback/validation'
import { formatDistanceToNow } from 'date-fns'
import { Bug, Sparkles, Lightbulb, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeedbackCardProps {
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

const typeIcons = {
  BUG: Bug,
  ENHANCEMENT: Sparkles,
  IDEA: Lightbulb,
  QUESTION: HelpCircle,
}

const typeBadgeColors: Record<FeedbackType, string> = {
  BUG: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  ENHANCEMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IDEA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  QUESTION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const statusBadgeColors: Record<FeedbackStatus, string> = {
  OPEN: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  IN_REVIEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PLANNED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  IN_PROGRESS: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  COMPLETED: 'bg-green-600 text-white',
  CLOSED: 'bg-gray-400 text-white',
}

export function FeedbackCard({
  id,
  title,
  description,
  area,
  type,
  status,
  upvoteCount,
  hasUserUpvoted,
  createdAt,
  user,
}: FeedbackCardProps) {
  const TypeIcon = typeIcons[type]

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {description}
            </p>
          </div>
          <UpvoteButton
            feedbackId={id}
            initialUpvotes={upvoteCount}
            initialHasUpvoted={hasUserUpvoted}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn('gap-1', typeBadgeColors[type])}>
            <TypeIcon className="h-3 w-3" />
            {typeConfig[type].label}
          </Badge>
          <Badge className={statusBadgeColors[status]}>
            {status.replace('_', ' ')}
          </Badge>
          <Badge variant="outline">{areaLabels[area]}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <span>{user.name || 'Anonymous'}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  )
}
