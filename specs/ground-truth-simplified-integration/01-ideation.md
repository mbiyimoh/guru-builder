# Ground Truth Engine & Position Library Integration into Simplified Frontend

**Slug:** ground-truth-simplified-integration
**Author:** Claude Code
**Date:** 2025-12-24
**Branch:** preflight/ground-truth-simplified-integration
**Related:**
- `specs/simplified-frontend-wrapper/02-specification.md`
- `specs/teaching-artifacts-landing-page/02-specification.md`
- `developer-guides/10-position-library-guide.md`
- `developer-guides/11-ground-truth-engine-guide.md`

---

## 1) Intent & Assumptions

### Task Brief
Integrate Ground Truth Engine and Position Library functionality into the simplified frontend experience. Enable domain detection during guru profile creation to automatically suggest relevant verification tools. Allow non-technical users to enable these features without understanding technical configuration.

### Assumptions
- Ground Truth Engine integration should happen **after** initial profile creation but **before** artifact generation
- The domain detection can use the `domain` field on `GroundTruthEngine` (e.g., "backgammon") to match against profile content
- Position Library is only relevant when a Ground Truth Engine is enabled
- The simplified frontend should abstract away technical complexity while preserving full functionality
- Future domains beyond backgammon should be supported (extensible architecture)
- The "old system" (admin page) remains available for advanced users via mode toggle

### Out of Scope
- Creating new Ground Truth engines for other domains (chess, poker, etc.) - infrastructure only
- Changes to the Ground Truth verification pipeline itself
- Self-play generator UI redesign (stays as-is but accessible from new location)
- Match import file upload workflow redesign
- Changes to drill/curriculum/mental-model generation logic

---

## 2) Pre-reading Log

### Specs & Guides
- `developer-guides/10-position-library-guide.md`: Position seeding architecture, game phases (OPENING/EARLY/MIDDLE/BEAROFF), self-play generation, match import system
- `specs/simplified-frontend-wrapper/02-specification.md`: 4-phase wizard flow (Profile → Research → Readiness → Artifacts), pedagogical dimensions, readiness scoring
- `specs/teaching-artifacts-landing-page/02-specification.md`: Split-view layout with sidebar + detail panel, simple/advanced mode toggle

### Components (Old System)
- `components/ground-truth/GroundTruthEngineManager.tsx` (693 lines): Full-featured widget with engine selection, health monitoring, position library stats, match import, self-play generator, Hardy's scraper
- `app/projects/[id]/admin/page.tsx`: Admin page where GT Engine manager currently lives

### Components (New System)
- `components/artifacts/TeachingArtifactsContent.tsx`: Current landing page with sidebar + detail panel
- `components/artifacts/ArtifactDetailPanel.tsx`: Detail panel with generation controls
- `components/wizard/profile/ProfileChatMode.tsx`: Chat interface for profile creation

### Database Models
- `GroundTruthEngine`: `id`, `name`, `domain`, `engineUrl`, `description`, `iconUrl`, `isActive`
- `ProjectGroundTruthConfig`: Links project to engine with `isEnabled` flag
- `PositionLibrary`: Positions with `gamePhase` enum (OPENING/EARLY/MIDDLE/BEAROFF)
- `SelfPlayBatch`: Tracks self-play generation jobs

---

## 3) Codebase Map

### Primary Components/Modules
| Location | Role |
|----------|------|
| `components/ground-truth/GroundTruthEngineManager.tsx` | Full GT widget (693 lines) - needs simplification for new system |
| `components/position-library/SelfPlayGenerator.tsx` | Self-play UI widget |
| `components/position-library/PositionLibraryBrowser.tsx` | Browse positions modal |
| `components/match-import/MatchImportModal.tsx` | File upload modal |
| `lib/groundTruth/config.ts` | `resolveGroundTruthConfig(projectId)` |
| `lib/positionLibrary/seeder.ts` | `seedPositionsForPhase()`, `seedPositionsByPhase()` |

### API Routes
| Route | Purpose |
|-------|---------|
| `GET /api/ground-truth-engines` | List available engines |
| `GET/POST/DELETE /api/projects/[id]/ground-truth-config` | Manage project's GT config |
| `GET /api/projects/[id]/ground-truth/health` | Engine health check |
| `GET /api/position-library/counts` | Position counts by phase |
| `POST /api/match-import/scrape` | Hardy's scraper |
| `POST /api/position-library/self-play` | Start self-play batch |

### Shared Dependencies
- `lib/groundTruth/` - Types, tools, executor, cache, config, verification
- `lib/positionLibrary/` - Types, seeder, openings, asciiRenderer

