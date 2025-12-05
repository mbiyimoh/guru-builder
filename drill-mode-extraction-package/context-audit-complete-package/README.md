# Context Audit Trail - Complete Implementation Package

This package contains **ALL the code** needed to implement the exact "View Context Audit" button and modal functionality from the Backgammon Guru project.

## What's Included

This is a **complete, copy-paste implementation** of the audit trail system:

1. **Frontend UI Components** - Button that appears after AI responses + modal to display audit data
2. **Backend API** - Endpoint to retrieve audit trail data
3. **Data Storage** - In-memory store with 7-day auto-cleanup
4. **Audit Creation** - Extract reasoning and usage from Claude API responses
5. **Type Definitions** - All TypeScript types for audit trails
6. **Cost Calculation** - Automatic cost calculation from token usage

---

## Package Contents

```
context-audit-complete-package/
├── README.md (this file)
│
├── components/chat/
│   ├── ContextAuditModal.tsx        # Modal that displays audit trail data
│   ├── ContentViewModal.tsx         # Nested modal for viewing layer/file content
│   └── BackgammonChat.tsx          # Example: Button rendering in chat component
│
├── lib/
│   ├── auditUtils.ts               # Create and calculate audit trails
│   ├── auditStore.ts               # In-memory storage with auto-cleanup
│   ├── types.ts                    # TypeScript type definitions
│   └── constants.ts                # Model pricing for cost calculation
│
└── app/api/audit/[messageId]/
    └── route.ts                    # API endpoint to retrieve audit trails
```

---

## How It Works (Complete Flow)

### 1. AI Response is Generated (Backend)

When Claude generates a response in drill mode:

```typescript
// app/api/chat/route.ts (YOUR EXISTING FILE - MODIFY IT)

import {
  createPlaceholderAuditTrail,
  updateAuditTrailWithData,
  generateMessageId
} from '@/lib/auditUtils'

// Generate unique messageId
const messageId = generateMessageId()

// Create placeholder IMMEDIATELY (prevents race condition)
createPlaceholderAuditTrail({
  messageId,
  model: 'claude-3-7-sonnet-20250219',
  contextLayers: [/* context layer metadata */],
  knowledgeFiles: [/* knowledge file metadata */],
})

// Stream AI response
const result = streamText({
  model: anthropic('claude-3-7-sonnet-20250219'),
  messages,
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 5000 }
    }
  }
})

// Update with real data async (after streaming completes)
Promise.all([result.reasoning, result.usage])
  .then(([reasoning, usage]) => {
    const reasoningText = reasoning?.map(r => r.text).join('\n\n')

    updateAuditTrailWithData({
      messageId,
      model: 'claude-3-7-sonnet-20250219',
      usage,
      reasoning: reasoningText,
    })
  })

// Return response with messageId in metadata
return result.toUIMessageStreamResponse({
  messageMetadata: () => ({ messageId })
})
```

### 2. Frontend Extracts messageId

The chat component automatically gets the messageId from AI SDK v5:

```typescript
// components/chat/YourChat.tsx
import { ContextAuditModal } from '@/components/chat/ContextAuditModal'

const [auditModalOpen, setAuditModalOpen] = useState(false)
const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

// Render messages with audit button
{messages.map((message) => {
  const messageId = message.metadata?.messageId
  const hasAuditTrail = !!messageId

  return (
    <div key={message.id}>
      <p>{message.content}</p>

      {hasAuditTrail && message.role === 'assistant' && (
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

{/* Audit Modal */}
<ContextAuditModal
  messageId={selectedMessageId}
  isOpen={auditModalOpen}
  onClose={() => {
    setAuditModalOpen(false)
    setSelectedMessageId(null)
  }}
/>
```

### 3. User Clicks Button

When user clicks "View Context Audit", the modal:

