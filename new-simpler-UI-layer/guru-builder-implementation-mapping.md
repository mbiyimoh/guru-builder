# Guru Builder v4: Implementation Mapping Report

## Executive Summary

This document maps the new UX prototype (v4) to the existing backend system, identifying what functionality exists, what needs modification, and what requires net-new development.

**Legend:**
- 🟢 **EXISTS** — Functionality fully exists, just needs new UI layer
- 🟡 **PARTIAL** — Core exists but needs modifications/extensions  
- 🔴 **NEW** — Requires net-new implementation

---

## Existing System Capabilities (from technical handoff)

The current backend provides:
- **Project/profile management** via Supabase and Prisma
- **Deep research runs** that search the web and synthesize findings
- **Recommendation system** that proposes changes to guru's corpus
- **Three teaching artifact types**: Mental Models, Curriculum, Drill Series
- **Domain-specific tooling** (backgammon): position library (460+ positions), GNU Backgammon integration
- **Corpus management** with context layers and knowledge files

---

## Phase 1: Profile Creation

### 1.1 Chat-Based Profile Creation
| Feature | Status | Notes |
|---------|--------|-------|
| AI interview conversation | 🟢 EXISTS | Existing chat/conversation infrastructure |
| Profile synthesis from conversation | 🟡 PARTIAL | May need new prompt template for synthesis |
| Profile data model (domain, audience, approach, tone, perspective) | 🟢 EXISTS | Existing profile schema in Supabase |
| Profile editing/updates | 🟢 EXISTS | CRUD operations exist |

### 1.2 Import-Based Profile Creation
| Feature | Status | Notes |
|---------|--------|-------|
| File upload (PDF, DOCX, TXT) | 🔴 NEW | Need file upload endpoint and storage |
| Document parsing/extraction | 🔴 NEW | Need document processing pipeline |
| Profile synthesis from documents | 🔴 NEW | New prompt template + extraction logic |
| Multi-file aggregation | 🔴 NEW | Combine insights from multiple uploads |

### 1.3 Voice-Based Profile Creation
| Feature | Status | Notes |
|---------|--------|-------|
| Audio recording capture | 🔴 NEW | Browser MediaRecorder API → backend |
| Speech-to-text transcription | 🔴 NEW | Need Whisper/Deepgram integration |
| Multi-question voice flow | 🔴 NEW | Sequenced Q&A state management |
| Profile synthesis from transcripts | 🟡 PARTIAL | Similar to chat synthesis once transcribed |

**Phase 1 Summary:** Chat mode is mostly a reskin. Import and Voice modes require significant new infrastructure.

---

## Phase 2: Research & Knowledge Building

### 2.1 Research Plan Generation
| Feature | Status | Notes |
|---------|--------|-------|
| Generate research queries from topic | 🟢 EXISTS | Existing research prompt generation |
| Domain-aware query generation | 🟡 PARTIAL | Need to inject profile context into prompts |
| Research plan preview/display | 🟢 EXISTS | Data exists, just needs UI |
| Plan refinement via chat | 🟡 PARTIAL | Need conversational plan editing loop |

### 2.2 Research Execution
| Feature | Status | Notes |
|---------|--------|-------|
| Deep web research | 🟢 EXISTS | Core research run functionality |
| Source aggregation | 🟢 EXISTS | Multi-source synthesis |
| Recommendation generation | 🟢 EXISTS | Existing recommendation system |
| Confidence scoring | 🟢 EXISTS | Already generates confidence scores |

### 2.3 Research History
| Feature | Status | Notes |
|---------|--------|-------|
| Store research run history | 🟢 EXISTS | Research runs persisted in DB |
| View past research runs | 🟢 EXISTS | Query existing data |
| Adoption tracking per recommendation | 🟢 EXISTS | Recommendation status tracked |
| Summary/stats display | 🟡 PARTIAL | May need aggregation queries |

