'use client';

import { useState, useEffect } from 'react';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface PromptConfig {
  current: string;
  isCustom: boolean;
  default: string;
}

interface PromptEditorModalProps {
  projectId: string;
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES';
  systemPrompt: PromptConfig;
  userPrompt: PromptConfig;
  onClose: () => void;
  onSave: () => void;
  onSaveAndRegenerate: () => void;
}

const ARTIFACT_LABELS: Record<string, string> = {
  MENTAL_MODEL: 'Mental Model',
  CURRICULUM: 'Curriculum',
  DRILL_SERIES: 'Drill Series',
};

// Required and optional variables for user prompt template
const REQUIRED_VARIABLES = ['{{domain}}', '{{corpusSummary}}'];
const OPTIONAL_VARIABLES = ['{{corpusWordCount}}', '{{userNotes}}', '{{mentalModel}}', '{{curriculum}}'];

export function PromptEditorModal({
  projectId,
  artifactType,
  systemPrompt,
  userPrompt,
  onClose,
  onSave,
  onSaveAndRegenerate,
}: PromptEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'system' | 'user'>('system');
  const [editedSystem, setEditedSystem] = useState(systemPrompt.current);
  const [editedUser, setEditedUser] = useState(userPrompt.current);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const { modalRef, handleKeyDown } = useModalAccessibility({
    onClose,
    isOpen: true,
  });

  // Validate prompts for missing required variables
  useEffect(() => {
    const warnings: string[] = [];

    // Check user prompt for missing required variables
    for (const variable of REQUIRED_VARIABLES) {
      if (!editedUser.includes(variable)) {
        warnings.push(`User prompt is missing ${variable} - generation may produce unexpected results`);
      }
    }

    setValidationWarnings(warnings);
  }, [editedUser]);

  // Track if there are unsaved changes
  useEffect(() => {
    const systemChanged = editedSystem !== systemPrompt.current;
    const userChanged = editedUser !== userPrompt.current;
    setHasChanges(systemChanged || userChanged);
  }, [editedSystem, editedUser, systemPrompt.current, userPrompt.current]);

  async function handleSave(regenerate: boolean) {
    setIsSaving(true);
    try {
      // Determine if we're storing custom prompts or clearing them
      // If edited value equals default, clear the custom config
      const systemToSave = editedSystem !== systemPrompt.default ? editedSystem : null;
      const userToSave = editedUser !== userPrompt.default ? editedUser : null;

      const response = await fetch(
        `/api/projects/${projectId}/guru/prompts/${artifactType}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: systemToSave,
            userPrompt: userToSave,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to save prompts');

      if (regenerate) {
        onSaveAndRegenerate();
      } else {
        onSave();
      }
    } catch (error) {
      console.error('Failed to save prompts:', error);
      alert('Failed to save prompts. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset both prompts to defaults? This cannot be undone.')) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/guru/prompts/${artifactType}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to reset prompts');

      setEditedSystem(systemPrompt.default);
      setEditedUser(userPrompt.default);
      onSave();
    } catch (error) {
      console.error('Failed to reset prompts:', error);
      alert('Failed to reset prompts. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const isSystemModified = editedSystem !== systemPrompt.default;
  const isUserModified = editedUser !== userPrompt.default;
  const hasAnyCustom = systemPrompt.isCustom || userPrompt.isCustom;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div
          ref={modalRef}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-editor-title"
          className="relative w-full max-w-5xl transform overflow-hidden rounded-lg bg-white shadow-xl"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h3
                id="prompt-editor-title"
                className="text-lg font-semibold text-gray-900"
              >
                Edit {ARTIFACT_LABELS[artifactType]} Prompts
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Customize how content is generated for this project
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('system')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'system'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                System Prompt
                {isSystemModified && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Modified
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('user')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'user'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                User Prompt Template
                {isUserModified && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Modified
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="p-6">
            {activeTab === 'system' && (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  The system prompt establishes the AI&apos;s persona and approach. This
                  sets the tone and style for all generated content.
                </p>
                <textarea
                  value={editedSystem}
                  onChange={(e) => setEditedSystem(e.target.value)}
                  className="w-full h-96 px-4 py-3 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter system prompt..."
                  data-testid="system-prompt-editor"
                />
              </div>
            )}

            {activeTab === 'user' && (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  The user prompt template defines the task. Use these variables:{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{domain}}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{corpusSummary}}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{corpusWordCount}}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{userNotes}}'}</code>
                  {artifactType !== 'MENTAL_MODEL' && (
                    <>
                      , <code className="bg-gray-100 px-1 rounded">{'{{mentalModel}}'}</code>
                    </>
                  )}
                  {artifactType === 'DRILL_SERIES' && (
                    <>
                      , <code className="bg-gray-100 px-1 rounded">{'{{curriculum}}'}</code>
                    </>
                  )}
                </p>

                {/* Validation Warnings */}
                {validationWarnings.length > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div className="text-sm text-amber-800">
                        <p className="font-medium mb-1">Missing required variables:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {validationWarnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <textarea
                  value={editedUser}
                  onChange={(e) => setEditedUser(e.target.value)}
                  className="w-full h-96 px-4 py-3 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter user prompt template..."
                  data-testid="user-prompt-editor"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
            <button
              onClick={handleReset}
              disabled={isSaving || !hasAnyCustom}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Reset to Defaults
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving || !hasChanges}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving || !hasChanges}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save & Regenerate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
