import { NextRequest, NextResponse } from 'next/server'
import { getAuditTrail } from '@/lib/assessment/auditStore'
import { requireProjectOwnership } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: projectId, messageId } = await context.params

  // Auth check
  try {
    await requireProjectOwnership(projectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message === "Project not found") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const auditTrail = getAuditTrail(messageId)

  if (!auditTrail) {
    return NextResponse.json({ error: 'Audit trail not found' }, { status: 404 })
  }

  return NextResponse.json({ auditTrail })
}
