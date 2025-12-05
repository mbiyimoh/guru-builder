'use client'

import { useState, useEffect } from 'react'
import { AssessmentCard } from './AssessmentCard'
import { AddAssessmentModal } from './AddAssessmentModal'

interface AssessmentDefinition {
  id: string
  name: string
  description: string | null
  domain: string
  engineType: string | null
}

interface ProjectAssessment {
  id: string
  isEnabled: boolean
  assessmentDefinition: AssessmentDefinition
  _count: { sessions: number }
}

interface Props {
  projectId: string
}

export function ProjectAssessmentManager({ projectId }: Props) {
  const [assessments, setAssessments] = useState<ProjectAssessment[]>([])
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    setLoading(true)
    try {
      const [assessRes, defRes] = await Promise.all([
        fetch(`/api/assessment/project-assessments?projectId=${projectId}`),
        fetch('/api/assessment/definitions'),
      ])

      const [assessData, defData] = await Promise.all([
        assessRes.json(),
        defRes.json(),
      ])

      setAssessments(assessData.projectAssessments || [])
      setDefinitions(defData.definitions || [])
    } catch (error) {
      console.error('Failed to fetch assessments:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(assessmentId: string, isEnabled: boolean) {
    try {
      await fetch(`/api/assessment/project-assessments/${assessmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled }),
      })
      fetchData()
    } catch (error) {
      console.error('Failed to toggle assessment:', error)
    }
  }

  async function handleRemove(assessmentId: string) {
    if (!confirm('Remove this assessment from the project?')) return

    try {
      await fetch(`/api/assessment/project-assessments/${assessmentId}`, {
        method: 'DELETE',
      })
      fetchData()
    } catch (error) {
      console.error('Failed to remove assessment:', error)
    }
  }

  async function handleAdd(definitionId: string) {
    try {
      await fetch('/api/assessment/project-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          assessmentDefinitionId: definitionId,
        }),
      })
      setShowAddModal(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add assessment:', error)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  // Empty state - no assessments assigned
  if (assessments.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center">
          <div className="mx-auto flex-shrink-0 bg-yellow-100 rounded-full p-3 w-12 h-12 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4">No assessments configured for this project</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Assessment
          </button>
        </div>

        <AddAssessmentModal
          open={showAddModal}
          definitions={definitions}
          existingIds={[]}
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      </div>
    )
  }

  // Show assigned assessments
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-yellow-100 rounded-md p-2 mr-3">
            <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-medium">Self-Assessments</h3>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition"
        >
          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      <div className="space-y-3">
        {assessments.map(pa => (
          <AssessmentCard
            key={pa.id}
            assessment={pa}
            projectId={projectId}
            onToggle={(enabled) => handleToggle(pa.id, enabled)}
            onRemove={() => handleRemove(pa.id)}
          />
        ))}
      </div>

      <AddAssessmentModal
        open={showAddModal}
        definitions={definitions}
        existingIds={assessments.map(a => a.assessmentDefinition.id)}
        onAdd={handleAdd}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  )
}