1. Opens immediately
2. Fetches audit trail data from `/api/audit/${messageId}`
3. Displays:
   - Model used
   - Token usage (prompt, completion, total)
   - Cost breakdown ($0.00xxxx precision)
   - Reasoning traces (Claude's actual thinking)
   - Context layers used
   - Knowledge files referenced
   - Timestamp

### 4. Modal Displays Real Data

The modal shows **REAL data extracted from Claude's API**, not AI-generated text:

- **Reasoning traces**: Claude's actual internal thinking (varies each time)
- **Token counts**: Exact numbers from API (e.g., 1,234 not 1,000)
- **Costs**: Precise calculations based on MODEL_PRICING
- **Context**: Actual layers and files loaded into system prompt

---

## Integration Steps

### Step 1: Copy Library Files

```bash
# Copy to your lib/ folder
cp lib/auditUtils.ts YOUR_PROJECT/lib/
cp lib/auditStore.ts YOUR_PROJECT/lib/
cp lib/types.ts YOUR_PROJECT/lib/  # Merge with your existing types
cp lib/constants.ts YOUR_PROJECT/lib/  # Merge MODEL_PRICING section
```

### Step 2: Copy API Endpoint

```bash
# Create API route folder
mkdir -p YOUR_PROJECT/app/api/audit/\[messageId\]

# Copy endpoint
cp app/api/audit/[messageId]/route.ts YOUR_PROJECT/app/api/audit/[messageId]/
```

### Step 3: Copy UI Components

```bash
# Copy to your components folder
cp components/chat/ContextAuditModal.tsx YOUR_PROJECT/components/chat/
cp components/chat/ContentViewModal.tsx YOUR_PROJECT/components/chat/
```

### Step 4: Modify Your Chat API Route

In your existing `app/api/chat/route.ts`, add audit trail creation:

```typescript
import {
  createPlaceholderAuditTrail,
  updateAuditTrailWithData,
  generateMessageId
} from '@/lib/auditUtils'

export async function POST(req: Request) {
  // ... your existing code ...

  // Generate messageId
  const messageId = generateMessageId()

  // Create placeholder immediately
  createPlaceholderAuditTrail({
    messageId,
    model: 'claude-3-7-sonnet-20250219',
    contextLayers: [], // Your context layer metadata
    knowledgeFiles: [], // Your knowledge file metadata
  })

  // Stream with extended thinking
  const result = streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    messages,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 5000 }
      }
    }
  })

  // Update async with real data
  Promise.all([result.reasoning, result.usage])
    .then(([reasoning, usage]) => {
      const reasoningText = reasoning?.map(r => r.text).join('\n\n')
      updateAuditTrailWithData({ messageId, model: 'claude-3-7-sonnet-20250219', usage, reasoning: reasoningText })
    })

  // Return with messageId in metadata
  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ messageId })
  })
}
```

### Step 5: Add Button to Your Chat Component

In your chat component:

```typescript
import { ContextAuditModal } from '@/components/chat/ContextAuditModal'

// State for modal
const [auditModalOpen, setAuditModalOpen] = useState(false)
const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

// Render messages
{messages.map((message) => {
  const messageId = message.metadata?.messageId

  return (
    <div key={message.id}>
      <p>{message.content}</p>

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

### Step 6: Install UI Dependencies (if needed)

If you don't have shadcn/ui installed:

```bash
npx shadcn@latest add dialog
npx shadcn@latest add button
npx shadcn@latest add card
```

Or adapt the components to use your own UI library.

---

## Key Implementation Details

### Placeholder + Update Pattern (Prevents Race Conditions)

**Why this is critical:**

If you create the audit trail AFTER streaming completes, there's a race condition where the user clicks "View Audit" before the data exists (404 error).

**Solution:**

1. Create **placeholder** immediately (before streaming starts)
2. Return response with messageId
3. Update with **real data** asynchronously

```typescript
// STEP 1: Create placeholder (synchronous, before streaming)
createPlaceholderAuditTrail({ messageId, model, contextLayers, knowledgeFiles })

// STEP 2: Start streaming (returns immediately)
const result = streamText({ ... })

// STEP 3: Update async (after promises resolve)
Promise.all([result.reasoning, result.usage])
  .then(([reasoning, usage]) => {
    updateAuditTrailWithData({ messageId, model, usage, reasoning })
  })
```

### Extended Thinking Capture

To capture Claude's reasoning traces, you MUST enable extended thinking:

```typescript
streamText({
  model: anthropic('claude-3-7-sonnet-20250219'),
  messages,
  providerOptions: {
    anthropic: {
      thinking: {
        type: 'enabled',
        budgetTokens: 5000,  // How many tokens Claude can "think"
      }
    }
  }
})
```

Without this, `result.reasoning` will be undefined.

### Cost Calculation

Costs are calculated automatically from token usage + MODEL_PRICING:

```typescript
// lib/auditUtils.ts
const promptCost = (usage.inputTokens / 1_000_000) * MODEL_PRICING[model].input
const completionCost = (usage.outputTokens / 1_000_000) * MODEL_PRICING[model].output
```

Update `MODEL_PRICING` in `lib/constants.ts` if you use different models or if pricing changes.

### messageId Correlation

The system uses `messageId` to correlate frontend messages with backend audit trails:

1. Backend generates `messageId` with `crypto.randomUUID()`
2. Backend returns it via `messageMetadata` callback
3. Frontend extracts from `message.metadata.messageId`
4. Frontend passes to modal when button clicked
5. Modal fetches `/api/audit/${messageId}`

---

## File-by-File Explanation

### `lib/auditUtils.ts`

**Purpose**: Create and calculate audit trails

**Key Functions**:
- `generateMessageId()` - Create unique UUID
- `createPlaceholderAuditTrail()` - Store placeholder immediately
- `updateAuditTrailWithData()` - Update with real usage/reasoning
- `createAuditTrail()` - Create complete audit trail (legacy, for non-streaming)
- `calculateCosts()` - Internal: Calculate $ from tokens

### `lib/auditStore.ts`

**Purpose**: In-memory storage with auto-cleanup

**Key Functions**:
- `storeAuditTrail()` - Store audit trail (schedules 7-day cleanup)
- `getAuditTrail()` - Retrieve by messageId
- `updateAuditTrail()` - Update existing trail (used by updateAuditTrailWithData)
- `getAllAuditTrails()` - Debug: Get all trails
- `clearAuditStore()` - Debug: Clear all trails

**⚠️ WARNING**: This is in-memory only. Data is LOST on server restart. For production, replace with database storage.

### `lib/types.ts`

**Purpose**: TypeScript type definitions

**Key Types**:
- `AuditTrail` - Complete audit trail object
- `ContextLayerMetadata` - Context layer info (id, name, priority, length)
- `KnowledgeFileMetadata` - Knowledge file info (id, title, category, length)

### `lib/constants.ts`

**Purpose**: Model pricing for cost calculation

**Key Exports**:
- `MODEL_PRICING` - Object mapping model names to input/output prices (per 1M tokens)
- `ModelName` - Type for valid model names

### `app/api/audit/[messageId]/route.ts`

**Purpose**: HTTP endpoint to retrieve audit trails

**Endpoint**: `GET /api/audit/:messageId`

**Responses**:
- 200: Returns `AuditTrail` object
- 404: `{ error: 'Audit trail not found for this message' }`
- 400: `{ error: 'Missing messageId parameter' }`
- 500: `{ error: 'Failed to fetch audit trail' }`

### `components/chat/ContextAuditModal.tsx`

**Purpose**: Main modal component that displays audit trail

**Props**:
- `messageId: string | null` - The messageId to fetch audit trail for
- `isOpen: boolean` - Controls modal visibility
- `onClose: () => void` - Callback when modal closes

**Features**:
- Fetches audit trail from `/api/audit/${messageId}`
- Shows loading state while fetching
- Shows error state if fetch fails
- Displays all audit trail sections (model, tokens, cost, reasoning, layers, files, timestamp)
- Allows viewing layer/file details in nested modal

### `components/chat/ContentViewModal.tsx`

**Purpose**: Nested modal for viewing layer/file content

**Props**:
- `title: string` - Layer or file name
- `content: string` - The content to display
- `metadata?: { priority?, category?, contentLength }` - Optional metadata
- `isOpen: boolean` - Controls visibility
- `onClose: () => void` - Close callback

### `components/chat/BackgammonChat.tsx`

**Purpose**: Example chat component showing button integration

**Key Sections**:
- Lines 49-58: State for modal and messageId
- Lines 365-403: Message rendering with audit button
- Lines 456-464: Modal component

This is an **example** - adapt it to your own chat component structure.

---

## Common Issues & Solutions

### Issue 1: Button doesn't appear

**Check:**
1. Is `message.metadata.messageId` populated? (console.log it)
2. Did you add `messageMetadata` callback in `toUIMessageStreamResponse()`?
3. Is the message role `'assistant'`? (Button only shows for AI responses)

**Solution:**
```typescript
// In your API route
return result.toUIMessageStreamResponse({
  messageMetadata: () => ({ messageId })  // MUST include this
})
```

### Issue 2: Modal shows "Audit trail not found"

**Check:**
1. Did you call `createPlaceholderAuditTrail()` BEFORE streaming?
2. Is the messageId the same in frontend and backend? (log both)
3. Did server restart? (In-memory store is cleared on restart)

**Solution:**
```typescript
// Create placeholder BEFORE streamText()
createPlaceholderAuditTrail({ messageId, ... })
const result = streamText({ ... })  // AFTER placeholder
```

### Issue 3: No reasoning traces shown

**Check:**
1. Did you enable extended thinking in provider options?
2. Are you using a Claude model? (OpenAI doesn't support extended thinking)
3. Did the reasoning promise resolve? (check server logs)

**Solution:**
```typescript
providerOptions: {
  anthropic: {
    thinking: { type: 'enabled', budgetTokens: 5000 }
  }
}
```

### Issue 4: Token counts show 0

**Symptoms**: Modal shows 0 for all token counts

**Cause**: Audit trail hasn't been updated yet (still showing placeholder)

**Solution**: Close and reopen modal after a few seconds. The update happens asynchronously.

### Issue 5: Cost shows $0.000000

**Check:**
1. Is your model in `MODEL_PRICING`? (Check `lib/constants.ts`)
2. Did token counts update? (If tokens are 0, cost will be 0)

**Solution**: Add your model to MODEL_PRICING or wait for tokens to update.

---

## Customization

### Use Your Own UI Components

If you're not using shadcn/ui, adapt the components:

```typescript
// Replace shadcn components with your own
import { Dialog } from 'your-ui-library'  // instead of @/components/ui/dialog
import { Button } from 'your-ui-library'   // instead of @/components/ui/button
```

The logic remains the same, just swap the UI primitives.

### Add More Audit Metrics

You can extend the `AuditTrail` type to include custom metrics:

```typescript
// lib/types.ts
export interface AuditTrail {
  // ... existing fields ...
  customMetrics?: {
    responseTimeMs: number
    modelTemperature: number
    userFeedback?: 'thumbs-up' | 'thumbs-down'
  }
}
```

Then capture and display those metrics.

### Change Retention Period

Default is 7 days. To change:

```typescript
// lib/auditStore.ts
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000  // 30 days instead of 7
```

### Migrate to Database Storage

For production, replace in-memory storage with database:

1. Add Prisma model for `AuditTrail`
2. Update `storeAuditTrail()` to use `prisma.auditTrail.create()`
3. Update `getAuditTrail()` to use `prisma.auditTrail.findUnique()`
4. Add cron job for cleanup instead of setTimeout

See Backgammon Guru's `developer-guides/audit-trail-system-guide.md` section 6.1 for full migration guide.

---

## Testing

### Manual Test Checklist

1. [ ] Send message in drill mode
2. [ ] "View Context Audit" button appears after AI response
3. [ ] Click button → modal opens
4. [ ] Modal shows model name
5. [ ] Token counts are non-zero numbers
6. [ ] Costs are calculated and displayed
7. [ ] Reasoning traces section shows (if Claude model)
8. [ ] Context layers section shows (with your layers)
9. [ ] Knowledge files section shows (if applicable)
10. [ ] Timestamp is correct
11. [ ] Close modal works
12. [ ] Reopen modal shows same data
13. [ ] Server restart → button still shows but modal shows 404 (expected)

### Debug Logging

Enable debug logs to troubleshoot:

```typescript
// In your API route, after creating audit trail
console.log('[Audit] messageId:', messageId)
console.log('[Audit] Has reasoning:', reasoning ? 'YES' : 'NO')
console.log('[Audit] Token usage:', usage)

// In your frontend, when rendering button
console.log('[Button] message.metadata:', message.metadata)
console.log('[Button] Has messageId:', !!message.metadata?.messageId)
```

---

## Summary

This package provides **complete, production-ready code** for implementing the Context Audit Trail functionality.

**Core Features**:
- ✅ "View Context Audit" button after AI responses
- ✅ Modal displaying all audit trail information
- ✅ Real reasoning traces from Claude
- ✅ Exact token counts and costs
- ✅ Context layers and knowledge files tracking
- ✅ Race condition prevention (placeholder + update)
- ✅ 7-day auto-cleanup

**Next Steps**:
1. Copy files to your project
2. Follow integration steps
3. Test the flow end-to-end
4. Customize styling/behavior as needed
5. (Production) Migrate to database storage

**Need Help?**
- Check the "Common Issues & Solutions" section
- Review the original implementation in Backgammon Guru
- Check `developer-guides/audit-trail-system-guide.md` for deep dive
