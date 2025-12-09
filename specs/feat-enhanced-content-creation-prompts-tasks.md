# Task Breakdown: Enhanced Teaching Content Creation Prompts

Generated: 2025-12-08
Source: specs/feat-enhanced-content-creation-prompts.md

## Overview

Transform the teaching content creation system from functional but generic prompts into a rich, protocol-based system that produces thoughtful, creative, and pedagogically sound content. This includes:
- Shared creative system prompt establishing an innovative instructional designer persona
- Protocol-based user prompts requiring explicit approach exploration
- Schema additions to capture AI reasoning for transparency
- UI updates for user guidance and rationale display

---

## Phase 1: Core Prompt Enhancement

### Task 1.1: Create Creative System Prompt

**Description**: Create the shared creative system prompt establishing the innovative instructional designer persona used by all three generators.
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**File**: `lib/guruFunctions/prompts/creativeSystemPrompt.ts`

**Implementation**:

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

**Acceptance Criteria**:
- [ ] File created at correct location
- [ ] Exports `CREATIVE_TEACHING_SYSTEM_PROMPT` constant
- [ ] Contains cognitive science foundations section
- [ ] Contains creative pedagogy section
- [ ] Contains design philosophy (4 principles)
- [ ] Contains design process requirements
- [ ] TypeScript compiles without errors

---

### Task 1.2: Update Mental Model Prompt with Design Protocol

**Description**: Update the mental model prompt to include a design protocol requiring approach exploration.
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.3, Task 1.4

**File**: `lib/guruFunctions/prompts/mentalModelPrompt.ts`

**Implementation** (key changes):

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

**Acceptance Criteria**:
- [ ] Interface includes userNotes parameter
- [ ] DESIGN PROTOCOL section with 3 steps
- [ ] 5 approach options documented (Hierarchical, Process-Based, Comparative, Metaphorical, Tension-Based)
- [ ] USER GUIDANCE section added when userNotes provided
- [ ] Design Rationale field documented in OUTPUT REQUIREMENTS
- [ ] Quality checklist includes designRationale check
- [ ] TypeScript compiles without errors

---

### Task 1.3: Update Curriculum Prompt with Design Protocol

**Description**: Update the curriculum prompt with a design protocol requiring approach exploration.
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, Task 1.4

**File**: `lib/guruFunctions/prompts/curriculumPrompt.ts`

**Key Changes**:
- Add DESIGN PROTOCOL section with 3 steps
- Include 4 curriculum design approaches (Mastery-Based, Challenge-First, Story-Integrated, Comparative Discovery)
- Add USER GUIDANCE section for userNotes
- Add Design Rationale field to OUTPUT REQUIREMENTS
- Include quality checklist

**Design Rationale Field (Required)**:
```
- **designRationale**: Object documenting your curriculum design thinking:
  - approachesConsidered: Array of curriculum approaches you evaluated (e.g., "Mastery-Based", "Challenge-First")
  - selectedApproach: The approach you chose
  - selectionReasoning: 2-4 sentences explaining why this approach fits this domain and learner needs
  - engagementStrategy: How you maintain learner motivation throughout (optional)
  - progressionLogic: Why lessons and modules are ordered this way (optional)
```

**Acceptance Criteria**:
- [ ] DESIGN PROTOCOL section with 3 steps
- [ ] 4 curriculum approaches documented
- [ ] USER GUIDANCE section conditional on userNotes
- [ ] Design Rationale field documented in OUTPUT REQUIREMENTS
- [ ] TypeScript compiles without errors

---

### Task 1.4: Update Drill Designer Prompt with Methodology Index

**Description**: Update the drill designer prompt with the comprehensive methodology taxonomy and design protocol.
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, Task 1.3

**File**: `lib/guruFunctions/prompts/drillDesignerPrompt.ts`

**Must Include**:

