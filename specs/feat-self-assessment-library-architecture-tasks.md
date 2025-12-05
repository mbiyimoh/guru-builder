# Task Breakdown: Self-Assessment Library Architecture

Generated: 2025-12-04
Source: specs/feat-self-assessment-library-architecture.md

## Overview

Refactor the self-assessment system from a 1:1 project relationship to a reusable assessment library model. This enables users to create assessment definitions (templates) that can be explicitly assigned to projects, solving the UX problem where irrelevant assessments appear on unrelated projects.

---

## Phase 1: Database Foundation

### Task 1.1: Add AssessmentDefinition and ProjectAssessment models

**Description**: Create new Prisma models for reusable assessment definitions and project assignments
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation)

**Technical Requirements**:

Add to `prisma/schema.prisma`:

```prisma
// NEW: Reusable assessment template owned by user
model AssessmentDefinition {
  id           String   @id @default(cuid())
  userId       String   // Owner of this definition

  name         String   // e.g., "GNU Backgammon Opening Assessment"
  description  String?  // Optional description
  domain       String   // e.g., "backgammon", "chess", "general"

  // Engine configuration
  engineType   String?  // e.g., "GNU_BACKGAMMON", "STOCKFISH", null for drill-only
  engineUrl    String?  // MCP server URL

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectAssessments ProjectAssessment[]

  @@index([userId])
  @@index([domain])
}

// NEW: Join table linking projects to assessment definitions
model ProjectAssessment {
  id                     String   @id @default(cuid())
  projectId              String
  assessmentDefinitionId String

  isEnabled              Boolean  @default(true)  // Per-project toggle

  createdAt              DateTime @default(now())

  // Relations
  project                Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assessmentDefinition   AssessmentDefinition @relation(fields: [assessmentDefinitionId], references: [id], onDelete: Cascade)
  sessions               AssessmentSession[]

  @@unique([projectId, assessmentDefinitionId])  // No duplicates
  @@index([projectId])
  @@index([assessmentDefinitionId])
}
```

**Implementation Steps**:
1. Run `npm run db:backup` before any schema changes
2. Add AssessmentDefinition model to schema.prisma
3. Add ProjectAssessment model to schema.prisma
4. Add `assessmentDefinitions AssessmentDefinition[]` relation to User model
5. Add `projectAssessments ProjectAssessment[]` relation to Project model
6. Keep old SelfAssessmentConfig temporarily (do not delete yet)
7. Run `npm run migrate:safe -- add-assessment-library`
8. Run `npx prisma generate` to update client

**Acceptance Criteria**:
- [ ] New models exist in schema.prisma
- [ ] Migration runs without errors
- [ ] Prisma client generates without errors
- [ ] Old SelfAssessmentConfig still intact
- [ ] Indexes created for userId and domain

---

### Task 1.2: Update AssessmentSession to use ProjectAssessment

**Description**: Modify AssessmentSession to link to ProjectAssessment instead of SelfAssessmentConfig
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:

Modify AssessmentSession in `prisma/schema.prisma`:

```prisma
model AssessmentSession {
  id                  String   @id @default(cuid())
  projectAssessmentId String   // Changed from configId

  startedAt           DateTime @default(now())
  endedAt             DateTime?
  lastResultId        String?

  // Relations
  projectAssessment   ProjectAssessment @relation(fields: [projectAssessmentId], references: [id], onDelete: Cascade)
  results             AssessmentResult[]

  @@index([projectAssessmentId])
  @@index([startedAt])
}
```

**Implementation Steps**:
1. Add new `projectAssessmentId` field as optional first
2. Run migration to add the field
3. Will handle data migration in Task 1.3

**Acceptance Criteria**:
- [ ] AssessmentSession has projectAssessmentId field
- [ ] Migration successful
- [ ] Existing sessions still accessible via old configId temporarily

---

### Task 1.3: Create data migration script

**Description**: Migrate existing SelfAssessmentConfig data to new models
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.2
**Can run parallel with**: None

**Technical Requirements**:

