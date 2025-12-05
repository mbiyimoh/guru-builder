'use client'

import { useState } from 'react'

interface AssessmentDefinition {
  id: string
  name: string
  description: string | null
  domain: string
}

interface Props {
  open: boolean
  definitions: AssessmentDefinition[]
  existingIds: string[]
  onAdd: (definitionId: string) => void
  onClose: () => void
}

export function AddAssessmentModal({
  open,
  definitions,
  existingIds,
  onAdd,
  onClose,
}: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [creating, setCreating] = useState(false)

  const availableDefinitions = definitions.filter(
    d => !existingIds.includes(d.id)
  )

  async function handleCreateNew() {
    if (!newName.trim() || !newDomain.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/assessment/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, domain: newDomain }),
      })

      const data = await res.json()
      if (data.definition) {
        onAdd(data.definition.id)
        setNewName('')
        setNewDomain('')
        setShowCreateForm(false)
      }
    } catch (error) {
      console.error('Failed to create definition:', error)
    } finally {
      setCreating(false)
    }
  }

  function handleClose() {
    setShowCreateForm(false)
    setNewName('')
    setNewDomain('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Add Assessment</h2>
          <p className="text-sm text-gray-500">
            Select an existing assessment or create a new one.
          </p>
        </div>

        {!showCreateForm ? (
          <div className="space-y-4">
            {availableDefinitions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Your Assessments</p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableDefinitions.map(def => (
                    <button
                      key={def.id}
                      onClick={() => onAdd(def.id)}
                      className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition"
                    >
                      <p className="font-medium">{def.name}</p>
                      <p className="text-sm text-gray-500">{def.domain}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No assessments available. Create your first one below.
              </p>
            )}

            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Create New Assessment
            </button>

            <button
              onClick={handleClose}
              className="w-full py-2 px-4 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Chess Opening Assessment"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
              <input
                id="domain"
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g., chess"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                onClick={handleCreateNew}
                disabled={creating || !newName.trim() || !newDomain.trim()}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? 'Creating...' : 'Create & Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
