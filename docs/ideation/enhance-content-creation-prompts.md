# Enhance Teaching Content Creation Prompts

**Slug:** enhance-content-creation-prompts
**Author:** Claude Code
**Date:** 2025-12-08
**Related:** `lib/guruFunctions/prompts/`, CLAUDE.md

---

## 1) Intent & Assumptions

**Task brief:** Investigate and improve the content creation prompts (mental model, curriculum, drills) to produce richer, more thoughtful teaching content. The goal is to create a robust system prompt describing a brilliant, creative "teaching content" creator, with protocol-based standard user prompts for each content type that require deliberate consideration of multiple approaches before selection.

**Assumptions:**
- Current prompts are functional but lack the depth to produce consistently excellent content
- Users want transparency into the AI's reasoning process when selecting approaches
- A drill methodology index would help ensure diverse, appropriate drill designs
- The same protocol-based thinking should apply to all three content types
- User-provided context should be additive to (not replacing) standard prompts

**Out of scope:**
- Changes to the Zod schemas or output structures
- UI redesign beyond adding a "user notes" textbox
- Changes to the Inngest job orchestration
- Performance optimization of generation times

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `lib/guruFunctions/prompts/mentalModelPrompt.ts` | ~88 lines. Good structure but minimal creative philosophy. System role is brief (1 line in generator). No protocol requiring approach consideration. |
| `lib/guruFunctions/prompts/curriculumPrompt.ts` | ~101 lines. Progressive disclosure philosophy present. No creative selection protocol. Relies on mental model JSON dump (can be overwhelming). |
| `lib/guruFunctions/prompts/drillDesignerPrompt.ts` | ~130 lines. Three-tier difficulty system. No methodology index or selection reasoning. Most formulaic of the three. |
| `lib/guruFunctions/generators/mentalModelGenerator.ts` | System message: "You are an expert instructional designer creating mental models for teaching." - Generic, uninspiring. |
| `lib/guruFunctions/generators/curriculumGenerator.ts` | System message: "You are an expert curriculum designer creating progressive disclosure learning content." - Slightly better but still generic. |
| `lib/guruFunctions/generators/drillDesigner.ts` | System message: "You are an expert in deliberate practice drill design for skill development." - Competent but not creative. |
| `components/guru/GuruTeachingManager.tsx` | UI has no textbox for user notes. `handleGenerate()` passes empty object `{}` - userNotes infrastructure exists in API but unused in UI. |
| `app/api/projects/[id]/guru/*/route.ts` | All three routes accept `userNotes` parameter. Infrastructure ready. |

---

## 3) Codebase Map

**Primary components/modules:**
- `lib/guruFunctions/prompts/` - Three prompt builder functions (mental model, curriculum, drills)
- `lib/guruFunctions/generators/` - Three generator functions using OpenAI API
- `lib/guruFunctions/schemas/` - Zod schemas defining output structures
- `app/api/projects/[id]/guru/` - API routes triggering Inngest jobs
- `components/guru/GuruTeachingManager.tsx` - Main UI component

**Shared dependencies:**
- OpenAI GPT-4o with structured outputs (strict: true)
- Zod for schema validation
- Inngest for background job execution
- `corpusHasher.ts` for corpus summary composition

**Data flow:**
```
User → GuruTeachingManager → POST /api/.../guru/{type} → Inngest Job
  → Generator → buildXPrompt() → OpenAI → Zod validation → DB save
```

**Potential blast radius:**
- Prompt changes affect all new generations (no existing data impact)
- Adding UI textbox requires GuruTeachingManager update
- Schema changes would break existing artifacts (NOT in scope)

---

## 4) Root Cause Analysis

N/A - This is an enhancement request, not a bug fix.

---

## 5) Current State Analysis

### What Exists Today

**System Messages (in generators):**
```typescript
// Mental Model
'You are an expert instructional designer creating mental models for teaching.'

// Curriculum
'You are an expert curriculum designer creating progressive disclosure learning content.'

// Drills
'You are an expert in deliberate practice drill design for skill development.'
```

