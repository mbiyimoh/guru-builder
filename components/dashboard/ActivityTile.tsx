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
      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
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
