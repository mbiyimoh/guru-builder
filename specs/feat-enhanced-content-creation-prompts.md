# Enhanced Teaching Content Creation Prompts

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-08
**Related:** [docs/ideation/enhance-content-creation-prompts.md](../docs/ideation/enhance-content-creation-prompts.md)

---

## Overview

Transform the teaching content creation system from functional but generic prompts into a rich, protocol-based system that produces thoughtful, creative, and pedagogically sound content. This includes a shared creative system prompt establishing an innovative instructional designer persona, protocol-based user prompts requiring explicit approach exploration, and schema additions to capture AI reasoning for transparency.

## Background/Problem Statement

### Current State

The existing teaching content generators (mental model, curriculum, drills) work but produce inconsistent quality because:

1. **Generic System Prompts:** Current system messages like "You are an expert instructional designer" lack creative philosophy and don't inspire innovative design thinking

2. **No Exploration Protocol:** Prompts jump straight to "generate now" without requiring consideration of multiple approaches

3. **No Reasoning Transparency:** Users see the output but have no insight into why the AI chose a particular structure or methodology

4. **Formulaic Drill Design:** The three-tier difficulty system (Recognition/Application/Transfer) is good but the prompt lacks a methodology index, resulting in repetitive drill patterns

5. **Unused User Notes:** Infrastructure for user guidance exists but the UI doesn't expose it

### Impact

- Teaching content quality varies unpredictably
- Users can't understand or guide the AI's design choices
- Drill series lack diversity in exercise types
- Missed opportunities for innovative, memorable learning experiences

## Goals

- Create a shared creative system prompt that establishes a brilliant instructional designer persona with cognitive science mastery
- Add protocol-based user prompts for all 3 content types requiring explicit exploration of 2-3 approaches before selection
- Embed a comprehensive drill methodology index in the drill prompt covering Memory/Recall, Application, Transfer, and Engagement patterns
- Add `designRationale` schema field to mental model and `designThoughts` to drill series for capturing AI reasoning
- Display rationale section at the top of artifact views so users always see the reasoning
- Add user notes textbox to generation cards for optional guidance
- Maintain backward compatibility with existing artifacts

## Non-Goals

- Per-project prompt customization (deferred to Phase 2 spec)
- Prompt editor UI (deferred to Phase 2 spec)
- Quality metrics tracking
- Changes to Inngest job orchestration
- Performance optimization
- Changes to curriculum schema (no new reasoning fields)

## Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| OpenAI API | GPT-4o | Structured output generation |
| Zod | ^3.x | Schema validation |
| Prisma | ^5.x | Database ORM |
| React | 19.x | UI components |

**Critical Constraint:** OpenAI strict mode requires all optional schema fields to use `.nullable().optional()` pattern.

---

## Detailed Design

### 1. Shared Creative System Prompt

Create a new file establishing the creative instructional designer persona used by all three generators.

**File:** `lib/guruFunctions/prompts/creativeSystemPrompt.ts`

```typescript
/**
 * Shared Creative System Prompt
 *
 * Establishes an innovative instructional designer persona with cognitive science
 * mastery, used by all teaching content generators.
 */

export const CREATIVE_TEACHING_SYSTEM_PROMPT = `You are an innovative instructional designer and learning architect with deep mastery of:

**COGNITIVE SCIENCE FOUNDATIONS**
- Schema theory: How experts organize knowledge into retrievable mental structures
- Cognitive load theory: Managing intrinsic, extraneous, and germane load
- Transfer of learning: Near transfer, far transfer, and analogical reasoning
- Deliberate practice: Purposeful, structured practice with immediate feedback
- Spaced repetition and interleaving: Optimal practice scheduling

**CREATIVE PEDAGOGY**
- Narrative and story-based learning: Embedding concepts in memorable contexts
- Game mechanics: Progression, challenge calibration, achievement, and feedback loops
- Experiential learning: Kolb's cycle of concrete experience → reflection → abstraction → experimentation
- Problem-based learning: Authentic challenges that require principle application
- Socratic method: Questions that guide discovery rather than direct instruction

**EXPERT TEACHING CRAFT**
- Progressive disclosure: Revealing complexity gradually to prevent overwhelm
- Scaffolding and fading: Temporary support that's systematically removed
- Worked examples and self-explanation: Learning from solved problems
- Contrast cases: Highlighting what something IS by showing what it ISN'T
- Mental model building: Creating accurate, transferable conceptual frameworks

**YOUR DESIGN PHILOSOPHY**

1. MEMORABLE over comprehensive
   → What will stick in long-term memory?
   → Sacrifice breadth for depth of understanding

2. TRANSFERABLE over contextual
   → What applies across varied situations?
   → Build principles, not procedures

3. ENGAGING over efficient
   → What sparks curiosity and maintains attention?
   → A learner who's engaged learns more than one who's bored but "covered"

4. PRINCIPLED over procedural
   → What builds genuine understanding?
   → Teach the WHY, not just the WHAT

**YOUR DESIGN PROCESS**

Before creating ANY teaching content, you MUST:
1. Consider 2-3 different design approaches for the task
2. Evaluate each approach against domain characteristics and learner needs
3. Select the most fitting approach with explicit reasoning
4. Document your design rationale in the designated output field

You never default to the obvious approach. You never take the path of least resistance.
You seek the approach that will make learning STICK—memorable, transferable, and transformative.

When in doubt, ask yourself: "If a master teacher had unlimited time to prepare this lesson, what creative approach would they take?"
`.trim()
```

### 2. Enhanced Mental Model Prompt

Update the mental model prompt to include a design protocol requiring approach exploration.

**File:** `lib/guruFunctions/prompts/mentalModelPrompt.ts`

**Changes:**

