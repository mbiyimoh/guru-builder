'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { GuruArtifactType, ArtifactStatus } from '@prisma/client';
import { ARTIFACT_TYPE_CONFIG, type ArtifactTypeSlug } from '@/lib/teaching/constants';
import type { ArtifactSummary } from '@/lib/teaching/artifactClient';

interface TeachingArtifactNavProps {
  projectId: string;
  artifacts: {
    mentalModel: ArtifactSummary | null;
    curriculum: ArtifactSummary | null;
    drillSeries: ArtifactSummary | null;
  };
}

const NAV_ITEMS: Array<{
  type: GuruArtifactType;
  apiKey: 'mentalModel' | 'curriculum' | 'drillSeries';
}> = [
  { type: 'MENTAL_MODEL', apiKey: 'mentalModel' },
  { type: 'CURRICULUM', apiKey: 'curriculum' },
  { type: 'DRILL_SERIES', apiKey: 'drillSeries' },
];

function getStatusColor(status: ArtifactStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-500';
    case 'GENERATING':
      return 'bg-yellow-500';
    case 'FAILED':
      return 'bg-red-500';
    default:
      return 'bg-gray-300';
  }
}

export default function TeachingArtifactNav({
  projectId,
  artifacts,
}: TeachingArtifactNavProps) {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Back Button */}
      <div className="p-4 border-b border-gray-200">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Project</span>
        </Link>
      </div>

      {/* Artifact Type Navigation */}
      <div className="flex-1 p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Teaching Artifacts
        </h3>
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ type, apiKey }) => {
            const config = ARTIFACT_TYPE_CONFIG[type];
            const artifact = artifacts[apiKey];
            const isActive = pathname?.includes(`/artifacts/teaching/${config.slug}`);
            const exists = artifact !== null;
            const href = `/projects/${projectId}/artifacts/teaching/${config.slug}`;

            return (
              <li key={type}>
                <Link
                  href={exists ? href : '#'}
                  data-testid={`artifact-nav-${config.slug}`}
                  className={`
                    flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors
                    ${
                      exists && isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : exists
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-400 cursor-not-allowed'
                    }
                  `}
                  onClick={(e) => {
                    if (!exists) {
                      e.preventDefault();
                    }
                  }}
                >
                  {/* Left side: Icon and label */}
                  <div className="flex items-center gap-2">
                    <span className={exists ? 'opacity-100' : 'opacity-50'}>
                      {config.icon}
                    </span>
                    <span className={exists ? 'opacity-100' : 'opacity-50'}>
                      {config.label}
                    </span>
                  </div>

                  {/* Right side: Status and version */}
                  {exists && artifact && (
                    <div className="flex items-center gap-2">
                      {/* Version badge */}
                      <span className="text-xs text-gray-500 font-mono">
                        v{artifact.version}
                      </span>
                      {/* Status indicator */}
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(artifact.status)}`}
                        title={artifact.status}
                      />
                    </div>
                  )}

                  {/* Placeholder for non-existent artifacts */}
                  {!exists && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">None</span>
                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer with help text */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Artifacts are generated from your corpus using GPT-4o.
        </p>
      </div>
    </nav>
  );
}