### Data Flow
```
Profile Creation → Domain Detection → GT Engine Suggestion
                         ↓
              User enables GT Engine
                         ↓
         Position Library populates (auto or manual)
                         ↓
    Artifact Generation uses positions for drills
                         ↓
         Verification pipeline checks claims
```

### Feature Flags/Config
- `GroundTruthEngine.isActive` - Engine availability flag
- `ProjectGroundTruthConfig.isEnabled` - Per-project enablement

### Potential Blast Radius
- Profile creation flow (add domain detection step)
- Teaching artifacts page (add GT/Position Library panel)
- Readiness page (show GT status in readiness check)
- Artifact generation API (already uses GT config)

---

## 4) Root Cause Analysis

N/A - This is a new feature integration, not a bug fix.

---

## 5) Research

### Current State Analysis

**Old System (Admin Page):**
```
/projects/[id]/admin
├── GuruProfileSection
├── ProjectAssessmentManager
├── GroundTruthEngineManager  ← Full GT widget here
│   ├── Engine selector
│   ├── Health monitoring
│   ├── Position Library
│   │   ├── Self-play generator (PRIMARY - generates positions via GNUBG)
│   │   ├── Match import (file upload)
│   │   ├── Hardy's scraper (legacy - external site dependency)
│   │   └── Position browser
│   └── Stats display
├── GuruTeachingManager
├── ContextLayerManager
└── KnowledgeFileManager
```

**New System (Simplified Frontend):**
```
/projects/[id]/artifacts/teaching
├── TeachingArtifactsContent
│   ├── ArtifactListSidebar (Mental Model / Curriculum / Drills)
│   ├── ArtifactDetailPanel
│   │   ├── EmptyStateGuidance
│   │   ├── SimpleToolbar (Generate button)
│   │   └── TypeSpecificRenderer
│   └── ReadinessWarning
└── (No GT Engine integration yet)
```

### Potential Solutions

#### Solution 1: Inline GT Panel in Artifacts Page
Add GT Engine panel directly above artifact generation area.

**Pros:**
- Everything in one place
- Clear connection between GT and drill generation
- Simple navigation

**Cons:**
- Can clutter the UI
- GT setup is one-time, not needed on every visit

#### Solution 2: Dedicated "Tools" Tab/Section
Create a separate tools management area within the simplified frontend.

**Pros:**
- Clean separation of concerns
- Extensible for future tools
- GT/Position Library only visible when relevant

**Cons:**
- One more navigation step
- May be unclear how tools connect to artifacts

#### Solution 3: Smart Onboarding Flow (Recommended)
Detect domain after profile creation, prompt user with contextual suggestion.

**Pros:**
- Proactive, not reactive
- Non-technical explanation at the right moment
- Minimal UI footprint post-setup
- Domain-agnostic pattern for future engines

**Cons:**
- Requires domain detection logic
- Need to handle edge cases (no matching engine)

### Recommendation

**Hybrid Approach: Smart Onboarding + Collapsible Panel**

1. **Domain Detection & Onboarding** - After profile creation, analyze content for domain keywords. If match found, show friendly prompt to enable verification tools.

2. **Collapsible Tools Panel** - In artifacts page, add a collapsible "Accuracy Tools" panel that shows GT status and Position Library stats. Expanded by default if enabled, collapsed if not.

3. **Auto-population via Self-Play** - When GT Engine enabled, auto-trigger a self-play batch (e.g., 20 games) to populate Position Library. Self-play is preferred over Hardy's scraper because:
   - No external dependencies (only needs GNUBG connection)
   - Generates diverse positions across all game phases
   - Each 10-game batch produces ~100-150 unique positions
   - Fully self-contained within the system

---

## 6) ASCII Wireframes

### A. Domain Detection Prompt (Post-Profile Creation)

```
┌────────────────────────────────────────────────────────────────┐
│  ✓ Profile Created Successfully!                               │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎯 We noticed you're creating a BACKGAMMON guru!       │   │
│  │                                                          │   │
│  │  Would you like to enable expert move verification?     │   │
│  │                                                          │   │
│  │  This connects your guru to GNU Backgammon, the world's │   │
│  │  strongest backgammon AI. Your drills will include:     │   │
│  │                                                          │   │
│  │    ✓ Mathematically verified correct moves              │   │
│  │    ✓ Real game positions generated via AI self-play    │   │
│  │    ✓ Accurate equity calculations                       │   │
│  │                                                          │   │
│  │  ┌──────────────────┐  ┌────────────────┐               │   │
│  │  │  ✨ Enable Now   │  │  Skip for Now  │               │   │
│  │  └──────────────────┘  └────────────────┘               │   │
│  │                                                          │   │
│  │  You can always enable this later in Settings.          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                          [Continue to Research →]               │
└────────────────────────────────────────────────────────────────┘
```

