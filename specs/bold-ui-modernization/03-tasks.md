# Task Breakdown: Bold UI Modernization

**Generated:** 2024-12-28
**Source:** specs/bold-ui-modernization/02-specification.md
**Last Decompose:** 2024-12-28

---

## Overview

Transform the Guru Builder UI with gradient accents, pronounced shadows, color-coded elements, and clear visual hierarchy. All changes are CSS/className only - zero functional impact.

**Total Tasks:** 12
**Phases:** 4

---

## Phase 1: Foundation (3 tasks)

### Task 1.1: Add gradient CSS variables to globals.css
**Description:** Add gradient and glow CSS variables to :root and .dark sections
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (must be first)

**Implementation:**

Add to `:root` section in `app/globals.css` (after existing variables, before closing brace):

```css
/* Gradient stops for reuse */
--gradient-start: 221.2 83.2% 53.3%;   /* blue */
--gradient-mid: 250 83.2% 53.3%;       /* purple */
--gradient-end: 280 83.2% 53.3%;       /* pink */

/* Glow color (for shadows) */
--glow-blue: 217 91% 60%;
```

Add to `.dark` section:

```css
/* Dark mode gradient stops - more saturated for visibility */
--gradient-start: 217 91% 50%;
--gradient-mid: 250 91% 50%;
--gradient-end: 280 91% 50%;
```

**Acceptance Criteria:**
- [ ] Variables added to :root
- [ ] Variables added to .dark
- [ ] No syntax errors in CSS

---

### Task 1.2: Extend tailwind.config.ts with new utilities
**Description:** Add backgroundImage, boxShadow, keyframes, and animation extensions
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Implementation:**

In `tailwind.config.ts`, add to the `extend` object:

```typescript
backgroundImage: {
  'gradient-primary': 'linear-gradient(135deg, hsl(var(--gradient-start)), hsl(var(--gradient-mid)), hsl(var(--gradient-end)))',
  'gradient-subtle': 'linear-gradient(135deg, hsl(var(--gradient-start) / 0.1), hsl(var(--gradient-end) / 0.1))',
},
boxShadow: {
  'glow': '0 0 20px -5px hsl(var(--glow-blue) / 0.4)',
  'elevated': '0 4px 20px -5px rgba(0,0,0,0.15), 0 0 0 1px rgba(59,130,246,0.05)',
  'elevated-hover': '0 8px 30px -5px rgba(0,0,0,0.2), 0 0 0 1px rgba(59,130,246,0.1)',
},
```

Add to existing `keyframes` (merge with shimmer):

```typescript
keyframes: {
  shimmer: {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(400%)' },
  },
  'gradient-shift': {
    '0%, 100%': { backgroundPosition: '0% 50%' },
    '50%': { backgroundPosition: '100% 50%' },
  },
},
```

Add to existing `animation` (merge with shimmer):

```typescript
animation: {
  shimmer: 'shimmer 1.5s ease-in-out infinite',
  'gradient-shift': 'gradient-shift 3s ease infinite',
},
```

**Acceptance Criteria:**
- [ ] backgroundImage utilities added
- [ ] boxShadow utilities added
- [ ] keyframes merged correctly
- [ ] animation merged correctly
- [ ] TypeScript compiles without errors

---

### Task 1.3: Verify foundation with TypeScript check
**Description:** Run tsc to verify no compilation errors after foundation changes
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2
**Can run parallel with:** None

**Implementation:**

```bash
npx tsc --noEmit
```

**Acceptance Criteria:**
- [ ] TypeScript compilation passes
- [ ] No errors related to new utilities

---

## Phase 2: Component Primitives (4 tasks)

### Task 2.1: Update Button default variant with gradient
**Description:** Change default button to gradient blue→indigo with glow shadow
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.2, 2.3, 2.4

**Implementation:**

In `components/ui/button.tsx`, find the `default` variant in `buttonVariants` and replace:

**Before:**
```tsx
default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
```

**After:**
```tsx
default: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200",
```

**Acceptance Criteria:**
- [ ] Default buttons have gradient background
- [ ] Hover state has shadow glow effect
- [ ] Click has subtle lift effect
- [ ] Works in light and dark mode

---

### Task 2.2: Update Card with elevated shadow
**Description:** Change Card base className to use elevated shadow system
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1, 2.3, 2.4

**Implementation:**

In `components/ui/card.tsx`, find the Card component className and replace:

