'use client';

/**
 * Legacy Readiness Wizard Route - Redirect Only
 *
 * This route is deprecated. All traffic is redirected to the new
 * dashboard-anchored route: /projects/[id]/readiness
 *
 * Kept for backward compatibility with any existing bookmarks or links.
 */

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LegacyReadinessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}/readiness`);
    } else {
      router.push('/projects');
    }
  }, [projectId, router]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Redirecting...</p>
        </div>
      </div>
    </div>
  );
}
