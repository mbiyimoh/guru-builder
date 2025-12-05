'use client'

import Link from 'next/link'

interface Props {
  assessment: {
    id: string
    isEnabled: boolean
    assessmentDefinition: {
      id: string
      name: string
      description: string | null
      domain: string
      engineType: string | null
    }
    _count: { sessions: number }
  }
  projectId?: string
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}

export function AssessmentCard({ assessment, projectId, onToggle, onRemove }: Props) {
  const { assessmentDefinition: def, isEnabled, _count } = assessment

  return (
    <div className={`p-4 border rounded-lg ${isEnabled ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{def.name}</h4>
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
              {def.domain}
            </span>
          </div>

          {def.description && (
            <p className="text-sm text-gray-500 mt-1">{def.description}</p>
          )}

          <p className="text-xs text-gray-400 mt-2">
            {_count.sessions} session{_count.sessions !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle switch */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>

          {/* Open assessment link */}
          {projectId && isEnabled && (
            <Link
              href={`/projects/${projectId}/assessment`}
              className="p-2 text-gray-500 hover:text-blue-600 transition"
              title="Open Assessment"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          )}

          {/* Remove button */}
          <button
            onClick={onRemove}
            className="p-2 text-gray-400 hover:text-red-600 transition"
            title="Remove from project"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
