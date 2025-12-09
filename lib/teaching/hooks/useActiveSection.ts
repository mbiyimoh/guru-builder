'use client';

import { useState, useEffect, useRef } from 'react';

interface UseActiveSectionOptions {
  rootMargin?: string;
  threshold?: number | number[];
}

export function useActiveSection(
  sectionIds: string[],
  options: UseActiveSectionOptions = {}
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Store sectionIds in ref to avoid re-running effect when array reference changes
  const sectionIdsRef = useRef<string[]>(sectionIds);

  // Update ref when sectionIds change
  useEffect(() => {
    sectionIdsRef.current = sectionIds;
  }, [sectionIds]);

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const ids = sectionIdsRef.current;

    // Don't observe if no sections
    if (ids.length === 0) {
      setActiveId(null);
      return;
    }

    const { rootMargin = '-20% 0px -80% 0px', threshold = 0 } = options;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry
        const intersecting = entries.find((entry) => entry.isIntersecting);
        if (intersecting) {
          setActiveId(intersecting.target.id);
        }
      },
      { rootMargin, threshold }
    );

    // Observe all sections
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
    // Use JSON.stringify for stable comparison of sectionIds array contents
  }, [JSON.stringify(sectionIds), options.rootMargin, options.threshold]);

  return activeId;
}

/**
 * Smoothly scroll to a section by ID
 */
export function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth'): void {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior, block: 'start' });
  }
}
