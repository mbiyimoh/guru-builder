# Wizard UX Improvements Specification

## Status
**Draft** | Created: 2025-12-19 | Author: Claude Code

## Overview

This specification addresses three interconnected UX improvements to the Guru Builder wizard flow:

1. **Layout Width Fix** - Expand wizard pages from `max-w-4xl` to `max-w-7xl` for better desktop utilization
2. **Research Plan Bug Fix** - Fix the issue where research plans never appear after chat conversation
3. **Dashboard-Centric UX** - Transform post-profile flow from linear wizard to dashboard-centric navigation

These changes will significantly improve the user experience for domain experts creating AI teaching assistants.

## Background/Problem Statement

### Issue 1: Wasted Screen Space
The wizard pages use `max-w-4xl` (896px) constraint, wasting 40-60% of available screen space on desktop displays. The `ResearchChatAssistant` component already has a two-column layout that would benefit from more width.

### Issue 2: Research Plans Never Appear
Users report: "Everything worked pretty well all the way up until I was trying to get the research assistant to create a research plan for me. It went back-and-forth with me in the chat, but no research plan ever appeared."

**Root Cause**: The API prompt at `app/api/research/refine-plan/route.ts:64-68` tells GPT-4o:
```
"updatedPlan": { ... } or null if no changes
```

On the first user message, there's no existing plan to "change," so GPT interprets "no changes needed" and returns `null`.

### Issue 3: Forced Linear Progression
After creating a guru profile, users are forced through a linear wizard:
```
Define Guru → Build Knowledge → Readiness Check → Create Content
```

The desired UX is cyclical/dashboard-centric:
- View full profile at any time
- Run research iteratively
- Check readiness scores
- Generate content
- Return to any activity without linear constraints

## Goals

- Fix the research plan generation bug so plans appear on first message
- Utilize full desktop screen width (max-w-7xl) across wizard pages
- Provide non-linear access to all activities via a project dashboard
- Show a "Getting Started" checklist for new projects
- Display readiness-based recommendations that show ongoing improvement opportunities
- Maintain mobile responsiveness with practical MVP approaches

## Non-Goals

- Mobile-specific optimizations (deferred to future work)
- Exposing admin view to typical users (manual basis for select individuals)
- Changes to the profile creation wizard itself (profile flow remains linear)
- Changing the underlying data models or APIs (except the prompt fix)
- Supporting multiple concurrent research runs from the dashboard

## Technical Dependencies

### External Libraries (Already Installed)
- **Next.js 15** - App Router, dynamic imports
- **React 19** - Client components, hooks
- **Tailwind CSS** - Layout utilities, responsive design
- **shadcn/ui** - Card, Button, Badge, Progress components
- **Lucide React** - Icons

### Existing APIs Required
- `GET /api/projects/[id]/readiness` - Readiness scoring
- `GET /api/projects/[id]/guru-profile` - Profile data
- `POST /api/research/refine-plan` - Research plan refinement (to be modified)
- `GET /api/research-runs` - Research run history

## Detailed Design

### Phase 1: Research Plan Bug Fix (Critical)

**File**: `app/api/research/refine-plan/route.ts`

**Current Prompt (Lines 41-68)**:
```typescript
const SYSTEM_PROMPT = `You are a research planning assistant...

Output format (JSON):
{
  "reply": "Your conversational response...",
  "updatedPlan": { ... } or null if no changes
}`;
```

**Updated Prompt**:
```typescript
const SYSTEM_PROMPT = `You are a research planning assistant helping users create effective research plans for building AI teaching assistants (gurus).

Your role is to:
1. Understand what knowledge the user wants their guru to have
2. Suggest specific, actionable research queries
3. Identify focus areas that will yield the best learning content
4. Recommend appropriate research depth based on scope

When creating or refining a plan, consider:
- The user's guru profile and teaching domain
- What pedagogical dimensions need coverage (Foundations, Progression, Mistakes, Examples, Nuance, Practice)
- Specificity of queries for better results
- Realistic scope for the chosen depth level

