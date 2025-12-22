'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DrillGenerationConfig, GamePhase } from '@/lib/guruFunctions/types';
import { DEFAULT_DRILL_CONFIG } from '@/lib/guruFunctions/types';

interface PositionCounts {
  OPENING: number;
  EARLY: number;
  MIDDLE: number;
  BEAROFF: number;
}

interface DrillConfigurationPanelProps {
  engineId: string | null;
  config: DrillGenerationConfig;
  onConfigChange: (config: DrillGenerationConfig) => void;
  onValidationChange?: (canGenerate: boolean, reason?: string) => void;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  OPENING: 'Opening Rolls',
  EARLY: 'Early Game',
  MIDDLE: 'Middle Game',
  BEAROFF: 'Bear-Off',
};

const PHASE_DESCRIPTIONS: Record<GamePhase, string> = {
  OPENING: 'First moves from the starting position',
  EARLY: 'Development and initial strategy',
  MIDDLE: 'Complex positions with contact',
  BEAROFF: 'Removing checkers from the board',
};

export function DrillConfigurationPanel({
  engineId,
  config,
  onConfigChange,
  onValidationChange,
}: DrillConfigurationPanelProps) {
  const [positionCounts, setPositionCounts] = useState<PositionCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchingCountsRef = useRef(false);

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timeout);
  }, [error]);

  const fetchPositionCounts = useCallback(async () => {
    if (!engineId || fetchingCountsRef.current) {
      if (!engineId) setPositionCounts(null);
      return;
    }

    fetchingCountsRef.current = true;
    setIsLoadingCounts(true);
    setError(null);

    try {
      const res = await fetch(`/api/position-library/counts?engineId=${engineId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch position counts');
      }
      const data = await res.json();
      setPositionCounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load position counts');
    } finally {
      setIsLoadingCounts(false);
      fetchingCountsRef.current = false;
    }
  }, [engineId]);

  useEffect(() => {
    fetchPositionCounts();
  }, [fetchPositionCounts]);

  const handlePhaseToggle = (phase: GamePhase) => {
    const newPhases = config.gamePhases.includes(phase)
      ? config.gamePhases.filter(p => p !== phase)
      : [...config.gamePhases, phase];

    if (newPhases.length === 0) return;

    onConfigChange({
      ...config,
      gamePhases: newPhases as GamePhase[],
    });
  };

  const handleDrillCountChange = (value: number) => {
    onConfigChange({
      ...config,
      targetDrillCount: Math.max(5, Math.min(50, value)),
    });
  };

  const handleRatioChange = (value: number) => {
    onConfigChange({
      ...config,
      directDrillRatio: Math.max(0, Math.min(1, value)),
    });
  };

  const directCount = Math.round(config.targetDrillCount * config.directDrillRatio);
  const principleCount = config.targetDrillCount - directCount;

  const totalAvailablePositions = positionCounts
    ? config.gamePhases.reduce((sum, phase) => sum + (positionCounts[phase] || 0), 0)
    : 0;

  const hasAnyPositions = engineId ? totalAvailablePositions > 0 : true;

  useEffect(() => {
    if (!onValidationChange) return;

    if (!engineId) {
      onValidationChange(true);
    } else if (isLoadingCounts) {
      onValidationChange(false, 'Loading position counts...');
    } else if (!hasAnyPositions) {
      onValidationChange(false, 'No positions available for selected phases. Import match archives first.');
    } else {
      onValidationChange(true);
    }
  }, [engineId, isLoadingCounts, hasAnyPositions, onValidationChange]);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Drill Configuration</h4>
        <p className="text-xs text-gray-500 mt-1">
          Configure which game phases to cover and how many drills to generate.
        </p>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {!engineId && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          No ground truth engine configured. Position library features are disabled.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Game Phases</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.keys(PHASE_LABELS) as GamePhase[]).map(phase => {
            const count = positionCounts?.[phase] ?? 0;
            const isEnabled = config.gamePhases.includes(phase);
            const isLoading = isLoadingCounts;

            return (
              <div
                key={phase}
                className={`
                  relative p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${isEnabled
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                  }
                `}
                onClick={() => handlePhaseToggle(phase)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {PHASE_LABELS[phase]}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {PHASE_DESCRIPTIONS[phase]}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handlePhaseToggle(phase)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    onClick={e => e.stopPropagation()}
                  />
                </div>

                <div className="mt-2">
                  <span className="text-xs text-gray-500">
                    {isLoading ? (
                      'Loading...'
                    ) : engineId ? (
                      <span className={count > 0 ? 'text-green-600 font-medium' : ''}>
                        {count.toLocaleString()} positions
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {engineId && !isLoadingCounts && !hasAnyPositions && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Cannot generate:</strong> No positions available for selected phases. Import match archives from the Ground Truth Engine section above.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Target Drill Count</label>
          <span className="text-sm font-medium text-blue-600">{config.targetDrillCount}</span>
        </div>
        <input
          type="range"
          min={5}
          max={50}
          value={config.targetDrillCount}
          onChange={e => handleDrillCountChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>5 drills</span>
          <span>50 drills</span>
        </div>
        {engineId && totalAvailablePositions > 0 && (
          <p className="text-xs text-gray-500">
            {totalAvailablePositions} positions available for selected phases
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Drill Type Mix</label>
          <span className="text-sm text-gray-600">
            {Math.round(config.directDrillRatio * 100)}% direct
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={config.directDrillRatio * 100}
          onChange={e => handleRatioChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>All principle-focused</span>
          <span>All &quot;best move&quot;</span>
        </div>

        <div className="flex gap-2 mt-2">
          <div className="flex-1 p-2 bg-blue-50 rounded text-center">
            <div className="text-lg font-semibold text-blue-700">{directCount}</div>
            <div className="text-xs text-blue-600">&quot;Best move&quot; drills</div>
          </div>
          <div className="flex-1 p-2 bg-purple-50 rounded text-center">
            <div className="text-lg font-semibold text-purple-700">{principleCount}</div>
            <div className="text-xs text-purple-600">Principle-focused</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_DRILL_CONFIG };
export type { DrillGenerationConfig };
