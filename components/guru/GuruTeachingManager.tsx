'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import type { GuruArtifactType, ArtifactStatus } from '@prisma/client';
import { getArtifactSlug } from '@/lib/teaching/constants';
import { FullWidthProgressTracker } from './FullWidthProgressTracker';
import { PromptEditorModal } from './PromptEditorModal';
import { ArtifactInfoModal } from '@/components/artifacts/ArtifactInfoModal';
import { DrillConfigurationPanel, DEFAULT_DRILL_CONFIG } from './DrillConfigurationPanel';
import { DebugTerminal, useDebugLogs } from './DebugTerminal';
import type { DrillGenerationConfig } from '@/lib/guruFunctions/types';
import type { SubTaskProgress } from '@/lib/teaching/types';

interface ArtifactSummary {
  id: string;
  type: GuruArtifactType;
  version: number;
  status: ArtifactStatus;
  generatedAt: string;
  corpusHash: string | null;
  errorMessage: string | null;
  progressStage: string | null;
  subTaskProgress: SubTaskProgress | null;
}

interface ArtifactsResponse {
  latest: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  };
  counts: {
    total: number;
    mentalModels: number;
    curricula: number;
    drillSeries: number;
  };
}

interface PromptConfigItem {
  current: string;
  isCustom: boolean;
  default: string;
}

interface PromptConfig {
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  systemPrompt: PromptConfigItem;
  userPrompt: PromptConfigItem;
  updatedAt: string | null;
}

interface PromptConfigsResponse {
  promptConfigs: PromptConfig[];
}

interface GuruTeachingManagerProps {
  projectId: string;
}

type ArtifactTypeKey = 'mental-model' | 'curriculum' | 'drill-series';

