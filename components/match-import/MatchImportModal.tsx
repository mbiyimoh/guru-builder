'use client'

/**
 * MatchImportModal - Modal for uploading match archive files
 *
 * Supports JellyFish .txt/.mat format files up to 50MB.
 * Triggers async import job via Inngest on submit.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Upload, FileText, AlertCircle } from 'lucide-react'

interface MatchImportModalProps {
  engineId: string
  isOpen: boolean
  onClose: () => void
  onImportStarted: (importId: string) => void
}

const SOURCE_COLLECTIONS = [
  { value: '', label: 'Select collection...' },
  { value: "Hardy's", label: "Hardy's Backgammon Pages" },
  { value: 'BigBrother', label: 'Big Brother Collection' },
  { value: 'LittleSister', label: 'LittleSister Collection' },
  { value: 'Other', label: 'Other' }
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function MatchImportModal({
  engineId,
  isOpen,
  onClose,
  onImportStarted
}: MatchImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sourceCollection, setSourceCollection] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const validateFile = (selectedFile: File): string | null => {
    const name = selectedFile.name.toLowerCase()
    if (!name.endsWith('.txt') && !name.endsWith('.mat')) {
      return 'Only .txt and .mat files are supported'
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      return `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
    }
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validationError = validateFile(selectedFile)
      if (validationError) {
        setError(validationError)
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const validationError = validateFile(droppedFile)
      if (validationError) {
        setError(validationError)
        setFile(null)
        return
      }
      setFile(droppedFile)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('engineId', engineId)
      formData.append('sourceCollection', sourceCollection)

      const res = await fetch('/api/match-import', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import failed')
      }

      const data = await res.json()
      onImportStarted(data.importId)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setSourceCollection('')
    setError(null)
    setDragActive(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Match Archive
          </DialogTitle>
          <DialogDescription>
            Upload a JellyFish .txt or .mat file to import tournament positions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${file ? 'bg-green-50 border-green-300' : ''}
            `}
          >
            <input
              type="file"
              accept=".txt,.mat"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {file ? (
              <div className="flex items-center justify-center gap-2 text-green-700">
                <FileText className="h-6 w-6" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-green-600">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">
                <Upload className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">Drop your match file here</p>
                <p className="text-sm">or click to browse (.txt, .mat)</p>
              </div>
            )}
          </div>

          {/* Source collection */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Source Collection
            </label>
            <select
              value={sourceCollection}
              onChange={(e) => setSourceCollection(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {SOURCE_COLLECTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Optional - helps organize imported positions
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || isUploading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Start Import'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
