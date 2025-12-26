// components/artifacts/ArtifactDetailPanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Eye, RefreshCw, Sparkles, Settings } from 'lucide-react';
import { EmptyStateGuidance } from './EmptyStateGuidance';
import { FullWidthProgressTracker } from '@/components/guru/FullWidthProgressTracker';
import { DrillConfigurationPanel } from '@/components/guru/DrillConfigurationPanel';
import { PromptEditorModal } from '@/components/guru/PromptEditorModal';
import { DebugTerminal, useDebugLogs } from '@/components/guru/DebugTerminal';
import { ARTIFACT_TYPE_CONFIG, getArtifactTypeFromSlug } from '@/lib/teaching/constants';
import type { ArtifactSummariesResponse } from '@/lib/teaching/artifactClient';
import type { SubTaskProgress, PromptConfigItem } from '@/lib/teaching/types';
import type { DrillGenerationConfig } from '@/lib/guruFunctions/types';
import { DEFAULT_DRILL_CONFIG } from '@/lib/guruFunctions/types';

type ArtifactTypeSlug = 'mental-model' | 'curriculum' | 'drill-series';

interface Props {
  projectId: string;
  artifacts: ArtifactSummariesResponse;
  selectedType: ArtifactTypeSlug | null;
  generating: string | null;
  onGenerate: (type: ArtifactTypeSlug) => void;
  advancedMode: boolean;
  onAdvancedModeChange: (value: boolean) => void;
  onRefresh: () => Promise<void>;
  // Error callback (replaces blocking alert())
  onError?: (message: string) => void;
}

interface ProgressState {
  currentStage: string | null;
  subTaskProgress: SubTaskProgress | null;
  isComplete: boolean;
}

interface PromptConfigResponse {
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  systemPrompt: PromptConfigItem;
  userPrompt: PromptConfigItem;
  updatedAt: string | null;
}

interface PromptConfigsResponse {
  promptConfigs: PromptConfigResponse[];
}

