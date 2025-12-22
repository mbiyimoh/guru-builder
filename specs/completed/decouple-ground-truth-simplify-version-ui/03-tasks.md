# Task Breakdown: Decouple Ground Truth & Simplify Version UI

**Generated:** 2025-12-12
**Source:** specs/decouple-ground-truth-simplify-version-ui/01-ideation.md
**Last Decompose:** 2025-12-12

---

## Overview

This task breakdown implements two related UX improvements:
1. **Ground Truth Decoupling** - Create standalone ground truth engine management, independent of the assessment system
2. **Version UI Simplification** - Replace version sidebar panel with compact header dropdown

---

## Phase 1: Database Models & Migration

### Task 1.1: Create GroundTruthEngine and ProjectGroundTruthConfig Models
**Description:** Add new Prisma models for standalone ground truth engine management
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (foundation task)

**Technical Requirements:**
- Create `GroundTruthEngine` model (admin-seeded catalog)
- Create `ProjectGroundTruthConfig` model (project-engine link)
- Add proper indexes and relations
- Ensure cascade delete when project is deleted

**Implementation - prisma/schema.prisma additions:**
```prisma
model GroundTruthEngine {
  id          String  @id @default(cuid())
  name        String  // "GNU Backgammon"
  domain      String  // "backgammon"
  engineUrl   String  // MCP server URL
  description String? @db.Text
  iconUrl     String? // For UI display
  isActive    Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projectConfigs ProjectGroundTruthConfig[]

  @@index([domain])
  @@index([isActive])
}

model ProjectGroundTruthConfig {
  id        String  @id @default(cuid())
  projectId String
  engineId  String
  isEnabled Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  engine  GroundTruthEngine @relation(fields: [engineId], references: [id], onDelete: Cascade)

  @@unique([projectId, engineId])
  @@index([projectId])
  @@index([engineId])
}
```

**Also update Project model:**
```prisma
model Project {
  // ... existing fields ...
  groundTruthConfigs ProjectGroundTruthConfig[]
}
```

**Acceptance Criteria:**
- [ ] Models created in schema.prisma
- [ ] Migration runs without errors: `npm run migrate:safe -- add-ground-truth-engine`
- [ ] Prisma client regenerated successfully
- [ ] TypeScript types available for new models

---

### Task 1.2: Create Seed Script for GNU Backgammon Engine
**Description:** Seed the default GNU Backgammon ground truth engine
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Implementation - prisma/seeds/seed-ground-truth-engines.ts:**
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Upsert GNU Backgammon engine
  const gnubg = await prisma.groundTruthEngine.upsert({
    where: { id: 'gnubg-default' },
    update: {
      name: 'GNU Backgammon',
      domain: 'backgammon',
      engineUrl: 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com',
      description: 'World-class backgammon analysis engine for verifying move recommendations, position evaluations, and equity calculations.',
      isActive: true,
    },
    create: {
      id: 'gnubg-default',
      name: 'GNU Backgammon',
      domain: 'backgammon',
      engineUrl: 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com',
      description: 'World-class backgammon analysis engine for verifying move recommendations, position evaluations, and equity calculations.',
      isActive: true,
    },
  })

  console.log('Seeded ground truth engine:', gnubg.name)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Acceptance Criteria:**
- [ ] Seed script created and runs without errors
- [ ] GNU Backgammon engine appears in database
- [ ] Engine URL is correct Heroku deployment
- [ ] Script is idempotent (can run multiple times)

---

### Task 1.3: Update resolveGroundTruthConfig to Use New Models
**Description:** Modify the config resolver to query standalone models instead of assessments
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2
**Can run parallel with:** None

**Current Implementation (lib/groundTruth/config.ts):**
```typescript
// CURRENT - queries assessments
export async function resolveGroundTruthConfig(
  projectId: string
): Promise<GroundTruthConfig | null> {
  const projectAssessment = await prisma.projectAssessment.findFirst({
    where: {
      projectId,
      useForContentValidation: true,
      isEnabled: true
    },
    include: { assessmentDefinition: true }
  })
  // ... assessment-based logic
}
```

