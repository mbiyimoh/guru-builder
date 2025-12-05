# Quick Start - Context Audit Trail (5 Minutes)

This guide gets you up and running with the "View Context Audit" button in 5 simple steps.

---

## Step 1: Copy Files (1 minute)

```bash
# From this package, copy to your project:

# Library files
cp lib/*.ts YOUR_PROJECT/lib/

# API endpoint
mkdir -p YOUR_PROJECT/app/api/audit/\[messageId\]
cp app/api/audit/[messageId]/route.ts YOUR_PROJECT/app/api/audit/[messageId]/

# UI components
cp components/chat/ContextAuditModal.tsx YOUR_PROJECT/components/chat/
cp components/chat/ContentViewModal.tsx YOUR_PROJECT/components/chat/
```

---

## Step 2: Modify Your Chat API Route (2 minutes)

In `app/api/chat/route.ts`, add these lines:

```typescript
import {
  createPlaceholderAuditTrail,
  updateAuditTrailWithData,
  generateMessageId,
} from '@/lib/auditUtils'

export async function POST(req: Request) {
  // ... your existing code to build messages ...

  // 1. Generate messageId
  const messageId = generateMessageId()

  // 2. Create placeholder (BEFORE streaming)
  createPlaceholderAuditTrail({
    messageId,
    model: 'claude-3-7-sonnet-20250219',
    contextLayers: [],  // Add your context layer metadata here
    knowledgeFiles: [],  // Add your knowledge file metadata here
  })

  // 3. Stream with extended thinking
  const result = streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    messages,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 5000 }
      }
    }
  })

  // 4. Update async with real data
  Promise.all([result.reasoning, result.usage])
    .then(([reasoning, usage]) => {
      updateAuditTrailWithData({
        messageId,
        model: 'claude-3-7-sonnet-20250219',
        usage,
        reasoning: reasoning?.map(r => r.text).join('\n\n')
      })
    })

  // 5. Return with messageId in metadata
  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ messageId })
  })
}
```

---

## Step 3: Add Button to Chat Component (1 minute)

In your chat component where you render messages:

```typescript
import { ContextAuditModal } from '@/components/chat/ContextAuditModal'

// Add state
const [auditModalOpen, setAuditModalOpen] = useState(false)
const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

// Render messages
{messages.map((message) => {
  const messageId = message.metadata?.messageId

  return (
    <div key={message.id}>
      <p>{message.content}</p>

      {/* Add this button */}
      {messageId && message.role === 'assistant' && (
        <button onClick={() => {
          setSelectedMessageId(messageId)
          setAuditModalOpen(true)
        }}>
          View Context Audit
        </button>
      )}
    </div>
  )
})}

{/* Add modal */}
<ContextAuditModal
  messageId={selectedMessageId}
  isOpen={auditModalOpen}
  onClose={() => {
    setAuditModalOpen(false)
    setSelectedMessageId(null)
  }}
/>
```

---

## Step 4: Install UI Dependencies (if needed)

If you don't have shadcn/ui components:

```bash
npx shadcn@latest add dialog button card
```

Or adapt ContextAuditModal.tsx to use your own UI library.

---

## Step 5: Test It

```bash
npm run dev
```

1. Send a message in your chat
2. Wait for AI response
3. Look for "View Context Audit" button
4. Click it
5. Modal should open showing audit trail data

---

## Verification Checklist

✅ Button appears after AI response
✅ Modal opens when button clicked
✅ Model name shows in modal
✅ Token counts are non-zero
✅ Costs are calculated
✅ Reasoning traces show (if Claude)
✅ Context layers show
✅ Timestamp is correct

---

## Troubleshooting

**Button doesn't appear:**
- Check: Did you add `messageMetadata` callback?
- Fix: `return result.toUIMessageStreamResponse({ messageMetadata: () => ({ messageId }) })`

**Modal shows "not found":**
- Check: Did you call `createPlaceholderAuditTrail()` BEFORE `streamText()`?
- Fix: Move placeholder creation earlier in your code

**No reasoning traces:**
- Check: Did you enable extended thinking?
- Fix: Add `providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: 5000 } } }`

---

## Next Steps

1. ✅ Get basic functionality working
2. Customize button styling
3. Add your context layers metadata
4. Add your knowledge files metadata
5. Test edge cases (server restart, errors, etc.)

For detailed documentation, see **README.md**.
