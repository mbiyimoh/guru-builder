# Task Breakdown: Wizard UX Improvements

**Generated**: 2025-12-19
**Source**: specs/wizard-ux-improvements/02-specification.md
**Mode**: Full (First-time decompose)
**Last Decompose**: 2025-12-19

---

## Overview

This task breakdown covers three interconnected UX improvements:
1. Research Plan Bug Fix (critical) - Fix prompt to always generate plans
2. Layout Width Expansion (quick win) - Change max-w-4xl to max-w-7xl
3. Dashboard-Centric UX (major change) - New dashboard route and components

**Total Tasks**: 13
**Phases**: 5

---

## Phase 1: Research Plan Bug Fix (Critical)

### Task 1.1: Fix Research Plan SYSTEM_PROMPT
**Description**: Modify the SYSTEM_PROMPT in the refine-plan API to always generate a research plan on first message
**Size**: Small
**Priority**: Critical
**Dependencies**: None
**Can run parallel with**: None (critical path)

**Technical Requirements**:
- File: `app/api/research/refine-plan/route.ts`
- Change prompt to always include a complete research plan
- Only return null for `updatedPlan` if user explicitly cancels

**Implementation**:
Replace the SYSTEM_PROMPT (around lines 41-68) with:

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

**Acceptance Criteria**:
- [ ] SYSTEM_PROMPT updated with new instructions
- [ ] First message in research chat generates a plan (not null)
- [ ] Subsequent messages can still refine the plan
- [ ] Explicit cancellation ("I don't want a plan") returns null

---

## Phase 2: Layout Width Expansion

### Task 2.1: Update Research Page Width
**Description**: Change max-w-4xl to max-w-7xl in the research wizard page
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.2

**Technical Requirements**:
- File: `app/projects/new/research/page.tsx`
- Find all occurrences of `max-w-4xl` (lines ~341, 373, 401)
- Replace with `max-w-7xl`

**Pattern**:
```tsx
// Before
<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

// After
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
```

**Acceptance Criteria**:
- [ ] All `max-w-4xl` references changed to `max-w-7xl`
- [ ] Research page uses full width on desktop
- [ ] Two-column layout (chat + plan) benefits from added width
- [ ] Mobile layout unchanged (Tailwind responsive classes)

### Task 2.2: Update Readiness Page Width
**Description**: Change max-w-4xl to max-w-7xl in the readiness wizard page
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.1

**Technical Requirements**:
- File: `app/projects/new/readiness/page.tsx`
- Find all occurrences of `max-w-4xl`
- Replace with `max-w-7xl`

**Acceptance Criteria**:
- [ ] All `max-w-4xl` references changed to `max-w-7xl`
- [ ] Readiness page uses full width on desktop
- [ ] Mobile layout unchanged

---

## Phase 3: Dashboard Infrastructure

### Task 3.1: Create Dashboard Page Route
**Description**: Create the new dashboard page as the primary post-profile destination
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3.2

**Technical Requirements**:
- New file: `app/projects/[id]/dashboard/page.tsx`
- Server component with data fetching
- Authentication and ownership checks
- Dynamic import for client dashboard component

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Dashboard page accessible at `/projects/[id]/dashboard`
- [ ] Redirects to login if unauthenticated
- [ ] Returns 404 if project doesn't exist
- [ ] Redirects to /projects if user doesn't own project
- [ ] Passes project data to SimplifiedDashboard
- [ ] isNewProject correctly determined

### Task 3.2: Create SimplifiedDashboard Component
**Description**: Create the main dashboard layout wrapper component
**Size**: Large
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3.1

**Technical Requirements**:
- New file: `components/dashboard/SimplifiedDashboard.tsx`
- Client component with state for readiness
- Fetches readiness score on mount
- Conditionally renders Getting Started checklist
- Uses max-w-7xl layout

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Component renders without errors
- [ ] Readiness score fetched and displayed
- [ ] Getting Started checklist shows for new projects
- [ ] Profile summary shows when profile exists
- [ ] All child components receive correct props
- [ ] max-w-7xl layout applied

