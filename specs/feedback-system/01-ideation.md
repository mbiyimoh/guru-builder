# User Feedback System Integration

**Slug:** feedback-system
**Author:** Claude Code
**Date:** 2026-01-09
**Branch:** preflight/feedback-system
**Related:** `feedback-system-portable-guru/` (reference implementation)

---

## 1) Intent & Assumptions

- **Task brief:** Integrate a persistent/sticky feedback button and dedicated feedback portal page into Guru Builder, allowing users to submit feedback, report bugs, and suggest features. The system should include upvoting capability so users can vote on existing feedback items instead of creating duplicates. This functionality is based on a portable feedback system already built in another project.

- **Assumptions:**
  - Authentication will use the existing Supabase-based auth (`lib/auth.ts`, `getCurrentUser()`) rather than a separate AuthContext hook
  - File attachments will NOT be included in the initial implementation (simplifies scope, avoids R2/S3 setup)
  - The sticky button will be positioned in the bottom-left corner to match existing product patterns and avoid conflicts with potential future chat widgets
  - FeedbackArea categories will be customized for Guru Builder's specific features (Projects, Research, Artifacts, etc.)
  - Admin functionality (status management, bulk operations) will be deferred to a future iteration
  - The system will be global (not project-scoped) since feedback is about the platform, not specific projects

- **Out of scope:**
  - File/screenshot attachment uploads (requires R2/S3 setup)
  - Admin dashboard for managing feedback status
  - Email notifications for feedback status changes
  - Search functionality within feedback list
  - Comments/discussion threads on feedback items
  - Vote credit limits (will use simple unlimited upvotes initially)
  - Revenue-weighted voting
  - Roadmap view integration
  - Anonymous submission (will require login)

---

## 2) Pre-reading Log

- `feedback-system-portable-guru/README.md`: Comprehensive overview of portable feedback system architecture, includes component list, API routes, and customization points
- `feedback-system-portable-guru/SETUP-GUIDE.md`: Step-by-step integration instructions, shadcn/ui dependencies, Prisma schema additions, auth integration patterns
- `feedback-system-portable-guru/components/feedback/FeedbackButton.tsx`: Simple 43-line sticky button component using `useRouter` for navigation
- `feedback-system-portable-guru/components/feedback/FeedbackCard.tsx`: 143-line card with upvoting, badges for type/status, user avatar, attachments display
- `feedback-system-portable-guru/components/feedback/UpvoteButton.tsx`: 102-line optimistic UI with rollback on error, requires `useAuth` hook
- `feedback-system-portable-guru/components/feedback/FeedbackList.tsx`: 169-line list with sorting (popular/recent/oldest), area/type filtering, loading states
- `feedback-system-portable-guru/components/feedback/FeedbackForm.tsx`: 212-line multi-step form with area/type selection, validation, character limits
- `feedback-system-portable-guru/app/api/feedback/route.ts`: POST/GET endpoints with pagination, filtering, user vote tracking via efficient Set lookup
- `feedback-system-portable-guru/app/api/feedback/[id]/vote/route.ts`: Atomic vote transaction with increment/decrement, idempotent operations
- `feedback-system-portable-guru/schema/prisma-additions.prisma`: 3 models (Feedback, FeedbackVote, FeedbackAttachment), 6 enums, comprehensive indexes
- `feedback-system-portable-guru/lib/validation-additions.ts`: Zod schemas for all feedback operations with comprehensive validation rules
- `app/layout.tsx`: Server component with Supabase auth, nav bar, footer - feedback button should go INSIDE body but OUTSIDE nav/main/footer structure
- `lib/auth.ts`: Server-side auth with `getCurrentUser()` (cached), `requireUser()` (throwing), `requireAdmin()` - no client-side hook
- `prisma/schema.prisma`: 937 lines, complex model structure with User model at lines 18-29, no existing feedback-related models
- `lib/db.ts`: Standard Prisma client singleton export
- `lib/validation.ts`: Existing Zod schemas for research/recommendations, pattern to follow for feedback schemas
- `app/globals.css`: Tailwind base with light/dark themes, Driver.js styling, gradient variables
- `components/ui/`: 16 shadcn/ui components including button, card, badge, dialog, input, textarea - all needed components already installed

