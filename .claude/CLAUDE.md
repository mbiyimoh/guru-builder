# Guru Builder System

## Overview

Platform for creating AI teaching assistants ("gurus") through autonomous research-and-apply workflow:
1. **Create** corpus (context layers + knowledge files)
2. **Research** autonomously using GPT-4o
3. **Review** AI-generated recommendations
4. **Apply** approved changes with snapshot backups
5. **Iterate** continuously

---

## Core Architecture

### Tech Stack
- **Frontend:** Next.js 15 + React 19 + Tailwind + shadcn/ui
- **Database:** PostgreSQL (Neon) + Prisma
- **Auth:** Supabase (email/password with whitelist)
- **AI:** Vercel AI SDK v5 + OpenAI GPT-4o
- **Background Jobs:** Inngest
- **Hosting:** Railway (Docker)
- **Testing:** Playwright E2E

### Production
- **URL:** https://guru-builder-production.up.railway.app
- **Guide:** `developer-guides/06-railway-deployment-guide.md`

### Data Models
```
Project
├── ContextLayers[] (foundational knowledge)
├── KnowledgeFiles[] (reference documents)
├── ResearchRuns[] → Recommendations[]
└── CorpusSnapshots[] (backup/versioning)
```

### Critical Directories
```
app/api/project/[id]/     # context-layers, knowledge-files, research
lib/inngest-functions.ts  # Background jobs
lib/applyRecommendations.ts
prisma/schema.prisma      # Database schema (source of truth)
```

---

## Authentication

Supabase email/password with whitelist (`ALLOWED_EMAILS` env var).

**Key Files:** `lib/auth.ts`, `app/auth/callback/route.ts`, `middleware.ts`

**Flow:** Protected route → `/login` → Supabase auth → Callback syncs to Prisma → Session cookie → `/projects`

---

## Agent Protocols

### Codebase Exploration
```
Use Task tool with subagent_type: "Explore"
```
For finding implementations, understanding relationships, locating patterns.

### Database Schema Changes

**ALWAYS:**
1. `npm run db:backup` (mandatory)
2. `npm run migrate:safe -- descriptive-name`

**NEVER without approval:** `npx prisma db push --force-reset`, `npx prisma migrate reset`

### OpenAI Structured Outputs

With `strict: true`, optional fields MUST use `.nullable().optional()`:
```typescript
// CORRECT
z.object({ optionalField: z.string().nullable().optional() });
// WRONG - API error
z.object({ optionalField: z.string().optional() });
```

Check Inngest logs at http://localhost:8288 for schema validation errors.

### Teaching Artifact Viewer

Three view modes: **Rendered**, **Markdown**, **JSON**. Each artifact type has specialized renderer.

**Key Components:**
- `components/artifacts/ViewModeToggle.tsx`
- `components/artifacts/renderers/TypeSpecificRenderer.tsx`
- `components/artifacts/renderers/*Renderer.tsx` (MentalModel, Curriculum, DrillSeries)
- `lib/teaching/hooks/useActiveSection.ts` - Uses `JSON.stringify(sectionIds)` in deps to avoid infinite re-renders

### Unified Teaching Artifact Page

Single-page artifact management with sidebar navigation and inline generation.

**Key Files:**
- `components/artifacts/UnifiedArtifactPage.tsx` - Main orchestrator component
- `components/artifacts/ArtifactListSidebar.tsx` - Sidebar with artifact list
- `components/artifacts/ArtifactDetailPanel.tsx` - Detail view with renderers
- `components/artifacts/EmptyStateGuidance.tsx` - Onboarding when no artifacts exist

**Architecture:**
- `hasValidContent()` validates artifact structure before rendering (checks for `{}` or incomplete content)
- Error types: `network`, `api`, `timeout`, `generation` with specialized UI feedback
- Default drill config: ALL phases for Simple Mode (not just OPENING)

