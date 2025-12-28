# Task Breakdown: UI Polish & Modernization

**Generated:** 2024-12-27
**Source:** `02-specification.md`
**Last Decompose:** 2024-12-27

---

## Overview

Modernize the Guru Builder UI through component-level improvements that cascade to all pages. Focus on shadows, transitions, shimmer animations, and theme-aware color migration.

**Total Tasks:** 16
**Estimated Time:** ~3 hours

---

## Phase 1: Foundation (Theme & Design Tokens)

### Task 1.1: Update globals.css with Zinc-based CSS Variables
**Description**: Migrate color system to consistent Zinc palette with proper HSL variables
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation must be first)

**Technical Requirements**:
- Update `:root` CSS variables with Zinc-based values
- Update `.dark` CSS variables for dark mode consistency
- Increase `--radius` to `0.625rem` for modern feel
- No custom shadow variables - use Tailwind defaults

**Implementation**:

Update `app/globals.css` with these CSS variables:

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

**Acceptance Criteria**:
- [ ] CSS variables updated in both `:root` and `.dark` selectors
- [ ] No hardcoded gray HSL values remain in theme variables
- [ ] `--radius` set to `0.625rem`
- [ ] Light mode renders correctly
- [ ] Dark mode renders correctly

---

### Task 1.2: Add Shimmer Animation to globals.css
**Description**: Create shimmer keyframe animation for loading states
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- Create `@keyframes shimmer` animation
- Add `.animate-shimmer` utility class
- Animation should translate from -100% to 100%
- 2-second duration, infinite, linear timing

**Implementation**:

Add after the `@layer base` block in `app/globals.css`:

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

**Acceptance Criteria**:
- [ ] Shimmer keyframes defined
- [ ] `.animate-shimmer` class available
- [ ] Animation is smooth and continuous
- [ ] Works in both light and dark modes

---

## Phase 2: Component Primitives

### Task 2.1: Enhance Card Component with Shadow and Hover
**Description**: Update Card primitive with shadow-md, hover shadow-lg, and rounded-xl
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.2, 2.3, 2.4, 2.5

**Technical Requirements**:
- Change from `shadow-sm` to `shadow-md` for default shadow
- Add `hover:shadow-lg` for hover state
- Add `transition-shadow` for smooth animation
- Change from `rounded-lg` to `rounded-xl` for modern feel

**Implementation**:

Update `components/ui/card.tsx`:

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

**Acceptance Criteria**:
- [ ] Card has `shadow-md` by default
- [ ] Card has `hover:shadow-lg` effect
- [ ] Transition is smooth (via `transition-shadow`)
- [ ] Border radius is `rounded-xl`
- [ ] All pages using Card component inherit new styles

---

### Task 2.2: Enhance Button Component with Transitions and Active State
**Description**: Add smooth transitions and active scale feedback to buttons
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.1, 2.3, 2.4, 2.5

**Technical Requirements**:
- Add `transition-all duration-200` for smooth transitions
- Add `active:scale-[0.98]` for click feedback
- Update default variant with `shadow-sm` and `hover:shadow-md`
- Keep existing variant structure

**Implementation**:

Update `components/ui/button.tsx` base classes:

```tsx
// Update base classes
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]"

// Update default variant
default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
```

**Acceptance Criteria**:
- [ ] Buttons have smooth 200ms transitions
- [ ] Click produces subtle scale effect (0.98)
- [ ] Default variant has shadow-sm, hover:shadow-md
- [ ] All button variants work correctly
- [ ] Disabled state still works (no scale effect)

---

### Task 2.3: Add Shadow to Badge Component
**Description**: Add subtle shadow-sm to badges for depth
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.1, 2.2, 2.4, 2.5

**Technical Requirements**:
- Add `shadow-sm` to base badge styles
- Keep all existing variants unchanged
- Ensure shadow works with all background colors

**Implementation**:

Update `components/ui/badge.tsx`:

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

**Acceptance Criteria**:
- [ ] Badge has subtle `shadow-sm`
- [ ] All variants (default, secondary, destructive, outline) work
- [ ] Shadow visible but not overwhelming
- [ ] Works in light and dark modes

---

### Task 2.4: Add Shimmer to Progress Component
**Description**: Add shimmer animation overlay to progress bar
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.2 (shimmer animation)
**Can run parallel with**: Task 2.1, 2.2, 2.3, 2.5

**Technical Requirements**:
- Add shimmer overlay inside ProgressPrimitive.Indicator
- Use gradient from transparent via white/20 to transparent
- Use `animate-shimmer` class from globals.css
- Add smooth width transition with `duration-500 ease-out`

**Implementation**:

Update `components/ui/progress.tsx`:

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

**Acceptance Criteria**:
- [ ] Progress bar has shimmer animation
- [ ] Shimmer only visible on filled portion
- [ ] Width transitions smoothly (500ms)
- [ ] Works with all progress values (0-100)
- [ ] Shimmer visible in both light and dark modes

---

