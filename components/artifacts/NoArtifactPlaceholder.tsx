import Link from 'next/link';
import { ARTIFACT_TYPE_CONFIG, getArtifactTypeFromSlug, type ArtifactTypeSlug } from '@/lib/teaching/constants';

interface NoArtifactPlaceholderProps {
  type: ArtifactTypeSlug;
  projectId: string;
}

export default function NoArtifactPlaceholder({ type, projectId }: NoArtifactPlaceholderProps) {
  const artifactType = getArtifactTypeFromSlug(type);
  const config = ARTIFACT_TYPE_CONFIG[artifactType];

  return (
    <div data-testid="no-artifact-placeholder" className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">
      <div className="text-6xl mb-4">{config.icon}</div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {config.label} Not Generated
      </h2>

      <p className="text-gray-600 text-center max-w-md mb-6">
        This {config.label.toLowerCase()} hasn't been created yet. Return to the teaching dashboard
        to generate learning artifacts for your guru.
      </p>

      <Link
        href={`/projects/${projectId}/artifacts/teaching`}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Go to Artifacts Dashboard
      </Link>
    </div>
  );
}
