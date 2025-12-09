/**
 * Drill Designer User Prompt
 *
 * Deliberate practice prompt for drill design that creates
 * principle-reinforcing exercises at three difficulty tiers.
 *
 * Includes comprehensive methodology index and design protocol
 * requiring explicit approach exploration before generating output.
 */

import type { MentalModelOutput } from '../schemas/mentalModelSchema'
import type { CurriculumOutput } from '../schemas/curriculumSchema'

interface DrillDesignerPromptParams {
  domain: string
  corpusSummary: string
  mentalModel: MentalModelOutput
  curriculum: CurriculumOutput
  userNotes?: string
}

export function buildDrillDesignerPrompt(params: DrillDesignerPromptParams): string {
  const { domain, corpusSummary, mentalModel, curriculum, userNotes } = params

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\nThe user has provided these additional notes:\n${userNotes}\n\nIntegrate this guidance into your design process and final output.\n`
    : ''

  return `
# TASK: Design Practice Drills for ${domain}

You are creating practice drills for ${domain} that reinforce the principles from the mental model through deliberate practice.

---

## DRILL METHODOLOGY INDEX

Use this index to select diverse, appropriate methodologies for each drill. **You MUST use at least 4 different methodologies across your drill series.**

### A. MEMORY & RECALL DRILLS
These strengthen retrieval pathways for key concepts.

1. **Recognition** - "Which principle applies here?"
   - Present scenario, identify correct principle
   - Best for: Early learning, building pattern library

2. **Cued Recall** - "Given X, what is Y?"
   - Provide partial information, retrieve the rest
   - Best for: Strengthening associations

3. **Free Recall** - "List all principles that..."
   - Retrieve without prompts
   - Best for: Testing deeper encoding

4. **Serial Recall** - "In what order should..."
   - Retrieve sequence of steps or priorities
   - Best for: Procedural knowledge

5. **Discrimination** - "What's the difference between A and B?"
   - Distinguish similar concepts
   - Best for: Preventing confusion

### B. APPLICATION DRILLS
These develop ability to use knowledge in realistic contexts.

1. **Worked Example Analysis** - "Why did the expert do X?"
   - Analyze solved problem, explain reasoning
   - Best for: Building mental models of expert thinking

2. **Faded Scaffolding** - "Complete this partially-solved problem"
   - Gradually remove support
   - Best for: Building confidence

3. **Error Detection** - "What mistake was made here?"
   - Find and explain errors
   - Best for: Developing critical eye

4. **Case Analysis** - "What would you recommend for this situation?"
   - Apply principles to realistic scenario
   - Best for: Judgment development

5. **Constraint Variation** - "Now do it with this limitation..."
   - Apply with added difficulty
   - Best for: Flexible application

6. **Completion** - "Finish this solution"
   - Complete partial work
   - Best for: Transition to independence

### C. TRANSFER DRILLS
These develop ability to apply knowledge in new contexts.

1. **Analogical Reasoning** - "This is like when..."
   - Connect to different domain
   - Best for: Deep understanding

2. **Novel Problem** - "You've never seen this exact situation..."
   - Apply to unfamiliar context
   - Best for: Testing true understanding

3. **Principle Synthesis** - "Which principles apply together?"
   - Combine multiple principles
   - Best for: Integration

4. **Context Shift** - "Same principle, different setting"
   - Same concept, new environment
   - Best for: Generalization

5. **Adversarial** - "What would go wrong if..."
   - Consider failure modes
   - Best for: Robust understanding

### D. METACOGNITIVE DRILLS
These develop awareness of one's own thinking.

1. **Self-Explanation** - "Explain your reasoning"
   - Articulate thought process
   - Best for: Deepening understanding

2. **Prediction** - "What will happen if..."
   - Forecast outcomes
   - Best for: Testing causal models

3. **Confidence Calibration** - "How sure are you?"
   - Rate confidence, get feedback
   - Best for: Epistemic humility

4. **Comparison** - "How does your approach compare to the expert's?"
   - Evaluate own thinking against standard
   - Best for: Self-improvement

### E. ENGAGEMENT PATTERNS
These make drills more memorable and motivating.

1. **Narrative-Embedded** - Drill within a story context
   - Best for: Motivation, memory hooks

2. **Debate/Argue Both Sides** - "Make the case for and against"
   - Best for: Nuanced understanding

3. **Teach-Back** - "Explain this to a beginner"
   - Best for: Identifying gaps

4. **Timed Challenge** - Add time pressure
   - Best for: Building automaticity

5. **Streak/Chain** - Connected sequence of drills
   - Best for: Sustained practice

---

## DESIGN PROTOCOL (Required)

Before generating output, work through this protocol and document your thinking:

### Step 1: Principle-by-Principle Analysis
For each principle in the mental model:
- What's the most common error learners make?
- What scenario would best reveal whether they understand?
- What would make practice feel engaging, not tedious?

### Step 2: Methodology Selection
For each drill, select a methodology from the index above:
- Does this methodology fit the principle being practiced?
- Does this methodology fit the tier (Recognition/Application/Transfer)?
- Will this feel fresh compared to adjacent drills?

### Step 3: Variety Verification
Check your drill series for variety:
- Are you using at least 4 different methodologies?
- Is no single methodology used for more than 30% of drills?
- Do the drills feel like a varied workout, not repetitive sets?

### Step 4: Document Reasoning
Record your design thinking in the \`designThoughts\` field.
${userNotesSection}
---

## THREE-TIER DIFFICULTY SYSTEM

### Tier 1: RECOGNITION
- Student identifies the correct principle
- Multiple choice: "Which principle applies here?"
- Focus: Pattern recognition
- Time: 30-60 seconds

### Tier 2: APPLICATION
- Student applies principle to a scenario
- Situation-based: "What should you do?"
- Focus: Correct execution
- Time: 1-2 minutes

### Tier 3: TRANSFER
- Student handles novel/complex situations
- Open-ended: "How would you approach...?"
- Focus: Adaptation and judgment
- Time: 2-5 minutes

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

Generate drill series with these fields:

### Required Fields
- **drillSeriesTitle**: Overall title
- **targetPrinciples**: Array of principle IDs covered
- **totalDrills**: Count of all drills
- **estimatedCompletionMinutes**: Total time estimate
- **series**: Array of principle series, each with:
  - seriesId, principleId, principleName
  - seriesDescription: Why this principle needs practice
  - drills: Array of 3+ drills (at least one per tier), each with:
    - drillId, tier (RECOGNITION/APPLICATION/TRANSFER)
    - methodology: The methodology from the index used (e.g., "Error Detection", "Case Analysis")
    - scenario: { setup, visual (optional ASCII), question }
    - options: Array of 3-4 choices with { id, text, isCorrect, commonMistake }
    - correctAnswer: ID of correct option
    - feedback: { correct: {...}, incorrect: {...} }
    - asciiWireframe: Optional visual representation
    - metadata: { estimatedSeconds, prerequisiteDrills, tags }
- **practiceSequences**: Optional recommended drill orderings

### Design Thoughts Field (Required)
- **designThoughts**: Object documenting your drill design thinking:
  - methodologyRationale: Why you chose these specific methodologies
  - varietyAnalysis: How you ensured drill variety (list methodologies used with counts)
  - pedagogicalNotes: Any trade-offs or special considerations
  - distinctiveElements: What makes this drill series unique/effective (optional)

---

## FEEDBACK REQUIREMENTS

Correct feedback must:
1. brief: One sentence confirmation
2. principleReinforcement: How this demonstrates the principle
3. expanded: Optional deeper explanation

Incorrect feedback must:
1. brief: Non-judgmental redirect
2. principleReminder: The principle they should apply
3. commonMistakeAddress: Why this error is natural
4. tryAgainHint: Helpful nudge without revealing answer

---

## ASCII WIREFRAMES (Optional)

For drills that benefit from visual context, include simple ASCII art:

\`\`\`
+-------+-------+
|   A   |   B   |
+-------+-------+
|   C   |   D   |
+-------+-------+
\`\`\`

Keep wireframes simple (under 10 lines).

---

## QUALITY CHECKLIST

Before outputting, verify:
- [ ] Each principle has at least 3 drills (one per tier)
- [ ] At least 4 different methodologies used across all drills
- [ ] No single methodology exceeds 30% of drills
- [ ] All feedback references the target principle
- [ ] Options include plausible distractors
- [ ] Difficulty progresses within each series
- [ ] Time estimates are realistic
- [ ] designThoughts is fully populated with genuine reasoning

Generate the drill series now.
`.trim()
}
