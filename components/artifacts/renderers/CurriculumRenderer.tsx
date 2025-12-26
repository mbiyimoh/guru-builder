'use client';

import type { CurriculumOutput, PrincipleUnit } from '@/lib/guruFunctions/schemas/curriculumSchema';
import { LessonCard } from './cards/LessonCard';
import type { TOCItem } from '@/lib/teaching/types/toc';

interface CurriculumRendererProps {
  content: CurriculumOutput;
  className?: string;
}

export function CurriculumRenderer({ content, className }: CurriculumRendererProps) {
  // Guard against incomplete content (during generation or on error)
  if (!content || !content.universalPrinciplesModule || !content.phaseModules) {
    return (
      <div className={className} data-testid="curriculum-renderer">
        <div className="p-8 text-center text-gray-500">
          <p>Content is being generated...</p>
          <p className="text-sm mt-2">This usually takes 30-60 seconds.</p>
        </div>
      </div>
    );
  }

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

      {/* Design Rationale */}
      {content.designRationale && (
        <section id="design-rationale" className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h2 className="text-lg font-semibold text-amber-800 mb-3">
            Design Rationale
          </h2>
          <div className="space-y-2 text-sm">
            <p>
              <strong className="text-amber-700">Approaches Considered:</strong>{' '}
              <span className="text-gray-700">
                {content.designRationale.approachesConsidered.join(', ')}
              </span>
            </p>
            <p>
              <strong className="text-amber-700">Selected Approach:</strong>{' '}
              <span className="text-gray-700">{content.designRationale.selectedApproach}</span>
            </p>
            <p>
              <strong className="text-amber-700">Why This Approach:</strong>{' '}
              <span className="text-gray-700">{content.designRationale.selectionReasoning}</span>
            </p>
            {content.designRationale.engagementStrategy && (
              <p>
                <strong className="text-amber-700">Engagement Strategy:</strong>{' '}
                <span className="text-gray-700">{content.designRationale.engagementStrategy}</span>
              </p>
            )}
            {content.designRationale.progressionLogic && (
              <p>
                <strong className="text-amber-700">Progression Logic:</strong>{' '}
                <span className="text-gray-700">{content.designRationale.progressionLogic}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Universal Principles Module (taught FIRST) */}
      <section id="universal-principles" className="mb-12">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white bg-purple-700 px-4 py-3 rounded-r-lg border-l-8 border-purple-900 -ml-4">
            {content.universalPrinciplesModule.moduleTitle}
          </h2>
          <p className="text-gray-600 mt-2 px-4">
            {content.universalPrinciplesModule.moduleDescription}
          </p>
          <p className="text-sm text-gray-500 mt-1 px-4">
            {content.universalPrinciplesModule.totalLessons} lessons
          </p>
        </div>

        {/* Principle Units */}
        <div className="space-y-8 px-4">
          {content.universalPrinciplesModule.principleUnits.map((unit) => (
            <PrincipleUnitSection key={unit.principleId} unit={unit} />
          ))}
        </div>
      </section>

      {/* Phase Modules */}
      {content.phaseModules.map((phaseModule, index) => (
        <section
          key={phaseModule.phase}
          id={`phase-${phaseModule.phase.toLowerCase()}`}
          className="mb-12"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white bg-blue-700 px-4 py-3 rounded-r-lg border-l-8 border-blue-900 -ml-4">
              {phaseModule.phaseTitle}
            </h2>
            <p className="text-gray-600 mt-2 px-4">{phaseModule.phaseDescription}</p>
            <p className="text-sm text-gray-500 mt-1 px-4">
              {phaseModule.totalLessons} lessons
            </p>
          </div>

          {/* Phase Intro Lesson */}
          {phaseModule.phaseIntroLesson && (
            <div className="mb-6 px-4">
              <LessonCard
                id={`lesson-${phaseModule.phaseIntroLesson.lessonId}`}
                lesson={phaseModule.phaseIntroLesson}
              />
            </div>
          )}

          {/* Principle Units */}
          <div className="space-y-8 px-4">
            {phaseModule.principleUnits.map((unit) => (
              <PrincipleUnitSection key={unit.principleId} unit={unit} />
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
            {content.learningPath.recommended.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Render a principle unit with its lessons
 */
function PrincipleUnitSection({ unit }: { unit: PrincipleUnit }) {
  return (
    <div id={`principle-${unit.principleId}`} className="border-l-4 border-gray-300 pl-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">
        {unit.principleName}
      </h3>
      <p className="text-sm text-gray-600 mb-4">{unit.principleDescription}</p>
      <div className="space-y-4">
        {unit.lessons.map((lesson) => (
          <LessonCard
            key={lesson.lessonId}
            id={`lesson-${lesson.lessonId}`}
            lesson={lesson}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Generate TOC items for curriculum
 * Returns empty array if content is null/undefined or incomplete (mid-generation)
 */
export function generateCurriculumTOC(content: CurriculumOutput | null | undefined): TOCItem[] {
  // Guard against null/undefined content (happens during generation or on error)
  if (!content || !content.universalPrinciplesModule || !content.phaseModules) {
    return [];
  }

  const items: TOCItem[] = [];

  // Add Design Rationale to TOC if present
  if (content.designRationale) {
    items.push({ id: 'design-rationale', label: 'Design Rationale', level: 1 });
  }

  // Universal Principles Module
  const universalChildren: TOCItem[] = content.universalPrinciplesModule.principleUnits.flatMap(
    (unit) => [
      {
        id: `principle-${unit.principleId}`,
        label: unit.principleName,
        level: 2,
        children: unit.lessons.map((lesson) => ({
          id: `lesson-${lesson.lessonId}`,
          label: lesson.title,
          level: 3,
        })),
      },
    ]
  );

  items.push({
    id: 'universal-principles',
    label: content.universalPrinciplesModule.moduleTitle,
    level: 1,
    children: universalChildren,
  });

  // Phase Modules
  content.phaseModules.forEach((phaseModule) => {
    const phaseChildren: TOCItem[] = [];

    // Add phase intro lesson if present
    if (phaseModule.phaseIntroLesson) {
      phaseChildren.push({
        id: `lesson-${phaseModule.phaseIntroLesson.lessonId}`,
        label: phaseModule.phaseIntroLesson.title,
        level: 2,
      });
    }

    // Add principle units
    phaseModule.principleUnits.forEach((unit) => {
      phaseChildren.push({
        id: `principle-${unit.principleId}`,
        label: unit.principleName,
        level: 2,
        children: unit.lessons.map((lesson) => ({
          id: `lesson-${lesson.lessonId}`,
          label: lesson.title,
          level: 3,
        })),
      });
    });

    items.push({
      id: `phase-${phaseModule.phase.toLowerCase()}`,
      label: phaseModule.phaseTitle,
      level: 1,
      children: phaseChildren,
    });
  });

  if (content.learningPath.recommended.length > 0) {
    items.push({ id: 'learning-path', label: 'Learning Path', level: 1 });
  }

  return items;
}