Create `prisma/migrations/manual/migrate-assessment-library.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting assessment library migration...');

  // Get all existing SelfAssessmentConfigs with their projects
  const configs = await prisma.selfAssessmentConfig.findMany({
    include: {
      project: true,
      sessions: true,
    },
  });

  console.log(`Found ${configs.length} configs to migrate`);

  for (const config of configs) {
    if (!config.project.userId) {
      console.log(`Skipping config ${config.id} - project has no owner`);
      continue;
    }

    // 1. Create AssessmentDefinition
    const definition = await prisma.assessmentDefinition.create({
      data: {
        userId: config.project.userId,
        name: 'GNU Backgammon Assessment',
        description: 'Test opening moves against GNU Backgammon engine',
        domain: 'backgammon',
        engineType: 'GNU_BACKGAMMON',
        engineUrl: config.engineUrl,
      },
    });

    console.log(`Created definition ${definition.id} for user ${config.project.userId}`);

    // 2. Create ProjectAssessment
    const projectAssessment = await prisma.projectAssessment.create({
      data: {
        projectId: config.projectId,
        assessmentDefinitionId: definition.id,
        isEnabled: config.isEnabled,
      },
    });

    console.log(`Created project assessment ${projectAssessment.id}`);

    // 3. Update sessions to point to new ProjectAssessment
    await prisma.assessmentSession.updateMany({
      where: { configId: config.id },
      data: { projectAssessmentId: projectAssessment.id },
    });

    console.log(`Migrated ${config.sessions.length} sessions`);
  }

  console.log('Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Implementation Steps**:
1. Create migration script file
2. Test on backup database first
3. Run migration script
4. Verify all sessions are accessible
5. Verify definitions are created correctly

**Acceptance Criteria**:
- [ ] All SelfAssessmentConfigs migrated to AssessmentDefinition + ProjectAssessment
- [ ] All sessions have valid projectAssessmentId
- [ ] No data loss
- [ ] Can be run multiple times safely (idempotent check)

---

### Task 1.4: Add Zod validation schemas

**Description**: Create validation schemas for assessment library operations
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.3

**Technical Requirements**:

Add to `lib/assessment/validation.ts`:

```typescript
import { z } from 'zod';

// Assessment Definition schemas
export const assessmentDefinitionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  domain: z.string().min(1, 'Domain is required').max(50, 'Domain too long'),
  engineType: z.string().optional(),
  engineUrl: z.string().url('Invalid URL').optional(),
});

export const createAssessmentDefinitionSchema = assessmentDefinitionSchema;

export const updateAssessmentDefinitionSchema = assessmentDefinitionSchema.partial();

// Project Assessment schemas
export const createProjectAssessmentSchema = z.object({
  assessmentDefinitionId: z.string().cuid('Invalid assessment ID'),
});

export const updateProjectAssessmentSchema = z.object({
  isEnabled: z.boolean(),
});

// Type exports
export type CreateAssessmentDefinitionInput = z.infer<typeof createAssessmentDefinitionSchema>;
export type UpdateAssessmentDefinitionInput = z.infer<typeof updateAssessmentDefinitionSchema>;
export type CreateProjectAssessmentInput = z.infer<typeof createProjectAssessmentSchema>;
export type UpdateProjectAssessmentInput = z.infer<typeof updateProjectAssessmentSchema>;
```

**Implementation Steps**:
1. Add schemas to lib/assessment/validation.ts
2. Export types for use in API routes

**Acceptance Criteria**:
- [ ] All schemas validate correctly
- [ ] Types exported and usable
- [ ] Error messages are user-friendly

---

## Phase 2: API Routes

### Task 2.1: Create Assessment Definitions API

**Description**: Build CRUD API for assessment definitions
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.4
**Can run parallel with**: Task 2.2

**Technical Requirements**:

Create `app/api/assessment-definitions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAssessmentDefinitionSchema } from '@/lib/assessment/validation';

// GET /api/assessment-definitions - List user's definitions
export async function GET(request: NextRequest) {
  const { user } = await requireAuth();

  const definitions = await prisma.assessmentDefinition.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { projectAssessments: true },
      },
    },
  });

  return NextResponse.json({ definitions });
}

// POST /api/assessment-definitions - Create new definition
export async function POST(request: NextRequest) {
  const { user } = await requireAuth();
  const body = await request.json();

  const validated = createAssessmentDefinitionSchema.parse(body);

  const definition = await prisma.assessmentDefinition.create({
    data: {
      ...validated,
      userId: user.id,
    },
  });

  return NextResponse.json({ definition }, { status: 201 });
}
```

Create `app/api/assessment-definitions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateAssessmentDefinitionSchema } from '@/lib/assessment/validation';

