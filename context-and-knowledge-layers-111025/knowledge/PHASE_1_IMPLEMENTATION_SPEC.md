# Phase 1 Implementation Spec: MVP Drill Mode

## Overview

This spec defines the exact implementation steps for Phase 1 of drilling mode integration based on finalized product decisions.

## Product Decisions

- **Drill Progression**: Free exploration (no forced order)
- **Progress Tracking**: Deferred to Phase 3
- **Board Visualization**: Text descriptions + ASCII art diagrams
- **Answer Input**: Multiple choice buttons only
- **Hint Strategy**: JSON hints first, AI-generated supplemental hints (labeled)
- **UI Layout**: Unified interface with mode toggle
- **Authentication**: Not needed (no tracking)
- **Platform Priority**: Mobile-first UI design, web-first technical implementation

## Goals

By end of Phase 1, users should be able to:
1. Toggle between Open Chat and Drill modes
2. Browse and select drills from Module 1
3. View drill position (text + ASCII art)
4. See multiple choice options
5. Click an option to submit answer
6. Receive AI feedback on their choice
7. Request hints (JSON or AI-generated, labeled)
8. Continue open discussion about the position

## Technical Implementation

### 1. Type Definitions

**File**: `lib/types.ts`

Add these types:

```typescript
// Drill types
export interface BoardSetup {
  points: Record<string, { color: 'black' | 'white'; checkers: number }>
  bar: { black: number; white: number }
  off: { black: number; white: number }
  summary: string
}

export interface DrillOption {
  move: string
  isCorrect: boolean
  explanation: string
}

export interface Drill {
  id: number
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  boardSetup: BoardSetup
  toPlay: 'black' | 'white'
  roll: [number, number]
  previousMove?: string | null
  question: string
  options: DrillOption[]
  principle: string
  hintsAvailable: string[]
}

export interface DrillModule {
  moduleId: number
  moduleName: string
  totalDrills: number
  note?: string
  drills: Drill[]
}

export interface DrillContext {
  drillId: number
  moduleId: number
  drill: Drill
  hintsUsedCount: number // Track client-side
}

// Chat types (existing + new)
export type ChatMode = 'open' | 'drill'

export interface ChatRequest {
  projectId: string
  userMessage: string
  chatHistory?: ChatMessage[]
  layerIds?: string[]
  mode?: ChatMode
  drillContext?: DrillContext
}
```

### 2. Drill Loader

**File**: `lib/drillLoader.ts` (NEW)

```typescript
import fs from 'fs'
import path from 'path'
import { DrillModule, Drill } from './types'

export function loadDrillModule(moduleId: number): DrillModule {
  const filePath = path.join(
    process.cwd(),
    'project-context',
    `module_${String(moduleId).padStart(2, '0')}_drills.json`
  )

  if (!fs.existsSync(filePath)) {
    throw new Error(`Module ${moduleId} not found`)
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return data as DrillModule
}

export function getDrill(moduleId: number, drillId: number): Drill {
  const module = loadDrillModule(moduleId)
  const drill = module.drills.find(d => d.id === drillId)

  if (!drill) {
    throw new Error(`Drill ${drillId} not found in module ${moduleId}`)
  }

  return drill
}

export function listAvailableModules(): Array<{ moduleId: number; moduleName: string; totalDrills: number }> {
  // For Phase 1, just return Module 1
  // Later, scan directory for all module_*.json files
  const module = loadDrillModule(1)
  return [
    {
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      totalDrills: module.totalDrills,
    }
  ]
}
```

### 3. Drill System Prompt Composer

**File**: `lib/contextComposer.ts`

Add this function:

```typescript
import { DrillContext } from './types'

export function composeDrillSystemPrompt(drillContext: DrillContext): string {
  const { drill, hintsUsedCount } = drillContext
  const boardSummary = drill.boardSetup.summary

  return `
---

# DRILL MODE ACTIVE

You are helping the user practice this specific backgammon position:

