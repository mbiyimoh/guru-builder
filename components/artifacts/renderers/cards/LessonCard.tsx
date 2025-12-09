'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { LessonTypeBadge, DifficultyBadge } from '../badges';
import type { Lesson } from '@/lib/guruFunctions/schemas/curriculumSchema';

interface LessonCardProps {
  id: string;
  lesson: Lesson;
}

export function LessonCard({ id, lesson }: LessonCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      id={id}
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid={`lesson-card-${lesson.lessonId}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <LessonTypeBadge type={lesson.type} />
              <DifficultyBadge tier={lesson.metadata.difficultyTier} />
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {lesson.metadata.estimatedMinutes} min
              </span>
            </div>
            <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
            <p className="text-gray-600 text-sm mt-1">{lesson.content.headline}</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Essence</h4>
            <p className="text-gray-600 text-sm">{lesson.content.essence}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Details</h4>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">
              {lesson.content.expandedContent}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