DEPTH GUIDELINES:
- QUICK: 2-3 minutes, 1-2 queries, narrow focus (good for quick validation or specific gaps)
- MODERATE: 5-7 minutes, 3-5 queries, balanced coverage (recommended for most research)
- DEEP: 10-15 minutes, 5-8 queries, comprehensive exploration (for building foundational knowledge)

Always respond with:
1. A conversational message explaining your suggestions
2. A complete research plan

IMPORTANT: Always include a complete research plan in your response. Create an initial plan based on the user's first message. Only return null for updatedPlan if the user explicitly says they don't want a plan or want to cancel planning.

Output format (JSON):
{
  "reply": "Your conversational response...",
  "updatedPlan": {
    "title": "Research plan title",
    "objective": "What this research aims to discover",
    "queries": ["query1", "query2", ...],
    "focusAreas": ["area1", "area2", ...],
    "expectedOutcomes": ["outcome1", "outcome2", ...],
    "depth": "QUICK" | "MODERATE" | "DEEP"
  }
}`;
```

**Key Changes**:
1. Changed "if changes are needed" to "Always include a complete research plan"
2. Added explicit instruction: "Create an initial plan based on the user's first message"
3. Clarified null is only for explicit cancellation
4. Included full schema in output format for clarity

### Phase 2: Layout Width Expansion (Quick Win)

**Files to Modify**:

| File | Current | New |
|------|---------|-----|
| `app/projects/new/research/page.tsx:341` | `max-w-4xl` | `max-w-7xl` |
| `app/projects/new/research/page.tsx:373` | `max-w-4xl` | `max-w-7xl` |
| `app/projects/new/research/page.tsx:401` | `max-w-4xl` | `max-w-7xl` |
| `app/projects/new/readiness/page.tsx` | `max-w-4xl` | `max-w-7xl` |

**Pattern**:
```tsx
// Before
<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

// After
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
```

**Note**: Profile page (`max-w-5xl`) can remain as-is since it's form-focused and doesn't benefit from extra width.

### Phase 3: Dashboard-Centric UX (Major Change)

#### 3.1 New Route Structure

**New File**: `app/projects/[id]/dashboard/page.tsx`

This becomes the primary destination after profile creation. The existing `/projects/[id]/page.tsx` becomes the "Advanced" view accessible only to admins.

#### 3.2 Redirect Update

**File**: `app/projects/new/profile/page.tsx:86`

```typescript
// Before
router.push(`/projects/new/research?projectId=${project.id}`);

// After
router.push(`/projects/${project.id}/dashboard`);
```

#### 3.3 Dashboard Component Architecture

```
app/projects/[id]/dashboard/
└── page.tsx                    # Main dashboard page (server component)

components/dashboard/
├── SimplifiedDashboard.tsx     # Main layout wrapper (client component)
├── ProfileSummaryCard.tsx      # Collapsible profile display
├── ReadinessOverview.tsx       # Score + gaps visualization
├── ActivityTiles.tsx           # Research/Readiness/Create tiles
├── GettingStartedChecklist.tsx # First-time user guidance
├── RecommendedNextSteps.tsx    # AI-driven suggestions
└── RecentActivity.tsx          # Activity feed
```

#### 3.4 Dashboard Page Implementation

```tsx
// app/projects/[id]/dashboard/page.tsx
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { SimplifiedDashboard } from '@/components/dashboard/SimplifiedDashboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      currentProfile: true,
      researchRuns: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { recommendations: true } },
        },
      },
      guruArtifacts: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!project) {
    notFound();
  }

  if (project.userId !== user.id) {
    redirect('/projects');
  }

  // Determine if this is a new project (for Getting Started)
  const isNewProject = !project.currentProfile &&
                       project.researchRuns.length === 0;

  return (
    <SimplifiedDashboard
      project={project}
      isNewProject={isNewProject}
    />
  );
}
```

