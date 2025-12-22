# Wizard-Dashboard Integration Specification

## Status
**Draft** - Ready for review

## Authors
- Claude Code
- Date: 2025-12-20

## Overview

This specification details the integration of wizard flow features into the dashboard-anchored experience. The goal is to migrate all valuable wizard functionality (research chat, readiness scoring, gap suggestions, artifact generation) from `/projects/new/*` routes to `/projects/[id]/*` routes with full-width layouts, eliminating the narrow-viewport linear wizard while preserving its guided content.

## Background / Problem Statement

### Current State

The existing wizard experience at `/projects/new/*` has two critical issues:

1. **Viewport Constraint**: The wizard layout uses `max-w-4xl` (896px), wasting significant screen real estate on modern displays
2. **Linear Forcing**: Users must progress sequentially through Profile → Research → Readiness → Artifacts, even when they need to jump between sections

Meanwhile, the new SimplifiedDashboard at `/projects/[id]` provides a full-width, non-linear experience but lacks the rich features from the wizard pages.

### Disconnected Experiences

The current architecture creates a fragmented user journey:

```
┌─────────────────────────────────────────────────────────────────┐
│ CURRENT: Two Disconnected Experiences                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dashboard                          Wizard                      │
│  /projects/[id]                     /projects/new/*?projectId=X │
│  ┌──────────────┐                   ┌──────────────┐            │
│  │ max-w-7xl    │  ◀─── gap ───▶    │ max-w-4xl    │            │
│  │ full-width   │                   │ narrow       │            │
│  │ non-linear   │                   │ linear       │            │
│  │ route params │                   │ query params │            │
│  └──────────────┘                   └──────────────┘            │
│                                                                 │
│  User clicks "Research" on dashboard → taken to narrow wizard   │
│  with different navigation paradigm and URL structure           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Root Cause

The wizard was designed before the dashboard existed, treating projects as "in creation" rather than "persistent resources." The `?projectId=X` query param pattern reflects this temporary context model, while the dashboard's `/projects/[id]` pattern treats projects as first-class resources.

## Goals

- Migrate all wizard functionality to dashboard-anchored routes under `/projects/[id]/*`
- Provide full-width layouts (max-w-7xl) on all project sub-pages
- Enable non-linear access to all sections (no forced progression)
- Implement consistent breadcrumb navigation back to dashboard
- Maintain readiness threshold gating (score >= 60, no critical gaps) for content creation
- Eliminate duplicate code between old wizard and new dashboard routes

## Non-Goals

- Mobile-specific redesigns (responsive patterns will naturally work)
- Changes to core API endpoints (they already support project ID)
- Changes to underlying data models
- Publishing functionality (remains "Coming Soon")
- Backward compatibility with existing bookmarks (user confirmed not needed)

## Technical Dependencies

### Framework & Libraries
- **Next.js 15** - App Router with dynamic route segments
- **React 19** - Client/Server component patterns
- **Tailwind CSS** - Responsive layout utilities
- **shadcn/ui** - Card, Button, Progress, Badge components
- **next/navigation** - `redirect()`, `useRouter`, `useParams`

### Existing Components to Reuse
| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| `ResearchChatAssistant` | `components/wizard/research/` | Direct import, pass projectId as prop |
| `ResearchPlanDisplay` | `components/wizard/research/` | Direct import |
| `GuruTestChat` | `components/wizard/testing/` | Direct import |
| `ReadinessSummary` | `components/dashboard/` | Update links only |
| `ActivityTile` | `components/dashboard/` | Already reusable |

### API Endpoints (No Changes)
- `GET /api/projects/[id]/readiness` - Readiness score
- `GET /api/projects/[id]/guru-profile` - Profile data
- `POST /api/projects/[id]/research` - Start research
- `GET /api/projects/[id]/research/[runId]` - Research status

## Detailed Design

### Route Architecture

```
PROPOSED STATE (Unified Dashboard)
==================================

/projects/[id]                    ← HOME BASE (Dashboard)
├── /projects/[id]/research       ← Full-width research (NEW)
├── /projects/[id]/readiness      ← Full-width readiness (NEW)
├── /projects/[id]/profile        ← Profile editor (NEW)
└── /projects/[id]/artifacts/teaching/*  (EXISTING - already full-width)

/projects/new/profile             ← KEEP for initial project creation only
/projects/new/research?projectId  ← REDIRECT to /projects/[id]/research
/projects/new/readiness?projectId ← REDIRECT to /projects/[id]/readiness
/projects/new/artifacts?projectId ← REDIRECT to /projects/[id]/artifacts/teaching
```

### New Shared Layout Component

Create `components/project/ProjectPageLayout.tsx`:

```typescript
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
        <Link href="/projects" className="hover:text-foreground">Projects</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/projects/${projectId}`} className="hover:text-foreground">
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

### File Structure

```
app/projects/[id]/
├── page.tsx                      # Dashboard (existing)
├── research/
│   └── page.tsx                  # NEW: Full-width research
├── readiness/
│   └── page.tsx                  # NEW: Full-width readiness
├── profile/
│   └── page.tsx                  # NEW: Full-width profile editor
└── artifacts/teaching/           # EXISTING: Already full-width
    └── [type]/[artifactId]/
        └── page.tsx

components/project/
└── ProjectPageLayout.tsx         # NEW: Shared layout with breadcrumb
```

### Research Page Implementation

`app/projects/[id]/research/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProjectPageLayout } from '@/components/project/ProjectPageLayout';
import { ResearchChatAssistant } from '@/components/wizard/research/ResearchChatAssistant';
import { ResearchSuggestions } from '@/components/project/ResearchSuggestions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResearchPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      currentProfile: true,
      researchRuns: { orderBy: { createdAt: 'desc' }, take: 5 }
    }
  });

  if (!project) {
    redirect('/projects');
  }

  // Fetch readiness for gap suggestions
  const readiness = await fetchReadinessScore(id);

  return (
    <ProjectPageLayout
      projectId={id}
      projectName={project.name}
      title="Research Knowledge"
      description="Run research to discover and gather knowledge for your guru"
    >
      {/* Gap-aware research suggestions */}
      <ResearchSuggestions
        criticalGaps={readiness.criticalGaps}
        suggestedGaps={readiness.suggestedGaps}
        dimensions={readiness.dimensions}
        projectId={id}
      />

      {/* Research interface (chat or form) */}
      <ResearchInterface projectId={id} profile={project.currentProfile} />

      {/* Active/completed research runs */}
      <ResearchHistory runs={project.researchRuns} projectId={id} />
    </ProjectPageLayout>
  );
}
```

### Readiness Page Implementation

`app/projects/[id]/readiness/page.tsx`:

```typescript
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
      {/* Client component that fetches and displays readiness data */}
      <ReadinessAssessment projectId={id} />
    </ProjectPageLayout>
  );
}
```

### Profile Page Implementation

`app/projects/[id]/profile/page.tsx`:

```typescript
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
      {/* Input mode selection + profile editor */}
      <ProfileEditor
        projectId={id}
        existingProfile={project.currentProfile}
      />
    </ProjectPageLayout>
  );
}
```

### Redirect Logic for Legacy Routes

`app/projects/new/research/page.tsx` (modify existing):

```typescript
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function LegacyResearchPage({ searchParams }: Props) {
  const params = await searchParams;

  // If projectId exists, redirect to new route
  if (params.projectId) {
    redirect(`/projects/${params.projectId}/research`);
  }

  // No projectId = truly new project, show error or redirect to create
  redirect('/projects/new/profile');
}
```

Apply same pattern to:
- `app/projects/new/readiness/page.tsx`
- `app/projects/new/artifacts/page.tsx`

### Dashboard Link Updates

`components/dashboard/ReadinessSummary.tsx`:

```typescript
// Update gap links
<Link
  href={`/projects/${projectId}/research`}  // Was: /projects/new/research?projectId=
  className="..."
