# Position Seeding for Scenario-Based Drills - Technical Specification

**Slug:** scenario-based-drill-position-seeding
**Author:** Claude Code
**Date:** 2025-12-13
**Status:** Ready for Implementation
**Depends on:** Ground Truth Engine Integration
**Phase 2 Spec:** `04-phase2-extended-game-phases.md` (early/mid/bearoff positions)

---

## Executive Summary

Transform drill generation from abstract concept questions to scenario-based drills by:
1. Automatically sourcing all 21 opening roll positions from GNUBG
2. Seeding positions into the drill generation prompt
3. Adding an info modal to explain artifact creation to users

**MVP Scope**: Opening positions only (21 unique first rolls). Other game phases (early, mid, bearoff) are planned for Phase 2 after validating this approach works.

---

## 1. System Architecture

### 1.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    POSITION LIBRARY POPULATION                       │
│  (One-time setup for all 21 opening rolls)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ GNUBG Engine │───▶│ get_best_    │───▶│ PositionLibrary      │  │
│  │              │    │ moves()      │    │ (Database)           │  │
│  │ 21 opening   │    │              │    │ - positionId         │  │
│  │ rolls        │    │ Top 3 moves  │    │ - diceRoll           │  │
│  └──────────────┘    │ per roll     │    │ - bestMove           │  │
│                      └──────────────┘    │ - asciiBoard         │  │
│                                          └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    DRILL GENERATION FLOW                             │
│  (Per artifact generation)                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User clicks     ┌─────────────┐   ┌─────────────┐   ┌───────────┐ │
│  "Generate" ────▶│ Load        │──▶│ Seed        │──▶│ Generate  │ │
│                  │ Prerequisites│   │ Positions   │   │ Drills    │ │
│                  │ (MM + Curr) │   │ (21 opens)  │   │           │ │
│                  └─────────────┘   └─────────────┘   └───────────┘ │
│                                           │                  │      │
│                                           ▼                  ▼      │
│                                    ┌─────────────┐   ┌───────────┐ │
│                                    │ Position    │   │ Save      │ │
│                                    │ Library     │   │ Artifact  │ │
│                                    └─────────────┘   └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Overview

| Component | Purpose | Location |
|-----------|---------|----------|
| PositionLibrary (DB) | Store authenticated positions | `prisma/schema.prisma` |
| Opening Populator | Fetch 21 opening positions | `lib/positionLibrary/openings.ts` |
| ASCII Renderer | Render board as text | `lib/positionLibrary/asciiRenderer.ts` |
| Position Seeder | Select positions for drill gen | `lib/positionLibrary/seeder.ts` |
| Drill Designer (updated) | Generate drills from positions | `lib/guruFunctions/generators/drillDesigner.ts` |
| Info Modal | Explain artifact creation | `components/artifacts/ArtifactInfoModal.tsx` |

---

## 2. Database Schema

### 2.1 PositionLibrary Model (Simplified for MVP)

```prisma
model PositionLibrary {
  id              String   @id @default(cuid())

  // Position identification
  positionId      String   @unique  // GNUBG 14-char Position ID or "opening-{dice}"

  // Game context
  gamePhase       GamePhase         // OPENING for MVP
  diceRoll        String            // e.g., "3-1", "6-6"

  // Engine analysis
  bestMove        String            // GNUBG notation e.g., "8/5 6/5"
  bestMoveEquity  Float             // Equity of best move
  secondBestMove  String?           // Alternative for distractors
  secondEquity    Float?
  thirdBestMove   String?
  thirdEquity     Float?

  // ASCII representation
  asciiBoard      String            // Pre-rendered ASCII board

  // Source tracking
  sourceType      PositionSource    // OPENING_CATALOG for MVP

  // Metadata
  createdAt       DateTime @default(now())

  // Engine reference
  engineId        String
  engine          GroundTruthEngine @relation(fields: [engineId], references: [id])

  @@index([gamePhase])
  @@index([engineId, gamePhase])
}

enum GamePhase {
  OPENING    // First roll (move 1) - MVP
  EARLY      // Phase 2
  MIDDLE     // Phase 2
  BEAROFF    // Phase 2
}

enum PositionSource {
  OPENING_CATALOG  // The 21 standard openings
  SELF_PLAY        // Phase 2
  MATCH_MINING     // Phase 2
}
```

