'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScorecardConfidenceRing } from './ScorecardConfidenceRing';
import { ScorecardSection } from './ScorecardSection';
import { ScorecardRefinementInput, type ScorecardRefinementInputRef } from './ScorecardRefinementInput';
import { User, Brain } from 'lucide-react';
import type { GuruProfileData, SynthesisResult } from '@/lib/guruProfile/types';

// Section field mappings for score calculation
const SECTION_CONFIG = {
  'Domain & Expertise': {
    fields: ['domainExpertise', 'specificTopics', 'yearsOfExperience'],
    labels: {
      domainExpertise: 'Domain Expertise',
      specificTopics: 'Specific Topics',
      yearsOfExperience: 'Years of Experience',
    },
  },
  'Target Audience': {
    fields: ['audienceLevel', 'audienceDescription'],
    labels: {
      audienceLevel: 'Audience Level',
      audienceDescription: 'Audience Description',
    },
  },
  'Teaching Style': {
    fields: ['pedagogicalApproach', 'tone', 'communicationStyle'],
    labels: {
      pedagogicalApproach: 'Pedagogical Approach',
      tone: 'Tone',
      communicationStyle: 'Communication Style',
    },
  },
  'Content Preferences': {
    fields: ['emphasizedConcepts', 'avoidedTopics', 'examplePreferences'],
    labels: {
      emphasizedConcepts: 'Emphasized Concepts',
      avoidedTopics: 'Avoided Topics',
      examplePreferences: 'Example Preferences',
    },
  },
  'Unique Characteristics': {
    fields: ['uniquePerspective', 'commonMisconceptions', 'successMetrics'],
    labels: {
      uniquePerspective: 'Unique Perspective',
      commonMisconceptions: 'Common Misconceptions',
      successMetrics: 'Success Metrics',
    },
  },
} as const;

interface ProfileScorecardProps {
  profile: GuruProfileData;
  lightAreas: string[];
  confidence: number;
  rawBrainDump?: string;
  projectId: string;
  onProfileUpdated?: (newResult: SynthesisResult) => void;
  showRefinementInput?: boolean;
  isWizardMode?: boolean;
}

export function ProfileScorecard({
  profile,
  lightAreas,
  confidence,
  rawBrainDump = '',
  projectId,
  onProfileUpdated,
  showRefinementInput = true,
  isWizardMode = false,
}: ProfileScorecardProps) {
  const refinementRef = useRef<ScorecardRefinementInputRef>(null);
  const [isRefining, setIsRefining] = useState(false);

  // Handle clicking a light area badge
  const handleLightAreaClick = (fieldKey: string, fieldLabel: string) => {
    if (refinementRef.current) {
      refinementRef.current.setPrompt(`I want to provide more details about ${fieldLabel.toLowerCase()}. `);
    }
  };

  // Handle refinement completion
  const handleRefinementComplete = async (result: SynthesisResult) => {
    setIsRefining(false);
    if (onProfileUpdated) {
      onProfileUpdated(result);
    }
  };

  // Build sections with their fields
  const sections = Object.entries(SECTION_CONFIG).map(([sectionName, config]) => {
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
      title: sectionName,
      fields,
    };
  });

  // Check if additional context exists
  const hasAdditionalContext = profile.additionalContext && profile.additionalContext.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Guru Profile</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {profile.domainExpertise}
                </p>
              </div>
            </div>
            <ScorecardConfidenceRing confidence={confidence} size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
              {profile.audienceLevel}
            </Badge>
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
              {profile.tone}
            </Badge>
            {lightAreas.length > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                {lightAreas.length} area{lightAreas.length > 1 ? 's' : ''} to improve
              </Badge>
            )}
          </div>

          {lightAreas.length > 0 && !isWizardMode && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Some fields were inferred with lower confidence. Click the highlighted badges below
                  to provide more details and improve your profile.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Sections */}
      <div className="space-y-3">
        {sections.map((section, index) => (
          <ScorecardSection
            key={section.title}
            title={section.title}
            fields={section.fields}
            onLightAreaClick={handleLightAreaClick}
            defaultExpanded={index === 0} // Expand first section by default
            disabled={isRefining}
          />
        ))}

        {/* Additional Context Section (if exists) */}
        {hasAdditionalContext && (
          <ScorecardSection
            title="Additional Context"
            fields={[
              {
                label: 'Additional Context',
                value: profile.additionalContext,
                fieldKey: 'additionalContext',
                isLight: lightAreas.includes('additionalContext'),
              },
            ]}
            onLightAreaClick={handleLightAreaClick}
            disabled={isRefining}
          />
        )}
      </div>

      {/* Refinement Input (unless in wizard mode) */}
      {showRefinementInput && !isWizardMode && (
        <ScorecardRefinementInput
          ref={refinementRef}
          existingBrainDump={rawBrainDump}
          onRefinementComplete={handleRefinementComplete}
          onRefinementStart={() => setIsRefining(true)}
          disabled={isRefining}
        />
      )}
    </div>
  );
}