export function ArtifactDetailPanel({
  projectId,
  artifacts,
  selectedType,
  generating,
  onGenerate,
  advancedMode,
  onAdvancedModeChange,
  onRefresh,
  onError,
}: Props) {
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [promptModalType, setPromptModalType] = useState<'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'>('MENTAL_MODEL');
  const [userNotes, setUserNotes] = useState('');
  const [progressState, setProgressState] = useState<ProgressState>({
    currentStage: null,
    subTaskProgress: null,
    isComplete: false,
  });
  const [drillConfig, setDrillConfig] = useState<DrillGenerationConfig>(DEFAULT_DRILL_CONFIG);
  const [groundTruthEngineId, setGroundTruthEngineId] = useState<string | null>(null);

  // Debug logging
  const { logs, log, clearLogs } = useDebugLogs();

  // Real prompt configs fetched from API
  const [promptConfigs, setPromptConfigs] = useState<PromptConfigsResponse | null>(null);

  // Check auth state on mount
  const checkAuthState = useCallback(async () => {
    log.debug('Auth', 'Checking authentication state...');
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const authState = await res.json();
      if (authState.authenticated) {
        log.success('Auth', 'Authenticated', {
          userId: authState.prisma?.userId,
          email: authState.prisma?.email,
        });
      } else {
        log.warn('Auth', 'Not authenticated', {
          supabase: authState.supabase,
          prisma: authState.prisma,
        });
      }
      return authState.authenticated;
    } catch (error) {
      log.error('Auth', 'Failed to check auth state', { error: String(error) });
      return false;
    }
  }, [log]);

  // Run auth check on mount
  useEffect(() => {
    log.info('Init', 'ArtifactDetailPanel mounted', { projectId, selectedType });
    checkAuthState();
  }, [projectId, selectedType, log, checkAuthState]);

  // Fetch prompt configs from API
  const fetchPromptConfigs = useCallback(async () => {
    log.debug('Fetch', 'Fetching prompt configs...');
    try {
      const res = await fetch(`/api/projects/${projectId}/guru/prompts`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPromptConfigs(data);
        log.success('Fetch', 'Prompt configs loaded', { count: data.promptConfigs?.length });
      } else {
        log.error('Fetch', `Prompt configs failed: ${res.status}`, { statusText: res.statusText });
      }
    } catch (error) {
      log.error('Fetch', 'Prompt configs exception', { error: String(error) });
    }
  }, [projectId, log]);

  // Fetch ground truth config to get engine ID for drill configuration
  const fetchGroundTruthConfig = useCallback(async () => {
    log.debug('Fetch', 'Fetching ground truth config...');
    try {
      const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activeConfig?.engine?.id) {
          setGroundTruthEngineId(data.activeConfig.engine.id);
          log.success('Fetch', 'Ground truth config loaded', { engineId: data.activeConfig.engine.id });
        } else {
          setGroundTruthEngineId(null);
          log.info('Fetch', 'No ground truth engine configured');
        }
      } else {
        log.error('Fetch', `Ground truth config failed: ${res.status}`, { statusText: res.statusText });
      }
    } catch (error) {
      log.error('Fetch', 'Ground truth config exception', { error: String(error) });
      setGroundTruthEngineId(null);
    }
  }, [projectId, log]);

  // Initial data fetch
  useEffect(() => {
    fetchPromptConfigs();
    fetchGroundTruthConfig();
  }, [fetchPromptConfigs, fetchGroundTruthConfig]);

  // Poll for progress updates when generating (3000ms interval, consistent with other components)
  useEffect(() => {
    if (!generating) {
      setProgressState({ currentStage: null, subTaskProgress: null, isComplete: false });
      return;
    }

    const artifactType = getArtifactTypeFromSlug(generating as ArtifactTypeSlug);
    const config = ARTIFACT_TYPE_CONFIG[artifactType];
    const latestArtifact = artifacts.latest[config.apiKey];

    // Update progress state from artifact (even if null - tracker handles null as "starting")
    if (latestArtifact?.status === 'GENERATING') {
      // Extract subTaskProgress if available (it's stored as JSON)
      const subTask = latestArtifact.subTaskProgress as SubTaskProgress | null;
      setProgressState({
        currentStage: latestArtifact.progressStage ?? null,
        subTaskProgress: subTask,
        isComplete: false,
      });
    }

    // Poll for updates with consistent 3000ms interval
    const pollInterval = setInterval(async () => {
      try {
        await onRefresh();
      } catch (error) {
        console.error('Failed to poll progress:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [generating, artifacts.latest, onRefresh]);

  // Get prompt config for selected artifact type
  const getPromptConfigForType = (artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'): {
    systemPrompt: PromptConfigItem;
    userPrompt: PromptConfigItem;
  } => {
    const config = promptConfigs?.promptConfigs.find(c => c.artifactType === artifactType);
    if (config) {
      return {
        systemPrompt: config.systemPrompt,
        userPrompt: config.userPrompt,
      };
    }
    // Fallback defaults
    return {
      systemPrompt: { current: '', isCustom: false, default: '' },
      userPrompt: { current: '', isCustom: false, default: '' },
    };
  };

  // Show empty state guidance when nothing selected and no artifacts
  if (!selectedType && artifacts.counts.total === 0) {
    return <EmptyStateGuidance projectId={projectId} onGenerate={onGenerate} />;
  }

  // Show generation progress
  if (generating) {
    const artifactType = getArtifactTypeFromSlug(generating as ArtifactTypeSlug);
    return (
      <div className="flex-1 p-6" data-testid="progress-tracker">
        <FullWidthProgressTracker
          artifactType={artifactType}
          currentStage={progressState.currentStage}
          subTaskProgress={progressState.subTaskProgress}
          isComplete={progressState.isComplete}
          onFadeComplete={() => {
            onRefresh();
          }}
        />
      </div>
    );
  }

  // Show selection prompt if nothing selected but artifacts exist
  if (!selectedType) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Select an Artifact</h3>
          <p className="text-muted-foreground">
            Choose an artifact from the sidebar to view details or generate new content.
          </p>
        </div>
      </div>
    );
  }

  // Get selected artifact details
  const artifactType = getArtifactTypeFromSlug(selectedType);
  const config = ARTIFACT_TYPE_CONFIG[artifactType];
  const artifact = artifacts.latest[config.apiKey];
  const hasArtifact = !!artifact;

  // Get prompt config for the selected type
  const promptConfig = getPromptConfigForType(artifactType);

  const handleGenerate = async () => {
    const endpoint = `/api/projects/${projectId}/guru/${selectedType}`;
    const body: Record<string, unknown> = { userNotes };

    // Add drill config for drill-series generation
    if (selectedType === 'drill-series') {
      body.drillConfig = drillConfig;
    }

    log.info('Generate', `Starting ${selectedType} generation...`, { endpoint, body });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        log.success('Generate', `${selectedType} generation triggered`, result);
        onGenerate(selectedType);
        setUserNotes('');
      } else {
        const errorText = await res.text();
        log.error('Generate', `Generation failed: ${res.status}`, { statusText: res.statusText, body: errorText });
        if (onError) {
          onError(`Generation failed: ${errorText}`);
        }
      }
    } catch (error) {
      log.error('Generate', 'Generation exception', { error: String(error) });
      if (onError) {
        onError('Generation failed. Please try again.');
      }
    }
  };

  const openPromptEditor = () => {
    setPromptModalType(artifactType);
    setPromptModalOpen(true);
  };

  const handlePromptSave = async () => {
    setPromptModalOpen(false);
    await fetchPromptConfigs(); // Refresh prompt configs after save
    await onRefresh();
  };

  const handlePromptSaveAndRegenerate = async () => {
    setPromptModalOpen(false);
    await fetchPromptConfigs();
    await onRefresh();
    handleGenerate();
  };

  return (
    <div className="flex-1 overflow-auto p-6" data-testid="artifact-detail-panel">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.icon}</span>
            <div>
              <h2 className="text-2xl font-bold">{config.label}</h2>
              {hasArtifact && (
                <p className="text-sm text-muted-foreground">
                  Version {artifact.version} • Generated {formatDate(artifact.generatedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Advanced mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Advanced</span>
            <Switch
              checked={advancedMode}
              onCheckedChange={onAdvancedModeChange}
              data-testid="advanced-mode-toggle"
            />
          </div>
        </div>

        {/* Status Card */}
        <Card data-testid="artifact-status-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Status
              {hasArtifact && (
                <Badge variant={artifact.status === 'COMPLETED' ? 'default' : 'secondary'}>
                  {artifact.status}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasArtifact ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <span className="ml-2 font-medium">{artifact.version}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Generated:</span>
                    <span className="ml-2 font-medium">{formatDate(artifact.generatedAt)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <Button asChild data-testid="view-artifact-button">
                    <Link href={`/projects/${projectId}/artifacts/teaching/${selectedType}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Full Artifact
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={handleGenerate} data-testid="regenerate-button">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  {advancedMode && (
                    <Button variant="ghost" onClick={openPromptEditor} data-testid="edit-prompts-button">
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Prompts
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  This artifact hasn&apos;t been generated yet.
                </p>
                <Button onClick={handleGenerate} data-testid="generate-button">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate {config.label}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced: Drill Configuration (for drill-series only) */}
        {advancedMode && selectedType === 'drill-series' && (
          <Card data-testid="drill-config-panel">
            <CardHeader>
              <CardTitle className="text-lg">Drill Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <DrillConfigurationPanel
                engineId={groundTruthEngineId}
                config={drillConfig}
                onConfigChange={setDrillConfig}
                onValidationChange={(canGenerate, reason) => {
                  if (!canGenerate) {
                    console.warn('Drill generation validation failed:', reason);
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* User Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generation Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full p-3 border rounded-md resize-none h-24 bg-background"
              placeholder="Optional notes to guide generation..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              data-testid="user-notes-textarea"
            />
          </CardContent>
        </Card>

        {/* Debug Terminal - development only, shows below User Notes */}
        {process.env.NODE_ENV === 'development' && (
          <DebugTerminal
            logs={logs}
            maxHeight="300px"
            title="Debug Terminal"
            onClear={clearLogs}
          />
        )}
      </div>

      {/* Prompt Editor Modal */}
      {promptModalOpen && (
        <PromptEditorModal
          projectId={projectId}
          artifactType={promptModalType}
          systemPrompt={promptConfig.systemPrompt}
          userPrompt={promptConfig.userPrompt}
          onClose={() => setPromptModalOpen(false)}
          onSave={handlePromptSave}
          onSaveAndRegenerate={handlePromptSaveAndRegenerate}
        />
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 48) return 'Yesterday';
  return date.toLocaleDateString();
}