1. **DRILL METHODOLOGY INDEX** with 5 categories:
   - A. MEMORY & RECALL DRILLS (Recognition, Cued Recall, Free Recall, Serial Recall, Discrimination)
   - B. APPLICATION DRILLS (Worked Example Analysis, Faded Scaffolding, Error Detection, Case Analysis, Constraint Variation, Completion)
   - C. TRANSFER DRILLS (Analogical Reasoning, Novel Problem, Principle Synthesis, Context Shift, Adversarial)
   - D. METACOGNITIVE DRILLS (Self-Explanation, Prediction, Confidence Calibration, Comparison)
   - E. ENGAGEMENT PATTERNS (Narrative-Embedded, Debate/Argue Both Sides, Teach-Back, Timed Challenge, Streak/Chain)

2. **DESIGN PROTOCOL** with 4 steps:
   - Step 1: Principle-by-Principle Analysis
   - Step 2: Methodology Selection
   - Step 3: Variety Verification (at least 4 different methodologies, no more than 30% same methodology)
   - Step 4: Document Reasoning in designThoughts field

3. **THREE-TIER DIFFICULTY SYSTEM** (existing):
   - Tier 1: RECOGNITION
   - Tier 2: APPLICATION
   - Tier 3: TRANSFER

4. **Design Thoughts Field (Required)**:
   - methodologyRationale: Why you chose these specific methodologies
   - varietyAnalysis: How you ensured drill variety (list methodologies used)
   - pedagogicalNotes: Any trade-offs or special considerations
   - distinctiveElements: What makes this drill series unique/effective

**Acceptance Criteria**:
- [ ] Complete methodology index with 5 categories and all methodologies
- [ ] DESIGN PROTOCOL with 4 steps
- [ ] Variety verification requirements (at least 4 methodologies, max 30% same)
- [ ] designThoughts field documented in OUTPUT REQUIREMENTS
- [ ] Quality checklist includes designThoughts check
- [ ] TypeScript compiles without errors

---

### Task 1.5: Update Generators to Use New System Prompt

**Description**: Update all three generators to import and use the shared creative system prompt.
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Tasks 1.2, 1.3, 1.4

**Files**:
- `lib/guruFunctions/generators/mentalModelGenerator.ts`
- `lib/guruFunctions/generators/curriculumGenerator.ts`
- `lib/guruFunctions/generators/drillDesigner.ts`

**Change for each**:
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

**Acceptance Criteria**:
- [ ] All three generators import CREATIVE_TEACHING_SYSTEM_PROMPT
- [ ] All three generators use it in OpenAI messages
- [ ] TypeScript compiles without errors
- [ ] Generation still works (test manually or with existing tests)

---

## Phase 2: Schema Additions

### Task 2.1: Add designRationale to Mental Model Schema

**Description**: Add designRationale schema field to mental model with backward compatibility.
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.2, Task 2.3, Task 2.4

**File**: `lib/guruFunctions/schemas/mentalModelSchema.ts`

**Implementation**:

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

**CRITICAL**: Use `.nullable().optional()` pattern for OpenAI strict mode compatibility.

**Acceptance Criteria**:
- [ ] designRationaleSchema exported
- [ ] mentalModelSchema includes designRationale field
- [ ] Uses `.nullable().optional()` for all optional fields
- [ ] TypeScript compiles without errors
- [ ] Schema validates existing artifacts without designRationale (backward compatible)

---

### Task 2.2: Add designRationale to Curriculum Schema

**Description**: Add curriculum-specific designRationale schema field.
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, Task 2.3, Task 2.4

**File**: `lib/guruFunctions/schemas/curriculumSchema.ts`

**Implementation**:

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

**Acceptance Criteria**:
- [ ] curriculumDesignRationaleSchema exported with curriculum-specific fields
- [ ] Includes engagementStrategy and progressionLogic optional fields
- [ ] Uses `.nullable().optional()` pattern
- [ ] TypeScript compiles without errors
- [ ] Backward compatible with existing artifacts

---

### Task 2.3: Add designThoughts and methodology to Drill Series Schema

**Description**: Add designThoughts schema and methodology field to individual drills.
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, Task 2.2, Task 2.4

**File**: `lib/guruFunctions/schemas/drillSeriesSchema.ts`

**Implementation**:

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

