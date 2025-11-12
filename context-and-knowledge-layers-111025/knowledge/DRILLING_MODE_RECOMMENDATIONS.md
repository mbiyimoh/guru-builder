# Drilling Mode Integration: Detailed Recommendations

## Executive Summary

This document provides comprehensive recommendations for integrating "Drilling Mode" into the Backgammon Guru application. The drilling mode will complement the existing "Open Chat Mode" by providing structured, position-based learning experiences using the drill data defined in the 20-module training curriculum.

## Table of Contents

1. [Drill Data Analysis](#drill-data-analysis)
2. [Recommended Architecture](#recommended-architecture)
3. [Database Schema Changes](#database-schema-changes)
4. [API Endpoint Design](#api-endpoint-design)
5. [Frontend Components](#frontend-components)
6. [AI Integration Strategy](#ai-integration-strategy)
7. [Implementation Phases](#implementation-phases)
8. [Edge Cases & Considerations](#edge-cases--considerations)

---

## Drill Data Analysis

### Fields We Should Leverage

After analyzing `module_01_drills.json`, here are the key fields to integrate:

#### **Essential Fields (Must Use)**

1. **id** (number): Unique drill identifier
2. **moduleId** (from parent): Which module this drill belongs to
3. **difficulty** (easy/medium/hard): For filtering and progression
4. **category** (string): Groups drills by concept (e.g., "mandatory-points", "flexible-builders", "splitting-plays")
5. **boardSetup** (object): The complete board state
   - `points`: Point-by-point breakdown with color and checker count
   - `bar`: Checkers on the bar for each player
   - `off`: Checkers borne off
   - `summary`: Human-readable description
6. **toPlay** (string): Which player's turn ("black" or "white")
7. **roll** (array): The dice roll [die1, die2]
8. **question** (string): The prompt shown to the user
9. **options** (array): Multiple choice moves
   - `move`: Notation (e.g., "8/5, 6/5")
   - `isCorrect`: Boolean
   - `explanation`: Why this move is right/wrong
10. **principle** (string): The core lesson this drill teaches
11. **hintsAvailable** (array): Progressive hints for when user is stuck

#### **Optional but Valuable Fields**

1. **previousMove** (string | null): Context about what happened before this position
2. **position.description** (string): Alternative human-readable position summary

#### **Fields We Can Derive or Skip**

1. **position** (shorthand notation): Redundant with boardSetup
   - Keep for backward compatibility but use boardSetup for rendering
2. Duplicate board representations: Use the most structured one (boardSetup.points)

### JSON Structure Insights

**Strong Points:**
- Rich explanations for each option (not just correct/incorrect)
- Multiple hints allow progressive disclosure
- Principle field makes it easy to reference core concepts
- Category system enables drill filtering
- Difficulty progression is built-in

**Opportunities:**
- Could add timing data (how long users take per drill)
- Could track which hints were used
- Could add related drills for "practice more like this"
- Could include XG/GnuBG equity evaluations for moves

---

## Recommended Architecture

### Mode System Design

```typescript
// Two distinct chat modes
type ChatMode = 'open' | 'drill'

// Drill mode requires additional context
interface DrillContext {
  drillId: number
  moduleId: number
  boardSetup: BoardSetup
  roll: [number, number]
  toPlay: 'black' | 'white'
  question: string
  options: DrillOption[]
  principle: string
  hints: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
}

interface ChatRequest {
  projectId: string
  userMessage: string
  chatHistory: ChatMessage[]
  layerIds?: string[]
  mode: ChatMode  // NEW
  drillContext?: DrillContext  // NEW: required when mode='drill'
}
```

### Mode-Specific AI Behavior

#### **Open Chat Mode** (Current)
- System prompt: Context layers only
- Behavior: General backgammon coaching
- No position constraints

#### **Drill Mode** (New)
- System prompt: Context layers + Drill context
- Behavior: Position-specific coaching with three response types:
  1. **Explain Best Move**: Concise explanation referencing the drill's principle
  2. **Socratic Hint**: Progressive hint from hintsAvailable array
  3. **Open Discussion**: Deeper strategy conversation about the position

**Drill Mode System Prompt Structure:**
```
# CONTEXT LAYERS
[existing layer composition...]

---

# DRILL MODE INSTRUCTIONS

You are helping the user practice a specific backgammon position. Here is the drill context:

**Position**: [board setup summary]
**To Play**: [black/white]
**Roll**: [dice]
**Question**: [question text]
**Principle**: [core principle this drill teaches]

**Available Moves (Options)**:
1. [move notation] - [is correct?] - [explanation]
2. [move notation] - [is correct?] - [explanation]
...

**Progressive Hints**:
- Hint 1: [first hint]
- Hint 2: [second hint]
...

---

## Your Role in Drill Mode

**When the user asks for an explanation:**
- Explain why the best move is correct
- Reference the principle
- Compare with the alternatives provided

**When the user says "I'm stuck" or asks for a hint:**
- Provide a Socratic question from the hints array
- Don't give away the answer directly
- Guide their thinking toward the principle

**When the user wants to discuss the position:**
- Engage in open-ended conversation
- Discuss alternative moves and their strengths/weaknesses
- Reference position types, strategic concepts, and playing styles
- Feel free to go beyond the drill if the conversation leads there

**Important**: Stay focused on THIS specific position unless the user explicitly wants to discuss broader strategy.
```

---

## Database Schema Changes

### Option 1: Store Drills in Database (Recommended for Production)

```prisma
model Module {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  moduleNumber Int
  name         String
  description  String?
  drills       Drill[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, moduleNumber])
}

model Drill {
  id          String   @id @default(cuid())
  moduleId    String
  module      Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  drillNumber  Int
  difficulty   String   // 'easy' | 'medium' | 'hard'
  category     String

  // Board state
  boardSetup   Json     // Store the full boardSetup object
  toPlay       String   // 'black' | 'white'
  roll         Json     // [number, number]
  previousMove String?

  // Question and answers
  question     String   @db.Text
  options      Json     // Array of option objects
  principle    String   @db.Text
  hints        Json     // Array of hint strings

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([moduleId, drillNumber])
  @@index([difficulty])
  @@index([category])
}

model UserDrillProgress {
  id          String   @id @default(cuid())
  userId      String   // Future: when auth is added
  drillId     String
  drill       Drill    @relation(fields: [drillId], references: [id], onDelete: Cascade)

  attempts    Int      @default(0)
  completed   Boolean  @default(false)
  hintsUsed   Int      @default(0)
  lastAttempt DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, drillId])
}
```

**Migration Path:**
1. Create new models
2. Write import script to load drills from JSON into database
3. Add API endpoints for drill CRUD operations

### Option 2: Load Drills from JSON (Faster MVP)

Keep drills in `project-context/*.json` files and load them on-demand. Simpler for MVP but less flexible.

```typescript
// lib/drillLoader.ts
import fs from 'fs'
import path from 'path'

export interface DrillModule {
  moduleId: number
  moduleName: string
  totalDrills: number
  drills: Drill[]
}

export function loadDrillModule(moduleId: number): DrillModule {
  const filePath = path.join(
    process.cwd(),
    'project-context',
    `module_${String(moduleId).padStart(2, '0')}_drills.json`
  )
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return data
}

export function getDrill(moduleId: number, drillId: number): Drill {
  const module = loadDrillModule(moduleId)
  const drill = module.drills.find(d => d.id === drillId)
  if (!drill) throw new Error(`Drill ${drillId} not found in module ${moduleId}`)
  return drill
}
```

**Recommendation**: Start with Option 2 (JSON loading) for MVP, then migrate to Option 1 (database) when adding user progress tracking.

---

## API Endpoint Design

### New Endpoints

#### 1. List Available Modules

```
GET /api/modules
```

Response:
```json
{
  "modules": [
    {
      "moduleId": 1,
      "moduleName": "Basic Opening Rolls",
      "totalDrills": 24,
      "description": "Learn the fundamental opening plays..."
    }
  ]
}
```

#### 2. Get Module with Drills

```
GET /api/modules/[moduleId]
```

Response:
```json
{
  "moduleId": 1,
  "moduleName": "Basic Opening Rolls",
  "totalDrills": 24,
  "drills": [
    {
      "id": 1,
      "difficulty": "easy",
      "category": "mandatory-points",
      "question": "Black to play 3-1..."
      // ... minimal drill info for list view
    }
  ]
}
```

#### 3. Get Specific Drill

```
GET /api/modules/[moduleId]/drills/[drillId]
```

Response: Full drill object with all fields

#### 4. Modified Chat Endpoint

```
POST /api/chat
```

New request body:
```json
{
  "projectId": "default-project",
  "userMessage": "I'm stuck, can you give me a hint?",
  "chatHistory": [...],
  "mode": "drill",  // NEW
  "drillContext": {  // NEW: required when mode='drill'
    "drillId": 1,
    "moduleId": 1,
    "boardSetup": {...},
    "roll": [3, 1],
    "toPlay": "black",
    "question": "Black to play 3-1...",
    "options": [...],
    "principle": "When you can make the 5-point...",
    "hints": [...]
  }
}
```

Modified `app/api/chat/route.ts`:
```typescript
export async function POST(req: Request) {
  const body: ChatRequest = await req.json()
  const { projectId, userMessage, chatHistory = [], layerIds, mode = 'open', drillContext } = body

  // Validate drill mode requirements
  if (mode === 'drill' && !drillContext) {
    return NextResponse.json(
      { error: 'drillContext required when mode is "drill"' },
      { status: 400 }
    )
  }

  // Compose system prompt
  let systemPrompt = await composeContextFromLayers(projectId, layerIds)

  if (mode === 'drill' && drillContext) {
    systemPrompt += '\n\n' + composeDrillSystemPrompt(drillContext)
  }

  // Rest of existing logic...
}
```

---

## Frontend Components

### New Components to Build

#### 1. `DrillSelector.tsx`
Module and drill selection interface
- List of modules (accordion or cards)
- Drill list within each module (filterable by difficulty, category)
- Shows progress indicators (if tracking enabled)
- Click drill → Load it in drill mode

#### 2. `DrillBoard.tsx`
Visual representation of the backgammon board
- Displays board setup from drill
- Shows checkers on points
- Highlights the roll
- Indicates whose turn it is
- Optional: Allow move input (advanced feature)

**MVP Version**: Simple ASCII art or text representation
**Future Version**: Interactive SVG board with drag-and-drop

#### 3. `DrillChat.tsx`
Modified chat interface for drill mode
- Shows drill question prominently
- Displays current drill info (module, number, difficulty)
- "Hint" button that sends hint request
- "Explain Answer" button
- Mode toggle to switch between drill and open chat

#### 4. `DrillProgress.tsx` (Future)
Track and display user progress
- Drills completed per module
- Difficulty distribution
- Time spent
- Hints used statistics

### Modified Components

#### `BackgammonChat.tsx`
Add mode awareness:
```typescript
interface BackgammonChatProps {
  mode?: 'open' | 'drill'
  drill?: DrillContext
}

export function BackgammonChat({ mode = 'open', drill }: BackgammonChatProps) {
  // Modify chat request to include mode and drill context
  // Add UI elements for drill-specific actions
  // Show drill info if in drill mode
}
```

#### `/app/page.tsx`
Add drill mode route or toggle:
- Option A: `/` for open chat, `/drill` for drill mode
- Option B: Mode toggle on same page with drill selector sidebar
- Recommendation: Option B for smoother UX

---

## AI Integration Strategy

### Enhancing Context Composition

Extend `lib/contextComposer.ts`:

```typescript
export interface DrillContext {
  drillId: number
  moduleId: number
  boardSetup: BoardSetup
  roll: [number, number]
  toPlay: 'black' | 'white'
  question: string
  options: DrillOption[]
  principle: string
  hints: string[]
  difficulty: string
  category: string
}

export function composeDrillSystemPrompt(drill: DrillContext): string {
  const boardSummary = drill.boardSetup.summary || 'Standard opening position'

  return `
---

# DRILL MODE INSTRUCTIONS

You are helping the user practice this specific backgammon position:

**Position**: ${boardSummary}
**To Play**: ${drill.toPlay}
**Roll**: ${drill.roll.join('-')}
**Question**: ${drill.question}

**Core Principle**: ${drill.principle}

**Available Moves**:
${drill.options.map((opt, idx) =>
  `${idx + 1}. ${opt.move} ${opt.isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
   Explanation: ${opt.explanation}`
).join('\n\n')}

**Progressive Hints** (use these when user asks for help):
${drill.hints.map((hint, idx) => `${idx + 1}. ${hint}`).join('\n')}

---

## Your Role

**When user asks for explanation or selects a move:**
- If they selected the correct move: Praise and explain why it's best, referencing the principle
- If they selected incorrect: Explain why it's suboptimal, reference the correct alternative
- Always relate back to the core principle

**When user says "hint" or "I'm stuck":**
- Provide the NEXT unused hint from the list above
- Don't reveal the answer directly
- Keep it Socratic - guide their thinking

**When user wants open discussion:**
- Feel free to discuss related strategy, alternative scenarios, or general principles
- But stay grounded in THIS position unless they explicitly ask to broaden

**Important**: Be concise in drill mode. Focus on the specific position.
`.trim()
}
```

### Detecting User Intent

The AI should recognize different types of requests in drill mode:

| User Input | Intent | AI Response Type |
|------------|--------|------------------|
| "I'm stuck" | Request hint | Provide next hint from hintsAvailable |
| "Give me a hint" | Request hint | Provide next hint |
| "I think the answer is X" | Move selection | Evaluate move, explain correctness |
| "Why is X the best move?" | Request explanation | Explain correct move's reasoning |
| "What about move Y?" | Alternative analysis | Compare Y to correct move |
| "Explain this position" | General explanation | Provide position overview + principle |
| "Let's talk about priming" | Open discussion | Broaden to general strategy (while staying contextual) |

### Hint Progression Strategy

Track which hints have been provided (client-side state or database):

```typescript
// Client-side state
const [hintsUsed, setHintsUsed] = useState(0)

// When user asks for hint
if (hintsUsed < drill.hints.length) {
  // Send specific hint in the message or context
  const nextHint = drill.hints[hintsUsed]
  setHintsUsed(hintsUsed + 1)
} else {
  // All hints exhausted
  message = "You've used all available hints. Would you like me to explain the answer?"
}
```

---

## Implementation Phases

### Phase 1: MVP Drill Mode (Week 1-2)

**Goals:**
- Users can select and view drills
- Drill mode chat works with basic explanations
- Mode toggle between open and drill chat

**Tasks:**
1. Create `lib/drillLoader.ts` to load JSON drills
2. Add `GET /api/modules` endpoint
3. Add `GET /api/modules/[moduleId]/drills/[drillId]` endpoint
4. Modify `POST /api/chat` to accept mode and drillContext
5. Create `composeDrillSystemPrompt()` in contextComposer
6. Build `DrillSelector.tsx` (simple list view)
7. Modify `BackgammonChat.tsx` to show drill info when in drill mode
8. Add mode toggle to main page

**Acceptance Criteria:**
- User can see list of Module 1 drills
- User can click a drill and enter drill mode
- User can chat about the drill position
- AI references the drill's principle and options in responses
- User can switch back to open chat mode

### Phase 2: Enhanced Drill Experience (Week 3-4)

**Goals:**
- Better drill UI with visual improvements
- Hint system with progression
- Multiple choice selection (not just chat-based)

**Tasks:**
1. Build `DrillBoard.tsx` for visual board representation (ASCII art or simple SVG)
2. Add hint progression tracking (client-side)
3. Create "Show Hint" button that provides next hint
4. Create "Explain Answer" button for full explanation
5. Add multiple choice UI: Show options as clickable buttons
6. Add feedback UI: Show if selected move is correct/incorrect with explanation
7. Style drill mode distinctly from open chat mode

**Acceptance Criteria:**
- User sees visual representation of board
- User can click "Hint" to get progressive hints
- User can click move options to select their answer
- User gets immediate feedback (correct/incorrect + explanation)
- After selecting, user can continue chatting about the position

### Phase 3: Drill Management & Progress (Week 5-6)

**Goals:**
- Database storage for drills
- User progress tracking
- Drill filtering and recommendations

**Tasks:**
1. Create Prisma schema for Module, Drill, UserDrillProgress models
2. Write migration script to import JSON drills to database
3. Build drill import/export admin tools
4. Add user progress tracking (attempts, completion, hints used)
5. Create `DrillProgress.tsx` dashboard
6. Add drill filtering (by difficulty, category, completion status)
7. Implement "Next Drill" recommendation algorithm

**Acceptance Criteria:**
- Drills stored in database
- User progress persists across sessions
- User can see which drills they've completed
- User can filter drills by difficulty and category
- System recommends next drill based on progress and difficulty

### Phase 4: Advanced Features (Week 7+)

**Goals:**
- Interactive board with move validation
- Drill creation UI
- Multi-module support (modules 2-20)
- Social features (sharing, leaderboards)

**Tasks:**
1. Build interactive board with drag-and-drop checker movement
2. Implement move validation (check if user's move matches drill options)
3. Create drill editor for custom drill creation
4. Load and integrate modules 2-20
5. Add drill sharing functionality
6. Add leaderboards (fastest completion, fewest hints, etc.)
7. Add drill discussions/comments

---

## Edge Cases & Considerations

### 1. Board Setup Variations

**Issue**: Drills have multiple board representations (position string, boardSetup object)

**Solution**:
- Standardize on `boardSetup.points` for rendering
- Keep `position` string for backward compatibility
- Use `boardSetup.summary` for text descriptions

### 2. Invalid Drill Data

**Issue**: JSON might have malformed data or missing fields

**Solution**:
- Add Zod validation schema for drill data
- Validate on load, log errors
- Provide fallback/skip invalid drills
- Add drill validation tool for content creators

```typescript
// lib/validation.ts
import { z } from 'zod'

export const DrillOptionSchema = z.object({
  move: z.string(),
  isCorrect: z.boolean(),
  explanation: z.string(),
})

export const DrillSchema = z.object({
  id: z.number(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string(),
  boardSetup: z.object({
    points: z.record(z.object({
      color: z.enum(['black', 'white']),
      checkers: z.number(),
    })),
    bar: z.object({ black: z.number(), white: z.number() }),
    off: z.object({ black: z.number(), white: z.number() }),
    summary: z.string(),
  }),
  toPlay: z.enum(['black', 'white']),
  roll: z.tuple([z.number(), z.number()]),
  question: z.string(),
  options: z.array(DrillOptionSchema),
  principle: z.string(),
  hintsAvailable: z.array(z.string()),
})
```

### 3. Drill Context Size

**Issue**: Full drill context might be large, increasing prompt size

**Solution**:
- Only include relevant fields in system prompt
- Omit redundant fields (position string if boardSetup is provided)
- For long explanations, summarize or truncate
- Monitor token usage and optimize prompt structure

### 4. Hint Exhaustion

**Issue**: User asks for hints but all hints are used

**Solution**:
- Track hints used (client state or backend)
- When exhausted, offer to explain the answer
- Alternatively, generate new hints using AI (advanced)

### 5. Multiple Correct Answers

**Issue**: Some positions might have multiple reasonable moves

**Solution**:
- Drill JSON has one marked as `isCorrect: true`
- Others have explanations showing relative strength
- AI should acknowledge when alternative is "also reasonable"
- Use options' explanations to provide nuanced feedback

### 6. Mode Switching

**Issue**: User in drill mode wants to switch to open chat mid-conversation

**Solution**:
- Provide clear mode toggle button
- Ask for confirmation if chat history exists
- Option to "continue discussing this position in open mode" (remove drill constraints)

### 7. Drill Relevance to Learning Path

**Issue**: User might jump to advanced drills without foundational knowledge

**Solution**:
- Add recommended prerequisites to drill metadata
- Enforce progression (can't do module 5 until module 4 complete)
- Or allow free exploration but warn about difficulty
- Show difficulty clearly before starting drill

### 8. Performance with Large Drill Sets

**Issue**: Loading all 24 drills at once might be slow

**Solution**:
- Paginate drill lists
- Lazy load drill details (summary in list, full data on click)
- Cache drill data client-side
- Use React Query or SWR for efficient data fetching

### 9. Accessibility

**Issue**: Visual board might not work for screen readers

**Solution**:
- Always provide text description (boardSetup.summary)
- Use semantic HTML for drill components
- Add ARIA labels to interactive elements
- Offer text-only mode option

### 10. Mobile Experience

**Issue**: Board visualization and chat might be cramped on mobile

**Solution**:
- Responsive design with mobile-first approach
- Collapsible board view on mobile
- Full-screen drill mode option
- Touch-friendly move selection

---

## Recommended Next Steps

### Immediate (Before Implementation)

1. **Validate Drill Data**: Run validation script on all drill JSON files to catch issues early
2. **User Flow Design**: Create wireframes for drill selection → drill mode → completion flow
3. **API Contract**: Finalize API request/response formats and document them
4. **Component Hierarchy**: Map out React component tree for drill mode features

### Short-Term (Phase 1 Implementation)

1. Implement drill loading from JSON
2. Add mode parameter to chat API
3. Build basic drill selector
4. Modify chat UI for drill mode
5. Test with Module 1 drills

### Medium-Term (Phases 2-3)

1. Enhance drill UI with visual board
2. Add hint progression system
3. Implement multiple choice selection
4. Add progress tracking
5. Database migration for drill storage

### Long-Term (Phase 4+)

1. Interactive board with move validation
2. Drill creation tools
3. All 20 modules integrated
4. Social features
5. Mobile app

---

## Product Decisions (FINALIZED)

The following product decisions have been made for Phase 1 implementation:

1. **Drill Progression**: ✅ **Free exploration** - Users can access any drill without forced sequential completion
2. **Progress Tracking**: ✅ **Phase 3** - No tracking in Phase 1, implement in Phase 3
3. **Board Visualization**: ✅ **Text + ASCII art** - Start with text descriptions and ASCII art diagrams (mobile-friendly)
4. **Multiple Choice vs Free Input**: ✅ **Multiple choice buttons** - Clickable options only for now
5. **Hint Strategy**: ✅ **Hybrid approach** - Use JSON hints first, allow AI to generate additional hints if needed. Label hints as "JSON-derived" or "AI-generated"
6. **Mode Placement**: ✅ **Unified interface** - Single page with mode toggle (easier UX)
7. **Authentication**: ✅ **Not applicable** - No tracking in Phase 1, so auth not needed yet
8. **Platform Priority**: ✅ **Mobile-first UI, web-first architecture** - Design for eventual mobile app but build as web prototype. Chat interface should work alongside board display on mobile screens

---

## Conclusion

The drilling mode integration will significantly enhance the learning experience by providing structured, position-based practice. The recommended architecture preserves the existing open chat mode while adding a complementary drill-focused mode.

**Key Success Factors:**
1. Clean separation between open and drill modes
2. Rich drill context passed to AI for position-specific coaching
3. Progressive hint system that guides without revealing answers
4. Flexible architecture that supports future enhancements
5. Maintains transparency principle (users understand what's happening)

**Biggest Risks:**
1. Prompt size growing too large with drill context
2. Mode confusion (users not understanding which mode they're in)
3. Drill data quality (incomplete or incorrect drill definitions)
4. UI complexity (too many features overwhelming users)

**Mitigation:**
- Monitor and optimize prompt size
- Clear mode indicators and smooth transitions
- Validation and testing of drill data
- Phased rollout starting with simple MVP

This integration should be done iteratively, validating user experience at each phase before moving to the next level of complexity.
