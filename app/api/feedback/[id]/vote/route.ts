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