#### 3.5 SimplifiedDashboard Component

```tsx
// components/dashboard/SimplifiedDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { ReadinessOverview } from './ReadinessOverview';
import { ActivityTiles } from './ActivityTiles';
import { GettingStartedChecklist } from './GettingStartedChecklist';
import { RecommendedNextSteps } from './RecommendedNextSteps';
import { RecentActivity } from './RecentActivity';
import type { ReadinessScore } from '@/lib/wizard/types';

interface Project {
  id: string;
  name: string;
  description: string | null;
  currentProfile: {
    id: string;
    profileData: any;
  } | null;
  researchRuns: Array<{
    id: string;
    status: string;
    instructions: string;
    createdAt: Date;
    _count: { recommendations: number };
  }>;
  guruArtifacts: Array<{
    id: string;
    type: string;
    version: number;
    createdAt: Date;
    verificationStatus: string | null;
  }>;
}

interface SimplifiedDashboardProps {
  project: Project;
  isNewProject: boolean;
}

export function SimplifiedDashboard({ project, isNewProject }: SimplifiedDashboardProps) {
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(true);

  useEffect(() => {
    async function fetchReadiness() {
      try {
        const response = await fetch(`/api/projects/${project.id}/readiness`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setReadiness(data.score);
          }
        }
      } catch (error) {
        console.error('Failed to fetch readiness:', error);
      } finally {
        setIsLoadingReadiness(false);
      }
    }

    fetchReadiness();
  }, [project.id]);

  const hasProfile = !!project.currentProfile;
  const hasResearch = project.researchRuns.length > 0;
  const hasArtifacts = project.guruArtifacts.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/projects"
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">{project.name}</h1>
        {project.description && (
          <p className="mt-2 text-gray-600">{project.description}</p>
        )}
      </div>

      {/* Getting Started Checklist (for new projects) */}
      {isNewProject && (
        <GettingStartedChecklist
          projectId={project.id}
          hasProfile={hasProfile}
          hasResearch={hasResearch}
          hasArtifacts={hasArtifacts}
        />
      )}

      {/* Profile Summary */}
      {hasProfile && (
        <ProfileSummaryCard
          projectId={project.id}
          profile={project.currentProfile!.profileData}
        />
      )}

      {/* Readiness Overview */}
      <ReadinessOverview
        readiness={readiness}
        isLoading={isLoadingReadiness}
      />

      {/* Activity Tiles */}
      <ActivityTiles
        projectId={project.id}
        researchCount={project.researchRuns.length}
        artifactCount={project.guruArtifacts.length}
        readinessScore={readiness?.overall ?? 0}
      />

      {/* Recommended Next Steps */}
      <RecommendedNextSteps
        readiness={readiness}
        hasProfile={hasProfile}
        hasResearch={hasResearch}
        hasArtifacts={hasArtifacts}
        projectId={project.id}
      />

      {/* Recent Activity */}
      <RecentActivity
        projectId={project.id}
        researchRuns={project.researchRuns}
        artifacts={project.guruArtifacts}
      />
    </div>
  );
}
```

#### 3.6 Activity Tiles Component

