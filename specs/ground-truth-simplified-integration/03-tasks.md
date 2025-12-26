# Task Breakdown: Ground Truth Engine & Position Library Integration

**Generated:** 2025-12-24
**Source:** `specs/ground-truth-simplified-integration/02-specification.md`
**Mode:** Full (first-time decompose)
**Last Decompose:** 2025-12-24

---

## Overview

Integrate Ground Truth Engine and Position Library functionality into the simplified frontend wizard experience. This enables non-technical users to benefit from mathematically verified drills without navigating admin interfaces.

**Key Components:**
1. Domain detection after profile creation
2. AccuracyToolsPanel on teaching artifacts page
3. Position threshold validation for drill generation
4. Self-play auth relaxation for project owners

---

## Phase 1: Domain Detection Infrastructure

### Task 1.1: Create domain keyword definitions

**Description:** Define backgammon keywords for domain detection matching
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (foundation)

**Files to create:**
- `lib/domainDetection/keywords.ts`

**Implementation:**

```typescript
// lib/domainDetection/keywords.ts

/**
 * Keywords for detecting backgammon domain in profile content.
 * Case-insensitive matching applied by caller.
 */
export const BACKGAMMON_KEYWORDS = [
  'backgammon',
  'doubling cube',
  'pip count',
  'bearing off',
  'blot',
  'anchor',
  'prime',
  'gammon',
  'match play',
  'money game',
  'jacoby rule',
  'crawford rule',
  'checker play',
  'cube decision',
  'equity',
  'take point',
  'pass point',
  'gnubg',
  'xg',
] as const;

/**
 * Map domain names to their keyword arrays.
 * Extensible for future domains (chess, poker, etc.)
 */
export const DOMAIN_KEYWORDS: Record<string, readonly string[]> = {
  backgammon: BACKGAMMON_KEYWORDS,
};

/**
 * Get all keywords for a specific domain.
 */
export function getKeywordsForDomain(domain: string): readonly string[] {
  return DOMAIN_KEYWORDS[domain] ?? [];
}

/**
 * Check if content matches any keyword for a domain.
 * Returns matched keywords for transparency.
 */
export function matchDomainKeywords(
  content: string,
  domain: string
): string[] {
  const keywords = getKeywordsForDomain(domain);
  const lowerContent = content.toLowerCase();

  return keywords.filter(keyword =>
    lowerContent.includes(keyword.toLowerCase())
  );
}
```

**Acceptance Criteria:**
- [ ] BACKGAMMON_KEYWORDS exported with all 19 keywords from spec
- [ ] DOMAIN_KEYWORDS map allows future domain extension
- [ ] matchDomainKeywords returns matched keywords array
- [ ] Case-insensitive matching works correctly

---

### Task 1.2: Create domain detection utility

**Description:** Implement core domain detection logic that analyzes profile content
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Files to create:**
- `lib/domainDetection/detectDomain.ts`
- `lib/domainDetection/index.ts`

**Implementation:**

```typescript
// lib/domainDetection/detectDomain.ts
import { prisma } from '@/lib/db';
import { matchDomainKeywords, DOMAIN_KEYWORDS } from './keywords';

export interface DomainDetectionResult {
  detected: boolean;
  domain: string | null;
  matchedKeywords: string[];
  suggestedEngine: {
    id: string;
    name: string;
    description: string;
  } | null;
}

/**
 * Detect domain from raw profile content string.
 * Scans for keywords and queries for matching GT engine.
 */
export async function detectDomainFromProfile(
  profileContent: string
): Promise<DomainDetectionResult> {
  // Check each known domain for keyword matches
  for (const domain of Object.keys(DOMAIN_KEYWORDS)) {
    const matchedKeywords = matchDomainKeywords(profileContent, domain);

    if (matchedKeywords.length > 0) {
      // Found a match - look for GT engine
      const engine = await prisma.groundTruthEngine.findFirst({
        where: {
          domain: domain,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      return {
        detected: true,
        domain,
        matchedKeywords,
        suggestedEngine: engine ? {
          id: engine.id,
          name: engine.name,
          description: engine.description ?? '',
        } : null,
      };
    }
  }

  // No domain detected
  return {
    detected: false,
    domain: null,
    matchedKeywords: [],
    suggestedEngine: null,
  };
}

/**
 * Detect domain from a project's profile data.
 * Extracts relevant text fields and combines for analysis.
 */
export async function detectDomainFromProject(
  projectId: string
): Promise<DomainDetectionResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      subjectArea: true,
      targetAudience: true,
      teachingStyle: true,
      brainDump: true,
    },
  });

  if (!project) {
    return {
      detected: false,
      domain: null,
      matchedKeywords: [],
      suggestedEngine: null,
    };
  }

  // Combine all profile text fields
  const profileContent = [
    project.subjectArea,
    project.targetAudience,
    project.teachingStyle,
    project.brainDump,
  ].filter(Boolean).join(' ');

  return detectDomainFromProfile(profileContent);
}
```

