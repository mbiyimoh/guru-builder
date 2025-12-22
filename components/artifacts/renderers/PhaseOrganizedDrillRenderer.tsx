'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrincipleById } from '@/lib/backgammon';
import { DrillCardWithPosition } from './cards/DrillCardWithPosition';
import type {
  PhaseOrganizedDrillSeries,
  PhaseSection,
  PhaseDrill,
} from '@/lib/guruFunctions/schemas/phaseOrganizedDrillSchema';
import type { TOCItem } from '@/lib/teaching/types/toc';

// =============================================================================
// TYPES
// =============================================================================

interface PhaseOrganizedDrillRendererProps {
  content: PhaseOrganizedDrillSeries;
  /** Project ID for position attribution lookups */
  projectId?: string;
  onDeleteDrill?: (drillId: string) => void;
  className?: string;
}

// =============================================================================
// PHASE COLOR CONFIG
// =============================================================================

const PHASE_COLORS: Record<string, { gradient: string; border: string; bg: string }> = {
  OPENING: {
    gradient: 'from-emerald-600 to-emerald-500',
    border: 'border-emerald-700',
    bg: 'bg-emerald-50',
  },
  EARLY: {
    gradient: 'from-sky-600 to-sky-500',
    border: 'border-sky-700',
    bg: 'bg-sky-50',
  },
  MIDDLE: {
    gradient: 'from-orange-600 to-orange-500',
    border: 'border-orange-700',
    bg: 'bg-orange-50',
  },
  BEAROFF: {
    gradient: 'from-rose-600 to-rose-500',
    border: 'border-rose-700',
    bg: 'bg-rose-50',
  },
};

const TIER_COLORS: Record<string, string> = {
  RECOGNITION: 'bg-green-100 text-green-700',
  APPLICATION: 'bg-blue-100 text-blue-700',
  TRANSFER: 'bg-purple-100 text-purple-700',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PhaseOrganizedDrillRenderer({
  content,
  projectId,
  onDeleteDrill,
  className,
}: PhaseOrganizedDrillRendererProps) {
  return (
    <div className={cn('space-y-8', className)} data-testid="phase-organized-drill-renderer">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.drillSeriesTitle}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            <strong>{content.totalDrillCount}</strong> drills
          </span>
          <span>
            ~<strong>{content.estimatedCompletionMinutes}</strong> min total
          </span>
        </div>
      </header>

      {/* Design Thoughts */}
      {content.designThoughts && (
        <section id="design-thoughts" className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h2 className="text-lg font-semibold text-amber-800 mb-3">
            Design Thoughts
          </h2>
          <div className="space-y-2 text-sm">
            <p>
              <strong className="text-amber-700">Methodology Rationale:</strong>{' '}
              <span className="text-gray-700">{content.designThoughts.methodologyRationale}</span>
            </p>
            <p>
              <strong className="text-amber-700">Variety Analysis:</strong>{' '}
              <span className="text-gray-700">{content.designThoughts.varietyAnalysis}</span>
            </p>
            <p>
              <strong className="text-amber-700">Pedagogical Notes:</strong>{' '}
              <span className="text-gray-700">{content.designThoughts.pedagogicalNotes}</span>
            </p>
            <p>
              <strong className="text-amber-700">Principle Integration:</strong>{' '}
              <span className="text-gray-700">{content.designThoughts.principleIntegration}</span>
            </p>
          </div>
        </section>
      )}

      {/* Phase Sections */}
      {content.phases.map((phase) => (
        <PhaseSectionComponent
          key={phase.phase}
          phase={phase}
          projectId={projectId}
          onDeleteDrill={onDeleteDrill}
        />
      ))}
    </div>
  );
}

// =============================================================================
// PHASE SECTION COMPONENT
// =============================================================================

