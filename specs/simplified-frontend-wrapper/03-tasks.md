# Simplified Frontend Wrapper - Task Breakdown

**Generated from:** `specs/simplified-frontend-wrapper/02-specification.md`
**Date:** 2025-12-19
**Total Tasks:** 42 tasks across 4 phases

---

## Overview

This document breaks down the Simplified Frontend Wrapper specification into actionable implementation tasks. Tasks are organized by phase and include dependencies, acceptance criteria, and estimated complexity.

### Complexity Legend
- 🟢 **Low** - 1-2 hours, straightforward implementation
- 🟡 **Medium** - 2-4 hours, moderate complexity
- 🔴 **High** - 4-8 hours, significant complexity or integration work

---

## Phase 1: Foundation (Core Wizard)

**Goal:** Establish database models, wizard navigation, and basic profile creation flow.

### 1.1 Database Schema

#### Task 1.1.1: Create PedagogicalDimension Model
- **File:** `prisma/schema.prisma`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Add PedagogicalDimension model with fields: id, key (unique), name, icon, description, question, priority, isCritical, createdAt
- **Acceptance Criteria:**
  - [ ] Model defined in schema.prisma
  - [ ] `npx prisma generate` succeeds
  - [ ] Migration created with `npm run migrate:safe -- add-pedagogical-dimensions`

#### Task 1.1.2: Create CorpusDimensionTag Model
- **File:** `prisma/schema.prisma`
- **Complexity:** 🟢 Low
- **Dependencies:** Task 1.1.1
- **Description:** Add CorpusDimensionTag model with polymorphic relation to ContextLayer or KnowledgeFile
- **Acceptance Criteria:**
  - [ ] Model defined with dimensionId, contextLayerId (nullable), knowledgeFileId (nullable)
  - [ ] Unique constraints on [dimensionId, contextLayerId] and [dimensionId, knowledgeFileId]
  - [ ] confidence and confirmedByUser fields present
  - [ ] Migration applied successfully

#### Task 1.1.3: Create PublishedGuru Model
- **File:** `prisma/schema.prisma`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Add PublishedGuru model for public sharing functionality
- **Acceptance Criteria:**
  - [ ] Model with shortId (unique, indexed), isPublished, publishedAt, revokedAt, viewCount
  - [ ] One-to-one relation with Project
  - [ ] Migration applied successfully

#### Task 1.1.4: Update Existing Models with Relations
- **File:** `prisma/schema.prisma`
- **Complexity:** 🟢 Low
- **Dependencies:** Tasks 1.1.1, 1.1.2, 1.1.3
- **Description:** Add dimensionTags relation to ContextLayer and KnowledgeFile, publishedGuru relation to Project
- **Acceptance Criteria:**
  - [ ] Relations added to existing models
  - [ ] All migrations applied cleanly
  - [ ] Prisma Studio shows new relations

#### Task 1.1.5: Create Pedagogical Dimensions Seed
- **File:** `prisma/seeds/pedagogical-dimensions.ts`
- **Complexity:** 🟢 Low
- **Dependencies:** Task 1.1.1
- **Description:** Create seed data for the 6 pedagogical dimensions with proper priority ordering
- **Acceptance Criteria:**
  - [ ] All 6 dimensions defined (foundations, progression, mistakes, examples, nuance, practice)
  - [ ] isCritical set correctly (foundations, progression, mistakes = true)
  - [ ] Seed script runs idempotently
  - [ ] Add `npm run seed:pedagogical-dimensions` script to package.json

### 1.2 TypeScript Types

#### Task 1.2.1: Create Wizard Types
- **File:** `lib/wizard/types.ts`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Define WizardPhase, WizardState, ReadinessScore, and DimensionCoverage types
- **Acceptance Criteria:**
  - [ ] All types from spec section 3.1 implemented
  - [ ] Proper JSDoc comments
  - [ ] Export barrel file created