```typescript
// lib/domainDetection/index.ts
export {
  detectDomainFromProfile,
  detectDomainFromProject,
  type DomainDetectionResult
} from './detectDomain';

export {
  BACKGAMMON_KEYWORDS,
  DOMAIN_KEYWORDS,
  matchDomainKeywords,
  getKeywordsForDomain
} from './keywords';
```

**Acceptance Criteria:**
- [ ] detectDomainFromProfile analyzes raw text content
- [ ] detectDomainFromProject loads project and extracts profile fields
- [ ] Returns detected: true when keywords found
- [ ] Queries GroundTruthEngine table for matching active engine
- [ ] Returns suggestedEngine with id, name, description
- [ ] Barrel exports work correctly

---

### Task 1.3: Create domain detection API endpoint

**Description:** Create POST endpoint for domain detection
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1

**Files to create:**
- `app/api/projects/[id]/detect-domain/route.ts`

**Implementation:**

```typescript
// app/api/projects/[id]/detect-domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { detectDomainFromProject, type DomainDetectionResult } from '@/lib/domainDetection';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DomainDetectionResult | { error: string }>> {
  try {
    // Verify user is authenticated
    const session = await checkAuth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Run domain detection
    const result = await detectDomainFromProject(projectId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Domain detection error:', error);

    // Fail silently per spec - return "not detected" on error
    return NextResponse.json({
      detected: false,
      domain: null,
      matchedKeywords: [],
      suggestedEngine: null,
    });
  }
}
```

**Acceptance Criteria:**
- [ ] POST /api/projects/[id]/detect-domain works
- [ ] Returns DomainDetectionResult JSON
- [ ] Auth check prevents unauthorized access
- [ ] Errors fail silently (return detected: false)
- [ ] Uses force-dynamic for fresh results

---

## Phase 2: Accuracy Tools Panel Component

### Task 2.1: Create AccuracyToolsPanel component

**Description:** Build collapsible panel showing GT status, position counts, and Generate More button
**Size:** Large
**Priority:** High
**Dependencies:** None (uses existing APIs)
**Can run parallel with:** Task 1.3, Task 3.1

**Files to create:**
- `components/artifacts/AccuracyToolsPanel.tsx`

**Implementation:**

