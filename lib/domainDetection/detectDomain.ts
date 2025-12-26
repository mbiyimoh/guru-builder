/**
 * Domain Detection Utility
 *
 * Detects specialized domains in guru profiles and suggests
 * appropriate ground truth engines for verification.
 */

import { prisma } from '@/lib/db';
import { matchDomainKeywords, DOMAIN_KEYWORDS } from './keywords';

export interface DomainDetectionResult {
  detected: boolean;
  domain: string | null;
  matchedKeywords: string[];
  suggestedEngine: {
    id: string;
    name: string;
    description: string;
  } | null;
}

/**
 * Detect domain from raw profile content string.
 * Scans for keywords and queries for matching GT engine.
 */
export async function detectDomainFromProfile(
  profileContent: string
): Promise<DomainDetectionResult> {
  // Check each known domain for keyword matches
  for (const domain of Object.keys(DOMAIN_KEYWORDS)) {
    const matchedKeywords = matchDomainKeywords(profileContent, domain);

    if (matchedKeywords.length > 0) {
      // Found a match - look for GT engine
      const engine = await prisma.groundTruthEngine.findFirst({
        where: {
          domain: domain,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      return {
        detected: true,
        domain,
        matchedKeywords,
        suggestedEngine: engine ? {
          id: engine.id,
          name: engine.name,
          description: engine.description ?? '',
        } : null,
      };
    }
  }

  // No domain detected
  return {
    detected: false,
    domain: null,
    matchedKeywords: [],
    suggestedEngine: null,
  };
}

/**
 * Detect domain from a project's profile data.
 * Extracts relevant text fields from GuruProfile and combines for analysis.
 */
export async function detectDomainFromProject(
  projectId: string
): Promise<DomainDetectionResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      currentProfile: {
        select: {
          rawBrainDump: true,
          profileData: true,
        },
      },
    },
  });

  if (!project) {
    return {
      detected: false,
      domain: null,
      matchedKeywords: [],
      suggestedEngine: null,
    };
  }

  // Combine all available text for domain detection
  const textParts: string[] = [];

  // Add project name and description
  if (project.name) textParts.push(project.name);
  if (project.description) textParts.push(project.description);

  // Add profile data if available
  if (project.currentProfile) {
    // Add raw brain dump
    if (project.currentProfile.rawBrainDump) {
      textParts.push(project.currentProfile.rawBrainDump);
    }

    // Add structured profile data fields
    const profileData = project.currentProfile.profileData as Record<string, unknown> | null;
    if (profileData) {
      // Extract text fields from structured profile
      const textFields = [
        'domainExpertise',
        'audienceDescription',
        'pedagogicalApproach',
        'communicationStyle',
        'uniquePerspective',
        'examplePreferences',
        'additionalContext',
      ];

      for (const field of textFields) {
        const value = profileData[field];
        if (typeof value === 'string' && value) {
          textParts.push(value);
        }
      }

      // Add array fields
      const arrayFields = ['specificTopics', 'emphasizedConcepts', 'commonMisconceptions'];
      for (const field of arrayFields) {
        const value = profileData[field];
        if (Array.isArray(value)) {
          textParts.push(value.filter((v): v is string => typeof v === 'string').join(' '));
        }
      }
    }
  }

  const profileContent = textParts.join(' ');

  return detectDomainFromProfile(profileContent);
}
