# Integration Guide: Drill Mode Chat System

Step-by-step instructions to integrate the drill mode chat system into your project for testing AI gurus against mathematical engines.

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or hosted)
- API keys for AI providers (Anthropic Claude, OpenAI)
- Basic knowledge of Next.js, React, TypeScript

---

## Phase 1: Project Setup

### 1.1 Create Next.js Project (if starting fresh)

```bash
npx create-next-app@latest my-guru-tester --typescript --tailwind --app
cd my-guru-tester
```

### 1.2 Install Dependencies

```bash
# AI SDK and providers
npm install ai @ai-sdk/react @ai-sdk/anthropic @ai-sdk/openai

# Database
npm install @prisma/client prisma

# Validation
npm install zod

# UI components (optional - use your own or shadcn/ui)
npm install @radix-ui/react-dialog @radix-ui/react-label
```

### 1.3 Set Up Environment Variables

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/guru_tester"

# AI Providers
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
```

---

## Phase 2: Database Setup

### 2.1 Initialize Prisma

```bash
npx prisma init
```

### 2.2 Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id              String          @id @default(cuid())
  name            String
  description     String?
  contextLayers   ContextLayer[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model ContextLayer {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name        String              // e.g., "Chess Opening Principles"
  description String?             // Optional tooltip
  priority    Int                 // 1 = first, 2 = second, etc.
  content     String   @db.Text   // Markdown/text context

  isActive    Boolean  @default(true)    // Toggle without deletion
  isBuiltIn   Boolean  @default(false)   // Prevent deletion

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, priority])  // Prevent priority conflicts
  @@index([projectId, isActive])
}
```

