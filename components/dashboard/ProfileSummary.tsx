'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { GuruProfile } from '@prisma/client';

interface ProfileSummaryProps {
  profile: GuruProfile;
  projectId: string;
}

export function ProfileSummary({ profile, projectId }: ProfileSummaryProps) {
  // Profile data is stored as JSON
  const profileData = profile.profileData as Record<string, unknown>;

  // Extract and type-guard the values
  const domainExpertise = typeof profileData.domainExpertise === 'string' ? profileData.domainExpertise : null;
  const audienceDescription = typeof profileData.audienceDescription === 'string' ? profileData.audienceDescription : null;
  const pedagogicalApproach = typeof profileData.pedagogicalApproach === 'string' ? profileData.pedagogicalApproach : null;

  return (
    <div className="space-y-3">
      {domainExpertise && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Domain</div>
          <div className="font-medium">{domainExpertise}</div>
        </div>
      )}
      {audienceDescription && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Audience</div>
          <div className="font-medium text-sm">{audienceDescription}</div>
        </div>
      )}
      {pedagogicalApproach && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Teaching Style</div>
          <div className="font-medium text-sm">{pedagogicalApproach}</div>
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="w-full mt-4">
        <Link href={`/projects/${projectId}/profile`}>
          View Full Profile
        </Link>
      </Button>
    </div>
  );
}
