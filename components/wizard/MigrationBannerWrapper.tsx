'use client'

import { MigrationBanner } from './MigrationBanner'

interface MigrationBannerWrapperProps {
  projectId: string
  projectName: string
  hasGuruProfile: boolean
  hasCorpusContent: boolean
}

export function MigrationBannerWrapper({
  projectId,
  projectName,
  hasGuruProfile,
  hasCorpusContent,
}: MigrationBannerWrapperProps) {
  // Determine if this is a "legacy" project that could benefit from wizard
  // Show banner if:
  // 1. Project has a guru profile OR has corpus content (layers/files)
  // 2. User hasn't dismissed the banner (handled inside MigrationBanner)
  const shouldShowBanner = hasGuruProfile || hasCorpusContent

  if (!shouldShowBanner) {
    return null
  }

  return <MigrationBanner projectId={projectId} projectName={projectName} />
}
