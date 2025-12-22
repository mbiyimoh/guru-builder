# Dashboard Readiness Integration

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-19

---

## Overview

Integrate the existing readiness scoring system into the SimplifiedDashboard so users see their guru's readiness status, knowledge gaps, and prioritized research recommendations without navigating to a separate wizard page.

## Problem Statement

The SimplifiedDashboard currently shows only generic recommendations ("Run your first research") without leveraging the rich readiness intelligence already built into the system:
- Overall readiness score (0-100)
- Profile completeness percentage
- Knowledge coverage percentage
- Critical gaps requiring immediate attention (foundations, progression, mistakes)
- Suggested improvements (examples, nuance, practice)
- Dimension-specific research recommendations

This intelligence exists at `/projects/new/readiness?projectId=X` but is disconnected from the main project dashboard, forcing users to discover it manually.

## Goals

- Display readiness summary (overall score, profile %, knowledge %) on the dashboard
- Show top 2-3 critical gaps as high-priority research recommendations
- Show suggested gaps as medium-priority recommendations
- Link to full readiness report for detailed breakdown
- Replace generic "Run your first research" with dimension-specific suggestions

## Non-Goals

- Redesigning the existing readiness page (`/projects/new/readiness`)
- Changing the readiness scoring algorithm
- Adding new pedagogical dimensions
- Building a custom readiness UI (reuse existing patterns)
- Caching optimizations (existing API has 5-minute cache)
- Mobile-specific layouts beyond existing responsive patterns

---

## Technical Approach

### Integration Pattern: Hybrid (Summary + Link)

**Dashboard shows:** Compact readiness summary card with actionable recommendations
**Links to:** Full readiness report at `/projects/new/readiness?projectId=X`

### Key Files to Modify

| File | Change |
|------|--------|
| `components/dashboard/SimplifiedDashboard.tsx` | Add ReadinessSummary component |
| `components/dashboard/ReadinessSummary.tsx` | **NEW** - Compact readiness display |
| `components/dashboard/RecommendedSteps.tsx` | Replace with readiness-aware recommendations |
| `components/dashboard/index.ts` | Export new component |

### Data Flow

```
SimplifiedDashboard (server component)
    ↓ passes projectId
ReadinessSummary (client component)
    ↓ fetches on mount
GET /api/projects/[id]/readiness (existing endpoint)
    ↓ returns
{ score: ReadinessScore, dimensions: DimensionCoverage[] }
```

---

## Implementation Details

### 1. ReadinessSummary Component

New client component that fetches and displays readiness data:

```tsx
// components/dashboard/ReadinessSummary.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';

interface ReadinessSummaryProps {
  projectId: string;
}

export function ReadinessSummary({ projectId }: ReadinessSummaryProps) {
  const [score, setScore] = useState<ReadinessScore | null>(null);
  const [dimensions, setDimensions] = useState<DimensionCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReadiness();
  }, [projectId]);

  async function fetchReadiness() {
    try {
      const res = await fetch(`/api/projects/${projectId}/readiness`);
      const data = await res.json();
      if (data.success) {
        setScore(data.score);
        setDimensions(data.dimensions);
      } else {
        setError(data.error || 'Failed to fetch readiness');
      }
    } catch (err) {
      setError('Failed to fetch readiness');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <ReadinessSkeletonCard />;
  }

  if (error || !score) {
    return null; // Silently fail - don't block dashboard
  }

  const isReady = score.overall >= 60 && score.criticalGaps.length === 0;

  return (
    <Card className={isReady ? 'border-green-200' : 'border-amber-200'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isReady ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            Guru Readiness
          </CardTitle>
          <div className="text-2xl font-bold">{score.overall}%</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score breakdown */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Profile</div>
            <Progress value={score.profile} className="h-2 mt-1" />
          </div>
          <div>
            <div className="text-muted-foreground">Knowledge</div>
            <Progress value={score.knowledge} className="h-2 mt-1" />
          </div>
        </div>

        {/* Critical gaps as recommendations */}
        {score.criticalGaps.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-red-700">Critical Gaps</div>
            {score.criticalGaps.slice(0, 3).map(gapKey => {
              const dim = dimensions.find(d => d.dimensionKey === gapKey);
              return (
                <Link
                  key={gapKey}
                  href={`/projects/new/research?projectId=${projectId}`}
                  className="flex items-center justify-between p-2 rounded border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <span className="text-sm font-medium">{dim?.dimensionName || gapKey}</span>
                  <Badge variant="destructive" className="text-xs">Research</Badge>
                </Link>
              );
            })}
          </div>
        )}

        {/* Suggested improvements */}
        {score.suggestedGaps.length > 0 && score.criticalGaps.length < 3 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-amber-700">Suggested</div>
            {score.suggestedGaps.slice(0, 2).map(gapKey => {
              const dim = dimensions.find(d => d.dimensionKey === gapKey);
              return (
                <Link
                  key={gapKey}
                  href={`/projects/new/research?projectId=${projectId}`}
                  className="flex items-center justify-between p-2 rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  <span className="text-sm">{dim?.dimensionName || gapKey}</span>
                  <Badge variant="outline" className="text-xs">Optional</Badge>
                </Link>
              );
            })}
          </div>
        )}

        {/* View full report link */}
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href={`/projects/new/readiness?projectId=${projectId}`}>
            View Full Readiness Report
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ReadinessSkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}
```

