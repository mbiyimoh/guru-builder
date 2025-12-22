import { test, expect } from '@playwright/test';
import { renderOpeningBoard, renderAsciiBoard, OPENING_ROLLS, OPENING_POSITION_ID } from '@/lib/positionLibrary';

/**
 * Position Library Unit Tests
 *
 * Tests the ASCII rendering and opening rolls constants
 * for the scenario-based drill position seeding feature.
 */

test.describe('ASCII Board Renderer', () => {
  test.describe('renderOpeningBoard', () => {
    test('should render ASCII board with dice roll', () => {
      const result = renderOpeningBoard('3-1');
      expect(result).toContain('Dice: 3-1');
      expect(result).toContain('White (X) to move');
    });

    test('should show correct starting position', () => {
      const result = renderOpeningBoard('6-5');
      // Check for X on the board (white checkers)
      expect(result).toContain('X');
      // Check for O on the board (black checkers)
      expect(result).toContain('O');
    });

    test('should include board grid with point numbers', () => {
      const result = renderOpeningBoard('4-2');
      // Check for point labels
      expect(result).toContain('13');
      expect(result).toContain('24');
      expect(result).toContain('12');
      expect(result).toContain('1');
    });

    test('should include BAR in the center', () => {
      const result = renderOpeningBoard('6-6');
      expect(result).toContain('BAR');
    });
  });

  test.describe('renderAsciiBoard', () => {
    test('should handle opening positions with "opening-" prefix', () => {
      expect(() => renderAsciiBoard('opening-3-1', '3-1')).not.toThrow();
      const result = renderAsciiBoard('opening-3-1', '3-1');
      expect(result).toContain('Dice: 3-1');
    });

    test('should handle "opening" position ID', () => {
      expect(() => renderAsciiBoard('opening', '4-2')).not.toThrow();
      const result = renderAsciiBoard('opening', '4-2');
      expect(result).toContain('Dice: 4-2');
    });

    test('should return generic template for non-opening positions', () => {
      // Phase 2 now supports non-opening positions with a generic template
      const result = renderAsciiBoard('4HPwATDgc/ABMA', '3-1');
      expect(result).toContain('Dice: 3-1');
      expect(result).toContain('see board');
    });

    test('should return generic template for arbitrary position IDs', () => {
      const result = renderAsciiBoard('some-random-id', '5-4');
      expect(result).toContain('Dice: 5-4');
    });
  });
});

test.describe('Opening Rolls Constants', () => {
  test('should have exactly 21 rolls', () => {
    expect(OPENING_ROLLS).toHaveLength(21);
  });

  test('should have 15 non-doubles', () => {
    const nonDoubles = OPENING_ROLLS.filter(r => r[0] !== r[2]);
    expect(nonDoubles).toHaveLength(15);
  });

  test('should have 6 doubles', () => {
    const doubles = OPENING_ROLLS.filter(r => r[0] === r[2]);
    expect(doubles).toHaveLength(6);
  });

  test('should contain all expected non-double rolls', () => {
    const expectedNonDoubles = [
      '6-5', '6-4', '6-3', '6-2', '6-1',
      '5-4', '5-3', '5-2', '5-1',
      '4-3', '4-2', '4-1',
      '3-2', '3-1',
      '2-1'
    ];
    expectedNonDoubles.forEach(roll => {
      expect(OPENING_ROLLS).toContain(roll);
    });
  });

  test('should contain all expected doubles', () => {
    const expectedDoubles = ['6-6', '5-5', '4-4', '3-3', '2-2', '1-1'];
    expectedDoubles.forEach(roll => {
      expect(OPENING_ROLLS).toContain(roll);
    });
  });

  test('should have unique rolls', () => {
    const uniqueRolls = new Set(OPENING_ROLLS);
    expect(uniqueRolls.size).toBe(21);
  });

  test('should have all rolls in valid format (X-Y)', () => {
    const rollPattern = /^[1-6]-[1-6]$/;
    OPENING_ROLLS.forEach(roll => {
      expect(roll).toMatch(rollPattern);
    });
  });
});

test.describe('Opening Position ID', () => {
  test('should be "opening"', () => {
    expect(OPENING_POSITION_ID).toBe('opening');
  });
});