---

## 3) Codebase Map

### Primary Components/Modules

| Component | Path | Role |
|-----------|------|------|
| Root Layout | `app/layout.tsx` | Server component, auth check, nav/footer wrapper - **integration point for FeedbackButton** |
| Auth Library | `lib/auth.ts` | `getCurrentUser()`, `requireUser()`, `requireAdmin()` - **use for API auth** |
| Database | `lib/db.ts` | Prisma client singleton - **use for all DB operations** |
| Validation | `lib/validation.ts` | Zod schemas - **add feedback schemas here or new file** |
| User Model | `prisma/schema.prisma:18-29` | Existing User model - **add relation fields** |

### Shared Dependencies

- **UI Components:** `components/ui/` - button, card, badge, dialog, input, textarea, select (all installed)
- **Auth:** `lib/auth.ts` - server-side only, no client hook exists
- **Database:** `lib/db.ts` + Prisma client
- **Validation:** Zod (`lib/validation.ts` pattern)
- **Icons:** lucide-react (already in use)
- **Date formatting:** date-fns (already installed)
- **Toasts:** sonner (already installed)

### Data Flow

```
User clicks Feedback Button
    │
    ├──> Router navigates to /feedback
    │
    ├──> FeedbackList fetches GET /api/feedback
    │         │
    │         └──> Prisma query with filters/sorting
    │                   │
    │                   └──> Returns feedback[] with hasUserUpvoted flag
    │
    └──> User clicks "Add New Feedback"
              │
              └──> FeedbackDialog opens
                        │
                        └──> FeedbackForm submitted
                                  │
                                  └──> POST /api/feedback
                                            │
                                            └──> Prisma create (validated)
```

### Feature Flags/Config

- No feature flags needed for initial implementation
- `ADMIN_EMAIL` env var already exists - can be used for future admin status updates

### Potential Blast Radius

| Area | Impact | Risk Level |
|------|--------|------------|
| Prisma Schema | Add 3 models + 2 enums | Low - additive only |
| User Model | Add 2 relation fields | Low - additive only |
| Root Layout | Add FeedbackButton component | Low - single line addition |
| New API Routes | `/api/feedback/*` | None - new directory |
| New Page | `/feedback` | None - new route |
| New Components | `components/feedback/*` | None - new directory |

---

## 4) Root Cause Analysis

*N/A - This is a new feature implementation, not a bug fix.*

---

## 5) Research Findings

### Potential Solutions

#### Approach A: Direct Port (Minimal Changes)
Copy the portable system nearly verbatim, making only necessary adjustments for auth patterns.

**Pros:**
- Fastest to implement (2-3 hours)
- Proven, working code
- Minimal debugging needed
- Can defer optimizations

**Cons:**
- Requires creating client-side auth hook or passing user as prop
- File upload code will be dead code until R2 is set up
- May not feel fully "native" to Guru Builder patterns

#### Approach B: Selective Integration with Simplification
Port only essential features, simplify where possible, and adapt more thoroughly to existing patterns.

**Pros:**
- Cleaner integration with existing codebase
- No dead code (file uploads removed)
- Can use server components where beneficial
- Better aligns with Next.js 15 patterns

**Cons:**
- More work upfront (4-5 hours)
- Risk of introducing bugs during adaptation
- Need to carefully test auth flow

#### Approach C: Server-First Architecture
Rebuild with server components for the list/page, client components only for interactivity (voting, form).

**Pros:**
- Best performance (less client JS)
- More idiomatic Next.js 15
- Simplifies auth (server-side throughout)
- No client-side auth context needed

**Cons:**
- Most work (6-8 hours)
- Deviates significantly from reference implementation
- Voting needs careful handling for optimistic updates

### Recommendation

**Approach B: Selective Integration with Simplification** is recommended.