**New Implementation:**
```typescript
import { prisma } from '@/lib/db'

export interface GroundTruthConfig {
  enabled: boolean
  engineUrl: string
  engineId: string
  engineName: string
  projectConfigId: string
}

/**
 * Resolve ground truth configuration for a project.
 * Now queries standalone ProjectGroundTruthConfig instead of assessments.
 */
export async function resolveGroundTruthConfig(
  projectId: string
): Promise<GroundTruthConfig | null> {
  // Query the standalone ground truth config
  const config = await prisma.projectGroundTruthConfig.findFirst({
    where: {
      projectId,
      isEnabled: true,
      engine: {
        isActive: true
      }
    },
    include: {
      engine: true
    }
  })

  if (!config) return null
  if (!config.engine.engineUrl) return null

  return {
    enabled: true,
    engineUrl: config.engine.engineUrl,
    engineId: config.engine.id,
    engineName: config.engine.name,
    projectConfigId: config.id
  }
}

/**
 * Check if ground truth engine is healthy/reachable.
 */
export async function checkEngineHealth(
  config: GroundTruthConfig
): Promise<{ available: boolean; latency?: number; error?: string }> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${config.engineUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    const latency = Date.now() - startTime

    if (response.ok) {
      return { available: true, latency }
    } else {
      return { available: false, error: `HTTP ${response.status}`, latency }
    }
  } catch (error) {
    const latency = Date.now() - startTime
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Connection failed',
      latency
    }
  }
}
```

**Acceptance Criteria:**
- [ ] `resolveGroundTruthConfig` queries new models
- [ ] Return type includes engineId and engineName
- [ ] Existing callers (inngest-functions.ts, drillDesigner.ts) continue to work
- [ ] Health check function updated if needed
- [ ] TypeScript compiles without errors

---

## Phase 2: Ground Truth Engine API & UI

### Task 2.1: Create Ground Truth Engine API Endpoints
**Description:** REST API for listing engines and managing project configs
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.3
**Can run parallel with:** None

**Implementation - app/api/ground-truth-engines/route.ts:**
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ground-truth-engines
 * List all available ground truth engines (catalog)
 */