### B. Teaching Artifacts Page - With GT Panel (Simple Mode)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Project         Teaching Artifacts        [⚙️ Advanced Mode] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  🎯 Accuracy Tools                                    [▼ Expand] │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  GNU Backgammon    ● Connected (42ms)     [Refresh] [Disable]    │   │
│  │                                                                   │   │
│  │  Position Library: 460 positions ready                           │   │
│  │  ┌─────────┬─────────┬─────────┬─────────┐                       │   │
│  │  │ Opening │  Early  │ Middle  │ Bearoff │                       │   │
│  │  │   21    │   93    │   272   │   74    │                       │   │
│  │  └─────────┴─────────┴─────────┴─────────┘                       │   │
│  │                                                                   │   │
│  │  ⓘ Drills use AI-generated positions for practice scenarios     │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │                      Generate Your First Artifact                  │ │
│  │                                                                     │ │
│  │   We recommend starting with a Mental Model, then Curriculum,      │ │
│  │   and finally Drill Series (which uses the positions above).       │ │
│  │                                                                     │ │
│  │   ┌─────────────────────┐                                          │ │
│  │   │  🧠 Generate Mental │                                          │ │
│  │   │       Model         │                                          │ │
│  │   └─────────────────────┘                                          │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### C. GT Panel - Collapsed State (After Setup)

```
┌──────────────────────────────────────────────────────────────────┐
│  🎯 Accuracy Tools    GNU Backgammon ● Online    460 positions   │
│                                                        [Expand ▶] │
└──────────────────────────────────────────────────────────────────┘
```

### D. GT Not Enabled - Subtle Prompt

```
┌──────────────────────────────────────────────────────────────────┐
│  🎯 Accuracy Tools                                     [▼ Expand] │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  No verification engine connected.                               │
│                                                                   │
│  Your drills will still work, but moves won't be verified        │
│  against an expert engine.                                       │
│                                                                   │
│  ┌──────────────────────┐                                        │
│  │  + Add Verification  │   Available: GNU Backgammon            │
│  └──────────────────────┘                                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### E. Advanced Mode - Full Position Library Access

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Project         Teaching Artifacts        [⚙️ Simple Mode]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  🎯 Accuracy Tools                                    [▲ Collapse] │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  GNU Backgammon    ● Connected (42ms)     [Refresh] [Disable]    │   │
│  │  └─ Latency: 42ms | Last checked: 2:34 PM                        │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │  Position Library                          [Browse All]  │    │   │
│  │  ├──────────────────────────────────────────────────────────┤    │   │
│  │  │  Archives: 47       Total Positions: 460                 │    │   │
│  │  │                                                          │    │   │
│  │  │  By Game Phase (click to browse):                        │    │   │
│  │  │  ┌─────────┬─────────┬─────────┬─────────┐              │    │   │
│  │  │  │ Opening │  Early  │ Middle  │ Bearoff │              │    │   │
│  │  │  │   21    │   93    │   272   │   74    │              │    │   │
│  │  │  └─────────┴─────────┴─────────┴─────────┘              │    │   │
│  │  │                                                          │    │   │
│  │  │  ┌─────────────────┐  ┌─────────────┐                   │    │   │
│  │  │  │ ⚡ Generate More │  │ 📤 Upload   │                   │    │   │
│  │  │  │   (Self-Play)   │  │    File     │                   │    │   │
│  │  │  └─────────────────┘  └─────────────┘                   │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────┐                                                │
│  │ Mental Model   [✓]  │                                                │
│  │ v3 - Dec 24, 2025   │   [...artifact content...]                    │
│  ├─────────────────────┤                                                │
│  │ Curriculum     [✓]  │                                                │
│  │ v2 - Dec 24, 2025   │                                                │
│  ├─────────────────────┤                                                │
│  │ Drill Series   [⏳] │                                                │
│  │ Generating...       │                                                │
│  └─────────────────────┘                                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### F. GT Enablement Flow (Shared Position Library)

```
┌─────────────────────────────────────────────────────────────────┐
│  User clicks "Enable Now" on GT Engine prompt                   │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  System automatically:                                     │  │
│  │  1. Creates ProjectGroundTruthConfig (engineId, enabled)  │  │
│  │  2. Links to SHARED Position Library (already populated)  │  │
│  │  3. Shows immediate success - positions ready!            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ✓ Verification ready!                                     │  │
│  │                                                            │  │
│  │  GNU Backgammon ● Connected                               │  │
│  │  460 positions available in shared library                │  │
│  │                                                            │  │
│  │  Your drills will include mathematically verified moves.   │  │
│  │                                                            │  │
│  │  Want more positions? Click "Generate More" in the         │  │
│  │  Accuracy Tools panel.                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight: Shared Position Library**