#### Task 1.2.2: Create Research Chat Types
- **File:** `lib/research/chat-types.ts`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Define ResearchPlan, ResearchChatMessage, and ResearchChatState types
- **Acceptance Criteria:**
  - [ ] All types from spec section 3.2 implemented
  - [ ] Depth enum matches existing research types

#### Task 1.2.3: Create Guru Testing Types
- **File:** `lib/testing/types.ts`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Define GuruTestMessage and GuruTestSession types
- **Acceptance Criteria:**
  - [ ] All types from spec section 3.3 implemented
  - [ ] maxMessages constant defined (20)

### 1.3 Wizard Layout & Navigation

#### Task 1.3.1: Create Wizard Layout
- **File:** `app/projects/new/layout.tsx`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Create shared layout for all wizard phases with consistent styling
- **Acceptance Criteria:**
  - [ ] Layout wraps children with max-w-4xl container
  - [ ] WizardNavigation component included
  - [ ] Consistent background and spacing

#### Task 1.3.2: Create WizardNavigation Component
- **File:** `components/wizard/WizardNavigation.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.3.1
- **Description:** Build phase indicator with clickable completed phases, disabled future phases
- **Acceptance Criteria:**
  - [ ] Shows 4 phases with numbered steps
  - [ ] Current phase highlighted (blue)
  - [ ] Completed phases show checkmark
  - [ ] Future phases disabled (gray, no click)
  - [ ] Connecting lines between phases
  - [ ] "Back to Projects" link

### 1.4 Profile Phase (Chat Mode Only)

#### Task 1.4.1: Create Profile Page Shell
- **File:** `app/projects/new/profile/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.3.1
- **Description:** Create profile page with mode selection and routing to mode-specific components
- **Acceptance Criteria:**
  - [ ] Mode selection tabs (chat/voice/document) - only chat active initially
  - [ ] State management for current mode and step (input/preview)
  - [ ] ProfilePreview component integration
  - [ ] Save and continue navigation

#### Task 1.4.2: Create ProfileChatMode Component
- **File:** `components/wizard/profile/ProfileChatMode.tsx`
- **Complexity:** 🔴 High
- **Dependencies:** Task 1.4.1
- **Description:** Interactive chat-based profile creation with guided questions
- **Acceptance Criteria:**
  - [ ] Chat interface with message history
  - [ ] AI-driven follow-up questions
  - [ ] Synthesis trigger after sufficient input
  - [ ] Loading states during AI calls
  - [ ] onComplete callback with SynthesisResult

#### Task 1.4.3: Create ProfilePreview Component
- **File:** `components/wizard/profile/ProfilePreview.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.4.1
- **Description:** Display synthesized profile with editing capability
- **Acceptance Criteria:**
  - [ ] All profile fields displayed cleanly
  - [ ] Light areas highlighted (low confidence)
  - [ ] Project name input field
  - [ ] Back button to return to input
  - [ ] Continue button to save and proceed

### 1.5 Basic Research Phase

#### Task 1.5.1: Create Research Page Shell
- **File:** `app/projects/new/research/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.3.1
- **Description:** Research page with project context and navigation
- **Acceptance Criteria:**
  - [ ] Reads projectId from URL params
  - [ ] Loads project and guru profile data
  - [ ] Links to existing research form (placeholder for chat)
  - [ ] Continue button to readiness phase

#### Task 1.5.2: Integrate Existing Research Form
- **File:** `app/projects/new/research/page.tsx`
- **Complexity:** 🟢 Low
- **Dependencies:** Task 1.5.1
- **Description:** Reuse existing NewResearchForm component for initial implementation
- **Acceptance Criteria:**
  - [ ] Existing research form renders
  - [ ] Research runs create correctly
  - [ ] Recommendations reviewable
  - [ ] Navigation works after research

### 1.6 Readiness System