**Position**: ${boardSummary}
**To Play**: ${drill.toPlay.charAt(0).toUpperCase() + drill.toPlay.slice(1)}
**Roll**: ${drill.roll.join('-')}
**Question**: ${drill.question}

**Core Principle**: ${drill.principle}

**Available Moves**:
${drill.options.map((opt, idx) =>
  `${idx + 1}. ${opt.move} ${opt.isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
   ${opt.explanation}`
).join('\n\n')}

**Progressive Hints Available** (${hintsUsedCount}/${drill.hintsAvailable.length} used):
${drill.hintsAvailable.map((hint, idx) => {
  const hintNum = idx + 1
  if (idx < hintsUsedCount) {
    return `${hintNum}. [ALREADY PROVIDED] ${hint}`
  } else if (idx === hintsUsedCount) {
    return `${hintNum}. [NEXT HINT] ${hint}`
  } else {
    return `${hintNum}. [NOT YET PROVIDED]`
  }
}).join('\n')}

---

## Your Role in Drill Mode

**When user selects a move** (e.g., "I choose option 2"):
- Tell them if it's correct or incorrect
- Provide the explanation for their choice
- Reference the core principle
- Encourage them or guide them to think more

**When user asks "hint" or "I'm stuck"**:
- If JSON hints remain: Provide the NEXT hint from the list above
  - Add label: "(Hint from training material)"
- If all JSON hints exhausted: Generate a helpful Socratic hint based on the principle
  - Add label: "(AI-generated hint)"
- Don't reveal the answer directly

**When user asks for explanation or "show answer"**:
- Explain why the correct move is best
- Reference the principle
- Compare with other options if relevant

**When user wants open discussion**:
- Discuss related strategy, alternative scenarios, or concepts
- Stay grounded in this position but can broaden if they ask

**Important**:
- Be concise and focused
- Always reference the principle when explaining
- Use mobile-friendly formatting (short paragraphs)
`.trim()
}
```

### 4. API Routes

#### 4a. List Modules

**File**: `app/api/modules/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { listAvailableModules } from '@/lib/drillLoader'

export async function GET() {
  try {
    const modules = listAvailableModules()
    return NextResponse.json({ modules })
  } catch (error) {
    console.error('[GET /api/modules] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load modules' },
      { status: 500 }
    )
  }
}
```

#### 4b. Get Module Details

**File**: `app/api/modules/[moduleId]/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { loadDrillModule } from '@/lib/drillLoader'

export async function GET(
  request: Request,
  { params }: { params: { moduleId: string } }
) {
  try {
    const moduleId = parseInt(params.moduleId)
    if (isNaN(moduleId)) {
      return NextResponse.json(
        { error: 'Invalid module ID' },
        { status: 400 }
      )
    }

    const module = loadDrillModule(moduleId)

    // Return module with drill summaries (not full drill data)
    const drillSummaries = module.drills.map(d => ({
      id: d.id,
      difficulty: d.difficulty,
      category: d.category,
      question: d.question,
      principle: d.principle,
    }))

    return NextResponse.json({
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      totalDrills: module.totalDrills,
      note: module.note,
      drills: drillSummaries,
    })
  } catch (error) {
    console.error('[GET /api/modules/[moduleId]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load module' },
      { status: 500 }
    )
  }
}
```

#### 4c. Get Specific Drill

**File**: `app/api/modules/[moduleId]/drills/[drillId]/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { getDrill } from '@/lib/drillLoader'

export async function GET(
  request: Request,
  { params }: { params: { moduleId: string; drillId: string } }
) {
  try {
    const moduleId = parseInt(params.moduleId)
    const drillId = parseInt(params.drillId)

    if (isNaN(moduleId) || isNaN(drillId)) {
      return NextResponse.json(
        { error: 'Invalid module ID or drill ID' },
        { status: 400 }
      )
    }

    const drill = getDrill(moduleId, drillId)
    return NextResponse.json({ drill })
  } catch (error) {
    console.error('[GET /api/modules/[moduleId]/drills/[drillId]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load drill' },
      { status: 500 }
    )
  }
}
```

#### 4d. Update Chat API

