# Guru Builder - Simplified Frontend Prototype Handoff

**Purpose:** This document provides everything needed to prototype a streamlined, non-technical-user-friendly frontend wrapper for the Guru Builder system. The prototype will eventually plug into the real backend described here.

**Target User:** Domain experts (e.g., backgammon masters) who want to create AI teaching assistants without technical knowledge.

---

## Vision: The 4-Phase User Journey

The simplified frontend guides users through four intuitive phases:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  PHASE 1        │     │  PHASE 2        │     │  PHASE 3        │     │  PHASE 4        │
│  Create Your    │ ──▶ │  Build Its      │ ──▶ │  Review         │ ──▶ │  Create         │
│  Guru Profile   │     │  Knowledge      │     │  Findings       │     │  Artifacts      │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
     Brain Dump              Research               Approve/              Mental Models
     + Interview             Assistant              Reject                Curriculum
     = Profile               Runs                   Changes               Drills
```

---

## Phase 1: Guru Profile Creation

### User Experience

1. **Brain Dump Input**
   - User describes their ideal teaching guru in natural language
   - Can be text or voice (speech-to-text)
   - "Just tell us about the guru you have in mind..."
   - Example: *"I want a backgammon guru that teaches the 'Magriel school' approach, focusing on safe vs bold play decisions, with a patient Socratic teaching style that asks probing questions rather than just giving answers..."*

2. **AI Synthesis Display**
   - System shows the user: "Here's what I understood about your guru:"
   - Structured profile with ~15 fields displayed cleanly
   - Visual indication of confidence levels (which fields were clearly stated vs inferred)

3. **Follow-up Interview**
   - AI asks 3-5 contextual follow-up questions
   - Questions are specific to gaps or low-confidence areas
   - Example: *"You mentioned the Magriel school - should your guru also incorporate modern computer-era adjustments, or stay purely classical?"*

4. **Profile Refinement**
   - Shows updated profile with change summary
   - User can continue refining or accept and proceed

### Backend Data Model

```typescript
GuruProfile {
  // Domain & Expertise
  domainExpertise: string           // "Backgammon"
  specificTopics: string[]          // ["Opening theory", "Pip count", "Cube decisions"]

  // Audience
  audienceLevel: "beginner" | "intermediate" | "advanced" | "mixed"
  audienceDescription: string       // "Club players wanting to reach expert level"

  // Teaching Style
  pedagogicalApproach: string       // "Socratic method with progressive complexity"
  tone: "formal" | "conversational" | "encouraging" | "direct" | "socratic"
  communicationStyle: string        // "Patient, uses analogies, asks probing questions"

  // Content Preferences
  emphasizedConcepts: string[]      // ["Position evaluation", "Risk assessment"]
  avoidedTopics: string[]           // ["Gambling/betting aspects"]
  examplePreferences: string        // "Real game positions from famous matches"

  // Unique Characteristics
  uniquePerspective: string         // "Magriel school with computer-era adjustments"
  commonMisconceptions: string[]    // ["Thinking all blots are bad"]
  successMetrics: string            // "Student can evaluate positions within 0.05 equity"

  // System Fields (hidden from simple UI)
  lightAreas: string[]              // Fields AI wasn't confident about
  rawBrainDump: string              // Original user input
  synthesisMode: "TEXT" | "VOICE"
}
```

### API Integration

```
POST /api/projects
  Body: { name, description, guruProfile: {...} }
  Creates project + initial profile

POST /api/projects/[id]/guru-profile
  Body: { profileData, rawBrainDump, lightAreas }
  Updates profile after interview
