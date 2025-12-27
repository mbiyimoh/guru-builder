# Guru Profile Scorecard Enhancement - Specification

## Overview

Enhance the guru profile display with a modern "scorecard" UI that provides visual confidence indicators, per-section scoring, and inline text/voice refinement capability.

## Goals

1. **Modern scorecard UI** - Clean, visually appealing profile display with confidence ring and section scores
2. **Inline refinement** - Text/voice braindump input at bottom of scorecard for incremental improvement
3. **Dashboard integration** - Clicking profile from dashboard shows scorecard with refinement capability
4. **Actionable light areas** - Clicking a gap pre-fills refinement input with targeted prompt

## Non-Goals

- Full profile editing UI (field-by-field editing already exists in modal)
- New API endpoints for per-field confidence (calculate from light areas client-side)
- Changing the initial wizard flow (scorecard displays after synthesis, same as before)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dashboard click behavior | Navigate to `/projects/{id}/profile` | Consistent with Research/Artifacts links; provides more space |
| Refinement approach | Combine original brain dump + new input, re-synthesize | Simplest, maintains profile consistency |
| Light area targeting | Pre-fill refinement input with "I want to improve [area name]" | Matches research gap pattern |
| Section scoring | Calculate from light areas (fields in section / light fields) | No API changes needed |

---

## Component Architecture

### New Components

```
components/profile/
├── ProfileScorecard.tsx         # Main scorecard component (reusable)
├── ScorecardConfidenceRing.tsx  # Circular confidence visualization
├── ScorecardSection.tsx         # Individual section with mini progress
├── ScorecardRefinementInput.tsx # Text/voice input for improvements
└── ScorecardLightAreaBadge.tsx  # Clickable badge for light areas
```

### Modified Files

| File | Changes |
|------|---------|
| `app/projects/[id]/profile/ProfilePageContent.tsx` | Replace current layout with ProfileScorecard |
| `components/guru/GuruProfileSection.tsx` | Change edit button to navigate to profile page |
| `components/wizard/profile/ProfilePreview.tsx` | Optionally replace with ProfileScorecard |

---

## Detailed Component Specs

### ProfileScorecard

Main orchestrator component displaying the full profile scorecard.

**Props:**
```typescript
interface ProfileScorecardProps {
  profile: GuruProfileData;
  lightAreas: string[];
  confidence: number;
  rawBrainDump?: string;          // Original input for refinement merge
  projectId: string;
  onProfileUpdated?: () => void;  // Callback after successful refinement
  showRefinementInput?: boolean;  // Default true for profile page
  isWizardMode?: boolean;         // True in wizard (shows Save button instead of refinement)
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Profile Overview                   [Confidence Ring]│  │
│  │  Domain: Advanced Backgammon             78%         │  │
│  │  Audience: Intermediate • Tone: Socratic            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Domain & Expertise                    ████████░░ 80%│  │
│  │  ├─ Domain Expertise: Advanced backgammon strategy   │  │
│  │  ├─ Specific Topics: Opening theory, doubling...     │  │
│  │  └─ Years of Experience: 15                          │  │
│  │      [Lower Confidence] ← clickable                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Target Audience                       ██████████ 100%│  │
│  │  ├─ Audience Level: Advanced                         │  │
│  │  └─ Audience Description: Competitive players...     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ... more sections ...                                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🎤 Improve Your Profile                             │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ Tell me more about your teaching experience... │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  [Voice] [Text mode active]        [Improve Profile] │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### ScorecardConfidenceRing

Circular progress ring showing overall confidence.

**Props:**
```typescript
interface ConfidenceRingProps {
  confidence: number;  // 0-1
  size?: 'sm' | 'md' | 'lg';  // 48px, 64px, 80px
}
```

**Visual:**
- Green (>=80%): `rgb(34, 197, 94)`
- Amber (60-79%): `rgb(234, 179, 8)`
- Red (<60%): `rgb(239, 68, 68)`
- Animated stroke-dashoffset on mount

### ScorecardSection

Collapsible section with mini progress bar.

**Props:**
```typescript
interface ScorecardSectionProps {
  title: string;
  fields: Array<{
    label: string;
    value: string | string[] | number | null;
    fieldKey: string;
    isLight: boolean;
  }>;
  onLightAreaClick: (fieldKey: string, fieldLabel: string) => void;
  defaultExpanded?: boolean;
}
```

**Behavior:**
- Shows section title with mini progress bar (calculated from light/total fields)
- Collapsed by default, expandable on click
- Light area badges are clickable, trigger `onLightAreaClick`

### ScorecardRefinementInput

Text/voice input for profile improvement.

**Props:**
```typescript
interface RefinementInputProps {
  projectId: string;
  existingBrainDump: string;
  onRefinementComplete: (newProfile: SynthesisResult) => void;
  initialPrompt?: string;  // Pre-filled when clicking light area
}
```

**State:**
- `inputText: string`
- `inputMode: 'text' | 'voice'`
- `isProcessing: boolean`

**Flow:**
1. User types/speaks refinement
2. Click "Improve Profile"
3. POST to `/api/projects/synthesize-guru-profile` with `rawInput: existingBrainDump + "\n\nAdditional context:\n" + inputText`
4. Show processing state
5. On success, call `onRefinementComplete` with new result
6. Parent component updates profile via PUT to `/api/projects/{id}/guru-profile`

---

## API Changes

### No new endpoints required

Existing endpoints are sufficient:

| Endpoint | Usage |
|----------|-------|
| `GET /api/projects/{id}/guru-profile` | Fetch current profile |
| `POST /api/projects/synthesize-guru-profile` | Re-synthesize with combined input |
| `POST /api/projects/{id}/guru-profile` | Save updated profile |

---

## Section Scoring Algorithm

Calculate per-section confidence from light areas:

```typescript
const SECTION_FIELDS = {
  'Domain & Expertise': ['domainExpertise', 'specificTopics', 'yearsOfExperience'],
  'Target Audience': ['audienceLevel', 'audienceDescription'],
  'Teaching Style': ['pedagogicalApproach', 'tone', 'communicationStyle'],
  'Content Preferences': ['emphasizedConcepts', 'avoidedTopics', 'examplePreferences'],
  'Unique Characteristics': ['uniquePerspective', 'commonMisconceptions', 'successMetrics'],
};

