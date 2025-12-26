'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ExpandableNotesProps {
  value: string;
  onChange: (value: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  disabled?: boolean;
}

export function ExpandableNotes({
  value,
  onChange,
  expanded,
  onExpandedChange,
  disabled = false,
}: ExpandableNotesProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className={cn(
          'flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={disabled}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span>{expanded ? 'Generation notes' : 'Add generation notes...'}</span>
      </button>

      {expanded && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Optional notes to guide generation..."
          className="min-h-[80px] resize-none"
          disabled={disabled}
          data-testid="generation-notes"
        />
      )}
    </div>
  );
}