### 2.2 Schema Changes to GuruArtifact

```prisma
model GuruArtifact {
  // ... existing fields ...

  // NEW: Position seeding metadata for drill series
  positionsUsed     String[]  // Array of positionId references
}
```

---

## 3. Opening Position Population

### 3.1 The 21 Opening Rolls

```typescript
// lib/positionLibrary/openings.ts

export const OPENING_ROLLS = [
  // Non-doubles (15 combinations)
  '6-5', '6-4', '6-3', '6-2', '6-1',
  '5-4', '5-3', '5-2', '5-1',
  '4-3', '4-2', '4-1',
  '3-2', '3-1',
  '2-1',
  // Doubles (6 combinations)
  '6-6', '5-5', '4-4', '3-3', '2-2', '1-1'
] as const

// Standard opening position ID (both sides at starting position)
export const OPENING_POSITION_ID = 'opening'

export async function populateOpeningPositions(
  engineConfig: GroundTruthConfig
): Promise<{ populated: number; errors: string[] }> {
  const errors: string[] = []
  let populated = 0

  for (const dice of OPENING_ROLLS) {
    try {
      // Query engine for best moves for this opening roll
      const result = await executeGroundTruthTool('get_best_moves', {
        position: OPENING_POSITION_ID,
        dice,
        count: 3  // Get top 3 moves for distractors
      }, engineConfig)

      if (!result.success || !result.moves?.length) {
        errors.push(`Failed to get moves for ${dice}: ${result.error || 'No moves returned'}`)
        continue
      }

      // Upsert position to database
      await prisma.positionLibrary.upsert({
        where: { positionId: `opening-${dice}` },
        create: {
          positionId: `opening-${dice}`,
          gamePhase: 'OPENING',
          diceRoll: dice,
          bestMove: result.moves[0].move,
          bestMoveEquity: result.moves[0].equity,
          secondBestMove: result.moves[1]?.move,
          secondEquity: result.moves[1]?.equity,
          thirdBestMove: result.moves[2]?.move,
          thirdEquity: result.moves[2]?.equity,
          asciiBoard: renderOpeningBoard(dice),
          sourceType: 'OPENING_CATALOG',
          engineId: engineConfig.engineId
        },
        update: {
          bestMove: result.moves[0].move,
          bestMoveEquity: result.moves[0].equity,
          secondBestMove: result.moves[1]?.move,
          secondEquity: result.moves[1]?.equity,
          thirdBestMove: result.moves[2]?.move,
          thirdEquity: result.moves[2]?.equity,
          asciiBoard: renderOpeningBoard(dice)
        }
      })

      populated++
    } catch (error) {
      errors.push(`Error processing ${dice}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { populated, errors }
}
```

### 3.2 ASCII Board Renderer

```typescript
// lib/positionLibrary/asciiRenderer.ts

/**
 * Render the standard opening position as ASCII art.
 * The opening position is always the same board; only the dice vary.
 */
export function renderOpeningBoard(diceRoll: string): string {
  // Standard backgammon starting position
  // X = White (player to move), O = Black (opponent)
  // Points numbered from White's perspective (1 = White's home, 24 = Black's home)

  return `
┌─13─14─15─16─17─18─┬BAR┬─19─20─21─22─23─24─┐
│  O           O    │   │  O              X │
│  O           O    │   │  O              X │
│  O           O    │   │  O                │
│  O                │   │  O                │
│  O                │   │  O                │
│                   │   │                   │
│  X                │   │  X                │
│  X                │   │  X                │
│  X           X    │   │  X                │
│  X           X    │   │  X              O │
│  X           X    │   │  X              O │
└─12─11─10──9──8──7─┴───┴──6──5──4──3──2──1─┘

         Dice: ${diceRoll}    White (X) to move
`.trim()
}

/**
 * Render any arbitrary position (for Phase 2).
 * Parses GNUBG Position ID and renders the board state.
 */
export function renderAsciiBoard(positionId: string, diceRoll: string): string {
  // For MVP, only opening positions are supported
  if (positionId === 'opening' || positionId.startsWith('opening-')) {
    return renderOpeningBoard(diceRoll)
  }

  // Phase 2: Parse Position ID and render arbitrary position
  // See 04-phase2-extended-game-phases.md for implementation
  throw new Error(`Non-opening positions not yet supported: ${positionId}`)
}
```

---

## 4. Position Seeding Step

### 4.1 New Inngest Step

Insert before drill generation in `lib/inngest-functions.ts`:

```typescript
// In drillSeriesGenerationJob

