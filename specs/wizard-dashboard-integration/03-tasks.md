# Task Breakdown: Wizard-Dashboard Integration

**Generated**: 2025-12-20
**Source**: specs/wizard-dashboard-integration/02-specification.md
**Last Decompose**: 2025-12-20
**Mode**: Full

---

## Overview

Migrate wizard functionality from `/projects/new/*` routes to dashboard-anchored `/projects/[id]/*` routes with full-width layouts, enabling non-linear access to all sections.

## Execution Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|------------------------|
| Phase 1: Core Infrastructure | 4 tasks | Tasks 1.2, 1.3, 1.4 can run in parallel after 1.1 |
| Phase 2: Link Updates | 4 tasks | Tasks 2.1, 2.2, 2.3 can run in parallel |
| Phase 3: Redirects & Cleanup | 3 tasks | Tasks 3.1, 3.2, 3.3 can run in parallel |
| Phase 4: Polish & Testing | 3 tasks | Tasks 4.1, 4.2 can run in parallel |
| **Total** | **14 tasks** | **High parallelism potential** |

---

## Phase 1: Core Infrastructure

### Task 1.1: Create ProjectPageLayout Component
**Description**: Create shared layout component with breadcrumb navigation for all project sub-pages
**Size**: Small
**Priority**: High (Blocker)
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**Technical Requirements**:
- Full-width container with `max-w-7xl`
- Breadcrumb navigation: Projects > {Project Name} > {Current Page}
- Consistent header with title and description
- Responsive padding and margins

**Implementation**:

Create `components/project/ProjectPageLayout.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface ProjectPageLayoutProps {
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ProjectPageLayout({
  projectId,
  projectName,
  title,
  description,
  children
}: ProjectPageLayoutProps) {
  return (
    <div className="container max-w-7xl mx-auto py-6 px-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/projects" className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {projectName}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-2">{description}</p>
      </header>

      {children}
    </div>
  );
}
```

Create barrel export `components/project/index.ts`:

```typescript
export { ProjectPageLayout } from './ProjectPageLayout';
```

**Acceptance Criteria**:
- [ ] Component renders full-width layout with max-w-7xl
- [ ] Breadcrumb shows correct navigation hierarchy
- [ ] All breadcrumb links navigate correctly
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] TypeScript types are correct

---

### Task 1.2: Create Research Page
**Description**: Create full-width research page at `/projects/[id]/research`
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1 (ProjectPageLayout)
**Can run parallel with**: Task 1.3, Task 1.4

**Technical Requirements**:
- Server component for initial data fetch
- Reuse `ResearchChatAssistant` from wizard
- Include gap suggestions from readiness data
- Show active/completed research runs
- Full-width layout using ProjectPageLayout

**Implementation**:

Create `app/projects/[id]/research/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ResearchPageContent } from './ResearchPageContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResearchPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      currentProfile: true,
      researchRuns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          _count: { select: { recommendations: true } }
        }
      }
    }
  });

  if (!project) {
    redirect('/projects');
  }

  return (
    <ProjectPageLayout
      projectId={id}
      projectName={project.name}
      title="Research Knowledge"
      description="Run research to discover and gather knowledge for your guru"
    >
      <ResearchPageContent
        projectId={id}
        profile={project.currentProfile}
        researchRuns={project.researchRuns}
      />
    </ProjectPageLayout>
  );
}
```

