'use client';

import Link from 'next/link';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GettingStartedStepProps {
  completed: boolean;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

export function GettingStartedStep({ completed, title, description, href, icon, disabled }: GettingStartedStepProps) {
  return (
    <Link
      href={disabled ? '#' : href}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg transition-all duration-300",
        completed
          ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
          : disabled
          ? "bg-muted/50 border border-transparent opacity-50 cursor-not-allowed"
          : "bg-muted/50 border border-transparent hover:border-border"
      )}
      onClick={(e) => disabled && e.preventDefault()}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
        completed
          ? "bg-emerald-500 text-white shadow-md"
          : disabled
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
      )}>
        {completed ? <Check className="w-4 h-4" /> : icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {!completed && !disabled && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </Link>
  );
}