#### Task 1.6.1: Create Readiness Scoring Algorithm
- **File:** `lib/readiness/scoring.ts`
- **Complexity:** 🔴 High
- **Dependencies:** Tasks 1.1.1-1.1.4, 1.2.1
- **Description:** Implement weighted scoring algorithm with profile and dimension components
- **Acceptance Criteria:**
  - [ ] Profile completeness calculated (9 required fields)
  - [ ] Dimension coverage calculated per dimension
  - [ ] Weighted knowledge score (foundations 25%, etc.)
  - [ ] Critical gaps identified (isCritical + <50% coverage)
  - [ ] Suggested gaps identified (non-critical + <50%)
  - [ ] Overall score: 40% profile + 60% knowledge

#### Task 1.6.2: Create Readiness API Endpoint
- **File:** `app/api/projects/[id]/readiness/route.ts`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.6.1
- **Description:** GET endpoint returning readiness score and dimension coverage
- **Acceptance Criteria:**
  - [ ] Authentication required
  - [ ] Project ownership verified
  - [ ] Returns score and dimensions arrays
  - [ ] 404 for non-existent project

#### Task 1.6.3: Create Readiness Page
- **File:** `app/projects/new/readiness/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.6.2
- **Description:** Display readiness checkpoint with scores and gaps
- **Acceptance Criteria:**
  - [ ] Overall score displayed prominently
  - [ ] Progress bar visualization
  - [ ] Critical gaps section (red)
  - [ ] Suggested improvements section (amber)
  - [ ] Dimension-by-dimension breakdown
  - [ ] Research This buttons for gaps
  - [ ] Continue button (enabled when ready)

---

## Phase 2: Enhanced Input

**Goal:** Add voice input, document import, and research chat assistant.

### 2.1 Voice Input Mode

#### Task 2.1.1: Create ProfileVoiceMode Component
- **File:** `components/wizard/profile/ProfileVoiceMode.tsx`
- **Complexity:** 🔴 High
- **Dependencies:** Task 1.4.1, existing useSpeechRecognition hook
- **Description:** Voice recording interface with Web Speech API
- **Acceptance Criteria:**
  - [ ] Browser support detection (show message for unsupported)
  - [ ] Record button with visual feedback
  - [ ] Live transcription display
  - [ ] Stop and process button
  - [ ] Fallback to text input for unsupported browsers
  - [ ] Integration with profile synthesis API

#### Task 2.1.2: Update Profile Mode Selection
- **File:** `app/projects/new/profile/page.tsx`
- **Complexity:** 🟢 Low
- **Dependencies:** Task 2.1.1
- **Description:** Enable voice mode in mode selection UI
- **Acceptance Criteria:**
  - [ ] Voice mode tab enabled
  - [ ] Mode switching works correctly
  - [ ] State preserved when switching modes

### 2.2 Document Import

#### Task 2.2.1: Install Document Parsing Dependencies
- **File:** `package.json`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Add pdf-parse and mammoth dependencies
- **Acceptance Criteria:**
  - [ ] `pdf-parse@^1.1.1` installed
  - [ ] `mammoth@^1.6.0` installed
  - [ ] Lock file updated

#### Task 2.2.2: Create Document Parse API
- **File:** `app/api/documents/parse/route.ts`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 2.2.1
- **Description:** Endpoint to extract text from PDF, DOCX, TXT files
- **Acceptance Criteria:**
  - [ ] Accepts multipart form data
  - [ ] PDF text extraction working
  - [ ] DOCX text extraction working
  - [ ] TXT passthrough working
  - [ ] Returns text and metadata (pages, words)
  - [ ] Rejects unsupported file types
  - [ ] 10MB file size limit

#### Task 2.2.3: Create ProfileDocumentMode Component
- **File:** `components/wizard/profile/ProfileDocumentMode.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 2.2.2
- **Description:** File upload interface for document import
- **Acceptance Criteria:**
  - [ ] Drag-and-drop file upload
  - [ ] File type indicators
  - [ ] Parsing progress display
  - [ ] Extracted text preview
  - [ ] "Use This" button to trigger synthesis
  - [ ] Error handling for parse failures

