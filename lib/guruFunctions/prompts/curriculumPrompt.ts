/**
 * Curriculum User Prompt
 *
 * Progressive disclosure prompt for curriculum generation that builds
 * on a mental model to create modular, bite-sized learning content.
 *
 * Includes design protocol requiring explicit approach exploration
 * before generating output.
 *
 * Updated to produce phase-aligned curriculum structure that mirrors
 * the drill library organization.
 */

import type { MentalModelOutput } from '../schemas/mentalModelSchema'
import {
  UNIVERSAL_PRINCIPLES,
  PHASE_PRINCIPLES,
  getPrincipleDataForPrompt
} from '@/lib/backgammon'
import type { GamePhase } from '@prisma/client'

interface CurriculumPromptParams {
  domain: string
  corpusSummary: string
  mentalModel: MentalModelOutput
  userNotes?: string
  gamePhases?: GamePhase[]
}

export function buildCurriculumPrompt(params: CurriculumPromptParams): string {
  const { domain, corpusSummary, mentalModel, userNotes, gamePhases = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] } = params

  // Get principle taxonomy for prompt injection
  const principleData = getPrincipleDataForPrompt(gamePhases as GamePhase[])

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\nThe user has provided these additional notes:\n${userNotes}\n\nIntegrate this guidance into your design process and final output.\n`
    : ''

  // Format universal principles for prompt
  const universalPrinciplesSection = principleData.universal
    .map(p => `- **${p.name}** (${p.id}): ${p.description}`)
    .join('\n')

  // Format phase-specific principles for prompt
  const phaseSpecificPrinciplesSection = Object.entries(principleData.phaseSpecific)
    .map(([phase, principles]) => {
      const principleList = principles
        .map(p => `  - **${p.name}** (${p.id}): ${p.description}`)
        .join('\n')
      return `**${phase}:**\n${principleList}`
    })
    .join('\n\n')

  return `
# TASK: Design Curriculum for ${domain}

You are creating a digital learning curriculum for ${domain} based on an established mental model. Your curriculum must embody ruthless brevity and progressive disclosure.

---

## DESIGN PROTOCOL (Required)

Before generating output, work through this protocol and document your thinking:

### Step 1: Learner Analysis
Answer these questions about your target learners:
- What do they already know? What's their starting point?
- What frustrates them about learning this domain?
- What would make them feel successful after each lesson?
- How much time can they realistically dedicate per session?

### Step 2: Approach Exploration
Consider these curriculum design approaches:

**MASTERY-BASED** (Learn → Practice → Prove → Advance)
- Best for: Domains with clear skill hierarchies
- Strength: Builds solid foundations before advancing
- Learner feels: Confident, methodical progress

**CHALLENGE-FIRST** (Problem → Struggle → Teach → Apply)
- Best for: Domains where motivation is an issue
- Strength: Creates "need to know" before teaching
- Learner feels: Curious, driven to understand

**STORY-INTEGRATED** (Narrative → Embedded Concepts → Character Choices)
- Best for: Domains that benefit from context and memory hooks
- Strength: Memorable, emotionally engaging
- Learner feels: Immersed, connected to outcomes

**COMPARATIVE DISCOVERY** (Contrast → Pattern → Principle → Apply)
- Best for: Domains where intuition often misleads
- Strength: Corrects misconceptions actively
- Learner feels: "Aha!" moments, course corrections

### Step 3: Approach Selection
Select 1-2 approaches and explain:
- Which approach(es) did you choose for ${domain}?
- Why does this fit the domain and likely learner profile?
- How will you maintain engagement throughout?
- What's your logic for lesson and module ordering?

