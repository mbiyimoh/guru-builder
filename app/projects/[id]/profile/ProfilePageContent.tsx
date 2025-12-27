'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ProfileScorecard } from '@/components/profile';
import type { GuruProfile } from '@prisma/client';
import type { SynthesisResult, GuruProfileData } from '@/lib/guruProfile/types';

interface Props {
  projectId: string;
  existingProfile: GuruProfile | null;
}

export function ProfilePageContent({ projectId, existingProfile }: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(existingProfile);

  // Extract GuruProfileData from the profileData JSON field
  const profileData: GuruProfileData | null = currentProfile?.profileData
    ? (currentProfile.profileData as GuruProfileData)
    : null;

  // Extract light areas (default to empty array)
  const lightAreas: string[] = (currentProfile?.lightAreas as string[]) || [];

  // Extract raw brain dump for refinement merge
  const rawBrainDump: string = (currentProfile?.rawBrainDump as string) || '';

  // Calculate confidence from light areas if not stored
  // (lower confidence = more light areas)
  const calculateConfidence = useCallback(() => {
    if (!profileData) return 0;
    const totalFields = 15; // Approximate number of profile fields
    const lightCount = lightAreas.length;
    return Math.max(0.5, 1 - (lightCount / totalFields) * 0.5);
  }, [profileData, lightAreas]);

  const handleProfileUpdated = async (result: SynthesisResult) => {
    setIsSaving(true);
    try {
      // Save the updated profile
      const response = await fetch(`/api/projects/${projectId}/guru-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileData: result.profile,
          rawBrainDump: result.rawInput,
          synthesisMode: result.synthesisMode,
          lightAreas: result.lightAreas,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      // Fetch the updated profile to get the full data
      const updatedRes = await fetch(`/api/projects/${projectId}/guru-profile`);
      if (updatedRes.ok) {
        const data = await updatedRes.json();
        if (data.hasProfile && data.profile) {
          setCurrentProfile(data.profile);
        }
      }

      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // No profile exists - show creation prompt
  if (!profileData) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No Guru Profile Yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your guru profile to define your teaching style and approach.
          </p>
          <Button onClick={() => router.push(`/projects/${projectId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saving Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="flex items-center gap-3 bg-card p-4 rounded-lg shadow-lg border">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Saving profile changes...</span>
          </div>
        </div>
      )}

      {/* Profile Scorecard */}
      <ProfileScorecard
        profile={profileData}
        lightAreas={lightAreas}
        confidence={calculateConfidence()}
        rawBrainDump={rawBrainDump}
        projectId={projectId}
        onProfileUpdated={handleProfileUpdated}
        showRefinementInput={true}
      />

      {/* Back Button */}
      <div className="flex justify-start">
        <Button
          variant="outline"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
