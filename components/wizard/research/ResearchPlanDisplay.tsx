'use client';

import { useState } from 'react';
import type { ResearchPlan } from '@/lib/research/chat-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface ResearchPlanDisplayProps {
  plan: ResearchPlan | null;
  editing: boolean;
  onChange?: (plan: ResearchPlan) => void;
}

export function ResearchPlanDisplay({ plan, editing, onChange }: ResearchPlanDisplayProps) {
  const [localPlan, setLocalPlan] = useState<ResearchPlan | null>(plan);

  // If no plan exists
  if (!plan && !localPlan) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No research plan yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Chat with the assistant to create a research plan for your guru.
        </p>
      </div>
    );
  }

  const displayPlan = localPlan || plan;
  if (!displayPlan) return null;

  const handleFieldChange = (field: keyof ResearchPlan, value: string | string[]) => {
    if (!editing || !onChange) return;
    const updated = { ...displayPlan, [field]: value };
    setLocalPlan(updated);
    onChange(updated);
  };

  const handleAddQuery = () => {
    if (!editing || !onChange) return;
    const updated = { ...displayPlan, queries: [...displayPlan.queries, ''] };
    setLocalPlan(updated);
    onChange(updated);
  };

  const handleRemoveQuery = (index: number) => {
    if (!editing || !onChange) return;
    const updated = {
      ...displayPlan,
      queries: displayPlan.queries.filter((_, i) => i !== index),
    };
    setLocalPlan(updated);
    onChange(updated);
  };

  const handleUpdateQuery = (index: number, value: string) => {
    if (!editing || !onChange) return;
    const updated = {
      ...displayPlan,
      queries: displayPlan.queries.map((q, i) => (i === index ? value : q)),
    };
    setLocalPlan(updated);
    onChange(updated);
  };

  const handleAddFocusArea = () => {
    if (!editing || !onChange) return;
    const updated = { ...displayPlan, focusAreas: [...displayPlan.focusAreas, ''] };
    setLocalPlan(updated);
    onChange(updated);
  };

  const handleRemoveFocusArea = (index: number) => {
    if (!editing || !onChange) return;
    const updated = {
      ...displayPlan,
      focusAreas: displayPlan.focusAreas.filter((_, i) => i !== index),
    };
    setLocalPlan(updated);
    onChange(updated);
  };

  const handleUpdateFocusArea = (index: number, value: string) => {
    if (!editing || !onChange) return;
    const updated = {
      ...displayPlan,
      focusAreas: displayPlan.focusAreas.map((f, i) => (i === index ? value : f)),
    };
    setLocalPlan(updated);
    onChange(updated);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                  Plan Title
                </Label>
                <Input
                  id="title"
                  value={displayPlan.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="font-semibold"
                />
              </div>
            ) : (
              <h3 className="text-lg font-semibold text-gray-900">{displayPlan.title}</h3>
            )}
          </div>
          <div className="ml-4">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                displayPlan.depth === 'QUICK'
                  ? 'bg-green-100 text-green-800'
                  : displayPlan.depth === 'MODERATE'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {displayPlan.depth}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Objective */}
        <div>
          <Label htmlFor="objective" className="text-sm font-medium text-gray-700 mb-2 block">
            Research Objective
          </Label>
          {editing ? (
            <Textarea
              id="objective"
              value={displayPlan.objective}
              onChange={(e) => handleFieldChange('objective', e.target.value)}
              rows={3}
              className="resize-none"
            />
          ) : (
            <p className="text-sm text-gray-600">{displayPlan.objective}</p>
          )}
        </div>

        {/* Queries */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium text-gray-700">Research Queries</Label>
            {editing && (
              <Button type="button" onClick={handleAddQuery} size="sm" variant="outline">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Query
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {displayPlan.queries.map((query, index) => (
              <div key={index} className="flex items-start gap-2">
                {editing ? (
                  <>
                    <Input
                      value={query}
                      onChange={(e) => handleUpdateQuery(index, e.target.value)}
                      placeholder="Enter a research query..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => handleRemoveQuery(index)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </>
                ) : (
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-blue-600 font-medium text-sm mt-0.5">{index + 1}.</span>
                    <p className="text-sm text-gray-700 flex-1">{query}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Focus Areas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium text-gray-700">Focus Areas</Label>
            {editing && (
              <Button type="button" onClick={handleAddFocusArea} size="sm" variant="outline">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Focus Area
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {displayPlan.focusAreas.map((area, index) => (
              <div key={index}>
                {editing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={area}
                      onChange={(e) => handleUpdateFocusArea(index, e.target.value)}
                      placeholder="Focus area..."
                      className="w-48"
                    />
                    <Button
                      type="button"
                      onClick={() => handleRemoveFocusArea(index)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {area}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Expected Outcomes */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2 block">Expected Outcomes</Label>
          <ul className="space-y-1">
            {displayPlan.expectedOutcomes.map((outcome, index) => (
              <li key={index} className="flex items-start gap-2">
                <svg
                  className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-gray-700">{outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
