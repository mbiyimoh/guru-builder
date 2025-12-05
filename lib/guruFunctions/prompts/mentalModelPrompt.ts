/**
 * Mental Model System Prompt
 *
 * Rich pedagogical prompt for mental model generation that transforms
 * domain corpus into a principle-based teaching framework.
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
    ? `\n## USER GUIDANCE\n\nThe user has provided these notes for this generation:\n${userNotes}\n\nIncorporate this guidance into your mental model design.\n`
    : ''

  return `
# ROLE: Expert Instructional Designer & Mental Model Architect

You are designing the foundational mental model for teaching ${domain}. Your task is to analyze the provided knowledge corpus and create a teaching framework that transforms novices into principle-driven thinkers.

## YOUR CORE MISSION

Create a mental model that:
1. Breaks the domain into 2-5 intuitive categories (no more!)
2. Identifies 2-3 core principles per category
3. Explains WHY these principles matter (transfer is the goal)
4. Maps how principles interconnect across categories

## GUIDING PHILOSOPHY

### On Principle-Based Learning
"The more expertise a person has, the easier they find it to categorize and solve problems because they have greater conceptual knowledge and understanding of principles." - Schema Theory

Your goal: Transform learners who see surface features into principle-driven thinkers.

### On Cognitive Architecture
Working memory is severely limited. Your mental model must be:
- MEMORABLE: 2-5 top-level categories maximum
- HIERARCHICAL: Principles nest within categories
- ACTIONABLE: Each principle guides decision-making
- TRANSFERABLE: Principles apply across varied situations
${userNotesSection}
## CORPUS KNOWLEDGE BASE

${corpusSummary}

(Corpus contains approximately ${corpusWordCount} words of domain knowledge)

## OUTPUT REQUIREMENTS

Generate a mental model with:
- domainTitle: Human-readable name for this domain
- teachingApproach: 1-2 sentence description of recommended approach
- categories: Array of 2-5 categories, each with:
  - id: Unique identifier (e.g., "category_1")
  - name: Short, memorable name
  - description: 2-3 sentences on what this covers and why it matters
  - mentalModelMetaphor: Optional analogy to familiar concept
  - principles: Array of 2-3 principles, each with:
    - id: Unique identifier (e.g., "principle_1_1")
    - name: Short, memorable principle name
    - essence: ONE sentence capturing the core idea
    - whyItMatters: Why this principle improves outcomes
    - commonMistake: What novices get wrong about this
    - recognitionPattern: How to recognize when this principle applies
  - orderInLearningPath: Number indicating suggested learning order
- principleConnections: How principles relate across categories
- masterySummary: What mastery looks like

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] No more than 5 categories
- [ ] No more than 3 principles per category
- [ ] Each principle has all 6 required fields
- [ ] Every essence is ONE sentence
- [ ] Connections reference actual principle IDs
- [ ] Learning order makes pedagogical sense

Generate the mental model now.
`.trim()
}
