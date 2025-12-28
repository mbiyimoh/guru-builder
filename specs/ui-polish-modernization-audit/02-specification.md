# UI Polish & Modernization - Specification

**Slug:** ui-polish-modernization-audit
**Author:** Claude Code
**Date:** 2024-12-27
**Status:** Ready for Implementation
**Ideation:** `01-ideation.md`

---

## Overview

This specification details the implementation plan for modernizing the Guru Builder UI. The focus is on component-level improvements that cascade to all pages, moderate animations (shimmers, transitions), and automatic dark mode support through well-chosen libraries and patterns.

### Design Principles

1. **Component-first** - Polish primitives so all pages benefit automatically
2. **Auto dark mode** - Use CSS variable patterns that handle both modes
3. **Moderate motion** - Shimmers, transitions, progress animations (no confetti/particles)
4. **Readable overlays** - Solid/opaque backgrounds on modals and dropdowns
5. **Desktop-optimized** - Focus on desktop experience, mobile deferred
6. **Use Tailwind defaults** - Leverage built-in utilities (shadows, colors) rather than custom CSS variables

---

## Phase 1: Foundation (Theme & Design Tokens)

### 1.1 Color System Migration

**Goal:** Migrate from mixed gray usage to consistent Zinc palette with proper HSL variables.

**File:** `app/globals.css`

Update the existing CSS variables to use Zinc-based values (no shadow variables - use Tailwind defaults):

```css
@layer base {
  :root {
    /* Background & Foreground */
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;

    /* Card - slight elevation from background */
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;

    /* Popover - solid for overlays */
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;

    /* Primary - Blue accent */
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;

    /* Secondary - Zinc-based */
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;

    /* Muted - for subtle backgrounds */
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;

    /* Accent - hover states */
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;

    /* Destructive */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;

    /* Border & Input */
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 221.2 83.2% 53.3%;

    /* Radius - slightly larger for modern feel */
    --radius: 0.625rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;

    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;

    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;

    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;

    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;

    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;

    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 224.3 76.3% 48%;
  }
}
```

### 1.2 Shimmer Animation

**Add to:** `app/globals.css` (after the base layer)

```css
/* Shimmer animation for loading states */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
}
```

### 1.3 Hardcoded Color Migration (Priority Files)

**Goal:** Replace hardcoded `gray-*` classes with theme-aware alternatives.

**Priority files to update (high-impact, frequently viewed):**

| File | Replacements |
|------|--------------|
| `components/wizard/WizardNavigation.tsx` | `bg-gray-100` → `bg-muted`, `border-gray-300` → `border-border`, `text-gray-400` → `text-muted-foreground`, `bg-gray-300` → `bg-border`, `bg-blue-600` → `bg-primary`, `text-blue-600` → `text-primary` |
| `components/dashboard/GettingStartedStep.tsx` | `bg-gray-*` → `bg-muted`, `text-gray-*` → `text-muted-foreground` |
| `app/projects/page.tsx` | Any `gray-*` → theme equivalents |
| `components/dashboard/SimplifiedDashboard.tsx` | Any `gray-*` → theme equivalents |

**Deferred:** The remaining 85 files with hardcoded grays will be addressed incrementally in future batches. Focus on user-facing, high-traffic components first.

---

## Phase 2: Component Primitives

### 2.1 Card Component Enhancement

**File:** `components/ui/card.tsx`

**Changes:**
- Add `shadow-md` by default (Tailwind built-in)
- Add hover shadow transition
- Increase border-radius to `rounded-xl`

```tsx
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow-md transition-shadow hover:shadow-lg",
      className
    )}
    {...props}
  />
))
```

### 2.2 Badge Component Polish

**File:** `components/ui/badge.tsx`

**Changes:**
- Add subtle `shadow-sm` for depth
- Keep existing variants (defer new semantic variants until needed)

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

### 2.3 Button Transition Enhancement

**File:** `components/ui/button.tsx`

**Changes:**
- Add smooth transitions (`transition-all duration-200`)
- Add subtle shadow on solid variants
- Add active state feedback (`active:scale-[0.98]`)

```tsx
// Update base classes
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]"

// Update default variant
default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
```