The Position Library is **shared across all projects** for a given GT Engine. This means:
- No per-user/per-project population needed
- Positions generated once benefit all users
- "Generate More" adds to the shared pool
- Implementation must seed library with initial 200-300 positions

**Why Self-Play over External Scraping:**

| Aspect | Self-Play | Hardy's Scraper |
|--------|-----------|-----------------|
| External dependencies | None (only GNUBG) | Requires hardyhuebener.de |
| Network reliability | Local only | Subject to external site availability |
| Position diversity | Random games cover all phases | Limited to archived matches |
| Speed | ~10-15 positions/game | Variable, depends on network |
| Maintainability | Self-contained | Could break if site changes |

### G. Readiness Page - GT Status Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  Readiness Score: 72%                      [Re-assess Readiness]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Knowledge Coverage                                              │
│  ├─ Foundations     ████████████████░░░░  80%                   │
│  ├─ Progression     ██████████████░░░░░░  70%                   │
│  ├─ Mistakes        ████████████░░░░░░░░  60%                   │
│  └─ Examples        ████████████████████  100%                  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🎯 Accuracy Tools                                   [✓]  │  │
│  │                                                            │  │
│  │  GNU Backgammon connected with 460 positions               │  │
│  │  Your drills will include verified moves.                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Ready to generate artifacts? →  [Go to Teaching Artifacts] │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7) Implementation Phases

### Phase 1: Domain Detection Infrastructure
- Create `lib/domainDetection/detectDomain.ts` with keyword matching
- Add API endpoint `POST /api/projects/[id]/detect-domain`
- Store detected domain on project or profile

### Phase 2: Post-Profile Prompt UI
- Create `components/wizard/DomainToolsPrompt.tsx`
- Integrate into profile creation completion flow
- Auto-enable GT when user accepts
- Auto-trigger self-play batch (20 games) to populate Position Library

### Phase 3: Simplified GT Panel Component
- Create `components/artifacts/AccuracyToolsPanel.tsx`
- Simplified version of `GroundTruthEngineManager`
- Collapsible, shows status and stats
- Advanced mode expands to show full controls

### Phase 4: Integration into Artifacts Page
- Add `AccuracyToolsPanel` to `TeachingArtifactsContent`
- Connect to existing GT config APIs
- Ensure position library status visible

### Phase 5: Readiness Page Integration
- Add GT status indicator to readiness page
- Show in readiness summary

---

## 8) Clarification (Resolved)

1. **Auto-population Strategy**: ~~Should the system auto-trigger self-play when GT is enabled?~~
   - **Decision**: No per-user auto-trigger needed. Position Library is **shared across all projects**. Run 20 games once at end of spec implementation to seed the shared library with 200-300 positions.

2. **Minimum Position Threshold**: What's the minimum number of positions needed before artifact generation?
   - **Decision**: Warn below 100 positions, hard block drill series below 21 (exception: OPENING phase has exactly 21 possible positions, so 21 is acceptable for opening-focused drills).

3. **Multiple Engines**: If multiple GT engines exist for a domain, should user choose or auto-select?
   - **Decision**: Build as if there will only ever be one GT engine per domain. No selection UI needed.

4. **Collapse State Persistence**: Should the GT panel collapse state be persisted?
   - **Decision**: Yes, persist in localStorage.

5. **Generate More in Simple Mode**: Should "Generate More Positions" be visible in simple mode?
   - **Decision**: Yes, simplified button that triggers 10 more games with no configuration.

6. **Hardy's Scraper Status**: Should Hardy's scraper remain available?
   - **Decision**: Keep in advanced mode only as legacy/backup option.

---

## 9) Migration Notes

### What Stays in Old System (Admin Page)
- Context Layer Manager (corpus building)
- Knowledge File Manager (document uploads)
- Project Assessment Manager (self-assessment)
- Research Run Management (autonomous research)

