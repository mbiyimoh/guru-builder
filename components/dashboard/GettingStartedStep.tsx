'use client';

import Link from 'next/link';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

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
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        completed
          ? 'bg-green-50 border-green-200 dark:bg-green-950/20'
          : disabled
          ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed dark:bg-gray-900'
          : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800'
      }`}
      onClick={(e) => disabled && e.preventDefault()}
    >
      <div className={`p-2 rounded-full ${completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
        {completed ? <CheckCircle2 className="w-4 h-4" /> : icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {!completed && !disabled && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </Link>
  );
}
