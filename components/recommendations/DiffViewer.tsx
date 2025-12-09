'use client';

import { useState, useEffect } from 'react';
import { diffLines, Change } from 'diff';

interface DiffViewerProps {
  targetType: 'LAYER' | 'KNOWLEDGE_FILE';
  targetId: string;           // contextLayerId or knowledgeFileId
  proposedContent: string;    // rec.fullContent
  isExpanded: boolean;        // Controlled by parent <details> open state
}

interface DiffSegment {
  value: string;
  type: 'added' | 'removed' | 'unchanged';
  lineNumbers: { old?: number; new?: number }[];
}

function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const changes: Change[] = diffLines(oldText, newText);
  let oldLineNum = 1;
  let newLineNum = 1;

  return changes.map((change) => {
    const lines = change.value.split('\n').filter((_, i, arr) =>
      // Keep all lines except trailing empty string from split
      i < arr.length - 1 || arr[i] !== ''
    );

    const lineNumbers: { old?: number; new?: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (change.added) {
        lineNumbers.push({ new: newLineNum++ });
      } else if (change.removed) {
        lineNumbers.push({ old: oldLineNum++ });
      } else {
        lineNumbers.push({ old: oldLineNum++, new: newLineNum++ });
      }
    }

    return {
      value: change.value,
      type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
      lineNumbers,
    };
  });
}

export function DiffViewer({
  targetType,
  targetId,
  proposedContent,
  isExpanded
}: DiffViewerProps) {
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch when expanded and not already loaded
    if (!isExpanded || originalContent !== null || isLoading) return;

    async function fetchOriginal() {
      setIsLoading(true);
      setError(null);

      try {
        const endpoint = targetType === 'LAYER'
          ? `/api/context-layers/${targetId}`
          : `/api/knowledge-files/${targetId}`;

        const res = await fetch(endpoint);

        if (!res.ok) {
          if (res.status === 404) {
            setError('Original content no longer exists (may have been deleted)');
          } else {
            setError('Failed to load original content');
          }
          return;
        }

        const data = await res.json();
        const content = targetType === 'LAYER'
          ? data.layer.content
          : data.file.content;

        setOriginalContent(content);
      } catch (err) {
        setError('Network error loading original content');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOriginal();
  }, [isExpanded, targetType, targetId, originalContent, isLoading]);

  if (!isExpanded) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading original content...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 px-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
        {error}
        <div className="mt-2 text-gray-600">
          Showing proposed content only:
        </div>
        <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">
          {proposedContent}
        </pre>
      </div>
    );
  }

  const diffSegments = computeDiff(originalContent || '', proposedContent);

  return (
    <div className="border rounded-md overflow-hidden bg-gray-50">
      <div className="font-mono text-sm">
        {diffSegments.map((segment, segmentIndex) => {
          const lines = segment.value.split('\n');
          // Remove trailing empty string from split
          if (lines[lines.length - 1] === '') lines.pop();

          return lines.map((line, lineIndex) => {
            const lineNum = segment.lineNumbers[lineIndex];
            let bgColor = '';
            let textColor = 'text-gray-800';
            let prefix = ' ';

            if (segment.type === 'added') {
              bgColor = 'bg-green-100';
              textColor = 'text-green-800';
              prefix = '+';
            } else if (segment.type === 'removed') {
              bgColor = 'bg-red-100';
              textColor = 'text-red-800';
              prefix = '-';
            }

            return (
              <div
                key={`${segmentIndex}-${lineIndex}`}
                className={`flex ${bgColor} border-b border-gray-200 last:border-b-0`}
              >
                <span className="w-12 px-2 py-0.5 text-right text-gray-400 text-xs select-none border-r border-gray-200 bg-gray-100">
                  {lineNum?.old || ''}
                </span>
                <span className="w-12 px-2 py-0.5 text-right text-gray-400 text-xs select-none border-r border-gray-200 bg-gray-100">
                  {lineNum?.new || ''}
                </span>
                <span className={`w-6 px-1 py-0.5 text-center ${textColor} select-none`}>
                  {prefix}
                </span>
                <pre className={`flex-1 px-2 py-0.5 ${textColor} overflow-x-auto`}>
                  {line || ' '}
                </pre>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