```typescript
interface MentalModelPromptParams {
  domain: string
  corpusSummary: string
  corpusWordCount: number
  userNotes?: string
}

export function buildMentalModelPrompt(params: MentalModelPromptParams): string {
  const { domain, corpusSummary, corpusWordCount, userNotes } = params

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\nThe user has provided these additional notes:\n${userNotes}\n\nIntegrate this guidance into your design process and final output.\n`
    : ''

  return `
# TASK: Design Mental Model for ${domain}

You are designing the foundational mental model that will guide all teaching of ${domain}. This mental model must transform novices who see surface features into principle-driven thinkers who recognize deep structure.

---

## DESIGN PROTOCOL (Required)

Before generating output, work through this protocol and document your thinking:

### Step 1: Domain Analysis
Answer these questions about ${domain}:
- What makes this domain challenging to learn? What trips up novices?
- What do experts know that novices don't? What's the "expert blind spot"?
- What mental models do experts unconsciously use when making decisions?
- What common misconceptions must be explicitly addressed?

### Step 2: Approach Exploration
Consider these structuring approaches for the mental model:

**HIERARCHICAL** (Core → Supporting → Detail)
- Best for: Domains with clear foundational concepts that enable advanced ones
- Example: Mathematics (arithmetic enables algebra enables calculus)
- Strength: Clear learning progression

**PROCESS-BASED** (Input → Transform → Output)
- Best for: Domains involving decision-making or transformation
- Example: Cooking (ingredients → techniques → dishes)
- Strength: Actionable, procedural clarity

**COMPARATIVE** (What It Is vs. What It Isn't)
- Best for: Domains where misconceptions are common
- Example: Statistics (correlation vs. causation)
- Strength: Prevents common errors

**METAPHORICAL** (Domain → Familiar Concept)
- Best for: Abstract domains that benefit from concrete analogies
- Example: Electricity as water flow
- Strength: Intuitive understanding, transfer

**TENSION-BASED** (Competing Principles to Balance)
- Best for: Domains requiring judgment between trade-offs
- Example: Investment (risk vs. return)
- Strength: Develops expert-like nuanced thinking

### Step 3: Approach Selection
Select 1-2 approaches and explain:
- Which approach(es) did you choose for ${domain}?
- Why does this fit better than alternatives for this specific domain?
- What unique insight does this framing provide learners?
- What are the limitations or trade-offs of this approach?

Document this reasoning in the \`designRationale\` field of your output.
${userNotesSection}
---

## CORPUS KNOWLEDGE BASE

The following content represents the domain knowledge to transform into a mental model:

${corpusSummary}

(Corpus contains approximately ${corpusWordCount} words of domain knowledge)

---

## OUTPUT REQUIREMENTS

Generate a mental model with these fields:

### Required Fields
- **domainTitle**: Human-readable name for this domain of expertise
- **teachingApproach**: 1-2 sentence description of the pedagogical approach
- **categories**: Array of 2-5 categories (NO MORE than 5!), each with:
  - id: Unique identifier (e.g., "category_1")
  - name: Short, memorable category name (2-4 words)
  - description: 2-3 sentences explaining what this covers and why it matters
  - mentalModelMetaphor: Optional analogy to a familiar concept
  - principles: Array of 2-3 principles (NO MORE than 3 per category), each with:
    - id: Unique identifier (e.g., "principle_1_1")
    - name: Short, memorable principle name
    - essence: ONE sentence capturing the core idea (be ruthless!)
    - whyItMatters: Why this principle improves outcomes
    - commonMistake: What novices typically get wrong
    - recognitionPattern: How to recognize when this principle applies
  - orderInLearningPath: Suggested sequence number for learning
- **principleConnections**: Array showing how principles relate across categories
- **masterySummary**: What mastery of this domain looks like (behaviors, not knowledge)

### Design Rationale Field (Required)
- **designRationale**: Object documenting your design thinking:
  - approachesConsidered: Array of approach names you evaluated
  - selectedApproach: The approach(es) you chose
  - selectionReasoning: 2-4 sentences explaining why this approach fits ${domain}
  - tradeoffs: What limitations or trade-offs does this approach have?

---

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] No more than 5 categories total
- [ ] No more than 3 principles per category
- [ ] Each principle essence is ONE sentence
- [ ] Every principle has all 6 required fields populated
- [ ] Principle connections reference actual principle IDs
- [ ] Learning order makes pedagogical sense (foundations first)
- [ ] designRationale is fully populated with genuine reasoning
- [ ] Categories and principles are memorable and distinctive

Generate the mental model now.
`.trim()
}
```

### 3. Enhanced Curriculum Prompt

Update the curriculum prompt with a design protocol.

**File:** `lib/guruFunctions/prompts/curriculumPrompt.ts`

**Changes:**

```typescript
export function buildCurriculumPrompt(params: CurriculumPromptParams): string {
  const { domain, corpusSummary, mentalModel, userNotes } = params

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\n${userNotes}\n`
    : ''

  return `
# TASK: Design Progressive Curriculum for ${domain}

You are creating a digital learning curriculum that transforms the mental model into bite-sized, engaging learning experiences. Your curriculum must embody ruthless brevity and progressive disclosure.

---

## DESIGN PROTOCOL (Required)

### Step 1: Learning Journey Analysis
For this domain and mental model, consider:
- What's the emotional journey from novice to competent?
- Where do learners typically get stuck or discouraged?
- What "aha moments" should we engineer?
- What motivates continued learning in this domain?

### Step 2: Engagement Approach Selection
Consider these curriculum design approaches:

**MASTERY-BASED** (Clear skill progression)
- Best for: Domains with objective skill levels
- Pattern: Level up after demonstrating competence
- Strength: Clear progress, motivating achievements

**CHALLENGE-FIRST** (Problem → Principle)
- Best for: Practical domains where motivation matters
- Pattern: Present challenge, then teach principle to solve it
- Strength: Immediate relevance, "need to know" motivation

**STORY-INTEGRATED** (Narrative context)
- Best for: Domains that benefit from emotional engagement
- Pattern: Learning embedded in unfolding story/scenario
- Strength: Memorable, emotionally engaging

**COMPARATIVE DISCOVERY** (Contrast-based)
- Best for: Domains with subtle distinctions
- Pattern: Show novice vs. expert thinking side-by-side
- Strength: Makes tacit knowledge explicit

### Step 3: Content Density Calibration
Decide how to balance:
- Depth vs. breadth per lesson
- Text vs. interaction
- Explanation vs. discovery

---

## THE CARDINAL RULE: PROGRESSIVE DISCLOSURE

"In today's world, if someone sees more than two or three lines of text, their brain automatically wants to disengage."

EVERY piece of content must follow this structure:
1. **HEADLINE**: One compelling sentence (max 15 words)
2. **ESSENCE**: 2-3 lines capturing the core concept
3. **EXPANDABLE**: Additional context (hidden by default, revealed on demand)

If you write a paragraph of more than 3 sentences without a break, you have failed.
${userNotesSection}
---

## MENTAL MODEL FOUNDATION

Build on this mental model structure:

${JSON.stringify(mentalModel, null, 2)}

---

## CORPUS KNOWLEDGE BASE

${corpusSummary}

---

## CURRICULUM STRUCTURE

Create modules organized by the mental model's categories. Each module teaches ONE category's principles through four lesson types:

### Lesson Types (use all four for each principle)

1. **CONCEPT** - Introduces the principle
   - Hook: Surprising fact or relatable scenario (1 sentence)
   - Core: The principle stated clearly (1-2 sentences)
   - Why: Why this matters in practice (2-3 sentences max)
   - Expand: Deeper explanation (hidden by default)

2. **EXAMPLE** - Shows principle in action
   - Situation: Brief scenario setup (2-3 sentences)
   - Principle Applied: How an expert thinks through this
   - Outcome: What happens when followed vs. ignored

3. **CONTRAST** - Distinguishes from common mistakes
   - Novice Thinking: How beginners approach this
   - Expert Thinking: How experts approach this
   - Key Difference: The principle that separates them

4. **PRACTICE** - Guides application
   - Scenario: Situation to analyze
   - Prompt: Question focusing on the principle
   - Hint: Gentle nudge (hidden by default)
   - Explanation: Full reasoning (hidden until attempted)

---

## OUTPUT REQUIREMENTS

Generate a curriculum with:
- **curriculumTitle**: Human-readable title
- **targetAudience**: Who this is designed for
- **estimatedDuration**: Total time estimate
- **modules**: Array of modules, each with:
  - moduleId, categoryId, title, subtitle
  - learningObjectives: 2-3 objectives (measurable outcomes)
  - prerequisites: Required prior modules
  - lessons: Array of lessons with all 4 types per principle
- **learningPath**: Recommended order of module IDs

### Design Rationale Field (Required)
- **designRationale**: Object documenting your curriculum design thinking:
  - approachesConsidered: Array of curriculum approaches you evaluated (e.g., "Mastery-Based", "Challenge-First")
  - selectedApproach: The approach you chose
  - selectionReasoning: 2-4 sentences explaining why this approach fits this domain and learner needs
  - engagementStrategy: How you maintain learner motivation throughout (optional)
  - progressionLogic: Why lessons and modules are ordered this way (optional)

---

## QUALITY CHECKLIST

- [ ] No lesson essence exceeds 3 sentences
- [ ] Every principle has all 4 lesson types (CONCEPT, EXAMPLE, CONTRAST, PRACTICE)
- [ ] Expandable content is clearly separated
- [ ] Each lesson focuses on ONE principle
- [ ] Headlines are compelling and under 15 words
- [ ] Learning path makes logical sense

Generate the curriculum now.
`.trim()
}
```

### 4. Enhanced Drill Designer Prompt with Methodology Index

Update the drill designer prompt with the comprehensive methodology taxonomy and design protocol.

**File:** `lib/guruFunctions/prompts/drillDesignerPrompt.ts`

**Changes:**

```typescript
export function buildDrillDesignerPrompt(params: DrillDesignerPromptParams): string {
  const { domain, corpusSummary, mentalModel, curriculum, userNotes } = params

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\n${userNotes}\n`
    : ''

  return `
# TASK: Design Deliberate Practice Drills for ${domain}

You are creating practice drills that transform knowledge into skill through deliberate practice. Every drill must target a specific principle and provide immediate, principle-based feedback.

---

## DRILL METHODOLOGY INDEX

You have access to these proven drill methodologies. You MUST use variety—don't default to the same patterns.

### A. MEMORY & RECALL DRILLS (Building Retrieval Strength)

| Methodology | Description | When to Use |
|-------------|-------------|-------------|
| **Recognition** | "Which of these is correct?" Multiple choice identifying the right principle/answer | Early learning, building familiarity |
| **Cued Recall** | Given context, retrieve the principle. "When you see X, what principle applies?" | Connecting triggers to responses |
| **Free Recall** | "List all principles that apply to this situation" | Testing comprehensive understanding |
| **Serial Recall** | "What's the correct sequence?" Order steps or priorities | Procedural knowledge |
| **Discrimination** | "Which is A vs B?" Distinguish between similar concepts | Preventing confusion |

### B. APPLICATION DRILLS (Building Execution Skills)

| Methodology | Description | When to Use |
|-------------|-------------|-------------|
| **Worked Example Analysis** | Study a solved problem, identify principle used | Learning from expert solutions |
| **Faded Scaffolding** | Progressively remove hints/structure | Building independence |
| **Error Detection** | "What's wrong with this approach?" | Developing critical evaluation |
| **Case Analysis** | Apply principles to real-world scenario | Authentic application |
| **Constraint Variation** | Same problem, different constraints | Flexible application |
| **Completion** | Finish partially solved problem | Bridging to full application |

### C. TRANSFER DRILLS (Building Adaptability)

| Methodology | Description | When to Use |
|-------------|-------------|-------------|
| **Analogical Reasoning** | "How does principle X apply in domain Y?" | Far transfer, cross-domain |
| **Novel Problem** | Situation never encountered before | Testing genuine understanding |
| **Principle Synthesis** | Multiple principles must combine | Complex judgment |
| **Context Shift** | Same principle, unfamiliar context | Flexible retrieval |
| **Adversarial** | Designed to trigger common mistakes | Inoculation against errors |

### D. METACOGNITIVE DRILLS (Building Self-Awareness)

| Methodology | Description | When to Use |
|-------------|-------------|-------------|
| **Self-Explanation** | "Explain WHY this works" | Deepening understanding |
| **Prediction** | "What would happen if..." | Testing mental models |
| **Confidence Calibration** | Rate certainty, then verify | Improving self-assessment |
| **Comparison** | "How do approaches A and B differ?" | Nuanced understanding |

### E. ENGAGEMENT PATTERNS (Making Practice Compelling)

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| **Narrative-Embedded** | Drill within a story context | Emotional engagement |
| **Debate/Argue Both Sides** | Defend multiple positions | Perspective-taking |
| **Teach-Back** | Explain to hypothetical novice | Consolidation |
| **Timed Challenge** | Speed pressure | Automaticity |
| **Streak/Chain** | Consecutive correct answers | Motivation |

---

## DESIGN PROTOCOL (Required)

### Step 1: Principle-by-Principle Analysis

For EACH principle in the mental model, analyze:
- What's the most common novice error with this principle?
- What does expert recognition look like in real situations?
- What makes transfer of this principle difficult?
- What misconceptions need to be explicitly addressed?

### Step 2: Methodology Selection

For EACH drill you design, explicitly consider:
- Which methodology best targets the learning gap?
- Why is this methodology more effective than 2-3 alternatives?
- What tier (Recognition/Application/Transfer) is this targeting?

### Step 3: Variety Verification

Ensure your complete drill series includes:
- [ ] At least 4 different methodologies from the index above
- [ ] Mix of recall, application, and transfer tiers
- [ ] At least one metacognitive drill
- [ ] At least one engagement pattern variation
- [ ] No more than 30% of drills using the same methodology

### Step 4: Document Your Reasoning

In the \`designThoughts\` field, explain:
- Your methodology selection rationale
- How you ensured variety
- Any pedagogical trade-offs you made
- What makes this drill series distinctive

---

## THREE-TIER DIFFICULTY SYSTEM

All drills must be tagged with their tier:

### Tier 1: RECOGNITION
- Student identifies the correct principle
- Multiple choice format: "Which principle applies here?"
- Focus: Pattern recognition, building familiarity
- Time: 30-60 seconds

### Tier 2: APPLICATION
- Student applies principle to a scenario
- Situation-based: "What should you do?"
- Focus: Correct execution under guidance
- Time: 1-2 minutes

### Tier 3: TRANSFER
- Student handles novel/complex situations
- Open-ended: "How would you approach..."
- Focus: Adaptation, judgment, synthesis
- Time: 2-5 minutes
${userNotesSection}
---

## MENTAL MODEL FOUNDATION

${JSON.stringify(mentalModel, null, 2)}

---

## CURRICULUM CONTEXT

${JSON.stringify(curriculum, null, 2)}

---

## CORPUS KNOWLEDGE BASE

${corpusSummary}

---

## OUTPUT REQUIREMENTS

Generate a drill series with:

### Core Fields
- **drillSeriesTitle**: Overall title
- **targetPrinciples**: Array of principle IDs covered
- **totalDrills**: Count of all drills
- **estimatedCompletionMinutes**: Total time estimate
- **series**: Array of principle series, each with:
  - seriesId, principleId, principleName
  - seriesDescription: Why this principle needs practice
  - drills: Array of 3+ drills (at least one per tier), each with:
    - drillId
    - tier: RECOGNITION | APPLICATION | TRANSFER
    - methodology: Which methodology from the index (e.g., "Error Detection", "Analogical Reasoning")
    - scenario: { setup, visual (optional), question }
    - options: Array of 3-4 choices with { id, text, isCorrect, commonMistake }
    - correctAnswer: ID of correct option
    - feedback: { correct: {...}, incorrect: {...} }
    - asciiWireframe: Optional visual representation
    - metadata: { estimatedSeconds, prerequisiteDrills, tags }

### Design Thoughts Field (Required)
- **designThoughts**: Object documenting your design thinking:
  - methodologyRationale: Why you chose these specific methodologies
  - varietyAnalysis: How you ensured drill variety (list methodologies used)
  - pedagogicalNotes: Any trade-offs or special considerations
  - distinctiveElements: What makes this drill series unique/effective

### Practice Sequences (Optional)
- **practiceSequences**: Recommended drill orderings for different goals

---

## FEEDBACK REQUIREMENTS

**Correct feedback must include:**
1. brief: One sentence confirmation (positive but not effusive)
2. principleReinforcement: How this demonstrates the principle
3. expanded: Optional deeper explanation

**Incorrect feedback must include:**
1. brief: Non-judgmental redirect
2. principleReminder: The principle they should apply
3. commonMistakeAddress: Why this error is natural/common
4. tryAgainHint: Helpful nudge without revealing answer

---

## QUALITY CHECKLIST

- [ ] Each principle has at least 3 drills (one per tier minimum)
- [ ] At least 4 different methodologies used across the series
- [ ] At least one metacognitive drill
- [ ] At least one engagement pattern variation
- [ ] All feedback references the target principle
- [ ] Options include plausible distractors (not obviously wrong)
- [ ] Difficulty progresses within each principle series
- [ ] designThoughts field is fully populated with genuine reasoning

Generate the drill series now.
`.trim()
}
```

### 5. Schema Additions

#### Mental Model Schema

**File:** `lib/guruFunctions/schemas/mentalModelSchema.ts`

**Add new field:**

```typescript
// Add after existing schema definitions