**Content Validation:**
```typescript
// Mental Model: requires categories array
'categories' in content && content.categories.length > 0

// Curriculum: requires universalPrinciplesModule and phaseModules
'universalPrinciplesModule' in content && 'phaseModules' in content

// Drill Series: supports legacy (series[]) or phase-organized (phases[])
('series' in content && content.series.length > 0) ||
('phases' in content && content.phases.length > 0)
```

**Gotchas:**
- During generation, content may be `{}` - use `hasValidContent()` check
- Use `Cache-Control: no-store` on artifact fetch endpoints
- Poll for `COMPLETED` status AND valid content structure

### Prisma Polymorphic Associations

Use **separate nullable FK fields** for models referencing multiple tables:
```prisma
model Recommendation {
  targetType       TargetType
  contextLayerId   String?
  knowledgeFileId  String?
  contextLayer     ContextLayer?  @relation(fields: [contextLayerId], references: [id])
  knowledgeFile    KnowledgeFile? @relation(fields: [knowledgeFileId], references: [id])
}
```

**Empty Strings vs NULL:** Use `null` for FK fields, not `""` (PostgreSQL constraint).

### Research Run Gotchas

1. **Tavily API:** 400 char max query. Always truncate programmatically.
2. **Inngest Hot Reload:** Changes to `lib/inngest-functions.ts` require full server restart.
3. **Status Polling:** Poll until `status === 'COMPLETED' AND recommendationCount > 0`

### Inngest Monitoring

Check Inngest logs when working on background jobs.

**Quick:** `./scripts/inngest-monitor.sh 5`
**UI:** http://localhost:8288

**Common Issues:** ZodError (malformed JSON), 429 TPM (rate limit), timeouts, missing dependencies

### Prompt Customization & Drift Detection

Per-project prompt customization with automatic drift detection.

**Key Files:** `lib/teaching/types.ts`, `lib/teaching/promptUtils.ts`, `components/artifacts/ArtifactHeader.tsx`

**How it works:**
1. Prompts hashed and stored with artifact on generation
2. `detectPromptDrift()` compares current prompts to stored hashes
3. `wasGeneratedWithCustomPrompts()` checks promptConfigId or hashes

**Gotchas:** Check `null` explicitly, use `null` not `""` for FKs, legacy artifacts return `false`

### Ground Truth Content Validation

Mathematical verification using external engines (GNU Backgammon).

**Models:** `GroundTruthEngine`, `ProjectGroundTruthConfig`

**Key Components:** `lib/groundTruth/` (types, tools, executor, cache, config, verification)

**Flow:**
1. Admin seeds engines: `npm run seed:ground-truth-engines`
2. User selects engine via `GroundTruthEngineManager`
3. `resolveGroundTruthConfig(projectId)` returns active engine
4. Inngest functions enable verification if available

**Status:** VERIFIED (all pass) / NEEDS_REVIEW (>30% fail) / FAILED (error)

**Caching:** Opening positions 7d, specific positions 24h, move verifications 1h

**Limits:** MAX_TOOL_CALLS=100, MAX_ITERATIONS=50, ENGINE_QUERY_TIMEOUT=10s

### Position Library

Stores pre-verified positions from GNUBG for scenario-based drill generation.

**Models:** `PositionLibrary`, `GamePhase` enum (OPENING, EARLY, MIDDLE, BEAROFF), `SelfPlayBatch`

**Key Files:** `lib/positionLibrary/` (types, openings, asciiRenderer, seeder, selfPlayGenerator)

**Flow:** Population → Seeding → Generation → Tracking (`GuruArtifact.positionsUsed`)

**Population Methods:**
1. **Match Import** - Extract positions from `.mat` match files
2. **Self-Play** - Simulate games via GNUBG, collect all positions

**Self-Play Generation:**
- Admin UI: Ground Truth Engine → Position Library → Self-Play Generator
- API: `POST /api/position-library/self-play` (admin-only)
- Inngest job: `selfPlayGenerationJob`
- Config: `gamesCount` (1-100), `skipOpening` (default true)