// NEW STEP: Seed positions from library
const seededPositions = await step.run('seed-positions', async () => {
  // Check if ground truth is enabled
  const gtConfig = await resolveGroundTruthConfig(projectId)

  if (!gtConfig?.enabled) {
    console.log('[DrillSeries] Ground truth not enabled, skipping position seeding')
    return null
  }

  // Update progress
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: { progressStage: 'SEEDING_POSITIONS' }
  })

  // Fetch all opening positions
  const openingPositions = await seedOpeningPositions(gtConfig.engineId)

  if (openingPositions.length === 0) {
    console.warn('[DrillSeries] No opening positions found, falling back to non-seeded generation')
    return null
  }

  console.log(`[DrillSeries] Seeded ${openingPositions.length} opening positions`)

  return {
    OPENING: openingPositions,
    EARLY: [],   // Phase 2
    MIDDLE: [],  // Phase 2
    BEAROFF: []  // Phase 2
  }
})
```

### 4.2 Position Seeder Function

```typescript
// lib/positionLibrary/seeder.ts

export interface SeededPosition {
  positionId: string
  diceRoll: string
  bestMove: string
  bestMoveEquity: number
  alternatives: Array<{ move: string; equity: number }>
  asciiBoard: string
}

export async function seedOpeningPositions(
  engineId: string
): Promise<SeededPosition[]> {
  // Fetch all opening positions for this engine
  const positions = await prisma.positionLibrary.findMany({
    where: {
      engineId,
      gamePhase: 'OPENING'
    },
    orderBy: { diceRoll: 'asc' }
  })

  return positions.map(p => ({
    positionId: p.positionId,
    diceRoll: p.diceRoll,
    bestMove: p.bestMove,
    bestMoveEquity: p.bestMoveEquity,
    alternatives: [
      p.secondBestMove && { move: p.secondBestMove, equity: p.secondEquity! },
      p.thirdBestMove && { move: p.thirdBestMove, equity: p.thirdEquity! }
    ].filter((a): a is { move: string; equity: number } => Boolean(a))
  , asciiBoard: p.asciiBoard
  }))
}
```

---

## 5. Drill Prompt Modification

### 5.1 Updated Drill Designer Prompt

```typescript
// lib/guruFunctions/prompts/drillDesignerPrompt.ts

export function buildDrillDesignerPrompt(params: DrillDesignerPromptParams): string {
  const {
    domain,
    corpusSummary,
    mentalModel,
    curriculum,
    userNotes,
    seededPositions  // NEW
  } = params

  // ... existing methodology index ...

  // NEW: Seeded positions section
  const positionsSection = seededPositions?.OPENING?.length ? `
---

## REQUIRED POSITIONS - OPENING ROLLS

**CRITICAL: You MUST create drills using these pre-verified opening positions.**

These are the 21 possible first rolls in backgammon, with engine-verified best moves. Create a drill for each opening roll.

${seededPositions.OPENING.map((p, i) => `
### Opening ${i + 1}: Dice ${p.diceRoll}

\`\`\`
${p.asciiBoard}
\`\`\`

- **Best move:** ${p.bestMove} (Equity: ${p.bestMoveEquity.toFixed(3)})
- **Alternatives:** ${p.alternatives.map(a => `${a.move} (${a.equity.toFixed(3)})`).join(', ') || 'None close'}
`).join('\n')}

**Instructions for using these positions:**
1. Each drill scenario.setup MUST describe this opening position
2. The asciiWireframe MUST use the provided ASCII board
3. The correct answer MUST match the bestMove
4. Use the alternative moves as plausible wrong options
5. Reference the dice roll in the question (e.g., "You rolled ${seededPositions.OPENING[0]?.diceRoll}")

---
` : ''

  return `
# TASK: Design Practice Drills for ${domain}
${positionsSection}
... rest of prompt ...
`
}
```

### 5.2 Drill Generation with Seeded Positions