**Acceptance Criteria**:
- [ ] methodology field added to drillSchema
- [ ] designThoughtsSchema exported
- [ ] drillSeriesSchema includes designThoughts field
- [ ] All fields use `.nullable().optional()` pattern
- [ ] TypeScript compiles without errors
- [ ] Backward compatible

---

### Task 2.4: Add Prompt Versioning to GuruArtifact Prisma Model

**Description**: Add fields to track which prompts generated each artifact.
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, Task 2.2, Task 2.3

**Files**:
- `prisma/schema.prisma`
- `lib/guruFunctions/promptHasher.ts` (new)

**Prisma Schema Changes**:
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

**Prompt Hash Utility**:
```typescript
// lib/guruFunctions/promptHasher.ts
import { createHash } from 'crypto'

export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 12)
}
```

**Acceptance Criteria**:
- [ ] Prisma schema updated with 3 new fields
- [ ] Migration runs successfully
- [ ] promptHasher.ts created and exports hashPrompt
- [ ] hashPrompt returns 12-character hex string
- [ ] Prisma client regenerated

---

## Phase 3: Markdown Rendering

### Task 3.1: Update Mental Model Markdown Renderer

**Description**: Update mental model markdown renderer to show designRationale at top.
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.1
**Can run parallel with**: Task 3.2, Task 3.3

**File**: `lib/guruFunctions/generators/mentalModelGenerator.ts`

**Add to renderMentalModelMarkdown function**:
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

**Acceptance Criteria**:
- [ ] Design Rationale section rendered at top when present
- [ ] Section includes all 4 fields (approaches, selected, reasoning, tradeoffs)
- [ ] Graceful handling when designRationale is null/undefined
- [ ] Markdown output is properly formatted

---

### Task 3.2: Update Curriculum Markdown Renderer

**Description**: Update curriculum markdown renderer to show designRationale at top.
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.2
**Can run parallel with**: Task 3.1, Task 3.3

**File**: `lib/guruFunctions/generators/curriculumGenerator.ts`

**Pattern**: Same as mental model but with curriculum-specific fields (engagementStrategy, progressionLogic)

**Acceptance Criteria**:
- [ ] Design Rationale section rendered at top when present
- [ ] Includes curriculum-specific optional fields
- [ ] Graceful handling when designRationale is null/undefined

---

### Task 3.3: Update Drill Series Markdown Renderer

**Description**: Update drill series markdown renderer to show designThoughts at top and methodology per drill.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.3
**Can run parallel with**: Task 3.1, Task 3.2

**File**: `lib/guruFunctions/generators/drillDesigner.ts`

**Add to renderDrillSeriesMarkdown function**:
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

**Acceptance Criteria**:
- [ ] Design Thoughts section rendered at top when present
- [ ] Individual drills show methodology when present
- [ ] Graceful handling of null/undefined fields

---

## Phase 4: Type-Specific Renderer Updates

### Task 4.1: Update MentalModelRenderer Component

**Description**: Add designRationale display section to MentalModelRenderer.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.1, Task 3.1
**Can run parallel with**: Task 4.2, Task 4.3

**File**: `components/artifacts/renderers/MentalModelRenderer.tsx`

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Design Rationale section displayed at top with amber styling
- [ ] All 4 fields rendered correctly
- [ ] Conditional rendering when designRationale is absent
- [ ] TypeScript types updated for content prop

---

### Task 4.2: Update CurriculumRenderer Component

**Description**: Add designRationale display section to CurriculumRenderer with emerald styling.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.2
**Can run parallel with**: Task 4.1, Task 4.3

**File**: `components/artifacts/renderers/CurriculumRenderer.tsx`

**Implementation**: Same pattern as MentalModelRenderer but with:
- Emerald color scheme (bg-emerald-50, border-emerald-200, text-emerald-900/800)
- Additional fields: engagementStrategy, progressionLogic

**Acceptance Criteria**:
- [ ] Design Rationale section with emerald styling
- [ ] Includes curriculum-specific fields
- [ ] Conditional rendering for optional fields

---

### Task 4.3: Update DrillSeriesRenderer Component

