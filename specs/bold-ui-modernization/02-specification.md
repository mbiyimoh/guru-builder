# Bold UI Modernization - Specification

**Created:** 2024-12-28
**Status:** Validated & Simplified
**Ideation:** `specs/bold-ui-modernization/01-ideation.md`

---

## Overview

Transform the Guru Builder UI from flat and subtle to bold and modern with gradient accents, pronounced shadows, color-coded elements, and clear visual hierarchy. Changes should be immediately noticeable.

## Design Principles

1. **Bold but not garish** - Gradients should be tasteful, not overwhelming
2. **Systematic** - Define reusable patterns, not one-off styles
3. **Cascading** - Changes to primitives affect all pages automatically
4. **Dark mode first-class** - Every change works in both themes

## Functional Safety

**All changes are CSS/className only:**
- No component props removed
- No event handlers changed
- No state management modified
- No data fetching altered
- TypeScript compilation = verification

---

## Phase 1: Foundation (globals.css + tailwind.config.ts)

### 1.1 New CSS Variables

Add to `:root` in `globals.css`:

```css
/* Gradient stops for reuse */
--gradient-start: 221.2 83.2% 53.3%;   /* blue */
--gradient-mid: 250 83.2% 53.3%;       /* purple */
--gradient-end: 280 83.2% 53.3%;       /* pink */

/* Glow color (for shadows) */
--glow-blue: 217 91% 60%;
```

Add to `.dark` in `globals.css`:

```css
/* Dark mode gradient stops - more saturated for visibility */
--gradient-start: 217 91% 50%;
--gradient-mid: 250 91% 50%;
--gradient-end: 280 91% 50%;
```

### 1.2 Tailwind Config Extensions

Add to `extend` in `tailwind.config.ts`:

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
keyframes: {
  ...existingKeyframes,
  'gradient-shift': {
    '0%, 100%': { backgroundPosition: '0% 50%' },
    '50%': { backgroundPosition: '100% 50%' },
  },
},
animation: {
  ...existingAnimations,
  'gradient-shift': 'gradient-shift 3s ease infinite',
},
```

---

## Phase 2: Component Primitives

### 2.1 Button Component (`components/ui/button.tsx`)

**Update default variant only** (other variants unchanged):

```tsx
default: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200",
```

### 2.2 Card Component (`components/ui/card.tsx`)

**Update base Card className:**

```tsx
"rounded-lg border bg-card text-card-foreground shadow-elevated transition-all duration-300 hover:shadow-elevated-hover"
```

### 2.3 Badge Component (`components/ui/badge.tsx`)

**Replace existing `warning` variant and add new gradient variants:**

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Gradient variants (warning is replacement, others are new)
        warning: "border-transparent bg-gradient-to-r from-amber-500 to-orange-500 text-white",
        success: "border-transparent bg-gradient-to-r from-green-500 to-emerald-500 text-white",
        info: "border-transparent bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

### 2.4 Progress Component (`components/ui/progress.tsx`)

**Update indicator className:**

```tsx
<ProgressPrimitive.Indicator
  className="h-full flex-1 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 bg-[length:200%_100%] animate-gradient-shift transition-all duration-500"
  style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
/>
```

---

## Phase 3: Dashboard Components

### 3.1 ActivityTile (`components/dashboard/ActivityTile.tsx`)

**Add optional `colorScheme` prop:**

```tsx
interface ActivityTileProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  colorScheme?: 'blue' | 'amber' | 'purple' | 'green';
  isStatus?: boolean;
}

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

// Default to 'blue' if not specified (backward compatible)
const scheme = colorSchemes[colorScheme ?? 'blue'];
```

**Update icon container:**
```tsx
<div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", scheme.iconBg, scheme.iconColor)}>
  {icon}
</div>
```

### 3.2 SimplifiedDashboard (`components/dashboard/SimplifiedDashboard.tsx`)

**Apply color schemes to activity tiles:**

```tsx
<ActivityTile
  colorScheme="blue"
  title="Research Runs"
  ...
/>
<ActivityTile
  colorScheme="amber"
  title="Knowledge Bits Acquired"
  ...
/>
<ActivityTile
  colorScheme="purple"
  title="Artifacts Generated"
  ...
/>
<ActivityTile
  colorScheme="green"
  title="Profile"
  ...
/>
```

### 3.3 GettingStartedStep (`components/dashboard/GettingStartedStep.tsx`)

**Update className logic for gradient states:**

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

---

## Phase 4: Navigation

### 4.1 App Layout (`app/layout.tsx`)

**Add gradient bottom border to nav:**

Find the nav element and add a gradient border overlay:

```tsx
<nav className="relative border-b bg-card">
  {/* Existing nav content */}
  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
</nav>
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Add gradient CSS variables to globals.css (:root)
- [ ] Add dark mode gradient variables to globals.css (.dark)
- [ ] Extend tailwind.config.ts with backgroundImage, boxShadow, keyframes, animation

### Phase 2: Primitives
- [ ] Update Button default variant with gradient
- [ ] Update Card with elevated shadow
- [ ] Update Badge with gradient variants (warning replacement + success, info)
- [ ] Update Progress with gradient fill and animation

### Phase 3: Dashboard
- [ ] Add colorScheme prop to ActivityTile
- [ ] Apply color schemes in SimplifiedDashboard
- [ ] Update GettingStartedStep with gradient states

### Phase 4: Navigation
- [ ] Add gradient border to nav in app/layout.tsx

### Verification
- [ ] Run `npx tsc --noEmit` - must pass
- [ ] Manual check: Light mode looks correct
- [ ] Manual check: Dark mode looks correct

---

## Files to Modify

1. `app/globals.css` - CSS variables (6 new variables)
2. `tailwind.config.ts` - Tailwind extensions
3. `components/ui/button.tsx` - Default variant only
4. `components/ui/card.tsx` - Base className only
5. `components/ui/badge.tsx` - Variant additions
6. `components/ui/progress.tsx` - Indicator className
7. `components/dashboard/ActivityTile.tsx` - Add colorScheme prop
8. `components/dashboard/SimplifiedDashboard.tsx` - Apply colorSchemes
9. `components/dashboard/GettingStartedStep.tsx` - Gradient states
10. `app/layout.tsx` - Nav gradient border

---

## Visual Before/After

| Element | Before | After |
|---------|--------|-------|
| Primary Button | Flat blue `bg-primary` | Gradient blue→indigo with glow shadow |
| Cards | Light shadow `shadow-md` | Elevated shadow with subtle blue tint |
| Activity Tiles | All same gray icon | Color-coded: blue/amber/purple/green |
| Progress Bar | Solid blue | Animated gradient blue→purple→indigo |
| Badges | Solid yellow warning | Gradient amber→orange warning |
| Completed Steps | Solid emerald bg | Gradient emerald→green bg |
| Navigation | Simple border | Gradient fade border |

---

## Success Criteria

1. ✅ Users immediately notice the visual difference
2. ✅ All changes work in both light and dark mode
3. ✅ No functional regressions (CSS only)
4. ✅ TypeScript compiles without errors
5. ✅ Visual hierarchy is clear and intuitive

---

## Deferred to Follow-up

- Page header gradient backgrounds
- Research page visual updates
- Artifacts page visual updates
- Enhanced focus states with glow
