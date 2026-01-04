'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefinementInputProps {
  recommendationId: string;
  currentContent: string;
  disabled?: boolean;
  onRefinementStart?: (content: string) => void;
  onRefinementComplete: () => void;
}

const EXAMPLE_PROMPTS = [
  'Make it more concise',
  'Add more examples for beginners',
  'Change the tone to be more conversational',
];

const MAX_CHARS = 2000;
const RECOMMENDED_CHARS = 500;

export function RefinementInput({
  recommendationId,
  currentContent,
  disabled = false,
  onRefinementStart,
  onRefinementComplete,
}: RefinementInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const minHeight = 80;
    const maxHeight = 160;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [prompt]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleRefine = async () => {
    if (!prompt.trim() || isRefining || disabled) return;

    // Notify parent that refinement is starting (for diff tracking)
    onRefinementStart?.(currentContent);

    setIsRefining(true);
    setError(null);

    try {
      const response = await fetch(`/api/recommendations/${recommendationId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refinementPrompt: prompt.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refine recommendation');
      }

      await response.json();
      onRefinementComplete();
      setPrompt('');
      setIsExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRefining(false);
    }
  };

  const handleCancel = () => {
    setPrompt('');
    setError(null);
    setIsExpanded(false);
  };

  const charCount = prompt.length;
  const isOverRecommended = charCount > RECOMMENDED_CHARS;
  const isOverMax = charCount > MAX_CHARS;

  if (disabled) {
    return null;
  }

  return (
    <div className="border rounded-lg bg-gray-50 overflow-hidden">
      {/* Collapsed Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between text-left',
          'hover:bg-gray-100 transition-colors',
          isExpanded && 'border-b'
        )}
        disabled={isRefining}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">
            {isRefining ? 'Refining recommendation...' : 'Refine this recommendation'}
          </span>
        </div>
        {isRefining ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        ) : isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && !isRefining && (
        <div className="px-4 py-4 space-y-4">
          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe how you&apos;d like to adjust this recommendation:
            </label>
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Make it more concise and focus on the key principles..."
              className={cn(
                'resize-none text-sm',
                isOverMax && 'border-red-500 focus:ring-red-500'
              )}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                {isOverRecommended && !isOverMax && (
                  <span className="text-amber-600">Consider keeping under {RECOMMENDED_CHARS} chars for best results</span>
                )}
                {isOverMax && (
                  <span className="text-red-600">Exceeds maximum length</span>
                )}
              </p>
              <p className={cn(
                'text-xs',
                isOverMax ? 'text-red-600' : isOverRecommended ? 'text-amber-600' : 'text-gray-500'
              )}>
                {charCount}/{MAX_CHARS}
              </p>
            </div>
          </div>

          {/* Example Prompts */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Examples:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  &quot;{example}&quot;
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRefine}
              disabled={!prompt.trim() || isOverMax}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Refine
            </Button>
          </div>
        </div>
      )}

      {/* Refining State */}
      {isRefining && (
        <div className="px-4 py-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Applying your changes...</p>
          {prompt && (
            <p className="text-xs text-gray-500 mt-2 italic">
              &quot;{prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