#### Task 2.2.4: Update Profile Mode Selection for Documents
- **File:** `app/projects/new/profile/page.tsx`
- **Complexity:** 🟢 Low
- **Dependencies:** Task 2.2.3
- **Description:** Enable document mode in mode selection UI
- **Acceptance Criteria:**
  - [ ] Document mode tab enabled
  - [ ] All three modes functional

### 2.3 Research Chat Assistant

#### Task 2.3.1: Create Research Plan Refinement API
- **File:** `app/api/research/refine-plan/route.ts`
- **Complexity:** 🔴 High
- **Dependencies:** Task 1.2.2
- **Description:** Endpoint for AI-assisted research plan creation
- **Acceptance Criteria:**
  - [ ] Accepts message, currentPlan, guruProfile
  - [ ] Returns conversational reply + updated plan
  - [ ] GPT-4o with JSON response format
  - [ ] System prompt guides toward effective research
  - [ ] Plan includes title, objective, queries, focusAreas, expectedOutcomes, depth

#### Task 2.3.2: Create ResearchChatAssistant Component
- **File:** `components/wizard/research/ResearchChatAssistant.tsx`
- **Complexity:** 🔴 High
- **Dependencies:** Task 2.3.1
- **Description:** Split-panel chat interface with plan display
- **Acceptance Criteria:**
  - [ ] Left panel: Chat messages with AI
  - [ ] Right panel: Current research plan display
  - [ ] Plan updates highlighted when changed
  - [ ] Edit plan directly option
  - [ ] Execute Research button
  - [ ] Keyboard shortcuts (Enter to send)

#### Task 2.3.3: Create ResearchPlanDisplay Component
- **File:** `components/wizard/research/ResearchPlanDisplay.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 2.3.2
- **Description:** Formatted display of research plan with edit mode
- **Acceptance Criteria:**
  - [ ] Shows all plan fields
  - [ ] Edit mode allows inline changes
  - [ ] Depth selector
  - [ ] Query list management (add/remove)

#### Task 2.3.4: Update Research Page with Chat
- **File:** `app/projects/new/research/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Tasks 2.3.2, 2.3.3
- **Description:** Replace basic form with chat assistant
- **Acceptance Criteria:**
  - [ ] Chat assistant is default interface
  - [ ] Plan execution triggers research run
  - [ ] Progress tracking during research
  - [ ] Recommendations review flow

### 2.4 Enhanced Readiness

#### Task 2.4.1: Add Interactive Dimension Cards
- **File:** `app/projects/new/readiness/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.6.3
- **Description:** Make dimension coverage cards interactive with tooltips
- **Acceptance Criteria:**
  - [ ] Dimension cards show icon and name
  - [ ] Hover shows guiding question
  - [ ] Click opens research with focus parameter
  - [ ] Animated progress bars

---

## Phase 3: Testing & Publishing

**Goal:** Enable guru testing and public sharing functionality.

### 3.1 Guru Testing

#### Task 3.1.1: Create Guru Test Chat API
- **File:** `app/api/projects/[id]/guru/chat/route.ts`
- **Complexity:** 🔴 High
- **Dependencies:** None
- **Description:** Streaming chat endpoint for testing guru responses
- **Acceptance Criteria:**
  - [ ] Streams responses using AI SDK
  - [ ] Builds system prompt from profile + corpus
  - [ ] Enforces 20 message limit
  - [ ] Uses GPT-4o model
  - [ ] Authentication required

#### Task 3.1.2: Create GuruTestChat Component
- **File:** `components/wizard/testing/GuruTestChat.tsx`
- **Complexity:** 🔴 High
- **Dependencies:** Task 3.1.1
- **Description:** Full-featured chat interface for guru testing
- **Acceptance Criteria:**
  - [ ] Uses AI SDK useChat hook
  - [ ] Message counter display
  - [ ] Streaming response display
  - [ ] Reset button for new session
  - [ ] Disabled state at message limit
  - [ ] "Test Mode" indicator

#### Task 3.1.3: Integrate Testing into Artifacts Page
- **File:** `app/projects/new/artifacts/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 3.1.2
- **Description:** Add guru testing section to artifacts phase
- **Acceptance Criteria:**
  - [ ] Test Your Guru card/section
  - [ ] Expandable chat interface
  - [ ] Works alongside artifact generation