**Before:**
```tsx
"rounded-lg border bg-card text-card-foreground shadow-md transition-shadow hover:shadow-lg"
```

**After:**
```tsx
"rounded-lg border bg-card text-card-foreground shadow-elevated transition-all duration-300 hover:shadow-elevated-hover"
```

**Acceptance Criteria:**
- [ ] Cards have more pronounced shadow
- [ ] Hover state increases shadow depth
- [ ] Subtle blue tint visible in shadow
- [ ] Works in light and dark mode

---

### Task 2.3: Update Badge with gradient variants
**Description:** Replace warning variant and add success/info gradient variants
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1, 2.2, 2.4

**Implementation:**

In `components/ui/badge.tsx`, update the `badgeVariants` variants object:

**Replace entire variants object with:**
```tsx
variant: {
  default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
  outline: "text-foreground",
  // Gradient variants
  warning: "border-transparent bg-gradient-to-r from-amber-500 to-orange-500 text-white",
  success: "border-transparent bg-gradient-to-r from-green-500 to-emerald-500 text-white",
  info: "border-transparent bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
},
```

**Acceptance Criteria:**
- [ ] Warning badge has gradient amber→orange
- [ ] Success badge has gradient green→emerald
- [ ] Info badge has gradient blue→indigo
- [ ] Existing variants unchanged (default, secondary, destructive, outline)

---

### Task 2.4: Update Progress with animated gradient
**Description:** Change Progress indicator to animated gradient fill
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1, 2.2, 2.3

**Implementation:**

In `components/ui/progress.tsx`, find the ProgressPrimitive.Indicator and update its className:

**Before:**
```tsx
className="h-full w-full flex-1 bg-primary transition-all"
```

**After:**
```tsx
className="h-full flex-1 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 bg-[length:200%_100%] animate-gradient-shift transition-all duration-500"
```

Note: Keep any existing `usePrimary` conditional logic but update the base gradient class.

**Acceptance Criteria:**
- [ ] Progress bar has gradient colors
- [ ] Gradient animates (shifts position)
- [ ] Rounded ends on progress bar
- [ ] Smooth fill transition

---

## Phase 3: Dashboard Components (3 tasks)

### Task 3.1: Add colorScheme prop to ActivityTile
**Description:** Add optional colorScheme prop for color-coded tiles
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** None

**Implementation:**

In `components/dashboard/ActivityTile.tsx`:

1. Update interface:
```tsx
interface ActivityTileProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  colorScheme?: 'blue' | 'amber' | 'purple' | 'green';
  isStatus?: boolean;
}
```

2. Add color schemes constant (inside component or above):
```tsx
const colorSchemes = {
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-950',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    iconBg: 'bg-amber-100 dark:bg-amber-950',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  purple: {
    iconBg: 'bg-purple-100 dark:bg-purple-950',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  green: {
    iconBg: 'bg-green-100 dark:bg-green-950',
    iconColor: 'text-green-600 dark:text-green-400',
  },
};
```

3. Update component to use colorScheme:
```tsx
export function ActivityTile({ title, value, icon, href, colorScheme, isStatus }: ActivityTileProps) {
  const scheme = colorSchemes[colorScheme ?? 'blue'];

  return (
    <ClickableCard href={href}>
      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between mb-2">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", scheme.iconBg, scheme.iconColor)}>
              {icon}
            </div>
          </div>
          {/* rest unchanged */}
        </CardContent>
      </Card>
    </ClickableCard>
  );
}
```

4. Add cn import if not present:
```tsx
import { cn } from '@/lib/utils';
```

**Acceptance Criteria:**
- [ ] colorScheme prop is optional (backward compatible)
- [ ] Default is 'blue' when not specified
- [ ] All 4 color schemes work (blue, amber, purple, green)
- [ ] Colors work in both light and dark mode

---

### Task 3.2: Apply colorSchemes in SimplifiedDashboard
**Description:** Add colorScheme props to activity tiles in dashboard
**Size:** Small
**Priority:** High
**Dependencies:** Task 3.1
**Can run parallel with:** Task 3.3

**Implementation:**

In `components/dashboard/SimplifiedDashboard.tsx`, find the activity tiles section and add colorScheme props:

