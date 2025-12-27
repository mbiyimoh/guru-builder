'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GuruProfileOnboardingModal } from './GuruProfileOnboardingModal'
import type { GuruProfileData, SynthesisResult } from '@/lib/guruProfile/types'
import { User, Sparkles, Edit2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GuruProfileSectionProps {
  projectId: string
  /** If true, auto-opens onboarding modal when no profile exists */
  autoPrompt?: boolean
}

interface ProfileResponse {
  hasProfile: boolean
  profile: {
    id: string
    profileData: GuruProfileData
    rawBrainDump: string
    synthesisMode: string
    lightAreas: string[]
    version: number
    createdAt: string
    updatedAt: string
  } | null
}

export function GuruProfileSection({ projectId, autoPrompt = true }: GuruProfileSectionProps) {
  const router = useRouter()
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasAutoPrompted, setHasAutoPrompted] = useState(false)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/guru-profile`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setProfileData(data)
      }
    } catch (error) {
      console.error('Failed to fetch guru profile:', error)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Auto-prompt modal if no profile exists
  useEffect(() => {
    if (!isLoading && profileData && !profileData.hasProfile && autoPrompt && !hasAutoPrompted) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setIsModalOpen(true)
        setHasAutoPrompted(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, profileData, autoPrompt, hasAutoPrompted])

  const handleProfileComplete = async (result: SynthesisResult) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/guru-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileData: result.profile,
          rawBrainDump: result.rawInput,
          synthesisMode: result.synthesisMode,
          lightAreas: result.lightAreas,
        }),
      })

      if (res.ok) {
        await fetchProfile()
      } else {
        const error = await res.json()
        console.error('Failed to save profile:', error)
        alert('Failed to save profile. Please try again.')
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
      alert('Failed to save profile. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  // No profile - show CTA
  if (!profileData?.hasProfile) {
    return (
      <>
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Create Your AI Teaching Profile
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Tell us about your teaching style, expertise, and audience. Our AI will synthesize
                this into a structured profile that guides all content generation.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Profile
              </button>
            </div>
          </div>
        </div>

        <GuruProfileOnboardingModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onComplete={handleProfileComplete}
        />
      </>
    )
  }

  // Profile exists - show summary
  const profile = profileData.profile!
  const data = profile.profileData

  return (
    <>
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Guru Profile
                </h3>
                <p className="text-sm text-gray-600">
                  {data.domainExpertise}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {data.audienceLevel}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {data.tone}
                  </span>
                  <span className="text-xs text-gray-500">
                    v{profile.version}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${projectId}/profile`}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Edit profile"
              >
                <Edit2 className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Expanded details */}
          <div className={cn(
            'overflow-hidden transition-all duration-300',
            isExpanded ? 'max-h-[2000px] mt-6' : 'max-h-0'
          )}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              {/* Audience */}
              <ProfileDetailCard title="Target Audience">
                <p className="text-sm text-gray-700">{data.audienceDescription}</p>
              </ProfileDetailCard>

              {/* Teaching Style */}
              <ProfileDetailCard title="Teaching Approach">
                <p className="text-sm text-gray-700">{data.pedagogicalApproach}</p>
              </ProfileDetailCard>

              {/* Topics */}
              <ProfileDetailCard title="Key Topics">
                <div className="flex flex-wrap gap-1">
                  {data.specificTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </ProfileDetailCard>

              {/* Communication Style */}
              <ProfileDetailCard title="Communication Style">
                <p className="text-sm text-gray-700">{data.communicationStyle}</p>
              </ProfileDetailCard>

              {/* Unique Perspective */}
              <ProfileDetailCard title="Unique Perspective">
                <p className="text-sm text-gray-700">{data.uniquePerspective}</p>
              </ProfileDetailCard>

              {/* Success Metrics */}
              <ProfileDetailCard title="Success Metrics">
                <p className="text-sm text-gray-700">{data.successMetrics}</p>
              </ProfileDetailCard>

              {/* Emphasized Concepts */}
              {data.emphasizedConcepts.length > 0 && (
                <ProfileDetailCard title="Emphasized Concepts">
                  <div className="flex flex-wrap gap-1">
                    {data.emphasizedConcepts.map((concept, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </ProfileDetailCard>
              )}

              {/* Avoided Topics */}
              {data.avoidedTopics.length > 0 && (
                <ProfileDetailCard title="Topics to Avoid">
                  <div className="flex flex-wrap gap-1">
                    {data.avoidedTopics.map((topic, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </ProfileDetailCard>
              )}
            </div>

            {/* Metadata and View Full Link */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Created {new Date(profile.createdAt).toLocaleDateString()} •
                Last updated {new Date(profile.updatedAt).toLocaleDateString()}
                {profile.lightAreas.length > 0 && (
                  <span className="ml-2 text-amber-600">
                    ({profile.lightAreas.length} area{profile.lightAreas.length > 1 ? 's' : ''} to improve)
                  </span>
                )}
              </div>
              <Link
                href={`/projects/${projectId}/profile`}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                View & Improve Profile
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal only for creating new profiles (no profile exists) - keep for auto-prompt */}
      <GuruProfileOnboardingModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onComplete={handleProfileComplete}
      />
    </>
  )
}

function ProfileDetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900 mb-2">{title}</h4>
      {children}
    </div>
  )
}
