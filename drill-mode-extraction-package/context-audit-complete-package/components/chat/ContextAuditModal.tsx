'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuditTrail } from '@/lib/types'
import { ContentViewModal } from './ContentViewModal'

interface ContextAuditModalProps {
  messageId: string | null
  isOpen: boolean
  onClose: () => void
}

export function ContextAuditModal({
  messageId,
  isOpen,
  onClose,
}: ContextAuditModalProps) {
  const [auditTrail, setAuditTrail] = useState<AuditTrail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewContent, setViewContent] = useState<{
    title: string
    content: string
    metadata?: {
      priority?: number
      category?: string
      contentLength: number
    }
  } | null>(null)

  useEffect(() => {
    if (!isOpen || !messageId) {
      setAuditTrail(null)
      setError(null)
      return
    }

    const fetchAuditTrail = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/audit/${messageId}`)

        if (!response.ok) {
          throw new Error('Failed to fetch audit trail')
        }

        const data: AuditTrail = await response.json()
        setAuditTrail(data)
      } catch (err) {
        console.error('Failed to fetch audit trail:', err)
        setError('Failed to load audit information')
      } finally {
        setLoading(false)
      }
    }

    fetchAuditTrail()
  }, [isOpen, messageId])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Context Audit Trail</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading audit information...
          </div>
        )}

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {auditTrail && (
          <div className="space-y-4">
            {/* Model Information */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Model</h3>
                <p className="text-sm text-muted-foreground">
                  {auditTrail.model}
                </p>
              </CardContent>
            </Card>

            {/* Token Usage */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Token Usage</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prompt:</span>
                    <span className="font-mono">
                      {auditTrail.tokens.prompt.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completion:</span>
                    <span className="font-mono">
                      {auditTrail.tokens.completion.toLocaleString()}
                    </span>
                  </div>
                  {auditTrail.tokens.reasoning && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reasoning:</span>
                      <span className="font-mono">
                        {auditTrail.tokens.reasoning.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-medium">Total:</span>
                    <span className="font-mono font-medium">
                      {auditTrail.tokens.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Cost Breakdown</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prompt:</span>
                    <span className="font-mono">
                      ${auditTrail.cost.prompt.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completion:</span>
                    <span className="font-mono">
                      ${auditTrail.cost.completion.toFixed(6)}
                    </span>
                  </div>
                  {auditTrail.cost.reasoning && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reasoning:</span>
                      <span className="font-mono">
                        ${auditTrail.cost.reasoning.toFixed(6)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-medium">Total:</span>
                    <span className="font-mono font-medium">
                      ${auditTrail.cost.total.toFixed(6)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reasoning Traces */}
            {auditTrail.reasoning && auditTrail.reasoning.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-2">Reasoning Traces</h3>
                  <div className="space-y-2">
                    {auditTrail.reasoning.map((trace, idx) => (
                      <div
                        key={idx}
                        className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap"
                      >
                        {trace}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Context Layers */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Context Layers Used</h3>
                {auditTrail.contextLayers.length > 0 ? (
                  <div className="space-y-2">
                    {auditTrail.contextLayers.map((layer) => (
                      <button
                        key={layer.id}
                        onClick={() => {
                          setViewContent({
                            title: layer.name,
                            content: `[Content preview not available in audit trail]\n\nThis context layer was loaded during the AI response. To view the full content, visit the Layers page.`,
                            metadata: {
                              priority: layer.priority,
                              contentLength: layer.contentLength,
                            },
                          })
                          setViewModalOpen(true)
                        }}
                        className="w-full text-left text-sm p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{layer.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {layer.contentLength.toLocaleString()} chars
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Priority: {layer.priority}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No context layers loaded
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Knowledge Files */}
            {auditTrail.knowledgeFiles && auditTrail.knowledgeFiles.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-2">Knowledge Files Referenced</h3>
                  <div className="space-y-2">
                    {auditTrail.knowledgeFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => {
                          setViewContent({
                            title: file.title,
                            content: `[Content preview not available in audit trail]\n\nThis knowledge file (${file.category}) was loaded during the AI response. Full content viewing requires API integration.`,
                            metadata: {
                              category: file.category,
                              contentLength: file.contentLength,
                            },
                          })
                          setViewModalOpen(true)
                        }}
                        className="w-full text-left text-sm p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{file.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {file.contentLength.toLocaleString()} chars
                          </span>
                        </div>
                        {file.category && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Category: {file.category}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timestamp */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Timestamp</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(auditTrail.timestamp).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Content View Modal */}
        {viewContent && (
          <ContentViewModal
            isOpen={viewModalOpen}
            onClose={() => {
              setViewModalOpen(false)
              setViewContent(null)
            }}
            title={viewContent.title}
            content={viewContent.content}
            metadata={viewContent.metadata}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