### Task 3.3: Update Profile Page Redirect
**Description**: Change the redirect after profile creation to go to dashboard instead of research
**Size**: Small
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: None

**Technical Requirements**:
- File: `app/projects/new/profile/page.tsx`
- Change redirect at line ~86

**Implementation**:
```typescript
// Before (line 86)
router.push(`/projects/new/research?projectId=${project.id}`);

// After
router.push(`/projects/${project.id}/dashboard`);
```

**Acceptance Criteria**:
- [ ] Profile creation redirects to dashboard
- [ ] Project ID correctly passed in URL
- [ ] Dashboard loads with new project data

---

## Phase 4: Dashboard Components

### Task 4.1: Create ActivityTiles Component
**Description**: Create the three activity tiles (Research, Readiness, Create)
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.2
**Can run parallel with**: Tasks 4.2, 4.3, 4.4, 4.5, 4.6

**Technical Requirements**:
- New file: `components/dashboard/ActivityTiles.tsx`
- Three color-coded tiles with icons
- Stats display and action buttons
- Links to respective wizard pages

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Three tiles render with correct colors
- [ ] Stats display correctly (session count, score, artifact count)
- [ ] Buttons link to correct wizard pages
- [ ] Responsive grid (1 column mobile, 3 columns desktop)

### Task 4.2: Create GettingStartedChecklist Component
**Description**: Create the checklist for guiding new users
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.2
**Can run parallel with**: Tasks 4.1, 4.3, 4.4, 4.5, 4.6

**Technical Requirements**:
- New file: `components/dashboard/GettingStartedChecklist.tsx`
- Three-step checklist with completion indicators
- Hides when all steps complete
- Links to respective wizard pages

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Three steps render with correct labels
- [ ] Completed steps show checkmark icon
- [ ] Incomplete steps show arrow and are clickable
- [ ] Hides entirely when all steps are complete
- [ ] Progress indicator shows "X of 3 complete"

### Task 4.3: Create ReadinessOverview Component
**Description**: Create the readiness score display with gaps visualization
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.2
**Can run parallel with**: Tasks 4.1, 4.2, 4.4, 4.5, 4.6

**Technical Requirements**:
- New file: `components/dashboard/ReadinessOverview.tsx`
- Score display with color coding (green/amber/red)
- Progress bar visualization
- Critical gaps and suggested improvements sections
- Loading state handling

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Loading skeleton renders during fetch
- [ ] Empty state shows when no readiness data
- [ ] Score displays with correct color coding
- [ ] Progress bar reflects score
- [ ] Critical gaps display in red section
- [ ] Suggested gaps display in amber section
- [ ] Success message shows when no gaps

### Task 4.4: Create RecommendedNextSteps Component
**Description**: Create the adaptive recommendations component
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.2
**Can run parallel with**: Tasks 4.1, 4.2, 4.3, 4.5, 4.6

**Technical Requirements**:
- New file: `components/dashboard/RecommendedNextSteps.tsx`
- Builds recommendations based on project state
- Priority-based ordering (high/medium/low)
- Links to relevant wizard pages with focus parameters

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Recommendations adapt based on project state
- [ ] Critical gaps generate high-priority recommendations
- [ ] Priority colors display correctly (red/amber/blue)
- [ ] Links include focus parameter for gaps
- [ ] Shows top 3 recommendations maximum
- [ ] Returns null when no recommendations

### Task 4.5: Create ProfileSummaryCard Component
**Description**: Create the collapsible profile summary display
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.2
**Can run parallel with**: Tasks 4.1, 4.2, 4.3, 4.4, 4.6

