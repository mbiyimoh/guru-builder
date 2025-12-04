// app/api/projects/[id]/assessment/chat/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { streamText, CoreMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { composeAssessmentContext } from '@/lib/assessment/contextComposer'
import { requireProjectOwnership } from '@/lib/auth'
import { chatRequestSchema } from '@/lib/assessment/validation'
import { ASSESSMENT_MODEL } from '@/lib/assessment/constants'
import {
  generateMessageId,
  createPlaceholderAuditTrail,
  updateAuditTrailWithData,
} from '@/lib/assessment/auditUtils'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

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

    const body = await request.json()

    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { messages: uiMessages, diceRoll } = parsed.data

    // Generate unique message ID for audit trail
    const messageId = generateMessageId()

    const contextResult = await composeAssessmentContext(projectId, diceRoll)

    // Create placeholder audit trail immediately
    createPlaceholderAuditTrail({
      messageId,
      model: ASSESSMENT_MODEL,
      contextLayers: contextResult.layerCount,
    })

    // Convert AI SDK v5 message format (parts array) to CoreMessage format (content string)
    const coreMessages: CoreMessage[] = uiMessages.map((msg) => ({
      role: msg.role,
      content: msg.parts
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join(''),
    }))

    const messages: CoreMessage[] = [
      { role: 'system', content: contextResult.systemPrompt },
      ...coreMessages,
    ]

    // Switch to Claude 3.7 Sonnet with extended thinking
    const model = anthropic(ASSESSMENT_MODEL)

    const result = streamText({
      model,
      messages,
      providerOptions: {
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: 5000,
          },
        },
      },
    })

    // Update audit trail with real data asynchronously (non-blocking)
    Promise.all([result.reasoning, result.usage])
      .then(([reasoning, usage]) => {
        const reasoningText = reasoning?.map((r) => r.text).join('\n\n')
        updateAuditTrailWithData({
          messageId,
          model: ASSESSMENT_MODEL,
          usage,
          reasoning: reasoningText,
        })
      })
      .catch((error) => {
        console.error('[Audit] Failed to update audit trail with full data:', error)

        // FALLBACK: Try updating with just usage (no reasoning)
        result.usage
          .then((usage) => {
            if (usage) {
              console.log('[Audit] Fallback: Updating with usage only (no reasoning)')
              updateAuditTrailWithData({
                messageId,
                model: ASSESSMENT_MODEL,
                usage,
                reasoning: undefined,
              })
            }
          })
          .catch((usageError) => {
            console.error('[Audit] Fallback also failed - audit trail will have placeholder data only:', usageError)
          })
      })

    // Return text stream with messageId in custom header (compatible with TextStreamChatTransport)
    const response = result.toTextStreamResponse()
    response.headers.set('X-Message-Id', messageId)
    return response
  } catch (error) {
    console.error('[POST /api/projects/[id]/assessment/chat] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process assessment chat',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
