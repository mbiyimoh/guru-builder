/**
 * Teaching Artifacts Base Route
 *
 * Redirects to the Mental Model page as the default starting point
 * for the unified teaching artifact experience.
 */

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeachingArtifactsPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/projects/${id}/artifacts/teaching/mental-model`);
}