function calculateSectionScore(sectionName: string, lightAreas: string[]): number {
  const fields = SECTION_FIELDS[sectionName];
  const lightCount = fields.filter(f => lightAreas.includes(f)).length;
  return Math.round(((fields.length - lightCount) / fields.length) * 100);
}
```

---

## Implementation Tasks

### Phase 1: Core Scorecard Component
- [ ] Create `components/profile/ProfileScorecard.tsx`
- [ ] Create `components/profile/ScorecardConfidenceRing.tsx` with SVG ring
- [ ] Create `components/profile/ScorecardSection.tsx` with expand/collapse
- [ ] Create `components/profile/ScorecardLightAreaBadge.tsx`
- [ ] Add section scoring utility function

### Phase 2: Refinement Input
- [ ] Create `components/profile/ScorecardRefinementInput.tsx`
- [ ] Integrate `useSpeechRecognition` hook for voice input
- [ ] Add processing state and error handling
- [ ] Wire up refinement flow (merge input, synthesize, save)

### Phase 3: Profile Page Integration
- [ ] Update `ProfilePageContent.tsx` to use ProfileScorecard
- [ ] Remove separate input mode tabs (replace with inline refinement)
- [ ] Add light area click → refinement input pre-fill

### Phase 4: Dashboard Integration
- [ ] Update `GuruProfileSection.tsx` edit button to navigate to profile page
- [ ] Or: create inline scorecard expansion variant (TBD based on preference)

### Phase 5: Wizard Integration (Optional)
- [ ] Replace `ProfilePreview.tsx` with ProfileScorecard in wizard mode
- [ ] Handle `isWizardMode` prop for save button vs refinement input

---

## Testing Scenarios

1. **New project flow** - Create profile, see scorecard with confidence ring
2. **Light area click** - Click badge, verify refinement input pre-fills
3. **Text refinement** - Type improvement, verify profile updates
4. **Voice refinement** - Speak improvement (Chrome/Edge), verify transcript and update
5. **Dashboard navigation** - Click profile from dashboard, land on scorecard page
6. **Section expand/collapse** - Verify smooth animation and content visibility
7. **Low confidence handling** - Profile with many light areas shows appropriate scores

---

## Success Criteria

1. Profile scorecard displays with visual confidence ring
2. Per-section progress bars accurately reflect light areas
3. Light area badges are clickable and pre-fill refinement input
4. Text input allows incremental profile improvement
5. Voice input works on supported browsers
6. Dashboard profile link navigates to scorecard page
7. Refinement preserves original context while incorporating new input
