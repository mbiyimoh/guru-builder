/**
 * Unit tests for drill count validation utilities
 *
 * Tests cover:
 * - distributeAcrossPhases: Even/uneven distribution across game phases
 * - validateDrillOutput: Count validation with ±1 tolerance
 * - buildRetryFeedback: Feedback message generation
 */

import { GamePhase } from '@prisma/client';
import type {
  PhaseOrganizedDrillSeries,
  PhaseDrill,
  PhaseSection,
} from '../../schemas/phaseOrganizedDrillSchema';
import type {
  DrillSeriesOutput,
  Drill,
  PrincipleSeries,
} from '../../schemas/drillSeriesSchema';
import {
  distributeAcrossPhases,
  validateDrillOutput,
  validateLegacyDrillOutput,
  buildRetryFeedback,
  type DrillGenerationConfig,
  type ValidationResult,
} from '../drillValidation';

// ============================================================================
// Mock Data Helpers
// ============================================================================

/**
 * Creates a minimal drill with required fields for testing
 */
function createMockDrill(
  phase: GamePhase,
  drillId: string = 'drill-1'
): PhaseDrill {
  return {
    drillId,
    tier: 'RECOGNITION',
    methodology: 'scenario-analysis',
    gamePhase: phase,
    positionId: 'test-position-id',
    primaryPrincipleId: 'principle-1',
    universalPrincipleIds: ['pip-count', 'risk-reward'],
    scenario: 'Test scenario',
    question: 'Test question',
    answerFormat: 'MULTIPLE_CHOICE',
    options: [
      {
        id: 'opt-1',
        text: 'Option 1',
        isCorrect: true,
      },
      {
        id: 'opt-2',
        text: 'Option 2',
        isCorrect: false,
      },
    ],
    correctAnswer: 'opt-1',
    explanation: 'Test explanation',
    feedback: {
      correct: 'Correct!',
      incorrect: 'Incorrect',
      partialCredit: null,
    },
    hints: null,
    relatedConcepts: null,
  };
}

/**
 * Creates a mock phase section with specified drills
 */
function createMockPhaseSection(
  phase: GamePhase,
  drills: PhaseDrill[]
): PhaseSection {
  return {
    phase,
    phaseTitle: `${phase} Phase`,
    phaseDescription: `Test ${phase} phase`,
    targetDrillCount: drills.length,
    actualDrillCount: drills.length,
    universalPrinciples: [
      { id: 'pip-count', name: 'Pip Count' },
      { id: 'risk-reward', name: 'Risk-Reward Balance' },
    ],
    principleGroups: [
      {
        principleId: 'principle-1',
        principleName: 'Test Principle',
        principleDescription: 'Test principle description',
        drillCount: drills.length,
        drills,
      },
    ],
  };
}

/**
 * Creates a complete mock phase-organized drill series output
 */
function createMockDrillSeriesOutput(
  phaseSections: PhaseSection[]
): PhaseOrganizedDrillSeries {
  const totalDrills = phaseSections.reduce(
    (sum, section) => sum + section.principleGroups.reduce((groupSum, g) => groupSum + g.drills.length, 0),
    0
  );

  return {
    drillSeriesTitle: 'Test Drill Series',
    totalDrillCount: totalDrills,
    estimatedCompletionMinutes: 15,
    phases: phaseSections,
    designThoughts: null,
  };
}

/**
 * Creates a minimal legacy drill for testing
 */
function createMockLegacyDrill(
  phase: GamePhase | null = null,
  drillId: string = 'drill-1'
): Drill {
  return {
    drillId,
    tier: 'RECOGNITION',
    methodology: null,
    positionId: null,
    gamePhase: phase,
    scenario: {
      setup: 'Test setup',
      visual: null,
      question: 'Test question',
    },
    options: [
      {
        id: 'opt-1',
        text: 'Option 1',
        isCorrect: true,
        commonMistake: null,
      },
      {
        id: 'opt-2',
        text: 'Option 2',
        isCorrect: false,
        commonMistake: null,
      },
    ],
    correctAnswer: 'opt-1',
    feedback: {
      correct: {
        brief: 'Correct!',
        principleReinforcement: 'Great job',
        expanded: null,
      },
      incorrect: {
        brief: 'Incorrect',
        principleReminder: 'Remember...',
        commonMistakeAddress: 'Common mistake',
        tryAgainHint: 'Try again',
      },
    },
    asciiWireframe: null,
    metadata: {
      estimatedSeconds: 30,
      prerequisiteDrills: [],
      tags: [],
    },
  };
}

