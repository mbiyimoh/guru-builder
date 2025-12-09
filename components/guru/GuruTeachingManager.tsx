'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { GuruArtifactType, ArtifactStatus } from '@prisma/client';
import { getArtifactSlug } from '@/lib/teaching/constants';
import { TeachingProgressTracker } from './TeachingProgressTracker';

interface ArtifactSummary {
  id: string;
  type: GuruArtifactType;
  version: number;
  status: ArtifactStatus;
  generatedAt: string;
  corpusHash: string | null;
  errorMessage: string | null;
  progressStage: string | null;
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

interface GuruTeachingManagerProps {
  projectId: string;
}

export function GuruTeachingManager({ projectId }: GuruTeachingManagerProps) {
  const [artifacts, setArtifacts] = useState<ArtifactsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generating, setGenerating] = useState<'mental-model' | 'curriculum' | 'drill-series' | null>(null);
  const pollingStartTime = useRef<number | null>(null);
  const MAX_POLL_DURATION_MS = 600000; // 10 minutes

  const fetchArtifacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/guru/artifacts`);
      if (!res.ok) throw new Error('Failed to fetch artifacts');
      const data = await res.json();
      setArtifacts(data);
    } catch (error) {
      console.error('Failed to fetch artifacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  // Poll for updates when something is generating
  useEffect(() => {
    if (!generating) return;

    const interval = setInterval(async () => {
      // Check timeout
      if (pollingStartTime.current && Date.now() - pollingStartTime.current > MAX_POLL_DURATION_MS) {
        console.warn('[GuruTeachingManager] Polling timeout exceeded');
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
            setGenerating(null);
            pollingStartTime.current = null;
          }
          // else: artifact marked complete but content not yet available, continue polling
        } else if (artifact && artifact.status === 'FAILED') {
          setGenerating(null);
          pollingStartTime.current = null;
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [generating, artifacts, fetchArtifacts]);

  async function handleGenerate(type: 'mental-model' | 'curriculum' | 'drill-series') {
    setGenerating(type);
    pollingStartTime.current = Date.now();
    try {
      const res = await fetch(`/api/projects/${projectId}/guru/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to start generation');
      }

      await fetchArtifacts();
    } catch (error) {
      console.error('Failed to start generation:', error);
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
            onGenerate={() => handleGenerate('mental-model')}
          />

          {/* Curriculum */}
          <ArtifactCard
            title="Curriculum"
            description="Progressive learning path built from the mental model"
            artifact={latest?.curriculum}
            projectId={projectId}
            canGenerate={!!latest?.mentalModel && latest.mentalModel.status === 'COMPLETED'}
            isGenerating={generating === 'curriculum'}
            onGenerate={() => handleGenerate('curriculum')}
            prerequisite={!latest?.mentalModel ? 'Generate mental model first' : undefined}
          />

          {/* Drill Series */}
          <ArtifactCard
            title="Drill Series"
            description="Practice exercises to reinforce learning"
            artifact={latest?.drillSeries}
            projectId={projectId}
            canGenerate={!!latest?.curriculum && latest.curriculum.status === 'COMPLETED'}
            isGenerating={generating === 'drill-series'}
            onGenerate={() => handleGenerate('drill-series')}
            prerequisite={
              !latest?.mentalModel
                ? 'Generate mental model first'
                : !latest?.curriculum
                  ? 'Generate curriculum first'
                  : undefined
            }
          />
        </div>

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
        </div>
        {artifact && (
          <span className="text-xs text-gray-500">v{artifact.version}</span>
        )}
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

      {isInProgress && (
        <div className="mb-4">
          {artifact?.progressStage ? (
            <TeachingProgressTracker
              artifactType={artifact.type}
              currentStage={artifact.progressStage}
              isComplete={false}
            />
          ) : (
            <div className="text-sm text-blue-600">
              Generating... This may take a few minutes.
            </div>
          )}
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
