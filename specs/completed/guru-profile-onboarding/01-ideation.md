# Guru Profile Brain Dump Onboarding

**Slug:** guru-profile-onboarding
**Author:** Claude Code
**Date:** 2025-12-10
**Branch:** preflight/guru-profile-onboarding
**Related:**
- `specs/feat-guru-builder-system-mvp.md`
- `specs/feat-per-project-prompt-customization.md`
- `docs/implementation-scaffolds/ai-brain-dump-synthesis/`

---

## 1) Intent & Assumptions

**Task brief:** Implement a "Guru Profile" brain dump onboarding flow that captures the user's teaching intent through natural language input (voice or text), synthesizes it into a structured profile, and integrates that profile into all teaching artifact generation prompts. This gives the system a rich understanding of the type of guru being built and the teaching experience desired.

**Assumptions:**
- Users have a vision for their teaching guru but may not articulate it in structured fields
- Natural language "brain dump" captures richer context than form fields alone
- The guru profile should inform ALL teaching artifacts (Mental Model, Curriculum, Drill Series)
- Existing projects without profiles should continue to work (backward compatibility)
- Voice input is desirable but text should be the fallback
- The brain dump synthesis scaffold in `docs/implementation-scaffolds/ai-brain-dump-synthesis/` provides a proven pattern to adapt

**Out of scope:**
- Replacing the existing custom prompt system (this complements it)
- Mandatory profile creation for existing projects (opt-in)
- Complex multi-step wizard beyond Input → Preview → Save
- Voice-only input (text always available as fallback)
- AI avatar/persona visualization
- Chat-based conversational profile refinement (simpler iterative textarea refinement)

---

## 2) Pre-reading Log

### Documentation
- `docs/implementation-scaffolds/ai-brain-dump-synthesis/README.md`: Portable feature for voice/text brain dump → structured profile. 2-step wizard (Input → Preview → Save) with iterative refinement.
- `docs/implementation-scaffolds/ai-brain-dump-synthesis/ARCHITECTURE.md`: System prompt + user prompt pattern, 60s timeout with AbortController, `response_format: { type: 'json_object' }`, temperature 0.3 for consistent extraction.
- `docs/implementation-scaffolds/ai-brain-dump-synthesis/ADAPTATION-GUIDE.md`: Key customization points - schema design, prompt builder functions, frontend modal adaptation.
- `developer-guides/01-overall-architecture.md`: Next.js 15 + React 19 + Vercel AI SDK v5 + Prisma + Inngest stack.
- `specs/feat-per-project-prompt-customization.md`: Existing custom prompt system with `ProjectPromptConfig` model and hash-based drift detection.

### Source Code Scaffolds
- `docs/implementation-scaffolds/ai-brain-dump-synthesis/source-code/backend-service.ts`: LLM synthesis service with prompt builders, 60s timeout, gpt-4-turbo model.
- `docs/implementation-scaffolds/ai-brain-dump-synthesis/source-code/frontend-modal.tsx`: 2-step modal component (input → preview) with voice input hook integration.
- `docs/implementation-scaffolds/ai-brain-dump-synthesis/source-code/frontend-hook.ts`: `useSpeechRecognition` hook for browser native voice input.

### Codebase Files
- `app/projects/CreateProjectButton.tsx`: Current project creation modal - simple name/description form. Integration point for guru profile onboarding.
- `app/api/projects/route.ts`: Project CRUD API - needs extension for guru profile fields.
- `prisma/schema.prisma`: Project model has `name`, `description`, `userId`. No profile-specific fields yet.
- `lib/guruFunctions/prompts/creativeSystemPrompt.ts`: Shared system prompt for all artifact generation.
- `lib/guruFunctions/prompts/mentalModelPrompt.ts`: User prompt with `{{domain}}`, `{{corpusSummary}}`, `{{userNotes}}` variables.
- `lib/guruFunctions/generators/mentalModelGenerator.ts`: Composes prompts with variable substitution, calls OpenAI.
- `lib/inngest-functions.ts`: Background job orchestration - fetches project + corpus, resolves custom prompts, generates artifacts.

---

## 3) Codebase Map

### Primary Components/Modules

