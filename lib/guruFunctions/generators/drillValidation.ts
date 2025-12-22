import type { GamePhase } from '@prisma/client';
import type { PhaseOrganizedDrillSeries } from '../schemas/phaseOrganizedDrillSchema';
import type { DrillSeriesOutput } from '../schemas/drillSeriesSchema';

/**
 * Configuration for drill generation requirements
 */
export interface DrillGenerationConfig {
  targetDrillCount: number;
  gamePhases: GamePhase[];
}

/**
 * Result of drill output validation
 */
export interface ValidationResult {
  valid: boolean;
  actualCount: number;
  expectedCount: number;
  phaseBreakdown: Record<GamePhase, { actual: number; expected: number }>;
  issues: string[];
}

/**
 * Distributes a target drill count evenly across game phases.
 * Gives extra drills to the first phases when count doesn't divide evenly.
 *
 * @param targetCount - Total number of drills to distribute
 * @param phases - Game phases to distribute across
 * @returns Map of phase to drill count
 *
 * @example
 * distributeAcrossPhases(10, ['OPENING', 'EARLY', 'MIDDLE'])
 * // Returns: Map { 'OPENING' => 4, 'EARLY' => 3, 'MIDDLE' => 3 }
 */
export function distributeAcrossPhases(
  targetCount: number,
  phases: GamePhase[]
): Map<GamePhase, number> {
  const result = new Map<GamePhase, number>();
  const baseCount = Math.floor(targetCount / phases.length);
  let remainder = targetCount % phases.length;

  for (const phase of phases) {
    const count = baseCount + (remainder > 0 ? 1 : 0);
    result.set(phase, count);
    if (remainder > 0) remainder--;
  }

  return result;
}

/**
 * Validates generated drill output against requirements.
 * Checks total count (with ±1 tolerance) and per-phase distribution.
 *
 * Works with the PhaseOrganizedDrillSeries schema where drills are organized
 * directly under phase sections: phases[].drills[]
 *
 * @param output - The generated drill series output
 * @param config - Configuration with target count and phases
 * @returns Validation result with issues array
 *
 * @example
 * const result = validateDrillOutput(drillSeries, { targetDrillCount: 10, gamePhases: ['OPENING'] });
 * if (!result.valid) {
 *   console.error('Validation failed:', result.issues);
 * }
 */
export function validateDrillOutput(
  output: PhaseOrganizedDrillSeries,
  config: DrillGenerationConfig
): ValidationResult {
  const issues: string[] = [];
  const phaseBreakdown: Record<string, { actual: number; expected: number }> = {};

  const expectedPerPhase = distributeAcrossPhases(config.targetDrillCount, config.gamePhases);

  // Count drills per phase from the phase sections
  // Structure: phases[].drills[] (drills are directly under phase, not nested)
  let totalActual = 0;

  for (const phase of config.gamePhases) {
    const phaseSection = output.phases.find((p) => p.phase === phase);
    // Count drills across all principle groups in this phase
    const actual = phaseSection
      ? phaseSection.principleGroups.reduce((sum, group) => sum + group.drills.length, 0)
      : 0;
    const expected = expectedPerPhase.get(phase) ?? 0;

    phaseBreakdown[phase] = { actual, expected };
    totalActual += actual;

    // Check if phase count is too far off (allow ±1 tolerance per phase)
    if (Math.abs(actual - expected) > 1) {
      issues.push(`${phase}: expected ${expected}, got ${actual}`);
    }
  }

  // Overall count check with ±1 tolerance
  const countValid = Math.abs(totalActual - config.targetDrillCount) <= 1;

  return {
    valid: countValid && issues.length === 0,
    actualCount: totalActual,
    expectedCount: config.targetDrillCount,
    phaseBreakdown: phaseBreakdown as Record<GamePhase, { actual: number; expected: number }>,
    issues,
  };
}

/**
 * Builds a clear feedback message for retry attempts when drill generation
 * doesn't match the expected count or phase distribution.
 *
 * @param validation - The validation result from validateDrillOutput
 * @param config - The drill generation configuration
 * @returns Formatted feedback message for GPT to understand corrections needed
 *
 * @example
 * const feedback = buildRetryFeedback(validationResult, drillConfig);
 * // Returns multi-line message with specific counts needed per phase
 */
