# Loading Feedback Components

## Status
Draft

## Authors
Claude | 2024-12-26

## Overview

Enhance the Button component with a built-in `loading` prop and create a ClickableCard wrapper component to provide consistent loading feedback across the app. This eliminates the "dead click" problem where users tap/click and see no response for 1-3 seconds.

## Problem Statement

Currently, interactive elements lack immediate visual feedback:

1. **Buttons with async actions** - Each component reinvents loading state with manual `useState` + inline spinner SVG (see `NewResearchForm.tsx:218-224`)
2. **Clickable cards/tiles** - Plain `<Link>` wrappers with zero click feedback (`ActivityTile.tsx`, project cards on `/projects`)
3. **Navigation buttons** - `onClick={() => router.push(...)}` with no indication anything happened (`CreateProjectButton.tsx`)

Users frequently tap multiple times thinking their click didn't register.

## Goals

- Add optional `loading` prop to Button component with spinner + auto-disable
- Create ClickableCard component for Link-wrapped cards with navigation loading state
- Provide consistent, predictable feedback across all interactive elements
- Zero breaking changes to existing Button usage

## Non-Goals

- Global navigation progress bar (NProgress-style)
- Skeleton loading for content areas
- Form-level loading states or validation feedback
- Animation library integration
- Page transition animations
- Loading states for non-interactive elements

## Technical Approach

### 1. Enhance Button Component

Extend the existing shadcn Button (`components/ui/button.tsx`) with:

```typescript
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean        // NEW: Shows spinner, disables button
  loadingText?: string     // NEW: Optional text while loading
}
```

**Behavior:**
- When `loading={true}`: show spinner, set `disabled`, optionally replace text
- Spinner uses existing `animate-spin` pattern from codebase
- No new dependencies - uses Lucide `Loader2` icon already in project

### 2. Create ClickableCard Component

New component `components/ui/clickable-card.tsx`:

```typescript
interface ClickableCardProps {
  href: string
  children: React.ReactNode
  className?: string
}
```

**Behavior:**
- Wraps children in Next.js `<Link>`
- Uses `useTransition` or router events to detect navigation start
- Shows subtle loading indicator (spinner overlay or opacity pulse)
- Applies hover/focus states for accessibility

### 3. Update High-Traffic Components

Apply the new components to:
- `CreateProjectButton.tsx` - Use Button with loading
- `ActivityTile.tsx` - Use ClickableCard
- `app/projects/page.tsx` - Use ClickableCard for project cards

## Implementation Details

### Button Enhancement

```typescript
// components/ui/button.tsx
import { Loader2 } from 'lucide-react'

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
```

### ClickableCard Component

```typescript
// components/ui/clickable-card.tsx
'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClickableCardProps {
  href: string
  children: React.ReactNode
  className?: string
}

export function ClickableCard({ href, children, className }: ClickableCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        'block relative cursor-pointer',
        isPending && 'pointer-events-none',
        className
      )}
    >
      {children}
      {isPending && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </a>
  )
}
```

### Files to Modify

| File | Change |
|------|--------|
| `components/ui/button.tsx` | Add `loading` and `loadingText` props |
| `components/ui/clickable-card.tsx` | New file |
| `app/projects/CreateProjectButton.tsx` | Add loading state |
| `components/dashboard/ActivityTile.tsx` | Use ClickableCard |
| `app/projects/page.tsx` | Use ClickableCard for project cards |

## Testing Approach

### Manual Verification
1. Click Button with `loading={true}` - spinner shows, button disabled
2. Click ClickableCard - spinner overlay appears during navigation
3. Verify existing Button usage still works (no `loading` prop = same behavior)

### Key Scenarios
- Button loading state shows spinner and disables clicks
- ClickableCard shows loading during slow navigation
- Keyboard navigation still works (Enter/Space on ClickableCard)
- Screen readers announce loading state appropriately

## User Experience

**Before:** User clicks "New Guru" button → nothing visible for 1-2 seconds → page changes
**After:** User clicks "New Guru" button → immediate spinner feedback → page changes

**Before:** User clicks project card → nothing for 1-3 seconds → dashboard loads
**After:** User clicks project card → subtle overlay with spinner → dashboard loads

## Open Questions

1. **Spinner position in Button** - Replace children entirely, or prepend spinner? (Spec assumes prepend)
2. **ClickableCard overlay style** - Semi-transparent overlay vs. card opacity reduction? (Spec assumes overlay)

---

## Future Improvements and Enhancements

**These are OUT OF SCOPE for initial implementation but documented for future consideration:**

### Extended Loading Patterns
- Global navigation progress bar (NProgress-style) for all route changes
- Skeleton loading components for content areas
- Optimistic UI updates for faster perceived performance

### Button Enhancements
- `loadingPosition` prop (left/right/replace) for spinner placement
- Loading state for icon-only buttons (replace icon with spinner)
- Button group loading coordination

### ClickableCard Variants
- Different loading indicators (pulse, shimmer, progress)
- Prefetching on hover for faster navigation
- Loading state persistence across navigation

### Form Integration
- Form-level loading wrapper component
- Integration with React Hook Form pending states
- Multi-step form loading coordination

### Animation Polish
- Subtle scale animation on click (micro-interaction)
- Smooth opacity transitions for loading states
- Reduced motion support for accessibility preferences

### Testing Expansion
- Playwright E2E tests for loading state visibility
- Performance benchmarks for loading state renders
- Accessibility audit for ARIA live regions

---

## References

- Existing spinner pattern: `components/research/NewResearchForm.tsx:218-224`
- shadcn Button: `components/ui/button.tsx`
- ActivityTile: `components/dashboard/ActivityTile.tsx`
- React `useTransition`: https://react.dev/reference/react/useTransition
- Lucide Loader2: https://lucide.dev/icons/loader-2
