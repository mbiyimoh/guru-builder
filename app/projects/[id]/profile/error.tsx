'use client';

import { ProjectPageError } from '@/components/project/ProjectPageError';

export default function ProfilePageError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ProjectPageError {...props} pageName="Profile" />;
}