```

---

## Phase 2: Research & Knowledge Building

### User Experience

1. **Onboarding Tutorial** (one-time)
   - Brief visual explanation:
     - *"Your guru needs a knowledge base (we call it a 'corpus')"*
     - *"You'll give research prompts, I'll search and find relevant knowledge"*
     - *"I'll show you what I found and suggest how to add it to your guru's brain"*
     - *"As you run more research, your guru gets smarter"*
   - For domain-specific projects (backgammon):
     - *"We've already set up a library of verified game positions for your drills"*
     - *"We've connected a 'ground truth' engine to verify all answers are mathematically correct"*

2. **Research Assistant Chat**
   - Split-panel interface:
     - **Left Panel:** Chat with AI research assistant
     - **Right Panel:** Refined research plan/prompt

   - User brain dumps what they want to research:
     - *"I want to find information about the modern priming game, especially how it differs from classical approaches, and maybe look at some recent tournament games..."*

   - AI assistant refines this into structured research prompt:
     - Identifies specific search queries
     - Suggests depth (quick scan vs deep dive)
     - Shows research plan outline

   - User approves: "Execute"

3. **Research Progress**
   - Simple progress indicator while research runs (30 seconds - 3 minutes)
   - Stages shown: "Searching... Analyzing... Synthesizing..."

### Backend Data Model

```typescript
ResearchRun {
  instructions: string              // The refined research prompt
  depth: "QUICK" | "MODERATE" | "DEEP"
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
  progressStage?: string            // Current stage for UI
}
```

### API Integration

```
POST /api/research-runs
  Body: { projectId, instructions, depth }
  Returns: { run: { id, status } }

GET /api/research-runs?projectId=X&status=RUNNING
  Poll for progress updates
```

### Corpus Structure (Hidden from Simple UI)

The backend organizes knowledge into two types:
- **Context Layers** - Core DNA/personality (always loaded)
- **Knowledge Files** - Reference knowledge (conditionally loaded)

The simplified UI abstracts this - users just see "your guru's knowledge" without needing to understand the technical distinction.

---

## Phase 3: Findings & Recommendations Review

### User Experience

1. **Results Summary**
   - Clean presentation: "I found X things that could improve your guru"
   - Grouped by type: New additions, Updates to existing, Removals

2. **Recommendation Cards**
   Each recommendation shows:
   - **Title:** Clear description of the change
   - **Confidence:** Visual indicator (high/medium/low)
   - **Impact:** How much this affects the guru
   - **Preview:** One-click to see exactly what would change
   - **Actions:** Approve / Reject buttons

3. **Diff Preview** (on click)
   - For edits: Side-by-side or inline diff view
   - For additions: Preview of new content
   - For deletions: What would be removed
   - Clear, non-technical presentation

4. **Batch Apply**
   - "Apply X Approved Changes" button
   - Brief processing animation
   - Success confirmation with summary

5. **Corpus Visualization**
   - After applying, show updated "brain" visualization
   - Highlight what changed from this research run
   - Show total knowledge accumulated

### Backend Data Model

```typescript
Recommendation {
  action: "ADD" | "EDIT" | "DELETE"
  targetType: "LAYER" | "KNOWLEDGE_FILE"

  title: string                     // "Add Magriel's Key Position Concepts"
  description: string               // Why this is recommended
  fullContent: string               // The actual content to add/edit
  reasoning: string                 // AI's explanation

  confidence: number                // 0.0 - 1.0
  impactLevel: "LOW" | "MEDIUM" | "HIGH"

  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED"
}
```

### API Integration

```
GET /api/recommendations?researchRunId=X
  Returns all recommendations with stats

POST /api/recommendations/[id]/approve
POST /api/recommendations/[id]/reject

POST /api/projects/[id]/apply-recommendations
  Body: { recommendationIds: [...] }
  Applies all approved changes