/**
 * Creates a legacy drill series output
 */
function createMockLegacyDrillSeriesOutput(
  series: PrincipleSeries[]
): DrillSeriesOutput {
  const totalDrills = series.reduce((sum, s) => sum + s.drills.length, 0);

  return {
    drillSeriesTitle: 'Test Legacy Drill Series',
    targetPrinciples: ['principle-1'],
    totalDrills,
    estimatedCompletionMinutes: 15,
    series,
    practiceSequences: null,
    designThoughts: null,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Drill Output Validation', () => {

  // ==========================================================================
  // distributeAcrossPhases Tests
  // ==========================================================================

  describe('distributeAcrossPhases', () => {
    test('divides evenly with no remainder', () => {
      const result = distributeAcrossPhases(10, [GamePhase.OPENING, GamePhase.MIDDLE]);

      expect(result.get(GamePhase.OPENING)).toBe(5);
      expect(result.get(GamePhase.MIDDLE)).toBe(5);
      expect(result.size).toBe(2);
    });

    test('handles remainder by giving extra to first phases', () => {
      const result = distributeAcrossPhases(10, [
        GamePhase.OPENING,
        GamePhase.EARLY,
        GamePhase.MIDDLE,
      ]);

      // 10 / 3 = 3 base, 1 remainder
      // First phase gets extra: 4, 3, 3
      expect(result.get(GamePhase.OPENING)).toBe(4);
      expect(result.get(GamePhase.EARLY)).toBe(3);
      expect(result.get(GamePhase.MIDDLE)).toBe(3);
      expect(result.size).toBe(3);

      // Verify total is correct
      const total = Array.from(result.values()).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(10);
    });

    test('handles single phase', () => {
      const result = distributeAcrossPhases(10, [GamePhase.OPENING]);

      expect(result.get(GamePhase.OPENING)).toBe(10);
      expect(result.size).toBe(1);
    });

    test('handles four phases with remainder', () => {
      const result = distributeAcrossPhases(15, [
        GamePhase.OPENING,
        GamePhase.EARLY,
        GamePhase.MIDDLE,
        GamePhase.BEAROFF,
      ]);

      // 15 / 4 = 3 base, 3 remainder
      // First three phases get extra: 4, 4, 4, 3
      expect(result.get(GamePhase.OPENING)).toBe(4);
      expect(result.get(GamePhase.EARLY)).toBe(4);
      expect(result.get(GamePhase.MIDDLE)).toBe(4);
      expect(result.get(GamePhase.BEAROFF)).toBe(3);

      // Verify total
      const total = Array.from(result.values()).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(15);
    });

    test('handles all phases equally', () => {
      const result = distributeAcrossPhases(20, [
        GamePhase.OPENING,
        GamePhase.EARLY,
        GamePhase.MIDDLE,
        GamePhase.BEAROFF,
      ]);

      // 20 / 4 = 5 each, no remainder
      expect(result.get(GamePhase.OPENING)).toBe(5);
      expect(result.get(GamePhase.EARLY)).toBe(5);
      expect(result.get(GamePhase.MIDDLE)).toBe(5);
      expect(result.get(GamePhase.BEAROFF)).toBe(5);
    });
  });

  // ==========================================================================
  // validateDrillOutput Tests
  // ==========================================================================

  describe('validateDrillOutput', () => {
    test('returns valid=true for exact count match', () => {
      // Create 10 drills: 5 OPENING, 5 MIDDLE
      const openingDrills = Array.from({ length: 5 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-opening-${i}`)
      );
      const middleDrills = Array.from({ length: 5 }, (_, i) =>
        createMockDrill(GamePhase.MIDDLE, `drill-middle-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
        createMockPhaseSection(GamePhase.MIDDLE, middleDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const result = validateDrillOutput(output, config);

      expect(result.valid).toBe(true);
      expect(result.actualCount).toBe(10);
      expect(result.expectedCount).toBe(10);
      expect(result.issues).toHaveLength(0);
      expect(result.phaseBreakdown[GamePhase.OPENING]).toEqual({ actual: 5, expected: 5 });
      expect(result.phaseBreakdown[GamePhase.MIDDLE]).toEqual({ actual: 5, expected: 5 });
    });

    test('returns valid=true for count within +1 tolerance', () => {
      // Create 11 drills when expecting 10 (within tolerance)
      const openingDrills = Array.from({ length: 6 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-opening-${i}`)
      );
      const middleDrills = Array.from({ length: 5 }, (_, i) =>
        createMockDrill(GamePhase.MIDDLE, `drill-middle-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
        createMockPhaseSection(GamePhase.MIDDLE, middleDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const result = validateDrillOutput(output, config);

      expect(result.valid).toBe(true); // Within ±1 tolerance
      expect(result.actualCount).toBe(11);
      expect(result.expectedCount).toBe(10);
    });

    test('returns valid=false when count within tolerance but phase distribution wrong', () => {
      // Create 11 drills when expecting 12 (within tolerance)
      // But phase distribution has MIDDLE with only 1 drill (expect 4)
      const openingDrills = Array.from({ length: 6 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-opening-${i}`)
      );
      const earlyDrills = Array.from({ length: 4 }, (_, i) =>
        createMockDrill(GamePhase.EARLY, `drill-early-${i}`)
      );
      const middleDrills = Array.from({ length: 1 }, (_, i) =>
        createMockDrill(GamePhase.MIDDLE, `drill-middle-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
        createMockPhaseSection(GamePhase.EARLY, earlyDrills),
        createMockPhaseSection(GamePhase.MIDDLE, middleDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 12,
        gamePhases: [GamePhase.OPENING, GamePhase.EARLY, GamePhase.MIDDLE],
      };

      const result = validateDrillOutput(output, config);

      // Phase distribution is wrong (MIDDLE has 1 but expects 4, delta > 1)
      expect(result.valid).toBe(false);
      expect(result.actualCount).toBe(11);
      expect(result.expectedCount).toBe(12);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('returns valid=false for significant count mismatch', () => {
      // Create 12 drills when expecting 10 (beyond ±1 tolerance)
      const openingDrills = Array.from({ length: 12 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const result = validateDrillOutput(output, config);

      expect(result.valid).toBe(false); // Beyond ±1 tolerance
      expect(result.actualCount).toBe(12);
      expect(result.expectedCount).toBe(10);
    });

    test('returns valid=false when phase has fewer drills than expected', () => {
      // Create 10 total but wrong distribution: 7 OPENING, 3 MIDDLE (expect 5, 5)
      const openingDrills = Array.from({ length: 7 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-opening-${i}`)
      );
      const middleDrills = Array.from({ length: 3 }, (_, i) =>
        createMockDrill(GamePhase.MIDDLE, `drill-middle-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
        createMockPhaseSection(GamePhase.MIDDLE, middleDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const result = validateDrillOutput(output, config);

      expect(result.valid).toBe(false); // Phase distribution is wrong (delta > 1)
      expect(result.actualCount).toBe(10);
      expect(result.expectedCount).toBe(10);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.phaseBreakdown[GamePhase.MIDDLE]).toEqual({ actual: 3, expected: 5 });
    });

    test('populates phaseBreakdown correctly with multiple phases', () => {
      // Create 10 drills: 4 OPENING, 3 EARLY, 3 MIDDLE
      const openingDrills = Array.from({ length: 4 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-opening-${i}`)
      );
      const earlyDrills = Array.from({ length: 3 }, (_, i) =>
        createMockDrill(GamePhase.EARLY, `drill-early-${i}`)
      );
      const middleDrills = Array.from({ length: 3 }, (_, i) =>
        createMockDrill(GamePhase.MIDDLE, `drill-middle-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
        createMockPhaseSection(GamePhase.EARLY, earlyDrills),
        createMockPhaseSection(GamePhase.MIDDLE, middleDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.EARLY, GamePhase.MIDDLE],
      };

      const result = validateDrillOutput(output, config);

      expect(result.valid).toBe(true);
      expect(result.phaseBreakdown[GamePhase.OPENING]).toEqual({ actual: 4, expected: 4 });
      expect(result.phaseBreakdown[GamePhase.EARLY]).toEqual({ actual: 3, expected: 3 });
      expect(result.phaseBreakdown[GamePhase.MIDDLE]).toEqual({ actual: 3, expected: 3 });
    });

    test('handles drills without gamePhase (null phase)', () => {
      // In the new schema, drills must have a gamePhase, so this test
      // validates that missing phase sections are handled correctly
      const openingDrills = Array.from({ length: 5 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-opening-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 5,
        gamePhases: [GamePhase.OPENING],
      };

      const result = validateDrillOutput(output, config);

      expect(result.actualCount).toBe(5);
      expect(result.phaseBreakdown[GamePhase.OPENING]).toEqual({ actual: 5, expected: 5 });
    });

    test('handles drills across multiple series', () => {
      // Create 10 drills all in OPENING phase
      const openingDrills = Array.from({ length: 10 }, (_, i) =>
        createMockDrill(GamePhase.OPENING, `drill-${i}`)
      );

      const output = createMockDrillSeriesOutput([
        createMockPhaseSection(GamePhase.OPENING, openingDrills),
      ]);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING],
      };

      const result = validateDrillOutput(output, config);

      expect(result.valid).toBe(true);
      expect(result.actualCount).toBe(10);
      expect(result.phaseBreakdown[GamePhase.OPENING]).toEqual({ actual: 10, expected: 10 });
    });
  });

  // ==========================================================================
  // buildRetryFeedback Tests
  // ==========================================================================

  describe('buildRetryFeedback', () => {
    test('includes actual vs expected total counts', () => {
      const validation: ValidationResult = {
        valid: false,
        actualCount: 12,
        expectedCount: 10,
        phaseBreakdown: {
          [GamePhase.OPENING]: { actual: 6, expected: 5 },
          [GamePhase.EARLY]: { actual: 0, expected: 0 },
          [GamePhase.MIDDLE]: { actual: 6, expected: 5 },
          [GamePhase.BEAROFF]: { actual: 0, expected: 0 },
        },
        issues: ['count mismatch'],
      };

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const feedback = buildRetryFeedback(validation, config);

      expect(feedback).toContain('12 drills');
      expect(feedback).toContain('EXACTLY 10 drills');
    });

    test('lists each phase with needed count', () => {
      const validation: ValidationResult = {
        valid: false,
        actualCount: 10,
        expectedCount: 10,
        phaseBreakdown: {
          [GamePhase.OPENING]: { actual: 7, expected: 5 },
          [GamePhase.EARLY]: { actual: 0, expected: 0 },
          [GamePhase.MIDDLE]: { actual: 3, expected: 5 },
          [GamePhase.BEAROFF]: { actual: 0, expected: 0 },
        },
        issues: ['MIDDLE: expected 5, got 3'],
      };

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const feedback = buildRetryFeedback(validation, config);

      expect(feedback).toContain('OPENING');
      expect(feedback).toContain('Need 5 drills');
      expect(feedback).toContain('you provided 7');
      expect(feedback).toContain('MIDDLE');
      expect(feedback).toContain('you provided 3');
    });

    test('includes all four phases when configured', () => {
      const validation: ValidationResult = {
        valid: false,
        actualCount: 20,
        expectedCount: 20,
        phaseBreakdown: {
          [GamePhase.OPENING]: { actual: 5, expected: 5 },
          [GamePhase.EARLY]: { actual: 5, expected: 5 },
          [GamePhase.MIDDLE]: { actual: 5, expected: 5 },
          [GamePhase.BEAROFF]: { actual: 5, expected: 5 },
        },
        issues: [],
      };

      const config: DrillGenerationConfig = {
        targetDrillCount: 20,
        gamePhases: [GamePhase.OPENING, GamePhase.EARLY, GamePhase.MIDDLE, GamePhase.BEAROFF],
      };

      const feedback = buildRetryFeedback(validation, config);

      expect(feedback).toContain('OPENING');
      expect(feedback).toContain('EARLY');
      expect(feedback).toContain('MIDDLE');
      expect(feedback).toContain('BEAROFF');
    });

    test('includes warning about not skipping phases', () => {
      const validation: ValidationResult = {
        valid: false,
        actualCount: 8,
        expectedCount: 10,
        phaseBreakdown: {
          [GamePhase.OPENING]: { actual: 5, expected: 5 },
          [GamePhase.EARLY]: { actual: 0, expected: 0 },
          [GamePhase.MIDDLE]: { actual: 3, expected: 5 },
          [GamePhase.BEAROFF]: { actual: 0, expected: 0 },
        },
        issues: ['MIDDLE: expected 5, got 3'],
      };

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const feedback = buildRetryFeedback(validation, config);

      expect(feedback).toContain('Do not skip any phases');
    });

    test('emphasizes exact count requirement', () => {
      const validation: ValidationResult = {
        valid: false,
        actualCount: 11,
        expectedCount: 10,
        phaseBreakdown: {
          [GamePhase.OPENING]: { actual: 6, expected: 5 },
          [GamePhase.EARLY]: { actual: 0, expected: 0 },
          [GamePhase.MIDDLE]: { actual: 5, expected: 5 },
          [GamePhase.BEAROFF]: { actual: 0, expected: 0 },
        },
        issues: [],
      };

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const feedback = buildRetryFeedback(validation, config);

      expect(feedback).toContain('EXACT counts');
      expect(feedback).toContain('IMPORTANT CORRECTION REQUIRED');
    });
  });

  // ==========================================================================
  // validateLegacyDrillOutput Tests
  // ==========================================================================

  describe('validateLegacyDrillOutput', () => {
    test('returns valid=true for exact count match with phase assignments', () => {
      const openingDrills = Array.from({ length: 5 }, (_, i) =>
        createMockLegacyDrill(GamePhase.OPENING, `drill-opening-${i}`)
      );
      const middleDrills = Array.from({ length: 5 }, (_, i) =>
        createMockLegacyDrill(GamePhase.MIDDLE, `drill-middle-${i}`)
      );

      const series: PrincipleSeries[] = [
        {
          seriesId: 'series-1',
          principleId: 'principle-1',
          principleName: 'Test Principle',
          seriesDescription: 'Test description',
          drills: [...openingDrills, ...middleDrills],
        },
      ];

      const output = createMockLegacyDrillSeriesOutput(series);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const result = validateLegacyDrillOutput(output, config);

      expect(result.valid).toBe(true);
      expect(result.actualCount).toBe(10);
      expect(result.expectedCount).toBe(10);
      expect(result.issues).toHaveLength(0);
      expect(result.phaseBreakdown[GamePhase.OPENING]).toEqual({ actual: 5, expected: 5 });
      expect(result.phaseBreakdown[GamePhase.MIDDLE]).toEqual({ actual: 5, expected: 5 });
    });

    test('returns valid=true for drills without phase assignments (total count only)', () => {
      // Legacy drills without gamePhase assigned
      const drills = Array.from({ length: 10 }, (_, i) =>
        createMockLegacyDrill(null, `drill-${i}`)
      );

      const series: PrincipleSeries[] = [
        {
          seriesId: 'series-1',
          principleId: 'principle-1',
          principleName: 'Test Principle',
          seriesDescription: 'Test description',
          drills,
        },
      ];

      const output = createMockLegacyDrillSeriesOutput(series);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING],
      };

      const result = validateLegacyDrillOutput(output, config);

      // Should pass because total count matches, even without phase assignments
      expect(result.valid).toBe(true);
      expect(result.actualCount).toBe(10);
      expect(result.expectedCount).toBe(10);
    });

    test('returns valid=false for count mismatch', () => {
      const drills = Array.from({ length: 12 }, (_, i) =>
        createMockLegacyDrill(GamePhase.OPENING, `drill-${i}`)
      );

      const series: PrincipleSeries[] = [
        {
          seriesId: 'series-1',
          principleId: 'principle-1',
          principleName: 'Test Principle',
          seriesDescription: 'Test description',
          drills,
        },
      ];

      const output = createMockLegacyDrillSeriesOutput(series);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING],
      };

      const result = validateLegacyDrillOutput(output, config);

      expect(result.valid).toBe(false);
      expect(result.actualCount).toBe(12);
      expect(result.expectedCount).toBe(10);
    });

    test('counts drills across multiple series correctly', () => {
      const series1Drills = Array.from({ length: 5 }, (_, i) =>
        createMockLegacyDrill(GamePhase.OPENING, `drill-series1-${i}`)
      );
      const series2Drills = Array.from({ length: 5 }, (_, i) =>
        createMockLegacyDrill(GamePhase.MIDDLE, `drill-series2-${i}`)
      );

      const series: PrincipleSeries[] = [
        {
          seriesId: 'series-1',
          principleId: 'principle-1',
          principleName: 'Principle 1',
          seriesDescription: 'First principle',
          drills: series1Drills,
        },
        {
          seriesId: 'series-2',
          principleId: 'principle-2',
          principleName: 'Principle 2',
          seriesDescription: 'Second principle',
          drills: series2Drills,
        },
      ];

      const output = createMockLegacyDrillSeriesOutput(series);

      const config: DrillGenerationConfig = {
        targetDrillCount: 10,
        gamePhases: [GamePhase.OPENING, GamePhase.MIDDLE],
      };

      const result = validateLegacyDrillOutput(output, config);

      expect(result.valid).toBe(true);
      expect(result.actualCount).toBe(10);
      expect(result.phaseBreakdown[GamePhase.OPENING]).toEqual({ actual: 5, expected: 5 });
      expect(result.phaseBreakdown[GamePhase.MIDDLE]).toEqual({ actual: 5, expected: 5 });
    });
  });
});