export const designRationaleSchema = z.object({
  approachesConsidered: z.array(z.string()),
  selectedApproach: z.string(),
  selectionReasoning: z.string(),
  tradeoffs: z.string().nullable().optional(),
}).nullable().optional()

// Update mentalModelSchema to include:
export const mentalModelSchema = z.object({
  domainTitle: z.string(),
  teachingApproach: z.string(),
  categories: z.array(mentalModelCategorySchema),
  principleConnections: z.array(mentalModelConnectionSchema),
  masterySummary: z.string(),
  // NEW FIELD
  designRationale: designRationaleSchema,
})
```

#### Curriculum Schema

**File:** `lib/guruFunctions/schemas/curriculumSchema.ts`

**Add design rationale field:**

```typescript
// Curriculum has its own design rationale - different design questions than mental model
export const curriculumDesignRationaleSchema = z.object({
  approachesConsidered: z.array(z.string()),  // e.g., ["Mastery-Based", "Challenge-First", "Story-Integrated"]
  selectedApproach: z.string(),
  selectionReasoning: z.string(),
  engagementStrategy: z.string().nullable().optional(),  // How engagement is maintained
  progressionLogic: z.string().nullable().optional(),    // Why lessons are ordered this way
}).nullable().optional()

// Update curriculumSchema to include:
export const curriculumSchema = z.object({
  curriculumTitle: z.string(),
  targetAudience: z.string(),
  estimatedDuration: z.string(),
  modules: z.array(moduleSchema),
  learningPath: z.array(z.string()),
  // NEW FIELD
  designRationale: curriculumDesignRationaleSchema,
})
```

#### Prompt Versioning Schema

**File:** `prisma/schema.prisma`

**Add fields to GuruArtifact model to track which prompts were used:**

```prisma
model GuruArtifact {
  // ... existing fields ...

  // NEW: Prompt versioning for tracking what generated this artifact
  systemPromptHash    String?   // Hash of system prompt used
  userPromptHash      String?   // Hash of user prompt template used
  promptConfigId      String?   // Reference to ProjectPromptConfig if custom

  // Existing: corpusHash already tracks corpus state
}
```

**Prompt hash utility:**

```typescript
// lib/guruFunctions/promptHasher.ts
import { createHash } from 'crypto'

