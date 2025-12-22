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
import type { SeededPosition, SeededPositionsByPhase, GamePhase } from '@/lib/positionLibrary'
import type { DrillGenerationConfig } from '../types'
import { DEFAULT_DRILL_CONFIG } from '../types'
import { UNIVERSAL_PRINCIPLES, PHASE_PRINCIPLES } from '@/lib/backgammon'
import type { PrincipleDefinition } from '@/lib/backgammon'

interface DrillDesignerPromptParams {
  domain: string
  corpusSummary: string
  mentalModel: MentalModelOutput
  curriculum: CurriculumOutput
  userNotes?: string
  seededPositions?: SeededPositionsByPhase | null
  drillConfig?: DrillGenerationConfig
}

/**
 * Format a single position for prompt injection (COMPACT format to reduce tokens)
 */
function formatPositionForPrompt(position: SeededPosition, index: number): string {
  const alternatives = position.alternatives.length > 0
    ? position.alternatives.map(a => `${a.move}(${a.equity.toFixed(2)})`).join(', ')
    : '-'

  // Compact single-line format saves ~100 tokens per position
  return `${index + 1}. **${position.diceRoll}**: Best=${position.bestMove} (${position.bestMoveEquity.toFixed(2)}) | Alts: ${alternatives} | ID: ${position.positionId}`
}

/**
 * Phase display names for prompt generation
 */
const PHASE_DISPLAY_NAMES: Record<GamePhase, string> = {
  OPENING: 'Opening Rolls',
  EARLY: 'Early Game',
  MIDDLE: 'Middle Game',
  BEAROFF: 'Bear-Off',
}

/**
 * Phase descriptions for prompt generation
 */
const PHASE_DESCRIPTIONS: Record<GamePhase, string> = {
  OPENING: 'These are the possible first rolls in backgammon, with engine-verified best moves. Each drill should test the learner\'s understanding of the correct opening move.',
  EARLY: 'These are early game positions where both players are establishing their game plan. Drills should focus on development and initial strategy.',
  MIDDLE: 'These are complex middle game positions with significant contact. Drills should test tactical decision-making and positional judgment.',
  BEAROFF: 'These are bear-off positions where checkers are being removed from the board. Drills should focus on efficient checker removal and pip-count awareness.',
}

/**
 * Build a section for a single game phase (COMPACT format)
 */
function buildPhaseSection(phase: GamePhase, positions: SeededPosition[]): string {
  if (!positions.length) {
    return ''
  }

  const formattedPositions = positions
    .map((p, i) => formatPositionForPrompt(p, i))
    .join('\n')

  const phaseName = PHASE_DISPLAY_NAMES[phase]

  return `
## ${phaseName.toUpperCase()} POSITIONS (${positions.length} total)

Use these engine-verified positions. Best move = correct answer. Use alternatives as distractors.

${formattedPositions}
`
}

/**
 * Build the seeded positions section for the prompt
 * Filters positions by the phases specified in the config
 */
function buildPositionsSection(
  seededPositions: SeededPositionsByPhase,
  config?: DrillGenerationConfig
): string {
  // Determine which phases to include
  const phases = config?.gamePhases ?? ['OPENING'] as GamePhase[]

  // Build sections for each enabled phase that has positions
  const sections: string[] = []

  for (const phase of phases) {
    const positions = seededPositions[phase] || []
    if (positions.length > 0) {
      sections.push(buildPhaseSection(phase, positions))
    }
  }

  if (sections.length === 0) {
    return ''
  }

  return `
---

${sections.join('\n')}
---
`
}

/**
 * Format a single principle for prompt injection
 */
function formatPrincipleForPrompt(principle: PrincipleDefinition): string {
  return `
### ${principle.name}
${principle.description}

**Prompt Guidance:** ${principle.promptGuidance}
`
}

/**
 * Build the principle taxonomy section for the prompt
 * Includes universal principles (always) and phase-specific principles (filtered by config)
 */
