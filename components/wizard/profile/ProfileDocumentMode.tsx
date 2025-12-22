'use client'

/**
 * ProfileDocumentMode Component
 *
 * Allows users to upload documents (PDF, DOCX, TXT) and extract text
 * for guru profile synthesis.
 */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import type { SynthesisResult } from '@/lib/guruProfile/types'

interface ProfileDocumentModeProps {
  onComplete: (result: SynthesisResult) => void
}

interface ParsedDocument {
  text: string
  metadata: {
    fileName: string
    fileType: string
    fileSize: number
    words: number
    pages?: number
  }
}

const MAX_FILE_SIZE_MB = 10
const ACCEPTED_TYPES = '.pdf,.docx,.txt'

export default function ProfileDocumentMode({ onComplete }: ProfileDocumentModeProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Handle file selection (from input or drop)
   */
  const handleFile = async (file: File) => {
    setError(null)
    setIsUploading(true)
    setParsedDoc(null)

    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`)
      }

      // Validate file type
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!['pdf', 'docx', 'txt'].includes(extension || '')) {
        throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT files.')
      }

      // Upload and parse
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/documents/parse', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to parse document')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse document')
      }

      setParsedDoc({
        text: data.text,
        metadata: data.metadata,
      })
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  /**
   * Handle drag events
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  /**
   * Trigger file input click
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  /**
   * Synthesize profile from extracted text
   */
  const handleSynthesize = async () => {
    if (!parsedDoc) return

    setIsSynthesizing(true)
    setError(null)

    try {
      const response = await fetch('/api/projects/synthesize-guru-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawInput: parsedDoc.text,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to synthesize profile')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to synthesize profile')
      }

      // Call parent callback with result
      onComplete(data.profile)
    } catch (err) {
      console.error('Synthesis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate profile')
      setIsSynthesizing(false)
    }
  }

  /**
   * Reset and allow new upload
   */
  const handleReset = () => {
    setParsedDoc(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!parsedDoc && (
        <Card
          className={`border-2 border-dashed transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            {isUploading ? (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium mb-2">Processing document...</p>
                <p className="text-sm text-muted-foreground">Extracting text content</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Upload a document</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop or click to browse
                </p>
                <Button onClick={handleBrowseClick} variant="outline">
                  Browse Files
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Supported formats: PDF, DOCX, TXT (max {MAX_FILE_SIZE_MB}MB)
                </p>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileInputChange}
              className="hidden"
            />
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Error</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Document Preview */}
      {parsedDoc && (
        <>
          <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Document parsed successfully
                  </p>
                  <div className="text-sm text-green-700 dark:text-green-300 mt-2 space-y-1">
                    <p>
                      <FileText className="w-3 h-3 inline mr-1" />
                      {parsedDoc.metadata.fileName}
                    </p>
                    <p>
                      {parsedDoc.metadata.words.toLocaleString()} words
                      {parsedDoc.metadata.pages && ` • ${parsedDoc.metadata.pages} pages`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={isSynthesizing}>
                  Change File
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Text Preview */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-2">Content Preview</p>
              <div className="bg-muted/50 rounded-md p-4 max-h-[300px] overflow-y-auto">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {parsedDoc.text.slice(0, 1000)}
                  {parsedDoc.text.length > 1000 && '...'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Synthesize Button */}
          <Button
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            className="w-full"
            size="lg"
          >
            {isSynthesizing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Profile...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Profile from Document
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
