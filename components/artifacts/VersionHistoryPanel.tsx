'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ArtifactSummary } from '@/lib/teaching/artifactClient';

interface VersionHistoryPanelProps {
  projectId: string;
  artifactType: 'mental-model' | 'curriculum' | 'drill-series';
  versions: ArtifactSummary[];
  currentVersion: number;
}

export default function VersionHistoryPanel({
  projectId,
  artifactType,
  versions,
  currentVersion,
}: VersionHistoryPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Sort versions in reverse chronological order (newest first)
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
  const latestVersion = sortedVersions[0]?.version || 0;

  function handleVersionSelect(version: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (version === latestVersion) {
      params.delete('v'); // Latest doesn't need explicit version
    } else {
      params.set('v', version.toString());
    }
    // Preserve diff param if present
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(url);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function truncateHash(hash: string | null): string {
    if (!hash) return 'No hash';
    return hash.slice(0, 8) + '...';
  }

  if (sortedVersions.length === 0) {
    return (
      <div className="w-48 border-r border-gray-200 bg-gray-50 p-3" data-testid="version-panel">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Versions</h3>
        <p className="text-xs text-gray-500">No versions available</p>
      </div>
    );
  }

  return (
    <div className="w-48 border-r border-gray-200 bg-gray-50 p-3" data-testid="version-panel">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Versions</h3>
      <div className="space-y-2">
        {sortedVersions.map((version) => (
          <button
            key={version.id}
            onClick={() => handleVersionSelect(version.version)}
            className={`w-full text-left p-2 rounded-md transition-colors ${
              version.version === currentVersion
                ? 'bg-blue-100 border border-blue-300'
                : 'hover:bg-gray-100'
            }`}
            data-testid={`version-${version.version}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">
                v{version.version}
                {version.version === latestVersion && (
                  <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">
                    Latest
                  </span>
                )}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(version.generatedAt)}
            </div>
            {/* Corpus hash tooltip */}
            <div
              className="text-xs text-gray-400 mt-1 cursor-help"
              title={`Corpus: ${version.corpusHash || 'Unknown'}`}
            >
              {truncateHash(version.corpusHash)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