function buildPrincipleSection(config?: DrillGenerationConfig): string {
  // Format universal principles (always included)
  const universalSection = `
## UNIVERSAL PRINCIPLES (Reinforce in ALL drills)

These principles apply across all phases and should be reinforced whenever relevant:
${UNIVERSAL_PRINCIPLES.map(p => formatPrincipleForPrompt(p)).join('\n')}
`

  // Determine which phases to include
  const phases = config?.gamePhases ?? ['OPENING'] as GamePhase[]

  // Format phase-specific principles only for requested phases
  const phaseSections = phases.map(phase => {
    const phasePrinciples = PHASE_PRINCIPLES[phase]
    if (!phasePrinciples || phasePrinciples.length === 0) {
      return ''
    }

    const phaseName = PHASE_DISPLAY_NAMES[phase]
    return `
## ${phaseName.toUpperCase()} PHASE PRINCIPLES

These principles are specific to the ${phaseName.toLowerCase()} phase:
${phasePrinciples.map(p => formatPrincipleForPrompt(p)).join('\n')}
`
  }).filter(s => s.length > 0).join('\n')

  return `
---

${universalSection}${phaseSections}
---
`
}

/**
 * Valid game phases for defensive validation
 */
const VALID_GAME_PHASES: Set<GamePhase> = new Set(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'])

/**
 * Build the drill configuration section for the prompt
 * Documents required drill counts and type distribution
 *
 * Includes defensive validation to clamp values to safe ranges
 */
export function buildDrillConfigSection(config: DrillGenerationConfig): string {
  // Defensive validation: clamp targetDrillCount to safe range (5-50)
  const safeTargetCount = Math.max(5, Math.min(50, config.targetDrillCount || 21))

  // Defensive validation: clamp directDrillRatio to 0-1 range
  const safeRatio = Math.max(0, Math.min(1, config.directDrillRatio ?? 0.7))

  // Defensive validation: filter to valid phases only, default to OPENING if empty
  const safePhases = (config.gamePhases || [])
    .filter((phase): phase is GamePhase => VALID_GAME_PHASES.has(phase))
  const effectivePhases = safePhases.length > 0 ? safePhases : ['OPENING'] as GamePhase[]

  const directCount = Math.round(safeTargetCount * safeRatio)
  const principleCount = safeTargetCount - directCount

  const phasesDisplay = effectivePhases.join(', ')

  return `
---

## DRILL GENERATION CONFIGURATION

**MANDATORY REQUIREMENTS - You MUST follow these specifications exactly:**

### Target Counts
- **Total drills to generate:** ${config.targetDrillCount}
- **Game phases to cover:** ${phasesDisplay}

### Hierarchical Organization
- **CRITICAL:** Organize drills hierarchically within each phase:
  - Each phase contains multiple **principleGroups[]**
  - Each principle group focuses on ONE phase-specific principle
  - Each principle group contains 2-4 drills (or more if needed)
  - Distribute drills evenly across all principle groups within the phase

### Drill Type Distribution
- **Direct "best move" drills:** ${directCount} drills (${Math.round(config.directDrillRatio * 100)}%)
  - Present a position and ask: "What is the best move?"
  - Use provided positions with engine-verified answers
  - Focus on pattern recognition and move selection
  - Must have primaryPrincipleId matching the principle being practiced

- **Principle-focused drills:** ${principleCount} drills (${Math.round((1 - config.directDrillRatio) * 100)}%)
  - Test understanding of WHY moves are correct
  - Use methodologies from the index (Error Detection, Case Analysis, etc.)
  - May reference positions but focus on reasoning
  - Must have primaryPrincipleId matching the principle being practiced

### Drill Distribution Example
For ${safeTargetCount} total drills across ${phasesDisplay}:
- If covering OPENING phase with 2 principles (point-making, tempo-development):
  - Create ~${Math.floor(safeTargetCount / 2)} drills in point-making group
  - Create ~${Math.ceil(safeTargetCount / 2)} drills in tempo-development group
  - Each drill tagged with primaryPrincipleId and optional universalPrincipleIds

### Validation Rules
1. Total drill count MUST equal ${safeTargetCount}
2. Direct drill count MUST be approximately ${directCount} (±1)
3. Every position provided MUST be used in exactly one drill
4. All drills MUST cover the specified phases: ${phasesDisplay}
5. Each phase MUST have principleGroups[] with drills distributed evenly
6. Each drill's primaryPrincipleId MUST match its parent principle group

---
`
}

export function buildDrillDesignerPrompt(params: DrillDesignerPromptParams): string {
  const { domain, corpusSummary, mentalModel, curriculum, userNotes, seededPositions, drillConfig } = params

  // Use provided config or defaults
  const config = drillConfig ?? DEFAULT_DRILL_CONFIG

  // Build positions section if provided (filtered by config phases)
  const positionsSection = seededPositions
    ? buildPositionsSection(seededPositions, config)
    : ''

  // Build drill configuration section
  const drillConfigSection = buildDrillConfigSection(config)

  // Build principle taxonomy section
  const principleSection = buildPrincipleSection(config)

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\nThe user has provided these additional notes:\n${userNotes}\n\nIntegrate this guidance into your design process and final output.\n`
    : ''

  return `
# TASK: Design Practice Drills for ${domain}

You are creating practice drills for ${domain} that reinforce the principles from the mental model through deliberate practice.
${drillConfigSection}
${principleSection}
${positionsSection}
---

## DRILL METHODOLOGIES (Use 4+ different types)

**RECALL:** Recognition, Cued Recall, Discrimination
**APPLICATION:** Error Detection, Case Analysis, Worked Example, Completion
**TRANSFER:** Novel Problem, Principle Synthesis, Context Shift, Adversarial
**METACOGNITIVE:** Self-Explanation, Prediction, Confidence Calibration

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

## MENTAL MODEL SUMMARY

**Domain:** ${mentalModel.domainTitle}
**Approach:** ${mentalModel.teachingApproach}

**Categories:** ${mentalModel.categories.slice(0, 5).map(c => c.name).join(', ')}${mentalModel.categories.length > 5 ? ` (+${mentalModel.categories.length - 5} more)` : ''}

---

## CURRICULUM SUMMARY

**Title:** ${curriculum.curriculumTitle || 'Untitled'}
**Duration:** ${curriculum.estimatedDuration || 'Unknown'}

**Phases Covered:** ${(curriculum.phaseModules || []).map((m: { phase?: string }) => m.phase || 'Unknown').join(', ') || 'Standard progression'}

---

## CORPUS KNOWLEDGE BASE (Summary)

${corpusSummary.length > 2000 ? corpusSummary.slice(0, 2000) + '\n\n[...truncated for token efficiency...]' : corpusSummary}

---

## OUTPUT REQUIREMENTS

**CRITICAL: Use the hierarchical structure: phases[] → principleGroups[] → drills[]**

Generate a phase-organized drill series with this exact structure:

### Top-Level Fields
- **drillSeriesTitle**: Overall title for the entire series
- **totalDrillCount**: Total number of drills across all phases
- **estimatedCompletionMinutes**: Total estimated time for all drills

### Hierarchical Structure
- **phases**: Array of phase sections, each containing:
  - **phase**: Game phase enum (OPENING, EARLY, MIDDLE, or BEAROFF)
  - **phaseTitle**: Display name for the phase
  - **phaseDescription**: Brief explanation of what this phase covers
  - **targetDrillCount**: How many drills should be in this phase
  - **actualDrillCount**: Actual number of drills generated
  - **universalPrinciples**: Array of universal principles relevant to this phase
    - id: Principle ID (e.g., "pip-count")
    - name: Display name
  - **principleGroups**: Array of principle groups (HIERARCHICAL LAYER), each containing:
    - **principleId**: Phase-specific principle ID (e.g., "point-making")
    - **principleName**: Display name for the principle
    - **principleDescription**: Brief explanation of the principle
    - **drillCount**: Number of drills in this group
    - **drills**: Array of drills for THIS SPECIFIC PRINCIPLE, each with:
      - **drillId**: Unique identifier
      - **tier**: RECOGNITION, APPLICATION, or TRANSFER
      - **methodology**: From the methodology index (e.g., "Error Detection")
      - **gamePhase**: The phase this drill belongs to
      - **positionId**: Position library ID if using seeded positions
      - **primaryPrincipleId**: THE phase-specific principle being practiced (MUST match principleId of parent group)
      - **universalPrincipleIds**: Array of universal principle IDs also reinforced (can be empty)
      - **scenario**: Setup description for the drill
      - **question**: The question being asked
      - **answerFormat**: MULTIPLE_CHOICE, MOVE_SELECTION, or POSITION_EVAL
      - **options**: Array of option objects, each with: { id: string, text: string, isCorrect: boolean }
      - **correctAnswer**: ID of correct option (e.g., "opt-a")
      - **explanation**: Why the correct answer is correct
      - **feedback**: Object with correct/incorrect/partialCredit feedback strings
      - **hints**: Array of progressive hints (optional)
      - **relatedConcepts**: Array of related concept strings (optional)

### Design Thoughts Field (Required)
- **designThoughts**: Object documenting your drill design thinking:
  - **methodologyRationale**: Why you chose these specific methodologies
  - **varietyAnalysis**: How you ensured drill variety (list methodologies used with counts)
  - **pedagogicalNotes**: Any trade-offs or special considerations
  - **principleIntegration**: How you integrated universal and phase-specific principles

### EXAMPLE STRUCTURE

Here's a concrete example showing the hierarchical organization:

\`\`\`json
{
  "drillSeriesTitle": "Opening Game Mastery",
  "totalDrillCount": 6,
  "estimatedCompletionMinutes": 25,
  "phases": [
    {
      "phase": "OPENING",
      "phaseTitle": "Opening Rolls",
      "phaseDescription": "First roll decisions and opening theory",
      "targetDrillCount": 6,
      "actualDrillCount": 6,
      "universalPrinciples": [
        { "id": "pip-count", "name": "Pip Count Awareness" },
        { "id": "risk-reward", "name": "Risk vs Reward Assessment" }
      ],
      "principleGroups": [
        {
          "principleId": "point-making",
          "principleName": "Point-Making Priority",
          "principleDescription": "Understanding which points to prioritize",
          "drillCount": 3,
          "drills": [
            {
              "drillId": "opening-point-making-1",
              "tier": "RECOGNITION",
              "methodology": "Recognition",
              "gamePhase": "OPENING",
              "positionId": "opening-31",
              "primaryPrincipleId": "point-making",
              "universalPrincipleIds": ["risk-reward"],
              "scenario": "You rolled 3-1 on your opening roll...",
              "question": "What is the best move?",
              "answerFormat": "MULTIPLE_CHOICE",
              "options": [
                { "id": "opt-a", "text": "8/5 6/5 (Make the 5-point)", "isCorrect": true },
                { "id": "opt-b", "text": "13/10 6/5 (Split and slot)", "isCorrect": false },
                { "id": "opt-c", "text": "24/21 13/10 (Run with both)", "isCorrect": false }
              ],
              "correctAnswer": "opt-a",
              "explanation": "Making the 5-point is the best opening play...",
              "feedback": { "correct": "Excellent! The 5-point is the most valuable point to own.", "incorrect": "Not quite. Think about which points are most valuable to own early." }
            }
            // ... 2 more drills for point-making
          ]
        },
        {
          "principleId": "tempo-development",
          "principleName": "Tempo and Development",
          "principleDescription": "Balancing speed vs structure",
          "drillCount": 3,
          "drills": [
            // 3 drills focused on tempo-development
          ]
        }
      ]
    }
    // More phases if requested...
  ],
  "designThoughts": {
    "methodologyRationale": "Used Recognition for tier 1...",
    "varietyAnalysis": "Recognition: 2, Error Detection: 2, Case Analysis: 2",
    "pedagogicalNotes": "Emphasized point-making first as foundational...",
    "principleIntegration": "Tagged each drill with primary principle and relevant universal principles"
  }
}
\`\`\`

### CRITICAL VALIDATION RULES
1. Each phase MUST contain principleGroups[] (NOT a flat drills[] array)
2. Each principleGroup MUST contain drills for ONLY ONE phase-specific principle
3. Each drill's primaryPrincipleId MUST match the principleId of its parent group
4. Each drill can reference 0 or more universalPrincipleIds
5. Distribute drills across principle groups within each phase
6. Every seeded position MUST be used in exactly one drill

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
