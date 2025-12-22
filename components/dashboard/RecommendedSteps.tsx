'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RecommendedStepsProps {
  hasProfile: boolean;
  hasResearch: boolean;
  hasArtifacts: boolean;
  projectId: string;
}

export function RecommendedSteps({ hasProfile, hasResearch, hasArtifacts, projectId }: RecommendedStepsProps) {
  const steps = [];

  if (!hasProfile) {
    steps.push({
      title: 'Create your guru profile',
      description: 'Define the teaching domain, audience, and pedagogical approach',
      href: `/projects/${projectId}/profile`,
      priority: 'high',
    });
  }

  if (hasProfile && !hasResearch) {
    steps.push({
      title: 'Run your first research',
      description: 'Gather knowledge to train your guru',
      href: `/projects/${projectId}/research`,
      priority: 'high',
    });
  }

  if (hasResearch && !hasArtifacts) {
    steps.push({
      title: 'Generate teaching content',
      description: 'Create mental models, curricula, and practice drills',
      href: `/projects/${projectId}/artifacts/teaching`,
      priority: 'high',
    });
  }

  if (hasArtifacts) {
    steps.push({
      title: 'Expand your knowledge base',
      description: 'Run more research to deepen your guru expertise',
      href: `/projects/${projectId}/research`,
      priority: 'medium',
    });
  }

  if (steps.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Great progress! Keep building your guru knowledge.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <Link
          key={index}
          href={step.href}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
        >
          <div className={`p-2 rounded-full ${step.priority === 'high' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
            <ChevronRight className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{step.title}</div>
            <div className="text-xs text-muted-foreground">{step.description}</div>
          </div>
          {step.priority === 'high' && (
            <Badge variant="default" className="text-xs">Recommended</Badge>
          )}
        </Link>
      ))}
    </div>
  );
}