>
  {/* Gap card content */}
</Link>

// Update "View Full Report" link
<Link href={`/projects/${projectId}/readiness`}>  // Was: /projects/new/readiness?projectId=
  View Full Readiness Report
</Link>
```

`components/dashboard/SimplifiedDashboard.tsx`:

```typescript
// Update Research button
<Button asChild size="sm">
  <Link href={`/projects/${project.id}/research`}>  // Was: /projects/new/research?projectId=
    <Search className="w-4 h-4 mr-2" />
    Research
  </Link>
</Button>

// Update Profile link
<Link href={`/projects/${project.id}/profile`}>  // Was: /projects/new/profile?projectId=
  Edit Profile
</Link>
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW: Dashboard Hub                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User visits /projects/[id]                                                 │
│           │                                                                 │
│           ▼                                                                 │
│  ┌────────────────────┐                                                     │
│  │   Server Component │ ── prisma.project.findUnique({ where: { id } })     │
│  │   loads project    │                                                     │
│  └────────┬───────────┘                                                     │
│           │                                                                 │
│           ▼                                                                 │
│  ┌────────────────────┐                                                     │
│  │ SimplifiedDashboard│                                                     │
│  └────────┬───────────┘                                                     │
│           │                                                                 │
│     ┌─────┴─────┬─────────────┬───────────────┐                            │
│     ▼           ▼             ▼               ▼                            │
│ ┌─────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────┐                      │
│ │Activity │ │Profile  │ │Readiness     │ │Recent    │                      │
│ │Tiles    │ │Summary  │ │Summary       │ │Activity  │                      │
│ └─────────┘ └─────────┘ └──────┬───────┘ └──────────┘                      │
│                                │                                            │
│                     fetch(/api/projects/[id]/readiness)                     │
│                                │                                            │
│     User clicks "Research" ────┘                                            │
│           │                                                                 │
│           ▼                                                                 │
│  ┌────────────────────┐                                                     │
│  │ /projects/[id]/    │ ◀── Route param, not query param                   │
│  │ research           │                                                     │
│  └────────────────────┘                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## User Experience

### Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY: Dashboard Hub                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ┌─────────────────┐                                  │
│                        │   DASHBOARD     │                                  │
│                        │ /projects/[id]  │                                  │
│                        │                 │                                  │
│                        │  ┌───────────┐  │                                  │
│                        │  │ Readiness │  │  ◀─── Summary with links         │
│                        │  │ Summary   │  │                                  │
│                        │  └─────┬─────┘  │                                  │
│                        └────────┼────────┘                                  │
│                                 │                                           │
│              ┌──────────────────┼──────────────────┐                        │
│              │                  │                  │                        │
│              ▼                  ▼                  ▼                        │
│     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐               │
│     │   PROFILE      │ │   RESEARCH     │ │   ARTIFACTS    │               │
│     │ /[id]/profile  │ │ /[id]/research │ │ /[id]/artifacts│               │
│     │                │ │                │ │    /teaching   │               │
│     │ • Edit guru    │ │ • Gap suggest  │ │                │               │
│     │ • Input modes  │ │ • Chat assist  │ │ • View/Edit    │               │
│     │                │ │ • Run research │ │ • Generate     │               │
│     └───────┬────────┘ └───────┬────────┘ └───────┬────────┘               │
│             │                  │                  │                        │
│             └──────────────────┴──────────────────┘                        │
│                                │                                           │
│                        ┌───────▼───────┐                                   │
│                        │   READINESS   │   ◀─── Full page for              │
│                        │ /[id]/readiness│       deep-dive analysis         │
│                        └───────────────┘                                   │
│                                                                             │
│   Benefits:                                                                 │
│   • Full-width layouts (max-w-7xl)                                         │
│   • Non-linear access (go anywhere anytime)                                │
│   • Dashboard is always one click away                                     │
│   • Consistent breadcrumb navigation                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Breadcrumb Pattern

Every sub-page displays:
```
Projects > {Project Name} > {Current Page}
```

Each segment is clickable, allowing instant navigation to:
- Projects list (`/projects`)
- Project dashboard (`/projects/[id]`)
- Current page (non-clickable)

### Test Chat Placement

The GuruTestChat component moves to the bottom of the artifacts page:

