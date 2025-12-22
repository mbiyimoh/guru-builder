# Ground Truth Engine Developer Guide

**Created:** 2025-12-16
**Purpose:** Understanding the ground truth verification system for teaching content

---

## Overview

Ground Truth engines are external verification systems (like GNU Backgammon) that validate the mathematical correctness of generated teaching content. When enabled, the system:

1. Extracts verifiable claims from generated artifacts
2. Queries the ground truth engine to verify each claim
3. Records verification status and details on the artifact

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GROUND TRUTH VERIFICATION                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ GroundTruth     │     │ ProjectGround   │     │ GroundTruth     │
│ Engine          │◀────│ TruthConfig     │────▶│ Engine Server   │
│ (Catalog)       │     │ (per-project)   │     │ (External MCP)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Artifact Generation  │
                    │  (Curriculum, Drills) │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Claim Extraction    │
                    │ (moves, equities, etc)│
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Claim Verification  │
                    │  (query engine)       │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Verification Status  │
                    │ (VERIFIED/NEEDS_REVIEW)│
                    └───────────────────────┘
```

---

## Database Models

### GroundTruthEngine (Catalog)

Admin-seeded catalog of available verification engines:

```prisma
model GroundTruthEngine {
  id          String   @id @default(cuid())
  name        String   // "GNU Backgammon"
  domain      String   // "backgammon"
  engineUrl   String   // MCP server URL
  description String?  @db.Text
  iconUrl     String?
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projectConfigs ProjectGroundTruthConfig[]
  positions      PositionLibrary[]
}
```

### ProjectGroundTruthConfig (Per-Project)

Links projects to their chosen ground truth engine:

```prisma
model ProjectGroundTruthConfig {
  id        String   @id @default(cuid())
  projectId String
  engineId  String
  isEnabled Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project   Project           @relation(...)
  engine    GroundTruthEngine @relation(...)

  @@unique([projectId, engineId])
}
```

---

## Key Files

### Configuration
- `lib/groundTruth/config.ts` - Resolve project's ground truth config
- `lib/groundTruth/types.ts` - TypeScript interfaces

### Verification
- `lib/groundTruth/verification/claimExtractor.ts` - Extract claims from content
- `lib/groundTruth/verification/verifier.ts` - Verify claims against engine
- `lib/groundTruth/verification/types.ts` - Claim and verification types

### Engine Communication
- `lib/groundTruth/executor.ts` - Execute queries against engine
- `lib/groundTruth/tools.ts` - OpenAI function calling tools
- `lib/groundTruth/cache.ts` - Response caching

### UI Components
- `components/ground-truth/GroundTruthEngineManager.tsx` - Engine selection UI
- `components/artifacts/VerificationBadge.tsx` - Status badge
- `components/artifacts/VerificationDetailsModal.tsx` - Detailed results

### API Routes
- `app/api/ground-truth-engines/route.ts` - Engine catalog
- `app/api/projects/[id]/ground-truth-config/route.ts` - Project config CRUD

---

## Configuration Flow

### 1. Admin Seeds Engines

```bash
npm run seed:ground-truth-engines
```

Creates the engine catalog entry:

```typescript
// prisma/seeds/seed-ground-truth-engines.ts
await prisma.groundTruthEngine.upsert({
  where: { id: 'gnubg-default' },
  create: {
    id: 'gnubg-default',
    name: 'GNU Backgammon',
    domain: 'backgammon',
    engineUrl: 'https://gnubg-mcp-d1c3c7a814e8.herokuapp.com',
    description: 'World-class backgammon analysis engine...',
    isActive: true
  }
});
```

### 2. User Enables Engine for Project

Via `GroundTruthEngineManager` component or API:

```typescript
// POST /api/projects/[id]/ground-truth-config
await fetch(`/api/projects/${projectId}/ground-truth-config`, {
  method: 'POST',
  body: JSON.stringify({ engineId: 'gnubg-default' })
});
```

### 3. System Resolves Config

```typescript
// lib/groundTruth/config.ts
export async function resolveGroundTruthConfig(
  projectId: string
): Promise<GroundTruthConfig | null> {
  const config = await prisma.projectGroundTruthConfig.findFirst({
    where: {
      projectId,
      isEnabled: true,
      engine: { isActive: true }
    },
    include: { engine: true }
  });

  if (!config) return null;

  return {
    enabled: true,
    engineUrl: config.engine.engineUrl,
    engineId: config.engine.id,
    engineName: config.engine.name,
    projectConfigId: config.id
  };
}
```

---

## Verification Process

### 1. Extract Claims

Claims are extracted from generated content:

```typescript
// lib/groundTruth/verification/claimExtractor.ts
export function extractVerifiableClaims(
  content: CurriculumOutput | DrillSeriesOutput
): VerifiableClaim[] {
  const claims: VerifiableClaim[] = [];

  // Extract move recommendations
  for (const drill of content.drills || []) {
    if (drill.correctAnswer) {
      claims.push({
        type: 'BEST_MOVE',
        content: drill.correctAnswer,
        extractedMove: parseMove(drill.correctAnswer),
        sourcePosition: drill.positionId
      });
    }
  }

  // Extract equity claims
  // ...

  return claims;
}
```

### 2. Verify Each Claim

```typescript
// lib/groundTruth/verification/verifier.ts
export async function verifyClaim(
  claim: VerifiableClaim,
  config: GroundTruthConfig
): Promise<ClaimVerification> {
  const engineResult = await queryEngine(config.engineUrl, claim);

  return {
    claim,
    passed: engineResult.matches,
    engineResponse: engineResult.data,
    errorMargin: engineResult.margin
  };
}
```

### 3. Calculate Status

```typescript
const results = await verifyAllClaims(claims, gtConfig);
const failedCount = results.filter(r => !r.passed).length;
const failureRate = failedCount / results.length;