| Component | Path | Role |
|-----------|------|------|
| Project Creation UI | `app/projects/CreateProjectButton.tsx` | Modal for new project creation - entry point for profile onboarding |
| Project API | `app/api/projects/route.ts` | CRUD operations for projects |
| Project Schema | `prisma/schema.prisma` (lines 35-58) | Data model - needs guru profile fields |
| Mental Model Generator | `lib/guruFunctions/generators/mentalModelGenerator.ts` | Prompt composition + OpenAI call |
| Curriculum Generator | `lib/guruFunctions/generators/curriculumGenerator.ts` | Uses mental model, same pattern |
| Drill Series Generator | `lib/guruFunctions/generators/drillSeriesGenerator.ts` | Uses mental model + curriculum |
| Prompt Builders | `lib/guruFunctions/prompts/` | Build user prompts with variable substitution |
| Inngest Jobs | `lib/inngest-functions.ts` (lines 330-730) | Background artifact generation orchestration |
| Prompt Resolver | `lib/guruFunctions/promptResolver.ts` | Resolves custom vs default prompts |

### Shared Dependencies
- **Prisma Client**: Database access throughout
- **OpenAI SDK**: GPT-4o API calls in generators
- **Inngest Client**: Background job orchestration
- **Zod**: Schema validation for structured outputs
- **shadcn/ui**: UI components

### Data Flow
```
User Brain Dump (voice/text)
    ↓
POST /api/projects/synthesize-profile { rawInput, additionalContext? }
    ↓
GPT-4o extracts structured GuruProfile
    ↓
Preview shown to user
    ↓
User confirms (optional refinement loop)
    ↓
POST /api/projects { name, description, guruProfile }
    ↓
Project created with profile stored in DB
    ↓
Artifact Generation Triggered
    ↓
Generator reads project.guruProfile
    ↓
Profile injected into user prompt as {{guruProfile}} section
    ↓
GPT-4o generates artifact with profile context
```

### Feature Flags/Config
- No feature flags currently - this would be a core feature
- Consider: `ENABLE_GURU_PROFILE_ONBOARDING` env var for gradual rollout

### Potential Blast Radius
1. **Project Creation Flow** - UI and API changes
2. **Database Schema** - New fields on Project model
3. **All Prompt Builders** - New `{{guruProfile}}` variable
4. **All Generators** - Pass profile to prompt builders
5. **Inngest Jobs** - Fetch and pass profile data
6. **Project Settings UI** - Edit/update profile post-creation

---

## 4) Root Cause Analysis

N/A - This is a new feature, not a bug fix.

---

## 5) Research Findings

### Research Summary

Comprehensive research was conducted covering profile schema design, onboarding UX patterns, LLM extraction techniques, prompt injection strategies, and database migration approaches.

### Potential Solutions

#### Solution 1: Inline Profile Fields on Project Model

**Approach:** Add guru profile fields directly to the Project model as flat columns.

```prisma
model Project {
  // ... existing fields ...

  // Guru Profile (flat fields)
  guruDomain           String?   // What the guru teaches
  targetAudience       String?   // Who it teaches
  teachingPhilosophy   String?   // How it approaches teaching
  toneAndStyle         String?   // Communication style
  learnerGoals         String?   // What learners should achieve
  guruProfileSummary   String?   @db.Text  // Full synthesized narrative
}
```

**Pros:**
- Simple schema, easy queries
- No joins needed
- Straightforward backward compatibility (all nullable)
- Easy to display/edit in UI

**Cons:**
- Limited structure for complex profiles
- Hard to evolve schema (requires migrations)
- Duplication if profile needs versioning
- No clear separation between project metadata and guru identity

---

#### Solution 2: JSON Profile Field on Project Model

**Approach:** Store the entire guru profile as a structured JSON field.

```prisma
model Project {
  // ... existing fields ...
  guruProfile   Json?   // Structured profile object
}
```

```typescript
interface GuruProfile {
  // Identity
  name: string                    // "Backgammon Mentor", "Chess Strategist"
  tagline: string | null          // Brief essence

  // Domain
  domain: string                  // What the guru teaches
  domainExpertise: string[]       // Specific areas of expertise

  // Audience
  targetAudience: string          // Who this guru teaches
  audienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'mixed'
  audienceGoals: string[]         // What learners want to achieve

  // Pedagogy
  teachingPhilosophy: string      // Core teaching approach
  preferredMethods: string[]      // Techniques to emphasize
  avoidMethods: string[]          // Approaches to avoid

  // Style
  tone: 'formal' | 'casual' | 'encouraging' | 'challenging' | 'socratic'
  communicationStyle: string      // How the guru communicates
  personalityTraits: string[]     // Character attributes

  // Context
  uniquePerspective: string | null  // What makes this guru special
  additionalContext: string | null  // Any other relevant info
}
```

