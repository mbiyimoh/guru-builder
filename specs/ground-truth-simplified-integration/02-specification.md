# Ground Truth Engine & Position Library Integration - Specification

**Slug:** ground-truth-simplified-integration
**Author:** Claude Code
**Date:** 2025-12-24
**Status:** Ready for Implementation (Validated 2025-12-24)
**Ideation:** `01-ideation.md`

---

## 1. Overview

### Problem Statement
Ground Truth Engine and Position Library functionality currently live only in the admin page (`/projects/[id]/admin`), making them inaccessible to users of the simplified frontend wizard flow. Non-technical users cannot benefit from verified drills without navigating to and understanding the admin interface.

### Solution
Integrate GT Engine and Position Library into the simplified frontend with:
1. **Domain detection** after profile creation to suggest relevant verification tools
2. **Simplified "Accuracy Tools" panel** in the teaching artifacts page
3. **Shared Position Library** that's pre-populated, requiring no per-user setup

### Key Decision: Shared Position Library
The Position Library is **shared across all projects** for a given GT Engine. This simplifies the user experience:
- No waiting for position generation when enabling GT
- Positions generated once benefit all users
- "Generate More" adds to the shared pool for everyone

---

## 2. User Stories

### US-1: Domain Detection & Onboarding
**As a** domain expert creating a backgammon guru
**I want** the system to detect my domain and suggest verification tools
**So that** I can enable accuracy features without knowing they exist

**Acceptance Criteria:**
- After profile creation, system analyzes content for domain keywords
- If backgammon detected, show friendly prompt explaining GT benefits
- User can "Enable Now" or "Skip for Now"
- Skipped users can enable later from artifacts page

### US-2: Simplified GT Panel
**As a** guru creator on the simplified frontend
**I want** to see my GT Engine status and position library in one place
**So that** I understand what accuracy features are active

**Acceptance Criteria:**
- Collapsible "Accuracy Tools" panel on teaching artifacts page
- Shows: engine connection status, position count by phase
- Collapsed by default if not enabled, expanded if enabled
- Collapse state persisted in localStorage

### US-3: Generate More Positions
**As a** guru creator who wants more drill variety
**I want** to easily generate more positions
**So that** my drills have more scenarios to draw from

**Acceptance Criteria:**
- Simple "Generate More" button in Accuracy Tools panel
- Triggers 10-game self-play batch (no configuration in simple mode)
- Shows progress while generating
- Advanced mode shows full self-play configuration

### US-4: Position Threshold Warnings
**As a** guru creator
**I want** to be warned if I don't have enough positions
**So that** I know my drills might be limited

**Acceptance Criteria:**
- Warning shown if total positions < 100 (excluding OPENING)
- Hard block drill series generation if < 21 positions
- Exception: OPENING phase has exactly 21 positions, which is complete

---

## 3. Technical Specification

### 3.1 Domain Detection

#### New File: `lib/domainDetection/detectDomain.ts`

```typescript
export interface DomainDetectionResult {
  detected: boolean;
  domain: string | null;
  matchedKeywords: string[];
  suggestedEngine: {
    id: string;
    name: string;
    description: string;
  } | null;
}

export async function detectDomainFromProfile(
  profileContent: string
): Promise<DomainDetectionResult>;

export async function detectDomainFromProject(
  projectId: string
): Promise<DomainDetectionResult>;
```

**Implementation:**
1. Extract text from guru profile (brain dump, teaching style, etc.)
2. Search for domain keywords (case-insensitive)
3. Query `GroundTruthEngine` table for matching domain
4. Return engine suggestion if found

**Backgammon Keywords:**
```typescript
const BACKGAMMON_KEYWORDS = [
  'backgammon', 'doubling cube', 'pip count', 'bearing off',
  'blot', 'anchor', 'prime', 'gammon', 'match play', 'money game',
  'jacoby rule', 'crawford rule', 'checker play', 'cube decision',
  'equity', 'take point', 'pass point', 'gnubg', 'xg'
];
```

### 3.2 Domain Tools Prompt Component

#### New File: `components/wizard/DomainToolsPrompt.tsx`

