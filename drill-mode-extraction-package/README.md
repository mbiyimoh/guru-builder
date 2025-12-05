# Drill Mode Chat System - Extraction Package

Complete, production-ready architecture for building an AI-powered drill/testing system with context layers, reasoning audit tracking, and position-based chat.

## What's Included

This package contains everything needed to replicate the Backgammon Guru drill mode system for testing AI "gurus" against mathematical engines.

### 📁 Package Contents

```
drill-mode-extraction-package/
├── README.md                          # This file (quick start)
├── DRILL_MODE_ARCHITECTURE.md         # Complete architecture synthesis (READ THIS FIRST)
├── INTEGRATION_GUIDE.md               # Step-by-step integration instructions
└── code-examples/                     # Copy-paste code snippets
    ├── chat-component.tsx             # Main drill chat UI component
    ├── context-composer.ts            # Context layer system
    ├── audit-utils.ts                 # Audit trail tracking
    ├── api-chat-route.ts              # Dual-mode chat endpoint
    ├── drill-data-example.json        # Example drill structure
    ├── ascii-board.ts                 # Position visualization
    ├── drill-loader.ts                # Drill JSON loading
    └── audit-modal.tsx                # Audit trail display component
```

## Quick Start

### 1. Read the Architecture Document

Start with **`DRILL_MODE_ARCHITECTURE.md`** - it contains:
- Complete system overview
- Dual-mode chat architecture (open chat vs drill mode)
- Context layer system explanation
- Drill data structure
- Reasoning & audit tracking
- Full code examples with explanations

### 2. Follow the Integration Guide

**`INTEGRATION_GUIDE.md`** provides:
- Step-by-step setup instructions
- Dependency installation
- Database schema setup
- API route creation
- Frontend component integration

### 3. Copy Code Examples

All code snippets are in **`code-examples/`** folder:
- Copy entire files or specific functions
- Adapt to your domain (chess, Go, poker, etc.)
- Comments explain critical patterns

## Use Cases

### Original Use Case (Backgammon Guru)
Test a backgammon AI guru against GNU Backgammon engine:
- Present backgammon position
- Ask guru for best move
- Compare with engine calculation
- View audit trail of guru's reasoning

### Your Use Case
Adapt for any domain:
- **Chess**: Test chess guru vs Stockfish
- **Go**: Test go guru vs KataGo
- **Poker**: Test poker guru vs solver
- **Math**: Test problem-solving guru vs WolframAlpha

## Key Features

### 1. Dual-Mode Chat System
- **Open Chat Mode**: GPT-4o-mini for general questions ($0.15/$0.60 per 1M tokens)
- **Drill Mode**: Claude 3.7 Sonnet with 5000 token thinking budget ($3/$15 per 1M tokens)

### 2. Multi-Layer Context System
- Domain knowledge split into editable layers (e.g., "Chess Openings", "Endgame Principles")
- Layers compose into system prompt at request time
- No code changes needed to update knowledge

### 3. Extended Thinking Capture
- Claude's reasoning traces captured and stored
- Full transparency into how AI arrived at answer
- Compare reasoning vs mathematical engine output

### 4. Comprehensive Audit Trails
- Track what context layers were used
- Record token usage and costs
- Display reasoning traces
- Know exactly what informed each response

### 5. Position-Based Drill System
- Structured drill data (JSON format)
- Board visualization (ASCII or custom)
- Multiple move options with explanations
- Progressive hints system

## Architecture Highlights

### Critical Pattern #1: Prevent Stale Closures
```typescript
// ❌ WRONG: Body captured at hook initialization
const { sendMessage } = useChat({
  body: { mode, drillContext }  // Stale!
})

// ✅ CORRECT: Body passed at request time
sendMessage({ text }, {
  body: { mode, drillContext }  // Fresh!
})
```

### Critical Pattern #2: Race Condition Prevention
```typescript
// 1. Create placeholder IMMEDIATELY
createPlaceholderAuditTrail({ messageId, model, ... })

// 2. Start streaming (returns to user)
const result = streamText({ ... })

// 3. Update with data ASYNCHRONOUSLY
Promise.all([result.reasoning, result.usage])
  .then(([reasoning, usage]) => {
    updateAuditTrailWithData({ messageId, reasoning, usage })
  })
```

### Critical Pattern #3: Dual-Mode Architecture
```typescript
// Same endpoint supports both modes
const model = mode === 'drill'
  ? anthropic('claude-3-7-sonnet-20250219')  // Deep reasoning
  : openai('gpt-4o-mini')                     // Cost-effective

// Extended thinking only in drill mode
const result = mode === 'drill'
  ? streamText({
      model,
      messages,
      providerOptions: {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: 5000 }
        }
      }
    })
  : streamText({ model, messages })
```

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **AI SDK**: Vercel AI SDK v5 (useChat hook, streamText)
- **AI Models**: Claude 3.7 Sonnet (drill), GPT-4o-mini (open chat)
- **Database**: PostgreSQL + Prisma ORM
- **Validation**: Zod for runtime type checking
- **UI**: Tailwind CSS + shadcn/ui

## Quick Implementation Path

### Minimal Setup (30 minutes)
1. Copy `DRILL_MODE_ARCHITECTURE.md` to your project
2. Install dependencies from `code-examples/package-deps.txt`
3. Copy database schema from architecture doc
4. Run migrations
5. Copy `api-chat-route.ts` to your API folder
6. Copy `chat-component.tsx` to your components folder
7. Add one sample drill JSON
8. Test!

### Full Integration (2-4 hours)
1. Follow complete integration guide
2. Set up all API routes
3. Create all UI components
4. Build audit trail system
5. Customize for your domain

## Customization for Your Domain

### 1. Replace Drill Data Structure
Adapt the drill JSON to your domain:

**Backgammon**: Position, roll, move options
**Chess**: FEN, best move, alternatives
**Go**: SGF, joseki variations
**Poker**: Hand, pot, action options

### 2. Replace Board Visualization
Use ASCII art (simple) or canvas/SVG (advanced):
- Chessboard: FEN → visual board
- Go board: SGF → stone placement
- Poker table: Cards + chips

### 3. Customize Context Layers
Update knowledge for your domain:
- Chess: "Opening Principles", "Endgame Techniques"
- Go: "Fuseki Patterns", "Life & Death"
- Poker: "Range Construction", "Pot Odds"

### 4. Connect to Your Engine
Replace GNU Backgammon with:
- Stockfish (chess)
- KataGo (go)
- PioSolver (poker)
- WolframAlpha (math)

## Next Steps

1. **Read** `DRILL_MODE_ARCHITECTURE.md` (comprehensive guide)
2. **Follow** `INTEGRATION_GUIDE.md` (step-by-step)
3. **Copy** code from `code-examples/` folder
4. **Customize** for your specific domain
5. **Test** with sample drills
6. **Connect** to your mathematical engine
7. **Compare** guru responses vs engine calculations

## Support & Resources

- **AI SDK Documentation**: https://sdk.vercel.ai/docs
- **Prisma Documentation**: https://www.prisma.io/docs
- **Claude API**: https://docs.anthropic.com/
- **OpenAI API**: https://platform.openai.com/docs

## License

This documentation and code examples are extracted from the Backgammon Guru project for reuse in similar testing systems. Adapt freely for your use case.

---

**Ready to build your guru testing system?** Start with `DRILL_MODE_ARCHITECTURE.md` →
