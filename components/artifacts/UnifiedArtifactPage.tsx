'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, WifiOff, Clock, ServerCrash } from 'lucide-react';
import { TeachingPageHeader } from './TeachingPageHeader';
import { ArtifactTabBar } from './ArtifactTabBar';
import { SimpleToolbar } from './SimpleToolbar';
import { ArtifactHeader } from './ArtifactHeader';
import { TypeSpecificRenderer } from './renderers/TypeSpecificRenderer';
import { FullWidthProgressTracker } from '@/components/guru/FullWidthProgressTracker';
import { EmptyStateGuidance } from './EmptyStateGuidance';
import { getArtifactTypeFromSlug } from '@/lib/teaching/constants';
import { Button } from '@/components/ui/button';
import { TourPageButton } from '@/lib/onboarding/TourPageButton';
import type { ArtifactSummariesResponse, ArtifactDetail, ArtifactSummary } from '@/lib/teaching/artifactClient';
import type { PromptInfo, SubTaskProgress } from '@/lib/teaching/types';
import type { DrillGenerationConfig } from '@/lib/guruFunctions/types';
import type { GamePhase } from '@prisma/client';

type ArtifactTypeSlug = 'mental-model' | 'curriculum' | 'drill-series';

/**
 * Validates that artifact content has the expected structure for its type.
 * Returns false for empty objects `{}` or incomplete content during generation.
 */
function hasValidContent(artifact: ArtifactDetail): boolean {
  if (!artifact.content || typeof artifact.content !== 'object') return false;

  const content = artifact.content as Record<string, unknown>;

  switch (artifact.type) {
    case 'MENTAL_MODEL':
      return 'categories' in content && Array.isArray(content.categories) && content.categories.length > 0;
    case 'CURRICULUM':
      return 'universalPrinciplesModule' in content && 'phaseModules' in content;
    case 'DRILL_SERIES':
      // Check for either legacy format (series) or phase-organized format (phases)
      return (
        ('series' in content && Array.isArray(content.series) && content.series.length > 0) ||
        ('phases' in content && Array.isArray(content.phases) && content.phases.length > 0)
      );
    default:
      return false;
  }
}

// Default drill config for Simple Mode - defaults to ALL phases (user expectation)
// Note: API defaults to ['OPENING'] only, but Simple Mode should offer full coverage
const SIMPLE_MODE_DEFAULT_DRILL_CONFIG: DrillGenerationConfig = {
  gamePhases: ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as GamePhase[],
  targetDrillCount: 25,
  directDrillRatio: 0.7,
  useExistingPositions: true,
  maxPositionsPerPhase: 25,
};

// Error types for better user feedback
type ErrorType = 'network' | 'api' | 'timeout' | 'generation';

interface GenerationError {
  type: ErrorType;
  message: string;
}

function getErrorDetails(error: GenerationError): { icon: React.ReactNode; title: string; description: string } {
  switch (error.type) {
    case 'network':
      return {
        icon: <WifiOff className="h-5 w-5" />,
        title: 'Connection Error',
        description: 'Unable to reach the server. Please check your internet connection.',
      };
    case 'timeout':
      return {
        icon: <Clock className="h-5 w-5" />,
        title: 'Request Timed Out',
        description: 'The generation is taking longer than expected. Please try again.',
      };
    case 'api':
      return {
        icon: <ServerCrash className="h-5 w-5" />,
        title: 'Server Error',
        description: error.message || 'An unexpected server error occurred.',
      };
    case 'generation':
    default:
      return {
        icon: <AlertCircle className="h-5 w-5" />,
        title: 'Generation Failed',
        description: error.message || 'Unable to generate artifact. Please try again.',
      };
  }
}

function classifyError(err: unknown, response?: Response): GenerationError {
  // Network error (no response)
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return { type: 'network', message: 'Network request failed' };
  }

  // Timeout
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { type: 'timeout', message: 'Request timed out' };
  }

  // API error (has response)
  if (response && !response.ok) {
    const status = response.status;
    if (status >= 500) {
      return { type: 'api', message: `Server error (${status})` };
    }
    if (status === 408 || status === 504) {
      return { type: 'timeout', message: 'Request timed out' };
    }
    return { type: 'api', message: err instanceof Error ? err.message : 'API request failed' };
  }

  // Generation failure
  return {
    type: 'generation',
    message: err instanceof Error ? err.message : 'Generation failed. Please try again.',
  };
}