Create `app/projects/[id]/research/ResearchPageContent.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lightbulb, Search } from 'lucide-react';
import { ResearchChatAssistant } from '@/components/wizard/research/ResearchChatAssistant';
import type { GuruProfile, ResearchRun } from '@prisma/client';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';

interface Props {
  projectId: string;
  profile: GuruProfile | null;
  researchRuns: (ResearchRun & { _count: { recommendations: number } })[];
}

export function ResearchPageContent({ projectId, profile, researchRuns }: Props) {
  const [readiness, setReadiness] = useState<{
    score: ReadinessScore;
    dimensions: DimensionCoverage[];
  } | null>(null);

  useEffect(() => {
    async function fetchReadiness() {
      try {
        const res = await fetch(`/api/projects/${projectId}/readiness`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setReadiness({ score: data.score, dimensions: data.dimensions });
          }
        }
      } catch (err) {
        console.error('Failed to fetch readiness:', err);
      }
    }
    fetchReadiness();
  }, [projectId]);

  return (
    <div className="space-y-8">
      {/* Gap Suggestions */}
      {readiness && (readiness.score.criticalGaps.length > 0 || readiness.score.suggestedGaps.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suggested Research Topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Critical Gaps */}
            {readiness.score.criticalGaps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Critical Knowledge Gaps</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {readiness.score.criticalGaps.map(gapKey => {
                    const dim = readiness.dimensions.find(d => d.dimensionKey === gapKey);
                    return (
                      <Card key={gapKey} className="border-red-200 dark:border-red-900">
                        <CardContent className="p-4">
                          <div className="font-medium">{dim?.dimensionName || gapKey}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {dim?.description || 'Research needed'}
                          </div>
                          <Badge variant="destructive" className="mt-2">High Priority</Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggested Gaps */}
            {readiness.score.suggestedGaps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lightbulb className="w-4 h-4" />
                  <span className="font-medium">Recommended Research Areas</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {readiness.score.suggestedGaps.map(gapKey => {
                    const dim = readiness.dimensions.find(d => d.dimensionKey === gapKey);
                    return (
                      <Card key={gapKey} className="border-amber-200 dark:border-amber-900">
                        <CardContent className="p-4">
                          <div className="font-medium">{dim?.dimensionName || gapKey}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {dim?.description || 'Could improve coverage'}
                          </div>
                          <Badge variant="outline" className="mt-2">Suggested</Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Research Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Research Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResearchChatAssistant projectId={projectId} />
        </CardContent>
      </Card>

      {/* Research History */}
      {researchRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Research History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {researchRuns.map(run => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div>
                    <div className="font-medium">{run.title || 'Research Run'}</div>
                    <div className="text-sm text-muted-foreground">
                      {run._count.recommendations} recommendations
                    </div>
                  </div>
                  <Badge variant={run.status === 'COMPLETED' ? 'default' : 'secondary'}>
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Page loads at `/projects/[id]/research`
- [ ] Breadcrumb navigation works correctly
- [ ] Gap suggestions display from readiness data
- [ ] ResearchChatAssistant renders and functions
- [ ] Research history shows past runs
- [ ] Full-width layout applied

---

### Task 1.3: Create Readiness Page
**Description**: Create full-width readiness assessment page at `/projects/[id]/readiness`
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (ProjectPageLayout)
**Can run parallel with**: Task 1.2, Task 1.4

**Technical Requirements**:
- Server component wrapper, client component for data
- Display overall score, profile/knowledge breakdown
- Show dimension coverage with progress bars
- Critical gaps with "Research This" CTAs
- Link to research page for gap filling

**Implementation**:

Create `app/projects/[id]/readiness/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ReadinessPageContent } from './ReadinessPageContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReadinessPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true }
  });

  if (!project) {
    redirect('/projects');
  }

  return (
    <ProjectPageLayout
      projectId={id}
      projectName={project.name}
      title="Readiness Assessment"
      description="Evaluate if your guru is ready for content creation"
    >
      <ReadinessPageContent projectId={id} />
    </ProjectPageLayout>
  );
}
```

Create `app/projects/[id]/readiness/ReadinessPageContent.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';

interface Props {
  projectId: string;
}