```typescript
interface DomainToolsPromptProps {
  projectId: string;
  detectedDomain: DomainDetectionResult;
  onEnable: () => Promise<void>;
  onSkip: () => void;
}
```

**UI Elements:**
- Domain-specific icon and title ("We noticed you're creating a BACKGAMMON guru!")
- Benefit list with checkmarks
- "Enable Now" primary button
- "Skip for Now" secondary button
- "You can always enable this later" helper text

**Behavior:**
- "Enable Now" creates `ProjectGroundTruthConfig` record
- Shows immediate success (shared library already has positions)
- Proceeds to next wizard step

### 3.3 Accuracy Tools Panel Component

#### New File: `components/artifacts/AccuracyToolsPanel.tsx`

```typescript
interface AccuracyToolsPanelProps {
  projectId: string;
}

interface AccuracyToolsState {
  isEnabled: boolean;
  engineName: string | null;
  engineStatus: 'online' | 'offline' | 'checking';
  latency: number | null;
  positionCounts: {
    OPENING: number;
    EARLY: number;
    MIDDLE: number;
    BEAROFF: number;
  };
  isCollapsed: boolean;
  isGenerating: boolean;
  activeBatchId: string | null;
}
```

**MVP Features (Simple Mode Only):**
- Engine status indicator (online/offline with latency)
- Position count summary with phase breakdown
- "Generate More" button (triggers 10 games)
- Collapse/expand toggle

**Deferred to Future (Advanced Mode):**
- Full self-play configuration (games count, skip opening)
- Position browser link
- Hardy's scraper (legacy)
- Match file upload
- Detailed health info with last-checked timestamp

**Collapse State Persistence:**
```typescript
const COLLAPSE_KEY = 'guru-accuracy-tools-collapsed';

// On mount
const savedState = localStorage.getItem(COLLAPSE_KEY);
setIsCollapsed(savedState === 'true');

// On toggle
localStorage.setItem(COLLAPSE_KEY, String(newState));
```

### 3.4 API Endpoints

#### New: `POST /api/projects/[id]/detect-domain`

```typescript
// Request: (no body, uses project's profile)

// Response:
{
  detected: true,
  domain: "backgammon" | null,
  matchedKeywords: ["backgammon", "doubling cube"],
  suggestedEngine: {
    id: "clxx...",
    name: "GNU Backgammon",
    description: "World's strongest backgammon AI"
  } | null
}
```

#### Modified: `POST /api/projects/[id]/ground-truth-config`

Add validation:
- If enabling, check Position Library has sufficient positions
- Return warning if < 100 positions
- Include position counts in response

```typescript
// Response (enhanced):
{
  config: { ... },
  positionLibrary: {
    total: 460,
    byPhase: { OPENING: 21, EARLY: 93, MIDDLE: 272, BEAROFF: 74 },
    sufficientForDrills: true,
    warning: null | "Position library has only 45 positions. Consider generating more."
  }
}
```

#### Modified: `POST /api/position-library/self-play`

Relax auth for project owners (not just admins):
```typescript
// Current: checkAdminAuth()
// New: checkProjectOwnerOrAdmin(projectId)
```

### 3.5 Integration Points

#### Teaching Artifacts Page

Modify `components/artifacts/TeachingArtifactsContent.tsx`:

```typescript
// Add AccuracyToolsPanel above artifact content
<div className="flex-1 flex flex-col overflow-hidden">
  <AccuracyToolsPanel projectId={projectId} />

  {readinessScore !== undefined && readinessScore < 60 && (
    <ReadinessWarning projectId={projectId} score={readinessScore} />
  )}

  <ArtifactDetailPanel ... />
</div>
```

#### Profile Creation Flow

Modify profile completion handler:

```typescript
// After successful profile creation
const domainResult = await detectDomainFromProject(projectId);

if (domainResult.detected && domainResult.suggestedEngine) {
  // Show DomainToolsPrompt modal/step
  setShowDomainPrompt(true);
  setDetectedDomain(domainResult);
} else {
  // Proceed directly to next step
  proceedToResearch();
}
```

#### Drill Generation Validation

Modify `app/api/projects/[id]/guru/drill-series/route.ts`:

