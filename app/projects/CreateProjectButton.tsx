'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

/**
 * CreateProjectButton
 *
 * Navigates to the full-page profile creation wizard.
 * The wizard handles domain detection and GT engine prompts.
 */
export function CreateProjectButton() {
  const router = useRouter();

  return (
    <Button
      onClick={() => router.push('/projects/new/profile')}
      size="default"
    >
      <Plus className="h-4 w-4 mr-2" />
      New Guru
    </Button>
  );
}