### 2.3 Run Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 2.4 Create Seed Script

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create default project
  const project = await prisma.project.upsert({
    where: { id: 'default-project' },
    update: {},
    create: {
      id: 'default-project',
      name: 'Chess Guru Tester',  // Adapt for your domain
      description: 'Testing chess AI against Stockfish',
    },
  })

  // Create default context layers
  await prisma.contextLayer.upsert({
    where: { id: 'layer-1' },
    update: {},
    create: {
      id: 'layer-1',
      projectId: project.id,
      name: 'Chess Fundamentals',  // Adapt for your domain
      priority: 1,
      content: `# Chess Fundamentals

- Control the center with pawns and pieces
- Develop knights before bishops
- Castle early for king safety
- Don't move the same piece twice in opening
- Connect your rooks

## Piece Values
- Pawn: 1 point
- Knight: 3 points
- Bishop: 3 points
- Rook: 5 points
- Queen: 9 points`,
      isActive: true,
      isBuiltIn: true,
    },
  })

  console.log('Database seeded successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

Run seed:

```bash
npm install -D ts-node
npx prisma db seed
```

---

## Phase 3: Core Library Files

### 3.1 Create Prisma Client Singleton

Create `lib/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 3.2 Create Types

Create `lib/types.ts`:

```typescript
export type ChatMode = 'open' | 'drill'

export interface ContextLayerMetadata {
  id: string
  name: string
  priority: number
  contentLength: number
}

export interface KnowledgeFileMetadata {
  id: string
  title: string
  category: string
  contentLength: number
}

export interface ContextWithMetadata {
  prompt: string
  layers: ContextLayerMetadata[]
}

export interface DrillContext {
  drillId: number
  moduleId: number
  drill: Drill
  hintsUsedCount: number
}

export interface Drill {
  id: number
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  boardSetup: BoardSetup
  toPlay: string
  roll?: [number, number]  // Optional - for backgammon
  question: string
  options: DrillOption[]
  principle: string
  hintsAvailable: string[]
}

export interface BoardSetup {
  // Adapt this for your domain
  points?: Record<string, { color: string | null; checkers: number }>
  bar?: { black: number; white: number }
  off?: { black: number; white: number }
  summary: string
}

export interface DrillOption {
  move: string
  isCorrect: boolean
  explanation: string
}

export interface AuditTrail {
  messageId: string
  timestamp: Date
  model: string
  reasoning?: string[]
  contextLayers: ContextLayerMetadata[]
  knowledgeFiles: KnowledgeFileMetadata[]
  tokens: {
    prompt: number
    completion: number
    reasoning?: number
    total: number
  }
  cost: {
    prompt: number
    completion: number
    reasoning?: number
    total: number
  }
}
```

### 3.3 Create Constants

Create `lib/constants.ts`:

```typescript
export const AI_MODELS = {
  DRILL: 'claude-3-7-sonnet-20250219',
  CHAT_OPEN: 'gpt-4o-mini',
} as const

export const THINKING_BUDGET = {
  DRILL: 5000,
  CHAT: 3000,
} as const

export const MODEL_PRICING = {
  'claude-3-7-sonnet-20250219': {
    input: 3.00,
    output: 15.00,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
  },
} as const

export type ModelName = keyof typeof MODEL_PRICING
```

### 3.4 Copy Core Library Files

Copy from `code-examples/` folder:
- `context-composer.ts` → `lib/contextComposer.ts`
- `audit-utils.ts` → `lib/auditUtils.ts`

Create `lib/auditStore.ts`:

```typescript
import { AuditTrail } from './types'

const auditStore = new Map<string, AuditTrail>()
const RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000 // 7 days

export function storeAuditTrail(trail: AuditTrail) {
  auditStore.set(trail.messageId, trail)

  // Cleanup old trails
  const cutoff = Date.now() - RETENTION_PERIOD
  for (const [id, t] of auditStore.entries()) {
    if (t.timestamp.getTime() < cutoff) {
      auditStore.delete(id)
    }
  }
}

export function getAuditTrail(messageId: string): AuditTrail | undefined {
  return auditStore.get(messageId)
}

export function updateAuditTrail(messageId: string, updates: Partial<AuditTrail>) {
  const existing = auditStore.get(messageId)
  if (existing) {
    auditStore.set(messageId, { ...existing, ...updates })
  }
}

export function clearAuditStore() {
  auditStore.clear()
}
```

---

## Phase 4: API Routes

### 4.1 Create Chat API Route

Copy `code-examples/api-chat-route.ts` to `app/api/chat/route.ts`

### 4.2 Create Audit API Route

Create `app/api/audit/[messageId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getAuditTrail } from '@/lib/auditStore'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params

  const auditTrail = getAuditTrail(messageId)

  if (!auditTrail) {
    return NextResponse.json(
      { error: 'Audit trail not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ auditTrail })
}
```

### 4.3 Create Drill Data APIs

Create `app/api/drills/[drillId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import drillData from '@/data/drills.json'  // Your drill JSON file

export async function GET(
  req: Request,
  { params }: { params: Promise<{ drillId: string }> }
) {
  const { drillId } = await params
  const drill = drillData.drills.find(d => d.id === parseInt(drillId))

  if (!drill) {
    return NextResponse.json({ error: 'Drill not found' }, { status: 404 })
  }

  return NextResponse.json({ drill })
}
```

---

## Phase 5: Frontend Components

### 5.1 Create Drill Chat Component

Create `components/chat/DrillChat.tsx` - adapt the example from `code-examples/chat-component.tsx`

Key patterns to implement:
- Request-level body configuration (NOT in useChat initialization)
- Mode switching (open vs drill)
- Audit trail modal integration

### 5.2 Create Audit Modal

Create `components/chat/ContextAuditModal.tsx` - shows audit trail details

### 5.3 Create Board Display

Create `components/drill/BoardDisplay.tsx` - visualize your positions

For chess: Use FEN → board visualization library
For backgammon: Use ASCII art (see `code-examples/ascii-board.ts`)
For Go: Use SGF → board visualization library

---

## Phase 6: Drill Data

### 6.1 Create Drill JSON Structure

Create `data/drills.json` - use `code-examples/drill-data-example.json` as template

Adapt for your domain:
- **Chess**: FEN position, best moves, engine evaluation
- **Go**: SGF position, joseki variations
- **Poker**: Hand + board, action options, pot odds

### 6.2 Validation Schema

Create `lib/drillSchema.ts` with Zod schemas to validate drill data

---

## Phase 7: Testing

### 7.1 Test Open Chat Mode

1. Start dev server: `npm run dev`
2. Navigate to your chat page
3. Ask a general question
4. Verify GPT-4o-mini responds

### 7.2 Test Drill Mode

1. Load a drill
2. Display board position
3. Chat about the position
4. Verify Claude Sonnet responds with extended thinking

### 7.3 Test Audit Trail

1. Send a drill mode message
2. Click "View Audit" immediately
3. Verify placeholder shows (no race condition)
4. Wait a moment, verify full data appears
5. Check reasoning traces, token counts, costs

---

## Phase 8: Connect to Your Mathematical Engine

### 8.1 For Chess (Stockfish)

```typescript
// lib/stockfish.ts
import { spawn } from 'child_process'

export async function analyzePosition(fen: string, depth: number = 20) {
  return new Promise((resolve, reject) => {
    const stockfish = spawn('stockfish')
    let bestMove = ''
    let evaluation = 0

    stockfish.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes('bestmove')) {
        bestMove = output.split('bestmove ')[1].split(' ')[0]
        resolve({ bestMove, evaluation })
        stockfish.kill()
      }
      if (output.includes('score cp')) {
        evaluation = parseInt(output.split('score cp ')[1].split(' ')[0])
      }
    })

    stockfish.stdin.write(`position fen ${fen}\n`)
    stockfish.stdin.write(`go depth ${depth}\n`)
  })
}
```

### 8.2 Display Engine Results Alongside Guru

Create split-panel UI:
- Left: Guru chat with reasoning audit
- Right: Engine calculation with evaluation

---

## Phase 9: Customization

### 9.1 Update Context Layers

Edit your seed script or use layer management UI to add domain-specific knowledge.

### 9.2 Customize Drill System Prompt

Edit `composeDrillSystemPrompt()` in `lib/contextComposer.ts` to match your domain's terminology and evaluation criteria.

### 9.3 Adjust AI Models

If needed, change models in `lib/constants.ts`:
- For better chess understanding: Use `gpt-4o` instead of `gpt-4o-mini`
- For deeper reasoning: Increase `THINKING_BUDGET.DRILL`

---

## Troubleshooting

### Issue: Stale data in chat

**Solution**: Ensure you're using request-level body configuration:

```typescript
// ✅ CORRECT
sendMessage({ text }, {
  body: { mode, drillContext }
})

// ❌ WRONG
useChat({ body: { mode, drillContext } })
```

### Issue: Audit trail shows "not found"

**Solution**: Verify placeholder is created BEFORE streaming:

```typescript
createPlaceholderAuditTrail({ messageId, ... })  // BEFORE streamText
const result = streamText({ ... })                // AFTER placeholder
```

### Issue: TypeScript errors

**Solution**: Run clean rebuild:

```bash
rm -rf .next node_modules
npm install
npm run dev
```

---

## Next Steps

1. Implement layer management UI (optional)
2. Add drill progress tracking
3. Create comparison view (guru vs engine)
4. Add export functionality for test results
5. Implement batch testing across multiple positions

---

## Support

- See `DRILL_MODE_ARCHITECTURE.md` for complete architecture details
- Check `code-examples/` for copy-paste code snippets
- Refer to AI SDK docs: https://sdk.vercel.ai/docs
