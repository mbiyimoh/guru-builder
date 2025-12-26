/**
 * AccuracyToolsPanel Component
 *
 * Collapsible panel showing Ground Truth Engine status and Position Library counts.
 * Allows users to enable GT, see position counts, and generate more positions.
 *
 * Features:
 * - Engine status indicator (online/offline with latency)
 * - Position count summary with phase breakdown
 * - "Generate More" button (triggers 10 games)
 * - Collapse/expand toggle with localStorage persistence
 * - Warning if < 100 positions, error if < 21 positions
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Zap,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { POSITION_LIBRARY_THRESHOLDS } from '@/lib/teaching/constants';

const { MINIMUM_POSITIONS, WARNING_THRESHOLD } = POSITION_LIBRARY_THRESHOLDS;

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
  error: string | null;
  isLoading: boolean;
  suggestedEngineName: string | null; // For "Enable" button when not enabled
}

const COLLAPSE_KEY = 'guru-accuracy-tools-collapsed';

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
    error: null,
    isLoading: true,
    suggestedEngineName: null,
  });

  // Load collapse state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(COLLAPSE_KEY);
    if (savedState !== null) {
      setState((prev) => ({ ...prev, isCollapsed: savedState === 'true' }));
    }
  }, []);

  // Fetch GT config, health, and position counts
  const fetchStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        credentials: 'include',
      });

      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          isEnabled: false,
          engineStatus: 'offline',
          isLoading: false,
        }));
        return;
      }

      const data = await res.json();
      const activeConfig = data.activeConfig;

      if (activeConfig?.isEnabled && activeConfig?.engine?.id) {
        const engineId = activeConfig.engine.id;

        // Fetch position counts
        const countsRes = await fetch(
          `/api/position-library/counts?engineId=${engineId}`,
          { credentials: 'include' }
        );

        const counts = countsRes.ok
          ? await countsRes.json()
          : { OPENING: 0, EARLY: 0, MIDDLE: 0, BEAROFF: 0 };

        // Check engine health
        const healthRes = await fetch(
          `/api/projects/${projectId}/ground-truth/health`,
          { credentials: 'include' }
        );

        const health = healthRes.ok
          ? await healthRes.json()
          : { available: false };

        setState((prev) => ({
          ...prev,
          isEnabled: true,
          engineName: activeConfig.engine?.name ?? 'Unknown Engine',
          engineId: engineId,
          engineStatus: health.available ? 'online' : 'offline',
          latency: health.latency ?? null,
          positionCounts: counts,
          isCollapsed: prev.isCollapsed,
          isLoading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isEnabled: false,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch GT status:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load status',
        isLoading: false,
      }));
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Detect suggested engine when GT is not enabled
  useEffect(() => {
    async function detectEngine() {
      if (state.isEnabled || state.isLoading) return;

      try {
        const detectRes = await fetch(`/api/projects/${projectId}/detect-domain`, {
          method: 'POST',
          credentials: 'include',
        });
        const detection = await detectRes.json();
        if (detection.suggestedEngine?.name) {
          setState((prev) => ({
            ...prev,
            suggestedEngineName: detection.suggestedEngine.name,
          }));
        }
      } catch {
        // Silently fail - domain detection is optional
      }
    }
    detectEngine();
  }, [projectId, state.isEnabled, state.isLoading]);

  // Toggle collapse state
  const toggleCollapse = () => {
    const newState = !state.isCollapsed;
    setState((prev) => ({ ...prev, isCollapsed: newState }));
    localStorage.setItem(COLLAPSE_KEY, String(newState));
  };

  // Generate more positions
  const handleGenerateMore = async () => {
    if (!state.engineId || state.engineStatus === 'offline') return;

    setState((prev) => ({ ...prev, isGenerating: true, error: null }));

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
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const data = await res.json();

      // Poll for completion
      pollBatchStatus(data.batchId);
    } catch (error) {
      console.error('Generate more error:', error);
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error: 'Generation failed. Try again.',
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
          setState((prev) => ({
            ...prev,
            isGenerating: false,
          }));
          fetchStatus(); // Refresh counts
        } else if (data.status === 'FAILED') {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            error: 'Generation failed. Try again.',
          }));
        } else {
          // Still running, poll again
          setTimeout(poll, 3000);
        }
      } catch {
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: 'Failed to check status',
        }));
      }
    };

    poll();
  };

  // Enable GT engine
  const handleEnable = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Detect domain to find engine
      const detectRes = await fetch(`/api/projects/${projectId}/detect-domain`, {
        method: 'POST',
        credentials: 'include',
      });

      const detection = await detectRes.json();

      if (!detection.suggestedEngine) {
        setState((prev) => ({
          ...prev,
          error: 'No verification engine available for this domain',
          isLoading: false,
        }));
        return;
      }

      // Enable GT config
      const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          engineId: detection.suggestedEngine.id,
        }),
      });

      if (!res.ok) throw new Error('Failed to enable');

      await fetchStatus();
    } catch (error) {
      console.error('Enable error:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to enable. Try again.',
        isLoading: false,
      }));
    }
  };

  const totalPositions = Object.values(state.positionCounts).reduce(
    (a, b) => a + b,
    0
  );
  const nonOpeningTotal = totalPositions - state.positionCounts.OPENING;
  const showWarning =
    state.isEnabled &&
    nonOpeningTotal < WARNING_THRESHOLD &&
    nonOpeningTotal >= MINIMUM_POSITIONS;
  const showError = state.isEnabled && nonOpeningTotal < MINIMUM_POSITIONS;

  // Loading state
  if (state.isLoading && !state.isEnabled) {
    return (
      <div className="mx-6 mt-4 p-3 bg-muted/30 border rounded-lg">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading accuracy tools...
          </span>
        </div>
      </div>
    );
  }

  // Collapsed state (enabled)
  if (state.isCollapsed && state.isEnabled) {
    return (
      <div
        className="mx-6 mt-4 p-3 bg-muted/50 border rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={toggleCollapse}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Accuracy Tools</span>
            <span className="text-sm text-muted-foreground">
              {state.engineName}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs',
                state.engineStatus === 'online'
                  ? 'text-green-600'
                  : 'text-red-500'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  state.engineStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                )}
              />
              {state.engineStatus === 'online' ? 'Online' : 'Offline'}
            </span>
            <span className="text-sm text-muted-foreground">
              {totalPositions} positions
            </span>
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
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                  state.engineStatus === 'online'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    state.engineStatus === 'online'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  )}
                />
                {state.engineStatus === 'online'
                  ? `Connected${state.latency ? ` (${state.latency}ms)` : ''}`
                  : 'Offline'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fetchStatus();
              }}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          {/* Position counts */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Position Library: {totalPositions} positions ready
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as const).map(
                (phase) => (
                  <div key={phase} className="p-2 bg-background rounded border">
                    <div className="text-xs text-muted-foreground capitalize">
                      {phase.toLowerCase()}
                    </div>
                    <div className="font-mono font-medium">
                      {state.positionCounts[phase]}
                    </div>
                  </div>
                )
              )}
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
                Low positions ({nonOpeningTotal}). Generate more for better drill
                variety.
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
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateMore();
              }}
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

      {state.error && (
        <div className="text-sm text-destructive mb-3">{state.error}</div>
      )}

      <Button
        onClick={handleEnable}
        size="sm"
        variant="outline"
        disabled={state.isLoading}
      >
        {state.isLoading ? (
          <>
            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            Enabling...
          </>
        ) : (
          `+ Enable ${state.suggestedEngineName || 'Verification Engine'}`
        )}
      </Button>
    </div>
  );
}
