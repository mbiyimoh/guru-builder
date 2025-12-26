'use client';

import { useState } from 'react';
import { Brain, BookOpen, Target, RefreshCw, Sparkles, Loader2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ExpandableNotes } from './ExpandableNotes';
import { formatDistanceToNow } from 'date-fns';
import type { ArtifactSummary } from '@/lib/teaching/artifactClient';
import type { DrillGenerationConfig } from '@/lib/guruFunctions/types';
import type { GamePhase } from '@prisma/client';

type ArtifactType = 'mental-model' | 'curriculum' | 'drill-series';

const GAME_PHASES: { value: GamePhase; label: string }[] = [
  { value: 'OPENING', label: 'Opening' },
  { value: 'EARLY', label: 'Early Game' },
  { value: 'MIDDLE', label: 'Middle Game' },
  { value: 'BEAROFF', label: 'Bearoff' },
];

interface SimpleToolbarProps {
  artifactType: ArtifactType;
  artifact: ArtifactSummary | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  userNotes: string;
  onUserNotesChange: (notes: string) => void;
  notesExpanded: boolean;
  onNotesExpandedChange: (expanded: boolean) => void;
  // Drill series configuration (only used when artifactType === 'drill-series')
  drillConfig?: DrillGenerationConfig;
  onDrillConfigChange?: (config: DrillGenerationConfig) => void;
  engineId?: string | null;
}

const TYPE_CONFIG = {
  'mental-model': {
    icon: Brain,
    label: 'Mental Model',
    description: 'Core concepts and frameworks for understanding your subject',
  },
  'curriculum': {
    icon: BookOpen,
    label: 'Curriculum',
    description: 'Structured learning path with lessons and milestones',
  },
  'drill-series': {
    icon: Target,
    label: 'Drill Series',
    description: 'Practice exercises to build and test knowledge',
  },
};

export function SimpleToolbar({
  artifactType,
  artifact,
  isGenerating,
  onGenerate,
  onRegenerate,
  userNotes,
  onUserNotesChange,
  notesExpanded,
  onNotesExpandedChange,
  drillConfig,
  onDrillConfigChange,
  engineId,
}: SimpleToolbarProps) {
  const [drillConfigExpanded, setDrillConfigExpanded] = useState(false);
  const config = TYPE_CONFIG[artifactType];
  const Icon = config.icon;

  // Show drill config panel for drill-series in Simple Mode
  // Available when:
  //   1. Before first generation (no artifact yet)
  //   2. Before regeneration (artifact exists, user can change config)
  // Hidden during active generation (can't change config mid-generation)
  const showDrillConfig =
    artifactType === 'drill-series' &&     // Drill-series only
    drillConfig && onDrillConfigChange &&  // Config props available
    !isGenerating;                         // Not currently generating

  // Handle drill count change
  const handleDrillCountChange = (value: number[]) => {
    if (drillConfig && onDrillConfigChange) {
      onDrillConfigChange({ ...drillConfig, targetDrillCount: value[0] });
    }
  };

  // Handle phase toggle
  const handlePhaseToggle = (phase: GamePhase, checked: boolean) => {
    if (drillConfig && onDrillConfigChange) {
      const newPhases = checked
        ? [...drillConfig.gamePhases, phase]
        : drillConfig.gamePhases.filter(p => p !== phase);
      // Ensure at least one phase is selected
      if (newPhases.length > 0) {
        onDrillConfigChange({ ...drillConfig, gamePhases: newPhases });
      }
    }
  };

  // Handle drill type mix change (directDrillRatio)
  const handleDrillTypeMixChange = (value: number[]) => {
    if (drillConfig && onDrillConfigChange) {
      onDrillConfigChange({ ...drillConfig, directDrillRatio: value[0] / 100 });
    }
  };

  // Calculate drill type counts for display
  const directDrillCount = drillConfig ? Math.round(drillConfig.targetDrillCount * drillConfig.directDrillRatio) : 0;
  const principleDrillCount = drillConfig ? drillConfig.targetDrillCount - directDrillCount : 0;

  const getStatusBadge = () => {
    if (!artifact) return null;
    switch (artifact.status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Completed</Badge>;
      case 'GENERATING':
        return <Badge variant="secondary">Generating...</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card" data-testid="simple-toolbar">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{config.label}</h2>
          </div>

          {artifact ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>Version {artifact.version}</span>
              <span>•</span>
              <span>Generated {formatDistanceToNow(new Date(artifact.generatedAt), { addSuffix: true })}</span>
              <span>•</span>
              {getStatusBadge()}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                No {config.label.toLowerCase()} generated yet.
              </p>
              <p className="text-xs text-muted-foreground/70">
                {config.description}
              </p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0" data-tour="generate-button">
          {artifact ? (
            <Button
              onClick={onRegenerate}
              disabled={isGenerating}
              variant="outline"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {config.label}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Drill Configuration Section (only for drill-series pre-generation) */}
      {showDrillConfig && (
        <div className="mt-4 border-t pt-4">
          <button
            type="button"
            onClick={() => setDrillConfigExpanded(!drillConfigExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Settings2 className="h-4 w-4" />
            <span>Drill Configuration</span>
            {drillConfigExpanded ? (
              <ChevronUp className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-auto" />
            )}
          </button>

          {drillConfigExpanded && (
            <div className="mt-4 space-y-4">
              {/* Drill Count Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Number of Drills</Label>
                  <span className="text-sm text-muted-foreground">
                    {drillConfig.targetDrillCount}
                  </span>
                </div>
                <Slider
                  value={[drillConfig.targetDrillCount]}
                  onValueChange={handleDrillCountChange}
                  min={5}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5</span>
                  <span>50</span>
                </div>
              </div>

              {/* Game Phase Checkboxes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Game Phases</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GAME_PHASES.map((phase) => (
                    <label
                      key={phase.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={drillConfig.gamePhases.includes(phase.value)}
                        onCheckedChange={(checked) =>
                          handlePhaseToggle(phase.value, checked === true)
                        }
                      />
                      <span className="text-sm">{phase.label}</span>
                    </label>
                  ))}
                </div>
                {drillConfig.gamePhases.length === 0 && (
                  <p className="text-xs text-destructive">
                    At least one phase must be selected
                  </p>
                )}
              </div>

              {/* Drill Type Mix Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Drill Type Mix</Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(drillConfig.directDrillRatio * 100)}% direct
                  </span>
                </div>
                <Slider
                  value={[Math.round(drillConfig.directDrillRatio * 100)]}
                  onValueChange={handleDrillTypeMixChange}
                  min={0}
                  max={100}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>All principle-focused</span>
                  <span>All &quot;best move&quot;</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {directDrillCount} &quot;best move&quot; / {principleDrillCount} principle-focused
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4" data-tour="user-notes">
        <ExpandableNotes
          value={userNotes}
          onChange={onUserNotesChange}
          expanded={notesExpanded}
          onExpandedChange={onNotesExpandedChange}
          disabled={isGenerating}
        />
      </div>
    </div>
  );
}