These are minimal, generic, and uninspiring. They don't establish a creative philosophy or require thoughtful approach selection.

**User Prompts (in prompt builders):**

The prompts are functional but:
1. **No protocol for approach consideration** - Jump straight to "generate now"
2. **No reasoning transparency** - No requirement to explain design choices
3. **Drill prompt is most formulaic** - Three tiers defined, but no methodology variety
4. **User notes are passive** - Simply appended without integration guidance

### Key Weaknesses

| Issue | Impact |
|-------|--------|
| Generic system prompts | AI lacks creative identity, produces safe/bland content |
| No approach exploration protocol | Missed opportunities for innovative designs |
| No reasoning output | User can't understand or guide AI's choices |
| No drill methodology index | Same drill patterns every time |
| Uninspired instruction tone | "Generate now" vs. "Consider, explore, then create" |

---

## 6) Research Findings

### Drill/Exercise Methodology Index

Based on instructional design research, here's a comprehensive taxonomy that could be embedded in prompts:

#### A. Memory & Recall Drills
1. **Recognition** - "Which of these is correct?"
2. **Cued Recall** - "Given this context, what's the principle?"
3. **Free Recall** - "List all principles that apply"
4. **Serial Recall** - "What's the correct sequence?"

#### B. Application Drills
1. **Worked Examples** - Study a solved problem, identify the principle used
2. **Faded Scaffolding** - Progressively remove hints
3. **Case Analysis** - Real-world scenario breakdown
4. **Simulation** - Interactive decision-making
5. **Error Identification** - "What's wrong with this approach?"

#### C. Transfer Drills
1. **Analogical Reasoning** - "How does principle X apply in domain Y?"
2. **Novel Problem** - Situation never seen before
3. **Constraint Variation** - Same problem, different constraints
4. **Principle Synthesis** - Multiple principles must combine

#### D. Metacognitive Drills
1. **Self-Explanation** - "Explain why this works"
2. **Prediction** - "What would happen if..."
3. **Comparison** - "How do approaches A and B differ?"
4. **Confidence Calibration** - Rate certainty, then verify

#### E. Engagement Patterns
1. **Story-Based** - Embedded in narrative
2. **Game Mechanics** - Points, levels, challenges
3. **Peer Teaching** - Explain to hypothetical novice
4. **Debate Format** - Argue both sides

### Protocol-Based Design Approach

Research supports a structured thinking protocol:

```
1. ANALYZE - Understand the domain and learner needs
2. EXPLORE - Consider multiple design approaches
3. EVALUATE - Assess fit against objectives
4. DECIDE - Select approach with explicit reasoning
5. CREATE - Generate content using chosen approach
6. REFLECT - Document rationale for transparency
```

---

## 7) Recommendations

### A. Create Shared Creative System Prompt

A rich, shared "teaching content creator" persona that all three generators use:

```typescript
// lib/guruFunctions/prompts/creativeSystemPrompt.ts

export const CREATIVE_TEACHING_SYSTEM_PROMPT = `
You are an innovative instructional designer with mastery of:
- Cognitive science (schema theory, cognitive load, transfer)
- Creative pedagogy (narrative learning, game mechanics, experiential design)
- Expert teaching (deliberate practice, progressive disclosure, mastery paths)

Your Philosophy:
1. MEMORABLE over comprehensive - What will stick?
2. TRANSFERABLE over contextual - What applies broadly?
3. ENGAGING over efficient - What sparks curiosity?
4. PRINCIPLED over procedural - What builds understanding?

Your Process:
Before creating ANY teaching content, you MUST:
1. Consider 2-3 different design approaches
2. Evaluate each against the domain and learner needs
3. Select one with explicit reasoning
4. Document your design rationale in the output

You never default to the obvious approach. You seek the approach that will make learning STICK.
`
```

### B. Protocol-Based User Prompts