### Task 2.5: Update Dialog Component with Rounded-xl and Shadow-xl
**Description**: Ensure dialogs have solid backgrounds, rounded-xl, and shadow-xl
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.1, 2.2, 2.3, 2.4

**Technical Requirements**:
- Change border-radius to `rounded-xl`
- Change shadow to `shadow-xl` for floating effect
- Ensure `bg-background` is solid (no transparency)
- Keep all existing animation classes

**Implementation**:

Update DialogContent in `components/ui/dialog.tsx`:

```tsx
className={cn(
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl",
  className
)}
```

**Acceptance Criteria**:
- [ ] Dialog has `rounded-xl` corners
- [ ] Dialog has `shadow-xl` for elevated effect
- [ ] Background is solid `bg-background` (no text bleed-through)
- [ ] All animations still work correctly
- [ ] Works in both light and dark modes

---

## Phase 3: Feature Components

### Task 3.1: Create Skeleton Component
**Description**: Create new Skeleton component with shimmer animation
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2 (shimmer animation)
**Can run parallel with**: Task 3.2

**Technical Requirements**:
- Create new file `components/ui/skeleton.tsx`
- Use `bg-muted` as base background
- Add shimmer overlay with gradient
- Use `animate-shimmer` class
- Export as named export

**Implementation**:

Create `components/ui/skeleton.tsx`:

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

**Acceptance Criteria**:
- [ ] File created at `components/ui/skeleton.tsx`
- [ ] Component renders with shimmer animation
- [ ] Accepts className for sizing (e.g., `w-full h-4`)
- [ ] Works in both light and dark modes
- [ ] Can be imported and used in other components

---

### Task 3.2: Create Empty State Component
**Description**: Create reusable EmptyState component with icon, title, description, and optional action
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.2 (Button enhancements)
**Can run parallel with**: Task 3.1

**Technical Requirements**:
- Create new file `components/ui/empty-state.tsx`
- Accept props: icon, title, description, action (optional)
- Icon container with rounded bg-muted background
- Centered layout with proper spacing
- Optional action button

**Implementation**:

Create `components/ui/empty-state.tsx`:

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

**Acceptance Criteria**:
- [ ] File created at `components/ui/empty-state.tsx`
- [ ] Icon displays in circular muted background
- [ ] Title and description properly styled
- [ ] Action button renders when provided
- [ ] Component is centered and properly spaced
- [ ] Works in both light and dark modes

---

### Task 3.3: Enhance Activity Tile Component
**Description**: Update ActivityTile with improved shadow, hover, and icon styling
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.1 (Card enhancements)
**Can run parallel with**: Task 3.4, 3.5

**Technical Requirements**:
- Preserve existing ClickableCard wrapper pattern
- Update inner Card with `hover:shadow-lg transition-all duration-300`
- Add icon container with `bg-primary/10` and `text-primary`
- Keep existing value/title layout

**Implementation**:

Update `components/dashboard/ActivityTile.tsx`:

```tsx
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

**Acceptance Criteria**:
- [ ] ClickableCard wrapper preserved
- [ ] Card has hover shadow effect
- [ ] Icon has primary/10 background
- [ ] Transitions are smooth (300ms)
- [ ] Badge variant logic preserved
- [ ] Works in both light and dark modes

---

### Task 3.4: Enhance Getting Started Step Component
**Description**: Update GettingStartedStep with theme colors and better visual states
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 1.1 (theme variables)
**Can run parallel with**: Task 3.3, 3.5

**Technical Requirements**:
- Replace hardcoded colors with theme variables
- Add emerald colors for completed state (with dark mode variants)
- Use bg-muted for pending state
- Add smooth transitions (duration-300)
- Preserve disabled state styling

**Implementation**:

Update `components/dashboard/GettingStartedStep.tsx` container and icon:

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

**Acceptance Criteria**:
- [ ] No hardcoded gray colors remain
- [ ] Completed state has emerald styling
- [ ] Pending state has muted styling with hover
- [ ] Disabled state properly styled
- [ ] Transitions are smooth
- [ ] Works in both light and dark modes

---

### Task 3.5: Migrate WizardNavigation Colors to Theme Variables
**Description**: Replace all hardcoded blue/gray colors with theme variables
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (theme variables)
**Can run parallel with**: Task 3.3, 3.4

**Technical Requirements**:
- Find and replace all hardcoded colors
- Add shadow-md to active step indicator
- Preserve all existing logic and structure

**Find and Replace Table**:

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

**Additional Change**:
Add `shadow-md` to active step indicator where `isActive` is true.

**Acceptance Criteria**:
- [ ] No `blue-600` references remain
- [ ] No `gray-*` references remain
- [ ] Active step has shadow-md
- [ ] All step states work correctly (completed, active, upcoming)
- [ ] Connector lines properly styled
- [ ] Works in both light and dark modes

---

## Phase 4: Page-Level Polish

### Task 4.1: Update Projects List Page Spacing
**Description**: Standardize spacing and use EmptyState component
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.2 (EmptyState component)
**Can run parallel with**: Task 4.2

**Technical Requirements**:
- Update container to `py-8` spacing
- Use `space-y-8` for major sections
- Replace inline empty state SVG with EmptyState component
- Cards will auto-inherit enhanced styles from Phase 2

**Implementation**:

Update `app/projects/page.tsx`:

```tsx
// Import EmptyState
import { EmptyState } from '@/components/ui/empty-state'
import { FolderOpen } from 'lucide-react'