### What Moves to New System (Simplified Frontend)
- GT Engine enable/disable
- Position Library status display
- Self-play trigger (primary method, simplified "Generate More" button)
- Position browser (in advanced mode)
- Full self-play configuration (in advanced mode)
- Hardy's scraper (advanced mode only, legacy option)

### Shared Components (Both Systems)
- `PositionLibraryBrowser` modal
- `MatchImportModal`
- `SelfPlayGenerator` widget
- `ImportProgressList`

---

## 10) Success Metrics

1. **Adoption Rate**: % of backgammon gurus with GT enabled after profile creation
2. **Time to Enable**: Average time from profile creation to GT enablement
3. **Position Library Size**: Average positions per project
4. **Verification Rate**: % of drill claims verified vs total claims

---

## 11) Appendix: Self-Play System Architecture

### How Self-Play Works

The self-play generator simulates complete backgammon games using GNUBG:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-PLAY GENERATION FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Initialize game with standard starting position              │
│                          ↓                                       │
│  2. Roll dice (random 1-6, 1-6)                                 │
│                          ↓                                       │
│  3. Query GNUBG for best moves given position + dice            │
│     └─ Returns: move, equity, probabilities, alternatives       │
│                          ↓                                       │
│  4. Store position in library (with phase classification):      │
│     ├─ OPENING: First few moves (skipped by default)            │
│     ├─ EARLY: Early game, pip count > 100 both sides            │
│     ├─ MIDDLE: Mid-game                                         │
│     └─ BEAROFF: When bearing off checkers                       │
│                          ↓                                       │
│  5. Apply best move to advance game state                       │
│                          ↓                                       │
│  6. Switch player, repeat from step 2                           │
│                          ↓                                       │
│  7. Game ends when one player bears off all checkers            │
│                          ↓                                       │
│  8. Repeat for N games (configurable, default 10-20)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Implementation Details

| Component | Location | Purpose |
|-----------|----------|---------|
| `runSelfPlayBatch()` | `lib/positionLibrary/selfPlayGenerator.ts` | Main batch orchestrator |
| `simulateSingleGame()` | `lib/positionLibrary/selfPlayGenerator.ts` | Single game simulation |
| `selfPlayGenerationJob` | `lib/inngest-functions.ts` | Background job |
| `SelfPlayGenerator` | `components/position-library/SelfPlayGenerator.tsx` | Admin UI |
| `SelfPlayBatch` | `prisma/schema.prisma` | Tracks batch status |

### Position Yield

Typical yields per self-play batch:
- **10 games**: ~100-150 unique positions
- **20 games**: ~200-300 unique positions
- **Skip opening**: Recommended (21 opening positions already catalogued)
- **Deduplication**: Automatic within batch and against existing library

### API for Auto-Trigger

To auto-trigger self-play when GT Engine is enabled:

```typescript
// POST /api/position-library/self-play
const response = await fetch('/api/position-library/self-play', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    engineId: config.engineId,
    gamesCount: 20,      // Generate 200-300 positions
    skipOpening: true,   // Opening already covered
  }),
});

// Returns: { batchId, status: 'PENDING' }
// Background job handles the rest
```

### Current Limitation: Admin-Only

The self-play API currently uses `checkAdminAuth()`. For simplified frontend auto-trigger, we need to either:

1. **Create a user-facing wrapper endpoint** that accepts a project ID and auto-uses the project's configured engine
2. **Relax auth** for the specific use case of auto-population during GT enablement

**Recommendation**: Create `POST /api/projects/[id]/ground-truth-config/auto-populate` that:
1. Verifies user owns the project
2. Gets the project's GT engine config
3. Triggers self-play with sensible defaults (20 games, skipOpening=true)
4. Returns the batch ID for progress tracking

---

## 12) Appendix: Domain Keywords

### Backgammon Domain
```javascript
const BACKGAMMON_KEYWORDS = [
  'backgammon',
  'doubling cube',
  'pip count',
  'bearing off',
  'blot',
  'anchor',
  'prime',
  'gammon',
  'backgammon (triple)',
  'match play',
  'money game',
  'jacoby rule',
  'crawford rule',
  'beaver',
  'raccoon',
  'checker play',
  'cube decision',
  'equity',
  'take point',
  'pass point'
];
```

### Future Domains (Extensible)
```javascript
// Chess
const CHESS_KEYWORDS = ['chess', 'checkmate', 'castling', 'en passant', ...];

// Poker
const POKER_KEYWORDS = ['poker', 'texas holdem', 'pot odds', 'implied odds', ...];

// Go
const GO_KEYWORDS = ['go', 'weiqi', 'baduk', 'territory', 'influence', ...];
```