export function GuruTeachingManager({ projectId }: GuruTeachingManagerProps) {
  const [artifacts, setArtifacts] = useState<ArtifactsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generating, setGenerating] = useState<ArtifactTypeKey | null>(null);
  const [userNotesModal, setUserNotesModal] = useState<ArtifactTypeKey | null>(null);
  const [userNotes, setUserNotes] = useState('');
  const pollingStartTime = useRef<number | null>(null);
  const MAX_POLL_DURATION_MS = 600000; // 10 minutes

  // Debug logging
  const { logs, log, clearLogs } = useDebugLogs();

  // Drill configuration state
  const [drillConfig, setDrillConfig] = useState<DrillGenerationConfig>({ ...DEFAULT_DRILL_CONFIG });
  const [groundTruthEngineId, setGroundTruthEngineId] = useState<string | null>(null);
  const [drillConfigValid, setDrillConfigValid] = useState(true);
  const [drillConfigValidationMsg, setDrillConfigValidationMsg] = useState<string | undefined>();

  // Handle drill config validation changes
  const handleDrillValidationChange = (canGenerate: boolean, reason?: string) => {
    setDrillConfigValid(canGenerate);
    setDrillConfigValidationMsg(reason);
  };

  // Prompt customization state
  const [promptConfigs, setPromptConfigs] = useState<PromptConfigsResponse | null>(null);
  const [promptEditorOpen, setPromptEditorOpen] = useState<{
    artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  } | null>(null);

  // Info modal state
  const [infoModalType, setInfoModalType] = useState<'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES' | null>(null);

  const fetchArtifacts = useCallback(async () => {
    const url = `/api/projects/${projectId}/guru/artifacts`;
    log.debug('API', `Fetching ${url}`);
    try {
      const res = await fetch(url, { credentials: 'include' });
      log.debug('API', `Response status: ${res.status}`, { url, status: res.status });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        log.error('API', `Artifacts fetch failed: ${res.status}`, errorData);
        throw new Error(errorData.error || 'Failed to fetch artifacts');
      }
      const data = await res.json();
      log.success('API', 'Artifacts fetched successfully', {
        total: data.counts?.total,
        generating: Object.values(data.latest || {}).some((a: unknown) => (a as { status?: string })?.status === 'GENERATING'),
      });
      setArtifacts(data);
    } catch (error) {
      log.error('API', `Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`, { error: String(error) });
      console.error('Failed to fetch artifacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, log]);

  const fetchPromptConfigs = useCallback(async () => {
    const url = `/api/projects/${projectId}/guru/prompts`;
    log.debug('API', `Fetching ${url}`);
    try {
      const res = await fetch(url, { credentials: 'include' });
      log.debug('API', `Response status: ${res.status}`, { url, status: res.status });
      if (res.ok) {
        const data = await res.json();
        log.success('API', 'Prompt configs fetched');
        setPromptConfigs(data);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        log.error('API', `Prompt configs fetch failed: ${res.status}`, errorData);
      }
    } catch (error) {
      log.error('API', `Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`, { error: String(error) });
      console.error('Failed to fetch prompt configs:', error);
    }
  }, [projectId, log]);

  // Fetch ground truth config to get engine ID for drill configuration
  const fetchGroundTruthConfig = useCallback(async () => {
    const url = `/api/projects/${projectId}/ground-truth-config`;
    log.debug('API', `Fetching ${url}`);
    try {
      const res = await fetch(url, { credentials: 'include' });
      log.debug('API', `Response status: ${res.status}`, { url, status: res.status });
      if (res.ok) {
        const data = await res.json();
        // API returns activeConfig (the enabled config with engine details)
        if (data.activeConfig?.engine?.id) {
          log.success('API', 'Ground truth config fetched', { engineId: data.activeConfig.engine.id });
          setGroundTruthEngineId(data.activeConfig.engine.id);
        } else {
          log.debug('API', 'No active ground truth engine configured');
          setGroundTruthEngineId(null);
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        log.error('API', `Ground truth config fetch failed: ${res.status}`, errorData);
      }
    } catch (error) {
      log.error('API', `Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`, { error: String(error) });
      console.error('Failed to fetch ground truth config:', error);
      setGroundTruthEngineId(null);
    }
  }, [projectId, log]);

  // Check auth state on mount and log it
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
          supabaseSession: authState.supabase?.hasSession,
          supabaseUser: authState.supabase?.hasUser,
          supabaseError: authState.supabase?.sessionError || authState.supabase?.userError,
          prismaSynced: authState.prisma?.synced,
        });
      }
      return authState.authenticated;
    } catch (error) {
      log.error('Auth', 'Failed to check auth state', { error: String(error) });
      return false;
    }
  }, [log]);

  useEffect(() => {
    // Check auth first, then fetch data
    checkAuthState().then(() => {
      fetchArtifacts();
      fetchPromptConfigs();
      fetchGroundTruthConfig();
    });
  }, [checkAuthState, fetchArtifacts, fetchPromptConfigs, fetchGroundTruthConfig]);

  // Poll for updates when something is generating
  useEffect(() => {
    if (!generating) return;

    log.info('Polling', `Started polling for ${generating} generation`);

    const interval = setInterval(async () => {
      // Check timeout
      if (pollingStartTime.current && Date.now() - pollingStartTime.current > MAX_POLL_DURATION_MS) {
        log.error('Polling', 'Timeout exceeded (10 min), stopping poll');
        alert('Generation is taking longer than expected. Please refresh the page to check status.');
        setGenerating(null);
        pollingStartTime.current = null;
        return;
      }

      await fetchArtifacts();

      // Check if generation completed
      if (artifacts) {
        const artifact = generating === 'mental-model'
          ? artifacts.latest.mentalModel
          : generating === 'curriculum'
            ? artifacts.latest.curriculum
            : artifacts.latest.drillSeries;

        // Wait for BOTH status completion AND content availability (corpusHash indicates content is ready)
        if (artifact && artifact.status === 'COMPLETED') {
          if (artifact.corpusHash) {
            log.success('Polling', `${generating} generation completed!`, {
              version: artifact.version,
              id: artifact.id
            });
            setGenerating(null);
            pollingStartTime.current = null;
          } else {
            log.debug('Polling', 'Artifact complete but content not ready yet, continuing...');
          }
        } else if (artifact && artifact.status === 'FAILED') {
          log.error('Polling', `${generating} generation failed`, { error: artifact.errorMessage });
          setGenerating(null);
          pollingStartTime.current = null;
        } else if (artifact && artifact.status === 'GENERATING') {
          log.debug('Polling', `Still generating: ${artifact.progressStage || 'unknown stage'}`);
        }
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      log.debug('Polling', 'Stopped polling');
    };
  }, [generating, artifacts, fetchArtifacts, log]);

  function openUserNotesModal(type: ArtifactTypeKey) {
    setUserNotesModal(type);
    setUserNotes('');
    // Reset drill config and re-fetch ground truth config when opening drill-series modal
    if (type === 'drill-series') {
      setDrillConfig({ ...DEFAULT_DRILL_CONFIG });
      setDrillConfigValid(true); // Reset validation state
      setDrillConfigValidationMsg(undefined);
      // Re-fetch ground truth config to ensure we have the latest
      fetchGroundTruthConfig();
    }
  }

  function closeUserNotesModal() {
    setUserNotesModal(null);
    setUserNotes('');
  }

  // Handle ESC key to close modal
  useEffect(() => {
    if (!userNotesModal) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeUserNotesModal();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [userNotesModal]);

  async function handleGenerate(type: ArtifactTypeKey, notes?: string) {
    setUserNotesModal(null);
    setGenerating(type);
    pollingStartTime.current = Date.now();

    log.info('Generation', `Starting ${type} generation...`);

    try {
      // Build request body - include drillConfig for drill-series
      const body: Record<string, unknown> = { userNotes: notes || undefined };
      if (type === 'drill-series') {
        body.drillConfig = drillConfig;
        log.debug('Generation', 'Using drill config', drillConfig);
      }

      const url = `/api/projects/${projectId}/guru/${type}`;
      log.info('Generation', `POST ${url}`, { body });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      log.debug('Generation', `Response received`, { status: res.status, statusText: res.statusText });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        log.error('Generation', `Failed with status ${res.status}`, errorData);
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const result = await res.json();
      log.success('Generation', `${type} generation started!`, {
        artifactId: result.artifactId,
        version: result.version,
      });

      await fetchArtifacts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Generation', `Failed: ${errorMessage}`, { error: String(error) });
      console.error('[GuruTeachingManager] Failed to start generation:', error);
      alert(error instanceof Error ? error.message : 'Failed to start generation');
      setGenerating(null);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-12">
        <p className="text-center text-gray-500">Loading guru teaching artifacts...</p>
      </div>
    );
  }

  const latest = artifacts?.latest;
  const hasCorpus = true; // Will be validated by API

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Guru Teaching Pipeline</h2>
            <p className="text-sm text-gray-500 mt-1">
              Generate structured teaching materials from your corpus
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Mental Model */}
          <ArtifactCard
            title="Mental Model"
            description="Core principles and frameworks extracted from your corpus"
            artifact={latest?.mentalModel}
            projectId={projectId}
            canGenerate={hasCorpus}
            isGenerating={generating === 'mental-model'}
            onGenerate={() => openUserNotesModal('mental-model')}
            hasCustomPrompts={
              promptConfigs?.promptConfigs.find(c => c.artifactType === 'MENTAL_MODEL')?.systemPrompt.isCustom ||
              promptConfigs?.promptConfigs.find(c => c.artifactType === 'MENTAL_MODEL')?.userPrompt.isCustom
            }
            onEditPrompts={() => setPromptEditorOpen({ artifactType: 'MENTAL_MODEL' })}
            onShowInfo={() => setInfoModalType('MENTAL_MODEL')}
          />

          {/* Curriculum */}
          <ArtifactCard
            title="Curriculum"
            description="Progressive learning path built from the mental model"
            artifact={latest?.curriculum}
            projectId={projectId}
            canGenerate={!!latest?.mentalModel && latest.mentalModel.status === 'COMPLETED'}
            isGenerating={generating === 'curriculum'}
            onGenerate={() => openUserNotesModal('curriculum')}
            prerequisite={!latest?.mentalModel ? 'Generate mental model first' : undefined}
            hasCustomPrompts={
              promptConfigs?.promptConfigs.find(c => c.artifactType === 'CURRICULUM')?.systemPrompt.isCustom ||
              promptConfigs?.promptConfigs.find(c => c.artifactType === 'CURRICULUM')?.userPrompt.isCustom
            }
            onEditPrompts={() => setPromptEditorOpen({ artifactType: 'CURRICULUM' })}
            onShowInfo={() => setInfoModalType('CURRICULUM')}
          />

          {/* Drill Series */}
          <ArtifactCard
            title="Drill Series"
            description="Practice exercises to reinforce learning"
            artifact={latest?.drillSeries}
            projectId={projectId}
            canGenerate={!!latest?.curriculum && latest.curriculum.status === 'COMPLETED'}
            isGenerating={generating === 'drill-series'}
            onGenerate={() => openUserNotesModal('drill-series')}
            prerequisite={
              !latest?.mentalModel
                ? 'Generate mental model first'
                : !latest?.curriculum
                  ? 'Generate curriculum first'
                  : undefined
            }
            hasCustomPrompts={
              promptConfigs?.promptConfigs.find(c => c.artifactType === 'DRILL_SERIES')?.systemPrompt.isCustom ||
              promptConfigs?.promptConfigs.find(c => c.artifactType === 'DRILL_SERIES')?.userPrompt.isCustom
            }
            onEditPrompts={() => setPromptEditorOpen({ artifactType: 'DRILL_SERIES' })}
            onShowInfo={() => setInfoModalType('DRILL_SERIES')}
          />
        </div>

        {/* Full-width Progress Tracker - shows when any artifact is generating */}
        {(() => {
          const generatingArtifact = [
            latest?.mentalModel,
            latest?.curriculum,
            latest?.drillSeries
          ].find(a => a?.status === 'GENERATING');

          if (!generatingArtifact) return null;

          return (
            <FullWidthProgressTracker
              artifactType={generatingArtifact.type}
              currentStage={generatingArtifact.progressStage}
              subTaskProgress={generatingArtifact.subTaskProgress}
              isComplete={false}
            />
          );
        })()}

        {/* User Notes Modal */}
        {userNotesModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg shadow-xl w-full ${userNotesModal === 'drill-series' ? 'max-w-2xl' : 'max-w-lg'}`}>
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Generate {userNotesModal === 'mental-model' ? 'Mental Model' : userNotesModal === 'curriculum' ? 'Curriculum' : 'Drill Series'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {userNotesModal === 'drill-series'
                    ? 'Configure drill options and optionally add guidance for the AI'
                    : 'Optionally add guidance for the AI to consider during generation'}
                </p>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Drill Configuration Panel for drill-series */}
                {userNotesModal === 'drill-series' && (
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <DrillConfigurationPanel
                      engineId={groundTruthEngineId}
                      config={drillConfig}
                      onConfigChange={setDrillConfig}
                      onValidationChange={handleDrillValidationChange}
                    />
                  </div>
                )}

                <label htmlFor="user-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  User Notes (optional)
                </label>
                <textarea
                  id="user-notes"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="e.g., Focus on beginner-friendly explanations, emphasize practical examples, include chess analogies..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="user-notes-input"
                />
                <p className="text-xs text-gray-500 mt-2">
                  These notes will guide the AI in designing the content. Leave empty to use default generation.
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button
                  onClick={closeUserNotesModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleGenerate(userNotesModal, userNotes.trim() || undefined)}
                  disabled={userNotesModal === 'drill-series' && !drillConfigValid}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    userNotesModal === 'drill-series' && !drillConfigValid
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'text-white bg-blue-600 hover:bg-blue-700'
                  }`}
                  title={userNotesModal === 'drill-series' && !drillConfigValid ? drillConfigValidationMsg : undefined}
                  data-testid="generate-button"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Progress Indicator */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Pipeline Progress</span>
            <span>
              {[latest?.mentalModel, latest?.curriculum, latest?.drillSeries].filter(
                (a) => a?.status === 'COMPLETED'
              ).length}{' '}
              / 3 completed
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500"
              style={{
                width: `${
                  ([latest?.mentalModel, latest?.curriculum, latest?.drillSeries].filter(
                    (a) => a?.status === 'COMPLETED'
                  ).length /
                    3) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Debug Terminal - shows when there are logs */}
        {logs.length > 0 && (
          <div className="mt-6">
            <DebugTerminal
              logs={logs}
              title="Pipeline Debug Log"
              maxHeight="250px"
              onClear={clearLogs}
            />
          </div>
        )}

        {/* Prompt Editor Modal */}
        {promptEditorOpen && promptConfigs && (() => {
          const config = promptConfigs.promptConfigs.find(
            c => c.artifactType === promptEditorOpen.artifactType
          );
          if (!config) return null;

          const artifactTypeToKey: Record<string, ArtifactTypeKey> = {
            MENTAL_MODEL: 'mental-model',
            CURRICULUM: 'curriculum',
            DRILL_SERIES: 'drill-series',
          };

          return (
            <PromptEditorModal
              projectId={projectId}
              artifactType={promptEditorOpen.artifactType}
              systemPrompt={config.systemPrompt}
              userPrompt={config.userPrompt}
              onClose={() => setPromptEditorOpen(null)}
              onSave={() => {
                setPromptEditorOpen(null);
                fetchPromptConfigs();
              }}
              onSaveAndRegenerate={() => {
                setPromptEditorOpen(null);
                fetchPromptConfigs();
                // Trigger regeneration
                handleGenerate(artifactTypeToKey[promptEditorOpen.artifactType]);
              }}
            />
          );
        })()}

        {/* Artifact Info Modal */}
        {infoModalType && (
          <ArtifactInfoModal
            artifactType={infoModalType}
            isOpen={!!infoModalType}
            onClose={() => setInfoModalType(null)}
          />
        )}
      </div>
    </div>
  );
}

interface ArtifactCardProps {
  title: string;
  description: string;
  artifact: ArtifactSummary | null | undefined;
  projectId: string;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  prerequisite?: string;
  hasCustomPrompts?: boolean;
  onEditPrompts?: () => void;
  onShowInfo?: () => void;
}

function ArtifactCard({
  title,
  description,
  artifact,
  projectId,
  canGenerate,
  isGenerating,
  onGenerate,
  prerequisite,
  hasCustomPrompts,
  onEditPrompts,
  onShowInfo,
}: ArtifactCardProps) {
  const status = artifact?.status;
  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';
  const isInProgress = status === 'GENERATING' || isGenerating;

  return (
    <div className={`border rounded-lg p-5 ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isCompleted && (
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isInProgress && (
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
              <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
          {isFailed && (
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {!artifact && !isInProgress && (
            <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-white text-xs font-medium">?</span>
            </div>
          )}
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {hasCustomPrompts && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
              Custom
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onShowInfo && (
            <button
              onClick={onShowInfo}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
              title="How this is created"
              aria-label="How this is created"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
          {onEditPrompts && (
            <button
              onClick={onEditPrompts}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
              title="Edit prompts"
              aria-label="Edit prompts"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}
          {artifact && (
            <span className="text-xs text-gray-500">v{artifact.version}</span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4">{description}</p>

      {isFailed && artifact?.errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-4">
          Error: {artifact.errorMessage}
        </div>
      )}

      {prerequisite && !canGenerate && (
        <p className="text-sm text-amber-600 mb-4">{prerequisite}</p>
      )}

      {isInProgress && !artifact?.progressStage && (
        <div className="text-sm text-blue-600 mb-4">
          Generating...
        </div>
      )}

      {artifact && (
        <div className="text-xs text-gray-500 mb-4">
          Generated {new Date(artifact.generatedAt).toLocaleDateString()}
        </div>
      )}

      <div className="flex gap-2">
        {isCompleted && artifact && (
          <Link
            href={`/projects/${projectId}/artifacts/teaching/${getArtifactSlug(artifact.type)}`}
            className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 text-center"
          >
            View
          </Link>
        )}
        <button
          onClick={onGenerate}
          disabled={!canGenerate || isInProgress}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md ${
            canGenerate && !isInProgress
              ? 'text-white bg-blue-600 hover:bg-blue-700'
              : 'text-gray-400 bg-gray-100 cursor-not-allowed'
          }`}
        >
          {isInProgress ? 'Generating...' : isCompleted ? 'Regenerate' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
