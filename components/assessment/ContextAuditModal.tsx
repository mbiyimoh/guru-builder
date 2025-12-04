'use client'

import { useState, useEffect } from 'react'
import { AuditTrail } from '@/lib/assessment/auditStore'

interface Props {
  projectId: string
  messageId: string | null
  isOpen: boolean
  onClose: () => void
}

export function ContextAuditModal({ projectId, messageId, isOpen, onClose }: Props) {
  const [auditTrail, setAuditTrail] = useState<AuditTrail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && messageId) {
      setLoading(true)
      setError(null)
      fetch(`/api/projects/${projectId}/assessment/audit/${messageId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error)
          setAuditTrail(data.auditTrail)
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen, messageId, projectId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Context Audit Trail</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>

        {loading && <p>Loading audit data...</p>}
        {error && <p className="text-red-600">Error: {error}</p>}

        {auditTrail && (
          <div className="space-y-4">
            <section>
              <h3 className="font-semibold">Model</h3>
              <p className="font-mono text-sm">{auditTrail.model}</p>
            </section>

            <section>
              <h3 className="font-semibold">Token Usage</h3>
              <div className="font-mono text-sm">
                <p>Prompt: {auditTrail.tokens.prompt.toLocaleString()}</p>
                <p>Completion: {auditTrail.tokens.completion.toLocaleString()}</p>
                <p>Total: {auditTrail.tokens.total.toLocaleString()}</p>
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Cost</h3>
              <div className="font-mono text-sm">
                <p>Prompt: ${auditTrail.cost.prompt.toFixed(6)}</p>
                <p>Completion: ${auditTrail.cost.completion.toFixed(6)}</p>
                <p className="font-bold">Total: ${auditTrail.cost.total.toFixed(6)}</p>
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Context Layers Used</h3>
              <p>{auditTrail.contextLayers} layer(s)</p>
            </section>

            {auditTrail.reasoning && auditTrail.reasoning.length > 0 && (
              <section>
                <h3 className="font-semibold">Reasoning Traces</h3>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-60">
                  {auditTrail.reasoning.join('\n\n')}
                </pre>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