```typescript
// lib/guruFunctions/generators/drillDesigner.ts

export async function generateDrillSeries(
  options: DrillDesignerOptions
): Promise<GenerationResult<DrillSeriesOutput>> {
  const {
    projectId,
    seededPositions,  // NEW
    // ... other options
  } = options

  // If positions are seeded, use them in the prompt
  const userPrompt = buildDrillDesignerPrompt({
    domain,
    corpusSummary,
    mentalModel,
    curriculum,
    userNotes,
    seededPositions  // Pass to prompt builder
  })

  // Rest of generation logic...
  // The prompt now includes the seeded positions as requirements
}
```

---

## 6. Drill Schema Updates

### 6.1 Extended Drill Schema

```typescript
// lib/guruFunctions/schemas/drillSeriesSchema.ts

export const drillSchema = z.object({
  drillId: z.string(),
  tier: z.enum(['RECOGNITION', 'APPLICATION', 'TRANSFER']),
  methodology: z.string().nullable().optional(),

  // NEW: Position reference
  positionId: z.string().nullable().optional(),  // e.g., "opening-3-1"
  gamePhase: z.enum(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF']).nullable().optional(),

  scenario: drillScenarioSchema,
  options: z.array(drillOptionSchema),
  correctAnswer: z.string(),
  feedback: drillFeedbackSchema,
  asciiWireframe: z.string().nullable().optional(),
  metadata: drillMetadataSchema,
})
```

---

## 7. Error Handling

### 7.1 Position Population Failures

```typescript
// If engine unavailable during population
if (!engineHealthy) {
  console.error('[PositionLibrary] Engine unavailable, cannot populate positions')
  return { populated: 0, errors: ['Engine unavailable'] }
}

// If individual roll fails, continue with others
for (const dice of OPENING_ROLLS) {
  try {
    await populatePosition(dice)
  } catch (error) {
    errors.push(`${dice}: ${error.message}`)
    // Continue to next roll
  }
}
```

### 7.2 Drill Generation Fallbacks

```typescript
// In drillSeriesGenerationJob

const seededPositions = await step.run('seed-positions', async () => {
  try {
    const positions = await seedOpeningPositions(gtConfig.engineId)
    return positions.length > 0 ? { OPENING: positions } : null
  } catch (error) {
    console.warn('[DrillSeries] Position seeding failed, falling back to non-seeded', error)
    return null
  }
})

// If no seeded positions, generate drills the old way (GPT invents positions)
if (!seededPositions) {
  console.log('[DrillSeries] No seeded positions, using standard generation')
  // Continue with existing generation logic
}
```

### 7.3 Partial Position Coverage

```typescript
// If some positions are missing, generate what we can
if (openingPositions.length < 21) {
  console.warn(`[DrillSeries] Only ${openingPositions.length}/21 opening positions available`)
  // Continue with partial coverage - better than nothing
}
```

---

## 8. Artifact Info Modal

### 8.1 Component Design

```typescript
// components/artifacts/ArtifactInfoModal.tsx

interface ArtifactInfoModalProps {
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'
  isOpen: boolean
  onClose: () => void
}

export function ArtifactInfoModal({ artifactType, isOpen, onClose }: ArtifactInfoModalProps) {
  const info = ARTIFACT_CREATION_INFO[artifactType]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {info.icon}
            How {info.title} is Created
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overview */}
          <section>
            <h3 className="font-semibold text-lg mb-2">What is this?</h3>
            <p className="text-muted-foreground">{info.overview}</p>
          </section>

          {/* Step-by-step process */}
          <section>
            <h3 className="font-semibold text-lg mb-3">Creation Process</h3>
            <ol className="space-y-4">
              {info.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* What influences the output */}
          <section>
            <h3 className="font-semibold text-lg mb-3">What Affects the Output?</h3>
            <div className="grid gap-3">
              {info.influences.map((influence, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <influence.icon className="w-5 h-5 mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium">{influence.name}</p>
                    <p className="text-sm text-muted-foreground">{influence.description}</p>
                    <p className="text-sm text-primary mt-1">→ {influence.whereToChange}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### 8.2 Artifact Info Content

```typescript
// lib/teaching/artifactInfoContent.ts

import { Brain, BookOpen, Target, FileText, Settings, MessageSquare, User, CheckCircle, Layout } from 'lucide-react'

