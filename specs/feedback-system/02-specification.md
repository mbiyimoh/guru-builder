# User Feedback System - Technical Specification

**Slug:** feedback-system
**Author:** Claude Code
**Date:** 2026-01-09
**Status:** Ready for Implementation
**Ideation:** `specs/feedback-system/01-ideation.md`

---

## 1) Overview

Implement a user feedback system for Guru Builder with:
- Sticky feedback button (bottom-left)
- Dedicated feedback portal page (`/feedback`)
- Upvoting capability to surface popular requests
- Filtering and sorting controls

All functionality requires authentication (consistent with Guru Builder's auth model).

---

## 2) Clarified Requirements

| Decision | Choice |
|----------|--------|
| Button Position | Bottom-left |
| Login to View | Required |
| Login to Submit | Required |
| Login to Vote | Required |
| Feedback Areas | PROJECTS, RESEARCH, ARTIFACTS, PROFILE, READINESS, UI_UX, OTHER |
| Initial Status | OPEN (visible immediately) |
| User Attribution | Name only (no email displayed) |
| Vote Visibility | Always visible |

---

## 3) Database Schema

### 3.1 Prisma Schema Additions

Add to `prisma/schema.prisma`:

```prisma
// ============================================================================
// USER FEEDBACK SYSTEM
// ============================================================================

enum FeedbackArea {
  PROJECTS      // Project management
  RESEARCH      // Research runs and recommendations
  ARTIFACTS     // Teaching artifact generation
  PROFILE       // Guru profile creation
  READINESS     // Readiness assessment
  UI_UX         // General interface feedback
  OTHER         // Catch-all
}

enum FeedbackType {
  BUG           // Something is broken
  ENHANCEMENT   // Improvement to existing feature
  IDEA          // New feature suggestion
  QUESTION      // General question or confusion
}

enum FeedbackStatus {
  OPEN          // New, visible to all users
  IN_REVIEW     // Being evaluated by team
  PLANNED       // Accepted, will be implemented
  IN_PROGRESS   // Currently being worked on
  COMPLETED     // Done/shipped
  CLOSED        // Won't do / duplicate / invalid
}

model Feedback {
  id          String         @id @default(cuid())
  userId      String

  // Content
  title       String         @db.VarChar(200)
  description String         @db.Text

  // Categorization
  area        FeedbackArea
  type        FeedbackType
  status      FeedbackStatus @default(OPEN)

  // Metrics - denormalized for sorting performance
  upvoteCount Int            @default(0)

  // Timestamps
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  // Relations
  user        User           @relation("UserFeedback", fields: [userId], references: [id], onDelete: Cascade)
  votes       FeedbackVote[]

  @@index([userId])
  @@index([status])
  @@index([area])
  @@index([type])
  @@index([createdAt])
  @@index([upvoteCount])
}

model FeedbackVote {
  id         String   @id @default(cuid())
  feedbackId String
  userId     String
  createdAt  DateTime @default(now())

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  user       User     @relation("UserFeedbackVotes", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, userId])  // One vote per user per feedback
  @@index([feedbackId])
  @@index([userId])
}
```

### 3.2 User Model Additions

Add relations to existing `User` model:

```prisma
model User {
  // ... existing fields ...

  // Feedback relations
  feedbackSubmissions Feedback[]     @relation("UserFeedback")
  feedbackVotes       FeedbackVote[] @relation("UserFeedbackVotes")
}
```

### 3.3 Migration

```bash
npm run db:backup
npm run migrate:safe -- add-feedback-system
```

---

## 4) Validation Schemas

Create `lib/feedback/validation.ts`:

```typescript
import { z } from 'zod'

export const FeedbackAreaSchema = z.enum([
  'PROJECTS',
  'RESEARCH',
  'ARTIFACTS',
  'PROFILE',
  'READINESS',
  'UI_UX',
  'OTHER'
])

export const FeedbackTypeSchema = z.enum([
  'BUG',
  'ENHANCEMENT',
  'IDEA',
  'QUESTION'
])

export const FeedbackStatusSchema = z.enum([
  'OPEN',
  'IN_REVIEW',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED'
])

export const CreateFeedbackSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be 200 characters or less')
    .transform(s => s.trim()),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be 5000 characters or less')
    .transform(s => s.trim()),
  area: FeedbackAreaSchema,
  type: FeedbackTypeSchema,
})

export const VoteActionSchema = z.object({
  action: z.enum(['upvote', 'remove'])
})

// TypeScript types
export type FeedbackArea = z.infer<typeof FeedbackAreaSchema>
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>
export type VoteActionInput = z.infer<typeof VoteActionSchema>
```

---

## 5) API Routes

### 5.1 Route Structure

```
app/api/feedback/
├── route.ts              # POST (create), GET (list)
└── [id]/
    ├── route.ts          # GET (single), PATCH (admin status update)
    └── vote/
        └── route.ts      # POST (upvote/remove)
```

### 5.2 POST /api/feedback

Create new feedback submission.

**Request:**
```typescript
{
  title: string       // 5-200 chars
  description: string // 10-5000 chars
  area: FeedbackArea
  type: FeedbackType
}
```

**Response (201):**
```typescript
{
  feedback: {
    id: string
    title: string
    description: string
    area: FeedbackArea
    type: FeedbackType
    status: 'OPEN'
    upvoteCount: 0
    createdAt: string
    user: { id: string, name: string | null }
  }
}
```

**Auth:** Required (401 if not authenticated)

### 5.3 GET /api/feedback

List feedback with filtering and pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| sort | 'popular' \| 'recent' \| 'oldest' | 'popular' | Sort order |
| area | FeedbackArea | - | Filter by area |
| type | FeedbackType | - | Filter by type |
| status | FeedbackStatus | non-CLOSED | Filter by status |
| limit | number | 50 | Max items (capped at 100) |
| cursor | string | - | Pagination cursor |

**Response (200):**
```typescript
{
  feedback: Array<{
    id: string
    title: string
    description: string
    area: FeedbackArea
    type: FeedbackType
    status: FeedbackStatus
    upvoteCount: number
    hasUserUpvoted: boolean
    createdAt: string
    user: { id: string, name: string | null }
  }>
  nextCursor: string | null
  hasMore: boolean
}
```

**Auth:** Required

### 5.4 POST /api/feedback/[id]/vote

Toggle upvote on feedback item.

**Request:**
```typescript
{
  action: 'upvote' | 'remove'
}
```

**Response (200):**
```typescript
{
  success: true
  upvoteCount: number
  hasUserUpvoted: boolean
}
```

**Auth:** Required

**Behavior:**
- `upvote`: Creates vote if not exists, no-op if already voted
- `remove`: Deletes vote if exists, no-op if not voted
- Uses atomic transaction for vote + count update

---

## 6) Components

### 6.1 Component Structure

```
components/feedback/
├── FeedbackButton.tsx     # Sticky bottom-left button
├── FeedbackDialog.tsx     # Modal wrapper for form
├── FeedbackForm.tsx       # Multi-step submission form
├── FeedbackList.tsx       # List with filters/sorting
├── FeedbackCard.tsx       # Individual feedback item
└── UpvoteButton.tsx       # Vote toggle button
```

### 6.2 FeedbackButton

```typescript
// Sticky button, bottom-left, navigates to /feedback
// Position: fixed, bottom-6, left-6, z-50
// Uses router.push('/feedback') on click
// Icon: MessageSquarePlus from lucide-react
```

### 6.3 FeedbackCard

Displays single feedback item with:
- Title (semibold, lg)
- Description (truncated, 2 lines)
- Type badge with icon (Bug, Sparkles, Lightbulb, HelpCircle)
- Status badge with color coding
- Area badge (outline variant)
- User name + relative timestamp
- Upvote button with count

**Badge Colors:**
| Type | Color |
|------|-------|
| BUG | red-100/red-800 |
| ENHANCEMENT | blue-100/blue-800 |
| IDEA | yellow-100/yellow-800 |
| QUESTION | purple-100/purple-800 |

| Status | Color |
|--------|-------|
| OPEN | gray-100/gray-800 |
| IN_REVIEW | blue-100/blue-800 |
| PLANNED | green-100/green-800 |
| IN_PROGRESS | orange-100/orange-800 |
| COMPLETED | green-600/white |
| CLOSED | gray-400/white |

### 6.4 UpvoteButton

Props:
```typescript
{
  feedbackId: string
  initialUpvotes: number
  initialHasUpvoted: boolean
  userId: string  // Passed from server component
}
```

**Behavior:**
- Optimistic UI update on click
- Rollback on error
- Uses ThumbsUp icon
- Variant: 'default' when voted, 'outline' when not

### 6.5 FeedbackList

**Controls:**
- Sort dropdown: Most Popular, Most Recent, Oldest First
- Area filter: All Areas + 7 specific areas
- Type filter: All Types + 4 types
- Result count badge

**States:**
- Loading: Spinner centered
- Empty: "No feedback found" message with CTA
- Populated: Card list with 3-unit spacing

### 6.6 FeedbackForm

**Fields:**
1. Area selection (button grid, 2 columns)
2. Type selection (button grid with icons, 2 columns)
3. Title input (5-200 chars, counter shown)
4. Description textarea (10-5000 chars, 6 rows, counter shown)

**Validation:**
- Client-side validation before submit
- Server-side Zod validation
- Error messages displayed inline

---

## 7) Pages

### 7.1 /feedback Page

```typescript
// app/feedback/page.tsx
// Server component with auth check

export default async function FeedbackPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Header />
      <FeedbackList userId={user.id} />
      <FeedbackDialog userId={user.id} />
    </div>
  )
}
```

**Header:**
- Title: "Feedback Portal"
- Subtitle: "Share your feedback, report bugs, or suggest new features"
- "Add New Feedback" button (opens dialog)

---

## 8) Layout Integration

### 8.1 Root Layout Update

Add FeedbackButton to `app/layout.tsx`:

```tsx
// After </main> and before <footer>
{user && <FeedbackButton />}
```

**Conditional Rendering:**
- Only show when user is authenticated
- Button is fixed position, won't affect layout flow

---

## 9) Area Labels

Display labels for FeedbackArea enum:

```typescript
const areaLabels: Record<FeedbackArea, string> = {
  PROJECTS: 'Projects',
  RESEARCH: 'Research & Recommendations',
  ARTIFACTS: 'Teaching Artifacts',
  PROFILE: 'Guru Profile',
  READINESS: 'Readiness Assessment',
  UI_UX: 'User Interface',
  OTHER: 'Other'
}
```

---

## 10) Implementation Phases

### Phase 1: Database (30 min)
- [ ] Add enums to Prisma schema
- [ ] Add Feedback model
- [ ] Add FeedbackVote model
- [ ] Add User relations
- [ ] Backup database
- [ ] Run migration

### Phase 2: Validation & API (1 hour)
- [ ] Create `lib/feedback/validation.ts`
- [ ] Implement POST /api/feedback
- [ ] Implement GET /api/feedback
- [ ] Implement POST /api/feedback/[id]/vote
- [ ] Test with curl/Postman

### Phase 3: Components (1.5 hours)
- [ ] Create FeedbackButton
- [ ] Create UpvoteButton
- [ ] Create FeedbackCard
- [ ] Create FeedbackList
- [ ] Create FeedbackForm
- [ ] Create FeedbackDialog

### Phase 4: Page & Integration (30 min)
- [ ] Create /feedback page
- [ ] Add FeedbackButton to root layout
- [ ] Test full flow

### Phase 5: Polish (30 min)
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling
- [ ] Mobile responsiveness

**Total Estimated Time: 4 hours**

---

## 11) Testing Checklist

### Functional Tests
- [ ] Can submit feedback with all field combinations
- [ ] Validation errors display correctly
- [ ] Feedback appears in list after submission
- [ ] Can upvote feedback (count increases)
- [ ] Can remove upvote (count decreases)
- [ ] Cannot vote twice on same item
- [ ] Sorting works (popular, recent, oldest)
- [ ] Area filter narrows results
- [ ] Type filter narrows results
- [ ] Pagination loads more items

### Auth Tests
- [ ] Unauthenticated user redirected to /login from /feedback
- [ ] Unauthenticated API calls return 401
- [ ] Feedback button only shows for authenticated users

### UI Tests
- [ ] Feedback button visible on all pages when logged in
- [ ] Button doesn't overlap with content
- [ ] Form is usable on mobile
- [ ] Cards display correctly on all screen sizes
- [ ] Loading states prevent double-submission

---

## 12) Future Enhancements (Out of Scope)

These features are explicitly deferred:
- File attachments
- Admin status management dashboard
- Email notifications
- Search within feedback
- Comments/discussion threads
- Vote credit limits
- Revenue-weighted voting
- Roadmap integration
- Anonymous submission option