export function buildRetryFeedback(
  validation: ValidationResult,
  config: DrillGenerationConfig
): string {
  return `
IMPORTANT CORRECTION REQUIRED:

Your previous response generated ${validation.actualCount} drills but I need EXACTLY ${validation.expectedCount} drills.

Phase breakdown required:
${config.gamePhases.map(phase => {
  const info = validation.phaseBreakdown[phase];
  return `- ${phase}: Need ${info.expected} drills (you provided ${info.actual})`;
}).join('\n')}

Please regenerate with the EXACT counts specified above. Do not skip any phases.
`;
}

/**
 * Generates enhanced feedback for validation retry attempts.
 * Provides detailed drill shortage information with attempt tracking.
 *
 * @param validation - The validation result from validateDrillOutput
 * @param attempt - Current retry attempt number (1-indexed)
 * @param maxAttempts - Maximum number of retry attempts allowed (default: 3)
 * @returns Formatted feedback message with shortage details and encouragement
 *
 * @example
 * const feedback = generateEnhancedFeedback(validationResult, 1);
 * // Returns:
 * // VALIDATION FAILED (Attempt 1 of 3)
 * //
 * // The generated output does not meet drill count requirements:
 * // - Total drills: 2 (expected: 10)
 * // ...
 */
export function generateEnhancedFeedback(
  validation: ValidationResult,
  attempt: number,
  maxAttempts: number = 3
): string {
  const lines: string[] = [];

  // Header with attempt tracking
  lines.push(`VALIDATION FAILED (Attempt ${attempt} of ${maxAttempts})`);
  lines.push('');

  // Overall summary
  lines.push('The generated output does not meet drill count requirements:');
  lines.push(`- Total drills: ${validation.actualCount} (expected: ${validation.expectedCount})`);
  lines.push('');

  // Phase-by-phase shortage details
  const shortages = Object.entries(validation.phaseBreakdown)
    .filter(([_, info]) => info.actual < info.expected)
    .map(([phase, info]) => {
      const needed = info.expected - info.actual;
      return `- ${phase}: Generated ${info.actual}, need ${needed} more`;
    });

  if (shortages.length > 0) {
    lines.push('Phase shortages:');
    lines.push(...shortages);
    lines.push('');
  }

  // Encouragement and clear instructions
  lines.push('Please regenerate with EXACTLY the required drill counts per phase.');
  lines.push('Each phase MUST have the specified number of drills within its principleGroups.');

  return lines.join('\n');
}

/**
 * Validates legacy DrillSeriesOutput against configuration requirements.
 * This works with the OLD schema structure (series[].drills[]) until migration is complete.
 *
 * @param output - The generated drill series output (legacy schema)
 * @param config - Configuration with target count and phases
 * @returns Validation result with issues array
 */
export function validateLegacyDrillOutput(
  output: DrillSeriesOutput,
  config: DrillGenerationConfig
): ValidationResult {
  const issues: string[] = [];
  const phaseBreakdown: Record<string, { actual: number; expected: number }> = {};

  const expectedPerPhase = distributeAcrossPhases(config.targetDrillCount, config.gamePhases);

  // Count drills per phase from the legacy structure: series[].drills[]
  // Each drill may have a gamePhase field (optional)
  let totalActual = 0;

  // Initialize phase breakdown
  for (const phase of config.gamePhases) {
    phaseBreakdown[phase] = { actual: 0, expected: expectedPerPhase.get(phase) ?? 0 };
  }

  // Count all drills across all series
  for (const series of output.series) {
    for (const drill of series.drills) {
      totalActual++;

      // If drill has gamePhase assigned, count it for that phase
      if (drill.gamePhase && config.gamePhases.includes(drill.gamePhase)) {
        phaseBreakdown[drill.gamePhase].actual++;
      }
    }
  }

  // If drills don't have gamePhase assigned, we can only validate total count
  const hasPhaseAssignments = Object.values(phaseBreakdown).some(p => p.actual > 0);

  if (hasPhaseAssignments) {
    // Check per-phase distribution (allow ±1 tolerance per phase)
    for (const phase of config.gamePhases) {
      const { actual, expected } = phaseBreakdown[phase];
      if (Math.abs(actual - expected) > 1) {
        issues.push(`${phase}: expected ${expected}, got ${actual}`);
      }
    }
  } else {
    // No phase assignments - just validate total count
    console.log('[DrillValidation] Legacy drills have no gamePhase assignments, validating total count only');
  }

  // Overall count check with ±1 tolerance
  const countValid = Math.abs(totalActual - config.targetDrillCount) <= 1;

  return {
    valid: countValid && issues.length === 0,
    actualCount: totalActual,
    expectedCount: config.targetDrillCount,
    phaseBreakdown: phaseBreakdown as Record<GamePhase, { actual: number; expected: number }>,
    issues,
  };
}
