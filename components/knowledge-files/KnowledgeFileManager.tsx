'use client';

import { useState, useEffect } from 'react';
import { KnowledgeFileModal } from './KnowledgeFileModal';
import type { KnowledgeFile } from '@prisma/client';

interface KnowledgeFileManagerProps {
  projectId: string;
}

export function KnowledgeFileManager({ projectId }: KnowledgeFileManagerProps) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [editingFile, setEditingFile] = useState<KnowledgeFile | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch files on mount
  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  async function fetchFiles() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/knowledge-files?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setFiles(data.files);
    } catch (error) {
      console.error('Failed to fetch knowledge files:', error);
      alert('Failed to load knowledge files. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(data: { title: string; description?: string; content: string; category?: string; isActive: boolean }) {
    try {
      const res = await fetch('/api/knowledge-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to create file');
      }

      await fetchFiles();
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to create file:', error);
      alert(error instanceof Error ? error.message : 'Failed to create file');
      throw error;
    }
  }

  async function handleUpdate(fileId: string, data: { title?: string; description?: string; content?: string; category?: string; isActive?: boolean }) {
    try {
      const res = await fetch(`/api/knowledge-files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Failed to update file');
      }

      await fetchFiles();
      setEditingFile(null);
    } catch (error) {
      console.error('Failed to update file:', error);
      alert(error instanceof Error ? error.message : 'Failed to update file');
      throw error;
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Are you sure you want to delete this knowledge file?')) return;

    try {
      const res = await fetch(`/api/knowledge-files/${fileId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete file');
      }

      await fetchFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Failed to delete file. Please try again.');
    }
  }

  // Group files by category
  const grouped = files.reduce((acc, file) => {
    const category = file.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(file);
    return acc;
  }, {} as Record<string, KnowledgeFile[]>);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-12">
        <p className="text-center text-gray-500">Loading knowledge files...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Knowledge Files</h2>
            <p className="text-sm text-gray-500 mt-1">
              {files.length === 0 ? 'No files yet' : `${files.length} file${files.length !== 1 ? 's' : ''} • ${files.filter(f => f.isActive).length} active`}
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Knowledge File
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No knowledge files yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first knowledge file to add reference documentation.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Create First File
          </button>
        </div>
      ) : (
        <div className="p-6">
          {Object.entries(grouped).map(([category, categoryFiles]) => (
            <div key={category} className="mb-8 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryFiles.map((file) => (
                  <div
                    key={file.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            file.isActive ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          title={file.isActive ? 'Active' : 'Inactive'}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-medium text-gray-900 truncate">
                            {file.title}
                          </h4>
                          {file.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {file.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <span>{file.content.length.toLocaleString()} chars</span>
                      <span>•</span>
                      <span>{new Date(file.updatedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingFile(file)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="flex-1 px-3 py-1.5 text-sm border border-red-300 rounded-md text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <KnowledgeFileModal
          projectId={projectId}
          onClose={() => setIsCreateOpen(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {editingFile && (
        <KnowledgeFileModal
          projectId={projectId}
          file={editingFile}
          onClose={() => setEditingFile(null)}
          onSave={(data) => handleUpdate(editingFile.id, data)}
        />
      )}
    </div>
  );
}
