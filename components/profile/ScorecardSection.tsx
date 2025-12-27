'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ScorecardField {
  label: string;
  value: string | string[] | number | null;
  fieldKey: string;
  isLight: boolean;
}

interface ScorecardSectionProps {
  title: string;
  fields: ScorecardField[];
  onLightAreaClick: (fieldKey: string, fieldLabel: string) => void;
  defaultExpanded?: boolean;
}

export function ScorecardSection({
  title,
  fields,
  onLightAreaClick,
  defaultExpanded = false,
}: ScorecardSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate section score (100% = no light areas)
  const lightCount = fields.filter(f => f.isLight).length;
  const sectionScore = Math.round(((fields.length - lightCount) / fields.length) * 100);

  const formatValue = (value: string | string[] | number | null): string => {
    if (value === null || value === undefined) return 'Not specified';
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'None specified';
    if (typeof value === 'number') return value.toString();
    return String(value);
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Section Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          <span className="font-semibold text-sm">{title}</span>
          {lightCount > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs">
              {lightCount} area{lightCount > 1 ? 's' : ''} to improve
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 flex items-center gap-2">
            <Progress value={sectionScore} className="h-2" />
            <span className="text-xs text-muted-foreground w-8">{sectionScore}%</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Section Content - Expandable */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden',
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-4 space-y-3 border-t pt-4">
          {fields.map((field) => (
            <div
              key={field.fieldKey}
              className={cn(
                'p-3 rounded-md',
                field.isLight && 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </span>
                    {field.isLight && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLightAreaClick(field.fieldKey, field.label);
                        }}
                        className="group"
                      >
                        <Badge
                          variant="secondary"
                          className="bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100 text-xs cursor-pointer hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                        >
                          Lower Confidence - Click to improve
                        </Badge>
                      </button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {formatValue(field.value)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