```typescript
// Before starting generation
const gtConfig = await resolveGroundTruthConfig(projectId);

if (gtConfig?.enabled) {
  const counts = await prisma.positionLibrary.groupBy({
    by: ['gamePhase'],
    where: { engineId: gtConfig.engineId },
    _count: true,
  });

  const totalNonOpening = counts
    .filter(c => c.gamePhase !== 'OPENING')
    .reduce((sum, c) => sum + c._count, 0);

  if (totalNonOpening < 21) {
    return NextResponse.json({
      error: 'Insufficient positions in library',
      details: 'At least 21 non-opening positions required for drill generation',
      positionCounts: counts,
    }, { status: 400 });
  }
}
```

### 3.6 Readiness Page Integration

Add GT status to readiness display:

```typescript
// In ReadinessPageContent.tsx
const gtConfig = await resolveGroundTruthConfig(projectId);
const positionCounts = gtConfig?.enabled
  ? await getPositionCounts(gtConfig.engineId)
  : null;

// Render GT status section
{gtConfig?.enabled && (
  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <span className="font-medium">Accuracy Tools Enabled</span>
    </div>
    <p className="text-sm text-muted-foreground mt-1">
      GNU Backgammon connected with {totalPositions} positions
    </p>
  </div>
)}
```

---

## 4. UI/UX Specifications

### 4.1 Accuracy Tools Panel - Simple Mode

```
┌──────────────────────────────────────────────────────────────────┐
│  🎯 Accuracy Tools                                     [▼ Expand] │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GNU Backgammon    ● Connected (42ms)     [Refresh] [Disable]    │
│                                                                   │
│  Position Library: 460 positions ready                           │
│  ┌─────────┬─────────┬─────────┬─────────┐                       │
│  │ Opening │  Early  │ Middle  │ Bearoff │                       │
│  │   21    │   93    │   272   │   74    │                       │
│  └─────────┴─────────┴─────────┴─────────┘                       │
│                                                                   │
│  ┌─────────────────┐                                             │
│  │ ⚡ Generate More │  Adds ~100 positions to shared library     │
│  └─────────────────┘                                             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Accuracy Tools Panel - Not Enabled

```
┌──────────────────────────────────────────────────────────────────┐
│  🎯 Accuracy Tools                                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  No verification engine connected.                               │
│                                                                   │
│  Enable accuracy tools to get:                                   │
│    ✓ Mathematically verified drill answers                      │
│    ✓ Real game positions for practice scenarios                 │
│                                                                   │
│  ┌───────────────────────┐                                       │
│  │  + Enable GNU Backgammon  │                                   │
│  └───────────────────────┘                                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Collapsed State

```
┌──────────────────────────────────────────────────────────────────┐
│  🎯 Accuracy Tools    GNU Backgammon ● Online    460 positions   │
│                                                        [Expand ▶] │
└──────────────────────────────────────────────────────────────────┘
```

### 4.4 Domain Detection Prompt

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

---

## 5. Implementation Phases

### Phase 1: Domain Detection Infrastructure
**Files:**
- `lib/domainDetection/detectDomain.ts` (new)
- `lib/domainDetection/keywords.ts` (new)
- `app/api/projects/[id]/detect-domain/route.ts` (new)

**Tasks:**
1. Create domain detection utility with keyword matching
2. Create API endpoint that uses project's profile
3. Query GroundTruthEngine table for matching domain

### Phase 2: Accuracy Tools Panel Component
**Files:**
- `components/artifacts/AccuracyToolsPanel.tsx` (new)

**Tasks:**
1. Create collapsible panel component
2. Implement simple mode UI (status, counts, generate button)
3. Add localStorage persistence for collapse state
4. Integrate with existing GT config and position library APIs

### Phase 3: Domain Tools Prompt Component
**Files:**
- `components/wizard/DomainToolsPrompt.tsx` (new)

**Tasks:**
1. Create prompt modal/step component
2. Implement "Enable Now" handler (create GT config)
3. Implement "Skip for Now" handler
4. Style with domain-specific messaging

