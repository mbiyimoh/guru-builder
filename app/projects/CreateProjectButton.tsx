'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GuruProfileOnboardingModal } from '@/components/guru/GuruProfileOnboardingModal';
import type { SynthesisResult } from '@/lib/guruProfile/types';
import { Plus } from 'lucide-react';

export function CreateProjectButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleComplete = async (result: SynthesisResult) => {
    setIsCreating(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.profile.domainExpertise || 'New Guru Project',
          description: result.profile.audienceDescription,
          guruProfile: {
            rawBrainDump: result.rawInput,
            synthesisMode: result.synthesisMode,
            profileData: result.profile,
            lightAreas: result.lightAreas,
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create project');
      }

      const data = await res.json();

      if (data.project?.id) {
        // Close modal and navigate to new project
        setIsModalOpen(false);
        router.push(`/projects/${data.project.id}`);
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      // Error handling could be improved with toast notifications
      alert(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        disabled={isCreating}
        size="default"
      >
        <Plus className="h-4 w-4 mr-2" />
        {isCreating ? 'Creating...' : 'New Guru'}
      </Button>

      <GuruProfileOnboardingModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onComplete={handleComplete}
      />
    </>
  );
}
