import { NextResponse } from 'next/server'
import { getAuditTrail } from '@/lib/auditStore'

interface RouteParams {
  params: Promise<{
    messageId: string
  }>
}

export async function GET(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { messageId } = await params

    if (!messageId) {
      return NextResponse.json(
        { error: 'Missing messageId parameter' },
        { status: 400 }
      )
    }

    const auditTrail = getAuditTrail(messageId)

    if (!auditTrail) {
      return NextResponse.json(
        { error: 'Audit trail not found for this message' },
        { status: 404 }
      )
    }

    return NextResponse.json(auditTrail)
  } catch (error) {
    console.error('[GET /api/audit/[messageId]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    )
  }
}