**Pros:**
- Flexible structure that can evolve without migrations
- Single field keeps schema clean
- Can store rich nested data
- Easy to version/snapshot profiles

**Cons:**
- No type safety at DB level
- Harder to query specific fields
- Need validation layer in application code
- JSON column queries less efficient

---

#### Solution 3: Separate GuruProfile Model with Relation

**Approach:** Create a dedicated `GuruProfile` model with a 1:1 relation to Project.

```prisma
model GuruProfile {
  id          String   @id @default(cuid())
  projectId   String   @unique

  // Identity
  name        String
  tagline     String?

  // Structured fields
  domain            String
  targetAudience    String
  audienceLevel     AudienceLevel
  teachingPhilosophy String   @db.Text
  tone              GuruTone
  communicationStyle String?  @db.Text

  // Arrays stored as JSON for flexibility
  domainExpertise   String[]
  audienceGoals     String[]
  preferredMethods  String[]
  personalityTraits String[]

  // Free-form
  uniquePerspective String?  @db.Text
  additionalContext String?  @db.Text

  // Metadata
  rawBrainDump      String?  @db.Text  // Original user input
  synthesizedAt     DateTime @default(now())
  updatedAt         DateTime @updatedAt

  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

enum AudienceLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
  MIXED
}

enum GuruTone {
  FORMAL
  CASUAL
  ENCOURAGING
  CHALLENGING
  SOCRATIC
}
```

**Pros:**
- Clean separation of concerns
- Type-safe enum fields at DB level
- Can add profile-specific features (versioning, history)
- Easier to extend with new fields
- Clear 1:1 relationship semantics

**Cons:**
- Requires JOIN to fetch profile with project
- More complex schema
- Extra migration complexity
- Overkill if profile stays simple

---

#### Solution 4: Hybrid - JSON Profile + Key Flat Fields

**Approach:** Store full profile as JSON, but extract key fields to flat columns for querying/display.

```prisma
model Project {
  // ... existing fields ...

  // Key profile fields (denormalized for easy access)
  guruName           String?
  guruDomain         String?
  targetAudienceLevel AudienceLevel?

  // Full profile (source of truth)
  guruProfile        Json?
  guruProfileSynthesizedAt DateTime?
}
```

**Pros:**
- Best of both worlds - queryable fields + flexible JSON
- Easy display without parsing JSON
- Full flexibility in JSON structure
- Clear which fields are "indexed"

**Cons:**
- Denormalization requires sync logic
- Two sources of partial truth
- More complex update logic

---

### Recommendation

**Recommended: Solution 2 (JSON Profile Field) with TypeScript validation**

**Rationale:**
1. **Flexibility:** Profile schema will likely evolve as we learn what fields matter most
2. **Simplicity:** Single field keeps the Project model clean
3. **Precedent:** Already using Json fields for `GuruArtifact.content` and `ResearchRun.researchData`
4. **Structured Outputs:** OpenAI's JSON mode + Zod validation provides type safety at application layer
5. **Minimal Migration:** Just add one nullable field

**Implementation approach:**
1. Add `guruProfile Json?` to Project model
2. Define `GuruProfile` TypeScript interface with Zod schema
3. Create synthesis endpoint that validates output against schema
4. Add `{{guruProfile}}` variable substitution to all prompt builders
5. Update generators to pass profile when building prompts

---

## 6) Clarification Questions & Decisions

### Decided (User Confirmed)

1. **Profile Requirement for New Projects:** **REQUIRED**
   - All new projects MUST go through the guru profile onboarding flow
   - No "skip" option - profile creation is the first step of project setup

2. **Voice Input Priority:** **TEXT + VOICE (v1)**
   - Include voice input from the start using browser SpeechRecognition API
   - Text textarea always available as fallback
   - Graceful degradation for browsers without speech support

3. **Existing Projects Migration:** **PROMPT ON VISIT**
   - Show a banner/prompt encouraging users to add a profile when they visit old projects
   - Projects without profiles continue to work (backward compatible)
   - Profile creation is opt-in for existing projects

