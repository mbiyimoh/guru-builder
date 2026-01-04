'use client';

import { useMemo } from 'react';
import { diffLines, Change } from 'diff';

interface InlineContentDiffProps {
  originalContent: string;
  newContent: string;
}

interface DiffSegment {
  value: string;
  type: 'addition' | 'deletion' | 'unchanged';
}

function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const changes: Change[] = diffLines(oldText, newText);
  return changes.map((change) => ({
    value: change.value,
    type: change.added ? 'addition' : change.removed ? 'deletion' : 'unchanged',
  }));
}

export function InlineContentDiff({ originalContent, newContent }: InlineContentDiffProps) {
  // Memoize diff computation for performance on large content
  const segments = useMemo(
    () => computeDiff(originalContent, newContent),
    [originalContent, newContent]
  );

  // Check if there are any actual changes
  const hasChanges = segments.some(s => s.type !== 'unchanged');

  if (!hasChanges) {
    return (
      <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
        <p className="text-sm text-gray-500 italic">No changes detected</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
      <div className="text-xs text-gray-500 mb-3 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span>
          Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
          Added
        </span>
      </div>
      <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
        {segments.map((segment, index) => {
          // Create stable key based on index, type, and content hash
          const stableKey = `${index}-${segment.type}-${segment.value.slice(0, 20).replace(/\s/g, '_')}`;

          if (segment.type === 'unchanged') {
            return <span key={stableKey}>{segment.value}</span>;
          }
          if (segment.type === 'addition') {
            return (
              <span
                key={stableKey}
                className="bg-green-100 text-green-800"
              >
                {segment.value}
              </span>
            );
          }
          if (segment.type === 'deletion') {
            return (
              <span
                key={stableKey}
                className="bg-red-100 text-red-800 line-through"
              >
                {segment.value}
              </span>
            );
          }
          return null;
        })}
      </pre>
    </div>
  );
}