**DEPRECATED (DO NOT RECREATE):**
- `lib/positionLibrary/positionSeeds.ts`
- `lib/positionLibrary/nonOpeningPositions.ts`
- `seedOpeningPositions()` - Use `seedPositionsForPhase(engineId, 'OPENING')`

Positions now from Match Import or Self-Play, not hardcoded arrays.

### Phase-Organized Drill Schema

Hierarchical structure: `phases[] → principleGroups[] → drills[]`

**Key Files:**
- `lib/guruFunctions/schemas/phaseOrganizedDrillSchema.ts`
- `lib/guruFunctions/generators/drillDesigner.ts`
- `lib/backgammon/principles.ts` - 3 universal + 8 phase-specific

**Schema:**
```typescript
{
  phases: [{
    phase: 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF',
    principleGroups: [{
      principleId: string,
      drills: [{
        tier: 'RECOGNITION' | 'APPLICATION' | 'TRANSFER',
        primaryPrincipleId: string,
        universalPrincipleIds: string[],
        options: [{ id, text, isCorrect }],  // MUST be objects
        feedback: { correct: string, incorrect: string }
      }]
    }]
  }]
}
```

**Gotchas:** `options` must be objects (GPT sometimes returns strings), legacy has `series[]` array

### Type Consolidation Pattern

Consolidate shared types into dedicated files (e.g., `lib/teaching/types.ts`). Always import from shared file, re-export if needed.

### Readiness Re-Assessment

Manual trigger for dimension tagging on existing corpus items.

**Key Files:**
- `app/api/projects/[id]/readiness/route.ts` - POST handler with timeout protection
- `app/projects/[id]/readiness/ReadinessPageContent.tsx` - Button with loading state
- `lib/dimensions/suggestDimensions.ts` - Core OpenAI dimension suggestion logic
- `lib/dimensions/autoTag.ts` - Batch tagging with direct function calls

**How it works:**
1. User clicks "Re-assess Readiness" button
2. POST to `/api/projects/{id}/readiness`
3. Fetches all context layers and knowledge files
4. Runs `autoTagCorpusItems()` with 55-second timeout
5. Recalculates readiness score
6. Returns updated score/dimensions with optional warning

**Gotchas:**
- Uses direct function calls (`suggestDimensions()`) not HTTP to avoid auth issues
- 55-second timeout prevents serverless function timeouts on large corpora
- Timeout returns partial results with warning (graceful degradation)
- User feedback via `alert()` for errors and timeouts (codebase convention)
- Response includes `warning` field if timeout occurred

**Timeout pattern:**
```typescript
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('Re-assessment timed out')), TIMEOUT_MS)
);
try {
  await Promise.race([autoTagCorpusItems(items), timeoutPromise]);
} catch (err) {
  if (err.message === 'Re-assessment timed out') {
    // Continue with partial results
  }
}
```

### Onboarding Tooltips (Driver.js)

Interactive product tours using Driver.js library for user onboarding.

**Key Files:**
- `lib/onboarding/usePageTour.ts` - Hook for managing tour state and auto-start
- `lib/onboarding/tours.ts` - Tour step definitions by page
- `components/TourPageButton.tsx` - Manual tour trigger button

**How it works:**
1. Tours auto-start on first visit (localStorage tracking per tour ID)
2. Mobile detection skips tours (< 768px width)
3. Hydration-safe: localStorage only accessed after mount
4. Driver.js automatically skips steps where target elements don't exist

**Tour Configuration:**
```typescript
const driverObj = driver({
  showProgress: false,           // Hide "X of Y" text (redundant with buttons)
  nextBtnText: 'Next',
  prevBtnText: 'Back',
  doneBtnText: 'Done',
  allowKeyboardControl: true,     // ESC to close, arrows to navigate
  onDestroyed: markSeen,          // Save completion to localStorage
  steps: [/* tour steps */],
});
```

