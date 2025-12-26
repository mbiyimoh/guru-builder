/**
 * DomainToolsPrompt Component
 *
 * Modal/step shown after profile creation to suggest GT enablement.
 * Detects if user is creating a guru for a domain with available
 * verification tools (e.g., backgammon) and prompts them to enable.
 *
 * Features:
 * - Domain-specific messaging
 * - Lists benefits with checkmarks
 * - "Enable Now" creates ProjectGroundTruthConfig record
 * - "Skip for Now" proceeds without enabling
 */
'use client';

import { useState } from 'react';
import { Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DomainDetectionResult } from '@/lib/domainDetection';

interface DomainToolsPromptProps {
  projectId: string;
  detectedDomain: DomainDetectionResult;
  onEnable: () => Promise<void>;
  onSkip: () => void;
}

export function DomainToolsPrompt({
  projectId,
  detectedDomain,
  onEnable,
  onSkip,
}: DomainToolsPromptProps) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async () => {
    setIsEnabling(true);
    setError(null);

    try {
      // Create GT config
      const res = await fetch(`/api/projects/${projectId}/ground-truth-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          engineId: detectedDomain.suggestedEngine?.id,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to enable verification');
      }

      await onEnable();
    } catch (err) {
      console.error('Enable error:', err);
      setError('Failed to enable. Please try again.');
      setIsEnabling(false);
    }
  };

  const domainTitle = detectedDomain.domain?.toUpperCase() ?? 'SPECIALIZED';
  const engineName = detectedDomain.suggestedEngine?.name ?? 'verification engine';
  const engineDescription = detectedDomain.suggestedEngine?.description;

  return (
    <div className="p-6 bg-background border rounded-lg shadow-lg max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">
            We noticed you&apos;re creating a {domainTitle} guru!
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-4">
        Would you like to enable expert move verification?
      </p>

      <p className="text-sm mb-4">
        This connects your guru to <strong>{engineName}</strong>
        {engineDescription && (
          <span className="text-muted-foreground">
            , {engineDescription.toLowerCase()}
          </span>
        )}
        . Your drills will include:
      </p>

      {/* Benefits */}
      <ul className="space-y-2 mb-6">
        <li className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Mathematically verified correct moves</span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Real game positions generated via AI self-play</span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Accurate equity calculations</span>
        </li>
      </ul>

      {/* Error message */}
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button onClick={handleEnable} disabled={isEnabling} className="flex-1">
          {isEnabling ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enabling...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Enable Now
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onSkip} disabled={isEnabling}>
          Skip for Now
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        You can always enable this later from the Teaching Artifacts page.
      </p>
    </div>
  );
}
