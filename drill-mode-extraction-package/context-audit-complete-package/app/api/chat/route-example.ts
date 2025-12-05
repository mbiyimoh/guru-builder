/**
 * Example Chat API Route with Audit Trail Integration
 *
 * This file shows HOW to integrate audit trail creation into your
 * existing chat API endpoint.
 *
 * This is NOT a complete API route - it's a reference showing
 * the key patterns you need to implement.
 *
 * CRITICAL: This must be in app/api/chat/route.ts
 */

import { streamText, convertToCoreMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import {
  createPlaceholderAuditTrail,
  updateAuditTrailWithData,
  generateMessageId,
} from '@/lib/auditUtils'
import { ContextLayerMetadata, KnowledgeFileMetadata } from '@/lib/types'

export async function POST(req: Request) {
  const body = await req.json()
  const { messages: uiMessages, mode = 'open', drillContext } = body

  // ============================================================
  // 1. Build your system prompt (YOUR EXISTING LOGIC)
  // ============================================================
  let systemPrompt = 'Your base system prompt here...'
  let contextLayersMetadata: ContextLayerMetadata[] = []
  let knowledgeFilesMetadata: KnowledgeFileMetadata[] = []

  // Example: If you have context layers, track them
  // contextLayersMetadata = [
  //   { id: 'layer-1', name: 'Domain Knowledge', priority: 1, contentLength: 5000 }
  // ]

  // Example: If you inject drill/quiz data, track it as knowledge file
  if (drillContext) {
    knowledgeFilesMetadata = [{
      id: `drill-${drillContext.drillId}`,
      title: `Quiz ${drillContext.drillId}`,
      category: 'quiz',
      contentLength: 1500,
    }]
  }

  // ============================================================
  // 2. Convert messages and build final messages array
  // ============================================================
  const coreMessages = convertToCoreMessages(uiMessages || [])
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...coreMessages,
  ]

  // ============================================================
  // 3. Generate unique messageId for audit trail correlation
  // ============================================================
  const messageId = generateMessageId()

  // ============================================================
  // 4. Create placeholder audit trail IMMEDIATELY
  //    (BEFORE streaming starts - prevents race condition)
  // ============================================================
  createPlaceholderAuditTrail({
    messageId,
    model: 'claude-3-7-sonnet-20250219',
    contextLayers: contextLayersMetadata,
    knowledgeFiles: knowledgeFilesMetadata,
  })

  // ============================================================
  // 5. Stream AI response with extended thinking enabled
  // ============================================================
  const result = streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    messages,
    maxRetries: 2,
    providerOptions: {
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: 5000,  // Capture Claude's reasoning
        },
      },
    },
  })

  // ============================================================
  // 6. Update audit trail ASYNCHRONOUSLY with real data
  //    (Happens in background after streaming completes)
  // ============================================================
  Promise.all([result.reasoning, result.usage])
    .then(([reasoning, usage]) => {
      // Extract reasoning text from ReasoningOutput[]
      const reasoningText = reasoning
        ?.map((r) => r.text)
        .filter(Boolean)
        .join('\n\n')

      // Update audit trail with REAL data
      updateAuditTrailWithData({
        messageId,
        model: 'claude-3-7-sonnet-20250219',
        usage,
        reasoning: reasoningText,
      })
    })
    .catch((error) => {
      console.error('[Audit] Failed to update audit trail:', error)

      // Fallback: Try updating with just usage (no reasoning)
      result.usage
        .then((usage) => {
          if (usage) {
            updateAuditTrailWithData({
              messageId,
              model: 'claude-3-7-sonnet-20250219',
              usage,
              reasoning: undefined,
            })
          }
        })
        .catch((usageError) => {
          console.error('[Audit] Failed to update even with usage:', usageError)
        })
    })

  // ============================================================
  // 7. Return streaming response with messageId in metadata
  //    (AI SDK v5 injects this into message.metadata.messageId)
  // ============================================================
  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({
      messageId,  // CRITICAL: This makes messageId available in frontend
    }),
  })
}

/**
 * INTEGRATION CHECKLIST:
 *
 * ✅ Import audit trail functions from @/lib/auditUtils
 * ✅ Generate messageId with generateMessageId()
 * ✅ Create placeholder BEFORE streamText()
 * ✅ Enable extended thinking in providerOptions
 * ✅ Update audit trail async after streaming
 * ✅ Return messageId via messageMetadata callback
 * ✅ Handle errors with fallback to usage-only update
 *
 * COMMON MISTAKES:
 *
 * ❌ Creating audit trail AFTER streaming (race condition)
 * ❌ Not enabling extended thinking (no reasoning traces)
 * ❌ Forgetting messageMetadata callback (no messageId in frontend)
 * ❌ Using wrong model name in updateAuditTrailWithData
 * ❌ Not tracking context layers/knowledge files metadata
 *
 * VERIFICATION:
 *
 * 1. Check server logs for:
 *    - "[createPlaceholderAuditTrail] Storing placeholder for messageId: ..."
 *    - "[updateAuditTrailWithData] Updating messageId: ..."
 * 2. Check frontend: message.metadata.messageId should be populated
 * 3. Click "View Context Audit" - should show placeholder then update
 */