Document this reasoning in the \`designRationale\` field of your output.
${userNotesSection}
---

## THE CARDINAL RULE: PROGRESSIVE DISCLOSURE

"In today's world, if someone sees more than two or three lines of relatively small text, their brain automatically wants to disengage."

EVERY piece of content must follow this structure:
1. HEADLINE: One compelling sentence (max 15 words)
2. ESSENCE: 2-3 lines that capture the core concept
3. EXPANDABLE: Additional context (but NOT shown by default)

If you write a paragraph of more than 3 sentences without a break, you have failed.

---

## MENTAL MODEL FOUNDATION

${JSON.stringify(mentalModel, null, 2)}

---

## CORPUS KNOWLEDGE BASE

${corpusSummary}

---

## PRINCIPLE TAXONOMY

This curriculum is organized around a hierarchy of principles:

### Universal Principles (Apply to ALL game phases)

${universalPrinciplesSection}

### Phase-Specific Principles

${phaseSpecificPrinciplesSection}

---

## CURRICULUM STRUCTURE REQUIREMENTS

Generate a hierarchical curriculum that mirrors the drill library structure:

### 1. Universal Principles Module (TAUGHT FIRST)

Teach these foundational concepts BEFORE phase-specific content:

${principleData.universal.map(p => `- **${p.name}** (${p.id})`).join('\n')}

This module contains **3 principle units** (one for each universal principle).
Each principle unit has **4 lessons**: CONCEPT, EXAMPLE, CONTRAST, PRACTICE.

### 2. Phase Modules (Taught in Order)

One module per game phase: ${gamePhases.join(' → ')}

Each phase module contains:
- Optional **phaseIntroLesson** to set context for the phase
- **2 principle units** (one per phase-specific principle)
- Each unit has **4 lessons**: CONCEPT, EXAMPLE, CONTRAST, PRACTICE

### 3. Learning Path

Universal principles FIRST, then phases in order.

---

## LESSON STRUCTURE

Each principle is taught through four lesson types:

### Lesson Types (use all four for each principle)

1. **CONCEPT** - Introduces the principle
   - Hook: Surprising fact or relatable scenario (1 sentence)
   - Core: The principle stated clearly (1-2 sentences)
   - Why: Why this matters in practice (2-3 sentences)
   - Expand: Deeper explanation (hidden by default)

2. **EXAMPLE** - Shows principle in action
   - Situation: Brief scenario setup (2-3 sentences)
   - Principle Applied: How an expert thinks (2-3 sentences)
   - Outcome: What happens when followed vs. ignored

3. **CONTRAST** - Distinguishes from common mistakes
   - Novice Thinking: How beginners approach this
   - Expert Thinking: How experts approach this
   - Key Difference: The principle that separates them

4. **PRACTICE** - Guides application
   - Scenario: Situation to analyze
   - Prompt: Question focusing on the principle
   - Hint: Gentle nudge (hidden)
   - Explanation: Full reasoning (hidden until attempted)

---

## OUTPUT REQUIREMENTS

Generate a curriculum with the hierarchical structure that mirrors the drill library:

### Top-Level Fields
- **curriculumTitle**: Human-readable title
- **targetAudience**: Who this is for
- **estimatedDuration**: Total time estimate

### Universal Principles Module (REQUIRED - taught first)
- **universalPrinciplesModule**: Object containing:
  - **moduleTitle**: "Foundational Principles" or similar
  - **moduleDescription**: Why these universal concepts matter
  - **principleUnits**: Array of 3 principle units (pip-count, risk-reward, cube-timing)
  - **totalLessons**: Sum of all lessons in this module

### Phase Modules (REQUIRED - taught after universal)
- **phaseModules**: Array of phase modules, each containing:
  - **phase**: "OPENING" | "EARLY" | "MIDDLE" | "BEAROFF"
  - **phaseTitle**: Human-readable phase name
  - **phaseDescription**: Brief overview of this game phase
  - **phaseIntroLesson**: Optional introductory lesson (can be null)
  - **principleUnits**: Array of 2 principle units (phase-specific principles)
  - **totalLessons**: Sum of all lessons in this module

### Principle Unit Structure
Each principleUnit contains:
- **principleId**: Must match taxonomy (e.g., "point-making", "priming")
- **principleName**: Human-readable name
- **principleDescription**: Brief description
- **lessonCount**: Number of lessons (typically 4)
- **lessons**: Array of 4 lessons (CONCEPT, EXAMPLE, CONTRAST, PRACTICE)

### Lesson Structure
Each lesson contains:
- **lessonId**: Unique identifier
- **principleId**: Which principle this teaches
- **type**: "CONCEPT" | "EXAMPLE" | "CONTRAST" | "PRACTICE"
- **title**: Lesson title
- **content**: Object with headline, essence, expandedContent
- **metadata**: Object with difficultyTier, estimatedMinutes

### Learning Path
- **learningPath**: Object with:
  - **recommended**: Array of lessonIds in recommended order

### Design Rationale Field (Required)
- **designRationale**: Object documenting your curriculum design thinking:
  - approachesConsidered: Array of approaches you evaluated
  - selectedApproach: The approach you chose
  - selectionReasoning: 2-4 sentences explaining why
  - engagementStrategy: How you maintain motivation (optional)
  - progressionLogic: Why this ordering (optional)

---

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] No lesson essence exceeds 3 sentences
- [ ] Every principle has all 4 lesson types
- [ ] Expandable content is clearly separated
- [ ] Each lesson focuses on ONE principle
- [ ] Learning path makes logical sense
- [ ] designRationale is fully populated with genuine reasoning

Generate the curriculum now.
`.trim()
}