```
┌─ ARTIFACTS PAGE ───────────────────────────────────────────────┐
│                                                                │
│  [Mental Model Card]  [Curriculum Card]  [Drill Series Card]  │
│                                                                │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                │
│  ┌─ EXPLORE YOUR GURU ────────────────────────────────────────┐│
│  │                                                            ││
│  │  Want to chat with your guru directly? Try out your       ││
│  │  guru's knowledge and teaching style in a conversation.   ││
│  │                                                            ││
│  │  [Expand Chat ▼]                                           ││
│  │                                                            ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests

```typescript
// components/project/__tests__/ProjectPageLayout.test.tsx
describe('ProjectPageLayout', () => {
  it('renders breadcrumb with correct links', () => {
    // Purpose: Verify navigation structure is correct
    render(
      <ProjectPageLayout
        projectId="123"
        projectName="Test Project"
        title="Research"
        description="Test"
      >
        <div>Content</div>
      </ProjectPageLayout>
    );

    expect(screen.getByText('Projects')).toHaveAttribute('href', '/projects');
    expect(screen.getByText('Test Project')).toHaveAttribute('href', '/projects/123');
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('applies max-w-7xl container class', () => {
    // Purpose: Verify full-width layout is applied
    const { container } = render(<ProjectPageLayout {...props}>Content</ProjectPageLayout>);
    expect(container.firstChild).toHaveClass('max-w-7xl');
  });
});
```

### Integration Tests

```typescript
// tests/wizard-dashboard-integration.spec.ts
describe('Wizard-Dashboard Integration', () => {
  test('dashboard research link navigates to /projects/[id]/research', async ({ page }) => {
    // Purpose: Verify new routing works from dashboard
    await page.goto('/projects/test-project-id');
    await page.click('text=Research');
    await expect(page).toHaveURL(/\/projects\/test-project-id\/research/);
    // Verify breadcrumb shows correct path
    await expect(page.locator('nav')).toContainText('Research');
  });

  test('legacy wizard route redirects to dashboard route', async ({ page }) => {
    // Purpose: Verify backward compatibility redirects work
    await page.goto('/projects/new/research?projectId=test-project-id');
    await expect(page).toHaveURL(/\/projects\/test-project-id\/research/);
  });

  test('readiness summary gaps link to /projects/[id]/research', async ({ page }) => {
    // Purpose: Verify gap clicks go to correct route
    await page.goto('/projects/test-project-id');
    await page.click('[data-testid="critical-gap-link"]');
    await expect(page).toHaveURL(/\/projects\/test-project-id\/research/);
  });
});
```

### E2E Test Scenarios

1. **Full Research Flow**: Dashboard → Research page → Run research → View results → Back to dashboard
2. **Profile Edit Flow**: Dashboard → Profile → Edit → Save → Dashboard reflects changes
3. **Readiness Deep-Dive**: Dashboard → Readiness summary → Full report → Research a gap
4. **Non-Linear Navigation**: Dashboard → Readiness → Profile → Research → Dashboard (any order)

## Performance Considerations

### Server Component Optimization

- Research and Readiness pages use server components for initial data fetch
- Client components only for interactive elements (chat, forms)
- Reduces JavaScript bundle on initial load

### Data Fetching Strategy

```typescript
// Parallel data fetching where possible
const [project, readiness] = await Promise.all([
  prisma.project.findUnique({ where: { id } }),
  fetchReadinessScore(id)
]);
```

### Route Prefetching

Next.js automatically prefetches linked routes on hover:
```typescript
<Link href={`/projects/${id}/research`} prefetch={true}>
```

## Security Considerations

### Authentication

All `/projects/[id]/*` routes are protected by existing middleware that:
1. Verifies session via Supabase
2. Checks user has access to the project
3. Redirects to login if unauthorized

### Authorization

Project ownership is verified at the database level:
```typescript
const project = await prisma.project.findFirst({
  where: {
    id,
    userId: session.user.id  // Ensures user owns project
  }
});
```

### Input Validation

- Project IDs are validated as CUIDs
- Redirect targets are constructed from validated data only
- No user input directly in redirect URLs

## Documentation

### Developer Guide Updates

Update `developer-guides/08-teaching-pipeline-guide.md` to reflect new route structure:
- `/projects/[id]/research` for running research
- `/projects/[id]/readiness` for readiness assessment
- Remove references to `/projects/new/*` routes

### CLAUDE.md Updates

Add to Route Architecture section:
```markdown
### Dashboard-Anchored Routes
All project work happens under `/projects/[id]/*`:
- `/projects/[id]` - Dashboard home base
- `/projects/[id]/research` - Run research
- `/projects/[id]/readiness` - Readiness assessment
- `/projects/[id]/profile` - Edit guru profile
- `/projects/[id]/artifacts/teaching/*` - View/manage artifacts
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Create `ProjectPageLayout` component with breadcrumb
- Create `/projects/[id]/research` page (extract from wizard)
- Create `/projects/[id]/readiness` page (extract from wizard)
- Create `/projects/[id]/profile` page (extract from wizard)

### Phase 2: Link Updates
- Update `ReadinessSummary` links to new routes
- Update `SimplifiedDashboard` navigation buttons
- Update `GettingStartedStep` links
- Update `ActivityTile` links

### Phase 3: Redirects & Cleanup
- Add redirect logic to legacy wizard routes
- Keep `/projects/new/profile` for initial creation
- Remove `WizardNavigation` component from redirected pages
- Test all navigation paths

### Phase 4: Polish
- Add test chat section to artifacts page
- Ensure responsive layouts work at all breakpoints
- Add loading states to new pages
- Write E2E tests

## Open Questions

1. ~~**Profile creation entry point**~~ (RESOLVED)
   **Answer:** Keep `/projects/new/profile` for initial project creation
   **Rationale:** Projects need an ID before dashboard routes work; this is a separate flow that naturally precedes the dashboard experience

2. ~~**Research suggestions component extraction**~~ (RESOLVED)
   **Answer:** Extract to standalone `ResearchSuggestions` component
   **Rationale:** Enables future reuse on dashboard and follows component design best practices

## References

- **Ideation Document**: `specs/wizard-dashboard-integration/01-ideation.md`
- **Dashboard Components**: `components/dashboard/`
- **Wizard Components**: `components/wizard/`
- **Next.js App Router**: https://nextjs.org/docs/app/building-your-application/routing