### 2.4 Pedagogical Dimensions (NEW in v4)
| Feature | Status | Notes |
|---------|--------|-------|
| Universal dimension taxonomy | 🔴 NEW | New data model for 6 dimensions |
| Dimension tagging for corpus items | 🔴 NEW | Tag knowledge items by dimension |
| Gap detection by dimension | 🔴 NEW | Query corpus coverage per dimension |
| Dimension-specific research prompts | 🔴 NEW | Prompt templates per dimension |

**Phase 2 Summary:** Research execution is solid. The new pedagogical dimension system is the main new work.

---

## Phase 3: Corpus Management (Readiness Checkpoint in v4)

### 3.1 Corpus Viewing
| Feature | Status | Notes |
|---------|--------|-------|
| View corpus contents | 🟢 EXISTS | Corpus/knowledge file queries exist |
| Knowledge item details | 🟢 EXISTS | Item metadata accessible |
| Source attribution | 🟢 EXISTS | Source tracking exists |

### 3.2 Readiness Assessment
| Feature | Status | Notes |
|---------|--------|-------|
| Dimension coverage calculation | 🔴 NEW | Requires dimension tagging first |
| Profile completeness score | 🟡 PARTIAL | Need scoring algorithm |
| Gap identification with suggestions | 🔴 NEW | Connect gaps → research suggestions |
| Overall readiness score | 🔴 NEW | Aggregate scoring logic |

### 3.3 Recommendation Review (moved from separate phase)
| Feature | Status | Notes |
|---------|--------|-------|
| View recommendations | 🟢 EXISTS | Recommendation queries exist |
| Approve/reject recommendations | 🟢 EXISTS | Status update functionality |
| Apply approved changes to corpus | 🟢 EXISTS | Corpus update operations |
| Diff preview | 🟡 PARTIAL | May need enhanced diff generation |

**Phase 3 Summary:** Corpus basics exist. Readiness scoring and dimension-based gap analysis are new.

---

## Phase 4: Artifact Creation

### 4.1 Mental Model Generation
| Feature | Status | Notes |
|---------|--------|-------|
| Generate mental model from corpus | 🟢 EXISTS | Artifact generation exists |
| Display mental model structure | 🟢 EXISTS | Data model supports this |
| Edit mental model | 🟡 PARTIAL | May need inline editing UI |

### 4.2 Curriculum Generation
| Feature | Status | Notes |
|---------|--------|-------|
| Generate curriculum from corpus | 🟢 EXISTS | Artifact generation exists |
| Phase/lesson structure | 🟢 EXISTS | Curriculum schema supports |
| Expand/collapse phases | 🟢 EXISTS | Data exists, UI layer only |

### 4.3 Drill Generation
| Feature | Status | Notes |
|---------|--------|-------|
| Generate drill series | 🟢 EXISTS | Drill generation exists |
| Position library integration | 🟢 EXISTS | 460+ positions available |
| GNU Backgammon verification | 🟢 EXISTS | Ground truth integration |
| Interactive drill viewer | 🟡 PARTIAL | Have prototype, needs integration |

### 4.4 Guru Testing
| Feature | Status | Notes |
|---------|--------|-------|
| Chat with generated guru | 🟡 PARTIAL | Need inference endpoint using corpus |
| Test guru responses | 🟡 PARTIAL | Requires guru "runtime" |

### 4.5 Publishing
| Feature | Status | Notes |
|---------|--------|-------|
| Generate shareable link | 🔴 NEW | Public URL generation |
| Embed code generation | 🔴 NEW | iframe/widget embed |
| Mobile app packaging | 🔴 NEW | Future consideration |
| Access control/permissions | 🔴 NEW | Public vs private gurus |

**Phase 4 Summary:** Core artifact generation exists. Testing and publishing are new.

---

## Cross-Cutting Concerns

### Navigation & State
| Feature | Status | Notes |
|---------|--------|-------|
| Multi-phase wizard flow | 🔴 NEW | New navigation paradigm |
| Progress persistence | 🟡 PARTIAL | Need session/draft state |
| Back/forward navigation | 🔴 NEW | UI navigation logic |

