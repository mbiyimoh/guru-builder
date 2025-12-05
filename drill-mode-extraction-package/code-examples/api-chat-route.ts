// @ts-nocheck
// ⚠️ COPY-PASTE EXAMPLE - This file is meant to be copied to your project
// It will not compile in isolation. See INTEGRATION_GUIDE.md for setup instructions.

// app/api/chat/route.ts
// Dual-mode chat API - supports both open chat and drill mode with different AI models

import { streamText, convertToCoreMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'
import {
  composeContextWithMetadata,
  composeDrillSystemPrompt,
} from '@/lib/contextComposer'
import { AI_MODELS, THINKING_BUDGET } from '@/lib/constants'
import {
  generateMessageId,
  createPlaceholderAuditTrail,
  updateAuditTrailWithData,
} from '@/lib/auditUtils'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Extract parameters from request body
    const {
      messages: uiMessages,
      projectId = 'default-project',
      mode = 'open',           // 'open' or 'drill'
      drillContext,            // Only present in drill mode
      layerIds,
    } = body

    // 1. Compose base context layers with metadata for audit trail
    const contextResult = await composeContextWithMetadata(projectId, layerIds)
    let systemPrompt = contextResult.prompt
    const contextLayersMetadata = contextResult.layers
    const knowledgeFilesMetadata = []

    // 2. If drill mode, append drill-specific context
    if (mode === 'drill' && drillContext) {
      const drillPrompt = composeDrillSystemPrompt(drillContext)
      systemPrompt += '\n\n' + drillPrompt

      // Track drill as knowledge file for audit trail transparency
      knowledgeFilesMetadata.push({
        id: `drill-${drillContext.drillId}`,
        title: `Drill ${drillContext.drillId}`,
        category: 'drill',
        contentLength: drillPrompt.length,
      })
    }

    // 3. Convert UI messages to core messages (AI SDK v5 format)
    const coreMessages = convertToCoreMessages(uiMessages || [])

    // 4. Build final messages array with system prompt
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...coreMessages,
    ]

    // 5. Select model based on mode
    // Drill mode: Claude 3.7 Sonnet with extended thinking (5000 token budget)
    // Open chat: GPT-4o-mini for cost efficiency
    const model = mode === 'drill'
      ? anthropic(AI_MODELS.DRILL)
      : openai(AI_MODELS.CHAT_OPEN)

    // 6. Generate unique messageId for audit tracking
    const messageId = generateMessageId()

    // 7. Create placeholder audit trail IMMEDIATELY (before streaming starts)
    // This prevents race conditions where user clicks "View Audit" before data is ready
    if (mode === 'drill') {
      createPlaceholderAuditTrail({
        messageId,
        model: AI_MODELS.DRILL,
        contextLayers: contextLayersMetadata,
        knowledgeFiles: knowledgeFilesMetadata,
      })
    }

    // 8. Stream response with extended thinking for drill mode
    const result = mode === 'drill'
      ? streamText({
          model,
          messages,
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: THINKING_BUDGET.DRILL,  // 5000 tokens for reasoning
              },
            },
          },
        })
      : streamText({ model, messages })

    // 9. Update audit trail ASYNCHRONOUSLY when data ready (drill mode only)
    // This happens in the background while streaming continues
    if (mode === 'drill') {
      Promise.all([result.reasoning, result.usage])
        .then(([reasoning, usage]) => {
          updateAuditTrailWithData({
            messageId,
            model: AI_MODELS.DRILL,
            usage,
            reasoning: reasoning?.map(r => r.text).join('\n\n'),
          })
        })
        .catch((error) => {
          console.error('[POST /api/chat] Failed to update audit trail:', error)
        })
    }

    // 10. Return streaming response with messageId in headers
    // Headers allow frontend to correlate response with audit trail
    return result.toUIMessageStreamResponse({
      headers: {
        'x-message-id': messageId,
        'Access-Control-Expose-Headers': 'x-message-id',  // Required for CORS
      },
    })
  } catch (error) {
    console.error('[POST /api/chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

/**
 * CRITICAL PATTERNS IN THIS FILE:
 *
 * 1. Dual-Mode Support:
 *    - Same endpoint handles both open chat and drill mode
 *    - Mode parameter determines model selection and context composition
 *
 * 2. Placeholder + Update Pattern:
 *    - Placeholder created BEFORE streaming (prevents race condition)
 *    - Update happens ASYNCHRONOUSLY after data available
 *
 * 3. Extended Thinking:
 *    - Only enabled for drill mode (5000 token budget)
 *    - Captures Claude's reasoning traces for audit display
 *
 * 4. Context Layer Transparency:
 *    - Tracks which layers and knowledge files were used
 *    - Metadata included in audit trail for full transparency
 *
 * 5. Model Selection:
 *    - Drill mode: Claude 3.7 Sonnet (rich reasoning, higher cost)
 *    - Open chat: GPT-4o-mini (cost-effective, fast)
 */