```typescript
// components/artifacts/AccuracyToolsPanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Zap, AlertCircle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccuracyToolsPanelProps {
  projectId: string;
}

interface PositionCounts {
  OPENING: number;
  EARLY: number;
  MIDDLE: number;
  BEAROFF: number;
}

interface AccuracyToolsState {
  isEnabled: boolean;
  engineName: string | null;
  engineId: string | null;
  engineStatus: 'online' | 'offline' | 'checking';
  latency: number | null;
  positionCounts: PositionCounts;
  isCollapsed: boolean;
  isGenerating: boolean;
  activeBatchId: string | null;
  error: string | null;
}

const COLLAPSE_KEY = 'guru-accuracy-tools-collapsed';
const WARNING_THRESHOLD = 100;
const MINIMUM_POSITIONS = 21;

export function AccuracyToolsPanel({ projectId }: AccuracyToolsPanelProps) {
  const [state, setState] = useState<AccuracyToolsState>({
    isEnabled: false,
    engineName: null,
    engineId: null,
    engineStatus: 'checking',
    latency: null,
    positionCounts: { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 },
    isCollapsed: true,
    isGenerating: false,
    activeBatchId: null,
    error: null,
  });

  // Load collapse state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(COLLAPSE_KEY);
    if (savedState !== null) {
      setState(prev => ({ ...prev, isCollapsed: savedState === 'true' }));
    }
  }, []);

  // Fetch GT config and position counts
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        credentials: 'include',
      });

      if (!res.ok) {
        setState(prev => ({
          ...prev,
          isEnabled: false,
          engineStatus: 'offline'
        }));
        return;
      }

      const data = await res.json();

      if (data.config?.enabled && data.config?.engineId) {
        // Fetch position counts
        const countsRes = await fetch(
          `/api/position-library/counts?engineId=${data.config.engineId}`,
          { credentials: 'include' }
        );

        const counts = countsRes.ok ? await countsRes.json() : {
          OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0
        };

        // Check engine health
        const healthRes = await fetch(
          `/api/ground-truth/health?engineId=${data.config.engineId}`,
          { credentials: 'include' }
        );

        const health = healthRes.ok ? await healthRes.json() : { status: 'offline' };

        setState(prev => ({
          ...prev,
          isEnabled: true,
          engineName: data.engine?.name ?? 'Unknown Engine',
          engineId: data.config.engineId,
          engineStatus: health.status === 'online' ? 'online' : 'offline',
          latency: health.latency ?? null,
          positionCounts: counts,
          isCollapsed: prev.isCollapsed && !data.config.enabled, // Expand if enabled
        }));
      } else {
        setState(prev => ({ ...prev, isEnabled: false }));
      }
    } catch (error) {
      console.error('Failed to fetch GT status:', error);
      setState(prev => ({ ...prev, error: 'Failed to load status' }));
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Toggle collapse state
  const toggleCollapse = () => {
    const newState = !state.isCollapsed;
    setState(prev => ({ ...prev, isCollapsed: newState }));
    localStorage.setItem(COLLAPSE_KEY, String(newState));
  };

  // Generate more positions
  const handleGenerateMore = async () => {
    if (!state.engineId || state.engineStatus === 'offline') return;

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const res = await fetch('/api/position-library/self-play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          engineId: state.engineId,
          gamesCount: 10,
          skipOpening: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to start generation');
      }

      const data = await res.json();
      setState(prev => ({ ...prev, activeBatchId: data.batchId }));

      // Poll for completion
      pollBatchStatus(data.batchId);
    } catch (error) {
      console.error('Generate more error:', error);
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: 'Generation failed. Try again.'
      }));
    }
  };

  // Poll batch status
  const pollBatchStatus = async (batchId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/position-library/self-play/${batchId}`, {
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Poll failed');

        const data = await res.json();

        if (data.status === 'COMPLETED') {
          setState(prev => ({
            ...prev,
            isGenerating: false,
            activeBatchId: null
          }));
          fetchStatus(); // Refresh counts
        } else if (data.status === 'FAILED') {
          setState(prev => ({
            ...prev,
            isGenerating: false,
            activeBatchId: null,
            error: 'Generation failed. Try again.'
          }));
        } else {
          // Still running, poll again
          setTimeout(poll, 3000);
        }
      } catch {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          error: 'Failed to check status'
        }));
      }
    };

    poll();
  };

  // Enable GT engine
  const handleEnable = async () => {
    try {
      // Detect domain to find engine
      const detectRes = await fetch(`/api/projects/${projectId}/detect-domain`, {
        method: 'POST',
        credentials: 'include',
      });

      const detection = await detectRes.json();

      if (!detection.suggestedEngine) {
        setState(prev => ({
          ...prev,
          error: 'No verification engine available for this domain'
        }));
        return;
      }

      // Enable GT config
      const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: true,
          engineId: detection.suggestedEngine.id,
        }),
      });

      if (!res.ok) throw new Error('Failed to enable');

      fetchStatus();
    } catch (error) {
      console.error('Enable error:', error);
      setState(prev => ({ ...prev, error: 'Failed to enable. Try again.' }));
    }
  };

  const totalPositions = Object.values(state.positionCounts).reduce((a, b) => a + b, 0);
  const nonOpeningTotal = totalPositions - state.positionCounts.OPENING;
  const showWarning = state.isEnabled && nonOpeningTotal < WARNING_THRESHOLD && nonOpeningTotal >= MINIMUM_POSITIONS;
  const showError = state.isEnabled && nonOpeningTotal < MINIMUM_POSITIONS;

  // Collapsed state (enabled)
  if (state.isCollapsed && state.isEnabled) {
    return (
      <div
        className="mx-6 mt-4 p-3 bg-muted/50 border rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={toggleCollapse}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Accuracy Tools</span>
            <span className="text-sm text-muted-foreground">{state.engineName}</span>
            <span className={cn(
              "inline-flex items-center gap-1 text-xs",
              state.engineStatus === 'online' ? 'text-green-600' : 'text-red-500'
            )}>
              <span className={cn(
                "w-2 h-2 rounded-full",
                state.engineStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
              )} />
              {state.engineStatus === 'online' ? 'Online' : 'Offline'}
            </span>
            <span className="text-sm text-muted-foreground">{totalPositions} positions</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Expanded state (enabled)
  if (state.isEnabled) {
    return (
      <div className="mx-6 mt-4 p-4 bg-muted/30 border rounded-lg">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={toggleCollapse}
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="font-medium">Accuracy Tools</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="mt-4 space-y-4">
          {/* Engine status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{state.engineName}</span>
              <span className={cn(
                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                state.engineStatus === 'online'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  state.engineStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                )} />
                {state.engineStatus === 'online'
                  ? `Connected${state.latency ? ` (${state.latency}ms)` : ''}`
                  : 'Offline'}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchStatus}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          {/* Position counts */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Position Library: {totalPositions} positions ready
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as const).map(phase => (
                <div key={phase} className="p-2 bg-background rounded border">
                  <div className="text-xs text-muted-foreground capitalize">
                    {phase.toLowerCase()}
                  </div>
                  <div className="font-mono font-medium">
                    {state.positionCounts[phase]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warning/Error messages */}
          {showError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Insufficient positions for drill generation
                </p>
                <p className="text-xs text-destructive/80">
                  At least 21 non-opening positions required
                </p>
              </div>
            </div>
          )}

          {showWarning && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Low positions ({nonOpeningTotal}). Generate more for better drill variety.
              </p>
            </div>
          )}

          {/* Error message */}
          {state.error && (
            <div className="text-sm text-destructive">{state.error}</div>
          )}

          {/* Generate More button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerateMore}
              disabled={state.isGenerating || state.engineStatus === 'offline'}
              size="sm"
            >
              {state.isGenerating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3 mr-2" />
                  Generate More
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              Adds ~100 positions to shared library
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Not enabled state
  return (
    <div className="mx-6 mt-4 p-4 bg-muted/30 border rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4" />
        <span className="font-medium">Accuracy Tools</span>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        No verification engine connected.
      </p>

      <div className="text-sm space-y-1 mb-4">
        <p>Enable accuracy tools to get:</p>
        <ul className="ml-4 space-y-1">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>Mathematically verified drill answers</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>Real game positions for practice scenarios</span>
          </li>
        </ul>
      </div>

      <Button onClick={handleEnable} size="sm" variant="outline">
        + Enable GNU Backgammon
      </Button>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Collapsible panel with localStorage persistence
- [ ] Shows engine status (online/offline with latency)
- [ ] Shows position counts by phase in grid
- [ ] "Generate More" triggers 10-game self-play batch
- [ ] Polls for batch completion and updates counts
- [ ] Shows warning if < 100 positions (excluding OPENING)
- [ ] Shows error if < 21 positions (blocks drill generation)
- [ ] "Enable" button appears when GT not configured
- [ ] Collapsed state shows summary info

---

## Phase 3: Domain Tools Prompt Component

### Task 3.1: Create DomainToolsPrompt component

**Description:** Modal/step shown after profile creation to suggest GT enablement
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** Task 2.1

**Files to create:**
- `components/wizard/DomainToolsPrompt.tsx`

**Implementation:**

```typescript
// components/wizard/DomainToolsPrompt.tsx
'use client';

import { useState } from 'react';
import { Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DomainDetectionResult } from '@/lib/domainDetection';

interface DomainToolsPromptProps {
  projectId: string;
  detectedDomain: DomainDetectionResult;
  onEnable: () => Promise<void>;
  onSkip: () => void;
}

export function DomainToolsPrompt({
  projectId,
  detectedDomain,
  onEnable,
  onSkip,
}: DomainToolsPromptProps) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async () => {
    setIsEnabling(true);
    setError(null);

    try {
      // Create GT config
      const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: true,
          engineId: detectedDomain.suggestedEngine?.id,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to enable verification');
      }

      await onEnable();
    } catch (err) {
      console.error('Enable error:', err);
      setError('Failed to enable. Please try again.');
      setIsEnabling(false);
    }
  };

  const domainTitle = detectedDomain.domain?.toUpperCase() ?? 'SPECIALIZED';
  const engineName = detectedDomain.suggestedEngine?.name ?? 'verification engine';

  return (
    <div className="p-6 bg-background border rounded-lg shadow-lg max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">
            We noticed you're creating a {domainTitle} guru!
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-4">
        Would you like to enable expert move verification?
      </p>

      <p className="text-sm mb-4">
        This connects your guru to <strong>{engineName}</strong>,
        {detectedDomain.suggestedEngine?.description && (
          <span className="text-muted-foreground">
            {' '}{detectedDomain.suggestedEngine.description.toLowerCase()}.
          </span>
        )}
        {' '}Your drills will include:
      </p>

      {/* Benefits */}
      <ul className="space-y-2 mb-6">
        <li className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Mathematically verified correct moves</span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Real game positions generated via AI self-play</span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Accurate equity calculations</span>
        </li>
      </ul>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleEnable}
          disabled={isEnabling}
          className="flex-1"
        >
          {isEnabling ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enabling...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Enable Now
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onSkip}
          disabled={isEnabling}
        >
          Skip for Now
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        You can always enable this later from the Teaching Artifacts page.
      </p>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Shows domain-specific title (e.g., "BACKGAMMON guru")
- [ ] Lists benefits with checkmarks
- [ ] "Enable Now" creates ProjectGroundTruthConfig record
- [ ] Shows loading state while enabling
- [ ] "Skip for Now" calls onSkip callback
- [ ] Shows error message if enable fails
- [ ] Helper text mentions enabling later

---

## Phase 4: Integration

### Task 4.1: Integrate AccuracyToolsPanel into teaching artifacts page

**Description:** Add AccuracyToolsPanel above artifact content
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** Task 4.2, Task 4.3

**Files to modify:**
- `components/artifacts/TeachingArtifactsContent.tsx`

**Implementation:**

```typescript
// In TeachingArtifactsContent.tsx

// Add import
import { AccuracyToolsPanel } from './AccuracyToolsPanel';

// In the component JSX, add AccuracyToolsPanel above ReadinessWarning:
<div className="flex-1 flex flex-col overflow-hidden">
  <AccuracyToolsPanel projectId={projectId} />

  {readinessScore !== undefined && readinessScore < 60 && (
    <ReadinessWarning projectId={projectId} score={readinessScore} />
  )}

  {/* ... rest of content ... */}
</div>
```

**Acceptance Criteria:**
- [ ] AccuracyToolsPanel imported and rendered
- [ ] Panel appears above ReadinessWarning
- [ ] projectId prop passed correctly

---

### Task 4.2: Integrate domain detection into profile creation flow

**Description:** Detect domain after profile creation and show DomainToolsPrompt
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.3, Task 3.1
**Can run parallel with:** Task 4.1, Task 4.3

**Files to modify:**
- `components/wizard/profile/ProfileChatMode.tsx` (or equivalent profile completion handler)

**Implementation:**

```typescript
// Add to profile completion handler

// Add imports
import { DomainToolsPrompt } from '../DomainToolsPrompt';
import type { DomainDetectionResult } from '@/lib/domainDetection';

// Add state
const [showDomainPrompt, setShowDomainPrompt] = useState(false);
const [detectedDomain, setDetectedDomain] = useState<DomainDetectionResult | null>(null);

// After successful profile creation (in handleProfileComplete or similar):
const handleProfileComplete = async () => {
  // ... existing profile save logic ...

  // Run domain detection
  try {
    const res = await fetch(`/api/projects/${projectId}/detect-domain`, {
      method: 'POST',
      credentials: 'include',
    });

    const domainResult: DomainDetectionResult = await res.json();

    if (domainResult.detected && domainResult.suggestedEngine) {
      // Show domain prompt
      setDetectedDomain(domainResult);
      setShowDomainPrompt(true);
    } else {
      // No domain detected, proceed directly
      proceedToResearch();
    }
  } catch (error) {
    console.error('Domain detection error:', error);
    // Fail silently per spec - proceed without prompt
    proceedToResearch();
  }
};

// Handle prompt callbacks
const handleDomainEnable = async () => {
  setShowDomainPrompt(false);
  proceedToResearch();
};

const handleDomainSkip = () => {
  setShowDomainPrompt(false);
  proceedToResearch();
};

// Render domain prompt when active
{showDomainPrompt && detectedDomain && (
  <DomainToolsPrompt
    projectId={projectId}
    detectedDomain={detectedDomain}
    onEnable={handleDomainEnable}
    onSkip={handleDomainSkip}
  />
)}
```

**Acceptance Criteria:**
- [ ] Domain detection called after profile completion
- [ ] DomainToolsPrompt shown when domain detected
- [ ] "Enable Now" creates config and proceeds to research
- [ ] "Skip for Now" proceeds to research without enabling
- [ ] Errors fail silently (proceed without prompt)

---

### Task 4.3: Add GT status to readiness page

**Description:** Show GT status section on readiness page when enabled
**Size:** Small
**Priority:** Medium
**Dependencies:** None
**Can run parallel with:** Task 4.1, Task 4.2

**Files to modify:**
- `app/projects/[id]/readiness/ReadinessPageContent.tsx`

**Implementation:**

```typescript
// Add imports
import { CheckCircle2 } from 'lucide-react';
import { resolveGroundTruthConfig } from '@/lib/groundTruth/config';

// In the component, fetch GT status (can be in page.tsx server component or client component):

// Server-side (in page.tsx if RSC):
const gtConfig = await resolveGroundTruthConfig(projectId);
let positionCounts = null;
if (gtConfig?.enabled) {
  const counts = await prisma.positionLibrary.groupBy({
    by: ['gamePhase'],
    where: { engineId: gtConfig.engineId },
    _count: true,
  });
  positionCounts = counts.reduce((acc, c) => {
    acc[c.gamePhase] = c._count;
    return acc;
  }, {} as Record<string, number>);
}

// Pass to component:
<ReadinessPageContent
  projectId={projectId}
  gtEnabled={!!gtConfig?.enabled}
  gtEngineName={gtConfig?.engine?.name}
  positionCount={positionCounts ? Object.values(positionCounts).reduce((a, b) => a + b, 0) : 0}
/>

// In ReadinessPageContent, add GT status section:
{gtEnabled && (
  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <span className="font-medium">Accuracy Tools Enabled</span>
    </div>
    <p className="text-sm text-muted-foreground mt-1">
      {gtEngineName} connected with {positionCount} positions
    </p>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] GT status section appears when enabled
- [ ] Shows engine name and total position count
- [ ] Green styling indicates positive status
- [ ] Section hidden when GT not enabled

---

## Phase 5: Validation & Thresholds

### Task 5.1: Add checkProjectOwnerOrAdmin auth helper

**Description:** Create auth helper that allows project owners or admins
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None

**Files to modify:**
- `lib/auth.ts`

**Implementation:**

```typescript
// Add to lib/auth.ts

/**
 * Check if current user is the project owner or an admin.
 * Returns session if authorized, null otherwise.
 */
export async function checkProjectOwnerOrAdmin(
  projectId: string
): Promise<Session | null> {
  const session = await checkAuth();
  if (!session?.user?.id) return null;

  // Check if admin
  const isAdmin = session.user.email === process.env.ADMIN_EMAIL;
  if (isAdmin) return session;

  // Check if project owner
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (project?.userId === session.user.id) {
    return session;
  }

  return null;
}
```

**Acceptance Criteria:**
- [ ] Returns session for admin users
- [ ] Returns session for project owner
- [ ] Returns null for non-owner/non-admin
- [ ] Handles missing project gracefully

---

### Task 5.2: Add position validation to drill series generation

**Description:** Block drill generation if insufficient positions in library
**Size:** Medium
**Priority:** High
**Dependencies:** None
**Can run parallel with:** Task 5.3

**Files to modify:**
- `app/api/projects/[id]/guru/drill-series/route.ts`

**Implementation:**

```typescript
// Add near the start of the POST handler, after GT config resolution:

const gtConfig = await resolveGroundTruthConfig(projectId);

if (gtConfig?.enabled) {
  // Count positions by phase
  const counts = await prisma.positionLibrary.groupBy({
    by: ['gamePhase'],
    where: { engineId: gtConfig.engineId },
    _count: true,
  });

  // Calculate non-opening total
  const totalNonOpening = counts
    .filter(c => c.gamePhase !== 'OPENING')
    .reduce((sum, c) => sum + c._count, 0);

  // Hard block if below minimum
  if (totalNonOpening < 21) {
    return NextResponse.json({
      error: 'Insufficient positions in library',
      details: 'At least 21 non-opening positions required for drill generation. Use "Generate More" in Accuracy Tools to add positions.',
      positionCounts: counts.reduce((acc, c) => {
        acc[c.gamePhase] = c._count;
        return acc;
      }, {} as Record<string, number>),
    }, { status: 400 });
  }

  // Optional: Add warning header if below threshold
  const headers = new Headers();
  if (totalNonOpening < 100) {
    headers.set('X-Position-Warning', `Low positions (${totalNonOpening}). Consider generating more.`);
  }
}

// ... continue with generation ...
```

**Acceptance Criteria:**
- [ ] Returns 400 if < 21 non-opening positions
- [ ] Error response includes position counts
- [ ] Error message is user-friendly
- [ ] OPENING phase (21 positions) excluded from count
- [ ] Generation proceeds normally if >= 21 positions

---

### Task 5.3: Relax self-play auth for project owners

**Description:** Allow project owners (not just admins) to trigger self-play
**Size:** Small
**Priority:** High
**Dependencies:** Task 5.1
**Can run parallel with:** Task 5.2

**Files to modify:**
- `app/api/position-library/self-play/route.ts`

**Implementation:**

```typescript
// Replace checkAdminAuth() with checkProjectOwnerOrAdmin()

// Current code:
// const session = await checkAdminAuth();

// New code:
import { checkProjectOwnerOrAdmin } from '@/lib/auth';

// In POST handler:
// Note: Self-play is shared, so any authenticated user with a project should be able to trigger it.
// For now, allow any authenticated user since positions are shared across all projects.
const session = await checkAuth();
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Alternatively, if you want to require project ownership:
// const { projectId } = await request.json();
// const session = await checkProjectOwnerOrAdmin(projectId);
// if (!session) {
//   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// }
```

**Note:** Since positions are shared across all projects for an engine, the simplest approach is to allow any authenticated user to trigger self-play. The current request body doesn't include projectId - it only needs engineId.

**Acceptance Criteria:**
- [ ] Authenticated users can trigger self-play
- [ ] Unauthenticated requests return 401
- [ ] Self-play works for non-admin users

---

### Task 5.4: Enhance ground-truth-config response with position counts

**Description:** Include position library stats in GT config response
**Size:** Small
**Priority:** Medium
**Dependencies:** None
**Can run parallel with:** Task 5.1, 5.2, 5.3

**Files to modify:**
- `app/api/projects/[id]/ground-truth-config/route.ts`

**Implementation:**

```typescript
// In the POST and GET handlers, after creating/fetching config:

// Fetch position counts if enabled
let positionLibrary = null;
if (config?.enabled && config?.engineId) {
  const counts = await prisma.positionLibrary.groupBy({
    by: ['gamePhase'],
    where: { engineId: config.engineId },
    _count: true,
  });

  const byPhase = counts.reduce((acc, c) => {
    acc[c.gamePhase] = c._count;
    return acc;
  }, {} as Record<string, number>);

  const total = Object.values(byPhase).reduce((a, b) => a + b, 0);
  const nonOpeningTotal = total - (byPhase.OPENING ?? 0);

  positionLibrary = {
    total,
    byPhase,
    sufficientForDrills: nonOpeningTotal >= 21,
    warning: nonOpeningTotal < 100 && nonOpeningTotal >= 21
      ? `Position library has only ${nonOpeningTotal} non-opening positions. Consider generating more for better drill variety.`
      : null,
  };
}

// Return enhanced response:
return NextResponse.json({
  config,
  engine,
  positionLibrary,
});
```

**Acceptance Criteria:**
- [ ] Response includes positionLibrary object when GT enabled
- [ ] positionLibrary.total shows total count
- [ ] positionLibrary.byPhase shows breakdown by phase
- [ ] positionLibrary.sufficientForDrills is boolean (>= 21 non-opening)
- [ ] positionLibrary.warning set if 21-99 non-opening positions

---

## Phase 6: Seed Position Library

### Task 6.1: Seed production position library

**Description:** Run self-play to ensure 200+ positions in shared library
**Size:** Small
**Priority:** High
**Dependencies:** All previous phases complete
**Can run parallel with:** None (final step)

**Manual Steps:**
1. Deploy all previous changes to production
2. Access admin page: `/projects/[any-backgammon-project]/admin`
3. Navigate to Ground Truth Engine section → Position Library → Self-Play Generator
4. Run 20-game self-play batch:
   - Games count: 20
   - Skip opening: true
5. Wait for completion (may take several minutes)
6. Verify position counts:
   - Total should be 200-300 positions
   - Distributed across EARLY, MIDDLE, BEAROFF phases

**Verification Script:**

```sql
-- Run in Prisma Studio or direct DB connection
SELECT
  "gamePhase",
  COUNT(*) as count
FROM "PositionLibrary"
GROUP BY "gamePhase"
ORDER BY "gamePhase";
```

Expected output:
| gamePhase | count |
|-----------|-------|
| OPENING   | 21    |
| EARLY     | ~50-80 |
| MIDDLE    | ~100-150 |
| BEAROFF   | ~30-60 |

**Acceptance Criteria:**
- [ ] Total positions >= 200
- [ ] OPENING = 21 (fixed)
- [ ] Each other phase has >= 20 positions
- [ ] No errors during generation

---

## Dependency Graph

```
Phase 1: Domain Detection Infrastructure
  Task 1.1 (keywords) → Task 1.2 (detection) → Task 1.3 (API)
                                                    ↓
Phase 2: Accuracy Tools Panel                       ↓
  Task 2.1 (component) ─────────────────────────────┼─→ Phase 4
                                                    ↓
Phase 3: Domain Tools Prompt                        ↓
  Task 3.1 (component) ─────────────────────────────┘

Phase 4: Integration
  Task 4.1 (artifacts page) ──┐
  Task 4.2 (profile flow) ────┼─→ Phase 5
  Task 4.3 (readiness page) ──┘

Phase 5: Validation & Thresholds
  Task 5.1 (auth helper) ──┐
  Task 5.2 (drill validation) ──┼─→ Phase 6
  Task 5.3 (self-play auth) ───┤
  Task 5.4 (config response) ──┘

Phase 6: Seed Position Library
  Task 6.1 (run self-play) → DONE
```

---

## Parallel Execution Opportunities

**Can run in parallel:**
- Task 1.3 + Task 2.1 + Task 3.1 (after Task 1.2 complete)
- Task 4.1 + Task 4.2 + Task 4.3 (after dependencies)
- Task 5.1 + Task 5.2 + Task 5.3 + Task 5.4 (mostly independent)

**Must be sequential:**
- Task 1.1 → Task 1.2 → Task 1.3
- All Phase 1-5 → Task 6.1

---

## Summary

| Phase | Tasks | Priority | Estimated Size |
|-------|-------|----------|----------------|
| Phase 1 | 3 | High | Small-Medium |
| Phase 2 | 1 | High | Large |
| Phase 3 | 1 | High | Medium |
| Phase 4 | 3 | High | Small-Medium |
| Phase 5 | 4 | High | Small-Medium |
| Phase 6 | 1 | High | Small |
| **Total** | **13** | - | - |