### Phase 4: Integration
**Files:**
- `components/artifacts/TeachingArtifactsContent.tsx` (modify)
- `components/wizard/profile/ProfileChatMode.tsx` (modify)
- `app/projects/[id]/readiness/ReadinessPageContent.tsx` (modify)

**Tasks:**
1. Add AccuracyToolsPanel to teaching artifacts page
2. Add domain detection to profile creation flow
3. Add GT status to readiness page
4. Wire up all the pieces

### Phase 5: Validation & Thresholds
**Files:**
- `lib/auth.ts` (modify)
- `app/api/projects/[id]/guru/drill-series/route.ts` (modify)
- `app/api/position-library/self-play/route.ts` (modify)

**Tasks:**
1. Add `checkProjectOwnerOrAdmin(projectId)` helper to `lib/auth.ts`
2. Add position count validation before drill generation
3. Relax self-play auth to use new helper (allow project owners)
4. Add warning threshold (< 100 positions)
5. Add hard block threshold (< 21 positions)

### Phase 6: Seed Position Library
**Tasks:**
1. Run 20-game self-play batch in production
2. Verify 200-300 positions generated
3. Confirm positions distributed across phases

---

## 6. Error Handling

### Engine Offline
- `AccuracyToolsPanel` shows "Offline" status with red indicator
- "Generate More" button disabled with tooltip "Engine unavailable"
- Drill generation proceeds without verification (degrades gracefully)

### Self-Play Batch Failure
- Display error message in panel: "Generation failed. Try again."
- Log error details for debugging
- Don't update position counts until successful

### API Timeout
- Domain detection: Fail silently, proceed without prompt
- GT config creation: Show retry button
- Position fetch: Use cached counts if available

### Insufficient Positions (< 21)
- Block drill series generation with clear message
- Show "Generate More" button prominently
- Explain minimum requirement in user-friendly terms

---

## 7. Testing Requirements

### Integration Tests
- Domain detection API returns correct engine
- GT config creation via simplified flow
- Position counts update after self-play

### E2E Tests
- Full flow: profile creation → domain prompt → enable GT → see panel
- "Generate More" triggers self-play and updates counts
- Collapse/expand state persists across page loads
- Drill generation blocked when insufficient positions

---

## 8. Migration & Rollout

### Pre-deployment
1. Ensure Position Library has 200+ positions (run self-play if needed)
2. Deploy API changes first
3. Deploy UI changes

### Post-deployment Verification
1. Verify domain detection works for new profiles
2. Verify AccuracyToolsPanel renders correctly
3. Verify "Generate More" adds positions
4. Verify drill generation validation works

---

## 9. Files Summary

### New Files
| Path | Purpose |
|------|---------|
| `lib/domainDetection/detectDomain.ts` | Domain detection utility |
| `lib/domainDetection/keywords.ts` | Domain keyword definitions |
| `app/api/projects/[id]/detect-domain/route.ts` | Domain detection API |
| `components/artifacts/AccuracyToolsPanel.tsx` | Main panel component |
| `components/wizard/DomainToolsPrompt.tsx` | Post-profile prompt |

### Modified Files
| Path | Changes |
|------|---------|
| `lib/auth.ts` | Add `checkProjectOwnerOrAdmin()` helper |
| `components/artifacts/TeachingArtifactsContent.tsx` | Add AccuracyToolsPanel |
| `components/wizard/profile/ProfileChatMode.tsx` | Add domain detection on complete |
| `app/projects/[id]/readiness/ReadinessPageContent.tsx` | Add GT status section |
| `app/api/projects/[id]/ground-truth-config/route.ts` | Add position counts in response |
| `app/api/projects/[id]/guru/drill-series/route.ts` | Add position validation |
| `app/api/position-library/self-play/route.ts` | Relax auth for project owners |

---

## 10. Success Criteria

1. **Domain Detection Accuracy**: 90%+ of backgammon gurus correctly detected
2. **Enablement Rate**: 70%+ of detected users click "Enable Now"
3. **Panel Discoverability**: Users find and understand the Accuracy Tools panel
4. **Zero Friction**: Enabling GT takes < 3 seconds (no waiting for positions)
5. **Position Sufficiency**: Shared library maintains 200+ positions