export function ReadinessPageContent({ projectId }: Props) {
  const [score, setScore] = useState<ReadinessScore | null>(null);
  const [dimensions, setDimensions] = useState<DimensionCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReadiness() {
      try {
        const res = await fetch(`/api/projects/${projectId}/readiness`);
        if (!res.ok) {
          setError(`Request failed (${res.status})`);
          return;
        }
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
    fetchReadiness();
  }, [projectId]);

  if (loading) {
    return <ReadinessSkeleton />;
  }

  if (error || !score) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{error || 'Unable to load readiness data'}</p>
        </CardContent>
      </Card>
    );
  }

  const isReady = score.overall >= 60 && score.criticalGaps.length === 0;

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card className={isReady ? 'border-green-200' : 'border-amber-200'}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {isReady ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
              Overall Readiness
            </span>
            <span className="text-4xl font-bold">{score.overall}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={score.overall} className="h-4 mb-6" />

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Profile Completeness</div>
              <Progress value={score.profile} className="h-2" />
              <div className="text-sm mt-1">{score.profile}%</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Knowledge Coverage</div>
              <Progress value={score.knowledge} className="h-2" />
              <div className="text-sm mt-1">{score.knowledge}%</div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded bg-muted/50">
            {isReady ? (
              <p className="text-green-700 dark:text-green-400">
                Your guru is ready for content creation! You can generate teaching artifacts now.
              </p>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">
                More research needed before content creation. Address the critical gaps below.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Critical Gaps */}
      {score.criticalGaps.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-700 dark:text-red-400">
              Critical Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {score.criticalGaps.map(gapKey => {
              const dim = dimensions.find(d => d.dimensionKey === gapKey);
              return (
                <div
                  key={gapKey}
                  className="flex items-center justify-between p-4 rounded border border-red-200 bg-red-50 dark:bg-red-950/30"
                >
                  <div>
                    <div className="font-medium">{dim?.dimensionName || gapKey}</div>
                    <div className="text-sm text-muted-foreground">
                      {dim?.confirmedCount || 0} confirmed items
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/projects/${projectId}/research`}>
                      Research This
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Dimension Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dimension Coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dimensions.map(dim => (
            <div key={dim.dimensionKey} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{dim.dimensionName}</span>
                  {dim.isCritical && (
                    <Badge variant="destructive" className="text-xs">Critical</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {dim.confirmedCount} / {dim.totalCount} ({dim.coveragePercent}%)
                </span>
              </div>
              <Progress value={dim.coveragePercent} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}/research`}>
            Add More Research
          </Link>
        </Button>
        <Button asChild disabled={!isReady}>
          <Link href={`/projects/${projectId}/guru`}>
            Continue to Content Creation
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-8">
          <div className="h-8 bg-muted rounded animate-pulse mb-4" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Page loads at `/projects/[id]/readiness`
- [ ] Overall score displays with profile/knowledge breakdown
- [ ] Critical gaps show with research CTAs
- [ ] Dimension coverage displays with progress bars
- [ ] Content creation button disabled when not ready
- [ ] Loading skeleton shows during fetch

---

### Task 1.4: Create Profile Page
**Description**: Create full-width profile editor page at `/projects/[id]/profile`
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (ProjectPageLayout)
**Can run parallel with**: Task 1.2, Task 1.3

**Technical Requirements**:
- Server component wrapper with existing profile data
- Reuse profile editing components from wizard
- Support chat/voice/document input modes
- Save changes and navigate back to dashboard

**Implementation**:

Create `app/projects/[id]/profile/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ProfilePageContent } from './ProfilePageContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { currentProfile: true }
  });

  if (!project) {
    redirect('/projects');
  }

  return (
    <ProjectPageLayout
      projectId={id}
      projectName={project.name}
      title="Guru Profile"
      description="Define your teaching domain, audience, and pedagogical approach"
    >
      <ProfilePageContent
        projectId={id}
        existingProfile={project.currentProfile}
      />
    </ProjectPageLayout>
  );
}
```

Create `app/projects/[id]/profile/ProfilePageContent.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Mic, FileText, Save, ArrowLeft } from 'lucide-react';
import { ProfileChatMode } from '@/components/wizard/profile/ProfileChatMode';
import type { GuruProfile } from '@prisma/client';

interface Props {
  projectId: string;
  existingProfile: GuruProfile | null;
}

export function ProfilePageContent({ projectId, existingProfile }: Props) {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<'chat' | 'voice' | 'document'>('chat');

  const handleProfileSaved = () => {
    router.push(`/projects/${projectId}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Input Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Choose Input Method</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as typeof inputMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat Interview
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Voice Input
              </TabsTrigger>
              <TabsTrigger value="document" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Document Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-6">
              <ProfileChatMode
                projectId={projectId}
                existingProfile={existingProfile}
                onProfileSaved={handleProfileSaved}
              />
            </TabsContent>

            <TabsContent value="voice" className="mt-6">
              <div className="text-center py-12 text-muted-foreground">
                Voice input coming soon
              </div>
            </TabsContent>

            <TabsContent value="document" className="mt-6">
              <div className="text-center py-12 text-muted-foreground">
                Document upload coming soon
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Back Button */}
      <div className="flex justify-start">
        <Button
          variant="outline"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Page loads at `/projects/[id]/profile`
- [ ] Existing profile data pre-populates
- [ ] Input mode tabs work (chat active, others coming soon)
- [ ] Profile chat mode functions correctly
- [ ] Save navigates back to dashboard
- [ ] Back button works

---

## Phase 2: Link Updates

### Task 2.1: Update ReadinessSummary Links
**Description**: Update all links in ReadinessSummary to use new routes
**Size**: Small
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.2, Task 2.3

**Files to modify**: `components/dashboard/ReadinessSummary.tsx`

**Changes**:

```typescript
// Line 106-113: Update critical gap links
<Link
  key={gapKey}
  href={`/projects/${projectId}/research`}  // Changed from /projects/new/research?projectId=
  className="..."
>

// Line 125-133: Update suggested gap links
<Link
  key={gapKey}
  href={`/projects/${projectId}/research`}  // Changed from /projects/new/research?projectId=
  className="..."
>

// Line 149-153: Update "View Full Report" link
<Button asChild variant="ghost" size="sm" className="w-full">
  <Link href={`/projects/${projectId}/readiness`}>  // Changed from /projects/new/readiness?projectId=
    View Full Readiness Report
    <ArrowRight className="w-4 h-4 ml-2" />
  </Link>
</Button>
```

**Acceptance Criteria**:
- [ ] Critical gap clicks navigate to `/projects/[id]/research`
- [ ] Suggested gap clicks navigate to `/projects/[id]/research`
- [ ] "View Full Report" navigates to `/projects/[id]/readiness`

---

### Task 2.2: Update SimplifiedDashboard Links
**Description**: Update navigation buttons and links in SimplifiedDashboard
**Size**: Small
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, Task 2.3

**Files to modify**: `components/dashboard/SimplifiedDashboard.tsx`

**Changes**:

```typescript
// Line 78-80: Update Research button
<Button asChild size="sm">
  <Link href={`/projects/${project.id}/research`}>  // Changed from /projects/new/research?projectId=
    <Search className="w-4 h-4 mr-2" />
    Research
  </Link>
</Button>

// Line 113-114: Update Getting Started research link
<GettingStartedStep
  ...
  href={`/projects/${project.id}/research`}  // Changed from /projects/new/research?projectId=
  ...
/>

// Line 121-122: Update Getting Started profile link
<GettingStartedStep
  ...
  href={`/projects/${project.id}/profile`}  // Changed from /projects/new/profile?projectId=
  ...
/>

// Line 161: Update Profile tile link
href={hasProfile ? `/projects/${project.id}/profile` : `/projects/new/profile?projectId=${project.id}`}
// Note: Keep /projects/new/profile for initial creation when no profile exists
```

**Acceptance Criteria**:
- [ ] Research button navigates to `/projects/[id]/research`
- [ ] Getting Started steps link to new routes
- [ ] Profile tile links correctly based on state
- [ ] All navigation works from dashboard

---

### Task 2.3: Update GettingStartedStep Links
**Description**: Ensure GettingStartedStep component routes are updated
**Size**: Small
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 2.1, Task 2.2

**Files to check**: `components/dashboard/GettingStartedStep.tsx`

This component receives `href` as a prop, so the fix is in SimplifiedDashboard (Task 2.2). Verify the component correctly handles the new route patterns.

**Acceptance Criteria**:
- [ ] Component renders links correctly
- [ ] Disabled state still works
- [ ] Completion checkmarks display properly

---

### Task 2.4: Update ActivityTile Links
**Description**: Update ActivityTile hrefs for research and profile
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 1 complete
**Can run parallel with**: Tasks 2.1-2.3

**Files to modify**: `components/dashboard/SimplifiedDashboard.tsx` (ActivityTile usage)

**Changes**:

```typescript
// Line 143-144: Research tile already points to /projects/[id]/research - verify
<ActivityTile
  ...
  href={`/projects/${project.id}/research`}
  ...
/>

// Line 161-162: Profile tile - update for profile page
<ActivityTile
  ...
  href={hasProfile ? `/projects/${project.id}/profile` : `/projects/new/profile?projectId=${project.id}`}
  ...
/>
```

**Acceptance Criteria**:
- [ ] Research tile links to correct route
- [ ] Profile tile links to new route when profile exists
- [ ] New project creation still works via /projects/new/profile

---

## Phase 3: Redirects & Cleanup

### Task 3.1: Add Research Page Redirect
**Description**: Redirect legacy `/projects/new/research?projectId=X` to new route
**Size**: Small
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 3.2, Task 3.3

**Files to modify**: `app/projects/new/research/page.tsx`

**Implementation**:

Replace the page content with redirect logic:

```typescript
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function LegacyResearchPage({ searchParams }: Props) {
  const params = await searchParams;

  // If projectId exists, redirect to new dashboard-anchored route
  if (params.projectId) {
    redirect(`/projects/${params.projectId}/research`);
  }

  // No projectId means truly new project - redirect to profile creation
  redirect('/projects/new/profile');
}
```

**Acceptance Criteria**:
- [ ] `/projects/new/research?projectId=X` redirects to `/projects/X/research`
- [ ] `/projects/new/research` (no projectId) redirects to profile creation
- [ ] No 404 errors for legacy bookmarks

---

### Task 3.2: Add Readiness Page Redirect
**Description**: Redirect legacy `/projects/new/readiness?projectId=X` to new route
**Size**: Small
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 3.1, Task 3.3

**Files to modify**: `app/projects/new/readiness/page.tsx`

**Implementation**:

```typescript
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function LegacyReadinessPage({ searchParams }: Props) {
  const params = await searchParams;

  if (params.projectId) {
    redirect(`/projects/${params.projectId}/readiness`);
  }

  redirect('/projects/new/profile');
}
```

**Acceptance Criteria**:
- [ ] `/projects/new/readiness?projectId=X` redirects to `/projects/X/readiness`
- [ ] No projectId redirects to profile creation

---

### Task 3.3: Add Artifacts Page Redirect
**Description**: Redirect legacy `/projects/new/artifacts?projectId=X` to new route
**Size**: Small
**Priority**: High
**Dependencies**: Phase 1 complete
**Can run parallel with**: Task 3.1, Task 3.2

**Files to modify**: `app/projects/new/artifacts/page.tsx`

**Implementation**:

```typescript
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function LegacyArtifactsPage({ searchParams }: Props) {
  const params = await searchParams;

  if (params.projectId) {
    redirect(`/projects/${params.projectId}/guru`);
  }

  redirect('/projects/new/profile');
}
```

**Acceptance Criteria**:
- [ ] `/projects/new/artifacts?projectId=X` redirects to `/projects/X/guru`
- [ ] Existing artifact viewing continues to work

---

## Phase 4: Polish & Testing

### Task 4.1: Add Test Chat to Artifacts Page
**Description**: Add GuruTestChat at bottom of artifacts page with exploratory framing
**Size**: Small
**Priority**: Low
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.2

**Files to modify**: Artifacts page (likely `app/projects/[id]/guru/page.tsx`)

**Implementation**:

Add after artifact cards:

```typescript
import { GuruTestChat } from '@/components/wizard/testing/GuruTestChat';

// At bottom of artifacts section
<Card className="mt-8">
  <CardHeader>
    <CardTitle className="text-lg">Explore Your Guru</CardTitle>
    <p className="text-sm text-muted-foreground">
      Want to chat with your guru directly? Try out your guru's knowledge
      and teaching style in a conversation.
    </p>
  </CardHeader>
  <CardContent>
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full">
          Start Conversation
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <GuruTestChat projectId={projectId} />
      </CollapsibleContent>
    </Collapsible>
  </CardContent>
</Card>
```

**Acceptance Criteria**:
- [ ] Test chat appears at bottom of artifacts page
- [ ] Collapsible to save space
- [ ] Intro text explains purpose
- [ ] Chat functionality works

---

### Task 4.2: Add Loading States
**Description**: Add loading skeletons to new pages
**Size**: Small
**Priority**: Medium
**Dependencies**: Phase 3 complete
**Can run parallel with**: Task 4.1

**Files to modify**: Research, Readiness, Profile pages

**Implementation**:

Add loading.tsx files to each route:

`app/projects/[id]/research/loading.tsx`:
```typescript
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ResearchLoading() {
  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
```

Create similar loading.tsx for readiness and profile routes.

**Acceptance Criteria**:
- [ ] Loading skeletons show during page transitions
- [ ] Skeletons match page layout structure
- [ ] No layout shift when content loads

---

### Task 4.3: Write E2E Tests
**Description**: Create Playwright tests for new routes and navigation
**Size**: Medium
**Priority**: High
**Dependencies**: All previous phases complete
**Can run parallel with**: None (final validation)

**Files to create**: `tests/wizard-dashboard-integration.spec.ts`

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Wizard-Dashboard Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to a test project
    await page.goto('/login');
    // ... login steps
  });

  test('dashboard research button navigates to /projects/[id]/research', async ({ page }) => {
    await page.goto('/projects/test-project-id');
    await page.click('text=Research');
    await expect(page).toHaveURL(/\/projects\/test-project-id\/research/);
    await expect(page.locator('nav')).toContainText('Research');
  });

  test('legacy wizard route redirects to dashboard route', async ({ page }) => {
    await page.goto('/projects/new/research?projectId=test-project-id');
    await expect(page).toHaveURL(/\/projects\/test-project-id\/research/);
  });

  test('readiness summary gaps link to research page', async ({ page }) => {
    await page.goto('/projects/test-project-id');
    // Wait for readiness to load
    await page.waitForSelector('[data-testid="readiness-summary"]');
    const gapLink = page.locator('[data-testid="critical-gap-link"]').first();
    if (await gapLink.isVisible()) {
      await gapLink.click();
      await expect(page).toHaveURL(/\/projects\/test-project-id\/research/);
    }
  });

  test('non-linear navigation works', async ({ page }) => {
    const projectId = 'test-project-id';

    // Dashboard -> Readiness
    await page.goto(`/projects/${projectId}`);
    await page.click('text=View Full Readiness Report');
    await expect(page).toHaveURL(/\/readiness/);

    // Readiness -> Profile (via breadcrumb then navigation)
    await page.click(`text=${projectId}`); // breadcrumb
    await page.click('text=Edit Profile');
    await expect(page).toHaveURL(/\/profile/);

    // Profile -> Research
    await page.click('text=Projects'); // breadcrumb
    await page.click(`text=${projectId}`);
    await page.click('text=Research');
    await expect(page).toHaveURL(/\/research/);
  });

  test('breadcrumb navigation works on all pages', async ({ page }) => {
    const projectId = 'test-project-id';

    for (const route of ['research', 'readiness', 'profile']) {
      await page.goto(`/projects/${projectId}/${route}`);

      // Check breadcrumb exists
      await expect(page.locator('nav')).toContainText('Projects');

      // Click project name in breadcrumb
      await page.click(`nav >> text=${projectId}`);
      await expect(page).toHaveURL(`/projects/${projectId}`);
    }
  });
});
```

**Acceptance Criteria**:
- [ ] All navigation tests pass
- [ ] Redirect tests pass
- [ ] Breadcrumb tests pass
- [ ] Non-linear navigation verified
- [ ] No regressions in existing functionality

---

## Dependency Graph

```
Phase 1 (Sequential Start, Then Parallel)
==========================================
Task 1.1 (ProjectPageLayout) ─┬─> Task 1.2 (Research Page)
                              ├─> Task 1.3 (Readiness Page)
                              └─> Task 1.4 (Profile Page)

Phase 2 (All Parallel)
======================
[Phase 1 Complete] ─┬─> Task 2.1 (ReadinessSummary Links)
                    ├─> Task 2.2 (SimplifiedDashboard Links)
                    ├─> Task 2.3 (GettingStartedStep Links)
                    └─> Task 2.4 (ActivityTile Links)

Phase 3 (All Parallel)
======================
[Phase 1 Complete] ─┬─> Task 3.1 (Research Redirect)
                    ├─> Task 3.2 (Readiness Redirect)
                    └─> Task 3.3 (Artifacts Redirect)

Phase 4 (Partial Parallel)
==========================
[Phase 3 Complete] ─┬─> Task 4.1 (Test Chat)
                    └─> Task 4.2 (Loading States)
                          │
                          └─> Task 4.3 (E2E Tests) [Sequential - final validation]
```

## Parallel Execution Opportunities

### Maximum Parallelism Strategy

**Wave 1** (1 task):
- Task 1.1: ProjectPageLayout

**Wave 2** (3 tasks in parallel):
- Task 1.2: Research Page
- Task 1.3: Readiness Page
- Task 1.4: Profile Page

**Wave 3** (7 tasks in parallel):
- Task 2.1: ReadinessSummary Links
- Task 2.2: SimplifiedDashboard Links
- Task 2.3: GettingStartedStep Links
- Task 2.4: ActivityTile Links
- Task 3.1: Research Redirect
- Task 3.2: Readiness Redirect
- Task 3.3: Artifacts Redirect

**Wave 4** (2 tasks in parallel):
- Task 4.1: Test Chat
- Task 4.2: Loading States

**Wave 5** (1 task):
- Task 4.3: E2E Tests

### Summary
- **Total Tasks**: 14
- **Minimum Waves**: 5
- **Maximum Parallel Tasks**: 7 (Wave 3)
- **Critical Path**: 1.1 → 1.2 → 2.1 → 4.3
