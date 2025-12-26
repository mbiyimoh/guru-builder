'use client';

import { ClickableCard } from '@/components/ui/clickable-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActivityTileProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  isStatus?: boolean;
}

export function ActivityTile({ title, value, icon, href, isStatus }: ActivityTileProps) {
  return (
    <ClickableCard href={href}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-muted-foreground">{icon}</div>
          </div>
          <div className={`text-2xl font-bold ${isStatus ? 'text-base' : ''}`}>
            {isStatus ? (
              <Badge variant={value === 'Active' ? 'default' : 'secondary'}>{value}</Badge>
            ) : (
              value
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{title}</div>
        </CardContent>
      </Card>
    </ClickableCard>
  );
}
