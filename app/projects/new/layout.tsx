import { ReactNode } from 'react';
import { WizardNavigation } from '@/components/wizard/WizardNavigation';

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <WizardNavigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