4. **Profile Granularity:** **COMPREHENSIVE (10-15 fields)**
   - Rich profile with all categories: identity, domain, audience, pedagogy, style
   - The brain dump synthesis will extract as much detail as the user provides
   - LLM fills reasonable defaults for fields the user doesn't mention

5. **Profile Editing Post-Creation:** **RE-SYNTHESIZE WITH OPTIONS**
   - No direct field editing - all changes go through the brain dump synthesis flow
   - When editing, user is asked to choose:
     a) **"Adapt existing profile"** (recommended) - Uses new brain dump to modify the current profile
     b) **"Generate totally new profile"** (NOT recommended) - Starts fresh, marked with warning
   - This ensures profile coherence and captures the full context of changes

6. **Integration with Custom Prompts:** **PROFILE ALWAYS INJECTED**
   - Guru profile is a fixed section in all artifact generation prompts
   - Custom prompts are additive - they layer on top of the profile section
   - Users cannot remove the profile section via custom prompts
   - This ensures the guru identity always informs content generation

7. **Profile Display Location:** **HEADER + DEDICATED PAGE**
   - **Project overview page:** High-level profile card/summary (name, tagline, key traits)
   - **Dedicated "Guru Profile" page:** Full profile details + version history
   - Version history uses similar pattern to artifact versioning (timeline of profile updates)
   - Tapping the profile card on overview navigates to the dedicated page

---

## 7) Proposed Guru Profile Schema

Based on research and the teaching artifact context, here's a proposed profile schema:

```typescript
interface GuruProfile {
  // IDENTITY (Who is this guru?)
  name: string                           // "The Backgammon Sage"
  tagline: string | null                 // "Turning beginners into strategic thinkers"

  // DOMAIN (What does it teach?)
  domain: string                         // "Backgammon strategy and tactics"
  expertiseAreas: string[]               // ["Opening theory", "Checker play", "Cube decisions"]

  // AUDIENCE (Who is it teaching?)
  targetAudience: string                 // "Intermediate players looking to improve"
  audienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'mixed'
  learnerGoals: string[]                 // ["Win more matches", "Understand probability"]

  // PEDAGOGY (How does it teach?)
  teachingPhilosophy: string             // "Learn by understanding principles, not memorizing moves"
  preferredMethods: string[]             // ["Worked examples", "Pattern recognition", "Deliberate practice"]
  avoidApproaches: string[]              // ["Rote memorization", "Information overload"]

  // STYLE (How does it communicate?)
  tone: 'formal' | 'casual' | 'encouraging' | 'challenging' | 'socratic'
  communicationStyle: string             // "Patient and methodical, with strategic analogies"
  personalityTraits: string[]            // ["Patient", "Analytical", "Enthusiastic"]

  // CONTEXT (What makes it unique?)
  uniquePerspective: string | null       // "Combines tournament experience with teaching"
  additionalNotes: string | null         // Any other context from the user
}
```

---

## 8) Prompt Integration Design

### New Variable: `{{guruProfile}}`

All prompt builders would gain access to a formatted guru profile section:

```typescript
function formatGuruProfileForPrompt(profile: GuruProfile | null): string {
  if (!profile) return ''

  return `
## GURU IDENTITY

You are creating teaching content for **${profile.name}**${profile.tagline ? ` - "${profile.tagline}"` : ''}.

**Domain:** ${profile.domain}
**Expertise Areas:** ${profile.expertiseAreas.join(', ')}

**Target Audience:** ${profile.targetAudience}
**Audience Level:** ${profile.audienceLevel}
**Learner Goals:** ${profile.learnerGoals.map(g => `- ${g}`).join('\n')}

**Teaching Philosophy:** ${profile.teachingPhilosophy}
**Preferred Methods:** ${profile.preferredMethods.join(', ')}
${profile.avoidApproaches.length > 0 ? `**Avoid:** ${profile.avoidApproaches.join(', ')}` : ''}

**Communication Style:** ${profile.tone} tone - ${profile.communicationStyle}
**Personality:** ${profile.personalityTraits.join(', ')}

${profile.uniquePerspective ? `**Unique Perspective:** ${profile.uniquePerspective}` : ''}
${profile.additionalNotes ? `**Additional Context:** ${profile.additionalNotes}` : ''}

---

Ensure all teaching content aligns with this guru's identity, pedagogy, and style.
`
}
```

### Injection Point in Mental Model Prompt

