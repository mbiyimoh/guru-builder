# Simplified Frontend Wrapper for Guru Builder

**Slug:** simplified-frontend-wrapper
**Author:** Claude Code
**Date:** 2025-12-18
**Branch:** preflight/simplified-frontend-wrapper
**Related:**
- Prototype: `new-simpler-UI-layer/guru-builder-v4.jsx`
- Implementation mapping: `new-simpler-UI-layer/guru-builder-implementation-mapping.md`
- Handoff doc: `docs/simplified-frontend-prototype-handoff.md`
- Guru Profile spec: `specs/completed/guru-profile-onboarding/02-specification.md`

---

## 1) Intent & Assumptions

### Task Brief
Create a simplified, intuitive frontend wrapper for the Guru Builder system that reimagines the user experience for non-technical domain experts. The wrapper introduces a 4-phase wizard flow (Profile Creation → Research & Knowledge → Readiness Checkpoint → Artifact Creation), multiple input modes (chat, voice, document import), a universal "Pedagogical Dimensions" taxonomy for any teaching domain, and guru testing/publishing capabilities.

### Assumptions
- Target users are domain experts (e.g., backgammon masters) with minimal technical knowledge
- The existing backend APIs remain unchanged; this is a UI layer on top
- The v4 React prototype (`guru-builder-v4.jsx`) captures the desired UX patterns
- Voice input will use browser Web Speech API with graceful degradation
- Document import (PDF/DOCX) is a Phase 2 feature, not MVP
- The 6 Pedagogical Dimensions system is domain-agnostic and replaces existing tagging
- Existing projects without profiles continue to work (backward compatibility)
- Publishing features (embed widgets, shareable links) are Phase 3

### Out of Scope
- Mobile native app development (PWA is in scope)
- Backend API changes (only new endpoints where needed)
- Real-time collaborative editing between multiple users
- Monetization/billing features
- Multi-language/i18n support (future)
- Custom guru avatar/persona visualization
- Assessment/quiz delivery system redesign

---

## 2) Pre-reading Log

### Developer Guides
- `developer-guides/01-overall-architecture.md`: Architecture overview with data flow diagrams for research → recommendations → artifacts. Confirms Inngest for background jobs, Prisma/PostgreSQL for persistence, OpenAI for AI features.
- `developer-guides/02-research-workflow-guide.md`: Details on research run execution, Tavily API integration, recommendation generation.
- `developer-guides/08-teaching-pipeline-guide.md`: Teaching artifact generation (Mental Model → Curriculum → Drills) pipeline.

### Existing Specifications
- `specs/completed/guru-profile-onboarding/02-specification.md`: Full specification for brain dump → profile synthesis. **Already implemented**. Includes 15-field GuruProfileData schema, voice input hook, synthesis API endpoint.
- `specs/feat-per-project-prompt-customization.md`: Per-project prompt customization with drift detection.
- `specs/phase-organized-drill-library/02-specification.md`: Phase-organized drill schema with principle taxonomy.

### Prototype Files
- `new-simpler-UI-layer/guru-builder-v4.jsx`: 1,238-line React prototype with:
  - Design tokens (colors, fonts, shadows)
  - 6 Pedagogical Dimensions (Foundations, Progression, Mistakes, Examples, Nuance, Practice)
  - Welcome screen, example gallery, profile creation (3 modes), research assistant, readiness checkpoint, artifact creation, drill viewer, guru chat
- `new-simpler-UI-layer/guru-builder-implementation-mapping.md`: Detailed mapping of prototype features to existing backend capabilities with status indicators (EXISTS/PARTIAL/NEW).

