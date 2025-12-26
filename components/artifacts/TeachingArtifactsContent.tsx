// components/artifacts/TeachingArtifactsContent.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, X, AlertCircle } from 'lucide-react';
import { ArtifactListSidebar } from './ArtifactListSidebar';
import { ArtifactDetailPanel } from './ArtifactDetailPanel';
import { ReadinessWarning } from './ReadinessWarning';
import { AccuracyToolsPanel } from './AccuracyToolsPanel';
import type { ArtifactSummariesResponse } from '@/lib/teaching/artifactClient';

type ArtifactTypeKey = 'mental-model' | 'curriculum' | 'drill-series' | null;

interface Props {
  projectId: string;
  initialArtifacts: ArtifactSummariesResponse;
  readinessScore?: number;
}

export function TeachingArtifactsContent({
  projectId,
  initialArtifacts,
  readinessScore
}: Props) {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [selectedType, setSelectedType] = useState<ArtifactTypeKey>(null);
  const [generating, setGenerating] = useState<ArtifactTypeKey>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling for generation updates
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchArtifacts = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/guru/artifacts`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      setArtifacts(data);
      return data;
    }
    return null;
  }, [projectId]);

  // Poll while generating
  useEffect(() => {
    if (generating) {
      pollingRef.current = setInterval(async () => {
        const data = await fetchArtifacts();
        if (!data) return;

        // Check if generation completed
        // Must check corpusHash to ensure content is actually available (async job race condition)
        const apiKeyMap: Record<string, 'mentalModel' | 'curriculum' | 'drillSeries'> = {
          'mental-model': 'mentalModel',
          'curriculum': 'curriculum',
          'drill-series': 'drillSeries',
        };
        const apiKey = apiKeyMap[generating];
        const artifact = data?.latest?.[apiKey];

        // Wait for BOTH status completion AND content availability (corpusHash indicates content is ready)
        if (artifact?.status === 'COMPLETED') {
          if (artifact.corpusHash) {
            setGenerating(null);
          }
          // else: artifact marked complete but content not yet available, continue polling
        } else if (artifact?.status === 'FAILED') {
          setGenerating(null);
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [generating, fetchArtifacts]);

  const handleGenerate = (type: ArtifactTypeKey) => {
    if (!type) return;
    setGenerating(type);
    setSelectedType(type);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg" data-testid="mobile-menu-button">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0" data-testid="mobile-drawer">
            <ArtifactListSidebar
              artifacts={artifacts}
              selectedType={selectedType}
              onSelect={(type) => {
                setSelectedType(type);
                setMobileDrawerOpen(false);
              }}
              generating={generating}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-80 border-r flex-shrink-0">
        <ArtifactListSidebar
          artifacts={artifacts}
          selectedType={selectedType}
          onSelect={setSelectedType}
          generating={generating}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AccuracyToolsPanel projectId={projectId} />

        {readinessScore !== undefined && readinessScore < 60 && (
          <ReadinessWarning projectId={projectId} score={readinessScore} />
        )}

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-destructive/60 hover:text-destructive flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <ArtifactDetailPanel
          projectId={projectId}
          artifacts={artifacts}
          selectedType={selectedType}
          generating={generating}
          onGenerate={handleGenerate}
          advancedMode={advancedMode}
          onAdvancedModeChange={setAdvancedMode}
          onRefresh={fetchArtifacts}
          onError={setError}
        />
      </div>
    </div>
  );
}
