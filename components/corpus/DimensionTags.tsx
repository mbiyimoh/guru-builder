'use client';

import { useState, useEffect } from 'react';
import { Plus, X, HelpCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DimensionTag {
  id: string;
  dimensionKey: string;
  dimensionName: string;
  confidence: number;
  confirmedByUser: boolean;
}

interface Props {
  itemId: string;
  itemType: 'layer' | 'file';
  projectId: string;
  initialTags?: DimensionTag[];
  editable?: boolean;
}

// Color map for different dimensions
const DIMENSION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  foundations: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  progression: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' },
  mistakes: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
  examples: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' },
  nuance: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' },
  practice: { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700' },
};

const DEFAULT_COLORS = { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' };

// All available dimensions for adding
const ALL_DIMENSIONS = [
  { key: 'foundations', name: 'Foundations' },
  { key: 'progression', name: 'Progression' },
  { key: 'mistakes', name: 'Common Mistakes' },
  { key: 'examples', name: 'Examples' },
  { key: 'nuance', name: 'Nuance & Edge Cases' },
  { key: 'practice', name: 'Practice & Application' },
];

export function DimensionTags({
  itemId,
  itemType,
  projectId,
  initialTags = [],
  editable = false,
}: Props) {
  const [tags, setTags] = useState<DimensionTag[]>(initialTags);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Get colors for a dimension
  const getColors = (dimensionKey: string) => {
    return DIMENSION_COLORS[dimensionKey] || DEFAULT_COLORS;
  };

  // Confirm an unconfirmed tag
  const handleConfirm = async (tagId: string) => {
    setLoading(tagId);
    try {
      const response = await fetch(`/api/corpus-dimension-tags/${tagId}`, {
        method: 'PATCH',
      });

      if (response.ok) {
        setTags(prev =>
          prev.map(t => (t.id === tagId ? { ...t, confirmedByUser: true } : t))
        );
      }
    } catch (error) {
      console.error('Failed to confirm tag:', error);
    } finally {
      setLoading(null);
    }
  };

  // Remove a tag
  const handleRemove = async (tagId: string) => {
    setLoading(tagId);
    try {
      const response = await fetch(`/api/corpus-dimension-tags/${tagId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTags(prev => prev.filter(t => t.id !== tagId));
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
    } finally {
      setLoading(null);
    }
  };

  // Add a new tag
  const handleAdd = async (dimensionKey: string) => {
    setLoading(dimensionKey);
    setShowAddMenu(false);

    try {
      const response = await fetch('/api/corpus-dimension-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          itemId,
          itemType,
          dimensionKey,
          confirmedByUser: true, // Manually added tags are confirmed
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTags(prev => [...prev, data.tag]);
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
    } finally {
      setLoading(null);
    }
  };

  // Get dimensions that haven't been added yet
  const availableDimensions = ALL_DIMENSIONS.filter(
    d => !tags.some(t => t.dimensionKey === d.key)
  );

  if (tags.length === 0 && !editable) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map(tag => {
        const colors = getColors(tag.dimensionKey);
        const isLoading = loading === tag.id;

        return (
          <div
            key={tag.id}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium border transition-colors',
              colors.bg,
              colors.text,
              tag.confirmedByUser ? colors.border : 'border-dashed border-gray-400'
            )}
          >
            {/* Unconfirmed indicator */}
            {!tag.confirmedByUser && (
              <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
            )}

            <span>{tag.dimensionName}</span>

            {/* Confidence indicator for unconfirmed */}
            {!tag.confirmedByUser && (
              <span className="text-xs text-gray-400">
                ({Math.round(tag.confidence * 100)}%)
              </span>
            )}

            {/* Actions */}
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                {/* Confirm button for unconfirmed tags */}
                {!tag.confirmedByUser && editable && (
                  <button
                    onClick={() => handleConfirm(tag.id)}
                    className="ml-1 hover:text-green-600 transition-colors"
                    title="Confirm this tag"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Remove button */}
                {editable && (
                  <button
                    onClick={() => handleRemove(tag.id)}
                    className="ml-1 hover:text-red-600 transition-colors"
                    title="Remove tag"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Add tag button */}
      {editable && availableDimensions.length > 0 && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>

          {/* Dropdown menu */}
          {showAddMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg z-10 min-w-[180px]">
              {availableDimensions.map(dim => {
                const colors = getColors(dim.key);
                const isLoading = loading === dim.key;

                return (
                  <button
                    key={dim.key}
                    onClick={() => handleAdd(dim.key)}
                    disabled={isLoading}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2',
                      isLoading && 'opacity-50'
                    )}
                  >
                    <span
                      className={cn(
                        'w-3 h-3 rounded-full',
                        colors.bg,
                        colors.border,
                        'border'
                      )}
                    />
                    {dim.name}
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
}