### 2. SimplifiedDashboard Integration

Add ReadinessSummary to the dashboard layout:

```tsx
// In SimplifiedDashboard.tsx, add import:
import { ReadinessSummary } from './ReadinessSummary';

// Replace the RecommendedSteps section with ReadinessSummary:
{/* Readiness Summary (replaces generic Recommended Steps) */}
{hasProfile && (
  <ReadinessSummary projectId={project.id} />
)}
```

### 3. Update RecommendedSteps

Keep RecommendedSteps for the Getting Started flow (new projects without profile), but remove the generic "Run your first research" for projects that have a profile - let ReadinessSummary handle that.

```tsx
// RecommendedSteps.tsx - only show when no profile exists
export function RecommendedSteps({ hasProfile, projectId }: RecommendedStepsProps) {
  // Early return - ReadinessSummary handles recommendations for projects with profiles
  if (hasProfile) {
    return null;
  }

  // ... existing code for no-profile state
}
```

---

## Testing Approach

### Key Scenarios to Validate

1. **Readiness data loads on dashboard**
   - Navigate to `/projects/[id]`
   - Verify ReadinessSummary card appears with score
   - Verify critical gaps show as red recommendations
   - Verify suggested gaps show as amber recommendations

2. **Links work correctly**
   - Click critical gap → navigates to research with dimension pre-filled
   - Click "View Full Report" → navigates to readiness page

3. **Loading/error states**
   - Dashboard renders without blocking if readiness API fails
   - Skeleton shows while loading

4. **No pedagogical dimensions case**
   - If no dimensions exist, component handles gracefully (empty gaps)

---

## Design Decisions

1. **ReadinessSummary placement**: Replaces the "Recommended Next Steps" section for projects that have a profile. The Getting Started checklist remains for new projects without a profile.

2. **Research links**: Link directly to `/projects/new/research?projectId=X` without dimension pre-selection. The research page already fetches and displays dimension gaps, so users can choose which gap to research from there.

---

## Future Improvements

**Out of scope for this implementation:**

- **Caching optimization**: Add SWR or React Query for smarter caching beyond the 5-min API cache
- **Inline editing**: Let users dismiss/acknowledge gaps directly from dashboard
- **Progress tracking**: Show readiness score trend over time (requires schema change)
- **Dimension tooltips**: Show description of each dimension on hover
- **Animated transitions**: Animate score changes when readiness improves
- **Mobile drawer**: Show readiness in a slide-up drawer on mobile
- **Notification system**: Alert users when readiness drops below threshold
- **Bulk research**: "Research all gaps" button to queue multiple research runs

---

## References

- Existing readiness page: `app/projects/new/readiness/page.tsx`
- Readiness API: `app/api/projects/[id]/readiness/route.ts`
- Scoring logic: `lib/readiness/scoring.ts`
- Types: `lib/wizard/types.ts` (ReadinessScore, DimensionCoverage)
- Pedagogical dimensions seed: `prisma/seeds/pedagogical-dimensions.ts`
- SimplifiedDashboard spec: `specs/simplified-frontend-wrapper/02-specification.md`