let status: VerificationStatus;
if (failedCount === 0) {
  status = 'VERIFIED';
} else if (failureRate > 0.3) {
  status = 'NEEDS_REVIEW';  // >30% failed
} else {
  status = 'VERIFIED';  // Some failures but < 30%
}
```

---

## Verification Status

| Status | Meaning | Badge Color |
|--------|---------|-------------|
| `VERIFIED` | All claims passed | Green |
| `NEEDS_REVIEW` | >30% claims failed | Amber |
| `UNVERIFIED` | GT not enabled | Gray |
| `FAILED` | Verification process failed | Red |

### Displayed in UI

```tsx
// components/artifacts/VerificationBadge.tsx
<span className={cn(
  'px-2 py-1 rounded text-xs font-medium',
  status === 'VERIFIED' && 'bg-green-100 text-green-700',
  status === 'NEEDS_REVIEW' && 'bg-amber-100 text-amber-700',
  status === 'FAILED' && 'bg-red-100 text-red-700',
  status === 'UNVERIFIED' && 'bg-gray-100 text-gray-500'
)}>
  {status}
</span>
```

---

## Engine Communication

### MCP Protocol

The ground truth engine exposes an MCP (Model Context Protocol) server with tools:

```typescript
// Available tools from GNU Backgammon MCP
interface EngineTools {
  analyzePosition(position: string): PositionAnalysis;
  verifyMove(position: string, move: string): MoveVerification;
  getEquity(position: string): EquityResult;
  getBestMove(position: string, dice: string): MoveRecommendation;
}
```

### Query Execution

```typescript
// lib/groundTruth/executor.ts
export async function queryEngine(
  engineUrl: string,
  query: EngineQuery
): Promise<EngineResponse> {
  const response = await fetch(`${engineUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(ENGINE_QUERY_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`Engine query failed: ${response.status}`);
  }

  return response.json();
}
```

### Caching

Responses are cached to reduce engine load:

```typescript
// lib/groundTruth/cache.ts
const CACHE_TTL = {
  OPENING_POSITIONS: 7 * 24 * 60 * 60 * 1000,  // 7 days
  SPECIFIC_POSITIONS: 24 * 60 * 60 * 1000,     // 24 hours
  MOVE_VERIFICATIONS: 60 * 60 * 1000           // 1 hour
};
```

---

## Health Checking

### Engine Health Endpoint

```typescript
// lib/groundTruth/config.ts
export async function checkEngineHealth(
  config: GroundTruthConfig
): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${config.engineUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    const latency = Date.now() - startTime;

    return {
      available: response.ok,
      latency,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime
    };
  }
}
```

### Health Display in UI

```tsx
// In GroundTruthEngineManager.tsx
{health?.available ? (
  <span className="text-green-600">
    Engine online ({health.latency}ms)
  </span>
) : (
  <span className="text-red-600">
    {health?.error || 'Engine offline'}
  </span>
)}
```

---

## Limits and Thresholds

```typescript
// lib/groundTruth/constants.ts
export const ENGINE_QUERY_TIMEOUT = 10_000;      // 10 seconds
export const MAX_TOOL_CALLS = 100;               // Per generation
export const MAX_ITERATIONS = 50;                // Per generation
export const MAX_REGENERATION_ATTEMPTS = 5;
export const VERIFICATION_FAILURE_THRESHOLD = 0.3; // 30%
```

---

## Error Handling

### Common Errors

1. **Engine Timeout**
   ```
   Error: Engine query timed out after 10s
   ```
   - Check engine URL is correct
   - Verify engine is running
   - Consider increasing timeout

2. **Engine Unavailable**
   ```
   Error: Connection refused to engine URL
   ```
   - Check engine health endpoint
   - Verify network connectivity
   - Engine may be down

3. **Invalid Position**
   ```
   Error: Cannot parse position format
   ```
   - Check XGID or position format
   - Verify position is valid for the engine

### Graceful Degradation

Verification failures don't block artifact completion:

```typescript
try {
  const verification = await verifyAllClaims(claims, gtConfig);
  await saveVerificationResults(artifactId, verification);
} catch (error) {
  console.error('Verification failed:', error);
  await prisma.guruArtifact.update({
    where: { id: artifactId },
    data: {
      verificationStatus: 'FAILED',
      verificationDetails: { error: error.message }
    }
  });
  // Artifact still saves with FAILED status, not blocked
}
```

---

## API Reference

### GET /api/ground-truth-engines

List available engines:

```typescript
// Response
{
  engines: [
    {
      id: "gnubg-default",
      name: "GNU Backgammon",
      domain: "backgammon",
      description: "...",
      isActive: true
    }
  ]
}
```

### GET /api/projects/[id]/ground-truth-config

Get project's ground truth config:

```typescript
// Response (configured)
{
  configured: true,
  config: {
    id: "config-123",
    engineId: "gnubg-default",
    engineName: "GNU Backgammon",
    isEnabled: true
  },
  health: {
    available: true,
    latency: 150
  }
}

// Response (not configured)
{
  configured: false,
  config: null
}
```

### POST /api/projects/[id]/ground-truth-config

Enable engine for project:

```typescript
// Request
{ engineId: "gnubg-default" }

// Response
{
  success: true,
  config: { ... }
}
```

### DELETE /api/projects/[id]/ground-truth-config

Disable ground truth for project:

```typescript
// Response
{ success: true }
```

---

## Related Documentation

- `developer-guides/09-drill-series-generation-guide.md` - How verification integrates
- `developer-guides/10-position-library-guide.md` - Position seeding from engine
- `specs/completed/feat-ground-truth-content-validation/` - Original specification
- `specs/completed/decouple-ground-truth-simplify-version-ui/` - Decoupling spec
- `lib/groundTruth/` - Source code
