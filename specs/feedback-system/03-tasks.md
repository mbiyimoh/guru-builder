# Task Breakdown: User Feedback System

**Generated:** 2026-01-09
**Source:** specs/feedback-system/02-specification.md
**Last Decompose:** 2026-01-09
**Mode:** Full

---

## Overview

Implement a user feedback system for Guru Builder with sticky feedback button, dedicated portal page, upvoting, and filtering. All functionality requires authentication.

**Total Tasks:** 12
**Phases:** 4
**Estimated Time:** 4 hours

---

## Phase 1: Database & Schema (3 tasks)

### Task 1.1: Add Feedback Enums to Prisma Schema
**Description:** Add three enums for FeedbackArea, FeedbackType, and FeedbackStatus
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (must complete first)

**Technical Requirements:**
Add to `prisma/schema.prisma` after the existing enums section:

```prisma
// ============================================================================
// USER FEEDBACK SYSTEM
// ============================================================================

enum FeedbackArea {
  PROJECTS      // Project management
  RESEARCH      // Research runs and recommendations
  ARTIFACTS     // Teaching artifact generation
  PROFILE       // Guru profile creation
  READINESS     // Readiness assessment
  UI_UX         // General interface feedback
  OTHER         // Catch-all
}

enum FeedbackType {
  BUG           // Something is broken
  ENHANCEMENT   // Improvement to existing feature
  IDEA          // New feature suggestion
  QUESTION      // General question or confusion
}

enum FeedbackStatus {
  OPEN          // New, visible to all users
  IN_REVIEW     // Being evaluated by team
  PLANNED       // Accepted, will be implemented
  IN_PROGRESS   // Currently being worked on
  COMPLETED     // Done/shipped
  CLOSED        // Won't do / duplicate / invalid
}
```

**Acceptance Criteria:**
- [ ] All three enums added to schema
- [ ] Enum values match spec exactly
- [ ] Comments explain each value

---

### Task 1.2: Add Feedback and FeedbackVote Models
**Description:** Add Feedback and FeedbackVote models with proper relations and indexes
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Technical Requirements:**
Add to `prisma/schema.prisma` after the enums:

```prisma
model Feedback {
  id          String         @id @default(cuid())
  userId      String

  // Content
  title       String         @db.VarChar(200)
  description String         @db.Text

  // Categorization
  area        FeedbackArea
  type        FeedbackType
  status      FeedbackStatus @default(OPEN)

  // Metrics - denormalized for sorting performance
  upvoteCount Int            @default(0)

  // Timestamps
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  // Relations
  user        User           @relation("UserFeedback", fields: [userId], references: [id], onDelete: Cascade)
  votes       FeedbackVote[]

  @@index([userId])
  @@index([status])
  @@index([area])
  @@index([type])
  @@index([createdAt])
  @@index([upvoteCount])
}

model FeedbackVote {
  id         String   @id @default(cuid())
  feedbackId String
  userId     String
  createdAt  DateTime @default(now())

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  user       User     @relation("UserFeedbackVotes", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, userId])  // One vote per user per feedback
  @@index([feedbackId])
  @@index([userId])
}
```

Also add to existing `User` model:

```prisma
  // Feedback relations
  feedbackSubmissions Feedback[]     @relation("UserFeedback")
  feedbackVotes       FeedbackVote[] @relation("UserFeedbackVotes")
```

**Acceptance Criteria:**
- [ ] Feedback model has all fields from spec
- [ ] FeedbackVote model has unique constraint on [feedbackId, userId]
- [ ] User model has both relation fields added
- [ ] All indexes are present for query performance
- [ ] upvoteCount is denormalized (default 0)

---

### Task 1.3: Run Database Migration
**Description:** Backup database and run safe migration for feedback system
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** None

**Technical Requirements:**
Execute commands:
```bash
npm run db:backup
npm run migrate:safe -- add-feedback-system
```

Verify migration:
```bash
npx prisma studio
# Check that Feedback and FeedbackVote tables exist
```

**Acceptance Criteria:**
- [ ] Database backup created successfully
- [ ] Migration runs without errors
- [ ] Prisma client regenerated
- [ ] Tables visible in Prisma Studio
- [ ] No existing data affected

---

## Phase 2: Validation & API (4 tasks)

### Task 2.1: Create Validation Schemas
**Description:** Create Zod validation schemas for feedback operations
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.3
**Can run parallel with:** None

