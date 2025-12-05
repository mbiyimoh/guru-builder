'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ContentViewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string
  metadata?: {
    priority?: number
    category?: string
    contentLength: number
  }
}

export function ContentViewModal({
  isOpen,
  onClose,
  title,
  content,
  metadata,
}: ContentViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          {metadata && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Metadata</h3>
                <div className="text-sm space-y-1">
                  {metadata.priority !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Priority:</span>{' '}
                      {metadata.priority}
                    </div>
                  )}
                  {metadata.category && (
                    <div>
                      <span className="text-muted-foreground">Category:</span>{' '}
                      {metadata.category}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Length:</span>{' '}
                    {metadata.contentLength.toLocaleString()} chars
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">Content</h3>
              <div className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
                {content}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
