# Task Breakdown: Unify Project Creation Flow

**Spec:** specs/unify-project-creation-flow/02-specification.md
**Created:** 2025-12-24

## Tasks

### Task 289: Change CreateProjectButton to navigate instead of open modal

**File:** `app/projects/CreateProjectButton.tsx`

**Changes:**
1. Remove modal state (`isModalOpen`, `setIsModalOpen`)
2. Remove `GuruProfileOnboardingModal` import and JSX
3. Change button `onClick` to navigate to `/projects/new/profile`
4. Keep `isCreating` state for potential future use, or remove if not needed

**Acceptance Criteria:**
- Clicking "New Guru" navigates to `/projects/new/profile`
- No modal appears
- Navigation works correctly

---

### Task 290: Fix profile page redirect path

**File:** `app/projects/new/profile/page.tsx`

**Changes:**
1. Line 119: Change `router.push(\`/projects/${project.id}/dashboard\`)` to `router.push(\`/projects/${project.id}\`)`
2. Line 132: Verify `handleDomainEnable` redirects to correct path
3. Line 141: Verify `handleDomainSkip` redirects to correct path

**Acceptance Criteria:**
- After profile save (no domain detected): redirects to `/projects/[id]`
- After domain enable: redirects to `/projects/[id]`
- After domain skip: redirects to `/projects/[id]`
- No blank pages

---

### Task 291: Create GTStatusIndicator component

**File:** `components/dashboard/GTStatusIndicator.tsx` (new)

**Changes:**
1. Create component that fetches GT config
2. Return null if loading or no GT enabled
3. Display card with engine name and position count
4. Add "View Details" link to teaching artifacts page

**Acceptance Criteria:**
- Component fetches from `/api/projects/[id]/ground-truth-config`
- Shows nothing when GT not enabled
- Shows status card when GT enabled
- Link navigates to teaching artifacts page

---

### Task 292: Add GTStatusIndicator to SimplifiedDashboard

**File:** `components/dashboard/SimplifiedDashboard.tsx`

**Changes:**
1. Import `GTStatusIndicator` component
2. Add component after Activity Tiles section, before Profile Summary
3. Only show when `hasProfile` is true (GT requires profile)

**Acceptance Criteria:**
- GT indicator appears on dashboard for projects with GT enabled
- No indicator for projects without GT
- Positioned appropriately in layout

---

## Dependency Order

```
Task 289 (button) ─┐
                   ├─→ All independent, can be done in parallel
Task 290 (redirect)┤
                   │
Task 291 (component)─→ Task 292 (integration)
```

Tasks 289-291 can be done in parallel. Task 292 depends on Task 291.

## Estimated Scope

- **Files Modified:** 3
- **Files Created:** 1
- **Total Changes:** ~50 lines added, ~30 lines removed
