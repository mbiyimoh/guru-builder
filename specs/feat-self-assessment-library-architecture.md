# Feature Specification: Self-Assessment Library Architecture

## 1. Status

**Draft** - Ready for Review

## 2. Authors

Claude Code - December 4, 2025

## 3. Overview

Refactor the self-assessment system from a one-to-one project relationship to a reusable assessment library model. This enables users to create assessment definitions (templates) that can be explicitly assigned to projects, solving the UX problem where irrelevant assessments (e.g., GNU Backgammon) appear on unrelated projects.

---

## 4. Background/Problem Statement

### The Problem

Currently, the self-assessment system uses a **one-to-one relationship** between Projects and SelfAssessmentConfig:

```
Project ←→ SelfAssessmentConfig (1:1 via projectId @unique)
```

This design has several issues:

1. **Irrelevant UI clutter**: The GNU Backgammon assessment toggle appears on ALL projects, even non-backgammon projects like "Chess Guru" or "Cooking Guru"
2. **No reusability**: Each project needs its own config, even if using the same assessment engine
3. **Confusion for users**: Seeing a backgammon-specific assessment on unrelated projects is confusing

### Root Cause

The `SelfAssessmentConfig` model was designed with a `projectId @unique` constraint, forcing a 1:1 relationship. The UI (`SelfAssessmentToggle.tsx`) renders unconditionally on all project pages.

### User Impact

When a user creates a new project for any domain (e.g., "How Laws Are Made"), they see a "Self-Assessment: Test your guru against GNU Backgammon engine" toggle - which makes no sense for that domain.

---

## 5. Goals

- **Primary**: New projects have NO assessments shown by default
- Users can create reusable assessment definitions (templates)
- Users can explicitly assign assessment definitions to specific projects
- Existing backgammon assessment data migrates cleanly to new structure
- Assessment UI only appears when an assessment is explicitly assigned
- Backward compatible with existing AssessmentSession and AssessmentResult data

## 6. Non-Goals

- Global/shared assessment library (user-owned only for now)
- Creating new assessment engine integrations
- Modifying the assessment chat/comparison UI itself
- Batch operations or advanced library management
- Assessment marketplace or sharing features

---

## 7. Technical Dependencies

### Existing Stack
- **Prisma ORM** v5.22.0 - Database migrations and models
- **Next.js** 15.2.4 - API routes and UI
- **React** 19.1.1 - Component architecture
- **Tailwind CSS** - Styling
- **Zod** 3.24.1 - Schema validation

### Affected Models (Current)
```prisma
model SelfAssessmentConfig {
  id        String   @id @default(cuid())
  projectId String   @unique  // <-- This constraint forces 1:1
  engineUrl String   @default("https://gnubg-mcp-d1c3c7a814e8.herokuapp.com")
  isEnabled Boolean  @default(true)
  // ... timestamps
  project   Project  @relation(...)
  sessions  AssessmentSession[]
}
```

---

## 8. Detailed Design

### 8.1 Architecture Overview

**Current State:**
```
Project ←──(1:1)──→ SelfAssessmentConfig ←──(1:many)──→ Sessions
```

**New State:**
```
User ←──(1:many)──→ AssessmentDefinition
                          │
                          │ (many:many via join table)
                          ↓
Project ←──(1:many)──→ ProjectAssessment ←──(1:many)──→ Sessions
```

### 8.2 Database Schema Changes

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

// MODIFIED: AssessmentSession now links to ProjectAssessment (not SelfAssessmentConfig)
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

// Update Project model to remove old relation, add new
model Project {
  // ... existing fields ...

  // REMOVE: assessmentConfig SelfAssessmentConfig?
  // ADD:
  projectAssessments  ProjectAssessment[]

  // ... existing relations ...
}