function PhaseSectionComponent({
  phase,
  projectId,
  onDeleteDrill,
}: {
  phase: PhaseSection;
  projectId?: string;
  onDeleteDrill?: (id: string) => void;
}) {
  const colors = PHASE_COLORS[phase.phase] || PHASE_COLORS.OPENING;
  const totalDrills = phase.principleGroups.reduce((sum, group) => sum + group.drills.length, 0);

  return (
    <section id={`phase-${phase.phase.toLowerCase()}`} className="mb-12">
      {/* Phase Header */}
      <div className="mb-6">
        <h2
          className={cn(
            'text-xl font-semibold text-white px-4 py-3 rounded-r-lg border-l-8 -ml-4 bg-gradient-to-r',
            colors.gradient,
            colors.border
          )}
        >
          {phase.phaseTitle}
          <span className="ml-2 opacity-75 font-normal">
            ({totalDrills} drills)
          </span>
        </h2>
        <p className="text-gray-600 mt-2 px-4">{phase.phaseDescription}</p>

        {/* Universal principles for this phase */}
        <div className="mt-3 px-4 flex flex-wrap gap-2">
          {phase.universalPrinciples.map((principle) => (
            <PrincipleBadge key={principle.id} principleId={principle.id} variant="universal" />
          ))}
        </div>
      </div>

      {/* Principle Groups */}
      {phase.principleGroups.map((group) => (
        <div key={group.principleId} className="mb-8">
          {/* Principle Group Header */}
          <div
            id={`principle-${phase.phase.toLowerCase()}-${group.principleId}`}
            className="px-4 mb-4"
          >
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <PrincipleBadge principleId={group.principleId} variant="phase" />
              <span className="text-sm font-normal text-gray-600">
                ({group.drills.length} {group.drills.length === 1 ? 'drill' : 'drills'})
              </span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">{group.principleDescription}</p>
          </div>

          {/* Drills in this principle group */}
          <div className="space-y-4 px-4">
            {group.drills.map((drill, index) => (
              projectId ? (
                <DrillCardWithPosition
                  key={drill.drillId}
                  id={`drill-${drill.drillId}`}
                  drill={drill}
                  drillNumber={index + 1}
                  totalDrills={group.drills.length}
                  projectId={projectId}
                  onDelete={onDeleteDrill ? () => onDeleteDrill(drill.drillId) : undefined}
                />
              ) : (
                <PhaseDrillCard
                  key={drill.drillId}
                  id={`drill-${drill.drillId}`}
                  drill={drill}
                  drillNumber={index + 1}
                  totalDrills={group.drills.length}
                  onDelete={onDeleteDrill ? () => onDeleteDrill(drill.drillId) : undefined}
                />
              )
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// =============================================================================
// PRINCIPLE BADGE
// =============================================================================

function PrincipleBadge({
  principleId,
  variant,
}: {
  principleId: string;
  variant: 'universal' | 'phase';
}) {
  const principle = getPrincipleById(principleId);
  if (!principle) return null;

  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded',
        variant === 'universal'
          ? 'bg-purple-100 text-purple-700'
          : 'bg-blue-100 text-blue-700'
      )}
      title={principle.description}
    >
      {principle.name}
    </span>
  );
}

// =============================================================================
// PHASE DRILL CARD
// =============================================================================

function PhaseDrillCard({
  id,
  drill,
  drillNumber,
  totalDrills,
  onDelete,
}: {
  id: string;
  drill: PhaseDrill;
  drillNumber: number;
  totalDrills: number;
  onDelete?: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`phase-drill-card-${drill.drillId}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">
            Drill {drillNumber} of {totalDrills}
          </span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
              {drill.methodology}
            </span>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded', TIER_COLORS[drill.tier])}>
              {drill.tier}
            </span>
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete drill"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Principle tags for this drill */}
        <div className="flex flex-wrap gap-1">
          {/* Primary principle */}
          {(() => {
            const p = getPrincipleById(drill.primaryPrincipleId);
            return p ? (
              <span
                key={drill.primaryPrincipleId}
                className="px-1.5 py-0.5 text-xs rounded bg-blue-200 text-blue-700 font-medium"
                title={`Primary: ${p.description}`}
              >
                {p.name}
              </span>
            ) : null;
          })()}

          {/* Universal principles */}
          {drill.universalPrincipleIds.map((pid: string) => {
            const p = getPrincipleById(pid);
            return p ? (
              <span
                key={pid}
                className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600"
                title={p.description}
              >
                {p.name}
              </span>
            ) : null;
          })}
        </div>
      </div>

      {/* Scenario & Question */}
      <div className="p-4">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Scenario</h4>
          <p className="text-gray-700">{drill.scenario}</p>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Question</h4>
          <p className="font-medium text-gray-900">{drill.question}</p>
        </div>

        {/* Options (if multiple choice) */}
        {drill.options && drill.options.length > 0 && (
          <div className="space-y-2">
            {drill.options.map((option) => (
              <div
                key={option.id}
                className={cn(
                  'p-3 rounded border',
                  option.isCorrect
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-600 shrink-0">
                    {option.id})
                  </span>
                  <span className={option.isCorrect ? 'text-green-800' : 'text-gray-700'}>
                    {option.text}
                  </span>
                  {option.isCorrect && (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 ml-auto" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Non-multiple choice answer display */}
        {(!drill.options || drill.options.length === 0) && drill.correctAnswer && (
          <div className="p-3 rounded border border-green-300 bg-green-50">
            <span className="text-sm font-medium text-green-700">Correct Answer:</span>{' '}
            <span className="text-green-800">{drill.correctAnswer}</span>
          </div>
        )}
      </div>

      {/* Feedback Toggle */}
      <button
        onClick={() => setShowFeedback(!showFeedback)}
        className="w-full p-3 text-left text-sm text-blue-700 hover:bg-blue-50 border-t border-gray-100 flex items-center justify-between"
      >
        {showFeedback ? 'Hide Feedback' : 'Show Feedback'}
        {showFeedback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Feedback */}
      {showFeedback && (
        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-1">Correct Response</h4>
            <p className="text-gray-700 text-sm">{drill.feedback.correct}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-1">Incorrect Response</h4>
            <p className="text-gray-700 text-sm">{drill.feedback.incorrect}</p>
          </div>
          {drill.feedback.partialCredit && (
            <div>
              <h4 className="text-sm font-medium text-amber-700 mb-1">Partial Credit</h4>
              <p className="text-gray-700 text-sm">{drill.feedback.partialCredit}</p>
            </div>
          )}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Explanation</h4>
            <p className="text-gray-700 text-sm">{drill.explanation}</p>
          </div>
          {drill.hints && drill.hints.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Hints</h4>
              <ul className="list-disc list-inside text-gray-700 text-sm">
                {drill.hints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TOC GENERATOR
// =============================================================================

/**
 * Generate TOC items for phase-organized drill series
 * Creates hierarchical structure: Phase → Principle Group → Drills
 */
export function generatePhaseOrganizedDrillTOC(content: PhaseOrganizedDrillSeries): TOCItem[] {
  const items: TOCItem[] = [];

  // Add Design Thoughts to TOC if present
  if (content.designThoughts) {
    items.push({ id: 'design-thoughts', label: 'Design Thoughts', level: 1 });
  }

  // Add phase sections with hierarchical principle groups
  content.phases.forEach((phase) => {
    // Create principle group items with nested drills
    const principleGroupItems: TOCItem[] = phase.principleGroups.map((group) => ({
      id: `principle-${phase.phase.toLowerCase()}-${group.principleId}`,
      label: `${group.principleName} (${group.drills.length})`,
      level: 2,
      children: group.drills.map((drill, index) => ({
        id: `drill-${drill.drillId}`,
        label: `Drill ${index + 1}: ${drill.tier}`,
        level: 3,
      })),
    }));

    items.push({
      id: `phase-${phase.phase.toLowerCase()}`,
      label: phase.phaseTitle,
      level: 1,
      children: principleGroupItems,
    });
  });

  return items;
}

export default PhaseOrganizedDrillRenderer;
