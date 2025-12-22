'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Mic, FileText, ArrowLeft } from 'lucide-react';
import ProfileChatMode from '@/components/wizard/profile/ProfileChatMode';
import type { GuruProfile } from '@prisma/client';
import type { SynthesisResult, GuruProfileData } from '@/lib/guruProfile/types';

interface Props {
  projectId: string;
  existingProfile: GuruProfile | null;
}

export function ProfilePageContent({ projectId, existingProfile }: Props) {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<'chat' | 'voice' | 'document'>('chat');

  // Extract GuruProfileData from the profileData JSON field
  const profileData: GuruProfileData | null = existingProfile?.profileData
    ? (existingProfile.profileData as GuruProfileData)
    : null;

  const handleProfileComplete = async (result: SynthesisResult) => {
    try {
      // Save the profile to the project
      // Map SynthesisResult fields to API expected format
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

      // Navigate back to dashboard
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Profile Summary */}
      {profileData && (
        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-lg">Current Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Domain Expertise</div>
                <div>{profileData.domainExpertise}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Target Audience</div>
                <div>{profileData.audienceDescription}</div>
              </div>
              <div className="md:col-span-2">
                <div className="font-medium text-muted-foreground">Pedagogical Approach</div>
                <div>{profileData.pedagogicalApproach}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Continue the conversation below to update or refine your profile.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Input Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {existingProfile ? 'Refine Your Profile' : 'Create Your Profile'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as typeof inputMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat Interview
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Voice Input
              </TabsTrigger>
              <TabsTrigger value="document" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Document Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-6">
              <ProfileChatMode onComplete={handleProfileComplete} />
            </TabsContent>

            <TabsContent value="voice" className="mt-6">
              <div className="text-center py-12 text-muted-foreground">
                Voice input coming soon
              </div>
            </TabsContent>

            <TabsContent value="document" className="mt-6">
              <div className="text-center py-12 text-muted-foreground">
                Document upload coming soon
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