// Update container spacing
<div className="container max-w-7xl mx-auto py-8 px-4 lg:px-8">

// Replace inline empty state with:
<EmptyState
  icon={<FolderOpen className="w-full h-full" />}
  title="No projects yet"
  description="Create your first guru project to get started"
  action={{
    label: "Create Project",
    onClick: () => router.push('/projects/new')
  }}
/>
```

**Acceptance Criteria**:
- [ ] Container has `py-8` spacing
- [ ] Empty state uses EmptyState component
- [ ] Create project button works in empty state
- [ ] Card grid has consistent gap-6
- [ ] Works in both light and dark modes

---

### Task 4.2: Update Dashboard Page Spacing
**Description**: Standardize dashboard container and section spacing
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.3, 3.4 (component updates)
**Can run parallel with**: Task 4.1

**Technical Requirements**:
- Update container to `py-8 px-4 lg:px-8 space-y-8`
- Ensure activity tiles grid has `gap-6`
- Verify Getting Started card uses theme colors

**Implementation**:

Update `components/dashboard/SimplifiedDashboard.tsx`:

```tsx
// Update main container
<div className="py-8 px-4 lg:px-8 space-y-8">

// Ensure activity tiles grid
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
```

**Acceptance Criteria**:
- [ ] Container has consistent spacing
- [ ] Activity tiles grid has gap-6
- [ ] All sections have space-y-8 between them
- [ ] Components inherit updated styles
- [ ] Works in both light and dark modes

---

### Task 4.3: Verify Artifact Pages Inherit Styles
**Description**: Check artifact pages and update spacing if needed
**Size**: Small
**Priority**: Low
**Dependencies**: Task 2.1 (Card enhancements)
**Can run parallel with**: None (verification task)

**Technical Requirements**:
- Verify cards have new shadow/hover styles
- Update spacing to `space-y-8` if currently less
- No major changes expected - mostly verification

**Files to Check**:
- `components/artifacts/ArtifactDetailPanel.tsx`
- `components/artifacts/ArtifactListSidebar.tsx`

**Acceptance Criteria**:
- [ ] Cards display with shadow-md
- [ ] Hover states work correctly
- [ ] Spacing is consistent with rest of app
- [ ] No regressions in artifact viewer functionality

---

## Phase 5: Verification

### Task 5.1: Test Light Mode Across All Pages
**Description**: Manual verification of all updated pages in light mode
**Size**: Small
**Priority**: High
**Dependencies**: All previous tasks
**Can run parallel with**: None (sequential verification)

**Test Checklist**:
- [ ] Projects list page
- [ ] Dashboard page
- [ ] Profile creation wizard
- [ ] Artifact viewer
- [ ] All dialogs/modals
- [ ] Progress bars
- [ ] Buttons and badges
- [ ] Empty states

**Acceptance Criteria**:
- [ ] No visual regressions
- [ ] All shadows visible
- [ ] All transitions smooth
- [ ] No color contrast issues
- [ ] Shimmer animations working

---

### Task 5.2: Test Dark Mode Across All Pages
**Description**: Manual verification of all updated pages in dark mode
**Size**: Small
**Priority**: High
**Dependencies**: Task 5.1
**Can run parallel with**: None (sequential verification)

**Test Checklist**:
- [ ] Projects list page
- [ ] Dashboard page
- [ ] Profile creation wizard
- [ ] Artifact viewer
- [ ] All dialogs/modals
- [ ] Progress bars
- [ ] Buttons and badges
- [ ] Empty states

**Acceptance Criteria**:
- [ ] No visual regressions
- [ ] All shadows visible and appropriate for dark mode
- [ ] All transitions smooth
- [ ] No color contrast issues
- [ ] Shimmer animations working in dark mode
- [ ] Dialog backgrounds solid (no text bleed-through)

---

## Execution Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|------------------------|
| Phase 1: Foundation | 1.1, 1.2 | None (sequential) |
| Phase 2: Primitives | 2.1, 2.2, 2.3, 2.4, 2.5 | All 5 can run in parallel |
| Phase 3: Features | 3.1, 3.2, 3.3, 3.4, 3.5 | 3.1+3.2, 3.3+3.4+3.5 |
| Phase 4: Pages | 4.1, 4.2, 4.3 | 4.1+4.2 |
| Phase 5: Verification | 5.1, 5.2 | Sequential |

**Critical Path**: 1.1 → 1.2 → 2.4 → 3.1 → 5.1 → 5.2

**Estimated Total Time**: ~3 hours
