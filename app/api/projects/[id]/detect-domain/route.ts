/**
 * Domain Detection API
 *
 * POST /api/projects/[id]/detect-domain
 * Detects if the project's profile matches a known domain (e.g., backgammon)
 * and suggests appropriate ground truth engines for verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectDomainFromProject, type DomainDetectionResult } from '@/lib/domainDetection';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DomainDetectionResult>> {
  try {
    console.log('[Domain Detection] API called');

    // Verify user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      console.log('[Domain Detection] No user - failing silently');
      // Fail silently per spec - return "not detected" on auth error
      return NextResponse.json({
        detected: false,
        domain: null,
        matchedKeywords: [],
        suggestedEngine: null,
      });
    }

    const { id: projectId } = await params;
    console.log('[Domain Detection] Project ID:', projectId);

    // Run domain detection
    const result = await detectDomainFromProject(projectId);
    console.log('[Domain Detection] Result:', JSON.stringify(result));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Domain Detection] Error:', error);

    // Fail silently per spec - return "not detected" on error
    return NextResponse.json({
      detected: false,
      domain: null,
      matchedKeywords: [],
      suggestedEngine: null,
    });
  }
}
