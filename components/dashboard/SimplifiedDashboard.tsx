'use client';

/**
 * SimplifiedDashboard Component
 *
 * Main dashboard for project management. Shows:
 * - Getting Started checklist for new projects
 * - Activity tiles with quick stats
 * - Profile summary
 * - Recent activity feed
 * - Recommended next steps
 */

import Link from 'next/link';
import {
  BookOpen,
  Brain,
  FileText,
  Lightbulb,
  Search,
  Target,
  User,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Project, GuruProfile, ResearchRun, GuruArtifact } from '@prisma/client';

import { GettingStartedStep } from './GettingStartedStep';
import { ActivityTile } from './ActivityTile';
import { ProfileSummary } from './ProfileSummary';
import { RecentActivityList } from './RecentActivityList';
import { RecommendedSteps } from './RecommendedSteps';
import { ReadinessSummary } from './ReadinessSummary';
import { GTStatusIndicator } from './GTStatusIndicator';
import { TourPageButton } from '@/lib/onboarding/TourPageButton';

// Type for the project with its relations
export type ProjectWithRelations = Project & {
  currentProfile: GuruProfile | null;
  researchRuns: (ResearchRun & {
    _count: { recommendations: number };
  })[];
  guruArtifacts: GuruArtifact[];
};

export interface SimplifiedDashboardProps {
  project: ProjectWithRelations;
  isNewProject: boolean;
}

export function SimplifiedDashboard({ project, isNewProject }: SimplifiedDashboardProps) {
  const hasProfile = !!project.currentProfile;
  const hasResearch = project.researchRuns.length > 0;
  const hasArtifacts = project.guruArtifacts.length > 0;

  // Calculate completion percentage for getting started
  const completedSteps = [hasProfile, hasResearch, hasArtifacts].filter(Boolean).length;
  const completionPercentage = Math.round((completedSteps / 3) * 100);

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {project.description || 'Your AI teaching assistant project'}
          </p>
        </div>
        <div className="flex gap-2">
          <TourPageButton tourId="dashboard" />
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${project.id}`}>
              <FileText className="w-4 h-4 mr-2" />
              Corpus
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/projects/${project.id}/research`}>
              <Search className="w-4 h-4 mr-2" />
              Research
            </Link>
          </Button>
        </div>
      </div>

      {/* Getting Started (for new projects) */}
      {isNewProject && (
        <Card data-tour="getting-started" className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Getting Started
                </CardTitle>
                <CardDescription>
                  Complete these steps to build your AI guru
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{completionPercentage}%</div>
                <div className="text-xs text-muted-foreground">complete</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="mb-4" />
            <div className="space-y-3">
              <GettingStartedStep
                completed={hasProfile}
                title="Create Guru Profile"
                description="Define your teaching domain and style"
                href={`/projects/${project.id}/profile`}
                icon={<User className="w-4 h-4" />}
              />
              <GettingStartedStep
                completed={hasResearch}
                title="Run Research"
                description="Gather knowledge for your guru"
                href={`/projects/${project.id}/research`}
                icon={<Search className="w-4 h-4" />}
                disabled={!hasProfile}
              />
              <GettingStartedStep
                completed={hasArtifacts}
                title="Generate Teaching Content"
                description="Create curricula and drills"
                href={`/projects/${project.id}/artifacts/teaching`}
                icon={<BookOpen className="w-4 h-4" />}
                disabled={!hasResearch}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Tiles */}
      <div data-tour="activity-tiles" className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <ActivityTile
          title="Research Runs"
          value={project.researchRuns.length}
          icon={<Search className="w-5 h-5" />}
          href={`/projects/${project.id}/research`}
        />
        <ActivityTile
          title="Knowledge Bits Acquired"
          value={project.researchRuns.reduce((acc, run) => acc + run._count.recommendations, 0)}
          icon={<Lightbulb className="w-5 h-5" />}
          href={`/projects/${project.id}/research`}
        />
        <ActivityTile
          title="Artifacts Generated"
          value={project.guruArtifacts.length}
          icon={<FileText className="w-5 h-5" />}
          href={`/projects/${project.id}/artifacts/teaching`}
        />
        <ActivityTile
          title="Profile"
          value={hasProfile ? 'Active' : 'Not Set'}
          icon={<Brain className="w-5 h-5" />}
          href={`/projects/${project.id}/profile`}
          isStatus
        />
      </div>

      {/* Ground Truth Status (only shown when enabled) */}
      {hasProfile && <GTStatusIndicator projectId={project.id} />}

      {/* Profile Summary & Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Profile Summary */}
        <Card data-tour="guru-profile">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Guru Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasProfile ? (
              <ProfileSummary profile={project.currentProfile!} projectId={project.id} />
            ) : (
              <div className="text-center py-6">
                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No guru profile created yet</p>
                <Button asChild size="sm">
                  <Link href={`/projects/${project.id}/profile`}>
                    Create Profile
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-tour="recent-activity">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.researchRuns.length > 0 || project.guruArtifacts.length > 0 ? (
              <RecentActivityList
                researchRuns={project.researchRuns}
                artifacts={project.guruArtifacts}
                projectId={project.id}
              />
            ) : (
              <div className="text-center py-6">
                <Search className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No activity yet</p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/projects/${project.id}/research`}>
                    Start Research
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Readiness Summary - shows when profile exists, replaces generic Recommended Steps */}
      {hasProfile && (
        <div data-tour="readiness-summary">
          <ReadinessSummary projectId={project.id} />
        </div>
      )}

      {/* Recommended Next Steps - only for projects without a profile */}
      {!isNewProject && !hasProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Recommended Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecommendedSteps
              hasProfile={hasProfile}
              hasResearch={hasResearch}
              hasArtifacts={hasArtifacts}
              projectId={project.id}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
