'use client';

import type { MentalModelOutput } from '@/lib/guruFunctions/schemas/mentalModelSchema';
import { PrincipleCard } from './cards/PrincipleCard';
import type { TOCItem } from '@/lib/teaching/types/toc';

interface MentalModelRendererProps {
  content: MentalModelOutput;
  className?: string;
}

export function MentalModelRenderer({ content, className }: MentalModelRendererProps) {
  const sortedCategories = [...content.categories].sort(
    (a, b) => a.orderInLearningPath - b.orderInLearningPath
  );

  return (
    <div className={className} data-testid="mental-model-renderer">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.domainTitle}
        </h1>
        <p className="text-gray-600 leading-relaxed">{content.teachingApproach}</p>
      </header>

      {/* Categories */}
      {sortedCategories.map((category, index) => (
        <section key={category.id} id={`category-${category.id}`} className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white bg-blue-700 px-4 py-3 rounded-r-lg border-l-8 border-blue-900 -ml-4">
              {index + 1}. {category.name}
            </h2>
            <p className="text-gray-700 mt-3 px-4">{category.description}</p>
            {category.mentalModelMetaphor && (
              <blockquote className="mt-3 mx-4 px-4 py-2 bg-blue-50 border-l-4 border-blue-300 text-blue-800 italic rounded-r">
                &quot;{category.mentalModelMetaphor}&quot;
              </blockquote>
            )}
          </div>

          {/* Principles within category */}
          <div className="space-y-4 px-4">
            {category.principles.map((principle) => (
              <PrincipleCard
                key={principle.id}
                id={`principle-${principle.id}`}
                principle={principle}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Principle Connections */}
      {content.principleConnections.length > 0 && (
        <section id="connections" className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Principle Connections
          </h2>
          <ul className="space-y-2">
            {content.principleConnections.map((conn, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 text-gray-700 p-2 bg-gray-50 rounded flex-wrap"
              >
                <span className="font-medium">{conn.fromPrinciple}</span>
                <span className="text-gray-400">→</span>
                <span className="text-sm text-gray-500 italic">
                  {conn.relationship}
                </span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{conn.toPrinciple}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mastery Summary */}
      <section
        id="mastery-summary"
        className="p-4 bg-green-50 border border-green-200 rounded-lg"
      >
        <h2 className="text-lg font-semibold text-green-800 mb-2">
          Mastery Summary
        </h2>
        <p className="text-green-700">{content.masterySummary}</p>
      </section>
    </div>
  );
}

/**
 * Generate TOC items for mental model
 */
export function generateMentalModelTOC(content: MentalModelOutput): TOCItem[] {
  const sortedCategories = [...content.categories].sort(
    (a, b) => a.orderInLearningPath - b.orderInLearningPath
  );

  const items: TOCItem[] = sortedCategories.map((cat) => ({
    id: `category-${cat.id}`,
    label: cat.name,
    level: 1,
    children: cat.principles.map((p) => ({
      id: `principle-${p.id}`,
      label: p.name,
      level: 2,
    })),
  }));

  if (content.principleConnections.length > 0) {
    items.push({ id: 'connections', label: 'Connections', level: 1 });
  }
  items.push({ id: 'mastery-summary', label: 'Mastery Summary', level: 1 });

  return items;
}