export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 12)
}
```

**Usage in generators:**

```typescript
// In Inngest job, after resolving prompts:
const systemPromptHash = hashPrompt(resolvedPrompts.systemPrompt)
const userPromptHash = hashPrompt(userPrompt)

// Store with artifact on completion
await prisma.guruArtifact.update({
  where: { id: artifactId },
  data: {
    // ... existing fields
    systemPromptHash,
    userPromptHash,
    promptConfigId: resolvedPrompts.configId ?? null,
  },
})
```

#### Drill Series Schema

**File:** `lib/guruFunctions/schemas/drillSeriesSchema.ts`

**Add new fields:**

```typescript
// Add methodology field to drill schema
export const drillSchema = z.object({
  drillId: z.string(),
  tier: z.enum(['RECOGNITION', 'APPLICATION', 'TRANSFER']),
  // NEW FIELD
  methodology: z.string().nullable().optional(),
  scenario: drillScenarioSchema,
  options: z.array(drillOptionSchema),
  correctAnswer: z.string(),
  feedback: drillFeedbackSchema,
  asciiWireframe: z.string().nullable().optional(),
  metadata: drillMetadataSchema,
})

// Add design thoughts schema
export const designThoughtsSchema = z.object({
  methodologyRationale: z.string(),
  varietyAnalysis: z.string(),
  pedagogicalNotes: z.string(),
  distinctiveElements: z.string().nullable().optional(),
}).nullable().optional()