### Example Gurus
| Feature | Status | Notes |
|---------|--------|-------|
| Pre-built example gurus | 🔴 NEW | Need seed data |
| "Use as template" flow | 🔴 NEW | Clone/fork guru functionality |
| Example guru chat testing | 🟡 PARTIAL | Depends on guru runtime |

---

## Priority Implementation Roadmap

### Tier 1: Core Reskin (Low Effort, High Impact)
These require minimal backend changes — mostly UI work:

1. Chat-based profile creation flow
2. Research plan display and execution
3. Research history viewing
4. Recommendation review (inline in research flow)
5. Corpus explorer
6. Artifact generation and viewing
7. Drill viewer integration

### Tier 2: Backend Extensions (Medium Effort)
Extend existing systems:

1. Domain-aware research prompt injection
2. Conversational research plan refinement
3. Profile completeness scoring
4. Diff preview enhancements
5. Guru testing/chat runtime

### Tier 3: New Infrastructure (High Effort)
Net-new systems required:

1. **Pedagogical Dimension System**
   - Dimension taxonomy data model
   - Corpus item tagging
   - Gap detection queries
   - Dimension-specific prompt templates

2. **Voice Input Pipeline**
   - Audio upload/storage
   - Speech-to-text integration
   - Multi-question orchestration

3. **Document Import Pipeline**
   - File upload endpoint
   - Document parsing (PDF, DOCX)
   - Content extraction and synthesis

4. **Publishing System**
   - Public URL generation
   - Embed widget
   - Access control

5. **Example Guru System**
   - Seed data creation
   - Template/clone functionality

---

## Recommended Implementation Order

**Sprint 1: Core Flow Reskin**
- New UI shell with phase navigation
- Chat profile creation (reskin)
- Research execution (reskin)
- Inline recommendation review
- Artifact viewing

**Sprint 2: Readiness & Dimensions**
- Pedagogical dimension data model
- Corpus item dimension tagging
- Gap detection and readiness scoring
- Dimension-specific research prompts

**Sprint 3: Voice & Import**
- Voice recording + transcription
- Document upload + parsing
- Multi-modal profile synthesis

**Sprint 4: Testing & Publishing**
- Guru chat runtime
- Public URL generation
- Embed functionality

**Sprint 5: Polish & Examples**
- Example guru seed data
- Template system
- Onboarding refinements

---

## Technical Dependencies

| New Feature | External Dependencies |
|-------------|----------------------|
| Voice transcription | Whisper API / Deepgram / AssemblyAI |
| Document parsing | pdf-parse, mammoth.js, or cloud service |
| Public URLs | URL shortener / subdomain routing |
| Embed widget | iframe sandboxing, postMessage API |

---

## Questions for Engineering

1. **Dimension Tagging**: Should dimensions be auto-detected from content, manually assigned, or both?

2. **Voice Storage**: Store audio files permanently or discard after transcription?

3. **Guru Runtime**: Is there an existing inference endpoint that can use corpus context, or does this need building?

4. **Publishing Scope**: MVP = shareable link only? Or embed required for launch?

5. **Example Gurus**: Create from scratch, or use existing test data?

---

## Appendix: UI Components Inventory

New UI components needed (all exist in prototype, need production versions):

- `WizardNavigation` — Phase stepper with progress
- `ChatInterface` — Reusable chat component
- `VoiceRecorder` — Multi-question voice capture
- `FileUploader` — Drag-and-drop with file list
- `ResearchPlanEditor` — Split-panel plan refinement
- `CorpusExplorer` — Dimension-organized knowledge browser
- `ReadinessGauge` — Score visualization with breakdown
- `RecommendationCard` — Approve/reject with confidence
- `ArtifactViewer` — Type-specific artifact rendering
- `DrillViewer` — Interactive 3D board (exists from previous work)
- `GuruChatTester` — Test conversations with generated guru
- `PublishModal` — Share link and embed options
