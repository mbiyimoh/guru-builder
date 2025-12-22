import type { GuruProfileData } from './types';

/**
 * Format guru profile data for injection into LLM prompts
 * Creates a comprehensive, structured description of the guru's identity
 */
export function formatGuruProfileForPrompt(profile: GuruProfileData): string {
  const sections: string[] = [];

  // Header
  sections.push(`## Guru Profile: ${profile.domainExpertise}`);
  sections.push('');

  // Domain & Expertise
  sections.push('### Domain & Expertise');
  sections.push(`- **Primary Domain:** ${profile.domainExpertise}`);
  if (profile.specificTopics.length > 0) {
    sections.push(`- **Key Topics:** ${profile.specificTopics.join(', ')}`);
  }
  if (profile.yearsOfExperience) {
    sections.push(`- **Experience:** ${profile.yearsOfExperience} years`);
  }
  sections.push('');

  // Target Audience
  sections.push('### Target Audience');
  sections.push(`- **Level:** ${formatAudienceLevel(profile.audienceLevel)}`);
  sections.push(`- **Description:** ${profile.audienceDescription}`);
  sections.push('');

  // Teaching Style
  sections.push('### Teaching Style');
  sections.push(`- **Approach:** ${profile.pedagogicalApproach}`);
  sections.push(`- **Tone:** ${formatTone(profile.tone)}`);
  sections.push(`- **Communication:** ${profile.communicationStyle}`);
  sections.push('');

  // Content Preferences
  sections.push('### Content Preferences');
  if (profile.emphasizedConcepts.length > 0) {
    sections.push(`- **Emphasize:** ${profile.emphasizedConcepts.join(', ')}`);
  }
  if (profile.avoidedTopics.length > 0) {
    sections.push(`- **Avoid:** ${profile.avoidedTopics.join(', ')}`);
  }
  sections.push(`- **Examples:** ${profile.examplePreferences}`);
  sections.push('');

  // Unique Perspective
  sections.push('### Unique Characteristics');
  sections.push(`- **Perspective:** ${profile.uniquePerspective}`);
  if (profile.commonMisconceptions.length > 0) {
    sections.push(`- **Misconceptions to Address:** ${profile.commonMisconceptions.join('; ')}`);
  }
  sections.push(`- **Success Metrics:** ${profile.successMetrics}`);
  sections.push('');

  // Additional Context
  if (profile.additionalContext) {
    sections.push('### Additional Context');
    sections.push(profile.additionalContext);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Format audience level for display
 */
function formatAudienceLevel(level: string): string {
  const levels: Record<string, string> = {
    beginner: 'Beginner (new to the subject)',
    intermediate: 'Intermediate (some foundation)',
    advanced: 'Advanced (seeking mastery)',
    mixed: 'Mixed (various skill levels)',
  };
  return levels[level] || level;
}

/**
 * Format tone for display
 */
function formatTone(tone: string): string {
  const tones: Record<string, string> = {
    formal: 'Formal and professional',
    conversational: 'Conversational and approachable',
    encouraging: 'Encouraging and supportive',
    direct: 'Direct and to-the-point',
    socratic: 'Socratic (question-based learning)',
  };
  return tones[tone] || tone;
}

/**
 * Create a short summary of the profile for context
 */
export function createProfileSummary(profile: GuruProfileData): string {
  return `A ${profile.tone} ${profile.domainExpertise} guru teaching ${profile.audienceLevel} students, emphasizing ${profile.emphasizedConcepts.slice(0, 3).join(', ')}. ${profile.uniquePerspective}`;
}

/**
 * Build the profile injection block for prompts
 */
export function buildProfilePromptBlock(profile: GuruProfileData): string {
  return `
<guru-profile>
${formatGuruProfileForPrompt(profile)}
</guru-profile>

IMPORTANT: You are this guru. Your responses should reflect:
- Tone: ${profile.tone}
- Approach: ${profile.pedagogicalApproach}
- Audience: ${profile.audienceLevel} level ${profile.audienceDescription}
- Perspective: ${profile.uniquePerspective}
`;
}
