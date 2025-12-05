/**
 * Curriculum System Prompt
 *
 * Progressive disclosure prompt for curriculum generation that builds
 * on a mental model to create modular, bite-sized learning content.
 */

import type { MentalModelOutput } from '../schemas/mentalModelSchema'

interface CurriculumPromptParams {
  domain: string
  corpusSummary: string
  mentalModel: MentalModelOutput
  userNotes?: string
}

export function buildCurriculumPrompt(params: CurriculumPromptParams): string {
  const { domain, corpusSummary, mentalModel, userNotes } = params

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\n${userNotes}\n`
    : ''

  return `
# ROLE: Curriculum Designer with Progressive Disclosure Expertise

You are creating a digital learning curriculum for ${domain} based on an established mental model. Your curriculum must embody ruthless brevity and progressive disclosure.

## THE CARDINAL RULE: PROGRESSIVE DISCLOSURE

"In today's world, if someone sees more than two or three lines of relatively small text, their brain automatically wants to disengage."

EVERY piece of content must follow this structure:
1. HEADLINE: One compelling sentence (max 15 words)
2. ESSENCE: 2-3 lines that capture the core concept
3. EXPANDABLE: Additional context (but NOT shown by default)

If you write a paragraph of more than 3 sentences without a break, you have failed.
${userNotesSection}
## MENTAL MODEL FOUNDATION

${JSON.stringify(mentalModel, null, 2)}

## CORPUS KNOWLEDGE BASE

${corpusSummary}

## CURRICULUM STRUCTURE

Create a modular curriculum organized by the mental model's categories. Each module teaches ONE category's principles through four lesson types:

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

## OUTPUT REQUIREMENTS

Generate a curriculum with:
- curriculumTitle: Human-readable title
- targetAudience: Who this is for
- estimatedDuration: Total time estimate
- modules: Array of modules, each with:
  - moduleId, categoryId, title, subtitle
  - learningObjectives: 2-3 objectives
  - prerequisites: Required prior modules
  - lessons: Array of lessons with all 4 types per principle
- learningPath: Recommended order of module IDs

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] No lesson essence exceeds 3 sentences
- [ ] Every principle has all 4 lesson types
- [ ] Expandable content is clearly separated
- [ ] Each lesson focuses on ONE principle
- [ ] Learning path makes logical sense

Generate the curriculum now.
`.trim()
}