### 3.2 Publishing

#### Task 3.2.1: Install nanoid Dependency
- **File:** `package.json`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Add nanoid for short ID generation
- **Acceptance Criteria:**
  - [ ] `nanoid@^5.0.0` installed

#### Task 3.2.2: Create Publishing API Endpoints
- **File:** `app/api/projects/[id]/publish/route.ts`
- **Complexity:** 🟡 Medium
- **Dependencies:** Tasks 1.1.3, 3.2.1
- **Description:** GET/POST/DELETE endpoints for publish management
- **Acceptance Criteria:**
  - [ ] GET returns publish status, shortId, viewCount
  - [ ] POST creates or re-enables published guru
  - [ ] DELETE revokes (sets isPublished=false)
  - [ ] Authentication and ownership required

#### Task 3.2.3: Create Public Guru View Page
- **File:** `app/g/[shortId]/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 3.2.2
- **Description:** Public-facing guru page with profile and artifacts
- **Acceptance Criteria:**
  - [ ] Loads by shortId
  - [ ] 404 for revoked or invalid
  - [ ] Increments view count
  - [ ] Shows profile summary
  - [ ] Shows completed artifacts
  - [ ] Clean, public-friendly design

#### Task 3.2.4: Create PublicGuruView Component
- **File:** `components/public/PublicGuruView.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 3.2.3
- **Description:** Reusable component for rendering public guru data
- **Acceptance Criteria:**
  - [ ] Profile card with key details
  - [ ] Artifact list with links
  - [ ] No editing controls
  - [ ] Responsive design

#### Task 3.2.5: Add Publishing UI to Project
- **File:** `app/projects/new/artifacts/page.tsx` or `app/projects/[id]/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 3.2.2
- **Description:** UI for publishing, copying link, revoking
- **Acceptance Criteria:**
  - [ ] Publish button
  - [ ] Copy link button
  - [ ] View count display
  - [ ] Revoke with confirmation
  - [ ] Published status indicator

---

## Phase 4: Polish

**Goal:** Migration support, auto-tagging, and final refinements.

### 4.1 Existing Project Migration

#### Task 4.1.1: Create Migration Banner Component
- **File:** `components/wizard/MigrationBanner.tsx`
- **Complexity:** 🟢 Low
- **Dependencies:** None
- **Description:** Optional banner for existing projects to use wizard
- **Acceptance Criteria:**
  - [ ] Shows on legacy project pages
  - [ ] "Try the new wizard" CTA
  - [ ] Dismissable (stores preference)
  - [ ] Links to wizard with projectId

#### Task 4.1.2: Add Banner to Project Dashboard
- **File:** `app/projects/[id]/page.tsx`
- **Complexity:** 🟢 Low
- **Dependencies:** Task 4.1.1
- **Description:** Conditionally show migration banner for pre-wizard projects
- **Acceptance Criteria:**
  - [ ] Banner shows for projects without wizard completion
  - [ ] Respects dismissal preference
  - [ ] Doesn't show for new projects

### 4.2 Dimension Auto-Tagging

#### Task 4.2.1: Create Dimension Suggest API
- **File:** `app/api/projects/[id]/dimensions/suggest/route.ts`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 1.1.1
- **Description:** AI-powered dimension suggestion for corpus items
- **Acceptance Criteria:**
  - [ ] Accepts content, title, type
  - [ ] Returns suggestions with confidence scores
  - [ ] Uses GPT-4o-mini for efficiency
  - [ ] Suggestions include dimension key and confidence

#### Task 4.2.2: Auto-Tag on Recommendation Apply
- **File:** `lib/applyRecommendations.ts`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 4.2.1
- **Description:** Automatically suggest dimension tags when applying recommendations
- **Acceptance Criteria:**
  - [ ] After apply, trigger dimension suggestion
  - [ ] Store suggestions with confidence < 0.8 as unconfirmed
  - [ ] Auto-confirm suggestions with confidence >= 0.8
  - [ ] Non-blocking (don't fail apply if tagging fails)

#### Task 4.2.3: Create Dimension Tag UI in Corpus View
- **File:** `components/corpus/DimensionTags.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Task 4.2.2
- **Description:** Display and manage dimension tags on corpus items
- **Acceptance Criteria:**
  - [ ] Shows assigned dimensions as pills
  - [ ] Unconfirmed tags styled differently
  - [ ] Click to confirm/reject suggested tags
  - [ ] Add tag manually option