**Description**: Add designThoughts display section to DrillSeriesRenderer with purple styling.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.3
**Can run parallel with**: Task 4.1, Task 4.2

**File**: `components/artifacts/renderers/DrillSeriesRenderer.tsx`

**Implementation**: Same pattern but with:
- Purple color scheme (bg-purple-50, border-purple-200, text-purple-900/800)
- Fields: methodologyRationale, varietyAnalysis, pedagogicalNotes, distinctiveElements

**Acceptance Criteria**:
- [ ] Design Thoughts section with purple styling
- [ ] All 4 fields rendered correctly
- [ ] Conditional rendering for optional distinctiveElements

---

### Task 4.4: Update DrillCard Component for Methodology Badge

**Description**: Add methodology badge to individual drill cards.
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.3
**Can run parallel with**: Task 4.1, 4.2, 4.3

**File**: `components/artifacts/renderers/cards/DrillCard.tsx`

**Add**:
```typescript
{drill.methodology && (
  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
    {drill.methodology}
  </span>
)}
```

**Acceptance Criteria**:
- [ ] Methodology badge displayed when methodology field is present
- [ ] Styling consistent with existing badges

---

### Task 4.5: Update TOC Generators

**Description**: Update Table of Contents generators to include Design Rationale sections.
**Size**: Small
**Priority**: Low
**Dependencies**: Tasks 4.1, 4.2, 4.3
**Can run parallel with**: None

**Files**:
- MentalModelRenderer TOC generator
- CurriculumRenderer TOC generator
- DrillSeriesRenderer TOC generator

**Example for Mental Model**:
```typescript
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

**Acceptance Criteria**:
- [ ] Design Rationale appears in TOC when present
- [ ] Clicking TOC item scrolls to section
- [ ] All three renderers updated

---

## Phase 5: Prompt Versioning Integration

### Task 5.1: Update Inngest Jobs for Prompt Hashing

**Description**: Update Inngest jobs to compute and store prompt hashes with artifacts.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.4
**Can run parallel with**: None

**File**: `lib/inngest-functions.ts`

**Changes to each generation job**:
```typescript
import { hashPrompt } from './guruFunctions/promptHasher'

// In generation job, after creating the artifact:
const systemPromptHash = hashPrompt(systemPrompt)
const userPromptHash = hashPrompt(userPrompt)

// Store with artifact on completion
await prisma.guruArtifact.update({
  where: { id: artifactId },
  data: {
    // ... existing fields
    systemPromptHash,
    userPromptHash,
    promptConfigId: null,  // Will be set in Spec 2 when custom prompts exist
  },
})
```

**Acceptance Criteria**:
- [ ] All 3 generation jobs updated
- [ ] Prompt hashes computed and stored
- [ ] Existing generation flow still works
- [ ] Hashes visible in database after generation

---

## Phase 6: UI Updates

### Task 6.1: Add User Notes State to GuruTeachingManager

**Description**: Add state management for user notes per artifact type.
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 6.2

**File**: `components/guru/GuruTeachingManager.tsx`

**Add**:
```typescript
// Add state for user notes
const [userNotes, setUserNotes] = useState<Record<string, string>>({
  'mental-model': '',
  'curriculum': '',
  'drill-series': '',
});
```

**Acceptance Criteria**:
- [ ] userNotes state added with correct keys
- [ ] State persists during component lifecycle

---

### Task 6.2: Add User Notes Textarea to ArtifactCard

**Description**: Add optional guidance textarea to artifact generation cards.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 6.1
**Can run parallel with**: Task 6.3

**File**: `components/guru/GuruTeachingManager.tsx`

**Changes**:
```typescript
// Update ArtifactCard props
interface ArtifactCardProps {
  // ... existing props
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
}

// In ArtifactCard component
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

// Pass to each ArtifactCard
<ArtifactCard
  title="Mental Model"
  // ... existing props
  userNotes={userNotes['mental-model']}
  onUserNotesChange={(notes) => setUserNotes(prev => ({ ...prev, 'mental-model': notes }))}