### Key Source Files
- `lib/guruProfile/types.ts`: GuruProfileData Zod schema (13 fields implemented, slightly different from prototype's 15)
- `components/guru/GuruProfileOnboardingModal.tsx`: Existing brain dump onboarding modal
- `components/guru/GuruTeachingManager.tsx`: Teaching artifact generation UI
- `components/research/NewResearchForm.tsx`: Research run creation form
- `components/artifacts/ArtifactViewerWithVersions.tsx`: Artifact viewing with versions

---

## 3) Codebase Map

### Primary Components/Modules

| Component | Path | Role | Reuse Status |
|-----------|------|------|--------------|
| GuruProfileOnboardingModal | `components/guru/GuruProfileOnboardingModal.tsx` | Brain dump → profile synthesis | EXISTS - enhance with new input modes |
| GuruTeachingManager | `components/guru/GuruTeachingManager.tsx` | Artifact generation orchestration | EXISTS - wrap with simplified UI |
| NewResearchForm | `components/research/NewResearchForm.tsx` | Research run creation | EXISTS - enhance with chat assistant |
| ResearchProgressTracker | `components/research/ResearchProgressTracker.tsx` | Research progress display | EXISTS - use as-is |
| ArtifactViewerWithVersions | `components/artifacts/ArtifactViewerWithVersions.tsx` | Artifact display | EXISTS - simplify for wrapper |
| ContextLayerManager | `components/context-layers/ContextLayerManager.tsx` | Context layer CRUD | EXISTS - hide behind corpus view |
| KnowledgeFileManager | `components/knowledge-files/KnowledgeFileManager.tsx` | Knowledge file CRUD | EXISTS - hide behind corpus view |

### Shared Dependencies

| Dependency | Path | Usage |
|------------|------|-------|
| shadcn/ui components | `components/ui/` | Button, Badge, Dialog, Input, etc. |
| Teaching types | `lib/teaching/types.ts` | PromptInfo, ViewMode, artifact types |
| Guru profile types | `lib/guruProfile/types.ts` | GuruProfileData, SynthesisResult |
| Prisma client | `lib/db.ts` | Database access |
| Auth helpers | `lib/auth.ts` | Session management |

### Data Flow

```
User Brain Dump
    ↓
POST /api/projects/synthesize-guru-profile
    ↓
GuruProfileData (15 fields)
    ↓
POST /api/projects (create with profile)
    ↓
Project with currentProfileId
    ↓
POST /api/research-runs (instructions, depth)
    ↓
Inngest job → Tavily search → Recommendation generation
    ↓
GET /api/recommendations (review & approve)
    ↓
POST /api/projects/[id]/apply-recommendations
    ↓
Corpus updated (ContextLayers, KnowledgeFiles)
    ↓
POST /api/projects/[id]/guru/[artifact-type]
    ↓
Inngest job → GPT-4o generation → GuruArtifact
    ↓
GET /api/projects/[id]/guru/artifacts/[id]
    ↓
Artifact viewer display
```

### Feature Flags/Config
- None currently. Consider adding:
  - `ENABLE_VOICE_INPUT` - Toggle voice transcription
  - `ENABLE_DOCUMENT_IMPORT` - Toggle document import (Phase 2)
  - `ENABLE_GURU_TESTING` - Toggle guru chat testing
  - `ENABLE_PUBLISHING` - Toggle publishing features

### Potential Blast Radius

| Change Area | Impact |
|-------------|--------|
| New wizard navigation | New pages/routes, URL structure |
| Pedagogical Dimensions | New database model, corpus tagging, gap detection |
| Research chat assistant | New API endpoint for conversational refinement |
| Voice input enhancement | Extend existing useSpeechRecognition hook |
| Document import | New API endpoint, file storage, parsing pipeline |
| Guru testing | New chat inference endpoint using corpus |
| Publishing | New database models, public URL routing, embed system |

---

## 4) Root Cause Analysis

**N/A** - This is a new feature, not a bug fix.

---

## 5) Research

### 5.1 Wizard/Stepper Patterns

**Options:**
1. **React Context + URL State**: Manual wizard with `useContext` for state, URL params for step persistence
2. **Stepperize Library**: Headless stepper hooks designed for shadcn/ui
3. **Zustand Store**: Global state with step/data persistence
4. **React Hook Form Multi-Step**: Form-based wizard with validation per step

**Recommendation:** Stepperize + React Context hybrid
- Stepperize provides headless hooks that work with shadcn/ui
- React Context for wizard-wide state (profile, corpus, artifacts)
- URL state for step persistence (`/projects/new?step=profile`)
- localStorage backup for in-progress data

**Pros:**
- Minimal new dependencies (stepperize ~15KB)
- shadcn/ui component compatibility
- Browser back/forward navigation works
- Recoverable from page refresh

**Cons:**
- Stepperize is less mature than alternatives
- Need to build step validation logic

### 5.2 Voice Transcription

**Options:**
1. **Web Speech API (Browser)**: Free, no server cost, works in Chrome/Edge
2. **OpenAI Whisper API**: High quality, requires server call, $0.006/min
3. **Deepgram**: Real-time streaming, lowest latency, $0.0059/min
4. **AssemblyAI**: Best accuracy benchmarks, $0.0065/min

**Recommendation:** Web Speech API with OpenAI Whisper fallback
- Primary: Web Speech API (free, existing `useSpeechRecognition` hook)
- Fallback: OpenAI Whisper for browsers without support (Firefox, Safari)
- Progressive enhancement: Show mic button only when supported

**Implementation:**
```typescript
// Existing hook works for Chrome/Edge
const { isListening, transcript, isSupported } = useSpeechRecognition()

// Add Whisper fallback for unsupported browsers
async function transcribeAudioWithWhisper(audioBlob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.webm')
  const response = await fetch('/api/transcribe', { method: 'POST', body: formData })
  return response.json().then(d => d.text)
}
```

### 5.3 Document Import (PDF/DOCX)

**Options:**
1. **Server-side pdf-parse + mammoth.js**: Reliable, no browser compat issues
2. **Client-side pdf.js + docx-preview**: Works offline, but larger bundle
3. **Cloud service (AWS Textract, Azure Form Recognizer)**: Best for complex docs, expensive

**Recommendation:** Server-side parsing with pdf-parse + mammoth.js
- Lower complexity than cloud services
- Consistent results across browsers
- ~50KB added to server bundle

**API Design:**
```typescript
// POST /api/documents/parse
// Content-Type: multipart/form-data
// Body: { file: File }
// Response: { text: string, metadata: { pages?: number, words: number } }
```

### 5.4 Pedagogical Dimensions System

**Options:**
1. **Flat tag system**: Simple tags like "foundations", "mistakes"
2. **Two-dimensional taxonomy**: Based on Bloom's revised taxonomy (Knowledge × Cognitive Process)
3. **Custom 6-dimension model**: As in prototype (Foundations, Progression, Mistakes, Examples, Nuance, Practice)

**Recommendation:** Custom 6-dimension model from prototype
- Domain-agnostic (works for backgammon, chess, cooking, etc.)
- Intuitive for non-technical users
- Maps well to research suggestion generation

**Database Schema:**
```prisma
model PedagogicalDimension {
  id          String @id @default(cuid())
  key         String @unique // 'foundations', 'progression', etc.
  name        String
  icon        String
  description String
  question    String // Guiding question for research
  priority    Int    // Order for gap detection
  isCritical  Boolean @default(false) // True for foundations, mistakes, progression
}

model CorpusDimensionTag {
  id              String @id @default(cuid())
  dimensionId     String
  contextLayerId  String?
  knowledgeFileId String?
  confidence      Float  @default(1.0)
  createdAt       DateTime @default(now())

  dimension       PedagogicalDimension @relation(...)
  contextLayer    ContextLayer? @relation(...)
  knowledgeFile   KnowledgeFile? @relation(...)
}
```

### 5.5 Readiness/Gap Scoring

**Algorithm Design:**
```typescript
interface ReadinessScore {
  overall: number        // 0-100
  profile: number        // 0-100 (completeness of GuruProfile)
  knowledge: number      // 0-100 (dimension coverage)
  criticalGaps: string[] // Dimension keys with 0 coverage
  suggestedGaps: string[] // Nice-to-have dimensions
}

function calculateReadiness(corpus: Corpus, profile: GuruProfile): ReadinessScore {
  // Profile score: % of non-null required fields
  const profileScore = calculateProfileCompleteness(profile)

  // Knowledge score: % of dimensions with at least 1 item
  const coveredDimensions = corpus.dimensions.filter(d => d.items.length > 0)
  const knowledgeScore = (coveredDimensions.length / 6) * 100

  // Critical gaps: foundations, mistakes, progression
  const criticalDimensions = ['foundations', 'mistakes', 'progression']
  const criticalGaps = criticalDimensions.filter(d =>
    !corpus.dimensions.find(x => x.id === d && x.items.length > 0)
  )

  // Suggested gaps: examples, nuance, practice
  const suggestedDimensions = ['examples', 'nuance', 'practice']
  const suggestedGaps = suggestedDimensions.filter(d =>
    !corpus.dimensions.find(x => x.id === d && x.items.length > 0)
  )

  return {
    overall: Math.round((profileScore + knowledgeScore) / 2),
    profile: profileScore,
    knowledge: knowledgeScore,
    criticalGaps,
    suggestedGaps,
  }
}
```

### 5.6 Research Chat Assistant

**Approach:** Conversational interface that refines research prompts before execution

**Components:**
- Left panel: Chat with AI research assistant
- Right panel: Live research plan document (editable)

**API Design:**
```typescript
// POST /api/research/refine-plan
// Body: { projectId, message, currentPlan?: ResearchPlan }
// Response: { reply: string, updatedPlan: ResearchPlan }

interface ResearchPlan {
  title: string
  queries: string[]
  focus: string
  sources: string[]
  outputFormat: string
}
```

### 5.7 Guru Testing (Chat)

**Approach:** Chat interface that uses corpus as context for AI responses

**Implementation:**
- Use existing corpus (ContextLayers + KnowledgeFiles) as system prompt
- Apply GuruProfile for personality/tone
- Stream responses using Vercel AI SDK

**API Design:**
```typescript
// POST /api/projects/[id]/guru/chat
// Body: { messages: Message[] }
// Response: ReadableStream (SSE)
```

### 5.8 Publishing

**Phase 3 feature - high-level design:**

1. **Shareable Link**: Public URL like `https://guru.app/g/{shortId}`
2. **Embed Widget**: `<script src="guru.app/embed.js" data-guru="{id}"></script>`
3. **PWA Export**: Manifest + service worker for installable web app

---

## 6) Clarification

### Questions for User Decision

1. **Wizard URL Structure**
   - Option A: Single page with hash routing (`/projects/new#step=profile`)
   - Option B: Nested routes (`/projects/new/profile`, `/projects/new/research`)
   - **Recommendation:** Option B for better SEO and deep linking
   >> option B

2. **Pedagogical Dimensions - Auto-Detection vs Manual**
   - Option A: AI auto-detects dimensions when content is added
   - Option B: User manually assigns dimensions
   - Option C: Hybrid - AI suggests, user confirms
   - **Recommendation:** Option C (hybrid)
   >> option C

3. **Research Chat Persistence**
   - Option A: Chat history persists per project
   - Option B: Chat is ephemeral, only final plan is saved
   - **Recommendation:** Option B for simplicity (save research instructions)
   >> option B

4. **Voice Input Priority**
   - Option A: Web Speech API only (Chrome/Edge)
   - Option B: Add Whisper API fallback for Firefox/Safari
   - **Recommendation:** Start with A, add B if user feedback indicates need
   >> option A

5. **Document Import MVP Scope**
   - Option A: Text extraction only (no layout/tables)
   - Option B: Full OCR with table detection
   - **Recommendation:** Option A for v1
   >> option A

6. **Guru Testing Limits**
   - How many test messages per session?
   - Should test conversations be saved?
   - **Recommendation:** 20 messages/session, don't persist
   >> follow your recommendation

7. **Publishing Scope for MVP**
   - Option A: Shareable link only
   - Option B: Link + embed widget
   - Option C: Full suite (link + embed + PWA)
   - **Recommendation:** Option A for MVP
   >> option A

8. **Existing Project Migration**
   - Should existing projects show migration prompt?
   - Should they be forced to add profiles?
   - **Recommendation:** Optional migration banner, no forcing
   >> optional is great

---

## 7) Implementation Roadmap

### Phase 1: Core Wizard Flow (Sprint 1-2)
- New wizard navigation shell
- URL-based step persistence
- Chat-based profile creation (reskin existing modal)
- Basic corpus explorer view
- Connect to existing artifact generation

### Phase 2: Research Enhancement (Sprint 3)
- Research chat assistant (plan refinement)
- Pedagogical dimension data model
- Dimension tagging for corpus items
- Gap detection and readiness scoring
- Research suggestions based on gaps

### Phase 3: Input Modes (Sprint 4)
- Enhanced voice input with Whisper fallback
- Document import (PDF/DOCX parsing)
- Multi-modal profile synthesis

### Phase 4: Testing & Publishing (Sprint 5)
- Guru chat testing interface
- Public URL generation
- Embed widget (if scope confirmed)

### Phase 5: Polish (Sprint 6)
- Example guru templates
- Onboarding tour
- Mobile responsiveness
- Performance optimization

---

## 8) Appendix: Component Inventory from Prototype

New components needed (from `guru-builder-v4.jsx`):

| Component | Purpose | Priority |
|-----------|---------|----------|
| `WizardNavigation` | Phase stepper with progress | P0 |
| `WelcomeScreen` | Landing with "Start Building" CTA | P0 |
| `ExampleGallery` | Browse/use example gurus | P1 |
| `ProfileCreation` | 3-mode profile input | P0 |
| `CorpusExplorer` | Dimension-organized knowledge browser | P0 |
| `ResearchPhase` | Chat assistant + plan editor | P0 |
| `ReadinessCheckpoint` | Score visualization with gaps | P0 |
| `ArtifactsPhase` | Simplified artifact generation | P0 |
| `DrillViewer` | Interactive drill preview | P1 |
| `GuruChat` | Test conversations | P1 |
| `PublishModal` | Share link/embed options | P2 |

---

## 9) References

- Prototype: `new-simpler-UI-layer/guru-builder-v4.jsx`
- Implementation mapping: `new-simpler-UI-layer/guru-builder-implementation-mapping.md`
- Handoff doc: `docs/simplified-frontend-prototype-handoff.md`
- Guru Profile spec: `specs/completed/guru-profile-onboarding/02-specification.md`
- Architecture guide: `developer-guides/01-overall-architecture.md`
- Stepperize docs: https://stepperize.vercel.app/docs
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- Bloom's Taxonomy: https://teaching.uic.edu/cate-teaching-guides/syllabus-course-design/blooms-taxonomy-of-educational-objectives/
