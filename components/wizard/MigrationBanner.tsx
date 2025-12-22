'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MigrationBannerProps {
  projectId: string
  projectName: string
}

export function MigrationBanner({ projectId, projectName }: MigrationBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const STORAGE_KEY = `wizard-banner-dismissed-${projectId}`

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === 'true'
    setIsDismissed(dismissed)
  }, [STORAGE_KEY])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsDismissed(true)
  }

  // Don't render if dismissed
  if (isDismissed) {
    return null
  }

  return (
    <div className="mb-8 relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 text-white shadow-lg">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-white blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-white blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Content */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>

          {/* Text content */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">
              Try the New Guru Builder Experience
            </h3>
            <p className="text-sm text-white/90 mb-4 max-w-2xl">
              We've made it easier to build and refine your guru with our new guided workflow.
              Start a research session with step-by-step guidance, automatic recommendations,
              and one-click application to {projectName}.
            </p>

            {/* CTA Button */}
            <Link
              href={`/projects/${projectId}/research`}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                "bg-white text-purple-700 text-sm font-medium",
                "hover:bg-white/90 transition-colors shadow-sm"
              )}
            >
              Try It Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className={cn(
            "flex-shrink-0 p-1 rounded-md",
            "text-white/70 hover:text-white hover:bg-white/10",
            "transition-colors"
          )}
          aria-label="Dismiss banner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