/>
```

**Acceptance Criteria**:
- [ ] Textarea visible on each artifact card
- [ ] Hidden during generation
- [ ] Placeholder text explains purpose
- [ ] Changes update state correctly

---

### Task 6.3: Pass User Notes to Generation API

**Description**: Update handleGenerate to pass userNotes to API.
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 6.1, Task 6.2
**Can run parallel with**: None

**File**: `components/guru/GuruTeachingManager.tsx`

**Update handleGenerate**:
```typescript
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
```

**Acceptance Criteria**:
- [ ] userNotes passed in request body
- [ ] undefined when empty (not empty string)
- [ ] Generation works with and without notes

---

## Testing Requirements

### Unit Tests

**Test Files**:
- `__tests__/guruFunctions/prompts/creativeSystemPrompt.test.ts`
- `__tests__/guruFunctions/prompts/drillDesignerPrompt.test.ts`
- `__tests__/guruFunctions/schemas/mentalModelSchema.test.ts`

**Key Tests**:
```typescript
describe('CREATIVE_TEACHING_SYSTEM_PROMPT', () => {
  it('should be a non-empty string with design philosophy', () => {
    expect(typeof CREATIVE_TEACHING_SYSTEM_PROMPT).toBe('string')
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT.length).toBeGreaterThan(1000)
    expect(CREATIVE_TEACHING_SYSTEM_PROMPT).toContain('DESIGN PHILOSOPHY')
  })
})

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

  it('should accept null/missing design rationale for backward compatibility', () => {
    const modelWithoutRationale = { ...baseMentalModel }
    expect(() => mentalModelSchema.parse(modelWithoutRationale)).not.toThrow()
  })
})
```

### E2E Tests

**File**: `e2e/guru-teaching-enhanced.spec.ts`

**Key Tests**:
- User can provide additional guidance before generation
- Generated artifact displays design rationale section
- Design rationale visible in markdown view mode
- Drill series shows design thoughts and methodology

---

## Dependency Graph

```
Phase 1 (Foundation)
├── Task 1.1: Create Creative System Prompt
│   ├── Task 1.2: Update Mental Model Prompt ─────┐
│   ├── Task 1.3: Update Curriculum Prompt ───────┤ (parallel)
│   ├── Task 1.4: Update Drill Designer Prompt ───┤
│   └── Task 1.5: Update Generators ──────────────┘

Phase 2 (Schema)
├── Task 2.1: Mental Model Schema ─────┐
├── Task 2.2: Curriculum Schema ───────┤ (parallel)
├── Task 2.3: Drill Series Schema ─────┤
└── Task 2.4: Prompt Versioning Schema ┘

Phase 3 (Markdown)
├── Task 3.1: Mental Model Markdown ─┐
├── Task 3.2: Curriculum Markdown ───┤ (parallel)
└── Task 3.3: Drill Series Markdown ─┘

Phase 4 (Renderers)
├── Task 4.1: MentalModelRenderer ─────┐
├── Task 4.2: CurriculumRenderer ──────┤ (parallel)
├── Task 4.3: DrillSeriesRenderer ─────┤
├── Task 4.4: DrillCard Badge ─────────┤
└── Task 4.5: TOC Generators ──────────┘

Phase 5 (Versioning)
└── Task 5.1: Inngest Prompt Hashing

Phase 6 (UI)
├── Task 6.1: User Notes State ──┬── Task 6.3: Pass to API
└── Task 6.2: User Notes UI ─────┘
```

---

## Summary

- **Total Tasks**: 19
- **Phase 1**: 5 tasks (Core Prompt Enhancement)
- **Phase 2**: 4 tasks (Schema Additions)
- **Phase 3**: 3 tasks (Markdown Rendering)
- **Phase 4**: 5 tasks (Type-Specific Renderers)
- **Phase 5**: 1 task (Prompt Versioning)
- **Phase 6**: 3 tasks (UI Updates)

**Parallel Execution Opportunities**:
- Phase 1: Tasks 1.2-1.5 can run parallel after 1.1
- Phase 2: All 4 tasks can run parallel
- Phase 3: All 3 tasks can run parallel
- Phase 4: Tasks 4.1-4.4 can run parallel