**Technical Requirements:**
Create `lib/feedback/validation.ts`:

```typescript
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
```

**Acceptance Criteria:**
- [ ] All Zod schemas match Prisma enums exactly
- [ ] CreateFeedbackSchema has min/max validation
- [ ] Trim transform applied to strings
- [ ] Types exported for use in components
- [ ] areaLabels and typeConfig exported for UI

---

### Task 2.2: Implement POST/GET /api/feedback
**Description:** Create main feedback API route for creating and listing feedback
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** None

**Technical Requirements:**
Create `app/api/feedback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { CreateFeedbackSchema } from '@/lib/feedback/validation'

export const dynamic = 'force-dynamic'

// POST - Create new feedback
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = CreateFeedbackSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const feedback = await prisma.feedback.create({
      data: {
        ...validated.data,
        userId: user.id,
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ feedback }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Error creating feedback:', error)
    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 })
  }
}

// GET - List feedback with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'popular'
    const area = searchParams.get('area')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const cursor = searchParams.get('cursor')

    // Build where clause
    const where: any = {}
    if (area) where.area = area
    if (type) where.type = type
    if (status) {
      where.status = status
    } else {
      // Default: exclude CLOSED
      where.status = { not: 'CLOSED' }
    }

    // Build orderBy
    let orderBy: any
    switch (sort) {
      case 'recent':
        orderBy = { createdAt: 'desc' }
        break
      case 'oldest':
        orderBy = { createdAt: 'asc' }
        break
      case 'popular':
      default:
        orderBy = { upvoteCount: 'desc' }
    }

    const feedback = await prisma.feedback.findMany({
      where,
      orderBy,
      take: limit + 1, // Fetch one extra to check hasMore
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        user: { select: { id: true, name: true } }
      }
    })

    // Check if there are more results
    const hasMore = feedback.length > limit
    if (hasMore) feedback.pop()

    // Get user's votes for these feedback items
    const feedbackIds = feedback.map(f => f.id)
    const userVotes = await prisma.feedbackVote.findMany({
      where: {
        feedbackId: { in: feedbackIds },
        userId: user.id
      },
      select: { feedbackId: true }
    })
    const votedIds = new Set(userVotes.map(v => v.feedbackId))

    // Add hasUserUpvoted to each item
    const feedbackWithVotes = feedback.map(f => ({
      ...f,
      hasUserUpvoted: votedIds.has(f.id)
    }))

    return NextResponse.json({
      feedback: feedbackWithVotes,
      nextCursor: hasMore ? feedback[feedback.length - 1].id : null,
      hasMore
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- [ ] POST creates feedback with validated data
- [ ] POST returns 401 for unauthenticated users
- [ ] POST returns 400 for invalid data with error details
- [ ] GET supports sort (popular/recent/oldest)
- [ ] GET supports area, type, status filters
- [ ] GET excludes CLOSED by default
- [ ] GET implements cursor pagination
- [ ] GET returns hasUserUpvoted for each item
- [ ] Both endpoints have Cache-Control: no-store

---

### Task 2.3: Implement GET /api/feedback/[id]
**Description:** Create single feedback fetch endpoint (clarification from validation)
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 2.2
**Can run parallel with:** Task 2.4

**Technical Requirements:**
Create `app/api/feedback/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET - Fetch single feedback item
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } }
      }
    })

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    // Check if user has voted
    const vote = await prisma.feedbackVote.findUnique({
      where: {
        feedbackId_userId: { feedbackId: id, userId: user.id }
      }
    })

    return NextResponse.json({
      feedback: {
        ...feedback,
        hasUserUpvoted: !!vote
      }
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- [ ] Returns single feedback item with user info
- [ ] Returns 404 for non-existent ID
- [ ] Returns 401 for unauthenticated users
- [ ] Includes hasUserUpvoted flag
- [ ] Response shape matches list item shape

---

### Task 2.4: Implement POST /api/feedback/[id]/vote
**Description:** Create voting endpoint with atomic transaction
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** Task 2.3

**Technical Requirements:**
Create `app/api/feedback/[id]/vote/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { VoteActionSchema } from '@/lib/feedback/validation'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: feedbackId } = await context.params
    const body = await request.json()

    const validated = VoteActionSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { action } = validated.data

    // Check feedback exists
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId }
    })

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    // Check current vote status
    const existingVote = await prisma.feedbackVote.findUnique({
      where: {
        feedbackId_userId: { feedbackId, userId: user.id }
      }
    })

    let newUpvoteCount = feedback.upvoteCount
    let hasUserUpvoted = !!existingVote

    if (action === 'upvote' && !existingVote) {
      // Add vote - atomic transaction
      await prisma.$transaction([
        prisma.feedbackVote.create({
          data: { feedbackId, userId: user.id }
        }),
        prisma.feedback.update({
          where: { id: feedbackId },
          data: { upvoteCount: { increment: 1 } }
        })
      ])
      newUpvoteCount += 1
      hasUserUpvoted = true
    } else if (action === 'remove' && existingVote) {
      // Remove vote - atomic transaction
      await prisma.$transaction([
        prisma.feedbackVote.delete({
          where: { id: existingVote.id }
        }),
        prisma.feedback.update({
          where: { id: feedbackId },
          data: { upvoteCount: { decrement: 1 } }
        })
      ])
      newUpvoteCount -= 1
      hasUserUpvoted = false
    }
    // No-op for already voted/already unvoted cases

    return NextResponse.json({
      success: true,
      upvoteCount: newUpvoteCount,
      hasUserUpvoted
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Error voting on feedback:', error)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- [ ] Upvote creates vote and increments count atomically
- [ ] Remove deletes vote and decrements count atomically
- [ ] No-op when upvoting already-voted item
- [ ] No-op when removing non-existent vote
- [ ] Returns 404 for non-existent feedback
- [ ] Returns updated upvoteCount and hasUserUpvoted
- [ ] Uses $transaction for atomicity

---

## Phase 3: Components (4 tasks)

### Task 3.1: Create FeedbackButton and UpvoteButton
**Description:** Create sticky feedback button and reusable upvote button with optimistic UI
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.4
**Can run parallel with:** None (components need API)

**Technical Requirements:**

Create `components/feedback/FeedbackButton.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquarePlus } from 'lucide-react'

export function FeedbackButton() {
  const router = useRouter()

  return (
    <Button
      onClick={() => router.push('/feedback')}
      className="fixed bottom-6 left-6 z-50 rounded-full shadow-lg h-12 w-12 p-0"
      size="icon"
      title="Send Feedback"
    >
      <MessageSquarePlus className="h-5 w-5" />
    </Button>
  )
}
```

Create `components/feedback/UpvoteButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
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
    } catch (error) {
      // Rollback on error
      setUpvotes(previousUpvotes)
      setHasUpvoted(previousHasUpvoted)
      toast.error('Failed to vote. Please try again.')
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
```

**Acceptance Criteria:**
- [ ] FeedbackButton is fixed bottom-left with z-50
- [ ] FeedbackButton navigates to /feedback on click
- [ ] UpvoteButton shows optimistic update immediately
- [ ] UpvoteButton rolls back on error with toast
- [ ] UpvoteButton shows filled icon when voted
- [ ] UpvoteButton disabled during loading

---

### Task 3.2: Create FeedbackCard Component
**Description:** Create card component displaying single feedback item with badges
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.1
**Can run parallel with:** None

**Technical Requirements:**

Create `components/feedback/FeedbackCard.tsx`:

```typescript
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
```

**Acceptance Criteria:**
- [ ] Card displays title, description (2 lines max)
- [ ] Type badge with icon and correct color
- [ ] Status badge with correct color
- [ ] Area badge (outline variant)
- [ ] User name and relative timestamp
- [ ] Upvote button in top-right
- [ ] Hover shadow effect

---

### Task 3.3: Create FeedbackList Component
**Description:** Create list component with filters, sorting, and pagination
**Size:** Large
**Priority:** High
**Dependencies:** Task 3.2
**Can run parallel with:** None

**Technical Requirements:**

Create `components/feedback/FeedbackList.tsx`:

```typescript
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
  FeedbackType
} from '@/lib/feedback/validation'