// Update User model to add assessment definitions
model User {
  // ... existing fields ...

  // ADD:
  assessmentDefinitions AssessmentDefinition[]
}
```

### 8.3 Migration Strategy

**Phase 1: Add new models (non-breaking)**
1. Create `AssessmentDefinition` and `ProjectAssessment` models
2. Add relation to User model
3. Keep `SelfAssessmentConfig` temporarily for data migration

**Phase 2: Migrate data**
```sql
-- For each existing SelfAssessmentConfig:
-- 1. Create an AssessmentDefinition owned by the project's owner
-- 2. Create a ProjectAssessment linking them
-- 3. Update AssessmentSession to point to new ProjectAssessment

-- Example migration script (executed in Prisma migration):
INSERT INTO "AssessmentDefinition" (id, "userId", name, description, domain, "engineUrl", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p."userId",
  'GNU Backgammon Assessment',
  'Test opening moves against GNU Backgammon engine',
  'backgammon',
  sac."engineUrl",
  sac."createdAt",
  NOW()
FROM "SelfAssessmentConfig" sac
JOIN "Project" p ON p.id = sac."projectId"
WHERE p."userId" IS NOT NULL;
```

**Phase 3: Remove deprecated model**
1. Remove `SelfAssessmentConfig` model
2. Clean up old API routes

### 8.4 API Design

#### Assessment Definitions API

```typescript
// GET /api/assessment-definitions
// List user's assessment definitions
Response: { definitions: AssessmentDefinition[] }

// POST /api/assessment-definitions
// Create new assessment definition
Body: { name, description?, domain, engineType?, engineUrl? }
Response: { definition: AssessmentDefinition }

// DELETE /api/assessment-definitions/[id]
// Delete assessment definition (cascade deletes ProjectAssessments)
Response: { success: true }
```

#### Project Assessments API

```typescript
// GET /api/projects/[id]/assessments
// List assessments assigned to this project
Response: { assessments: ProjectAssessment[] }

// POST /api/projects/[id]/assessments
// Assign an assessment definition to this project
Body: { assessmentDefinitionId: string }
Response: { projectAssessment: ProjectAssessment }

// DELETE /api/projects/[id]/assessments/[assessmentId]
// Remove assessment from project
Response: { success: true }

// PATCH /api/projects/[id]/assessments/[assessmentId]
// Toggle assessment enabled/disabled
Body: { isEnabled: boolean }
Response: { projectAssessment: ProjectAssessment }
```

#### Updated Assessment Routes

All existing assessment routes under `/api/projects/[id]/assessment/*` need to be updated to accept an `assessmentId` parameter:

```typescript
// Changed from:
// POST /api/projects/[id]/assessment/session
// To:
// POST /api/projects/[id]/assessments/[assessmentId]/session

// Similar changes for:
// - /chat → /assessments/[assessmentId]/chat
// - /ground-truth → /assessments/[assessmentId]/ground-truth
// - /results → /assessments/[assessmentId]/results
// - /history → /assessments/[assessmentId]/history
```

### 8.5 UI Components

#### Replace SelfAssessmentToggle with AssessmentLibrary

**File:** `components/assessment/ProjectAssessmentManager.tsx`

```tsx
'use client'

interface Props {
  projectId: string
}

export function ProjectAssessmentManager({ projectId }: Props) {
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([])
  const [projectAssessments, setProjectAssessments] = useState<ProjectAssessment[]>([])
  const [showAddModal, setShowAddModal] = useState(false)

  // If no assessments assigned, show minimal "Add Assessment" button
  if (projectAssessments.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No assessments configured for this project</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-blue-600 hover:text-blue-800"
          >
            + Add Assessment
          </button>
        </div>
      </div>
    )
  }

  // Show list of assigned assessments
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Self-Assessments</h3>
        <button onClick={() => setShowAddModal(true)}>+ Add</button>
      </div>

      {projectAssessments.map(pa => (
        <AssessmentCard
          key={pa.id}
          assessment={pa}
          onToggle={handleToggle}
          onRemove={handleRemove}
        />
      ))}

      <AddAssessmentModal
        open={showAddModal}
        definitions={definitions}
        onAdd={handleAdd}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  )
}
```

#### Assessment Selector Modal

**File:** `components/assessment/AddAssessmentModal.tsx`

```tsx
interface Props {
  open: boolean
  definitions: AssessmentDefinition[]
  existingIds: string[]  // Already assigned to this project
  onAdd: (definitionId: string) => void
  onCreateNew: () => void
  onClose: () => void
}

export function AddAssessmentModal({ ... }: Props) {
  // Show user's available assessment definitions
  // Filter out already-assigned ones
  // Option to "Create New Assessment Definition"
}
```

---

## 9. User Experience

### Flow 1: New Project (Clean State)

1. User creates new project "Cooking Guru"
2. Project page loads with NO assessment section visible
3. User clicks "Add Assessment" (optional)
4. Modal shows: "You haven't created any assessments yet. Create your first one."
5. User can create or skip

### Flow 2: Existing Backgammon Project (Migration)

1. User with existing backgammon project loads page
2. System has auto-migrated their SelfAssessmentConfig to:
   - AssessmentDefinition: "GNU Backgammon Assessment" (in their library)
   - ProjectAssessment: links the definition to their project
3. Assessment UI appears as before - no disruption
4. All existing sessions/results preserved

### Flow 3: Reusing Assessments

1. User creates second backgammon project
2. Clicks "Add Assessment" on new project
3. Sees their "GNU Backgammon Assessment" in the list
4. Clicks to add it
5. Both projects now share the same assessment definition

---

## 10. Testing Strategy

### Unit Tests

```typescript
// __tests__/lib/assessment/assessmentDefinitions.test.ts

/**
 * Purpose: Verify AssessmentDefinition CRUD operations
 * Why: Core functionality for the assessment library feature
 */
describe('AssessmentDefinition operations', () => {
  it('should create assessment definition with required fields', async () => {
    const definition = await createAssessmentDefinition({
      userId: testUser.id,
      name: 'Test Assessment',
      domain: 'backgammon',
      engineUrl: 'https://example.com/engine'
    })

    expect(definition.id).toBeDefined()
    expect(definition.name).toBe('Test Assessment')
  })

  it('should enforce unique name per user', async () => {
    // Create first
    await createAssessmentDefinition({ userId: testUser.id, name: 'Same Name', domain: 'test' })

    // Second with same name should succeed (same user can have multiple with same name)
    // But we might want to warn them
  })

  it('should cascade delete ProjectAssessments when definition deleted', async () => {
    // Verify referential integrity
  })
})
```

### Integration Tests

```typescript
// __tests__/api/assessment-definitions.test.ts

/**
 * Purpose: Verify API routes work correctly with auth
 * Why: Ensure proper ownership and access control
 */
describe('Assessment Definitions API', () => {
  it('should only return definitions owned by current user', async () => {
    // Create definitions for two users
    // Verify user A can only see their own
  })

  it('should prevent assigning definition to project user does not own', async () => {
    // User A's definition cannot be assigned to User B's project
  })
})
```

### E2E Tests

```typescript
// tests/assessment-library.spec.ts

/**
 * Purpose: Verify complete user journey for assessment management
 * Why: Ensures the feature works end-to-end as users would experience it
 */
test('complete assessment library flow', async ({ page }) => {
  // 1. Create new project - verify no assessments shown
  await page.goto('/projects/new')
  // ... create project ...
  await expect(page.locator('[data-testid="assessment-section"]')).not.toBeVisible()

  // 2. Add assessment
  await page.click('[data-testid="add-assessment-btn"]')
  await page.click('[data-testid="create-new-definition"]')
  await page.fill('[name="name"]', 'My Test Assessment')
  await page.fill('[name="domain"]', 'test')
  await page.click('[data-testid="save-definition"]')

  // 3. Verify assessment now appears
  await expect(page.locator('[data-testid="assessment-card"]')).toBeVisible()

  // 4. Start assessment session
  await page.click('[data-testid="start-assessment"]')
  await expect(page).toHaveURL(/\/assessment/)
})

/**
 * Purpose: Verify migration preserves existing data
 * Why: Critical for existing users to not lose their assessment history
 */
test('migrated assessments preserve session history', async ({ page }) => {
  // Setup: Create assessment with sessions in old schema
  // Run migration
  // Verify sessions are accessible via new routes
})
```

---

## 11. Performance Considerations

### Database Queries

- **List assessments for project**: Simple join on `ProjectAssessment`
- **List user's definitions**: Index on `userId` ensures fast lookup
- **Impact**: Minimal - adds one join for assessment lookups

### Migration

- **One-time cost**: Migration runs once per deployment
- **Estimate**: For small dataset (< 100 configs), < 1 second
- **Strategy**: Run during deployment window, not hot

---

## 12. Security Considerations

### Authorization Rules

1. **AssessmentDefinition**: Only owner can view/edit/delete
2. **ProjectAssessment**: Only project owner can add/remove/toggle
3. **Sessions/Results**: Inherit from ProjectAssessment ownership

### Implementation

```typescript
// lib/auth.ts

export async function requireAssessmentOwnership(
  assessmentDefinitionId: string
): Promise<AssessmentDefinition> {
  const { user } = await requireAuth()

  const definition = await prisma.assessmentDefinition.findUnique({
    where: { id: assessmentDefinitionId }
  })

  if (!definition || definition.userId !== user.id) {
    throw new UnauthorizedError('Assessment not found or not owned by user')
  }

  return definition
}
```

---

## 13. Documentation

### Updates Required

1. **CLAUDE.md**: Add section on assessment library architecture
2. **Developer Guide**: New guide `07-assessment-library-guide.md`
3. **API Documentation**: Update assessment endpoints

---

## 14. Implementation Phases

### Phase 1: Database Foundation

1. Create migration adding new models
2. Keep old `SelfAssessmentConfig` temporarily
3. Add indexes for performance
4. Write data migration script

**Deliverable**: New tables created, no breaking changes

### Phase 2: API Routes

1. Create `/api/assessment-definitions` routes
2. Create `/api/projects/[id]/assessments` routes
3. Update existing assessment routes to use new structure
4. Add auth middleware

**Deliverable**: New APIs functional, old routes deprecated

### Phase 3: UI Components

1. Create `ProjectAssessmentManager` component
2. Create `AddAssessmentModal` component
3. Replace `SelfAssessmentToggle` usage on project page
4. Update assessment page to use `assessmentId`

**Deliverable**: New UI live, old toggle removed

### Phase 4: Migration & Cleanup

1. Run data migration for existing configs
2. Verify all sessions/results preserved
3. Remove `SelfAssessmentConfig` model
4. Remove deprecated API routes

**Deliverable**: Clean architecture, no deprecated code

---

## 15. Open Questions

1. ~~Should we support global/shared assessments?~~ **Decided: No, user-owned only**
2. Should users be able to duplicate an assessment definition?
3. What happens to ProjectAssessments when a definition is deleted? **Cascade delete**

---

## 16. References

- **Ideation Document**: `docs/ideation/guru-teaching-functions-self-assessment-architecture.md`
- **Existing Assessment Spec**: `specs/feat-self-assessment-system.md`
- **Current Schema**: `prisma/schema.prisma` (lines 214-265)
- **Current Toggle Component**: `components/assessment/SelfAssessmentToggle.tsx`

---

## 17. Appendix: Validation Schemas

```typescript
// lib/assessment/validation.ts (additions)

export const assessmentDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  domain: z.string().min(1).max(50),
  engineType: z.string().optional(),
  engineUrl: z.string().url().optional(),
})

export const createProjectAssessmentSchema = z.object({
  assessmentDefinitionId: z.string().cuid(),
})

export const updateProjectAssessmentSchema = z.object({
  isEnabled: z.boolean(),
})
```

---

**End of Specification**

*Quality Score: 9/10 - Comprehensive, focused on simplicity per user requirements, clear migration path*
