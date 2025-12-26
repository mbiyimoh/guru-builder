'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, BookOpen, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactSummariesResponse } from '@/lib/teaching/artifactClient';

interface ArtifactTabBarProps {
  projectId: string;
  artifactsSummary: ArtifactSummariesResponse;
}

const TABS = [
  {
    type: 'mental-model',
    slug: 'mental-model',
    label: 'Mental Model',
    icon: Brain,
    latestKey: 'mentalModel' as const,
  },
  {
    type: 'curriculum',
    slug: 'curriculum',
    label: 'Curriculum',
    icon: BookOpen,
    latestKey: 'curriculum' as const,
  },
  {
    type: 'drill-series',
    slug: 'drill-series',
    label: 'Drill Series',
    icon: Target,
    latestKey: 'drillSeries' as const,
  },
] as const;

export function ArtifactTabBar({ projectId, artifactsSummary }: ArtifactTabBarProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background" data-testid="artifact-tab-bar">
      <div className="flex gap-1 px-4">
        {TABS.map(({ type, slug, label, icon: Icon, latestKey }) => {
          const artifact = artifactsSummary.latest[latestKey];
          const isActive = pathname.includes(`/teaching/${slug}`);

          return (
            <Link
              key={type}
              href={`/projects/${projectId}/artifacts/teaching/${slug}`}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              )}
              role="tab"
              aria-selected={isActive}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              {artifact ? (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-muted">
                  v{artifact.version}
                </span>
              ) : (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                  —
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