interface FeedbackItem {
  id: string
  title: string
  description: string
  area: FeedbackArea
  type: FeedbackType
  status: string
  upvoteCount: number
  hasUserUpvoted: boolean
  createdAt: string
  user: { id: string; name: string | null }
}

interface FeedbackListProps {
  userId: string
}

export function FeedbackList({ userId }: FeedbackListProps) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sort, setSort] = useState('popular')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

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
  }, [fetchFeedback])

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
```

**Acceptance Criteria:**
- [ ] Sort dropdown (popular/recent/oldest)
- [ ] Area filter dropdown
- [ ] Type filter dropdown
- [ ] Result count badge
- [ ] Loading spinner on initial load
- [ ] Empty state with encouraging message
- [ ] Load More button for pagination
- [ ] Filters trigger refetch

---

### Task 3.4: Create FeedbackForm and FeedbackDialog
**Description:** Create form for submitting feedback and dialog wrapper
**Size:** Large
**Priority:** High
**Dependencies:** Task 3.3
**Can run parallel with:** None

**Technical Requirements:**

Create `components/feedback/FeedbackForm.tsx`:

```typescript
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
```

Create `components/feedback/FeedbackDialog.tsx`:

```typescript
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
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface FeedbackDialogProps {
  userId: string
  onFeedbackCreated?: () => void
}

