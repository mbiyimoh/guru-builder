'use client';

import { ClickableCard } from '@/components/ui/clickable-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActivityTileProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  colorScheme?: 'blue' | 'amber' | 'purple' | 'green';
  isStatus?: boolean;
}

// Refined pastel color palette - soft, intentional tones
const colorSchemes = {
  blue: {
    iconBg: 'bg-sky-50 dark:bg-sky-950/50',
    iconColor: 'text-sky-500 dark:text-sky-400',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/50',
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
  purple: {
    iconBg: 'bg-violet-50 dark:bg-violet-950/50',
    iconColor: 'text-violet-500 dark:text-violet-400',
  },
  green: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
  },
};

export function ActivityTile({ title, value, icon, href, colorScheme, isStatus }: ActivityTileProps) {
  const scheme = colorSchemes[colorScheme ?? 'blue'];

  return (
    <ClickableCard href={href}>
      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between mb-2">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", scheme.iconBg, scheme.iconColor)}>
              {icon}
            </div>
          </div>
          <div className={`text-2xl font-bold ${isStatus ? 'text-base' : ''}`}>
            {isStatus ? (
              <Badge variant={value === 'Active' ? 'default' : 'secondary'}>{value}</Badge>
            ) : (
              value
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{title}</div>
        </CardContent>
      </Card>
    </ClickableCard>
  );
}