export const ARTIFACT_CREATION_INFO = {
  MENTAL_MODEL: {
    icon: Brain,
    title: 'Mental Model',
    overview: 'The Mental Model is the foundation of your guru. It extracts the core principles and concepts from your knowledge corpus that learners need to master.',
    steps: [
      {
        title: 'Corpus Composition',
        description: 'All your context layers and knowledge files are combined into a single knowledge base.'
      },
      {
        title: 'Structure Analysis',
        description: 'AI analyzes the corpus to identify major themes, categories, and relationships.'
      },
      {
        title: 'Principle Extraction',
        description: 'Core principles are extracted - each with its essence, why it matters, common mistakes, and recognition patterns.'
      },
      {
        title: 'Framework Building',
        description: 'Principles are organized into a teachable framework with connections between related concepts.'
      }
    ],
    influences: [
      {
        icon: FileText,
        name: 'Your Corpus',
        description: 'The content in your context layers and knowledge files directly determines what principles are extracted.',
        whereToChange: 'Add or edit content in the Corpus tab'
      },
      {
        icon: Settings,
        name: 'System Prompt',
        description: "Controls the AI's teaching persona and approach to organizing knowledge.",
        whereToChange: 'Edit in Prompt Settings (View/Edit Prompts button)'
      },
      {
        icon: MessageSquare,
        name: 'User Notes',
        description: 'Your guidance when generating (e.g., "focus on beginner concepts") influences what\'s emphasized.',
        whereToChange: 'Add notes when clicking Generate'
      },
      {
        icon: User,
        name: 'Guru Profile',
        description: "If set, the guru's teaching style and target audience are considered.",
        whereToChange: 'Edit in Guru Profile settings'
      }
    ]
  },

  CURRICULUM: {
    icon: BookOpen,
    title: 'Curriculum',
    overview: 'The Curriculum creates a structured learning path based on your Mental Model. It organizes principles into modules with lessons that build on each other.',
    steps: [
      {
        title: 'Load Mental Model',
        description: "The curriculum is built on top of your Mental Model's principles and framework."
      },
      {
        title: 'Path Design',
        description: 'AI designs a progression from foundational to advanced concepts, ensuring prerequisites come first.'
      },
      {
        title: 'Module Structure',
        description: 'Principles are grouped into modules. Each module contains lessons of four types: Concept, Example, Exercise, and Assessment.'
      },
      {
        title: 'Content Verification',
        description: 'If enabled, claims in the curriculum are verified against the ground truth engine for accuracy.'
      }
    ],
    influences: [
      {
        icon: Brain,
        name: 'Mental Model',
        description: "The principles and structure from your Mental Model directly shape what's taught.",
        whereToChange: 'Regenerate the Mental Model or adjust your corpus'
      },
      {
        icon: Settings,
        name: 'System & User Prompts',
        description: 'Control how lessons are structured and what teaching approaches are used.',
        whereToChange: 'Edit in Prompt Settings'
      },
      {
        icon: CheckCircle,
        name: 'Ground Truth Engine',
        description: 'When enabled, factual claims are verified for accuracy.',
        whereToChange: 'Configure in Ground Truth settings'
      }
    ]
  },

  DRILL_SERIES: {
    icon: Target,
    title: 'Drill Series',
    overview: 'Drills are scenario-based practice exercises. Each drill presents a real game situation and asks the learner to apply the principles they\'ve learned.',
    steps: [
      {
        title: 'Load Prerequisites',
        description: 'Both the Mental Model (for principles) and Curriculum (for structure) are loaded.'
      },
      {
        title: 'Position Seeding',
        description: 'Real game positions are fetched from the backgammon engine. Currently includes all 21 opening rolls.'
      },
      {
        title: 'Drill Design',
        description: 'AI creates drills around the seeded positions, using various teaching methodologies (case analysis, error detection, etc.).'
      },
      {
        title: 'Answer Verification',
        description: "Each drill's correct answer is verified against the engine to ensure accuracy."
      },
      {
        title: 'Feedback Generation',
        description: 'Helpful feedback is generated for both correct and incorrect answers, reinforcing the underlying principles.'
      }
    ],
    influences: [
      {
        icon: Layout,
        name: 'Position Library',
        description: 'The game positions used come from the engine. Different positions teach different concepts.',
        whereToChange: 'Positions are auto-populated from the backgammon engine'
      },
      {
        icon: Brain,
        name: 'Mental Model Principles',
        description: 'Drills are designed to reinforce specific principles from your Mental Model.',
        whereToChange: 'Regenerate Mental Model to change which principles are taught'
      },
      {
        icon: BookOpen,
        name: 'Curriculum Structure',
        description: 'The curriculum determines how drills progress in difficulty.',
        whereToChange: 'Regenerate Curriculum to change drill progression'
      },
      {
        icon: Settings,
        name: 'Drill Prompt',
        description: 'Controls drill format, methodology mix, and pedagogical approach.',
        whereToChange: 'Edit in Prompt Settings'
      }
    ]
  }
}
```

### 8.3 Integration with Artifact Tiles

```typescript
// In components/guru/GuruTeachingManager.tsx