### 2.4 Progress Component Enhancement

**File:** `components/ui/progress.tsx`

**Changes:**
- Add shimmer animation overlay for visual feedback
- Smooth width transitions

```tsx
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full bg-primary transition-all duration-500 ease-out relative overflow-hidden"
      style={{ width: `${value || 0}%` }}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
))
```

### 2.5 Dialog/Modal - Solid Backgrounds

**File:** `components/ui/dialog.tsx`

**Changes:**
- Ensure solid `bg-background` (no transparency)
- Use `shadow-xl` for floating effect
- Increase border-radius to `rounded-xl`

```tsx
// DialogContent - update className
className={cn(
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl",
  className
)}
```

---

## Phase 3: Feature Components

### 3.1 Skeleton Component (Create New)

**Create file:** `components/ui/skeleton.tsx`

```tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent animate-shimmer" />
    </div>
  )
}

export { Skeleton }
```

### 3.2 Empty State Component (Create New)

**Create file:** `components/ui/empty-state.tsx`

```tsx
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <div className="w-8 h-8 text-muted-foreground">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### 3.3 Activity Tile Enhancement

**File:** `components/dashboard/ActivityTile.tsx`

**Current structure uses `ClickableCard` wrapper - preserve this pattern.**

**Changes:**
- Update inner Card styling for better shadows and hover
- Add icon container styling

```tsx
// Current structure (preserve ClickableCard wrapper)
export function ActivityTile({ title, value, icon, href, isStatus }: ActivityTileProps) {
  return (
    <ClickableCard href={href}>
      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {icon}
            </div>
          </div>
          <div className={`text-2xl font-bold ${isStatus ? 'text-base' : ''}`}>
            {isStatus ? (
              <Badge variant={value === 'Active' ? 'default' : 'secondary'}>{value}</Badge>
            ) : (
              value
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{title}</div>
        </CardContent>
      </Card>
    </ClickableCard>
  );
}
```

### 3.4 Getting Started Step Enhancement

**File:** `components/dashboard/GettingStartedStep.tsx`

**Changes:**
- Replace hardcoded colors with theme variables
- Better completed/pending visual states
- Smooth transitions

```tsx
<div className={cn(
  "flex items-center gap-4 p-4 rounded-lg transition-all duration-300",
  completed
    ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
    : "bg-muted/50 border border-transparent hover:border-border"
)}>
  <div className={cn(
    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
    completed
      ? "bg-emerald-500 text-white shadow-md"
      : disabled
        ? "bg-muted text-muted-foreground"
        : "bg-primary/10 text-primary"
  )}>
    {completed ? <Check className="w-4 h-4" /> : icon}
  </div>
  {/* ... rest of component */}
</div>
```

### 3.5 Wizard Navigation Polish

**File:** `components/wizard/WizardNavigation.tsx`

**Changes:**
- Migrate ALL hardcoded colors to theme variables
- Add shadow to active step indicator

**Find and replace:**

| Find | Replace |
|------|---------|
| `bg-blue-600` | `bg-primary` |
| `border-blue-600` | `border-primary` |
| `text-blue-600` | `text-primary` |
| `bg-gray-100` | `bg-muted` |
| `border-gray-300` | `border-border` |
| `text-gray-400` | `text-muted-foreground` |
| `bg-gray-300` | `bg-border` |
| `text-gray-600` | `text-muted-foreground` |
| `text-gray-900` | `text-foreground` |
| `border-gray-200` | `border-border` |
| `bg-white` | `bg-background` |

**Add shadow to active step:**
```tsx
// Where isActive is true, add shadow-md to the step indicator
isActive && 'shadow-md'
```

---

## Phase 4: Page-Level Polish

### 4.1 Container Spacing Standardization

**Pattern to apply across all pages:**

```tsx
// Page container - consistent max-width and padding
<div className="container max-w-7xl mx-auto py-8 px-4 lg:px-8">

// Section spacing - use space-y-8 for major sections
<div className="space-y-8">

// Card grids - consistent gaps
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

// Content areas within cards
<div className="space-y-6">
```

### 4.2 Page Header Pattern

**Standardize across pages:**

```tsx
<div className="flex flex-col gap-1 mb-8">
  <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
  {description && (
    <p className="text-muted-foreground">{description}</p>
  )}
</div>
```

### 4.3 Projects List Page

**File:** `app/projects/page.tsx`

**Specific changes:**
- Card component will auto-inherit new shadow/hover from Phase 2
- Replace inline empty state SVG with `EmptyState` component
- Update spacing to `py-8`, `space-y-8`

### 4.4 Dashboard Page

**File:** `components/dashboard/SimplifiedDashboard.tsx`

**Specific changes:**
- Update container spacing to `py-8 px-4 lg:px-8 space-y-8`
- Getting Started card: ensure uses theme colors (via component update)
- Activity tiles grid: `gap-6` (if not already)

### 4.5 Profile Scorecard Area

**Files:** `components/profile/ProfileScorecard.tsx` and related

**Specific changes:**
- Cards will auto-inherit new styles from Phase 2
- No additional changes needed - already well-structured

### 4.6 Artifact Pages

**File:** `components/artifacts/ArtifactDetailPanel.tsx`

**Specific changes:**
- Cards will auto-inherit new styles
- Update spacing to `space-y-8` if currently less

---

## Implementation Order

### Batch 1: Foundation (20 min)
1. Update `globals.css` with Zinc-based CSS variables
2. Add shimmer animation to `globals.css`

### Batch 2: Core Primitives (45 min)
1. `components/ui/card.tsx` - shadow + hover
2. `components/ui/button.tsx` - transitions + active state
3. `components/ui/badge.tsx` - shadow-sm
4. `components/ui/progress.tsx` - shimmer overlay
5. `components/ui/dialog.tsx` - rounded-xl + shadow-xl

### Batch 3: New Components (20 min)
1. Create `components/ui/skeleton.tsx`
2. Create `components/ui/empty-state.tsx`

### Batch 4: Feature Components (45 min)
1. Update `components/dashboard/ActivityTile.tsx`
2. Update `components/dashboard/GettingStartedStep.tsx`
3. Update `components/wizard/WizardNavigation.tsx` (color migration)

### Batch 5: Page Polish (30 min)
1. `app/projects/page.tsx` - spacing + empty state
2. `components/dashboard/SimplifiedDashboard.tsx` - spacing
3. Verify artifact pages inherit styles correctly

### Batch 6: Verification (15 min)
1. Test light mode across all updated pages
2. Test dark mode across all updated pages
3. Verify no regressions

**Total estimated time: ~3 hours**

---

## Testing Checklist

- [ ] All pages render correctly in light mode
- [ ] All pages render correctly in dark mode
- [ ] Card shadows visible and hover states work
- [ ] Button transitions smooth, active state visible
- [ ] Progress shimmer animation works
- [ ] Skeleton shimmer animation works
- [ ] Empty states display properly with icon background
- [ ] Modals have solid backgrounds (no text bleed-through)
- [ ] Wizard navigation uses theme colors (no blue-600/gray-*)
- [ ] No color contrast issues in either mode
- [ ] Animations smooth, not jarring

---

## Rollback Plan

All changes are CSS/Tailwind class modifications. If issues arise:

1. Revert `globals.css` to previous version
2. Revert component files individually
3. No database or API changes to worry about

Git provides easy rollback: `git checkout HEAD~1 -- <file>`

---

## Success Metrics

1. **Visual consistency** - No hardcoded gray/blue colors in priority files
2. **Depth perception** - Cards clearly elevated from background with shadows
3. **Interaction feedback** - All buttons/cards have visible hover/active states
4. **Loading polish** - Shimmer animations on Progress and Skeleton components
5. **Empty state quality** - Consistent empty states with icon backgrounds and CTAs

---

## Deferred Items

The following were identified during validation but deferred to keep scope focused:

1. **Full color audit (85 files)** - Address incrementally after priority files
2. **Badge semantic variants** - Add `success`/`warning`/`info` when usage is identified
3. **Pulse-glow animation** - Add if a specific active-state use case emerges
4. **Mobile polish** - Desktop-first; mobile improvements in separate effort