**Targeting Elements:**
Use `data-tour="step-id"` attributes on elements to highlight:
```tsx
<div className="flex items-center gap-2" data-tour="mode-toggle">
  <Switch ... />
</div>
```

**Gotchas:**
- Tours only run on desktop (mobile users won't see them)
- `data-tour` attributes should target specific interactive elements, not wrapper divs
- LocalStorage failures (private browsing) default to "tour seen" to avoid errors
- 500ms delay before auto-start ensures DOM elements are rendered

### Profile Scorecard Enhancement

Modern collapsible scorecard for guru profile with confidence-based highlighting.

**Key Components:**
- `components/profile/ProfileScorecard.tsx` - Main orchestrator
- `components/profile/ScorecardSection.tsx` - Collapsible section with progress
- `components/profile/ScorecardConfidenceRing.tsx` - Visual confidence indicator
- `components/profile/ScorecardRefinementInput.tsx` - Text/voice input for improvements
- `lib/guruProfile/sectionConfig.ts` - Shared section definitions

**Architecture:**
- **Confidence ring**: SVG-based circular progress (green ≥80%, amber <80%)
- **Light areas**: Fields with confidence <0.8 highlighted in amber with "Click to improve" badges
- **Collapsible sections**: Expand/collapse with smooth animations, show "X areas to improve" badges
- **Section scoring**: `(fields.length - lightCount) / fields.length * 100`

**Refinement Workflow:**
1. User clicks "Click to improve" badge on light area
2. Modal opens with `ScorecardRefinementInput` (text or voice)
3. Input sent to `/api/projects/[id]/guru-profile` with field context
4. AI refines specific field based on user guidance
5. Profile updates, scorecard re-renders with new scores

**Voice Input:**
- Chrome/Edge only (uses Web Speech API)
- Microphone permission required
- Real-time transcription display
- Auto-submit on silence detection

**Gotchas:**
- Section config must match profile structure exactly
- Confidence threshold 0.8 (not 0.6 like dimension tags)
- Voice not available in Firefox/Safari - gracefully degrades to text-only
- Use `disabled` prop during refinement to prevent duplicate requests

### Cancellation Pattern

User-initiated cancellation for long-running operations (research, artifact generation).

**Key Files:**
- `app/api/projects/[id]/research/[runId]/cancel/route.ts` - Research cancellation
- `app/api/artifacts/[id]/cancel/route.ts` - Artifact generation cancellation
- `lib/inngest-functions.ts` - Inngest job cancellation checks

**Pattern:**
```typescript
// 1. API Route - Set status to CANCELLED
await prisma.researchRun.update({
  where: { id: runId },
  data: { status: 'CANCELLED', cancelledAt: new Date() }
});

// 2. Inngest Job - Check for cancellation before each step
const run = await prisma.researchRun.findUnique({ where: { id: runId } });
if (run.status === 'CANCELLED') {
  return { cancelled: true };
}

// 3. UI - Cancel button with optimistic update
const handleCancel = async () => {
  setIsCancelling(true);
  await fetch(`/api/.../cancel`, { method: 'POST' });
  router.refresh();
};
```

**Gotchas:**
- Cancellation is cooperative - jobs must check status periodically
- Add checks BEFORE expensive operations (API calls, DB queries)
- Set `cancelledAt` timestamp for audit trail
- UI should disable cancel button during cancellation (loading state)
- Use `router.refresh()` to update UI after cancellation

### Recommendation Refinement & Inline Diff

AI-powered refinement of pending recommendations with visual diff display.

**Key Files:**
- `app/api/recommendations/[id]/refine/route.ts` - Refinement endpoint (POST)
- `lib/recommendations/refineRecommendation.ts` - Core refinement logic with GPT
- `components/recommendations/RefinementInput.tsx` - User input component with examples
- `components/recommendations/InlineContentDiff.tsx` - Inline diff visualization
- `app/projects/[id]/research/[runId]/RecommendationsView.tsx` - Parent orchestrator

**Architecture:**
- Auto-expansion: When user clicks "Refine", content preview auto-opens
- Inline diff: After refinement, shows red strikethrough (deletions) and green highlight (additions)
- Ephemeral diff: Clears on approve/reject/refresh
- Character limits: 2000 max, 500 recommended (matches API validation)

**Critical Patterns:**
```typescript
// 1. Cache Control for Mutation Endpoints (REQUIRED)
export const dynamic = 'force-dynamic';  // Top of route file

return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }
});

// 2. Stable React Keys (NOT index)
const stableKey = `${index}-${type}-${content.slice(0, 20).replace(/\s/g, '_')}`;

// 3. Memoized Diff Computation
const segments = useMemo(
  () => computeDiff(originalContent, newContent),
  [originalContent, newContent]
);

// 4. State Management Pattern
const [refinementExpandedId, setRefinementExpandedId] = useState<string | null>(null);
const [preRefinementContent, setPreRefinementContent] = useState<{
  id: string;
  fullContent: string;
} | null>(null);
```

**Gotchas:**
- MUST use stable keys in diff rendering (not array index) - prevents React rendering glitches
- MUST add `export const dynamic = 'force-dynamic'` to mutation endpoints - prevents Next.js cache issues
- MUST clear diff state on approve/reject - prevents stale diffs showing for wrong recommendation
- Character count should match API sanitization logic (trim + collapse whitespace)
- RefinementError class provides structured error handling with retry hints

### Research Summary Generation

GPT-powered standalone summaries instead of truncation.

**Key Files:**
- `lib/researchOrchestrator.ts` - `generateSummary()` function
- `components/research/ResearchFindingsView.tsx` - Summary display with bullet extraction
- `components/research/FullReportModal.tsx` - Full report with ReactMarkdown

**How it works:**
1. After full research report generation, GPT creates a standalone summary
2. Format: Intro sentence (max 100 chars) + 3-4 bullet points (60-100 chars each)
3. Total under 500 chars, plain text (no markdown formatting)
4. Full report renders with ReactMarkdown in modal

**Critical Pattern:**
```typescript
async function generateSummary(fullReport: string, query: string): Promise<string> {
  if (!fullReport || fullReport.length < 100) {
    console.warn(`[Research] Summary generation skipped - report too short`);
    return "Research completed. See full report for details.";
  }

  const completion = await getOpenAI().chat.completions.create({
    model: RESEARCH_MODEL,
    messages: [
      {
        role: "system",
        content: `Create a brief, scannable summary.
- Start with ONE introductory sentence (max 100 chars)
- Follow with 3-4 bullet points (start with "• ")
- Each bullet 60-100 chars
- Total under 500 characters
- Plain text only - NO markdown formatting`
      },
      {
        role: "user",
        content: `Summarize: "${query}"\n\n${fullReport.slice(0, 3000)}`
      }
    ],
    temperature: 0.5,
    max_tokens: 300,
  });

  return completion.choices[0]?.message?.content?.trim() || "Research completed.";
}
```

**Gotchas:**
- Don't truncate the full report - generate a proper summary
- GPT doesn't always follow exact char limits - add buffer and enforce max length
- Log warnings when summaries can't be generated (helps debugging)
- Use ReactMarkdown for full report display, but keep summary as plain text

### User Feedback System

Platform-wide feedback collection with upvoting capability.

**Key Files:**
- `lib/feedback/validation.ts` - Zod schemas and display labels
- `app/api/feedback/route.ts` - POST (create), GET (list with filters)
- `app/api/feedback/[id]/route.ts` - GET (single item)
- `app/api/feedback/[id]/vote/route.ts` - POST (upvote/remove)
- `components/feedback/` - FeedbackButton, FeedbackCard, FeedbackList, FeedbackForm, FeedbackDialog, UpvoteButton
- `app/feedback/page.tsx` - Feedback portal page

**Database Models:**
```prisma
model Feedback {
  id          String         @id @default(cuid())
  userId      String
  title       String         @db.VarChar(200)
  description String         @db.Text
  area        FeedbackArea   // PROJECTS, RESEARCH, ARTIFACTS, PROFILE, READINESS, UI_UX, OTHER
  type        FeedbackType   // BUG, ENHANCEMENT, IDEA, QUESTION
  status      FeedbackStatus @default(OPEN)
  upvoteCount Int            @default(0)  // Denormalized for sorting
  user        User           @relation("UserFeedback")
  votes       FeedbackVote[]
}

model FeedbackVote {
  feedbackId String
  userId     String
  @@unique([feedbackId, userId])  // One vote per user
}
```

**Architecture:**
- Sticky button (bottom-left, `z-50`) navigates to `/feedback`
- All operations require authentication (no public viewing)
- Optimistic UI for voting with rollback on error
- Atomic `$transaction` for vote + count updates
- Cursor-based pagination with filtering by area/type/status

**Integration:**
- FeedbackButton added to `app/layout.tsx` (shows when authenticated)
- Uses `alert()` for user feedback (codebase convention)

**Gotchas:**
- Admin status management is deferred (PATCH endpoint not implemented)
- Default filter excludes CLOSED status
- `upvoteCount` is denormalized - always use transactions when modifying votes

---

## SOPs

### Fresh Start (Dev Server Clean Restart)

When user asks for a "fresh start" or "clean restart", Claude MUST run these commands automatically (never just print them for the user to run manually):

```bash
# Kill existing processes
pkill -f "next dev" || true
pkill -f "inngest-cli dev" || true

# Clean caches
rm -rf .next node_modules/.cache

# Regenerate Prisma client
npx prisma generate

# Start Next.js (background)
PORT=3009 npm run dev &

# Wait for Next.js to be ready, then start Inngest
sleep 5 && npm run inngest:dev
```

**Important:** Always run these commands when asked - do not provide them as instructions for the user to execute.

### Database Safety

1. `npm run db:backup` (MANDATORY)
2. `npm run migrate:safe -- name`
3. Handle existing data (defaults for new required fields)

**Forbidden:** `--force-reset`, `migrate reset`, `--accept-data-loss`

### E2E Tests

Test projects must include "Test" in name. Global teardown removes test data.

```bash
npm run test:e2e          # All tests
npm run test:e2e:ui       # Interactive
npm run test:e2e:headed   # See browser
```

---

## Ports

- **3009** - Next.js dev
- **8288** - Inngest dev
- **5432** - PostgreSQL
- **5555** - Prisma Studio

---

## Environment Variables

**Required:**
```bash
DATABASE_URL, OPENAI_API_KEY, TAVILY_API_KEY
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
ALLOWED_EMAILS, ADMIN_EMAIL
```

**Production:** See `developer-guides/06-railway-deployment-guide.md`

---

## Async Job Race Conditions

When background job triggers follow-up job, UI may see "complete" before second job runs.

**Checklist:**
- Identify all jobs in event chain
- UI polls for final state, not intermediate
- Add `Cache-Control: no-store` headers
- Use `export const dynamic = 'force-dynamic'`

**Correct pattern:**
```typescript
if (newStatus === 'COMPLETED' && recommendationCount > 0) {
  router.refresh();  // All data ready
} else {
  // Keep polling
}
```

---

## Quick Commands

```bash
PORT=3009 npm run dev              # Next.js
npm run inngest:dev                # Inngest (uses -u flag)
npm run clean && PORT=3009 npm run dev  # Clean restart
npm run db:backup                  # Backup
npm run migrate:safe -- name       # Migration
npx prisma studio                  # GUI
npx tsc --noEmit                   # Type check
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port conflict | `lsof -ti:3009 \| xargs kill -9` |
| Stale cache | `npm run clean && PORT=3009 npm run dev` |
| Prisma client error | `npx prisma generate` |
| Research stuck | Check Inngest UI http://localhost:8288 |
| Research not executing | Use `npm run inngest:dev` (includes -u flag) |
| Schema mismatch | `npm run db:backup && npm run migrate:safe -- fix` |
| OpenAI API error | Check Zod schema validation in logs |
| Ground truth timeout | Check engine URL, increase timeout |
| Position Library empty | Populate via Match Import (`/api/match-import`) or Self-Play (`/api/position-library/self-play`) |
| Self-play batch stuck | Check Inngest UI - `selfPlayGenerationJob` may have engine timeout |
| ZodError options | GPT returned strings instead of `{id, text, isCorrect}` |
| 429 TPM | Prompt too large (target <25K tokens) |
| Auto-tagging fails silently | Check server logs - likely auth issue from HTTP calls |
| Readiness score not updating | Use "Re-assess Readiness" button to re-tag corpus |
| Re-assessment timeout | Normal for 50+ items - partial results returned |
| Tours not showing | Check: (1) Mobile <768px skips tours, (2) LocalStorage `tour-seen-{id}` = true, (3) Target elements exist |
| Voice input not working | Chrome/Edge only - Firefox/Safari don't support Web Speech API |
| Cancellation not stopping job | Add `status === 'CANCELLED'` checks before expensive operations in Inngest jobs |
| Refinement not showing changes | Check: (1) Add `export const dynamic = 'force-dynamic'` to endpoint, (2) Add cache control headers to response, (3) Use stable React keys (not index) |
| Diff view shows stale content | Clear `preRefinementContent` state on approve/reject actions |
| Feedback vote not updating | Ensure `$transaction` wraps both vote creation and `upvoteCount` update |
| Feedback button not showing | Check user is authenticated in `app/layout.tsx` |

---

## Wizard Flow (Simplified Frontend)

4-phase wizard for domain experts: **Profile → Research → Readiness → Artifacts**

**Spec:** `specs/simplified-frontend-wrapper/02-specification.md`

**Input Modes:** Chat (Q&A), Voice (Chrome/Edge), Document (PDF/DOCX/TXT)

### Models
```prisma
model PedagogicalDimension {
  key         String   @unique  // foundations, progression, mistakes, examples, nuance, practice
  isCritical  Boolean  // foundations, progression, mistakes = true
}

model CorpusDimensionTag {
  dimensionId     String
  contextLayerId  String?  // Polymorphic
  knowledgeFileId String?
  confidence      Float
}

model PublishedGuru {
  projectId   String    @unique
  shortId     String    @unique  // nanoid(10) for /g/{shortId}
}
```

### Readiness Scoring

`overall = (profile × 0.4) + (knowledge × 0.6)`

**Knowledge weights:** foundations 25%, progression 20%, mistakes 20%, examples 15%, nuance 10%, practice 10%

**Threshold:** `overall >= 60 AND criticalGaps.length === 0`

### API Endpoints
```
POST /api/documents/parse          # PDF/DOCX/TXT parsing
POST /api/research/refine-plan     # Research chat
GET  /api/projects/[id]/readiness  # Scoring
POST /api/projects/[id]/guru/chat  # Ephemeral test (max 20 msgs)
POST /api/projects/[id]/publish    # Get shortId
```

### Gotchas
- Voice: Chrome/Edge only
- Document: Server-side, 10MB max
- Guru Testing: 20 msgs max, ephemeral
- Publishing: nanoid(10), soft delete on revoke
- Dimension Tagging: ≥0.6 confidence auto-confirms (lowered from 0.8); unconfirmed = 40% coverage (up from 25%)

**Location:** `app/projects/new/`, `components/wizard/`, `lib/wizard/`, `lib/readiness/`

---

**Stack:** Next.js 15 + PostgreSQL + Prisma + OpenAI + Inngest + Supabase
**Port:** 3009 | **Production:** https://guru-builder-production.up.railway.app
