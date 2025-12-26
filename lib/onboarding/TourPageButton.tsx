'use client';

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageTour } from './usePageTour';
import type { TourId } from './tours';

interface TourPageButtonProps {
  tourId: TourId;
}

export function TourPageButton({ tourId }: TourPageButtonProps) {
  const { startTour } = usePageTour(tourId);

  // Use CSS to hide on mobile (avoids SSR hydration mismatch)
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={startTour}
      className="text-muted-foreground hover:text-foreground hidden md:inline-flex"
      title="Tour this page"
    >
      <HelpCircle className="h-4 w-4 mr-1" />
      Tour Page
    </Button>
  );
}