```typescript
export function buildMentalModelPrompt(params: MentalModelPromptParams): string {
  const { domain, corpusSummary, corpusWordCount, userNotes, guruProfile } = params

  const guruProfileSection = formatGuruProfileForPrompt(guruProfile)
  const userNotesSection = userNotes ? `\n## USER GUIDANCE\n${userNotes}\n` : ''

  return `
# TASK: Design Mental Model for ${domain}

${guruProfileSection}

You are designing the foundational mental model that will guide all teaching of ${domain}...
// ... rest of prompt
`
}
```

---

## 9) Implementation Phases (Proposed)

### Phase 1: Database & Schema Foundation
- Add `GuruProfile` model with version history support (see schema below)
- Create `GuruProfile` TypeScript interface + Zod schema for synthesis
- Run migration with backward-compatible nullable fields
- Add `guruProfileId` FK to Project model

### Phase 2: Synthesis Backend
- Create synthesis API endpoint: `POST /api/projects/synthesize-guru-profile`
- Build LLM prompt for profile extraction from brain dump
- Implement "adapt existing" vs "generate new" modes
- Add profile validation and error handling

### Phase 3: Onboarding UI
- Create `GuruProfileOnboardingModal` component (adapt from scaffold)
- Integrate into project creation flow (required step)
- Add voice input with `useSpeechRecognition` hook
- Implement 2-step wizard: Input → Preview → Save

### Phase 4: Prompt Integration
- Add `formatGuruProfileForPrompt()` utility
- Update all prompt builders to accept and inject guru profile
- Update generators to pass profile data
- Update Inngest jobs to fetch and forward profile

### Phase 5: Profile Display & Management
- Add profile summary card on project overview page
- Create dedicated `/projects/[id]/profile` page
- Implement profile version history (timeline view)
- Add "Edit Profile" flow with adapt/regenerate options

### Phase 6: Migration Banner
- Add banner component for existing projects without profiles
- Create "Add Guru Profile" entry point
- Track and dismiss banner state per project

---

## 10) Database Schema (with Versioning)

Based on the decisions above, here's the recommended Prisma schema:

```prisma
// Guru Profile with version history (similar to artifact versioning)
model GuruProfile {
  id          String   @id @default(cuid())
  projectId   String
  version     Int      @default(1)

  // The structured profile data (comprehensive schema)
  profileData Json     // GuruProfileData interface

  // The raw input that generated this version
  rawBrainDump      String?  @db.Text
  additionalContext String?  @db.Text  // For "adapt" mode refinements

  // Synthesis metadata
  synthesisMode     SynthesisMode  @default(NEW)  // NEW or ADAPT
  previousVersionId String?        // Link to prior version if ADAPT

  // Timestamps
  createdAt   DateTime @default(now())

  // Relations
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, version])
  @@index([projectId, createdAt])
}

enum SynthesisMode {
  NEW     // Generated from scratch
  ADAPT   // Adapted from previous version
}

// Update Project model
model Project {
  // ... existing fields ...

  // Current active profile (latest version)
  currentProfileId  String?  @unique
  currentProfile    GuruProfile?  @relation("CurrentProfile", fields: [currentProfileId], references: [id])

  // All profile versions
  profileHistory    GuruProfile[] @relation("ProfileHistory")
}
```

**Design Notes:**
- Each profile edit creates a NEW version (immutable history)
- `currentProfileId` points to the active version
- `profileHistory` contains all versions for the timeline view
- `synthesisMode` tracks whether version was new or adapted
- `previousVersionId` enables showing "what changed" between versions

---

## 11) Open Questions for Spec Phase

1. Should the profile synthesis happen synchronously or via Inngest background job?
   - Synchronous is simpler but may timeout for complex brain dumps
   - Background job adds complexity but handles edge cases better

2. What's the ideal length/depth of the brain dump prompt encouragement?
   - Should we provide example prompts/questions to guide the user?
   - How much should we encourage verbose input vs. accepting minimal input?

3. How do we handle the transition in the UI from "Create Project" to "Define Your Guru"?
   - Is it one continuous flow or two distinct steps?
   - Should project name come from the profile (guru name) or be separate?

4. What happens if synthesis fails mid-way?
   - Allow retry with same input?
   - Save partial profile?
   - Fall back to manual entry?

5. Should the profile summary card on the overview page be expandable inline or always navigate to the dedicated page?
