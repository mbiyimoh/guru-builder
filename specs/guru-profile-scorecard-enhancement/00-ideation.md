# Guru Profile Scorecard Enhancement - Ideation

## Intent & Assumptions

### What the user wants
1. **Cleaner/more modern UI/UX** for the guru profile "scorecard" that displays after initial profile synthesis
2. **"Improve via prompt" functionality** - a text/voice braindump input at the bottom of the scorecard to refine specific areas
3. **Dashboard profile view** - when clicking the guru profile from the dashboard, show the scorecard version (not just a summary card) with an "update via prompt" textbox

### Key assumptions
- The existing `ProfilePreview.tsx` component is the "scorecard" referenced (shows after wizard synthesis)
- The dashboard profile card (`GuruProfileSection.tsx`) currently opens the full onboarding modal - user wants a lighter scorecard view instead
- The "update via prompt" should do incremental profile refinement, not a full re-synthesis
- Voice input should use the existing `useSpeechRecognition` hook
- Modern UI means: better visual hierarchy, cleaner spacing, subtle animations, progress indicators

---

## Pre-reading Log

### Files Read

| File | Purpose | Key Insights |
|------|---------|--------------|
| `components/wizard/profile/ProfilePreview.tsx` | Current scorecard during wizard | Shows confidence score with circular indicator, light areas with yellow badges, 5 sections (Domain, Audience, Teaching Style, Content Preferences, Unique Characteristics). Uses vertical border-left styling. No edit capability - read-only display. |
| `components/guru/GuruProfileSection.tsx` | Dashboard profile component | Shows compact summary with expand/collapse. Edit button opens `GuruProfileOnboardingModal` for full re-creation. Fetches profile via `/api/projects/{id}/guru-profile`. |
| `app/projects/[id]/profile/ProfilePageContent.tsx` | Profile page for existing projects | Shows "Current Profile" summary card + tabs for chat/voice/document input. Voice and document modes are "coming soon" placeholders. |
| `hooks/useSpeechRecognition.ts` | Voice input via Web Speech API | Returns `isListening`, `transcript`, `isSupported`, `error`, `startListening`, `stopListening`, `resetTranscript`. Chrome/Edge only. |
| `components/guru/GuruProfileOnboardingModal.tsx` | Full wizard modal | 5 steps: input-mode → brain-dump → processing → preview → confirm. Already has voice + text input modes with 50-char minimum. Editable fields on preview step. |

### Key Observations

1. **ProfilePreview is read-only** - it displays the synthesized profile but has no edit functionality. Users can only go back to re-do the brain dump.

2. **GuruProfileSection opens full modal** - clicking "Edit" triggers the entire onboarding flow from scratch, not an incremental update.

3. **ProfilePageContent has input modes** - but they're for full profile creation, not incremental refinement.

4. **Voice hook is ready** - `useSpeechRecognition` works well and is already used in the onboarding modal.

5. **No incremental refinement API exists** - current `/api/projects/synthesize-guru-profile` expects full `rawInput` and returns a complete profile.

---

## Codebase Map

```
Profile Creation Flow
=====================
app/projects/new/wizard/
├── page.tsx                    # Wizard container
└── [steps...]

components/wizard/profile/
├── ProfilePreview.tsx          # SCORECARD (read-only during wizard)
├── ProfileChatMode.tsx         # Chat-based profile input
├── ProfileVoiceMode.tsx        # Voice input (wizard version)
└── ProfileDocumentMode.tsx     # Document upload

Dashboard Profile Access
========================
components/guru/
├── GuruProfileSection.tsx      # Dashboard card with expand/edit
└── GuruProfileOnboardingModal.tsx  # Full wizard modal

app/projects/[id]/profile/
└── ProfilePageContent.tsx      # Profile management page

Voice Input
===========
hooks/useSpeechRecognition.ts   # Web Speech API hook

Profile Synthesis
=================
lib/guruProfile/
├── synthesizer.ts              # GPT-4o synthesis logic
└── types.ts                    # GuruProfileData, SynthesisResult

API Endpoints
=============
app/api/projects/synthesize-guru-profile/route.ts  # POST - full synthesis
app/api/projects/[id]/guru-profile/route.ts        # GET/POST - CRUD
```