// Update drillSeriesSchema to include:
export const drillSeriesSchema = z.object({
  drillSeriesTitle: z.string(),
  targetPrinciples: z.array(z.string()),
  totalDrills: z.number(),
  estimatedCompletionMinutes: z.number(),
  series: z.array(principleSeriesSchema),
  practiceSequences: z.array(practiceSequenceSchema).nullable().optional(),
  // NEW FIELD
  designThoughts: designThoughtsSchema,
})
```

### 6. Generator Updates

Update all three generators to use the shared creative system prompt.

**Mental Model Generator:** `lib/guruFunctions/generators/mentalModelGenerator.ts`

```typescript
import { CREATIVE_TEACHING_SYSTEM_PROMPT } from '../prompts/creativeSystemPrompt'

// In the OpenAI call:
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: CREATIVE_TEACHING_SYSTEM_PROMPT,  // Changed from generic message
    },
    {
      role: 'user',
      content: prompt,
    },
  ],
  // ... rest unchanged
})
```

**Curriculum Generator:** `lib/guruFunctions/generators/curriculumGenerator.ts`

```typescript
import { CREATIVE_TEACHING_SYSTEM_PROMPT } from '../prompts/creativeSystemPrompt'

// Same pattern - use CREATIVE_TEACHING_SYSTEM_PROMPT
```

**Drill Designer:** `lib/guruFunctions/generators/drillDesigner.ts`

```typescript
import { CREATIVE_TEACHING_SYSTEM_PROMPT } from '../prompts/creativeSystemPrompt'

