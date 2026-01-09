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
    const where: Record<string, unknown> = {}
    if (area) where.area = area
    if (type) where.type = type
    if (status) {
      where.status = status
    } else {
      // Default: exclude CLOSED
      where.status = { not: 'CLOSED' }
    }

    // Build orderBy
    let orderBy: Record<string, string>
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
