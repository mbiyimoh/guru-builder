'use client';

import { useState, useEffect } from 'react';
import { ContextLayerModal } from './ContextLayerModal';
import type { ContextLayer } from '@prisma/client';

interface ContextLayerManagerProps {
  projectId: string;
}

export function ContextLayerManager({ projectId }: ContextLayerManagerProps) {
  const [layers, setLayers] = useState<ContextLayer[]>([]);
  const [editingLayer, setEditingLayer] = useState<ContextLayer | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch layers on mount
  useEffect(() => {
    fetchLayers();
  }, [projectId]);

  async function fetchLayers() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/context-layers?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch layers');
      const data = await res.json();
      setLayers(data.layers);
    } catch (error) {
      console.error('Failed to fetch layers:', error);
      alert('Failed to load context layers. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(data: { title: string; content: string; priority: number; isActive: boolean }) {
    try {
      const res = await fetch('/api/context-layers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to create layer');
      }

      await fetchLayers();
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to create layer:', error);
      alert(error instanceof Error ? error.message : 'Failed to create layer');
      throw error;
    }
  }

  async function handleUpdate(layerId: string, data: { title?: string; content?: string; priority?: number; isActive?: boolean }) {
    try {
      const res = await fetch(`/api/context-layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to update layer');
      }

      await fetchLayers();
      setEditingLayer(null);
    } catch (error) {
      console.error('Failed to update layer:', error);
      alert(error instanceof Error ? error.message : 'Failed to update layer');
      throw error;
    }
  }

  async function handleDelete(layerId: string) {
    if (!confirm('Are you sure you want to delete this context layer?')) return;

    try {
      const res = await fetch(`/api/context-layers/${layerId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete layer');
      }

      await fetchLayers();
    } catch (error) {
      console.error('Failed to delete layer:', error);
      alert('Failed to delete layer. Please try again.');
    }
  }

  async function handleToggle(layerId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/context-layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!res.ok) throw new Error('Failed to toggle layer');

      await fetchLayers();
    } catch (error) {
      console.error('Failed to toggle layer:', error);
      alert('Failed to toggle layer. Please try again.');
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-12">
        <p className="text-center text-gray-500">Loading context layers...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Context Layers</h2>
            <p className="text-sm text-gray-500 mt-1">
              {layers.length === 0 ? 'No layers yet' : `${layers.length} layer${layers.length !== 1 ? 's' : ''} • ${layers.filter(l => l.isActive).length} active`}
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Context Layer
          </button>
        </div>
      </div>

      {layers.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No context layers yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first context layer to build your knowledge foundation.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Create First Layer
          </button>
        </div>
      ) : (
        <div className="divide-y">
          {layers.map((layer) => (
            <div key={layer.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                      layer.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={layer.isActive ? 'Active' : 'Inactive'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {layer.title}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        Priority {layer.priority}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        layer.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {layer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {layer.content.substring(0, 200)}
                      {layer.content.length > 200 && '...'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{layer.content.length.toLocaleString()} characters</span>
                      <span>•</span>
                      <span>Updated {new Date(layer.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layer.isActive}
                      onChange={(e) => handleToggle(layer.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                  <button
                    onClick={() => setEditingLayer(layer)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(layer.id)}
                    className="px-3 py-1 text-sm border border-red-300 rounded-md text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <ContextLayerModal
          projectId={projectId}
          onClose={() => setIsCreateOpen(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {editingLayer && (
        <ContextLayerModal
          projectId={projectId}
          layer={editingLayer}
          onClose={() => setEditingLayer(null)}
          onSave={(data) => handleUpdate(editingLayer.id, data)}
        />
      )}
    </div>
  );
}
