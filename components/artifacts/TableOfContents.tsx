'use client';

import { scrollToSection } from '@/lib/teaching/hooks/useActiveSection';
import { TOCItem } from '@/lib/teaching/types/toc';

interface TableOfContentsProps {
  items: TOCItem[];
  activeId: string | null;
  className?: string;
}

export function TableOfContents({ items, activeId, className }: TableOfContentsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      className={`w-56 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto ${className || ''}`}
      aria-label="Table of contents"
      data-testid="table-of-contents"
    >
      <div className="sticky top-0 p-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Contents</h2>
        <ul className="space-y-1">
          {items.map((item) => (
            <TOCItemComponent key={item.id} item={item} activeId={activeId} />
          ))}
        </ul>
      </div>
    </nav>
  );
}

interface TOCItemComponentProps {
  item: TOCItem;
  activeId: string | null;
}

function TOCItemComponent({ item, activeId }: TOCItemComponentProps) {
  const isActive = item.id === activeId;
  const hasActiveChild = item.children?.some(
    (child) =>
      child.id === activeId || child.children?.some((gc) => gc.id === activeId)
  );

  return (
    <li>
      <button
        onClick={() => scrollToSection(item.id)}
        className={`w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
          item.level === 1 ? 'font-medium' : 'pl-4 text-gray-600'
        } ${
          isActive
            ? 'bg-blue-100 text-blue-800'
            : hasActiveChild
              ? 'text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
        }`}
        data-testid={`toc-item-${item.id}`}
      >
        {item.label}
      </button>
      {item.children && item.children.length > 0 && (
        <ul className="ml-2 space-y-0.5">
          {item.children.map((child) => (
            <TOCItemComponent key={child.id} item={child} activeId={activeId} />
          ))}
        </ul>
      )}
    </li>
  );
}