export async function GET() {
  try {
    const engines = await prisma.groundTruthEngine.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ engines })
  } catch (error) {
    console.error('[GET /api/ground-truth-engines] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch engines' },
      { status: 500 }
    )
  }
}
```

**Implementation - app/api/projects/[id]/ground-truth-engine/route.ts:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth'
import { resolveGroundTruthConfig, checkEngineHealth } from '@/lib/groundTruth/config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/ground-truth-engine
 * Get project's ground truth configuration
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    await requireProjectOwnership(projectId)

    const config = await prisma.projectGroundTruthConfig.findFirst({
      where: { projectId, isEnabled: true },
      include: { engine: true }
    })

    if (!config) {
      return NextResponse.json({ configured: false, config: null })
    }

    // Check engine health
    const gtConfig = await resolveGroundTruthConfig(projectId)
    let health = { available: false, latency: undefined as number | undefined }
    if (gtConfig) {
      health = await checkEngineHealth(gtConfig)
    }

    return NextResponse.json({
      configured: true,
      config: {
        id: config.id,
        engineId: config.engine.id,
        engineName: config.engine.name,
        engineUrl: config.engine.engineUrl,
        isEnabled: config.isEnabled,
        createdAt: config.createdAt
      },
      health
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[GET /api/projects/[id]/ground-truth-engine] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/ground-truth-engine
 * Enable a ground truth engine for this project
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    await requireProjectOwnership(projectId)

    const body = await request.json()
    const { engineId } = body

    if (!engineId) {
      return NextResponse.json({ error: 'engineId is required' }, { status: 400 })
    }

    // Verify engine exists
    const engine = await prisma.groundTruthEngine.findUnique({
      where: { id: engineId }
    })

    if (!engine || !engine.isActive) {
      return NextResponse.json({ error: 'Engine not found' }, { status: 404 })
    }

    // Create or update config (only one engine per project for now)
    // First disable any existing configs
    await prisma.projectGroundTruthConfig.updateMany({
      where: { projectId },
      data: { isEnabled: false }
    })

    // Create new config
    const config = await prisma.projectGroundTruthConfig.create({
      data: {
        projectId,
        engineId,
        isEnabled: true
      },
      include: { engine: true }
    })

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        engineId: config.engine.id,
        engineName: config.engine.name,
        isEnabled: config.isEnabled
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[POST /api/projects/[id]/ground-truth-engine] Error:', error)
    return NextResponse.json({ error: 'Failed to enable engine' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/ground-truth-engine
 * Disable ground truth for this project
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    await requireProjectOwnership(projectId)

    // Disable all configs for this project
    await prisma.projectGroundTruthConfig.updateMany({
      where: { projectId },
      data: { isEnabled: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[DELETE /api/projects/[id]/ground-truth-engine] Error:', error)
    return NextResponse.json({ error: 'Failed to disable engine' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- [ ] GET /api/ground-truth-engines returns engine catalog
- [ ] GET /api/projects/[id]/ground-truth-engine returns project config + health
- [ ] POST enables engine for project
- [ ] DELETE disables engine for project
- [ ] Auth checks work correctly
- [ ] Health check included in GET response

---

### Task 2.2: Create GroundTruthEngineManager UI Component
**Description:** UI component for selecting/managing ground truth engines on project page
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** None

**Implementation - components/ground-truth/GroundTruthEngineManager.tsx:**
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Server, RefreshCw, Plus, Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GroundTruthEngine {
  id: string
  name: string
  domain: string
  engineUrl: string
  description: string | null
}

interface ProjectConfig {
  id: string
  engineId: string
  engineName: string
  engineUrl: string
  isEnabled: boolean
  createdAt: string
}

interface HealthStatus {
  available: boolean
  latency?: number
  error?: string
}

interface Props {
  projectId: string
}

export function GroundTruthEngineManager({ projectId }: Props) {
  const [engines, setEngines] = useState<GroundTruthEngine[]>([])
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // Fetch available engines and project config in parallel
      const [enginesRes, configRes] = await Promise.all([
        fetch('/api/ground-truth-engines'),
        fetch(`/api/projects/${projectId}/ground-truth-engine`)
      ])

      const enginesData = await enginesRes.json()
      const configData = await configRes.json()

      setEngines(enginesData.engines || [])
      setConfig(configData.configured ? configData.config : null)
      setHealth(configData.health || null)
    } catch (error) {
      console.error('Failed to fetch ground truth data:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleSelectEngine = async (engineId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/ground-truth-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineId })
      })

      if (res.ok) {
        await fetchData()
        setShowSelector(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to enable engine')
      }
    } catch (error) {
      console.error('Failed to enable engine:', error)
      alert('Failed to enable engine')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveEngine = async () => {
    if (!confirm('Remove ground truth verification from this project?')) return

    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/ground-truth-engine`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setConfig(null)
        setHealth(null)
      }
    } catch (error) {
      console.error('Failed to remove engine:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  // No engine configured - show CTA
  if (!config) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Ground Truth Verification
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Enable ground truth verification to ensure generated teaching content
                is mathematically accurate. The AI will verify moves, positions, and
                evaluations against a proven engine.
              </p>
              <button
                onClick={() => setShowSelector(true)}
                className="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Ground Truth Engine
              </button>
            </div>
          </div>
        </div>

        {/* Engine selector modal */}
        {showSelector && (
          <div className="border-t p-6 bg-gray-50">
            <h4 className="font-medium text-gray-900 mb-3">Select an Engine</h4>
            <div className="space-y-2">
              {engines.map((engine) => (
                <button
                  key={engine.id}
                  onClick={() => handleSelectEngine(engine.id)}
                  disabled={saving}
                  className="w-full text-left p-4 bg-white rounded-lg border hover:border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{engine.name}</p>
                      <p className="text-sm text-gray-500">{engine.description}</p>
                      <p className="text-xs text-gray-400 mt-1">Domain: {engine.domain}</p>
                    </div>
                    <Server className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSelector(false)}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    )
  }

  // Engine configured - show status
  const statusColor = health?.available ? 'text-green-500' : 'text-red-500'
  const statusBg = health?.available
    ? 'bg-green-50 border-green-200'
    : 'bg-red-50 border-red-200'

  return (
    <div className={cn('bg-white rounded-lg border', statusBg)}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              health?.available ? 'bg-green-100' : 'bg-red-100'
            )}>
              {health?.available ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Ground Truth: {config.engineName}
              </h3>
              <p className="text-sm text-gray-600">
                {health?.available ? (
                  <>Engine online {health.latency && <span className="text-gray-400">({health.latency}ms)</span>}</>
                ) : (
                  <span className="text-red-600">{health?.error || 'Engine offline'}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">{config.engineUrl}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-md transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
            <button
              onClick={handleRemoveEngine}
              disabled={saving}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-white/50 rounded-md transition-colors"
              title="Remove engine"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Verification info */}
        <div className="mt-4 pt-4 border-t border-gray-200/50">
          <p className="text-sm text-gray-600">
            <CheckCircle2 className="w-4 h-4 inline mr-1 text-green-500" />
            Teaching content will be verified against this engine during generation.
            Look for the <span className="font-medium text-green-600">Verified</span> badge on generated artifacts.
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Component renders loading state
- [ ] Shows CTA when no engine configured
- [ ] Engine selector displays available engines
- [ ] Selected engine shows health status
- [ ] Refresh button updates health
- [ ] Remove button disables engine
- [ ] All states styled appropriately

---

### Task 2.3: Integrate GroundTruthEngineManager into Project Page
**Description:** Add the new component to project detail page near Teaching Pipeline
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** None

**Implementation - Update app/projects/[id]/page.tsx:**

Replace the current Ground Truth Engine Status section:
```tsx
// REMOVE THIS:
{/* Ground Truth Engine Status */}
<div className="mb-8">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">Ground Truth Engine</h2>
  <EngineHealthStatus projectId={id} />
</div>

// ADD THIS (before GuruTeachingManager):
{/* Ground Truth Verification */}
<div className="mb-8">
  <GroundTruthEngineManager projectId={id} />
</div>

{/* Guru Teaching Pipeline */}
<div className="mb-8">
  <GuruTeachingManager projectId={id} />
</div>
```

**Update imports:**
```tsx
// Remove:
import { EngineHealthStatus } from '@/components/ground-truth/EngineHealthStatus';

// Add:
import { GroundTruthEngineManager } from '@/components/ground-truth/GroundTruthEngineManager';
```

**Acceptance Criteria:**
- [ ] Old EngineHealthStatus removed from page
- [ ] GroundTruthEngineManager appears before Teaching Pipeline
- [ ] Page renders without errors
- [ ] Ground truth functionality accessible to users

---

## Phase 3: Version Dropdown UI

### Task 3.1: Create VersionDropdown Component
**Description:** Dropdown component for version selection in artifact header
**Size:** Medium
**Priority:** Medium
**Dependencies:** None (can start in parallel with Phase 2)
**Can run parallel with:** Tasks 2.1-2.3

**Implementation - components/artifacts/VersionDropdown.tsx:**
```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Version {
  id: string
  version: number
  generatedAt: string
  corpusHash: string | null
}

interface VersionDropdownProps {
  versions: Version[]
  currentVersion: number
}

export function VersionDropdown({ versions, currentVersion }: VersionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Sort versions newest first
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version)
  const latestVersion = sortedVersions[0]?.version || 0
  const currentVersionData = versions.find(v => v.version === currentVersion)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleVersionSelect(version: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (version === latestVersion) {
      params.delete('v')
    } else {
      params.set('v', version.toString())
    }
    const queryString = params.toString()
    const url = queryString ? `${pathname}?${queryString}` : pathname
    router.push(url)
    setIsOpen(false)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors',
          'bg-blue-100 text-blue-800 hover:bg-blue-200'
        )}
        data-testid="version-dropdown-trigger"
      >
        <span>v{currentVersion}</span>
        {currentVersion === latestVersion && (
          <span className="text-xs bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded">
            Latest
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border py-1 z-50"
          data-testid="version-dropdown-menu"
        >
          <div className="px-3 py-2 border-b">
            <p className="text-xs font-medium text-gray-500 uppercase">Version History</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {sortedVersions.map((version) => (
              <button
                key={version.id}
                onClick={() => handleVersionSelect(version.version)}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between',
                  version.version === currentVersion && 'bg-blue-50'
                )}
                data-testid={`version-option-${version.version}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">v{version.version}</span>
                    {version.version === latestVersion && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(version.generatedAt)}
                  </p>
                </div>
                {version.version === currentVersion && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Dropdown shows current version with "Latest" badge if applicable
- [ ] Click opens dropdown with all versions
- [ ] Versions sorted newest first
- [ ] Each version shows "v{N} - {date}" format
- [ ] Clicking version navigates via URL params
- [ ] Dropdown closes on outside click
- [ ] Current version has checkmark indicator

---

### Task 3.2: Update ArtifactHeader to Use VersionDropdown
**Description:** Replace static version badge with dropdown
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 3.1
**Can run parallel with:** None

**Implementation - Update components/artifacts/ArtifactHeader.tsx:**

**Update interface:**
```typescript
interface ArtifactHeaderProps {
  artifact: ArtifactDetail;
  projectId: string;
  // Add new prop for versions
  versions?: Array<{
    id: string;
    version: number;
    generatedAt: string;
    corpusHash: string | null;
  }>;
  // ... existing props
}
```

**Update imports:**
```typescript
import { VersionDropdown } from './VersionDropdown';
```

**Replace version badge (around line 105-110):**
```typescript
// BEFORE:
<span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
  v{artifact.version}
</span>

// AFTER:
{versions && versions.length > 0 ? (
  <VersionDropdown
    versions={versions}
    currentVersion={artifact.version}
  />
) : (
  <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
    v{artifact.version}
  </span>
)}
```

**Acceptance Criteria:**
- [ ] ArtifactHeader accepts optional `versions` prop
- [ ] When versions provided, renders VersionDropdown
- [ ] Fallback to static badge when no versions
- [ ] No breaking changes to existing usage

---

### Task 3.3: Update ArtifactViewerWithVersions Layout
**Description:** Remove VersionHistoryPanel sidebar, adjust layout to 2 panels
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.2
**Can run parallel with:** None

**Implementation - Update components/artifacts/ArtifactViewerWithVersions.tsx:**

**Remove import:**
```typescript
// REMOVE:
import VersionHistoryPanel from './VersionHistoryPanel';
```

**Update props interface:**
```typescript
interface Props {
  projectId: string;
  artifact: GuruArtifact;
  allVersions: ArtifactSummary[];  // Pass to header instead of sidebar
  // ... other props
}
```

**Update layout (remove left sidebar):**
```typescript
// BEFORE (3-panel):
<div className="flex h-full">
  {/* LEFT: Version History Panel - w-48 */}
  <VersionHistoryPanel
    projectId={projectId}
    artifactType={artifactType}
    versions={allVersions}
    currentVersion={artifact.version}
  />

  {/* RIGHT: Main Content Area - flex-1 */}
  <div className="flex-1 flex flex-col">
    <ArtifactHeader artifact={artifact} ... />
    ...
  </div>
</div>

// AFTER (2-panel - version in header):
<div className="flex h-full flex-col">
  {/* HEADER with version dropdown */}
  <ArtifactHeader
    artifact={artifact}
    versions={allVersions}  // Pass versions to header
    ...
  />

  {/* CONTENT: TOC + Main (when in rendered mode) */}
  <div className="flex-1 flex overflow-hidden">
    {viewMode === 'rendered' && (
      <>
        <TableOfContents ... />  {/* Can now be wider */}
        <div className="flex-1 overflow-y-auto">
          <TypeSpecificRenderer artifact={artifact} />
        </div>
      </>
    )}
    {viewMode === 'markdown' && <DiffContent ... />}
    {viewMode === 'json' && <JsonPreview ... />}
  </div>
</div>
```

**Acceptance Criteria:**
- [ ] VersionHistoryPanel no longer rendered
- [ ] Layout is now 2-panel (TOC + content)
- [ ] Versions passed to ArtifactHeader
- [ ] All view modes still work
- [ ] No horizontal space wasted on version sidebar

---

### Task 3.4: Update Artifact Pages to Pass Versions
**Description:** Ensure artifact page components pass versions to viewer
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 3.3
**Can run parallel with:** None

**Files to check/update:**
- `app/projects/[id]/artifacts/teaching/mental-model/page.tsx`
- `app/projects/[id]/artifacts/teaching/curriculum/page.tsx`
- `app/projects/[id]/artifacts/teaching/drill-series/page.tsx`

These pages already pass `allVersions` to `ArtifactViewerWithVersions`. Verify the prop is correctly passed through to `ArtifactHeader`.

**Acceptance Criteria:**
- [ ] All three artifact pages load correctly
- [ ] Version dropdown works on mental-model page
- [ ] Version dropdown works on curriculum page
- [ ] Version dropdown works on drill-series page
- [ ] URL-based version switching works

---

## Phase 4: Cleanup & Testing

### Task 4.1: Remove Deprecated Files and Components
**Description:** Clean up old files no longer needed
**Size:** Small
**Priority:** Low
**Dependencies:** Tasks 3.1-3.4
**Can run parallel with:** Task 4.2

**Files to delete:**
1. `components/artifacts/VersionHistoryPanel.tsx` - Replaced by VersionDropdown
2. `components/project/ContentValidationToggle.tsx` - Orphaned, never used

**Files to review (may have dead imports):**
- `components/ground-truth/EngineHealthStatus.tsx` - Check if still needed anywhere
- `components/assessment/AssessmentCard.tsx` - Remove any ground truth references

**Update imports in:**
- Any file that imported VersionHistoryPanel
- Any file that imported ContentValidationToggle

**Acceptance Criteria:**
- [ ] VersionHistoryPanel.tsx deleted
- [ ] ContentValidationToggle.tsx deleted
- [ ] No broken imports
- [ ] TypeScript compiles without errors
- [ ] App runs without runtime errors

---

### Task 4.2: Update Ground Truth Health API (Optional Cleanup)
**Description:** Update existing health endpoint to use new models
**Size:** Small
**Priority:** Low
**Dependencies:** Task 1.3
**Can run parallel with:** Task 4.1

**Implementation - Update app/api/projects/[id]/ground-truth/health/route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireProjectOwnership } from '@/lib/auth'
import { resolveGroundTruthConfig, checkEngineHealth } from '@/lib/groundTruth/config'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params

    await requireProjectOwnership(projectId)

    const config = await resolveGroundTruthConfig(projectId)

    if (!config) {
      return NextResponse.json({
        configured: false,
        available: false,
        checkedAt: new Date().toISOString()
      }, {
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    const health = await checkEngineHealth(config)

    return NextResponse.json({
      configured: true,
      available: health.available,
      latency: health.latency,
      error: health.error,
      engineUrl: config.engineUrl,
      engineName: config.engineName,
      checkedAt: new Date().toISOString()
    }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[GET /api/projects/[id]/ground-truth/health] Error:', error)
    return NextResponse.json({ error: 'Failed to check health' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- [ ] Health endpoint uses new resolveGroundTruthConfig
- [ ] Response includes engineName
- [ ] Cache-Control header present
- [ ] Auth checks work

---

### Task 4.3: E2E Testing
**Description:** Verify all functionality works end-to-end
**Size:** Medium
**Priority:** High
**Dependencies:** All previous tasks
**Can run parallel with:** None

**Test scenarios:**

1. **Ground Truth Engine Management:**
   - Visit project without ground truth configured
   - Click "Add Ground Truth Engine"
   - Select GNU Backgammon
   - Verify engine shows as online
   - Remove engine
   - Verify CTA returns

2. **Version Dropdown:**
   - Visit artifact page with multiple versions
   - Click version dropdown
   - Verify all versions shown with dates
   - Select older version
   - Verify URL changes to ?v=N
   - Verify content changes
   - Select "Latest" version
   - Verify URL removes ?v param

3. **Ground Truth Verification:**
   - Enable ground truth on project
   - Generate new drill series
   - Verify artifact shows verification badge
   - Click badge to see details

**Acceptance Criteria:**
- [ ] Ground truth can be enabled/disabled via UI
- [ ] Version dropdown works on all artifact pages
- [ ] No console errors
- [ ] No broken layouts
- [ ] TypeScript compiles clean
- [ ] Existing tests pass

---

### Task 4.4: Update CLAUDE.md Documentation
**Description:** Update project documentation with new ground truth architecture
**Size:** Small
**Priority:** Low
**Dependencies:** All previous tasks
**Can run parallel with:** Task 4.3

**Updates needed:**

1. **Ground Truth section:** Update to describe standalone model, remove assessment coupling references

2. **Add new key files:**
   - `components/ground-truth/GroundTruthEngineManager.tsx`
   - `app/api/ground-truth-engines/route.ts`
   - `app/api/projects/[id]/ground-truth-engine/route.ts`

3. **Remove references to:**
   - `ContentValidationToggle.tsx`
   - `VersionHistoryPanel.tsx`
   - Assessment-based ground truth configuration

**Acceptance Criteria:**
- [ ] CLAUDE.md reflects new architecture
- [ ] Ground Truth section updated
- [ ] File references accurate
- [ ] No outdated information

---

## Summary

| Phase | Tasks | Est. Size | Priority |
|-------|-------|-----------|----------|
| Phase 1: Database | 3 tasks | Medium | High |
| Phase 2: Ground Truth UI | 3 tasks | Large | High |
| Phase 3: Version Dropdown | 4 tasks | Medium | Medium |
| Phase 4: Cleanup | 4 tasks | Small | Low |

**Total Tasks:** 14
**Critical Path:** 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3
**Parallel Work:** Phase 3 can start alongside Phase 2

**Execution Order:**
1. Phase 1 (foundation - must complete first)
2. Phase 2 + Phase 3 (can run in parallel)
3. Phase 4 (cleanup after features complete)
