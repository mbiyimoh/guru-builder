import { describe, it, expect } from 'vitest';
import type { GamePhase } from '@prisma/client';
import {
  UNIVERSAL_PRINCIPLES,
  PHASE_PRINCIPLES,
  getPrinciplesForPhase,
  getAllPrincipleIds,
  getPrincipleById,
} from '../principles';

describe('Backgammon Principles', () => {
  describe('UNIVERSAL_PRINCIPLES', () => {
    it('should have exactly 3 universal principles', () => {
      expect(UNIVERSAL_PRINCIPLES).toHaveLength(3);
    });

    it('should have all required fields for each principle', () => {
      UNIVERSAL_PRINCIPLES.forEach((principle) => {
        expect(principle).toHaveProperty('id');
        expect(principle).toHaveProperty('name');
        expect(principle).toHaveProperty('description');
        expect(principle).toHaveProperty('promptGuidance');

        expect(typeof principle.id).toBe('string');
        expect(typeof principle.name).toBe('string');
        expect(typeof principle.description).toBe('string');
        expect(typeof principle.promptGuidance).toBe('string');

        expect(principle.id.length).toBeGreaterThan(0);
        expect(principle.name.length).toBeGreaterThan(0);
        expect(principle.description.length).toBeGreaterThan(0);
        expect(principle.promptGuidance.length).toBeGreaterThan(0);
      });
    });

    it('should have unique IDs', () => {
      const ids = UNIVERSAL_PRINCIPLES.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('PHASE_PRINCIPLES', () => {
    const phases: GamePhase[] = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'];

    it('should have entries for all game phases', () => {
      phases.forEach((phase) => {
        expect(PHASE_PRINCIPLES).toHaveProperty(phase);
      });
    });

    it('should have exactly 2 principles per phase', () => {
      phases.forEach((phase) => {
        expect(PHASE_PRINCIPLES[phase]).toHaveLength(2);
      });
    });

    it('should have all required fields for each phase-specific principle', () => {
      phases.forEach((phase) => {
        PHASE_PRINCIPLES[phase].forEach((principle) => {
          expect(principle).toHaveProperty('id');
          expect(principle).toHaveProperty('name');
          expect(principle).toHaveProperty('description');
          expect(principle).toHaveProperty('promptGuidance');

          expect(typeof principle.id).toBe('string');
          expect(typeof principle.name).toBe('string');
          expect(typeof principle.description).toBe('string');
          expect(typeof principle.promptGuidance).toBe('string');

          expect(principle.id.length).toBeGreaterThan(0);
          expect(principle.name.length).toBeGreaterThan(0);
          expect(principle.description.length).toBeGreaterThan(0);
          expect(principle.promptGuidance.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have unique IDs across all phase-specific principles', () => {
      const allPhaseIds = phases.flatMap(phase =>
        PHASE_PRINCIPLES[phase].map(p => p.id)
      );
      const uniqueIds = new Set(allPhaseIds);
      expect(uniqueIds.size).toBe(allPhaseIds.length);
    });
  });

  describe('getAllPrincipleIds', () => {
    it('should return exactly 11 unique IDs', () => {
      const ids = getAllPrincipleIds();
      expect(ids).toHaveLength(11); // 3 universal + 8 phase-specific (2 per phase * 4 phases)
    });

    it('should return all unique IDs', () => {
      const ids = getAllPrincipleIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include all universal principle IDs', () => {
      const ids = getAllPrincipleIds();
      UNIVERSAL_PRINCIPLES.forEach((principle) => {
        expect(ids).toContain(principle.id);
      });
    });

    it('should include all phase-specific principle IDs', () => {
      const ids = getAllPrincipleIds();
      const phases: GamePhase[] = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'];

      phases.forEach((phase) => {
        PHASE_PRINCIPLES[phase].forEach((principle) => {
          expect(ids).toContain(principle.id);
        });
      });
    });
  });

  describe('getPrinciplesForPhase', () => {
    it('should return correct structure for OPENING phase', () => {
      const result = getPrinciplesForPhase('OPENING');

      expect(result).toHaveProperty('universal');
      expect(result).toHaveProperty('phaseSpecific');
      expect(result.universal).toEqual(UNIVERSAL_PRINCIPLES);
      expect(result.phaseSpecific).toEqual(PHASE_PRINCIPLES.OPENING);
    });

    it('should return correct structure for EARLY phase', () => {
      const result = getPrinciplesForPhase('EARLY');

      expect(result).toHaveProperty('universal');
      expect(result).toHaveProperty('phaseSpecific');
      expect(result.universal).toEqual(UNIVERSAL_PRINCIPLES);
      expect(result.phaseSpecific).toEqual(PHASE_PRINCIPLES.EARLY);
    });

    it('should return correct structure for MIDDLE phase', () => {
      const result = getPrinciplesForPhase('MIDDLE');

      expect(result).toHaveProperty('universal');
      expect(result).toHaveProperty('phaseSpecific');
      expect(result.universal).toEqual(UNIVERSAL_PRINCIPLES);
      expect(result.phaseSpecific).toEqual(PHASE_PRINCIPLES.MIDDLE);
    });

    it('should return correct structure for BEAROFF phase', () => {
      const result = getPrinciplesForPhase('BEAROFF');

      expect(result).toHaveProperty('universal');
      expect(result).toHaveProperty('phaseSpecific');
      expect(result.universal).toEqual(UNIVERSAL_PRINCIPLES);
      expect(result.phaseSpecific).toEqual(PHASE_PRINCIPLES.BEAROFF);
    });

    it('should always return the same universal principles', () => {
      const phases: GamePhase[] = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'];
      const results = phases.map(phase => getPrinciplesForPhase(phase));

      results.forEach((result) => {
        expect(result.universal).toEqual(UNIVERSAL_PRINCIPLES);
      });
    });
  });

  describe('getPrincipleById', () => {
    it('should find universal principles by ID', () => {
      const principle = getPrincipleById('pip-count');

      expect(principle).toBeDefined();
      expect(principle?.id).toBe('pip-count');
      expect(principle?.name).toBe('Pip Count Awareness');
    });

    it('should find phase-specific principles by ID', () => {
      const principle = getPrincipleById('point-making');

      expect(principle).toBeDefined();
      expect(principle?.id).toBe('point-making');
      expect(principle?.name).toBe('Point-Making Priority');
    });

    it('should find principles from different phases', () => {
      const openingPrinciple = getPrincipleById('point-making');
      const earlyPrinciple = getPrincipleById('priming');
      const middlePrinciple = getPrincipleById('attack-timing');
      const bearoffPrinciple = getPrincipleById('race-efficiency');

      expect(openingPrinciple).toBeDefined();
      expect(earlyPrinciple).toBeDefined();
      expect(middlePrinciple).toBeDefined();
      expect(bearoffPrinciple).toBeDefined();
    });

    it('should return undefined for unknown ID', () => {
      const principle = getPrincipleById('nonexistent-principle');

      expect(principle).toBeUndefined();
    });

    it('should return undefined for empty string ID', () => {
      const principle = getPrincipleById('');

      expect(principle).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const principle = getPrincipleById('PIP-COUNT');

      expect(principle).toBeUndefined();
    });

    it('should find all 11 principles by their IDs', () => {
      const allIds = getAllPrincipleIds();

      allIds.forEach((id) => {
        const principle = getPrincipleById(id);
        expect(principle).toBeDefined();
        expect(principle?.id).toBe(id);
      });
    });
  });

  describe('Data Integrity', () => {
    it('should have no ID collisions between universal and phase-specific principles', () => {
      const universalIds = new Set(UNIVERSAL_PRINCIPLES.map(p => p.id));
      const phases: GamePhase[] = ['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'];

      phases.forEach((phase) => {
        PHASE_PRINCIPLES[phase].forEach((principle) => {
          expect(universalIds.has(principle.id)).toBe(false);
        });
      });
    });

    it('should have descriptive principle names', () => {
      const allPrinciples = [
        ...UNIVERSAL_PRINCIPLES,
        ...Object.values(PHASE_PRINCIPLES).flat(),
      ];

      allPrinciples.forEach((principle) => {
        // Names should be at least 10 characters to be descriptive
        expect(principle.name.length).toBeGreaterThanOrEqual(10);
      });
    });

    it('should have descriptive principle descriptions', () => {
      const allPrinciples = [
        ...UNIVERSAL_PRINCIPLES,
        ...Object.values(PHASE_PRINCIPLES).flat(),
      ];

      allPrinciples.forEach((principle) => {
        // Descriptions should be at least 30 characters to be descriptive
        expect(principle.description.length).toBeGreaterThanOrEqual(30);
      });
    });

    it('should have actionable prompt guidance', () => {
      const allPrinciples = [
        ...UNIVERSAL_PRINCIPLES,
        ...Object.values(PHASE_PRINCIPLES).flat(),
      ];

      allPrinciples.forEach((principle) => {
        // Prompt guidance should be at least 20 characters to be actionable
        expect(principle.promptGuidance.length).toBeGreaterThanOrEqual(20);
      });
    });
  });
});
