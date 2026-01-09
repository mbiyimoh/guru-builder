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
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
