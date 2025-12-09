'use client';

import { diffLines, Change } from 'diff';
import ReactMarkdown from 'react-markdown';

interface DiffContentProps {
  currentContent: string;
  previousContent: string | null;
  showDiff: boolean;
}

interface DiffSegment {
  value: string;
  type: 'addition' | 'deletion' | 'unchanged';
}

function computeInlineDiff(oldText: string, newText: string): DiffSegment[] {
  const changes: Change[] = diffLines(oldText, newText);
  return changes.map((change) => ({
    value: change.value,
    type: change.added ? 'addition' : change.removed ? 'deletion' : 'unchanged',
  }));
}

export default function DiffContent({
  currentContent,
  previousContent,
  showDiff,
}: DiffContentProps) {
  // If not showing diff or no previous content, render normal markdown
  if (!showDiff || !previousContent) {
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{currentContent}</ReactMarkdown>
      </div>
    );
  }

  // Compute diff
  const diffSegments = computeInlineDiff(previousContent, currentContent);

  return (
    <div className="prose prose-sm max-w-none" data-testid="diff-content">
      {diffSegments.map((segment, index) => {
        if (segment.type === 'unchanged') {
          return (
            <div key={index} className="diff-unchanged">
              <ReactMarkdown>{segment.value}</ReactMarkdown>
            </div>
          );
        }

        if (segment.type === 'addition') {
          return (
            <div
              key={index}
              className="bg-green-100 border-l-4 border-green-500 pl-2 my-1"
              data-diff-type="addition"
            >
              <ReactMarkdown>{segment.value}</ReactMarkdown>
            </div>
          );
        }

        if (segment.type === 'deletion') {
          return (
            <div
              key={index}
              className="bg-red-100 border-l-4 border-red-500 pl-2 my-1 line-through opacity-70"
              data-diff-type="deletion"
            >
              <ReactMarkdown>{segment.value}</ReactMarkdown>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