### 4.3 Research Suggestions

#### Task 4.3.1: Add Gap-Based Research Suggestions
- **File:** `app/projects/new/research/page.tsx`
- **Complexity:** 🟡 Medium
- **Dependencies:** Tasks 1.6.1, 2.3.2
- **Description:** Pre-populate research suggestions based on readiness gaps
- **Acceptance Criteria:**
  - [ ] Read gap data from readiness
  - [ ] Suggest research topics for gaps
  - [ ] One-click to use suggestion
  - [ ] Guiding questions from dimensions shown

### 4.4 Mobile & Performance

#### Task 4.4.1: Mobile Responsive Wizard
- **File:** Multiple component files
- **Complexity:** 🟡 Medium
- **Dependencies:** All previous phases
- **Description:** Ensure wizard works well on mobile devices
- **Acceptance Criteria:**
  - [ ] Navigation collapses to mobile-friendly
  - [ ] Chat interfaces usable on mobile
  - [ ] Forms properly sized
  - [ ] Touch targets adequate (44px+)

#### Task 4.4.2: Performance Optimization
- **File:** Multiple files
- **Complexity:** 🟡 Medium
- **Dependencies:** All previous phases
- **Description:** Optimize bundle size and loading performance
- **Acceptance Criteria:**
  - [ ] Wizard phases lazy-loaded
  - [ ] Readiness scores cached (5 min TTL)
  - [ ] Bundle analyzer shows reasonable splits
  - [ ] Core Web Vitals pass

---

## Testing Requirements

### Unit Tests to Create

| Test File | Tasks Covered | Priority |
|-----------|--------------|----------|
| `lib/readiness/__tests__/scoring.test.ts` | 1.6.1 | High |
| `lib/research/__tests__/chat-refinement.test.ts` | 2.3.1 | Medium |
| `components/wizard/__tests__/WizardNavigation.test.ts` | 1.3.2 | Low |

### Integration Tests to Create

| Test File | Tasks Covered | Priority |
|-----------|--------------|----------|
| `app/api/documents/__tests__/parse.test.ts` | 2.2.2 | High |
| `app/api/projects/[id]/readiness/__tests__/route.test.ts` | 1.6.2 | High |
| `app/api/projects/[id]/publish/__tests__/route.test.ts` | 3.2.2 | Medium |

### E2E Tests to Create

| Test File | Scenarios | Priority |
|-----------|-----------|----------|
| `tests/wizard-flow.spec.ts` | Full wizard flow, mode switching, validation | High |
| `tests/publishing.spec.ts` | Publish, share link, revoke | Medium |
| `tests/guru-testing.spec.ts` | Chat limit, reset, streaming | Medium |

---

## Dependencies Graph