import { Info } from 'lucide-react'
import { ArtifactInfoModal } from '@/components/artifacts/ArtifactInfoModal'

// In the ArtifactCard component, add to the header:
const [infoModalOpen, setInfoModalOpen] = useState(false)

// In the card header JSX:
<div className="flex items-center justify-between">
  <h3 className="font-semibold">{getArtifactTitle(artifact.type)}</h3>
  <Button
    variant="ghost"
    size="icon"
    onClick={(e) => {
      e.stopPropagation()
      setInfoModalOpen(true)
    }}
    className="h-6 w-6 opacity-60 hover:opacity-100"
    title="How this is created"
  >
    <Info className="h-4 w-4" />
  </Button>
</div>

<ArtifactInfoModal
  artifactType={artifact.type}
  isOpen={infoModalOpen}
  onClose={() => setInfoModalOpen(false)}
/>
```

---

## 9. API Endpoints

### 9.1 Position Library Management

```typescript
// POST /api/position-library/populate
// Trigger opening position population from engine
interface PopulateRequest {
  engineId: string
}

interface PopulateResponse {
  success: boolean
  populated: number
  errors: string[]
}

// GET /api/position-library
// List positions
interface ListPositionsQuery {
  engineId: string
  gamePhase?: GamePhase
}
```

---

## 10. Database Migration

```sql
-- Add PositionLibrary table
CREATE TABLE "PositionLibrary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "positionId" TEXT NOT NULL UNIQUE,
  "gamePhase" TEXT NOT NULL,
  "diceRoll" TEXT NOT NULL,
  "bestMove" TEXT NOT NULL,
  "bestMoveEquity" DOUBLE PRECISION NOT NULL,
  "secondBestMove" TEXT,
  "secondEquity" DOUBLE PRECISION,
  "thirdBestMove" TEXT,
  "thirdEquity" DOUBLE PRECISION,
  "asciiBoard" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "engineId" TEXT NOT NULL,
  CONSTRAINT "PositionLibrary_engineId_fkey"
    FOREIGN KEY ("engineId") REFERENCES "GroundTruthEngine"("id")
);

CREATE INDEX "PositionLibrary_gamePhase_idx" ON "PositionLibrary"("gamePhase");
CREATE INDEX "PositionLibrary_engineId_gamePhase_idx" ON "PositionLibrary"("engineId", "gamePhase");

-- Add to GuruArtifact
ALTER TABLE "GuruArtifact" ADD COLUMN "positionsUsed" TEXT[];
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

- `renderOpeningBoard()` produces valid ASCII output
- `populateOpeningPositions()` handles engine errors gracefully
- `seedOpeningPositions()` returns all available positions

### 11.2 Integration Tests

- End-to-end position population from GNUBG
- Drill generation with seeded positions includes position references
- Fallback to non-seeded generation when positions unavailable

### 11.3 E2E Tests

- Generate drill series with ground truth enabled
- Verify all 21 opening rolls have drills
- Info modal opens and displays correct content for each artifact type

---

## 12. Success Metrics

1. **All 21 opening rolls populated** - Complete opening position coverage
2. **Drills reference seeded positions** - No invented opening scenarios
3. **Correct answers match engine** - bestMove used as correct answer
4. **Info modal is helpful** - Users understand how artifacts are created
5. **Graceful degradation** - Falls back cleanly if engine unavailable

---

## 13. Future Work (Phase 2)

See `04-phase2-extended-game-phases.md` for:
- Early game positions (moves 2-6)
- Mid-game positions (contact positions)
- Bearoff positions (race/endgame)
- Self-play position generation
- Usage tracking and variety
- Principle-based position selection
