'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface TeachingPageHeaderProps {
  projectId: string;
  advancedMode: boolean;
  onAdvancedModeChange: (enabled: boolean) => void;
}

export function TeachingPageHeader({
  projectId,
  advancedMode,
  onAdvancedModeChange,
}: TeachingPageHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-background">
      <Link
        href={`/projects/${projectId}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Project</span>
      </Link>

      <div className="flex items-center gap-2" data-tour="mode-toggle">
        <Switch
          id="advanced-mode"
          checked={advancedMode}
          onCheckedChange={onAdvancedModeChange}
          data-testid="advanced-toggle"
        />
        <Label htmlFor="advanced-mode" className="text-sm cursor-pointer">
          Advanced
        </Label>
      </div>
    </header>
  );
}
