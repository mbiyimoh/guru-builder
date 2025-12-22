'use client';

import { ProjectPageError } from '@/components/project/ProjectPageError';

export default function ReadinessPageError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ProjectPageError {...props} pageName="Readiness" />;
}