// GET /api/assessment-definitions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireAuth();
  const { id } = await params;

  const definition = await prisma.assessmentDefinition.findFirst({
    where: { id, userId: user.id },
    include: {
      projectAssessments: {
        include: { project: { select: { id: true, name: true } } },
      },
    },
  });

  if (!definition) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ definition });
}

// PATCH /api/assessment-definitions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireAuth();
  const { id } = await params;
  const body = await request.json();

  const validated = updateAssessmentDefinitionSchema.parse(body);

  const definition = await prisma.assessmentDefinition.updateMany({
    where: { id, userId: user.id },
    data: validated,
  });

  if (definition.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/assessment-definitions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await requireAuth();
  const { id } = await params;

  const deleted = await prisma.assessmentDefinition.deleteMany({
    where: { id, userId: user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

**Implementation Steps**:
1. Create route.ts for list/create
2. Create [id]/route.ts for get/update/delete
3. Add proper error handling
4. Test all endpoints

**Acceptance Criteria**:
- [ ] GET lists only user's definitions
- [ ] POST creates with validation
- [ ] PATCH updates with ownership check
- [ ] DELETE cascades to ProjectAssessments
- [ ] All routes return proper status codes

---

### Task 2.2: Create Project Assessments API

**Description**: Build API for assigning assessments to projects
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1, Task 1.4
**Can run parallel with**: Task 2.1

**Technical Requirements**:

Create `app/api/projects/[id]/assessments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createProjectAssessmentSchema } from '@/lib/assessment/validation';

// GET /api/projects/[id]/assessments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  await requireProjectOwnership(projectId);

  const assessments = await prisma.projectAssessment.findMany({
    where: { projectId },
    include: {
      assessmentDefinition: true,
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ assessments });
}

// POST /api/projects/[id]/assessments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const project = await requireProjectOwnership(projectId);
  const body = await request.json();

  const { assessmentDefinitionId } = createProjectAssessmentSchema.parse(body);

  // Verify user owns the definition
  const definition = await prisma.assessmentDefinition.findFirst({
    where: { id: assessmentDefinitionId, userId: project.userId! },
  });

  if (!definition) {
    return NextResponse.json(
      { error: 'Assessment definition not found' },
      { status: 404 }
    );
  }

  // Check if already assigned
  const existing = await prisma.projectAssessment.findUnique({
    where: {
      projectId_assessmentDefinitionId: { projectId, assessmentDefinitionId },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Assessment already assigned to this project' },
      { status: 409 }
    );
  }

  const projectAssessment = await prisma.projectAssessment.create({
    data: { projectId, assessmentDefinitionId },
    include: { assessmentDefinition: true },
  });

  return NextResponse.json({ projectAssessment }, { status: 201 });
}
```

Create `app/api/projects/[id]/assessments/[assessmentId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateProjectAssessmentSchema } from '@/lib/assessment/validation';

// DELETE /api/projects/[id]/assessments/[assessmentId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> }
) {
  const { id: projectId, assessmentId } = await params;
  await requireProjectOwnership(projectId);

  const deleted = await prisma.projectAssessment.deleteMany({
    where: { id: assessmentId, projectId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/projects/[id]/assessments/[assessmentId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> }
) {
  const { id: projectId, assessmentId } = await params;
  await requireProjectOwnership(projectId);
  const body = await request.json();

  const { isEnabled } = updateProjectAssessmentSchema.parse(body);

  const updated = await prisma.projectAssessment.updateMany({
    where: { id: assessmentId, projectId },
    data: { isEnabled },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

**Implementation Steps**:
1. Create route.ts for list/assign
2. Create [assessmentId]/route.ts for remove/toggle
3. Add ownership verification
4. Handle duplicate assignment error

**Acceptance Criteria**:
- [ ] GET lists assessments for project
- [ ] POST assigns with ownership validation
- [ ] DELETE removes assignment
- [ ] PATCH toggles isEnabled
- [ ] Cannot assign same definition twice

---

## Phase 3: UI Components

### Task 3.1: Create ProjectAssessmentManager component

**Description**: Build the main assessment management UI for project pages
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: Task 3.2

**Technical Requirements**:

Create `components/assessment/ProjectAssessmentManager.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssessmentCard } from './AssessmentCard';
import { AddAssessmentModal } from './AddAssessmentModal';

interface AssessmentDefinition {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  engineType: string | null;
}

interface ProjectAssessment {
  id: string;
  isEnabled: boolean;
  assessmentDefinition: AssessmentDefinition;
  _count: { sessions: number };
}

interface Props {
  projectId: string;
}

export function ProjectAssessmentManager({ projectId }: Props) {
  const [assessments, setAssessments] = useState<ProjectAssessment[]>([]);
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [assessRes, defRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/assessments`),
        fetch('/api/assessment-definitions'),
      ]);

      const [assessData, defData] = await Promise.all([
        assessRes.json(),
        defRes.json(),
      ]);

      setAssessments(assessData.assessments || []);
      setDefinitions(defData.definitions || []);
    } catch (error) {
      console.error('Failed to fetch assessments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(assessmentId: string, isEnabled: boolean) {
    await fetch(`/api/projects/${projectId}/assessments/${assessmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled }),
    });
    fetchData();
  }

  async function handleRemove(assessmentId: string) {
    if (!confirm('Remove this assessment from the project?')) return;

    await fetch(`/api/projects/${projectId}/assessments/${assessmentId}`, {
      method: 'DELETE',
    });
    fetchData();
  }

  async function handleAdd(definitionId: string) {
    await fetch(`/api/projects/${projectId}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentDefinitionId: definitionId }),
    });
    setShowAddModal(false);
    fetchData();
  }

  if (loading) {
    return <div className="animate-pulse bg-gray-100 h-32 rounded-lg" />;
  }

  // Empty state - no assessments assigned
  if (assessments.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No assessments configured for this project</p>
          <Button variant="outline" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Assessment
          </Button>
        </div>

        <AddAssessmentModal
          open={showAddModal}
          definitions={definitions}
          existingIds={[]}
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      </div>
    );
  }

  // Show assigned assessments
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Self-Assessments</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="space-y-3">
        {assessments.map(pa => (
          <AssessmentCard
            key={pa.id}
            assessment={pa}
            onToggle={(enabled) => handleToggle(pa.id, enabled)}
            onRemove={() => handleRemove(pa.id)}
          />
        ))}
      </div>

      <AddAssessmentModal
        open={showAddModal}
        definitions={definitions}
        existingIds={assessments.map(a => a.assessmentDefinition.id)}
        onAdd={handleAdd}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
```

**Implementation Steps**:
1. Create component file
2. Add loading state
3. Add empty state with CTA
4. Add list view with cards
5. Wire up toggle/remove actions

**Acceptance Criteria**:
- [ ] Shows empty state when no assessments
- [ ] Shows list of assessments when assigned
- [ ] Toggle enables/disables assessment
- [ ] Remove button removes with confirmation
- [ ] Add button opens modal

---

### Task 3.2: Create AddAssessmentModal component

**Description**: Build modal for selecting and assigning assessments
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: Task 3.1

**Technical Requirements**:

Create `components/assessment/AddAssessmentModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AssessmentDefinition {
  id: string;
  name: string;
  description: string | null;
  domain: string;
}

interface Props {
  open: boolean;
  definitions: AssessmentDefinition[];
  existingIds: string[];
  onAdd: (definitionId: string) => void;
  onClose: () => void;
}

export function AddAssessmentModal({
  open,
  definitions,
  existingIds,
  onAdd,
  onClose,
}: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [creating, setCreating] = useState(false);

  const availableDefinitions = definitions.filter(
    d => !existingIds.includes(d.id)
  );

  async function handleCreateNew() {
    if (!newName.trim() || !newDomain.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/assessment-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, domain: newDomain }),
      });

      const { definition } = await res.json();
      onAdd(definition.id);
      setNewName('');
      setNewDomain('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create definition:', error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Assessment</DialogTitle>
          <DialogDescription>
            Select an existing assessment or create a new one.
          </DialogDescription>
        </DialogHeader>

        {!showCreateForm ? (
          <div className="space-y-4">
            {availableDefinitions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Your Assessments</p>
                {availableDefinitions.map(def => (
                  <button
                    key={def.id}
                    onClick={() => onAdd(def.id)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition"
                  >
                    <p className="font-medium">{def.name}</p>
                    <p className="text-sm text-gray-500">{def.domain}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No assessments available. Create your first one below.
              </p>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreateForm(true)}
            >
              Create New Assessment
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Chess Opening Assessment"
              />
            </div>

            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g., chess"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreateNew}
                disabled={creating || !newName.trim() || !newDomain.trim()}
                className="flex-1"
              >
                {creating ? 'Creating...' : 'Create & Add'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Implementation Steps**:
1. Create modal component
2. Show list of available definitions
3. Filter out already-assigned definitions
4. Add "Create New" form
5. Handle creation and assignment in one flow

**Acceptance Criteria**:
- [ ] Shows available definitions
- [ ] Filters out already-assigned ones
- [ ] Create form validates inputs
- [ ] Creates and assigns in one action
- [ ] Closes modal after successful add

---

### Task 3.3: Create AssessmentCard component

**Description**: Build card component for displaying assigned assessments
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3.1, Task 3.2

**Technical Requirements**:

Create `components/assessment/AssessmentCard.tsx`:

```tsx
'use client';

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Props {
  assessment: {
    id: string;
    isEnabled: boolean;
    assessmentDefinition: {
      id: string;
      name: string;
      description: string | null;
      domain: string;
      engineType: string | null;
    };
    _count: { sessions: number };
  };
  projectId?: string;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

export function AssessmentCard({ assessment, projectId, onToggle, onRemove }: Props) {
  const { assessmentDefinition: def, isEnabled, _count } = assessment;

  return (
    <div className={`p-4 border rounded-lg ${isEnabled ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{def.name}</h4>
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
              {def.domain}
            </span>
          </div>

          {def.description && (
            <p className="text-sm text-gray-500 mt-1">{def.description}</p>
          )}

          <p className="text-xs text-gray-400 mt-2">
            {_count.sessions} session{_count.sessions !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={isEnabled}
            onCheckedChange={onToggle}
          />

          {projectId && isEnabled && (
            <Link href={`/projects/${projectId}/assessment`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Implementation Steps**:
1. Create card component
2. Show definition details
3. Add toggle switch
4. Add remove button
5. Link to assessment page when enabled

**Acceptance Criteria**:
- [ ] Displays definition name and domain
- [ ] Shows session count
- [ ] Toggle switch works
- [ ] Remove button with hover state
- [ ] Visual distinction when disabled

---

### Task 3.4: Update project page to use new component

**Description**: Replace SelfAssessmentToggle with ProjectAssessmentManager
**Size**: Small
**Priority**: High
**Dependencies**: Task 3.1, Task 3.2, Task 3.3
**Can run parallel with**: None

**Technical Requirements**:

Update `app/projects/[id]/page.tsx`:

```tsx
// Replace old import
// import { SelfAssessmentToggle } from '@/components/assessment/SelfAssessmentToggle';

// With new import
import { ProjectAssessmentManager } from '@/components/assessment/ProjectAssessmentManager';

// In the JSX, replace:
// <SelfAssessmentToggle projectId={project.id} />

// With:
<ProjectAssessmentManager projectId={project.id} />
```

**Implementation Steps**:
1. Update import statement
2. Replace component usage
3. Remove old SelfAssessmentToggle import
4. Test rendering

**Acceptance Criteria**:
- [ ] New component renders on project page
- [ ] Empty state shows for new projects
- [ ] Existing assessments display correctly

---

## Phase 4: Cleanup

### Task 4.1: Remove deprecated SelfAssessmentConfig model

**Description**: Clean up old model after successful migration
**Size**: Small
**Priority**: Medium
**Dependencies**: All previous tasks
**Can run parallel with**: None

**Technical Requirements**:

1. Verify all data migrated successfully
2. Remove from schema.prisma:
```prisma
// DELETE THIS MODEL
model SelfAssessmentConfig {
  // ... entire model
}
```
3. Remove old relation from Project model
4. Run final migration

**Implementation Steps**:
1. Verify no references to old configId in sessions
2. Remove model from schema
3. Remove old API routes if any
4. Run migration
5. Delete SelfAssessmentToggle.tsx

**Acceptance Criteria**:
- [ ] Old model removed from schema
- [ ] No TypeScript errors
- [ ] Migration successful
- [ ] Old component deleted

---

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1: Database | 4 tasks | 2-3 hours |
| Phase 2: API Routes | 2 tasks | 2-3 hours |
| Phase 3: UI Components | 4 tasks | 3-4 hours |
| Phase 4: Cleanup | 1 task | 30 min |
| **Total** | **11 tasks** | **~8-10 hours** |

### Parallel Execution Opportunities

- Task 1.4 can run parallel with Task 1.3
- Task 2.1 can run parallel with Task 2.2
- Task 3.1, 3.2, 3.3 can run parallel

### Critical Path

1.1 → 1.2 → 1.3 → 2.1/2.2 → 3.1/3.2/3.3 → 3.4 → 4.1