interface UnifiedArtifactPageProps {
  projectId: string;
  artifactType: ArtifactTypeSlug;
  initialArtifact: ArtifactDetail | null;
  initialPromptInfo: PromptInfo;
  allArtifactsSummary: ArtifactSummariesResponse;
  allVersions: ArtifactSummary[];
}

export function UnifiedArtifactPage({
  projectId,
  artifactType,
  initialArtifact,
  initialPromptInfo,
  allArtifactsSummary,
  allVersions,
}: UnifiedArtifactPageProps) {
  const router = useRouter();

  // State
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    stage: string | null;
    subTask: SubTaskProgress | null;
  }>({ stage: null, subTask: null });
  const [userNotes, setUserNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [artifact, setArtifact] = useState<ArtifactDetail | null>(initialArtifact);
  const [error, setError] = useState<GenerationError | null>(null);
  // Drill series configuration for Simple Mode
  const [drillConfig, setDrillConfig] = useState<DrillGenerationConfig>(SIMPLE_MODE_DEFAULT_DRILL_CONFIG);
  const [engineId, setEngineId] = useState<string | null>(null);

  // Get the artifact summary for the current type (for SimpleToolbar)
  const currentArtifactSummary = artifact
    ? {
        id: artifact.id,
        type: artifact.type,
        version: artifact.version,
        status: artifact.status,
        generatedAt: artifact.generatedAt,
        corpusHash: artifact.corpusHash,
        errorMessage: artifact.errorMessage,
        progressStage: artifact.progressStage,
        subTaskProgress: artifact.subTaskProgress,
      }
    : null;

  // Check if artifact is generating on mount
  // This handles both: (1) summary says generating, and (2) initialArtifact is in GENERATING state
  useEffect(() => {
    const latestKeyMap = {
      'mental-model': 'mentalModel',
      'curriculum': 'curriculum',
      'drill-series': 'drillSeries',
    } as const;

    const currentSummary = allArtifactsSummary.latest[latestKeyMap[artifactType]];

    // Check both summary and initialArtifact for GENERATING status
    const isCurrentlyGenerating =
      currentSummary?.status === 'GENERATING' ||
      initialArtifact?.status === 'GENERATING';

    if (isCurrentlyGenerating) {
      setIsGenerating(true);
      // Prefer initialArtifact progress (more recent) over summary
      const progressStage = initialArtifact?.progressStage || currentSummary?.progressStage;
      const subTask = (initialArtifact?.subTaskProgress || currentSummary?.subTaskProgress) as SubTaskProgress | null;

      if (progressStage) {
        setGenerationProgress({
          stage: progressStage,
          subTask,
        });
      }
    }
  }, [allArtifactsSummary, artifactType, initialArtifact]);

  // Fetch ground truth engine ID for drill series configuration
  useEffect(() => {
    if (artifactType !== 'drill-series') return;

    const fetchEngineId = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setEngineId(data.activeConfig?.engine?.id || null);
        }
      } catch (err) {
        console.error('Failed to fetch ground truth config:', err);
      }
    };

    fetchEngineId();
  }, [projectId, artifactType]);

  // Polling for generation status
  useEffect(() => {
    if (!isGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/guru/artifacts`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;

        const data: ArtifactSummariesResponse = await res.json();

        const latestKeyMap = {
          'mental-model': 'mentalModel',
          'curriculum': 'curriculum',
          'drill-series': 'drillSeries',
        } as const;

        const currentArtifact = data.latest[latestKeyMap[artifactType]];

        // Update progress if available
        if (currentArtifact?.progressStage) {
          setGenerationProgress({
            stage: currentArtifact.progressStage,
            subTask: currentArtifact.subTaskProgress as SubTaskProgress | null,
          });
        }

        // CRITICAL: Race condition check - wait for BOTH completed status AND corpusHash
        if (currentArtifact?.status === 'COMPLETED' && currentArtifact.corpusHash) {
          setIsGenerating(false);
          setGenerationProgress({ stage: null, subTask: null });
          router.refresh(); // Reload server data
        } else if (currentArtifact?.status === 'FAILED') {
          setIsGenerating(false);
          setGenerationProgress({ stage: null, subTask: null });
          setError({
            type: 'generation',
            message: currentArtifact.errorMessage || 'Generation failed. Please try again.',
          });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isGenerating, projectId, artifactType, router]);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    setError(null);
    setIsGenerating(true);

    try {
      // Build request body, including drillConfig for drill-series
      const body: Record<string, unknown> = { userNotes };
      if (artifactType === 'drill-series') {
        body.drillConfig = drillConfig;
      }

      const res = await fetch(`/api/projects/${projectId}/guru/${artifactType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Generation failed');
      }

      // Success - polling will pick up the progress
    } catch (err) {
      setIsGenerating(false);
      setError(classifyError(err));
    }
  }, [projectId, artifactType, userNotes, drillConfig]);

  // Check if we should show full empty state guidance
  const hasNoArtifacts = allArtifactsSummary.artifacts.length === 0;
  const showEmptyGuidance = advancedMode && hasNoArtifacts;

  // Convert slug to GuruArtifactType for FullWidthProgressTracker
  const guruArtifactType = getArtifactTypeFromSlug(artifactType);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tour Button */}
      <div className="flex items-center justify-between px-6 pt-4">
        <div data-tour="mode-toggle" className="flex-1">
          <TeachingPageHeader
            projectId={projectId}
            advancedMode={advancedMode}
            onAdvancedModeChange={setAdvancedMode}
          />
        </div>
        <TourPageButton tourId="artifacts" />
      </div>

      <div data-tour="artifact-tabs">
        <ArtifactTabBar
          projectId={projectId}
          artifactsSummary={allArtifactsSummary}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {isGenerating ? (
          <div className="p-6">
            <FullWidthProgressTracker
              artifactType={guruArtifactType}
              currentStage={generationProgress.stage}
              subTaskProgress={generationProgress.subTask}
              isComplete={false}
            />
          </div>
        ) : showEmptyGuidance ? (
          <EmptyStateGuidance
            projectId={projectId}
            onGenerate={(type) => {
              // If the generated type matches current, trigger generation
              if (type === artifactType) {
                handleGenerate();
              } else {
                // Navigate to the appropriate tab and generate there
                router.push(`/projects/${projectId}/artifacts/teaching/${type}`);
              }
            }}
            onError={(message) => setError({ type: 'generation', message })}
          />
        ) : (
          <div className="p-6 space-y-6">
            {/* Error display */}
            {error && (() => {
              const errorDetails = getErrorDetails(error);
              return (
                <div
                  className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
                  data-testid="generation-error"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-destructive flex-shrink-0 mt-0.5">
                      {errorDetails.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-destructive">
                        {errorDetails.title}
                      </h4>
                      <p className="text-sm text-destructive/80 mt-1">
                        {errorDetails.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerate}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                      <button
                        onClick={() => setError(null)}
                        className="text-destructive/60 hover:text-destructive text-sm"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Simple Mode UI */}
            {!advancedMode && (
              <SimpleToolbar
                artifactType={artifactType}
                artifact={currentArtifactSummary}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                onRegenerate={handleGenerate}
                userNotes={userNotes}
                onUserNotesChange={setUserNotes}
                notesExpanded={notesExpanded}
                onNotesExpandedChange={setNotesExpanded}
                drillConfig={drillConfig}
                onDrillConfigChange={setDrillConfig}
                engineId={engineId}
              />
            )}

            {/* Advanced Mode UI */}
            {advancedMode && artifact && (
              <ArtifactHeader
                artifact={artifact}
                projectId={projectId}
                promptInfo={initialPromptInfo}
                versions={allVersions}
                canShowDiff={artifact.version > 1}
                onError={(message) => setError({ type: 'generation', message })}
              />
            )}

            {/* Artifact Content - only render if artifact is completed with valid content structure */}
            {artifact && artifact.status === 'COMPLETED' && hasValidContent(artifact) && (
              <div data-tour="artifact-content">
                <TypeSpecificRenderer
                  artifact={artifact}
                  projectId={projectId}
                  showTOC={advancedMode}
                />
              </div>
            )}

            {/* Simple mode - no artifact empty state */}
            {!advancedMode && !artifact && !isGenerating && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Click &quot;Generate&quot; above to create your first artifact.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