```

---

## Phase 4: Teaching Artifact Creation

### User Experience

1. **Artifact Type Selection**
   - Three clear options with simple explanations:
     - **Mental Model:** "The core framework - how your guru thinks about the subject"
     - **Curriculum:** "Structured lessons organized for progressive learning"
     - **Drill Series:** "Practice exercises to reinforce specific skills"

2. **Generation** (one-click)
   - "Generate Mental Model" button
   - Progress indicator with friendly stages:
     - "Analyzing your guru's knowledge..."
     - "Designing the structure..."
     - "Creating content..."
     - "Verifying accuracy..." (if ground truth enabled)

3. **Artifact Viewing**
   - Clean, rendered view by default
   - Focus on content, not metadata
   - Smooth navigation (table of contents for long content)

   - **Hidden by default** (accessible via "Details" or settings):
     - Version history
     - Prompt configuration
     - Verification status
     - Technical metadata

4. **Iteration**
   - Simple "Regenerate" option if not satisfied
   - Optional notes: "Make it more focused on X"

### Artifact Types

**Mental Model Output:**
```typescript
{
  domainTitle: string
  teachingApproach: string
  categories: [
    {
      name: string
      description: string
      principles: [
        {
          name: string
          essence: string              // Core concept
          whyItMatters: string
          commonMistake: string
          recognitionPattern: string   // How to spot when to apply
        }
      ]
    }
  ]
  masterySummary: string
}
```

**Curriculum Output:**
```typescript
{
  phaseModules: [
    {
      phase: "OPENING" | "EARLY" | "MIDDLE" | "BEAROFF"
      phaseTitle: string
      principleUnits: [
        {
          principleName: string
          lessons: [
            {
              type: "CONCEPT" | "EXAMPLE" | "CONTRAST" | "PRACTICE"
              title: string
              content: {
                headline: string
                essence: string
                expandedContent: string
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Drill Series Output:**
```typescript
{
  phases: [
    {
      phase: "OPENING" | "EARLY" | "MIDDLE" | "BEAROFF"
      principleGroups: [
        {
          principleName: string
          drills: [
            {
              tier: "RECOGNITION" | "APPLICATION" | "TRANSFER"
              scenario: string
              question: string
              options: [{ text, isCorrect }]
              explanation: string
              feedback: { correct, incorrect }
            }
          ]
        }
      ]
    }
  ]
}
```

### API Integration

```
POST /api/projects/[id]/guru/mental-model
POST /api/projects/[id]/guru/curriculum
POST /api/projects/[id]/guru/drill-series
  Body: { userNotes?: string }
  Returns: { artifact: { id, status: "GENERATING" } }

GET /api/projects/[id]/guru/artifacts
  Poll for status/progress

GET /api/projects/[id]/guru/artifacts/[artifactId]
  Get full content when complete
```

---

## Domain-Specific Features (Backgammon Example)

### Position Library
- Pre-populated with 460+ verified positions across all game phases
- Positions are seeded into drill generation automatically
- User doesn't interact directly - just knows drills use "real positions"

### Ground Truth Engine (GNU Backgammon)
- Verifies all generated answers are mathematically correct
- Runs automatically during artifact generation
- User sees: "✓ Verified" badge (or warning if issues found)
- Technical details hidden unless user wants them

### Integration Points (Hidden from Simple UI)
```
GET /api/ground-truth-engines
  Available verification engines

POST /api/projects/[id]/ground-truth-config
  Body: { engineId, isEnabled: true }
  Enable verification for project
```

---

## UI Design Principles for Prototype

### 1. Progressive Disclosure
- Show only what's needed at each step
- Advanced options tucked away in "Settings" or "Details"
- No technical jargon on main screens

### 2. Conversational Interface
- Chat-like interactions for brain dumps and research prompts
- AI feels like a helpful assistant, not a form to fill out
- Natural language throughout

### 3. Visual Feedback
- Clear progress indicators for async operations
- Success/completion celebrations
- Gentle error messages with suggestions

### 4. Clean Content Focus
- Artifacts displayed as beautiful, readable content
- Metadata and version info accessible but not prominent
- Print/export-friendly views

### 5. Guided Flow
- Clear "next step" at each phase
- Easy to go back and iterate
- Progress indicator showing overall journey

---

## Prototype Navigation Structure

```
/welcome
  └── Onboarding flow (one-time)

/projects
  └── Project list
      └── "Create New Guru" button

/projects/new
  └── Phase 1: Guru Profile Creation
      ├── Brain dump input
      ├── Profile synthesis display
      ├── Follow-up interview
      └── Profile confirmation

/projects/[id]
  └── Project Dashboard
      ├── Guru Profile summary (editable)
      ├── Knowledge status (X items)
      ├── Available artifacts
      └── Quick actions

/projects/[id]/research
  └── Phase 2: Research Assistant
      ├── Chat panel (left)
      ├── Research plan panel (right)
      └── Execute button

/projects/[id]/research/[runId]
  └── Phase 3: Findings Review
      ├── Progress (if running)
      ├── Recommendations list
      ├── Approval actions
      └── Apply button

/projects/[id]/artifacts
  └── Phase 4: Teaching Artifacts
      ├── Artifact type cards
      ├── Generate buttons
      └── Artifact list

/projects/[id]/artifacts/[artifactId]
  └── Artifact Viewer
      ├── Clean rendered content
      ├── Navigation (TOC)
      └── Details (hidden toggle)
```

---

## Mock Data for Prototyping

### Sample Guru Profile (Backgammon)
```json
{
  "domainExpertise": "Backgammon",
  "specificTopics": ["Opening play", "Priming strategy", "Pip counting", "Cube decisions"],
  "audienceLevel": "intermediate",
  "audienceDescription": "Club players aiming for tournament-level play",
  "pedagogicalApproach": "Socratic questioning with progressive complexity",
  "tone": "encouraging",
  "communicationStyle": "Patient, uses real game examples, asks 'what would you do?' before explaining",
  "emphasizedConcepts": ["Position evaluation", "Risk/reward assessment", "Game phase recognition"],
  "avoidedTopics": ["Gambling aspects", "Money management"],
  "examplePreferences": "Classic Magriel positions plus modern computer-analyzed games",
  "uniquePerspective": "Blends Magriel's intuitive approach with computer-era precision",
  "commonMisconceptions": ["All blots are bad", "Always make points", "Racing is simple"],
  "successMetrics": "Student can evaluate a position within 0.05 equity of computer analysis"
}
```

### Sample Research Instructions
```
"Research modern priming strategies in backgammon, focusing on:
- When to start building a prime vs playing more flexibly
- Key positions that illustrate prime vs anti-prime decisions
- How computer analysis has changed classical priming theory
- Common mistakes intermediate players make in priming games"
```

### Sample Recommendation
```json
{
  "action": "ADD",
  "title": "Modern Priming Principles",
  "description": "Key concepts about when and how to build primes in contemporary play",
  "confidence": 0.87,
  "impactLevel": "HIGH",
  "reasoning": "This addresses a gap in the current corpus around priming strategy, which is central to the Magriel school approach specified in the guru profile.",
  "fullContent": "# Modern Priming Strategy\n\n## When to Prime\n- Start prime construction when you have 3+ checkers in your opponent's home board...\n[continues with detailed content]"
}
```

---

## What the Prototype Should Demonstrate

1. **Phase 1 Flow**
   - Text/voice brain dump input
   - AI-synthesized profile display
   - Interactive follow-up Q&A
   - Profile acceptance

2. **Phase 2 Flow**
   - Research assistant chat interface
   - Real-time prompt refinement
   - Research execution with progress

3. **Phase 3 Flow**
   - Recommendation cards with approve/reject
   - Diff preview on click
   - Batch apply with success feedback
   - Updated corpus visualization

4. **Phase 4 Flow**
   - Artifact type selection
   - Generation with progress
   - Clean content viewing
   - Hidden details accessible but not prominent

5. **Overall UX**
   - Non-technical language throughout
   - Clear guidance at each step
   - Visual progress through journey
   - Professional, calm aesthetic

---

## Technical Notes for Integration

When connecting the prototype to the real backend:

### Polling Patterns
Research runs and artifact generation are async. Poll these endpoints:
```javascript
// Research: poll until status !== "RUNNING" AND recommendationCount > 0
// Artifacts: poll until status === "COMPLETED" or "FAILED"
```

### Error Handling
- Research can fail (API limits, no results)
- Artifacts can fail (generation errors)
- Always show friendly error messages with retry options

### Authentication
- Supabase email/password auth
- Session cookie-based
- Protected routes redirect to /login

### Caching
- Use `Cache-Control: no-store` on polling endpoints
- Fresh data important during async operations

---

## Files in Existing System to Reference

For implementation details, these files in the real system are most relevant:

**API Routes:**
- `app/api/projects/[id]/guru-profile/route.ts` - Profile synthesis
- `app/api/research-runs/route.ts` - Research execution
- `app/api/recommendations/route.ts` - Recommendation management
- `app/api/projects/[id]/guru/artifacts/route.ts` - Artifact CRUD

**UI Components (for inspiration):**
- `components/guru/GuruProfileOnboardingModal.tsx` - Profile creation
- `components/research/NewResearchForm.tsx` - Research input
- `components/artifacts/ArtifactViewerWithVersions.tsx` - Content viewing
- `components/artifacts/renderers/*` - Type-specific rendering

**Types:**
- `lib/guruProfile/types.ts` - Profile structure
- `lib/guruFunctions/types.ts` - Artifact types
- `prisma/schema.prisma` - Complete data model

---

*Document created for Claude Desktop prototyping session. The prototype should focus on user experience and flow, with mock data, before integrating with the real backend APIs.*