// Same pattern - use CREATIVE_TEACHING_SYSTEM_PROMPT
```

### 7. Markdown Renderer Updates

Update the markdown renderer functions to include design rationale. These functions generate markdown that is:
1. Stored in the database alongside structured content
2. Displayed when users select "Markdown" view mode in the artifact viewer

> **Note:** The "Rendered" view mode uses dedicated React components (see Section 8.3). Both need to display design rationale.

**Mental Model Renderer:** `lib/guruFunctions/generators/mentalModelGenerator.ts`

```typescript
export function renderMentalModelMarkdown(model: MentalModelOutput): string {
  const lines: string[] = []

  lines.push(`# ${model.domainTitle}`)
  lines.push('')

  // NEW: Design Rationale Section at Top
  if (model.designRationale) {
    lines.push('## Design Rationale')
    lines.push('')
    lines.push('> **How This Mental Model Was Designed**')
    lines.push('')
    lines.push(`**Approaches Considered:** ${model.designRationale.approachesConsidered.join(', ')}`)
    lines.push('')
    lines.push(`**Selected Approach:** ${model.designRationale.selectedApproach}`)
    lines.push('')
    lines.push(`**Why This Approach:** ${model.designRationale.selectionReasoning}`)
    lines.push('')
    if (model.designRationale.tradeoffs) {
      lines.push(`**Trade-offs:** ${model.designRationale.tradeoffs}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  lines.push(`**Teaching Approach:** ${model.teachingApproach}`)
  lines.push('')

  // ... rest of existing rendering logic
}
```

**Drill Series Renderer:** `lib/guruFunctions/generators/drillDesigner.ts`

```typescript
export function renderDrillSeriesMarkdown(drillSeries: DrillSeriesOutput): string {
  const lines: string[] = []

  lines.push(`# ${drillSeries.drillSeriesTitle}`)
  lines.push('')

  // NEW: Design Thoughts Section at Top
  if (drillSeries.designThoughts) {
    lines.push('## Design Thoughts')
    lines.push('')
    lines.push('> **How These Drills Were Designed**')
    lines.push('')
    lines.push(`**Methodology Rationale:** ${drillSeries.designThoughts.methodologyRationale}`)
    lines.push('')
    lines.push(`**Variety Analysis:** ${drillSeries.designThoughts.varietyAnalysis}`)
    lines.push('')
    lines.push(`**Pedagogical Notes:** ${drillSeries.designThoughts.pedagogicalNotes}`)
    lines.push('')
    if (drillSeries.designThoughts.distinctiveElements) {
      lines.push(`**What Makes This Series Distinctive:** ${drillSeries.designThoughts.distinctiveElements}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  lines.push(`**Total Drills:** ${drillSeries.totalDrills}`)
  // ... rest of existing rendering logic

  // Also update individual drill rendering to show methodology
  for (const drill of series.drills) {
    // After tier emoji line, add:
    if (drill.methodology) {
      lines.push(`*Methodology: ${drill.methodology}*`)
      lines.push('')
    }
  }
}
```

### 8. UI Updates

#### Add User Notes to Artifact Cards

**File:** `components/guru/GuruTeachingManager.tsx`

**Changes:**

```typescript
// Add state for user notes
const [userNotes, setUserNotes] = useState<Record<string, string>>({
  'mental-model': '',
  'curriculum': '',
  'drill-series': '',
});

// Update handleGenerate to pass userNotes
async function handleGenerate(type: 'mental-model' | 'curriculum' | 'drill-series') {
  setGenerating(type);
  pollingStartTime.current = Date.now();
  try {
    const res = await fetch(`/api/projects/${projectId}/guru/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userNotes: userNotes[type] || undefined  // Pass user notes
      }),
    });
    // ... rest unchanged
  }
}

// Update ArtifactCard props
interface ArtifactCardProps {
  // ... existing props
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
}

// Update ArtifactCard component
function ArtifactCard({
  // ... existing props
  userNotes,
  onUserNotesChange,
}: ArtifactCardProps) {
  // ... existing code

  return (
    <div className={`border rounded-lg p-5 ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
      {/* ... existing header and status code */}

      {/* NEW: User Notes Textarea */}
      {!isInProgress && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Additional guidance (optional)
          </label>
          <textarea
            value={userNotes}
            onChange={(e) => onUserNotesChange(e.target.value)}
            placeholder="E.g., 'Focus on visual learners' or 'Emphasize game-based drills'"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isInProgress}
          />
        </div>
      )}

      {/* ... existing buttons */}
    </div>
  );
}

// In main component, pass notes to each ArtifactCard
<ArtifactCard
  title="Mental Model"
  // ... existing props
  userNotes={userNotes['mental-model']}
  onUserNotesChange={(notes) => setUserNotes(prev => ({ ...prev, 'mental-model': notes }))}
/>
```

### 8.3 Type-Specific Renderer Updates

The Teaching Artifact Viewer uses dedicated React renderers for "Rendered" view mode. These must display design rationale prominently.

> **Architecture Note:** Artifacts are now viewed in full-page viewers at `/projects/[id]/artifacts/teaching/[type]`, not modals. See `docs/implementation-summaries/teaching-artifact-viewer-implementation.md` for details.

**Mental Model Renderer:** `components/artifacts/renderers/MentalModelRenderer.tsx`

Add a design rationale section at the top of the rendered output:

```typescript
export function MentalModelRenderer({ content }: { content: MentalModelOutput }) {
  return (
    <div className="space-y-8">
      {/* NEW: Design Rationale Section */}
      {content.designRationale && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-4">
            Design Rationale
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-amber-800">Approaches Considered:</span>
              <span className="ml-2 text-gray-700">
                {content.designRationale.approachesConsidered.join(', ')}
              </span>
            </div>
            <div>
              <span className="font-medium text-amber-800">Selected Approach:</span>
              <span className="ml-2 text-gray-700">
                {content.designRationale.selectedApproach}
              </span>
            </div>
            <div>
              <span className="font-medium text-amber-800">Why This Approach:</span>
              <p className="mt-1 text-gray-700">
                {content.designRationale.selectionReasoning}
              </p>
            </div>
            {content.designRationale.tradeoffs && (
              <div>
                <span className="font-medium text-amber-800">Trade-offs:</span>
                <p className="mt-1 text-gray-700">
                  {content.designRationale.tradeoffs}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Existing category/principle rendering... */}
      {content.categories.map((category) => (
        // ... existing code
      ))}
    </div>
  )
}
```

**Drill Series Renderer:** `components/artifacts/renderers/DrillSeriesRenderer.tsx`

Add design thoughts section at the top:

```typescript
export function DrillSeriesRenderer({ content }: { content: DrillSeriesOutput }) {
  return (
    <div className="space-y-8">
      {/* NEW: Design Thoughts Section */}
      {content.designThoughts && (
        <section className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-purple-900 mb-4">
            Design Thoughts
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-purple-800">Methodology Rationale:</span>
              <p className="mt-1 text-gray-700">
                {content.designThoughts.methodologyRationale}
              </p>
            </div>
            <div>
              <span className="font-medium text-purple-800">Variety Analysis:</span>
              <p className="mt-1 text-gray-700">
                {content.designThoughts.varietyAnalysis}
              </p>
            </div>
            <div>
              <span className="font-medium text-purple-800">Pedagogical Notes:</span>
              <p className="mt-1 text-gray-700">
                {content.designThoughts.pedagogicalNotes}
              </p>
            </div>
            {content.designThoughts.distinctiveElements && (
              <div>
                <span className="font-medium text-purple-800">Distinctive Elements:</span>
                <p className="mt-1 text-gray-700">
                  {content.designThoughts.distinctiveElements}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Existing drill series rendering... */}
      {content.series.map((series) => (
        // ... existing code
      ))}
    </div>
  )
}
```

**Curriculum Renderer:** `components/artifacts/renderers/CurriculumRenderer.tsx`

Add design rationale section at the top:

```typescript
export function CurriculumRenderer({ content }: { content: CurriculumOutput }) {
  return (
    <div className="space-y-8">
      {/* NEW: Design Rationale Section */}
      {content.designRationale && (
        <section className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-emerald-900 mb-4">
            Design Rationale
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-emerald-800">Approaches Considered:</span>
              <span className="ml-2 text-gray-700">
                {content.designRationale.approachesConsidered.join(', ')}
              </span>
            </div>
            <div>
              <span className="font-medium text-emerald-800">Selected Approach:</span>
              <span className="ml-2 text-gray-700">
                {content.designRationale.selectedApproach}
              </span>
            </div>
            <div>
              <span className="font-medium text-emerald-800">Why This Approach:</span>
              <p className="mt-1 text-gray-700">
                {content.designRationale.selectionReasoning}
              </p>
            </div>
            {content.designRationale.engagementStrategy && (
              <div>
                <span className="font-medium text-emerald-800">Engagement Strategy:</span>
                <p className="mt-1 text-gray-700">
                  {content.designRationale.engagementStrategy}
                </p>
              </div>
            )}
            {content.designRationale.progressionLogic && (
              <div>
                <span className="font-medium text-emerald-800">Progression Logic:</span>
                <p className="mt-1 text-gray-700">
                  {content.designRationale.progressionLogic}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Existing module rendering... */}
      {content.modules.map((module) => (
        // ... existing code
      ))}
    </div>
  )
}
```

**Individual Drill Cards:** Update `components/artifacts/renderers/cards/DrillCard.tsx` to show methodology:

```typescript
// In DrillCard component, add methodology badge
{drill.methodology && (
  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
    {drill.methodology}
  </span>
)}
```

**TOC Integration:** Update TOC generators to include rationale sections:

```typescript
// In generateMentalModelTOC()
export function generateMentalModelTOC(content: MentalModelOutput): TOCItem[] {
  const items: TOCItem[] = []

  // NEW: Add design rationale to TOC if present
  if (content.designRationale) {
    items.push({
      id: 'design-rationale',
      label: 'Design Rationale',
      level: 1,
    })
  }

  // ... existing category/principle TOC generation
}
```

---

## User Experience

### Generation Flow

1. User sees artifact card with optional "Additional guidance" textarea
2. User can type notes like "Focus on narrative-based drills" or leave blank
3. User clicks "Generate" or "Regenerate"
4. Generation proceeds with enhanced prompts
5. On completion, user clicks "View"
6. Modal shows **Design Rationale** section at top (amber-highlighted)
7. Main content follows below the rationale

### Rationale Display

The design rationale appears as the first section after the title:

```
# Backgammon Strategy Mental Model

## Design Rationale

> **How This Mental Model Was Designed**

**Approaches Considered:** Hierarchical, Tension-Based, Process-Based

**Selected Approach:** Tension-Based

**Why This Approach:** Backgammon expertise involves constant balancing of
competing priorities (safety vs. aggression, racing vs. priming). A tension-based
framework mirrors how experts actually think during games.

**Trade-offs:** Less clear learning progression than hierarchical, but better
represents authentic expert decision-making.

---

**Teaching Approach:** Balance competing strategic principles...

## 1. Position Evaluation
...
```

---

## Testing Strategy

### Unit Tests

**File:** `__tests__/guruFunctions/prompts/creativeSystemPrompt.test.ts`

```typescript
describe('CREATIVE_TEACHING_SYSTEM_PROMPT', () => {
  it('should include cognitive science foundations', () => {
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT).toContain('Schema theory')
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT).toContain('Cognitive load theory')
  })

  it('should include design philosophy principles', () => {
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT).toContain('MEMORABLE over comprehensive')
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT).toContain('TRANSFERABLE over contextual')
  })

  it('should require approach exploration', () => {
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT).toContain('Consider 2-3 different design approaches')
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT).toContain('design rationale')
  })
})
```

**File:** `__tests__/guruFunctions/prompts/drillDesignerPrompt.test.ts`

```typescript
describe('buildDrillDesignerPrompt', () => {
  it('should include drill methodology index', () => {
    const prompt = buildDrillDesignerPrompt(mockParams)
    expect(prompt).toContain('DRILL METHODOLOGY INDEX')
    expect(prompt).toContain('Recognition')
    expect(prompt).toContain('Analogical Reasoning')
    expect(prompt).toContain('Narrative-Embedded')
  })

  it('should require variety verification', () => {
    const prompt = buildDrillDesignerPrompt(mockParams)
    expect(prompt).toContain('At least 4 different methodologies')
    expect(prompt).toContain('designThoughts')
  })

  it('should include user notes when provided', () => {
    const prompt = buildDrillDesignerPrompt({ ...mockParams, userNotes: 'Focus on games' })
    expect(prompt).toContain('USER GUIDANCE')
    expect(prompt).toContain('Focus on games')
  })
})
```

### Schema Tests

**File:** `__tests__/guruFunctions/schemas/mentalModelSchema.test.ts`

```typescript
describe('mentalModelSchema with designRationale', () => {
  it('should accept valid design rationale', () => {
    const validModel = {
      ...baseMentalModel,
      designRationale: {
        approachesConsidered: ['Hierarchical', 'Tension-Based'],
        selectedApproach: 'Tension-Based',
        selectionReasoning: 'Best for domains with trade-offs',
        tradeoffs: 'Less clear progression'
      }
    }
    expect(() => mentalModelSchema.parse(validModel)).not.toThrow()
  })

  it('should accept null design rationale for backward compatibility', () => {
    const modelWithoutRationale = { ...baseMentalModel, designRationale: null }
    expect(() => mentalModelSchema.parse(modelWithoutRationale)).not.toThrow()
  })

  it('should accept missing design rationale for backward compatibility', () => {
    const modelWithoutRationale = { ...baseMentalModel }
    // designRationale is optional
    expect(() => mentalModelSchema.parse(modelWithoutRationale)).not.toThrow()
  })
})
```

### Integration Tests

**File:** `__tests__/integration/mentalModelGeneration.test.ts`

```typescript
describe('Mental Model Generation with Rationale', () => {
  it('should generate mental model with design rationale populated', async () => {
    // Mock OpenAI to return valid response with designRationale
    const result = await generateMentalModel(mockOptions)

    expect(result.content.designRationale).toBeDefined()
    expect(result.content.designRationale?.approachesConsidered.length).toBeGreaterThan(0)
    expect(result.content.designRationale?.selectedApproach).toBeTruthy()
    expect(result.content.designRationale?.selectionReasoning).toBeTruthy()
  })

  it('should render design rationale in markdown output', async () => {
    const result = await generateMentalModel(mockOptions)

    expect(result.markdown).toContain('## Design Rationale')
    expect(result.markdown).toContain('Approaches Considered')
    expect(result.markdown).toContain('Why This Approach')
  })
})
```

### E2E Tests

**File:** `e2e/guru-teaching-enhanced.spec.ts`

> **Note:** Artifacts are now viewed in full-page viewers at `/projects/[id]/artifacts/teaching/[type]`, not modals.

```typescript
test.describe('Enhanced Teaching Content Generation', () => {
  test('user can provide additional guidance before generation', async ({ page }) => {
    await page.goto('/projects/test-project')
    await page.click('[data-testid="guru-tab"]')

    // Find the user notes textarea for mental model
    const notesInput = page.locator('[data-testid="mental-model-notes"]')
    await notesInput.fill('Focus on visual metaphors')

    // Generate
    await page.click('[data-testid="generate-mental-model"]')

    // Wait for completion
    await expect(page.locator('[data-testid="mental-model-status"]')).toHaveText('Completed', { timeout: 120000 })
  })

  test('generated artifact displays design rationale section', async ({ page }) => {
    // Navigate to full-page artifact viewer
    await page.goto('/projects/test-project/artifacts/teaching/mental-model')

    // Verify rationale section is visible in Rendered view mode (default)
    await expect(page.locator('section:has-text("Design Rationale")')).toBeVisible()
    await expect(page.locator('text=Approaches Considered')).toBeVisible()
    await expect(page.locator('text=Why This Approach')).toBeVisible()

    // Verify rationale appears in TOC
    await expect(page.locator('[data-testid="toc"] >> text=Design Rationale')).toBeVisible()
  })

  test('design rationale visible in markdown view mode', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/mental-model')

    // Switch to markdown view
    await page.click('[data-testid="view-mode-markdown"]')

    // Verify rationale in markdown
    await expect(page.locator('text=## Design Rationale')).toBeVisible()
  })

  test('drill series shows design thoughts and methodology', async ({ page }) => {
    await page.goto('/projects/test-project/artifacts/teaching/drill-series')

    // Verify design thoughts section
    await expect(page.locator('section:has-text("Design Thoughts")')).toBeVisible()
    await expect(page.locator('text=Methodology Rationale')).toBeVisible()

    // Verify methodology badges on individual drills
    await expect(page.locator('[data-testid="drill-card"] >> text=Error Detection').first()).toBeVisible()
  })
})
```

---

## Performance Considerations

### Token Usage

The enhanced prompts are longer (~2000-3000 additional tokens per prompt). Impact:

- **Mental Model:** ~500 token increase
- **Curriculum:** ~300 token increase (no new reasoning output)
- **Drills:** ~1500 token increase (methodology index + design thoughts output)

Mitigation: The methodology index is valuable reference material that improves output quality, justifying the token cost.

### Response Size

New schema fields add ~200-500 tokens to responses:
- `designRationale`: ~150-300 tokens
- `designThoughts`: ~200-400 tokens
- `methodology` per drill: ~5-10 tokens

This is within acceptable limits for GPT-4o responses.

---

## Security Considerations

### User Input Sanitization

User notes are inserted into prompts. Ensure:

1. Notes are sanitized before insertion (no prompt injection)
2. Maximum length enforced (e.g., 2000 characters)
3. Notes are not stored in database (transient, generation-time only)

```typescript
// In API route validation
const generateSchema = z.object({
  userNotes: z.string().max(2000).optional(),
})
```

### Output Validation

All outputs pass through Zod schema validation, preventing malformed data from reaching the database or UI.

---

## Error Handling

### Schema Validation Failures
If GPT-4o rejects the schema or returns invalid structured output:
- Log the full error to Inngest console
- Mark artifact status as `FAILED`
- Store error message in artifact record for debugging
- Display user-friendly error: "Generation failed. Please try again."

### Missing Design Rationale
If AI output lacks `designRationale` or `designThoughts` fields:
- Accept the output (fields are optional via `.nullable().optional()`)
- Log warning: "Design rationale not generated for artifact {id}"
- Display content without rationale section (graceful degradation)
- Existing artifacts without rationale continue to work (backward compatible)

### Generation Timeout
- Existing Inngest timeout handling applies (no changes needed)
- Stale artifact cleanup already implemented via `getActiveGeneratingArtifact()`

### Empty User Notes
If user notes field is empty string:
- Treat as no user notes provided
- Do not include USER GUIDANCE section in prompt

---

## Documentation

### Updates Required

1. **CLAUDE.md**: Add section on creative system prompt and design protocol pattern
2. **Developer Guide**: Document new schema fields and rendering
3. **Inline Comments**: Update prompt files with methodology index documentation

---

## Implementation Phases

### Phase 1: Core Prompt Enhancement
1. Create `creativeSystemPrompt.ts` with shared persona
2. Update all three prompt builders with design protocols
3. Add drill methodology index to drill prompt
4. Update curriculum prompt to require `designRationale` output
5. Update generators to use new system prompt
6. Test generation still works

### Phase 2: Schema Additions
1. Backup database before changes
2. Add `designRationale` to mental model schema
3. Add `designRationale` to curriculum schema (with curriculum-specific fields)
4. Add `designThoughts` and `methodology` to drill series schema
5. Add prompt versioning fields to GuruArtifact Prisma model (`systemPromptHash`, `userPromptHash`, `promptConfigId`)
6. Create `promptHasher.ts` utility
7. Regenerate Prisma client
8. Test OpenAI strict mode acceptance

### Phase 3: Markdown Rendering
1. Update `renderMentalModelMarkdown` to show rationale at top
2. Update `renderCurriculumMarkdown` to show rationale at top
3. Update `renderDrillSeriesMarkdown` to show design thoughts at top
4. Include methodology in individual drill rendering
5. Test markdown output formatting

### Phase 4: Type-Specific Renderer Updates
1. Update `MentalModelRenderer.tsx` to display `designRationale` section
2. Update `CurriculumRenderer.tsx` to display `designRationale` section (emerald styling)
3. Update `DrillSeriesRenderer.tsx` to display `designThoughts` section
4. Update `DrillCard.tsx` to show methodology badge
5. Update TOC generators to include rationale sections for all three types
6. Test Rendered view mode displays rationale correctly

### Phase 5: Prompt Versioning Integration
1. Update Inngest jobs to compute prompt hashes before generation
2. Store `systemPromptHash`, `userPromptHash`, `promptConfigId` with artifact on completion
3. Add prompt hash display to artifact viewer header (optional - shows which prompts generated this)
4. Test prompt versioning is captured correctly

### Phase 6: UI Updates
1. Add `userNotes` state to GuruTeachingManager
2. Add textarea to ArtifactCard component
3. Pass userNotes through handleGenerate
4. Test end-to-end generation flow with viewer navigation

---

## Resolved Decisions

### Decision 1: Curriculum Rationale Field ✅
**Decision:** Option B - Yes, add independent `designRationale` to curriculum

**Rationale:** The user prompts for each artifact type are highly specific. "How should I design this curriculum?" leads to different design thinking than "How should I design this mental model?" Each artifact deserves its own documented reasoning stream.

---

### Decision 2: Rationale Versioning ✅
**Decision:** Option B - Yes, track prompt version with each artifact

**Rationale:** Users want to track how artifacts changed as both prompts AND corpus evolved. This enables understanding the relationship between prompt changes and output quality over time.

---

## References

- [Ideation Document](../docs/ideation/enhance-content-creation-prompts.md)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Zod Schema Validation](https://zod.dev/)
- Existing specs: `feat-guru-teaching-functions.md`
