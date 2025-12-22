'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactSummary } from '@/lib/teaching/artifactClient';

interface VersionDropdownProps {
  versions: ArtifactSummary[];
  currentVersion: number;
}

/**
 * Version Dropdown - Compact version selector for artifact header
 *
 * Replaces the VersionHistoryPanel sidebar with a dropdown in the header.
 * Shows version number and date, with "Latest" badge on most recent version.
 */
export function VersionDropdown({ versions, currentVersion }: VersionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Sort versions newest first
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
  const latestVersion = sortedVersions[0]?.version || 0;
  const currentVersionData = versions.find((v) => v.version === currentVersion);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  function handleVersionSelect(version: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (version === latestVersion) {
      params.delete('v');
    } else {
      params.set('v', version.toString());
    }
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url);
    setIsOpen(false);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (sortedVersions.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
        No versions
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors',
          'bg-blue-100 text-blue-800 hover:bg-blue-200',
          isOpen && 'ring-2 ring-blue-500 ring-offset-1'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid="version-dropdown-trigger"
      >
        <span>v{currentVersion}</span>
        {currentVersionData && (
          <span className="text-blue-600">- {formatDate(currentVersionData.generatedAt)}</span>
        )}
        {currentVersion === latestVersion && (
          <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
            Latest
          </span>
        )}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-white shadow-lg"
          role="listbox"
          aria-label="Version history"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {sortedVersions.map((version) => (
              <button
                key={version.id}
                onClick={() => handleVersionSelect(version.version)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50',
                  version.version === currentVersion && 'bg-blue-50'
                )}
                role="option"
                aria-selected={version.version === currentVersion}
                data-testid={`version-option-${version.version}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">v{version.version}</span>
                    {version.version === latestVersion && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(version.generatedAt)}</div>
                </div>
                {version.version === currentVersion && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
