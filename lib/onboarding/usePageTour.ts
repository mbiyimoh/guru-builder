'use client';

import { useEffect, useCallback, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { TOURS, type TourId } from './tours';

const MOBILE_BREAKPOINT = 768;

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function usePageTour(tourId: TourId) {
  const storageKey = `tour-seen-${tourId}`;
  const [hasSeen, setHasSeen] = useState<boolean | null>(null); // null = not hydrated yet
  const [isMounted, setIsMounted] = useState(false);

  // Hydration-safe: only access localStorage after mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const seen = localStorage.getItem(storageKey) === 'true';
      setHasSeen(seen);
    } catch {
      // localStorage blocked (private browsing, etc.) - default to seen
      setHasSeen(true);
    }
  }, [storageKey]);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // localStorage blocked - silently continue
    }
    setHasSeen(true);
  }, [storageKey]);

  const startTour = useCallback(() => {
    if (isMobile()) return;

    const steps = TOURS[tourId];
    if (!steps?.length) return;

    try {
      // Driver.js automatically skips steps where the target element doesn't exist
      // (e.g., "Getting Started" card hidden for non-new projects)
      const driverObj = driver({
        showProgress: true,
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        onDestroyed: markSeen,
        // Accessibility enhancements
        allowKeyboardControl: true, // ESC to close, arrow keys to navigate
        steps,
      });

      driverObj.drive();
    } catch (error) {
      console.error('Failed to start tour:', error);
      markSeen(); // Prevent infinite retry on error
    }
  }, [tourId, markSeen]);

  // Auto-start on first visit (hydration-safe, non-mobile only)
  useEffect(() => {
    if (!isMounted || hasSeen !== false || isMobile()) return;

    // Small delay to ensure DOM elements are rendered
    const timer = setTimeout(startTour, 500);
    return () => clearTimeout(timer);
  }, [isMounted, hasSeen, startTour]);

  const resetTour = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // localStorage blocked - silently continue
    }
    setHasSeen(false);
  }, [storageKey]);

  return { hasSeen: hasSeen ?? true, startTour, resetTour };
}
