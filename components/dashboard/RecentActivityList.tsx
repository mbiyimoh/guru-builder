'use client';

import Link from 'next/link';
import { Search, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ResearchRun, GuruArtifact, GuruArtifactType } from '@prisma/client';
import { getArtifactSlug } from '@/lib/teaching/constants';

interface RecentActivityListProps {
  researchRuns: (ResearchRun & { _count: { recommendations: number } })[];
  artifacts: GuruArtifact[];
  projectId: string;
}

export function RecentActivityList({ researchRuns, artifacts, projectId }: RecentActivityListProps) {
  // Combine and sort by date
  const activities = [
    ...researchRuns.map((run) => ({
      type: 'research' as const,
      id: run.id,
      title: run.instructions.slice(0, 50) + (run.instructions.length > 50 ? '...' : ''),
      status: run.status,
      date: run.createdAt,
      count: run._count.recommendations,
      artifactType: null as GuruArtifactType | null,
    })),
    ...artifacts.map((artifact) => ({
      type: 'artifact' as const,
      id: artifact.id,
      title: artifact.type.replace(/_/g, ' '),
      status: artifact.status,
      date: artifact.generatedAt,
      artifactType: artifact.type,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Build the correct link for each activity type
  const getActivityLink = (activity: typeof activities[number]) => {
    if (activity.type === 'research') {
      return `/projects/${projectId}/research/${activity.id}`;
    }
    // Artifacts link to the type-specific viewer, not by ID
    return `/projects/${projectId}/artifacts/teaching/${getArtifactSlug(activity.artifactType!)}`;
  };

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <Link
          key={`${activity.type}-${activity.id}`}
          href={getActivityLink(activity)}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
            {activity.type === 'research' ? (
              <Search className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{activity.title}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(activity.date).toLocaleDateString()}
              {activity.type === 'research' && activity.count > 0 && (
                <span> - {activity.count} recommendations</span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {activity.status}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
