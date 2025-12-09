'use client';

export type ViewMode = 'rendered' | 'markdown' | 'json';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

const modes: { value: ViewMode; label: string }[] = [
  { value: 'rendered', label: 'Rendered' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
];

export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={`flex rounded-lg bg-gray-100 p-1 ${className || ''}`}
      role="tablist"
    >
      {modes.map(({ value, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === value
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid={`view-mode-${value}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