**Technical Requirements**:
- New file: `components/dashboard/ProfileSummaryCard.tsx`
- Always-visible summary (domain, audience, style)
- Expandable details section
- Edit button linking to profile page

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Summary shows domain, audience, style
- [ ] Expand/collapse button works
- [ ] Edit button links to profile page with edit param
- [ ] Expanded view shows additional fields if present
- [ ] Handles missing optional fields gracefully

### Task 4.6: Create RecentActivity Component
**Description**: Create the activity feed showing recent research and artifacts
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 3.2
**Can run parallel with**: Tasks 4.1, 4.2, 4.3, 4.4, 4.5

**Technical Requirements**:
- New file: `components/dashboard/RecentActivity.tsx`
- Combines research runs and artifacts
- Sorts by date, shows most recent 5
- Status icons and badges
- Links to detail pages

**Implementation**:
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

**Acceptance Criteria**:
- [ ] Combines research and artifact data
- [ ] Sorts by most recent first
- [ ] Shows maximum 5 items
- [ ] Returns null when no activities
- [ ] Status icons match status
- [ ] Links navigate to correct detail pages
- [ ] Truncates long titles

---

## Phase 5: Testing & Documentation

### Task 5.1: Add E2E Tests for Dashboard Flow
**Description**: Create Playwright tests for the complete dashboard flow
**Size**: Medium
**Priority**: High
**Dependencies**: Tasks 3.1, 3.2, 3.3, 4.1-4.6
**Can run parallel with**: Task 5.2

**Technical Requirements**:
- New file: `tests/dashboard-ux.spec.ts`
- Test redirect after profile creation
- Test dashboard navigation
- Test adaptive recommendations

**Implementation**:
```typescript
// tests/dashboard-ux.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard UX Flow', () => {
  test('redirects to dashboard after profile creation', async ({ page }) => {
    // Purpose: Verify the redirect change works correctly
    // This test fails if profile save redirects to /projects/new/research
    await page.goto('/projects/new/profile');
    // ... complete profile creation steps
    await expect(page).toHaveURL(/\/projects\/[^/]+\/dashboard/);
  });

  test('can navigate to research from dashboard', async ({ page }) => {
    // Purpose: Verify non-linear navigation works
    await page.goto('/projects/test-id/dashboard');
    await page.click('text=Run Research');
    await expect(page).toHaveURL(/\/research/);
  });

  test('shows Getting Started for new projects', async ({ page }) => {
    // Purpose: Verify new project guidance
    await page.goto('/projects/test-id/dashboard');
    await expect(page.locator('text=Getting Started')).toBeVisible();
  });

  test('hides Getting Started when all steps complete', async ({ page }) => {
    // Purpose: Verify checklist disappears after completion
    // Setup: Project with profile, research, and artifacts
    await page.goto('/projects/completed-id/dashboard');
    await expect(page.locator('text=Getting Started')).not.toBeVisible();
  });
});
```

**Acceptance Criteria**:
- [ ] Redirect test passes
- [ ] Navigation tests pass
- [ ] Getting Started visibility tests pass
- [ ] All tests can fail to reveal real issues

### Task 5.2: Add E2E Test for Research Plan Bug Fix
**Description**: Create Playwright test to verify research plan appears on first message
**Size**: Small
**Priority**: Critical
**Dependencies**: Task 1.1
**Can run parallel with**: Task 5.1

**Technical Requirements**:
- New file: `tests/research-plan-bug.spec.ts`
- Test that first message generates a plan
- Verify plan is visible (not null)

**Implementation**:
```typescript
// tests/research-plan-bug.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Research Plan Generation', () => {
  test('generates research plan on first message', async ({ page }) => {
    // Purpose: Verify the bug fix - plans must appear on first message
    // This test FAILS if updatedPlan is null after first message
    await page.goto('/projects/new/research?projectId=test-id');

    await page.fill('textarea', 'I want to research backgammon opening principles');
    await page.click('button:has-text("Send")');

    // Wait for response
    await page.waitForSelector('[data-testid="research-plan"]', { timeout: 30000 });

    // Verify plan appears
    await expect(page.locator('[data-testid="research-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="research-plan"]')).toContainText('Title');
  });
});
```