```
Phase 1 Foundation
├── 1.1.1 PedagogicalDimension model
│   └── 1.1.2 CorpusDimensionTag model
│       └── 1.1.4 Update existing models
├── 1.1.3 PublishedGuru model
│   └── 1.1.4 Update existing models
├── 1.1.5 Seed data (depends on 1.1.1)
├── 1.2.* Types (no dependencies)
├── 1.3.1 Wizard layout
│   └── 1.3.2 WizardNavigation
│       └── 1.4.* Profile phase
│           └── 1.5.* Research phase
│               └── 1.6.* Readiness system

Phase 2 Enhanced Input (depends on Phase 1)
├── 2.1.* Voice input (depends on 1.4.1)
├── 2.2.* Document import (depends on 1.4.1)
└── 2.3.* Research chat (depends on 1.5.1)

Phase 3 Testing & Publishing (depends on Phases 1-2)
├── 3.1.* Guru testing (depends on 1.4.*)
└── 3.2.* Publishing (depends on 1.1.3)

Phase 4 Polish (depends on Phases 1-3)
├── 4.1.* Migration banner
├── 4.2.* Auto-tagging (depends on 1.1.2)
├── 4.3.* Research suggestions (depends on 1.6.1, 2.3.2)
└── 4.4.* Mobile & performance
```

---

## Implementation Order Recommendation

### Sprint 1: Core Foundation
1. Task 1.1.1 - PedagogicalDimension model
2. Task 1.1.2 - CorpusDimensionTag model
3. Task 1.1.3 - PublishedGuru model
4. Task 1.1.4 - Update existing models
5. Task 1.1.5 - Seed data
6. Task 1.2.1 - Wizard types
7. Task 1.3.1 - Wizard layout
8. Task 1.3.2 - WizardNavigation

### Sprint 2: Profile Phase
1. Task 1.4.1 - Profile page shell
2. Task 1.4.2 - ProfileChatMode
3. Task 1.4.3 - ProfilePreview
4. Task 1.5.1 - Research page shell
5. Task 1.5.2 - Integrate research form

### Sprint 3: Readiness
1. Task 1.6.1 - Readiness scoring algorithm
2. Task 1.6.2 - Readiness API endpoint
3. Task 1.6.3 - Readiness page

### Sprint 4: Enhanced Input
1. Task 2.2.1 - Document dependencies
2. Task 2.2.2 - Document parse API
3. Task 2.2.3 - ProfileDocumentMode
4. Task 2.1.1 - ProfileVoiceMode
5. Task 2.1.2, 2.2.4 - Enable modes

### Sprint 5: Research Chat
1. Task 1.2.2 - Research chat types
2. Task 2.3.1 - Plan refinement API
3. Task 2.3.2 - ResearchChatAssistant
4. Task 2.3.3 - ResearchPlanDisplay
5. Task 2.3.4 - Update research page

### Sprint 6: Testing & Publishing
1. Task 1.2.3 - Testing types
2. Task 3.1.1 - Guru test chat API
3. Task 3.1.2 - GuruTestChat component
4. Task 3.1.3 - Integrate testing
5. Task 3.2.1 - nanoid dependency
6. Task 3.2.2 - Publishing API
7. Task 3.2.3, 3.2.4 - Public guru view
8. Task 3.2.5 - Publishing UI

### Sprint 7: Polish
1. Task 4.1.1, 4.1.2 - Migration banner
2. Task 4.2.1, 4.2.2, 4.2.3 - Auto-tagging
3. Task 4.3.1 - Research suggestions
4. Task 4.4.1, 4.4.2 - Mobile & performance

---

## Success Metrics

After implementation, verify:

- [ ] New user can complete wizard flow in < 15 minutes
- [ ] Voice input works in Chrome/Edge
- [ ] Document import handles 10MB files
- [ ] Readiness score calculates correctly
- [ ] Guru testing limits enforced
- [ ] Published links resolve correctly
- [ ] 404 for revoked links
- [ ] All E2E tests pass
- [ ] Mobile responsiveness adequate
- [ ] Performance targets met (see spec)

---

*Generated by `/spec:decompose` command*