```tsx
// components/dashboard/ActivityTiles.tsx
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, BarChart3, Sparkles } from 'lucide-react';

interface ActivityTilesProps {
  projectId: string;
  researchCount: number;
  artifactCount: number;
  readinessScore: number;
}

export function ActivityTiles({
  projectId,
  researchCount,
  artifactCount,
  readinessScore,
}: ActivityTilesProps) {
  const tiles = [
    {
      title: 'Research',
      icon: Search,
      color: 'blue',
      stats: `${researchCount} sessions`,
      description: 'Discover knowledge for your guru',
      href: `/projects/new/research?projectId=${projectId}`,
      action: 'Run Research',
    },
    {
      title: 'Readiness',
      icon: BarChart3,
      color: 'green',
      stats: `${readinessScore}% score`,
      description: 'Check knowledge coverage',
      href: `/projects/new/readiness?projectId=${projectId}`,
      action: 'View Details',
    },
    {
      title: 'Create Content',
      icon: Sparkles,
      color: 'purple',
      stats: `${artifactCount} artifacts`,
      description: 'Generate teaching materials',
      href: `/projects/new/artifacts?projectId=${projectId}`,
      action: 'Generate More',
    },
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: 'text-purple-600',
      button: 'bg-purple-600 hover:bg-purple-700',
    },
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Activities</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiles.map((tile) => {
          const colors = colorClasses[tile.color as keyof typeof colorClasses];
          const Icon = tile.icon;

          return (
            <Card
              key={tile.title}
              className={`${colors.bg} ${colors.border} hover:shadow-md transition-shadow`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white`}>
                    <Icon className={`h-5 w-5 ${colors.icon}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{tile.title}</CardTitle>
                    <CardDescription className="text-sm">{tile.stats}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{tile.description}</p>
                <Link href={tile.href}>
                  <Button className={`w-full ${colors.button} text-white`}>
                    {tile.action}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

#### 3.7 Getting Started Checklist

```tsx
// components/dashboard/GettingStartedChecklist.tsx
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle, Circle, ArrowRight } from 'lucide-react';

interface GettingStartedChecklistProps {
  projectId: string;
  hasProfile: boolean;
  hasResearch: boolean;
  hasArtifacts: boolean;
}

