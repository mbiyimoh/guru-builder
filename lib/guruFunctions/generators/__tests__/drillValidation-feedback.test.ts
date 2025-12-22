import { generateEnhancedFeedback, type ValidationResult } from '../drillValidation';
import type { GamePhase } from '@prisma/client';

/**
 * Test to demonstrate generateEnhancedFeedback output format
 */
describe('generateEnhancedFeedback', () => {
  it('should generate feedback with attempt tracking and phase shortages', () => {
    // Scenario: Generated 2 drills instead of 10 (1 OPENING, 1 EARLY)
    const validation: ValidationResult = {
      valid: false,
      actualCount: 2,
      expectedCount: 10,
      phaseBreakdown: {
        OPENING: { actual: 1, expected: 4 },
        EARLY: { actual: 1, expected: 3 },
        MIDDLE: { actual: 0, expected: 3 },
      } as Record<GamePhase, { actual: number; expected: number }>,
      issues: [
        'OPENING: expected 4, got 1',
        'EARLY: expected 3, got 1',
        'MIDDLE: expected 3, got 0',
      ],
    };

    const feedback = generateEnhancedFeedback(validation, 1);

    console.log('Example feedback output:');
    console.log('========================');
    console.log(feedback);
    console.log('========================');

    // Verify structure
    expect(feedback).toContain('VALIDATION FAILED (Attempt 1 of 3)');
    expect(feedback).toContain('Total drills: 2 (expected: 10)');
    expect(feedback).toContain('Phase shortages:');
    expect(feedback).toContain('OPENING: Generated 1, need 3 more');
    expect(feedback).toContain('EARLY: Generated 1, need 2 more');
    expect(feedback).toContain('MIDDLE: Generated 0, need 3 more');
    expect(feedback).toContain('Please regenerate with EXACTLY the required drill counts per phase.');
  });

  it('should handle custom max attempts', () => {
    const validation: ValidationResult = {
      valid: false,
      actualCount: 5,
      expectedCount: 10,
      phaseBreakdown: {
        OPENING: { actual: 5, expected: 10 },
      } as Record<GamePhase, { actual: number; expected: number }>,
      issues: ['OPENING: expected 10, got 5'],
    };

    const feedback = generateEnhancedFeedback(validation, 2, 5);

    expect(feedback).toContain('VALIDATION FAILED (Attempt 2 of 5)');
  });

  it('should only show phases with shortages', () => {
    const validation: ValidationResult = {
      valid: false,
      actualCount: 7,
      expectedCount: 10,
      phaseBreakdown: {
        OPENING: { actual: 4, expected: 4 }, // No shortage
        EARLY: { actual: 3, expected: 6 }, // Shortage
      } as Record<GamePhase, { actual: number; expected: number }>,
      issues: ['EARLY: expected 6, got 3'],
    };

    const feedback = generateEnhancedFeedback(validation, 1);

    expect(feedback).toContain('EARLY: Generated 3, need 3 more');
    expect(feedback).not.toContain('OPENING: Generated');
  });
});
