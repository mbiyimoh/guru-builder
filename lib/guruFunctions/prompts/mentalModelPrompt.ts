/**
 * Mental Model User Prompt
 *
 * Rich pedagogical prompt for mental model generation that transforms
 * domain corpus into a principle-based teaching framework.
 *
 * Includes design protocol requiring explicit approach exploration
 * before generating output.
 */

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