Each content type gets an enhanced prompt with mandatory exploration:

**Mental Model Prompt Enhancement:**
```
## DESIGN PROTOCOL (Required)

Before generating, work through this protocol:

### Step 1: Domain Analysis
- What makes this domain challenging to learn?
- What do experts know that novices don't?
- What mental models do experts unconsciously use?

### Step 2: Approach Exploration
Consider these approaches for structuring the mental model:
- **Hierarchical**: Core → Supporting → Details
- **Process-Based**: Input → Transform → Output
- **Comparative**: What it is vs. what it isn't
- **Metaphorical**: Domain mapped to familiar concept

### Step 3: Approach Selection
Select the most fitting approach and explain:
- Which approach did you choose?
- Why does it fit this domain better than alternatives?
- What unique insight does this framing provide?

Document your reasoning in the `designRationale` field.
```

**Drill Design Prompt Enhancement:**
```
## DRILL METHODOLOGY INDEX

You have access to these proven drill methodologies:

### Memory & Recall
- Recognition (multiple choice on principle identification)
- Cued Recall (context-triggered principle retrieval)
- Serial Recall (sequence reconstruction)

### Application
- Worked Example Analysis (study solved problems)
- Faded Scaffolding (progressive hint removal)
- Error Detection (find the mistake)
- Case Study (real-world scenario)

### Transfer
- Analogical Reasoning (cross-domain application)
- Novel Problem (unseen situation)
- Principle Synthesis (combine multiple principles)

### Engagement Patterns
- Narrative-Embedded (story context)
- Debate/Compare (argue perspectives)
- Teach-Back (explain to novice)

## DESIGN PROTOCOL (Required)

### Step 1: Principle Analysis
For each principle, identify:
- What's the common novice error?
- What does expert recognition look like?
- What makes transfer difficult?

### Step 2: Methodology Selection
For each drill, consider 2-3 methodology options:
- Which methodology best targets the learning gap?
- Why is this more effective than alternatives?

### Step 3: Variety Check
Ensure your drill series includes:
- At least 3 different methodologies
- Mix of recall, application, and transfer
- At least one engagement-focused pattern

Document your methodology selection rationale in `designThoughts`.
```

### C. Schema Additions (Optional but Recommended)

Add fields to capture reasoning:

```typescript
// New optional field for mental model schema
designRationale: z.object({
  approachConsidered: z.array(z.string()),
  selectedApproach: z.string(),
  selectionReasoning: z.string(),
}).nullable().optional()

// New optional field for drill series schema
designThoughts: z.object({
  methodologyRationale: z.string(),
  varietyAnalysis: z.string(),
  pedagogicalNotes: z.string(),
}).nullable().optional()
```

### D. UI Enhancement

Update `GuruTeachingManager.tsx` to include:

```typescript
// State for user notes
const [userNotes, setUserNotes] = useState<Record<string, string>>({});

// In ArtifactCard, add before generate button:
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Additional guidance (optional)
  </label>
  <textarea
    value={userNotes[type] || ''}
    onChange={(e) => setUserNotes(prev => ({ ...prev, [type]: e.target.value }))}
    placeholder="E.g., 'Focus on visual learners' or 'Emphasize real-world applications'"
    className="w-full px-3 py-2 border rounded-md text-sm"
    rows={2}
  />
</div>

// Pass userNotes in handleGenerate:
body: JSON.stringify({ userNotes: userNotes[type] || undefined }),
```

---

## 8) Implementation Tasks

### Phase 1: Shared Creative System Prompt
1. Create `lib/guruFunctions/prompts/creativeSystemPrompt.ts`
2. Update all three generators to use it as the system message
3. Test that generation still works correctly

### Phase 2: Enhanced User Prompts
1. Add protocol sections to `mentalModelPrompt.ts`
2. Add protocol sections to `curriculumPrompt.ts`
3. Add drill methodology index and protocol to `drillDesignerPrompt.ts`
4. Test generation quality improvements