export function FeedbackDialog({ userId, onFeedbackCreated }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: {
    title: string
    description: string
    area: string
    type: string
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

      toast.success('Feedback submitted successfully!')
      setOpen(false)
      onFeedbackCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback')
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
```

Create barrel export `components/feedback/index.ts`:

```typescript
export { FeedbackButton } from './FeedbackButton'
export { FeedbackCard } from './FeedbackCard'
export { FeedbackDialog } from './FeedbackDialog'
export { FeedbackForm } from './FeedbackForm'
export { FeedbackList } from './FeedbackList'
export { UpvoteButton } from './UpvoteButton'
```

**Acceptance Criteria:**
- [ ] Form has area selection (2-column grid)
- [ ] Form has type selection with icons (2-column grid)
- [ ] Title input with character counter (max 200)
- [ ] Description textarea with counter (max 5000)
- [ ] Client-side validation with error messages
- [ ] Dialog opens/closes properly
- [ ] Success toast on submission
- [ ] Error toast on failure
- [ ] Form resets after successful submission
- [ ] Barrel export for all components

---

## Phase 4: Page & Integration (1 task)

### Task 4.1: Create Feedback Page and Layout Integration
**Description:** Create the /feedback page and add FeedbackButton to root layout
**Size:** Medium
**Priority:** High
**Dependencies:** Task 3.4
**Can run parallel with:** None

**Technical Requirements:**

Create `app/feedback/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { FeedbackList, FeedbackDialog } from '@/components/feedback'

export const dynamic = 'force-dynamic'

export default async function FeedbackPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
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
        <FeedbackDialog userId={user.id} />
      </div>

      {/* Feedback List */}
      <FeedbackList userId={user.id} />
    </div>
  )
}
```

Update `app/layout.tsx` - add FeedbackButton after main content:

```typescript
// Add import at top
import { FeedbackButton } from '@/components/feedback'

// In the JSX, after </main> and before footer/closing tags:
{user && <FeedbackButton />}
```

**Acceptance Criteria:**
- [ ] /feedback page redirects to /login if not authenticated
- [ ] Page header with title and subtitle
- [ ] "Add New Feedback" button in header
- [ ] FeedbackList renders below header
- [ ] FeedbackButton added to root layout
- [ ] FeedbackButton only shows when authenticated
- [ ] Page is responsive on mobile
- [ ] export const dynamic = 'force-dynamic' added

---

## Dependency Graph

```
Phase 1 (Sequential):
  1.1 → 1.2 → 1.3

Phase 2 (Mostly Sequential):
  2.1 → 2.2 → 2.3 (parallel with 2.4)
              ↘
               2.4

Phase 3 (Sequential):
  3.1 → 3.2 → 3.3 → 3.4

Phase 4:
  4.1 (depends on all of Phase 3)
```

---

## Execution Strategy

1. **Start with Phase 1** - Database must be ready first
2. **Phase 2 is mostly sequential** - API routes build on each other
3. **Phase 3 is sequential** - Components depend on each other
4. **Phase 4 ties everything together**

**Parallel Opportunities:**
- Task 2.3 and 2.4 can run in parallel (both depend on 2.2)
- No other significant parallelization possible due to dependencies

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration issues | Low | Medium | Always backup first |
| Optimistic UI bugs | Medium | Low | Thorough testing of rollback |
| Auth edge cases | Low | Medium | Follow existing patterns |

---

## Summary

- **Total Tasks:** 12
- **Critical Path:** 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.4 → 3.1 → 3.2 → 3.3 → 3.4 → 4.1
- **Estimated Time:** 4 hours
- **Parallel Opportunities:** Task 2.3 || 2.4 only