export function GettingStartedChecklist({
  projectId,
  hasProfile,
  hasResearch,
  hasArtifacts,
}: GettingStartedChecklistProps) {
  const steps = [
    {
      id: 'profile',
      label: 'Define your guru profile',
      description: 'Tell us about your teaching domain and audience',
      completed: hasProfile,
      href: `/projects/new/profile?projectId=${projectId}`,
    },
    {
      id: 'research',
      label: 'Run your first research',
      description: 'Discover knowledge to teach your audience',
      completed: hasResearch,
      href: `/projects/new/research?projectId=${projectId}`,
    },
    {
      id: 'artifacts',
      label: 'Create teaching content',
      description: 'Generate mental models, curriculum, or drills',
      completed: hasArtifacts,
      href: `/projects/new/artifacts?projectId=${projectId}`,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  if (allComplete) {
    return null; // Hide when all steps complete
  }

  return (
    <Card className="mb-8 border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-blue-900">
            Getting Started
          </CardTitle>
          <span className="text-sm text-blue-700">
            {completedCount} of {steps.length} complete
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <Link
              key={step.id}
              href={step.href}
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                step.completed
                  ? 'bg-white/50'
                  : 'bg-white hover:bg-blue-100'
              }`}
            >
              {step.completed ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-blue-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 truncate">{step.description}</p>
              </div>
              {!step.completed && (
                <ArrowRight className="h-4 w-4 text-blue-600 flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 3.8 Readiness Overview Component

```tsx
// components/dashboard/ReadinessOverview.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react';
import type { ReadinessScore } from '@/lib/wizard/types';

interface ReadinessOverviewProps {
  readiness: ReadinessScore | null;
  isLoading: boolean;
}

export function ReadinessOverview({ readiness, isLoading }: ReadinessOverviewProps) {
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardContent className="py-8">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-16 w-16 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-2 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!readiness) {
    return (
      <Card className="mb-8 border-gray-200">
        <CardContent className="py-8 text-center text-gray-500">
          <p>Complete your guru profile to see readiness scoring</p>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = readiness.overall >= 80
    ? 'text-green-600'
    : readiness.overall >= 60
      ? 'text-amber-600'
      : 'text-red-600';

  const progressColor = readiness.overall >= 80
    ? 'bg-green-500'
    : readiness.overall >= 60
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Readiness Score</CardTitle>
          <Badge variant={readiness.overall >= 60 ? 'default' : 'destructive'}>
            {readiness.overall >= 80 ? 'Ready' : readiness.overall >= 60 ? 'Almost Ready' : 'Needs Work'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 mb-6">
          <div className={`text-4xl font-bold ${scoreColor}`}>
            {readiness.overall}%
          </div>
          <div className="flex-1">
            <Progress value={readiness.overall} className={`h-3 ${progressColor}`} />
            <p className="text-sm text-gray-500 mt-1">
              Profile: {readiness.profile}% | Knowledge: {readiness.knowledge}%
            </p>
          </div>
        </div>

        {/* Gaps Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {readiness.criticalGaps.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Critical Gaps</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {readiness.criticalGaps.map((gap) => (
                  <Badge key={gap} variant="destructive" className="text-xs">
                    {gap}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {readiness.suggestedGaps.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Suggested Improvements</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {readiness.suggestedGaps.map((gap) => (
                  <Badge key={gap} variant="outline" className="text-xs border-amber-400 text-amber-700">
                    {gap}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {readiness.criticalGaps.length === 0 && readiness.suggestedGaps.length === 0 && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 col-span-full">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Great coverage! Consider running more research to deepen expertise.
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 3.9 Recommended Next Steps Component

```tsx
// components/dashboard/RecommendedNextSteps.tsx
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search, Sparkles, User } from 'lucide-react';
import type { ReadinessScore } from '@/lib/wizard/types';

interface RecommendedNextStepsProps {
  readiness: ReadinessScore | null;
  hasProfile: boolean;
  hasResearch: boolean;
  hasArtifacts: boolean;
  projectId: string;
}

export function RecommendedNextSteps({
  readiness,
  hasProfile,
  hasResearch,
  hasArtifacts,
  projectId,
}: RecommendedNextStepsProps) {
  // Build recommendations based on current state
  const recommendations: Array<{
    id: string;
    icon: typeof Search;
    title: string;
    description: string;
    href: string;
    priority: 'high' | 'medium' | 'low';
  }> = [];

  // Priority 1: Complete profile if missing
  if (!hasProfile) {
    recommendations.push({
      id: 'create-profile',
      icon: User,
      title: 'Create your guru profile',
      description: 'Define your teaching domain and target audience',
      href: `/projects/new/profile?projectId=${projectId}`,
      priority: 'high',
    });
  }

  // Priority 2: Address critical gaps
  if (readiness?.criticalGaps && readiness.criticalGaps.length > 0) {
    readiness.criticalGaps.forEach((gap) => {
      recommendations.push({
        id: `gap-${gap}`,
        icon: Search,
        title: `Research "${gap}"`,
        description: `Address this critical gap to improve readiness`,
        href: `/projects/new/research?projectId=${projectId}&focus=${gap}`,
        priority: 'high',
      });
    });
  }

  // Priority 3: First research if none yet
  if (hasProfile && !hasResearch) {
    recommendations.push({
      id: 'first-research',
      icon: Search,
      title: 'Run your first research session',
      description: 'Discover knowledge to build your guru',
      href: `/projects/new/research?projectId=${projectId}`,
      priority: 'medium',
    });
  }

  // Priority 4: Create artifacts if ready
  if (readiness && readiness.overall >= 60 && !hasArtifacts) {
    recommendations.push({
      id: 'create-artifacts',
      icon: Sparkles,
      title: 'Generate teaching content',
      description: 'Your readiness score is high enough to create content',
      href: `/projects/new/artifacts?projectId=${projectId}`,
      priority: 'medium',
    });
  }

  // Priority 5: Suggested improvements
  if (readiness?.suggestedGaps && readiness.suggestedGaps.length > 0) {
    readiness.suggestedGaps.slice(0, 2).forEach((gap) => {
      recommendations.push({
        id: `suggest-${gap}`,
        icon: Search,
        title: `Improve "${gap}" coverage`,
        description: `Optional research to enhance your guru`,
        href: `/projects/new/research?projectId=${projectId}&focus=${gap}`,
        priority: 'low',
      });
    });
  }

  if (recommendations.length === 0) {
    return null;
  }

  // Show top 3 recommendations
  const topRecommendations = recommendations.slice(0, 3);

  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-blue-500',
  };

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recommended Next Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topRecommendations.map((rec) => {
            const Icon = rec.icon;
            return (
              <Link
                key={rec.id}
                href={rec.href}
                className={`flex items-center gap-4 p-4 rounded-lg border-l-4 ${priorityColors[rec.priority]} bg-gray-50 hover:bg-gray-100 transition-colors`}
              >
                <Icon className="h-5 w-5 text-gray-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                  <p className="text-xs text-gray-500">{rec.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 3.10 Profile Summary Card

```tsx
// components/dashboard/ProfileSummaryCard.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit } from 'lucide-react';
import type { GuruProfileData } from '@/lib/guruProfile/types';

interface ProfileSummaryCardProps {
  projectId: string;
  profile: GuruProfileData;
}

export function ProfileSummaryCard({ projectId, profile }: ProfileSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Guru Profile</CardTitle>
          <div className="flex items-center gap-2">
            <Link href={`/projects/new/profile?projectId=${projectId}&edit=true`}>
              <Button variant="outline" size="sm" className="gap-1">
                <Edit className="h-3 w-3" />
                Edit
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  More
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Always visible summary */}
        <div className="space-y-2">
          <div>
            <span className="text-sm font-medium text-gray-500">Domain:</span>
            <span className="text-sm text-gray-900 ml-2">{profile.domainExpertise}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Audience:</span>
            <span className="text-sm text-gray-900 ml-2">{profile.audienceDescription}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Style:</span>
            <span className="text-sm text-gray-900 ml-2">{profile.pedagogicalApproach}</span>
          </div>
        </div>

        {/* Expandable details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-2">
            {profile.specificTopics && (
              <div>
                <span className="text-sm font-medium text-gray-500">Topics:</span>
                <span className="text-sm text-gray-900 ml-2">{profile.specificTopics}</span>
              </div>
            )}
            {profile.audienceLevel && (
              <div>
                <span className="text-sm font-medium text-gray-500">Audience Level:</span>
                <span className="text-sm text-gray-900 ml-2">{profile.audienceLevel}</span>
              </div>
            )}
            {profile.tone && (
              <div>
                <span className="text-sm font-medium text-gray-500">Tone:</span>
                <span className="text-sm text-gray-900 ml-2">{profile.tone}</span>
              </div>
            )}
            {profile.communicationStyle && (
              <div>
                <span className="text-sm font-medium text-gray-500">Communication:</span>
                <span className="text-sm text-gray-900 ml-2">{profile.communicationStyle}</span>
              </div>
            )}
            {profile.uniquePerspective && (
              <div>
                <span className="text-sm font-medium text-gray-500">Unique Perspective:</span>
                <span className="text-sm text-gray-900 ml-2">{profile.uniquePerspective}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### 3.11 Recent Activity Component

```tsx
// components/dashboard/RecentActivity.tsx
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface RecentActivityProps {
  projectId: string;
  researchRuns: Array<{
    id: string;
    status: string;
    instructions: string;
    createdAt: Date;
    _count: { recommendations: number };
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    version: number;
    createdAt: Date;
    verificationStatus: string | null;
  }>;
}

export function RecentActivity({ projectId, researchRuns, artifacts }: RecentActivityProps) {
  // Combine and sort by date
  const activities = [
    ...researchRuns.map((run) => ({
      id: `research-${run.id}`,
      type: 'research' as const,
      title: run.instructions.slice(0, 60) + (run.instructions.length > 60 ? '...' : ''),
      status: run.status,
      detail: `${run._count.recommendations} recommendations`,
      date: new Date(run.createdAt),
      href: `/projects/${projectId}/research/${run.id}`,
    })),
    ...artifacts.map((artifact) => ({
      id: `artifact-${artifact.id}`,
      type: 'artifact' as const,
      title: `${artifact.type} v${artifact.version}`,
      status: artifact.verificationStatus || 'CREATED',
      detail: artifact.type,
      date: new Date(artifact.createdAt),
      href: `/projects/${projectId}/artifacts/${artifact.type.toLowerCase()}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

  if (activities.length === 0) {
    return null;
  }

  const statusIcons = {
    COMPLETED: <CheckCircle className="h-4 w-4 text-green-500" />,
    RUNNING: <Clock className="h-4 w-4 text-blue-500 animate-pulse" />,
    FAILED: <AlertCircle className="h-4 w-4 text-red-500" />,
    VERIFIED: <CheckCircle className="h-4 w-4 text-green-500" />,
    NEEDS_REVIEW: <AlertCircle className="h-4 w-4 text-amber-500" />,
    CREATED: <CheckCircle className="h-4 w-4 text-gray-400" />,
  };

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => (
            <Link
              key={activity.id}
              href={activity.href}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {activity.type === 'research' ? (
                <Search className="h-5 w-5 text-blue-500 flex-shrink-0" />
              ) : (
                <Sparkles className="h-5 w-5 text-purple-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.title}
                </p>
                <p className="text-xs text-gray-500">
                  {activity.detail} • {activity.date.toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {statusIcons[activity.status as keyof typeof statusIcons] || null}
                <Badge variant="outline" className="text-xs">
                  {activity.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

## User Experience

### Before (Linear Wizard)
1. User creates profile → forced to research page
2. User completes research → forced to readiness page
3. User checks readiness → forced to artifacts page
4. No way to return to activities without using browser back button

### After (Dashboard-Centric)
1. User creates profile → lands on dashboard
2. Dashboard shows all activities as clickable tiles
3. User can jump to any activity in any order
4. Getting Started checklist guides new users
5. Recommended Next Steps adapt based on readiness gaps
6. Recent Activity shows history and quick access

### Key UX Improvements
- **Non-linear navigation**: Activities accessible in any order
- **Contextual guidance**: Recommendations based on actual state
- **Progress visibility**: Readiness score always visible
- **Continuous improvement**: Even 100% readiness shows "deepen expertise" suggestion
- **Reduced cognitive load**: Simpler interface than admin view

## Testing Strategy

### Unit Tests

```typescript
// __tests__/dashboard/ActivityTiles.test.tsx
describe('ActivityTiles', () => {
  it('renders all three activity tiles', () => {
    // Validates the three tiles are present
  });

  it('displays correct stats for each tile', () => {
    // Validates stats are passed through correctly
  });

  it('links to correct routes', () => {
    // Validates href attributes
  });
});
```

### Integration Tests

```typescript
// __tests__/dashboard/SimplifiedDashboard.integration.test.tsx
describe('SimplifiedDashboard', () => {
  it('fetches and displays readiness score', () => {
    // Mock API, verify display
  });

  it('shows Getting Started for new projects', () => {
    // Test conditional rendering
  });

  it('hides Getting Started when all steps complete', () => {
    // Test state transitions
  });
});
```

### E2E Tests

```typescript
// tests/dashboard-ux.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard UX Flow', () => {
  test('redirects to dashboard after profile creation', async ({ page }) => {
    // Purpose: Verify the redirect change works correctly
    // This test fails if profile save redirects to /projects/new/research
    await page.goto('/projects/new/profile');
    // ... complete profile creation
    await expect(page).toHaveURL(/\/projects\/[^/]+\/dashboard/);
  });

  test('can navigate to research from dashboard', async ({ page }) => {
    // Purpose: Verify non-linear navigation works
    await page.goto('/projects/test-id/dashboard');
    await page.click('text=Run Research');
    await expect(page).toHaveURL(/\/research/);
  });

  test('shows recommendations based on readiness', async ({ page }) => {
    // Purpose: Verify adaptive recommendations
    // This test would fail if recommendations don't update with state
    await page.goto('/projects/test-id/dashboard');
    await expect(page.locator('text=Critical Gaps')).toBeVisible();
  });
});
```

### Research Plan Bug Fix Test

```typescript
// tests/research-plan-bug.spec.ts
test('generates research plan on first message', async ({ page }) => {
  // Purpose: Verify the bug fix - plans must appear on first message
  // This test FAILS if updatedPlan is null after first message
  await page.goto('/projects/new/research?projectId=test-id');

  await page.fill('textarea', 'I want to research backgammon opening principles');
  await page.click('button:has-text("Send")');

  // Wait for response
  await page.waitForSelector('.research-plan', { timeout: 30000 });

  // Verify plan appears
  await expect(page.locator('.research-plan')).toBeVisible();
  await expect(page.locator('.research-plan')).toContainText('Title');
});
```

## Performance Considerations

### Dashboard Data Loading
- **Initial load**: Server component fetches core data (project, profile, recent items)
- **Readiness score**: Client-side fetch with loading state (async, non-blocking)
- **Caching**: Readiness API already has 5-minute cache

### Layout Width Change
- **No performance impact**: CSS-only change
- **LCP improvement**: Wider content reduces vertical scrolling

### Research Plan Fix
- **Marginal increase**: Always generating plan adds ~100-200 tokens per response
- **Acceptable tradeoff**: Fixing UX bug worth minor token increase

## Security Considerations

### Dashboard Access
- Server component verifies user ownership before rendering
- Redirects to `/projects` if user doesn't own project
- No additional API endpoints exposed

### Research Plan API
- No security changes required
- Existing authentication and project ownership checks remain

## Documentation

### Files to Update
- `developer-guides/simplified-frontend-wrapper.md` - Add dashboard section
- `CLAUDE.md` - Add dashboard route to Simplified Frontend Wrapper section

### New Documentation
- Component JSDoc comments (inline)
- README in `components/dashboard/` explaining component architecture

## Implementation Phases

### Phase 1: Research Plan Bug Fix (Critical)
- Modify `app/api/research/refine-plan/route.ts` SYSTEM_PROMPT
- Add E2E test to verify fix
- **Files**: 1 modified

### Phase 2: Layout Width Expansion
- Update `max-w-4xl` to `max-w-7xl` in wizard pages
- **Files**: 2-3 modified

### Phase 3: Dashboard Infrastructure
- Create `app/projects/[id]/dashboard/page.tsx`
- Create `components/dashboard/SimplifiedDashboard.tsx`
- Update redirect in profile page
- **Files**: 3 new, 1 modified

### Phase 4: Dashboard Components
- Create `ActivityTiles.tsx`
- Create `GettingStartedChecklist.tsx`
- Create `ReadinessOverview.tsx`
- Create `RecommendedNextSteps.tsx`
- Create `ProfileSummaryCard.tsx`
- Create `RecentActivity.tsx`
- **Files**: 6 new

### Phase 5: Testing & Polish
- Add E2E tests for dashboard flow
- Add unit tests for components
- Update documentation
- **Files**: 2-3 new test files

## Open Questions

1. **Research modal vs page**: Should research open in a modal from the dashboard, or navigate to the existing research page?
   - **Current recommendation**: Navigate to existing page (simpler, less code)

2. **Wizard pages access**: Should users still be able to access `/projects/new/research` directly, or should it redirect to dashboard?
   - **Current recommendation**: Keep accessible (backward compatibility, shared links)

3. **Progress indicator design**: The user mentioned wanting something that shows "ongoing improvement needs" even after all steps are done. The current spec addresses this with the readiness score + suggestions, but is this sufficient?

## References

- Ideation document: `specs/wizard-ux-improvements/01-ideation.md`
- Simplified Frontend Wrapper spec: `specs/simplified-frontend-wrapper/02-specification.md`
- Existing dashboard: `app/projects/[id]/page.tsx`
- Readiness types: `lib/wizard/types.ts`
