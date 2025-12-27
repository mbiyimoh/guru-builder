/**
 * Shared Section Configuration for Guru Profile Display
 *
 * Used by ProfileScorecard, ProfilePreview, and other profile display components.
 * Centralizes the mapping of profile fields to sections to avoid duplication.
 */

import type { GuruProfileData } from './types';

export const SECTION_CONFIG = {
  'Domain & Expertise': {
    fields: ['domainExpertise', 'specificTopics', 'yearsOfExperience'] as const,
    labels: {
      domainExpertise: 'Domain Expertise',
      specificTopics: 'Specific Topics',
      yearsOfExperience: 'Years of Experience',
    },
  },
  'Target Audience': {
    fields: ['audienceLevel', 'audienceDescription'] as const,
    labels: {
      audienceLevel: 'Audience Level',
      audienceDescription: 'Audience Description',
    },
  },
  'Teaching Style': {
    fields: ['pedagogicalApproach', 'tone', 'communicationStyle'] as const,
    labels: {
      pedagogicalApproach: 'Pedagogical Approach',
      tone: 'Tone',
      communicationStyle: 'Communication Style',
    },
  },
  'Content Preferences': {
    fields: ['emphasizedConcepts', 'avoidedTopics', 'examplePreferences'] as const,
    labels: {
      emphasizedConcepts: 'Emphasized Concepts',
      avoidedTopics: 'Avoided Topics',
      examplePreferences: 'Example Preferences',
    },
  },
  'Unique Characteristics': {
    fields: ['uniquePerspective', 'commonMisconceptions', 'successMetrics'] as const,
    labels: {
      uniquePerspective: 'Unique Perspective',
      commonMisconceptions: 'Common Misconceptions',
      successMetrics: 'Success Metrics',
    },
  },
} as const;

export type SectionName = keyof typeof SECTION_CONFIG;

/**
 * Build sections array from profile data for display components
 */
export function buildProfileSections(
  profile: GuruProfileData,
  lightAreas: string[]
): Array<{
  title: SectionName;
  fields: Array<{
    label: string;
    value: string | string[] | number | null;
    fieldKey: keyof GuruProfileData;
    isLight: boolean;
  }>;
}> {
  return Object.entries(SECTION_CONFIG).map(([sectionName, config]) => {
    const fields = config.fields.map((fieldKey) => {
      const key = fieldKey as keyof GuruProfileData;
      return {
        label: config.labels[key as keyof typeof config.labels],
        value: profile[key] as string | string[] | number | null,
        fieldKey: key,
        isLight: lightAreas.includes(key),
      };
    });

    return {
      title: sectionName as SectionName,
      fields,
    };
  });
}