**File**: `app/api/chat/route.ts`

Modify to handle drill mode:

```typescript
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { composeContextFromLayers, composeDrillSystemPrompt } from '@/lib/contextComposer'
import { NextResponse } from 'next/server'
import { ChatMessage, ChatRequest } from '@/lib/types'

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json()
    const {
      projectId,
      userMessage,
      chatHistory = [],
      layerIds,
      mode = 'open',
      drillContext
    } = body

    // Validate required fields
    if (!projectId || !userMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, userMessage' },
        { status: 400 }
      )
    }

    // Validate drill mode requirements
    if (mode === 'drill' && !drillContext) {
      return NextResponse.json(
        { error: 'drillContext required when mode is "drill"' },
        { status: 400 }
      )
    }

    // Compose base context from layers
    let systemPrompt = await composeContextFromLayers(projectId, layerIds)

    // Add drill context if in drill mode
    if (mode === 'drill' && drillContext) {
      systemPrompt += '\n\n' + composeDrillSystemPrompt(drillContext)
    }

    // Build messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatHistory.slice(-10).map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    // Stream response from OpenAI
    const result = await streamText({
      model: openai('gpt-4o-mini'),
      messages,
      temperature: 0.7,
      maxRetries: 2,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('[POST /api/chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
```

### 5. Frontend Components

#### 5a. ASCII Board Renderer

**File**: `lib/asciiBoard.ts` (NEW)

```typescript
import { BoardSetup } from './types'

export function renderASCIIBoard(boardSetup: BoardSetup, toPlay: 'black' | 'white', roll: [number, number]): string {
  // Simple ASCII art representation
  // Black moves from point 24 → 1 (top to bottom)
  // White moves from point 1 → 24 (bottom to top)

  const { points, bar, off } = boardSetup

  // Helper to get checker count and color for a point
  const getPoint = (num: number) => {
    const key = String(num)
    return points[key] || { color: null, checkers: 0 }
  }

  // Helper to render checkers
  const renderCheckers = (color: 'black' | 'white' | null, count: number, maxDisplay: number = 5) => {
    if (!color || count === 0) return '   '
    const symbol = color === 'black' ? '●' : '○'
    const display = Math.min(count, maxDisplay)
    const extra = count > maxDisplay ? `+${count - maxDisplay}` : ''
    return `${symbol.repeat(display)}${extra}`.padEnd(3)
  }

  const board = `
╔════════════════════════════════════════╗
║  13  14  15  16  17  18  ║  19  20  21  22  23  24  ║
║  ${renderCheckers(getPoint(13).color, getPoint(13).checkers)}  ${renderCheckers(getPoint(14).color, getPoint(14).checkers)}  ${renderCheckers(getPoint(15).color, getPoint(15).checkers)}  ${renderCheckers(getPoint(16).color, getPoint(16).checkers)}  ${renderCheckers(getPoint(17).color, getPoint(17).checkers)}  ${renderCheckers(getPoint(18).color, getPoint(18).checkers)}  ║  ${renderCheckers(getPoint(19).color, getPoint(19).checkers)}  ${renderCheckers(getPoint(20).color, getPoint(20).checkers)}  ${renderCheckers(getPoint(21).color, getPoint(21).checkers)}  ${renderCheckers(getPoint(22).color, getPoint(22).checkers)}  ${renderCheckers(getPoint(23).color, getPoint(23).checkers)}  ${renderCheckers(getPoint(24).color, getPoint(24).checkers)}  ║
╠════════════════════════════════════════╣
║            BAR: ${bar.black}●/${bar.white}○              ║
╠════════════════════════════════════════╣
║  12  11  10   9   8   7  ║   6   5   4   3   2   1  ║
║  ${renderCheckers(getPoint(12).color, getPoint(12).checkers)}  ${renderCheckers(getPoint(11).color, getPoint(11).checkers)}  ${renderCheckers(getPoint(10).color, getPoint(10).checkers)}  ${renderCheckers(getPoint(9).color, getPoint(9).checkers)}  ${renderCheckers(getPoint(8).color, getPoint(8).checkers)}  ${renderCheckers(getPoint(7).color, getPoint(7).checkers)}  ║  ${renderCheckers(getPoint(6).color, getPoint(6).checkers)}  ${renderCheckers(getPoint(5).color, getPoint(5).checkers)}  ${renderCheckers(getPoint(4).color, getPoint(4).checkers)}  ${renderCheckers(getPoint(3).color, getPoint(3).checkers)}  ${renderCheckers(getPoint(2).color, getPoint(2).checkers)}  ${renderCheckers(getPoint(1).color, getPoint(1).checkers)}  ║
╚════════════════════════════════════════╝

