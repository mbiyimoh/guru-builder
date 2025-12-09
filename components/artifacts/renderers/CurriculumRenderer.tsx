'use client';

import type { CurriculumOutput } from '@/lib/guruFunctions/schemas/curriculumSchema';
import { LessonCard } from './cards/LessonCard';
import type { TOCItem } from '@/lib/teaching/types/toc';

interface CurriculumRendererProps {
  content: CurriculumOutput;
  className?: string;
}

export function CurriculumRenderer({ content, className }: CurriculumRendererProps) {
  return (
    <div className={className} data-testid="curriculum-renderer">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.curriculumTitle}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            <strong>Target:</strong> {content.targetAudience}
          </span>
          <span>
            <strong>Duration:</strong> {content.estimatedDuration}
          </span>
        </div>
      </header>

      {/* Modules */}
      {content.modules.map((module, index) => (
        <section
          key={module.moduleId}
          id={`module-${module.moduleId}`}
          className="mb-12"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white bg-blue-700 px-4 py-3 rounded-r-lg border-l-8 border-blue-900 -ml-4">
              Module {index + 1}: {module.title}
            </h2>
            <p className="text-gray-600 mt-2 px-4">{module.subtitle}</p>

            {/* Learning Objectives */}
            {module.learningObjectives.length > 0 && (
              <div className="mt-4 px-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Learning Objectives
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm">
                  {module.learningObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prerequisites */}
            {module.prerequisites.length > 0 && (
              <div className="mt-3 px-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Prerequisites
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-500 text-sm">
                  {module.prerequisites.map((prereq, i) => (
                    <li key={i}>{prereq}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Lessons */}
          <div className="space-y-4 px-4">
            {module.lessons.map((lesson) => (
              <LessonCard
                key={lesson.lessonId}
                id={`lesson-${lesson.lessonId}`}
                lesson={lesson}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Learning Path */}
      {content.learningPath.recommended.length > 0 && (
        <section
          id="learning-path"
          className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            Recommended Learning Path
          </h2>
          <ol className="list-decimal list-inside text-blue-700 text-sm space-y-1">
            {content.learningPath.recommended.map((moduleId, i) => (
              <li key={i}>{moduleId}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Generate TOC items for curriculum
 */
export function generateCurriculumTOC(content: CurriculumOutput): TOCItem[] {
  const items: TOCItem[] = content.modules.map((mod) => ({
    id: `module-${mod.moduleId}`,
    label: mod.title,
    level: 1,
    children: mod.lessons.map((l) => ({
      id: `lesson-${l.lessonId}`,
      label: l.title,
      level: 2,
    })),
  }));

  if (content.learningPath.recommended.length > 0) {
    items.push({ id: 'learning-path', label: 'Learning Path', level: 1 });
  }

  return items;
}
