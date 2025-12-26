# Specification: Unify Project Creation Flow

**Status:** Draft
**Authors:** Claude
**Created:** 2025-12-24

## Overview

Fix three bugs in the project creation flow: (1) make full-page wizard the default entry point for new projects, (2) fix broken redirect after profile creation, and (3) add Ground Truth status indicator to the main dashboard.

## Problem Statement

The Ground Truth simplified integration added domain detection to `/projects/new/profile`, but users create projects via a modal that bypasses this flow. Additionally, the profile page redirects to a non-existent route, and there's no GT status visibility on the dashboard.

## Goals

- Make `/projects/new/profile` the default when clicking "New Guru"
- Fix redirect from `/projects/[id]/dashboard` to `/projects/[id]`
- Show GT engine status on the main dashboard when enabled

## Non-Goals

- Removing the `GuruProfileOnboardingModal` component (may be useful elsewhere)
- Redesigning the profile creation UI
- Adding GT configuration capabilities to the dashboard (just status display)
- Removing old wizard navigation components
- Any database schema changes

## Technical Approach

### 1. Change CreateProjectButton Behavior

**File:** `app/projects/CreateProjectButton.tsx`

Replace modal opening with navigation to full-page wizard:

```tsx
// Current: Opens modal
<Button onClick={() => setIsModalOpen(true)}>New Guru</Button>

// Change to: Navigate to full-page wizard
<Button onClick={() => router.push('/projects/new/profile')}>New Guru</Button>
```

Remove the modal import and state since they're no longer used.

### 2. Fix Profile Page Redirect

**File:** `app/projects/new/profile/page.tsx`

Fix the redirect path in two places:

```tsx
// Line 119: After no domain detected
router.push(`/projects/${project.id}/dashboard`)  // WRONG
router.push(`/projects/${project.id}`)            // CORRECT

// Lines 131-133 and 139-142: After domain prompt
router.push(`/projects/${createdProjectId}/dashboard`)  // Check if this exists too
router.push(`/projects/${createdProjectId}`)             // Fix if needed
```

### 3. Add GT Status Indicator to Dashboard

**File:** `components/dashboard/SimplifiedDashboard.tsx`

Add a simple GT status card that shows when Ground Truth is enabled:

```tsx
// Add import for the GT status component
import { GTStatusIndicator } from './GTStatusIndicator';

// In the component, add after Activity Tiles or in a relevant section
{hasProfile && <GTStatusIndicator projectId={project.id} />}
```

**New File:** `components/dashboard/GTStatusIndicator.tsx`

Create a lightweight component that:
- Fetches GT config status via `/api/projects/[id]/ground-truth-config`
- Shows nothing if GT not enabled (no visual noise)
- Shows engine name and position count if enabled
- Links to teaching artifacts page for more details

## Implementation Details

### GTStatusIndicator Component

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface GTStatusIndicatorProps {
  projectId: string;
}

interface GTConfig {
  activeConfig: {
    engine: {
      name: string;
      domain: string;
    };
  } | null;
  positionLibrary: {
    total: number;
  } | null;
}

export function GTStatusIndicator({ projectId }: GTStatusIndicatorProps) {
  const [config, setConfig] = useState<GTConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/ground-truth-config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  // Don't show anything if loading or no GT enabled
  if (loading || !config?.activeConfig) {
    return null;
  }

  const { engine } = config.activeConfig;
  const positionCount = config.positionLibrary?.total || 0;

  return (
    <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                Accuracy Verification Active
              </div>
              <div className="text-sm text-muted-foreground">
                {engine.name} • {positionCount} positions available
              </div>
            </div>
          </div>
          <Link
            href={`/projects/${projectId}/artifacts/teaching`}
            className="text-sm text-green-600 hover:underline"
          >
            View Details →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Testing Approach

### Manual Testing Checklist

1. **New Guru Button Flow**
   - Click "New Guru" on `/projects` page
   - Verify it navigates to `/projects/new/profile` (not modal)
   - Complete profile creation
   - Verify redirect goes to `/projects/[id]` (not `/dashboard`)

2. **Domain Detection & GT Prompt**
   - Create a backgammon-related profile
   - Verify domain detection prompt appears
   - Enable GT and verify redirect to dashboard
   - Verify GT indicator appears on dashboard

3. **GT Indicator Display**
   - For project with GT enabled: verify indicator shows
   - For project without GT: verify no indicator (clean UI)
   - Click "View Details" link, verify navigation works

## Open Questions

None - this is a straightforward bug fix.

## User Experience

- Users clicking "New Guru" will see the full-page wizard instead of a modal
- The full-page experience allows for domain detection and GT prompt integration
- GT status is visible on dashboard after enabling, linking to more details

## Future Improvements and Enhancements

**The following are OUT OF SCOPE for this fix:**

1. **Remove old wizard components** - The stepper UI and old paradigm navigation could be cleaned up, but this is cosmetic and not blocking
2. **Deprecate modal component** - `GuruProfileOnboardingModal` could be removed if not used elsewhere, but requires audit
3. **Inline GT configuration on dashboard** - Could add ability to enable/disable GT from dashboard, not just view status
4. **Position library quick-start from dashboard** - Could add "Generate Positions" button to GT indicator if count is low
5. **Unified settings page** - Could consolidate GT config with other project settings

## References

- Ground Truth Simplified Integration spec: `specs/ground-truth-simplified-integration/02-specification.md`
- Related implementation: `specs/ground-truth-simplified-integration/04-implementation.md`
- AccuracyToolsPanel reference: `components/artifacts/AccuracyToolsPanel.tsx`
