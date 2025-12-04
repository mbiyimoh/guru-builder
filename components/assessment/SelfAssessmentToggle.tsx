'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  projectId: string
}

export function SelfAssessmentToggle({ projectId }: Props) {
  const [assessmentEnabled, setAssessmentEnabled] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/assessment/config`)
      .then((res) => res.json())
      .then((data) => {
        setAssessmentEnabled(data.config?.isEnabled ?? false)
        setLoadingConfig(false)
      })
      .catch(() => setLoadingConfig(false))
  }, [projectId])

  async function toggleAssessment() {
    const response = await fetch(`/api/projects/${projectId}/assessment/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !assessmentEnabled }),
    })
    const data = await response.json()
    if (data.config) {
      setAssessmentEnabled(data.config.isEnabled)
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-900">Self-Assessment</p>
            <p className="text-sm text-gray-500">Test your guru against GNU Backgammon engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={assessmentEnabled}
              onChange={toggleAssessment}
              disabled={loadingConfig}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {loadingConfig ? 'Loading...' : assessmentEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
          {assessmentEnabled && (
            <Link
              href={`/projects/${projectId}/assessment`}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
            >
              Start Assessment
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