**Rationale:**
1. The reference implementation is solid and battle-tested, but carries unnecessary complexity (file uploads, client auth context)
2. Guru Builder uses server-side auth exclusively - forcing this through props to client components is cleaner than creating a new AuthContext
3. Removing file upload logic eliminates ~150 lines of unused code and avoids confusing developers
4. The core components (FeedbackCard, FeedbackList, FeedbackForm, UpvoteButton) are well-structured and can be adapted without major rewrites
5. Time savings vs. Approach C are significant, while avoiding the technical debt of Approach A

### Key Adaptations Required

1. **Auth Pattern:**
   - Remove `useAuth` hook from UpvoteButton
   - Pass `userId` as prop from server component parent
   - Handle "not logged in" state at the page level (redirect to /login)

2. **FeedbackAreas (Enum Customization):**
   ```typescript
   enum FeedbackArea {
     PROJECTS      // Project management
     RESEARCH      // Research runs and recommendations
     ARTIFACTS     // Teaching artifact generation
     PROFILE       // Guru profile creation
     READINESS     // Readiness assessment
     UI_UX         // General interface feedback
     OTHER         // Catch-all
   }
   ```

3. **File Uploads:**
   - Remove `FileUploadInput` component entirely
   - Remove `attachments` field from form/schema
   - Remove `FeedbackAttachment` model from Prisma
   - Remove `/api/feedback/upload` route

4. **Styling Alignment:**
   - Ensure button uses existing `components/ui/button` variants
   - Match card styling to existing dashboard cards
   - Use Guru Builder's color palette for type/status badges

5. **Button Placement:**
   - Bottom-left to avoid future chat widget conflicts
   - Match existing app's visual hierarchy

---

## 6) Clarifications

The following decisions would benefit from user input:

1. **Button Position:** Should the feedback button be bottom-left (recommended to avoid chat widget conflicts) or bottom-right (more conventional)?
>> yes, bottom left

2. **Login Requirement:** Should users need to be logged in to:
   - View feedback? (Recommended: No - public viewing increases trust)
   - Submit feedback? (Recommended: Yes - prevents spam)
   - Vote on feedback? (Recommended: Yes - one vote per user)
  >> all should require login. you shouldn't be able to view anything besides the guru builder landing page without having an account

3. **Feedback Areas:** Are the proposed categories appropriate, or should they be adjusted?
   - PROJECTS, RESEARCH, ARTIFACTS, PROFILE, READINESS, UI_UX, OTHER
   - Should any be added/removed/renamed?
   >> seems like a good starting set

4. **Initial Status Workflow:** Should submitted feedback start as:
   - OPEN (visible immediately) - faster feedback loop
   - PENDING (requires admin approval) - cleaner public board
   >> open

5. **User Attribution:** Should feedback display:
   - Full name + email (maximum transparency)
   - Name only (balanced)
   - Anonymous with option to show name (user choice)
   >> name only

6. **Vote Visibility:** Should vote counts be visible:
   - Always (social proof, may create bandwagon effect)
   - Only after voting (reduces bias)
   - Always, but random initial order (balances discoverability)
   >> always

---

## 7) Implementation Outline (Preview)

*To be detailed in 02-specification.md after clarification*

### Phase 1: Schema & API
1. Add Prisma models (Feedback, FeedbackVote)
2. Add enums (FeedbackArea, FeedbackType, FeedbackStatus)
3. Add User relations
4. Run migration
5. Create Zod validation schemas
6. Implement API routes (CRUD + vote)

### Phase 2: Components
1. Create FeedbackButton (adapted for bottom-left)
2. Create FeedbackCard (without attachments)
3. Create UpvoteButton (prop-based auth)
4. Create FeedbackList (with filters/sorting)
5. Create FeedbackForm (simplified, no file upload)
6. Create FeedbackDialog (modal wrapper)

### Phase 3: Page & Integration
1. Create `/feedback` page
2. Add FeedbackButton to root layout
3. Test auth flows
4. Test voting mechanics
5. Test filtering/sorting

### Phase 4: Polish
1. Loading states and skeletons
2. Empty state messaging
3. Error handling
4. Mobile responsiveness
5. Accessibility audit