---

## Research Findings

### Current UX Issues

1. **No incremental refinement** - To improve a profile, users must redo the entire brain dump or manually edit each field individually in the modal.

2. **Modal is heavyweight** - The onboarding modal is designed for initial creation, not quick updates. Opening it from dashboard feels disruptive.

3. **Light areas not actionable** - ProfilePreview shows which fields have lower confidence but doesn't provide a clear path to improve them specifically.

4. **No visual score breakdown** - The confidence score is a single percentage without showing individual field scores.

### Design Patterns in Codebase

- **Card-based layouts** with `Card`, `CardHeader`, `CardContent` from shadcn/ui
- **Progress indicators** using `Progress` component
- **Badge highlighting** for status (light areas use amber/yellow)
- **Expand/collapse** patterns with `ChevronDown`/`ChevronUp`
- **Input modes** with tabs (chat, voice, document)

### What "Modern Scorecard" Could Include

1. **Visual score ring** - Replace single percentage with a ring/gauge visualization
2. **Per-section scores** - Show mini progress bars for each profile section
3. **Actionable light areas** - Click a light area to focus refinement prompt on that section
4. **Inline refinement input** - Text/voice input at bottom, not full modal
5. **Smooth animations** - Transition effects on expand/collapse and refinement updates
6. **Better typography hierarchy** - Larger headings, better spacing

---

## Clarifications Needed

### 1. Incremental Refinement Approach
**Question:** Should "improve via prompt" do:
- (A) Full re-synthesis with original brain dump + new input combined
- (B) Targeted field update using GPT to modify only specific fields
- (C) Merge strategy: synthesize new input, then merge with existing profile

**Recommendation:** Option A is simplest and maintains consistency. Combine original `rawBrainDump` with new input, re-run synthesis, display diff if desired.

### 2. Dashboard Click Behavior
**Question:** When clicking profile from dashboard, should it:
- (A) Navigate to `/projects/{id}/profile` with new scorecard UI
- (B) Open an inline card expansion with scorecard and refinement input
- (C) Open a slide-out panel/drawer with scorecard

**Recommendation:** Option A provides most space and is consistent with other dashboard links (Research, Artifacts).

### 3. Light Area Targeting
**Question:** Should clicking a light area:
- (A) Pre-fill the refinement input with a prompt about that area
- (B) Filter the scorecard to show only that section expanded
- (C) Both A and B

**Recommendation:** Option A - similar to how research gaps pre-fill the chat.

### 4. Confidence Score Source
**Question:** Current confidence is a single synthesizer output. Should we:
- (A) Keep single overall confidence (simpler)
- (B) Add per-field confidence scores from synthesizer
- (C) Calculate section scores as averages of field light-areas

**Recommendation:** Option C for now - calculate from light areas without API changes.

---

## Proposed Approach

### Phase 1: Modern Scorecard Component
Create `ProfileScorecard.tsx` - a new component that:
- Displays profile with improved visual hierarchy
- Shows overall confidence with ring visualization
- Shows per-section mini progress bars based on light areas
- Has clickable light area badges that pre-fill refinement input
- Reusable in both wizard (ProfilePreview replacement) and profile page

### Phase 2: Inline Refinement Input
Add at bottom of scorecard:
- Text input with expandable textarea
- Voice toggle button (using existing hook)
- "Improve Profile" button to submit
- Shows processing state during re-synthesis

### Phase 3: Profile Page Update
Update `ProfilePageContent.tsx` to:
- Display `ProfileScorecard` as main view (not just summary)
- Remove separate input mode tabs (consolidate into scorecard refinement)
- Keep navigation to research for major gaps

### Phase 4: Dashboard Integration
Update `GuruProfileSection.tsx` to:
- Link to profile page instead of opening modal
- Or: expand inline with scorecard + refinement (depends on user preference)

---

## Open Questions for User

1. When clicking profile from dashboard, should it navigate to a page or expand inline?
2. Should light areas show a suggested prompt or just pre-fill with "I want to improve X"?
3. Should the wizard's ProfilePreview also be updated to match new design, or keep separate?
