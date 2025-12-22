import { test, expect } from '@playwright/test';
import {
  guruProfileDataSchema,
  type GuruProfileData,
} from '@/lib/guruProfile/types';

/**
 * GuruProfile Schema Validation Tests
 *
 * Tests the Zod schema validation for guru profile data.
 * Ensures profile data is properly validated before synthesis.
 */

test.describe('GuruProfile Schema Validation', () => {
  test('should validate complete valid profile data', () => {
    const validProfile: GuruProfileData = {
      domainExpertise: 'Backgammon Strategy',
      specificTopics: ['Opening Theory', 'Cube Decisions', 'Endgame Technique'],
      yearsOfExperience: 15,
      audienceLevel: 'intermediate',
      audienceDescription: 'Club players looking to improve their tournament performance',
      pedagogicalApproach: 'Progressive disclosure with practical examples',
      tone: 'conversational',
      communicationStyle: 'Clear explanations with occasional humor',
      emphasizedConcepts: ['Position evaluation', 'Match equity tables'],
      avoidedTopics: ['Complex match equity calculations'],
      examplePreferences: 'Real game positions from major tournaments',
      uniquePerspective: 'Focus on practical decision-making over pure theory',
      commonMisconceptions: ['Doubling too late is worse than too early'],
      successMetrics: 'Improved cube decisions and timing',
      additionalContext: 'Students should have basic checker play knowledge',
    };

    const result = guruProfileDataSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domainExpertise).toBe('Backgammon Strategy');
      expect(result.data.specificTopics).toHaveLength(3);
      expect(result.data.yearsOfExperience).toBe(15);
    }
  });

  test('should validate profile with null yearsOfExperience', () => {
    const profileWithNullYears: GuruProfileData = {
      domainExpertise: 'Chess',
      specificTopics: ['Openings'],
      yearsOfExperience: null,
      audienceLevel: 'beginner',
      audienceDescription: 'New players',
      pedagogicalApproach: 'Step-by-step',
      tone: 'encouraging',
      communicationStyle: 'Patient',
      emphasizedConcepts: ['Basic moves'],
      avoidedTopics: [],
      examplePreferences: 'Simple positions',
      uniquePerspective: 'Focus on fun',
      commonMisconceptions: [],
      successMetrics: 'Completing first games',
      additionalContext: null,
    };

    const result = guruProfileDataSchema.safeParse(profileWithNullYears);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.yearsOfExperience).toBeNull();
      expect(result.data.additionalContext).toBeNull();
    }
  });

  test('should validate all audience levels', () => {
    const validLevels = ['beginner', 'intermediate', 'advanced', 'mixed'] as const;

    for (const level of validLevels) {
      const profile: GuruProfileData = {
        domainExpertise: 'Test',
        specificTopics: ['Topic'],
        yearsOfExperience: 5,
        audienceLevel: level,
        audienceDescription: 'Test audience',
        pedagogicalApproach: 'Test',
        tone: 'formal',
        communicationStyle: 'Test',
        emphasizedConcepts: [],
        avoidedTopics: [],
        examplePreferences: 'Test',
        uniquePerspective: 'Test',
        commonMisconceptions: [],
        successMetrics: 'Test',
        additionalContext: null,
      };

      const result = guruProfileDataSchema.safeParse(profile);
      expect(result.success).toBe(true);
    }
  });

  test('should validate all tone values', () => {
    const validTones = ['formal', 'conversational', 'encouraging', 'direct', 'socratic'] as const;

    for (const tone of validTones) {
      const profile: GuruProfileData = {
        domainExpertise: 'Test',
        specificTopics: ['Topic'], // Must have at least one topic
        yearsOfExperience: null,
        audienceLevel: 'beginner',
        audienceDescription: 'Test',
        pedagogicalApproach: 'Test',
        tone: tone,
        communicationStyle: 'Test',
        emphasizedConcepts: [],
        avoidedTopics: [],
        examplePreferences: 'Test',
        uniquePerspective: 'Test',
        commonMisconceptions: [],
        successMetrics: 'Test',
        additionalContext: null,
      };

      const result = guruProfileDataSchema.safeParse(profile);
      expect(result.success).toBe(true);
    }
  });

  test('should reject invalid audience level', () => {
    const invalidProfile = {
      domainExpertise: 'Test',
      specificTopics: [],
      yearsOfExperience: null,
      audienceLevel: 'expert', // Invalid
      audienceDescription: 'Test',
      pedagogicalApproach: 'Test',
      tone: 'formal',
      communicationStyle: 'Test',
      emphasizedConcepts: [],
      avoidedTopics: [],
      examplePreferences: 'Test',
      uniquePerspective: 'Test',
      commonMisconceptions: [],
      successMetrics: 'Test',
      additionalContext: null,
    };

    const result = guruProfileDataSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  test('should reject invalid tone', () => {
    const invalidProfile = {
      domainExpertise: 'Test',
      specificTopics: [],
      yearsOfExperience: null,
      audienceLevel: 'beginner',
      audienceDescription: 'Test',
      pedagogicalApproach: 'Test',
      tone: 'aggressive', // Invalid
      communicationStyle: 'Test',
      emphasizedConcepts: [],
      avoidedTopics: [],
      examplePreferences: 'Test',
      uniquePerspective: 'Test',
      commonMisconceptions: [],
      successMetrics: 'Test',
      additionalContext: null,
    };

    const result = guruProfileDataSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  test('should reject missing required fields', () => {
    const incompleteProfile = {
      domainExpertise: 'Test',
      // Missing most fields
    };

    const result = guruProfileDataSchema.safeParse(incompleteProfile);
    expect(result.success).toBe(false);
  });

  test('should handle empty arrays for optional list fields', () => {
    // Note: specificTopics requires min(1), but other arrays can be empty
    const profileWithEmptyArrays: GuruProfileData = {
      domainExpertise: 'Test Domain',
      specificTopics: ['Required Topic'], // min(1) required
      yearsOfExperience: null,
      audienceLevel: 'beginner',
      audienceDescription: 'Test',
      pedagogicalApproach: 'Test',
      tone: 'formal',
      communicationStyle: 'Test',
      emphasizedConcepts: [],
      avoidedTopics: [],
      examplePreferences: 'Test',
      uniquePerspective: 'Test',
      commonMisconceptions: [],
      successMetrics: 'Test',
      additionalContext: null,
    };

    const result = guruProfileDataSchema.safeParse(profileWithEmptyArrays);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.specificTopics).toHaveLength(1); // Required field
      expect(result.data.emphasizedConcepts).toEqual([]);
      expect(result.data.avoidedTopics).toEqual([]);
      expect(result.data.commonMisconceptions).toEqual([]);
    }
  });

  test('should reject wrong type for arrays', () => {
    const invalidProfile = {
      domainExpertise: 'Test',
      specificTopics: 'not an array', // Should be array
      yearsOfExperience: null,
      audienceLevel: 'beginner',
      audienceDescription: 'Test',
      pedagogicalApproach: 'Test',
      tone: 'formal',
      communicationStyle: 'Test',
      emphasizedConcepts: [],
      avoidedTopics: [],
      examplePreferences: 'Test',
      uniquePerspective: 'Test',
      commonMisconceptions: [],
      successMetrics: 'Test',
      additionalContext: null,
    };

    const result = guruProfileDataSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  test('should reject wrong type for yearsOfExperience', () => {
    const invalidProfile = {
      domainExpertise: 'Test',
      specificTopics: [],
      yearsOfExperience: 'fifteen', // Should be number or null
      audienceLevel: 'beginner',
      audienceDescription: 'Test',
      pedagogicalApproach: 'Test',
      tone: 'formal',
      communicationStyle: 'Test',
      emphasizedConcepts: [],
      avoidedTopics: [],
      examplePreferences: 'Test',
      uniquePerspective: 'Test',
      commonMisconceptions: [],
      successMetrics: 'Test',
      additionalContext: null,
    };

    const result = guruProfileDataSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });
});
