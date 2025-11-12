'use client';

import { useState, useEffect } from 'react';
import type { ContextLayer } from '@prisma/client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface ContextLayerModalProps {
  projectId: string;
  layer?: ContextLayer;
  onClose: () => void;
  onSave: (data: { title: string; content: string; priority: number; isActive: boolean }) => Promise<void>;
}

export function ContextLayerModal({ projectId, layer, onClose, onSave }: ContextLayerModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { modalRef, handleKeyDown } = useModalAccessibility({
    onClose,
    isOpen: true,
  });

  // Reset form when layer changes or modal opens
  useEffect(() => {
    if (layer) {
      setTitle(layer.title);
      setContent(layer.content);
      setPriority(layer.priority);
      setIsActive(layer.isActive);
    } else {
      setTitle('');
      setContent('');
      setPriority(1);
      setIsActive(true);
    }
  }, [layer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSave({
        title,
        content,
        priority,
        isActive,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save layer:', error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
              {layer ? 'Edit Context Layer' : 'Create Context Layer'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
              aria-label="Close modal"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Core Principles"
              />
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                Priority *
              </label>
              <input
                type="number"
                id="priority"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
                min={1}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower numbers load first (1 = first, 2 = second, etc.)
              </p>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                Content *
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                maxLength={50000}
                rows={15}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Layer content (markdown supported)..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {content.length.toLocaleString()} / 50,000 characters
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                Active (include in AI context)
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : layer ? 'Save Changes' : 'Create Layer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
