/**
 * Example Chat Component with Audit Trail Integration
 *
 * This file shows HOW to integrate the "View Context Audit" button
 * into your existing chat component.
 *
 * This is NOT a complete chat component - it's a reference showing
 * the key patterns you need to implement.
 */

'use client'

import { useChat } from '@ai-sdk/react'
import { useState } from 'react'
import { ContextAuditModal } from './ContextAuditModal'

export function ChatComponentExample() {
  // ============================================================
  // STEP 1: Add state for audit modal
  // ============================================================
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

  // ============================================================
  // STEP 2: Use AI SDK's useChat hook
  // ============================================================
  const { messages, sendMessage } = useChat({
    api: '/api/chat',
    // No special configuration needed - messageId comes from backend
  })

  return (
    <div>
      {/* ============================================================ */}
      {/* STEP 3: Render messages with audit button                   */}
      {/* ============================================================ */}
      {messages.map((message) => {
        // Extract messageId from message metadata (AI SDK v5)
        const messageId = message.metadata?.messageId
        const hasAuditTrail = !!messageId

        return (
          <div key={message.id}>
            {/* Message content */}
            <p>{message.content}</p>

            {/* Audit button - ONLY shows for assistant messages with messageId */}
            {hasAuditTrail && message.role === 'assistant' && (
              <button
                onClick={() => {
                  setSelectedMessageId(messageId)
                  setAuditModalOpen(true)
                }}
              >
                View Context Audit
              </button>
            )}
          </div>
        )
      })}

      {/* ============================================================ */}
      {/* STEP 4: Render audit modal                                  */}
      {/* ============================================================ */}
      <ContextAuditModal
        messageId={selectedMessageId}
        isOpen={auditModalOpen}
        onClose={() => {
          setAuditModalOpen(false)
          setSelectedMessageId(null)
        }}
      />
    </div>
  )
}

/**
 * INTEGRATION NOTES:
 *
 * 1. The messageId comes from your backend API route via messageMetadata callback
 * 2. AI SDK v5 automatically populates message.metadata.messageId
 * 3. The button only appears when:
 *    - message has metadata.messageId
 *    - message.role === 'assistant' (AI response, not user message)
 * 4. When clicked, the modal fetches audit trail from /api/audit/${messageId}
 *
 * BACKEND REQUIREMENTS:
 *
 * Your API route MUST return messageId in metadata:
 *
 * ```typescript
 * return result.toUIMessageStreamResponse({
 *   messageMetadata: () => ({ messageId })
 * })
 * ```
 *
 * See the README.md for complete backend integration steps.
 */
