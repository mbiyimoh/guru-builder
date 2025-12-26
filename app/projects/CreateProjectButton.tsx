'use client';

import { useTransition } from 'react';
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
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      router.push('/projects/new/profile');
    });
  };

  return (
    <Button onClick={handleClick} size="default" loading={isPending}>
      <Plus className="h-4 w-4 mr-2" />
      New Guru
    </Button>
  );
}
