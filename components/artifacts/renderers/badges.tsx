// Lesson Type Badge
type LessonType = 'CONCEPT' | 'EXAMPLE' | 'CONTRAST' | 'PRACTICE';

const lessonTypeStyles: Record<LessonType, string> = {
  CONCEPT: 'bg-blue-100 text-blue-800',
  EXAMPLE: 'bg-green-100 text-green-800',
  CONTRAST: 'bg-orange-100 text-orange-800',
  PRACTICE: 'bg-purple-100 text-purple-800',
};

export function LessonTypeBadge({ type }: { type: LessonType }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${lessonTypeStyles[type]}`}
      data-testid={`lesson-type-${type.toLowerCase()}`}
    >
      {type}
    </span>
  );
}

// Difficulty Tier Badge
type DifficultyTier = 'FOUNDATION' | 'EXPANSION' | 'MASTERY';

const difficultyStyles: Record<DifficultyTier, { bg: string; icon: string }> = {
  FOUNDATION: { bg: 'bg-emerald-100 text-emerald-800', icon: '🌱' },
  EXPANSION: { bg: 'bg-amber-100 text-amber-800', icon: '🌿' },
  MASTERY: { bg: 'bg-red-100 text-red-800', icon: '🌳' },
};

export function DifficultyBadge({ tier }: { tier: DifficultyTier }) {
  const style = difficultyStyles[tier];
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${style.bg}`}
      data-testid={`difficulty-${tier.toLowerCase()}`}
    >
      {style.icon} {tier}
    </span>
  );
}

// Drill Tier Badge
type DrillTier = 'RECOGNITION' | 'APPLICATION' | 'TRANSFER';

const tierStyles: Record<DrillTier, { bg: string; label: string }> = {
  RECOGNITION: { bg: 'bg-yellow-100 text-yellow-800', label: 'Recognize' },
  APPLICATION: { bg: 'bg-blue-100 text-blue-800', label: 'Apply' },
  TRANSFER: { bg: 'bg-green-100 text-green-800', label: 'Transfer' },
};

export function TierBadge({ tier }: { tier: DrillTier }) {
  const style = tierStyles[tier];
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${style.bg}`}
      data-testid={`tier-${tier.toLowerCase()}`}
    >
      {style.label}
    </span>
  );
}