**Acceptance Criteria**:
- [ ] Test passes when plan appears
- [ ] Test fails if plan is null/missing
- [ ] Reasonable timeout (30s for GPT response)

---

## Dependency Graph

```
Phase 1 (Critical Bug Fix)
Task 1.1: Fix Research Plan SYSTEM_PROMPT
    └── No dependencies (can start immediately)

Phase 2 (Quick Wins - Parallel)
Task 2.1: Update Research Page Width ──┐
Task 2.2: Update Readiness Page Width ─┴── No dependencies (parallel)

Phase 3 (Dashboard Infrastructure)
Task 3.1: Create Dashboard Page Route ──┐
Task 3.2: Create SimplifiedDashboard ───┴── No dependencies (parallel)
Task 3.3: Update Profile Redirect ───────── Depends on 3.1

Phase 4 (Dashboard Components - All Parallel)
Tasks 4.1-4.6 ─── All depend on 3.2, all parallel

Phase 5 (Testing)
Task 5.1: E2E Tests (Dashboard) ─── Depends on 3.1, 3.2, 3.3, 4.1-4.6
Task 5.2: E2E Test (Research Bug) ─── Depends on 1.1
```

---

## Execution Strategy

### Recommended Order

1. **Start with Phase 1** (Task 1.1) - Critical bug fix, no dependencies
2. **Parallel: Phase 2** (Tasks 2.1, 2.2) - Quick CSS wins
3. **Parallel: Phase 3** (Tasks 3.1, 3.2) - Dashboard infrastructure
4. **After 3.1: Task 3.3** - Redirect update
5. **Parallel: Phase 4** (Tasks 4.1-4.6) - All dashboard components
6. **Parallel: Phase 5** (Tasks 5.1, 5.2) - Testing

### Parallel Execution Opportunities

| Parallel Group | Tasks | Phase |
|----------------|-------|-------|
| Group A | 2.1, 2.2 | Phase 2 |
| Group B | 3.1, 3.2 | Phase 3 |
| Group C | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6 | Phase 4 |
| Group D | 5.1, 5.2 | Phase 5 |

### Critical Path

```
1.1 → 5.2 (Research bug fix → test)
3.1 → 3.3 → 5.1 (Dashboard page → redirect → E2E tests)
```

---

## Summary

| Phase | Tasks | Size | Priority |
|-------|-------|------|----------|
| 1: Bug Fix | 1 | Small | Critical |
| 2: Layout | 2 | Small | High |
| 3: Infrastructure | 3 | Medium | High |
| 4: Components | 6 | Medium | High |
| 5: Testing | 2 | Medium | High |
| **Total** | **13** | | |

---

## Files Created/Modified

### New Files (10)
- `app/projects/[id]/dashboard/page.tsx`
- `components/dashboard/SimplifiedDashboard.tsx`
- `components/dashboard/ActivityTiles.tsx`
- `components/dashboard/GettingStartedChecklist.tsx`
- `components/dashboard/ReadinessOverview.tsx`
- `components/dashboard/RecommendedNextSteps.tsx`
- `components/dashboard/ProfileSummaryCard.tsx`
- `components/dashboard/RecentActivity.tsx`
- `tests/dashboard-ux.spec.ts`
- `tests/research-plan-bug.spec.ts`

### Modified Files (4)
- `app/api/research/refine-plan/route.ts` (SYSTEM_PROMPT)
- `app/projects/new/research/page.tsx` (max-w-4xl → max-w-7xl)
- `app/projects/new/readiness/page.tsx` (max-w-4xl → max-w-7xl)
- `app/projects/new/profile/page.tsx` (redirect update)