### Phase 3: Schema Additions (Optional)
1. Add `designRationale` to mental model schema
2. Add `designThoughts` to drill series schema
3. Update markdown renderers to display reasoning
4. Test that OpenAI strict mode accepts new fields

### Phase 4: UI Enhancement
1. Add userNotes state to `GuruTeachingManager.tsx`
2. Add textarea to `ArtifactCard` component
3. Pass userNotes to API calls
4. Test end-to-end flow

---

## 9) Clarifications Needed

1. **Reasoning transparency priority**: Should the design rationale be visible in the UI (rendered in markdown) or stored only for debugging?
>> visible in the UI. basically a section at the top of each apge should capture the "reasoning / rationale" and then below that the main body of the page is used to display the actual generated content. the user shoud ALWAYS have context on the thinking / design decisions behind the content they are reviewing

2. **Schema changes acceptance**: Are you comfortable with schema additions that require careful migration (`.nullable().optional()`)? If not, reasoning can be embedded in existing text fields.
>> sure. lets just make sure we save a snapshot of the db before we anything risky so that it is easy to roll back as many times as needed if the migration fails

3. **Drill methodology index scope**: Should the methodology index be:
   - A) Hardcoded in the prompt (simpler)
   - B) A separate config file the prompt references (more maintainable)
   - C) A database table allowing user customization (most flexible)
  >> hardcoded in the prompt, but the user should be able to view and edit both the system prompt and user prompt for each piece of content if they want to (but to be clear: that change would only apply only to that specific project — ie. every project starts with a standard system prompt and user prompt for all 3 of these content generation tasks, but the user can customize those from within their project if they choose to)

4. **Regeneration concerns**: Do you want the ability to regenerate with different "forced" approaches (e.g., "regenerate using narrative-based drills only")?
>> not beyond whats described in #3. so basiclaly the user can edit the prompts and if they do that, there's a simple "save" option (use this next time) but also a "save and regenerrate" prompt (use it right now). 

5. **Quality metrics**: Do you want to track which approaches/methodologies produce better user engagement over time?
>> not right now

---

## 10) Expected Outcomes

After implementation:

1. **Richer Content**: Mental models with thoughtful structure choices, curricula with varied engagement patterns, drills using diverse methodologies

2. **Transparency**: Each generation includes rationale explaining why approaches were chosen

3. **User Control**: Additional guidance textbox lets users steer generation without overriding good defaults

4. **Consistency**: Shared creative system prompt ensures all content embodies the same teaching philosophy

5. **Variety**: Drill methodology index prevents repetitive drill patterns

---

## Appendix: Current Prompts (For Reference)

### Mental Model System Message (Current)
```
You are an expert instructional designer creating mental models for teaching.
```

### Mental Model User Prompt Structure (Current)
```
# ROLE: Expert Instructional Designer & Mental Model Architect
## YOUR CORE MISSION (brief)
## GUIDING PHILOSOPHY (brief quotes)
## USER GUIDANCE (if provided)
## CORPUS KNOWLEDGE BASE
## OUTPUT REQUIREMENTS
## QUALITY CHECKLIST
Generate the mental model now.
```

### Drill Designer System Message (Current)
```
You are an expert in deliberate practice drill design for skill development.
```

### Drill Designer User Prompt Structure (Current)
```
# ROLE: Deliberate Practice Drill Designer
## DELIBERATE PRACTICE PHILOSOPHY (brief)
## THREE-TIER DIFFICULTY SYSTEM
## USER GUIDANCE (if provided)
## MENTAL MODEL FOUNDATION (JSON dump)
## CURRICULUM CONTEXT (JSON dump)
## CORPUS KNOWLEDGE BASE
## OUTPUT REQUIREMENTS
## FEEDBACK REQUIREMENTS
## ASCII WIREFRAMES
## QUALITY CHECKLIST
Generate the drill series now.
```

The current prompts work but lack the creative exploration and methodology diversity that would produce truly excellent teaching content.
