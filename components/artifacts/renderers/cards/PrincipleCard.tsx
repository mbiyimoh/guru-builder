'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Principle {
  id: string;
  name: string;
  essence: string;
  whyItMatters: string;
  commonMistake: string;
  recognitionPattern: string;
}

interface PrincipleCardProps {
  id: string;
  principle: Principle;
}

export function PrincipleCard({ id, principle }: PrincipleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`principle-card-${principle.id}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start justify-between hover:bg-gray-50 transition-colors"
      >
        <div>
          <h3 className="font-semibold text-gray-900">{principle.name}</h3>
          <p className="text-gray-600 mt-1">{principle.essence}</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          <div>
            <h4 className="text-sm font-medium text-blue-700 mb-1">Why It Matters</h4>
            <p className="text-gray-700 text-sm">{principle.whyItMatters}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-orange-700 mb-1">Common Mistake</h4>
            <p className="text-gray-700 text-sm">{principle.commonMistake}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-1">Recognition Pattern</h4>
            <p className="text-gray-700 text-sm">{principle.recognitionPattern}</p>
          </div>
        </div>
      )}
    </div>
  );
}