OFF: Black ${off.black}●  White ${off.white}○
TO PLAY: ${toPlay.toUpperCase()}
ROLL: ${roll.join('-')}

● = Black checkers (moving 24→1)
○ = White checkers (moving 1→24)
`

  return board.trim()
}
```

#### 5b. Drill Selector Component

**File**: `components/drill/DrillSelector.tsx` (NEW)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DrillSummary {
  id: number
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  question: string
  principle: string
}

interface ModuleSummary {
  moduleId: number
  moduleName: string
  totalDrills: number
  note?: string
  drills: DrillSummary[]
}

interface DrillSelectorProps {
  onSelectDrill: (moduleId: number, drillId: number) => void
}

export function DrillSelector({ onSelectDrill }: DrillSelectorProps) {
  const [module, setModule] = useState<ModuleSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load Module 1 for Phase 1
    fetch('/api/modules/1')
      .then(res => res.json())
      .then(data => {
        setModule(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load module:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="p-4">Loading drills...</div>
  }

  if (!module) {
    return <div className="p-4">Failed to load drills</div>
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="sticky top-0 bg-background z-10 pb-4 border-b">
        <h2 className="text-2xl font-bold">{module.moduleName}</h2>
        <p className="text-sm text-muted-foreground">
          {module.totalDrills} drills • {module.note}
        </p>
      </div>

      <div className="space-y-3">
        {module.drills.map((drill) => (
          <Card key={drill.id} className="hover:bg-accent/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={getDifficultyColor(drill.difficulty)}>
                      {drill.difficulty}
                    </Badge>
                    <Badge variant="outline">{drill.category}</Badge>
                  </div>
                  <CardTitle className="text-base leading-tight">
                    Drill #{drill.id}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{drill.question}</p>
              <p className="text-xs text-muted-foreground italic">
                Principle: {drill.principle}
              </p>
              <Button
                onClick={() => onSelectDrill(module.moduleId, drill.id)}
                className="w-full"
                size="sm"
              >
                Practice This Drill
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

#### 5c. Drill Board Component

**File**: `components/drill/DrillBoard.tsx` (NEW)

```typescript
'use client'

import { BoardSetup } from '@/lib/types'
import { renderASCIIBoard } from '@/lib/asciiBoard'

interface DrillBoardProps {
  boardSetup: BoardSetup
  toPlay: 'black' | 'white'
  roll: [number, number]
  question: string
}

export function DrillBoard({ boardSetup, toPlay, roll, question }: DrillBoardProps) {
  const asciiBoard = renderASCIIBoard(boardSetup, toPlay, roll)

  return (
    <div className="space-y-4">
      <div className="bg-muted p-4 rounded-lg">
        <p className="text-sm font-medium mb-3">{question}</p>
        <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
          {asciiBoard}
        </pre>
      </div>
      <p className="text-xs text-muted-foreground">
        {boardSetup.summary}
      </p>
    </div>
  )
}
```

#### 5d. Drill Options Component

**File**: `components/drill/DrillOptions.tsx` (NEW)

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DrillOption } from '@/lib/types'

interface DrillOptionsProps {
  options: DrillOption[]
  onSelectOption: (optionIndex: number) => void
  selectedIndex: number | null
  disabled: boolean
}

export function DrillOptions({
  options,
  onSelectOption,
  selectedIndex,
  disabled
}: DrillOptionsProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Choose your move:</p>
      {options.map((option, index) => (
        <Card
          key={index}
          className={`p-3 transition-all ${
            selectedIndex === index
              ? 'border-primary bg-primary/5'
              : 'hover:bg-accent/50'
          }`}
        >
          <Button
            variant="ghost"
            className="w-full justify-start text-left h-auto py-2"
            onClick={() => onSelectOption(index)}
            disabled={disabled}
          >
            <span className="font-mono font-semibold mr-3">
              {String.fromCharCode(65 + index)}.
            </span>
            <span>{option.move}</span>
          </Button>
        </Card>
      ))}
    </div>
  )
}
```

#### 5e. Modified Chat Component

**File**: `components/chat/BackgammonChat.tsx`

Modify to support drill mode. Key changes:
- Accept `mode` and `drillContext` props
- Show drill board and options when in drill mode
- Add "Hint" button in drill mode
- Track hints used
- Send drill context in chat requests

```typescript
'use client'

import { useChat } from 'ai/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useState, useRef, useEffect } from 'react'
import { ChatMode, DrillContext, Drill } from '@/lib/types'
import { DrillBoard } from '@/components/drill/DrillBoard'
import { DrillOptions } from '@/components/drill/DrillOptions'

interface BackgammonChatProps {
  mode?: ChatMode
  drill?: Drill
  moduleId?: number
  onExitDrill?: () => void
}

export function BackgammonChat({
  mode = 'open',
  drill,
  moduleId,
  onExitDrill
}: BackgammonChatProps) {
  const [hintsUsed, setHintsUsed] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const drillContext: DrillContext | undefined = drill && moduleId ? {
    drillId: drill.id,
    moduleId,
    drill,
    hintsUsedCount: hintsUsed,
  } : undefined

  const { messages, input, setInput, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: {
      projectId: 'default-project',
      mode,
      drillContext,
    },
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleHintRequest = () => {
    if (drill && hintsUsed < drill.hintsAvailable.length) {
      setInput('Can I have a hint?')
      setHintsUsed(hintsUsed + 1)
    } else {
      setInput('I\'ve used all the hints. Can you explain the answer?')
    }
  }

  const handleSelectOption = (index: number) => {
    if (!drill) return
    setSelectedOption(index)
    const option = drill.options[index]
    setInput(`I choose option ${String.fromCharCode(65 + index)}: ${option.move}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode indicator */}
      <div className="sticky top-0 bg-background z-10 border-b p-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {mode === 'drill' ? '🎯 Drill Mode' : '💬 Open Chat'}
            </span>
            {mode === 'drill' && drill && (
              <span className="text-xs text-muted-foreground">
                Module {moduleId} • Drill #{drill.id} • {drill.difficulty}
              </span>
            )}
          </div>
        </div>
        {mode === 'drill' && onExitDrill && (
          <Button variant="outline" size="sm" onClick={onExitDrill}>
            Exit Drill
          </Button>
        )}
      </div>

      {/* Drill content (only in drill mode) */}
      {mode === 'drill' && drill && (
        <div className="p-4 border-b space-y-4 overflow-y-auto">
          <DrillBoard
            boardSetup={drill.boardSetup}
            toPlay={drill.toPlay}
            roll={drill.roll}
            question={drill.question}
          />
          <DrillOptions
            options={drill.options}
            onSelectOption={handleSelectOption}
            selectedIndex={selectedOption}
            disabled={isLoading}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleHintRequest}
              disabled={isLoading}
              className="flex-1"
            >
              💡 Hint ({hintsUsed}/{drill.hintsAvailable.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInput('Explain why the correct answer is correct')}
              disabled={isLoading}
              className="flex-1"
            >
              Show Answer
            </Button>
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <Card
            key={message.id}
            className={`${
              message.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'mr-auto bg-muted'
            } max-w-[85%]`}
          >
            <CardContent className="p-3">
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </CardContent>
          </Card>
        ))}
        {isLoading && (
          <Card className="mr-auto bg-muted max-w-[85%]">
            <CardContent className="p-3">
              <p className="text-sm text-muted-foreground">Thinking...</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t p-4 space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === 'drill'
              ? 'Ask a question, request a hint, or discuss the position...'
              : 'Ask me anything about backgammon...'
          }
          className="min-h-[60px] resize-none"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()} className="w-full">
          Send
        </Button>
      </form>
    </div>
  )
}
```

#### 5f. Main Page with Mode Toggle

**File**: `app/page.tsx`

Modify to support mode switching:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { BackgammonChat } from '@/components/chat/BackgammonChat'
import { DrillSelector } from '@/components/drill/DrillSelector'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatMode, Drill } from '@/lib/types'

export default function Home() {
  const [mode, setMode] = useState<ChatMode>('open')
  const [currentDrill, setCurrentDrill] = useState<Drill | null>(null)
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null)

  const handleSelectDrill = async (moduleId: number, drillId: number) => {
    try {
      const response = await fetch(`/api/modules/${moduleId}/drills/${drillId}`)
      const data = await response.json()
      setCurrentDrill(data.drill)
      setCurrentModuleId(moduleId)
      setMode('drill')
    } catch (error) {
      console.error('Failed to load drill:', error)
    }
  }

  const handleExitDrill = () => {
    setCurrentDrill(null)
    setCurrentModuleId(null)
    setMode('open')
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">Backgammon Guru</h1>
        <p className="text-sm text-muted-foreground">
          AI-powered backgammon coach
        </p>
      </header>

      <main className="flex-1 overflow-hidden">
        {mode === 'open' ? (
          <Tabs defaultValue="chat" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="drills">Practice Drills</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
              <BackgammonChat mode="open" />
            </TabsContent>
            <TabsContent value="drills" className="flex-1 overflow-y-auto mt-0 p-4">
              <DrillSelector onSelectDrill={handleSelectDrill} />
            </TabsContent>
          </Tabs>
        ) : (
          <BackgammonChat
            mode="drill"
            drill={currentDrill || undefined}
            moduleId={currentModuleId || undefined}
            onExitDrill={handleExitDrill}
          />
        )}
      </main>
    </div>
  )
}
```

### 6. UI Components (if missing)

Need to verify these shadcn components exist, add if missing:
- Tabs (for mode switching)

```bash
npx shadcn@latest add tabs
```

## Implementation Order

1. ✅ Update types.ts
2. ✅ Create drillLoader.ts
3. ✅ Create asciiBoard.ts
4. ✅ Update contextComposer.ts (add drill prompt function)
5. ✅ Create API routes (modules, drills)
6. ✅ Update chat API route
7. ✅ Create DrillBoard.tsx
8. ✅ Create DrillOptions.tsx
9. ✅ Create DrillSelector.tsx
10. ✅ Update BackgammonChat.tsx
11. ✅ Update page.tsx
12. ✅ Test end-to-end

## Testing Checklist

- [ ] Can load Module 1 drills via API
- [ ] Can select a drill from list
- [ ] Drill board displays with ASCII art
- [ ] Multiple choice options show correctly
- [ ] Can click an option and get AI feedback
- [ ] Hint button works and increments counter
- [ ] AI provides JSON hints with label
- [ ] After all JSON hints, AI generates new hints with label
- [ ] Can switch between Chat and Drills tabs
- [ ] Can exit drill mode back to open chat
- [ ] Mobile-responsive layout works
- [ ] ASCII board is readable on mobile

## Success Criteria

Phase 1 is complete when:
1. User can browse 24 drills from Module 1
2. User can enter drill mode and see board + question
3. User can select multiple choice answers
4. AI provides contextual feedback on selections
5. Hint system works (JSON + AI-generated)
6. User can have open discussion about position
7. User can easily switch between open and drill modes
8. UI is mobile-friendly

## Notes

- Keep components simple and focused for Phase 1
- ASCII art should be monospaced and readable
- All drill data loaded from JSON (no database yet)
- No progress tracking (Phase 3)
- No authentication (future)
- Focus on core drill experience and AI interaction