```tsx
<ActivityTile
  colorScheme="blue"
  title="Research Runs"
  value={project.researchRuns.length}
  icon={<Search className="w-5 h-5" />}
  href={`/projects/${project.id}/research`}
/>
<ActivityTile
  colorScheme="amber"
  title="Knowledge Bits Acquired"
  value={project.researchRuns.reduce((acc, run) => acc + run._count.recommendations, 0)}
  icon={<Lightbulb className="w-5 h-5" />}
  href={`/projects/${project.id}/research`}
/>
<ActivityTile
  colorScheme="purple"
  title="Artifacts Generated"
  value={project.guruArtifacts.length}
  icon={<FileText className="w-5 h-5" />}
  href={`/projects/${project.id}/artifacts/teaching`}
/>
<ActivityTile
  colorScheme="green"
  title="Profile"
  value={hasProfile ? 'Active' : 'Not Set'}
  icon={<Brain className="w-5 h-5" />}
  href={`/projects/${project.id}/profile`}
  isStatus
/>
```

**Acceptance Criteria:**
- [ ] Research Runs tile is blue
- [ ] Knowledge Bits tile is amber
- [ ] Artifacts tile is purple
- [ ] Profile tile is green
- [ ] All tiles visually distinct

---

### Task 3.3: Update GettingStartedStep with gradient states
**Description:** Add gradient backgrounds for completed and hover states
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** Task 3.2

**Implementation:**

In `components/dashboard/GettingStartedStep.tsx`, update the className logic in the Link component:

**Before:**
```tsx
className={cn(
  "flex items-center gap-4 p-4 rounded-lg transition-all duration-300",
  completed
    ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
    : disabled
    ? "bg-muted/50 border border-transparent opacity-50 cursor-not-allowed"
    : "bg-muted/50 border border-transparent hover:border-border"
)}
```

**After:**
```tsx
className={cn(
  "flex items-center gap-4 p-4 rounded-lg transition-all duration-300",
  completed
    ? "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800"
    : disabled
    ? "bg-muted/50 border border-transparent opacity-50 cursor-not-allowed"
    : "bg-muted/50 border border-transparent hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950/20 dark:hover:to-indigo-950/20 hover:border-blue-200 dark:hover:border-blue-800"
)}
```

**Acceptance Criteria:**
- [ ] Completed steps have emerald→green gradient
- [ ] Incomplete steps have blue→indigo gradient on hover
- [ ] Disabled steps unchanged
- [ ] Works in both light and dark mode

---

## Phase 4: Navigation (2 tasks)

### Task 4.1: Add gradient border to navigation
**Description:** Add subtle gradient bottom border to main navigation
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Implementation:**

In `app/layout.tsx`, find the nav element (the header with border-b) and make it relative, then add a gradient overlay:

**Before:**
```tsx
<nav className="border-b bg-card">
```

**After:**
```tsx
<nav className="relative border-b bg-card">
  {/* existing nav content */}
  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
</nav>
```

Note: The gradient div should be added as the LAST child inside the nav, after all other content.

**Acceptance Criteria:**
- [ ] Nav has subtle gradient border
- [ ] Gradient fades at edges
- [ ] Primary color tint visible
- [ ] Works in both themes

---

### Task 4.2: Final verification
**Description:** Run TypeScript check and manual visual verification
**Size:** Small
**Priority:** High
**Dependencies:** All previous tasks
**Can run parallel with:** None

**Implementation:**

1. Run TypeScript check:
```bash
npx tsc --noEmit
```

2. Manual verification checklist:
- [ ] Open http://localhost:3009 in browser
- [ ] Check light mode: buttons, cards, tiles, progress, nav
- [ ] Toggle to dark mode (if available)
- [ ] Check dark mode: all same elements
- [ ] Navigate through: Projects → Dashboard → Research

**Acceptance Criteria:**
- [ ] TypeScript compiles without errors
- [ ] Light mode looks correct
- [ ] Dark mode looks correct
- [ ] No visual regressions
- [ ] All gradients and shadows visible

---

## Execution Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|------------------------|
| Phase 1: Foundation | 3 | None (sequential) |
| Phase 2: Primitives | 4 | All 4 can run in parallel |
| Phase 3: Dashboard | 3 | Tasks 3.2 and 3.3 parallel |
| Phase 4: Navigation | 2 | None (sequential) |

**Critical Path:** 1.1 → 1.2 → 1.3 → (2.1-2.4 parallel) → 3.1 → (3.2, 3.3 parallel) → 4.1 → 4.2

**Estimated Effort:** ~30 minutes total (all tasks are CSS/className changes)

**Risk Level:** Low - All changes are CSS only, TypeScript compilation verifies correctness
