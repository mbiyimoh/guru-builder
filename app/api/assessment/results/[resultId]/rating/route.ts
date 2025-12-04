import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { errorResponse, validationErrorResponse } from '@/lib/apiHelpers'

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ resultId: string }> }
) {
  try {
    const { resultId } = await context.params
    const body = await request.json()

    const parsed = ratingSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.format())
    }

    const result = await prisma.assessmentResult.update({
      where: { id: resultId },
      data: { userRating: parsed.data.rating },
    })

    return NextResponse.json({ result })
  } catch (error) {
    return errorResponse('update rating', error)
  }
}
