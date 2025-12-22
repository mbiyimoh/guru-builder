'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { DiffViewer } from '@/components/recommendations/DiffViewer';

interface Recommendation {
  id: string;
  action: string;
  targetType: string;
  contextLayerId: string | null;
  knowledgeFileId: string | null;
  title: string;
  description: string;
  fullContent: string;
  reasoning: string;
  confidence: number;
  impactLevel: string;
  priority: number;
  status: string;
}

interface RecommendationsViewProps {
  recommendations: Recommendation[];
  projectId: string;
  runId: string;
}

interface ReadinessResult {
  overall: number;
  previousOverall?: number;
  criticalGaps: string[];
}

export function RecommendationsView({ recommendations, projectId, runId }: RecommendationsViewProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);

  const handleApprove = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/recommendations/${id}/approve`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to approve recommendation');
      }

      router.refresh();
    } catch (error) {
      console.error('Error approving recommendation:', error);
      alert('Failed to approve recommendation');
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/recommendations/${id}/reject`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to reject recommendation');
      }

      router.refresh();
    } catch (error) {
      console.error('Error rejecting recommendation:', error);
      alert('Failed to reject recommendation');
    } finally {
      setLoadingId(null);
    }
  };

  const handleApplyAll = async () => {
    const approvedIds = recommendations
      .filter((r) => r.status === 'APPROVED')
      .map((r) => r.id);

    if (approvedIds.length === 0) {
      alert('No approved recommendations to apply');
      return;
    }

    if (!confirm(`Apply ${approvedIds.length} approved recommendations? This will create a snapshot and update your corpus.`)) {
      return;
    }

    setApplyingAll(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/apply-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationIds: approvedIds,
          snapshotName: `Research run ${runId}`,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to apply recommendations');
      }

      const result = await res.json();

      // Store readiness result if available
      if (result.readinessScore) {
        setReadinessResult(result.readinessScore);
      }

      router.refresh();
    } catch (error) {
      console.error('Error applying recommendations:', error);
      alert(error instanceof Error ? error.message : 'Failed to apply recommendations');
    } finally {
      setApplyingAll(false);
    }
  };

  const statusCounts = {
    pending: recommendations.filter((r) => r.status === 'PENDING').length,
    approved: recommendations.filter((r) => r.status === 'APPROVED').length,
    rejected: recommendations.filter((r) => r.status === 'REJECTED').length,
    applied: recommendations.filter((r) => r.status === 'APPLIED').length,
  };

  const actionColors = {
    ADD: 'bg-green-100 text-green-800',
    EDIT: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
  };

  const impactColors = {
    LOW: 'bg-gray-100 text-gray-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
  };

  const scoreDelta = readinessResult?.previousOverall !== undefined
    ? readinessResult.overall - readinessResult.previousOverall
    : 0;

  return (
    <div className="bg-white rounded-lg border">
      {/* Readiness Result Banner - shown after apply */}
      {readinessResult && (
        <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Readiness Updated</span>
              <span
                data-testid="readiness-score"
                className="text-xl font-bold text-green-600"
              >
                {Math.round(readinessResult.overall)}%
              </span>
              {scoreDelta > 0 && (
                <span
                  data-testid="score-improvement"
                  className="flex items-center text-sm text-green-600 animate-pulse"
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +{Math.round(scoreDelta)}%
                </span>
              )}
            </div>
            {readinessResult.criticalGaps.length > 0 && (
              <span className="flex items-center text-sm text-amber-600">
                <AlertCircle className="w-4 h-4 mr-1" />
                {readinessResult.criticalGaps.length} critical gap{readinessResult.criticalGaps.length !== 1 ? 's' : ''} remaining
              </span>
            )}
          </div>
        </div>
      )}

      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recommendations</h2>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-gray-600">Pending: {statusCounts.pending}</span>
            <span className="text-green-600">Approved: {statusCounts.approved}</span>
            <span className="text-red-600">Rejected: {statusCounts.rejected}</span>
            <span className="text-blue-600">Applied: {statusCounts.applied}</span>
          </div>
        </div>
        {statusCounts.approved > 0 && (
          <button
            onClick={handleApplyAll}
            disabled={applyingAll}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {applyingAll ? 'Applying...' : `Apply ${statusCounts.approved} Approved`}
          </button>
        )}
      </div>

      <div className="divide-y">
        {recommendations.map((rec) => (
          <div key={rec.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColors[rec.action as keyof typeof actionColors]}`}>
                    {rec.action}
                  </span>
                  <span className="text-sm text-gray-500">{rec.targetType}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${impactColors[rec.impactLevel as keyof typeof impactColors]}`}>
                    {rec.impactLevel}
                  </span>
                  <span className="text-sm text-gray-500">
                    Confidence: {(rec.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{rec.title}</h3>

                {/* Description - always visible */}
                <p className="text-gray-700 mb-3">{rec.description}</p>

                {/* Full Content Preview - expandable */}
                {rec.action === 'EDIT' && (rec.contextLayerId || rec.knowledgeFileId) ? (
                  <details
                    className="mb-3"
                    onToggle={(e) => {
                      const isOpen = (e.target as HTMLDetailsElement).open;
                      setExpandedDiffs(prev => {
                        const next = new Set(prev);
                        if (isOpen) next.add(rec.id);
                        else next.delete(rec.id);
                        return next;
                      });
                    }}
                  >
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-sm">
                      View Changes ({Math.ceil(rec.fullContent.length / 1000)}k characters)
                    </summary>
                    <div className="mt-3">
                      <DiffViewer
                        targetType={rec.targetType as 'LAYER' | 'KNOWLEDGE_FILE'}
                        targetId={(rec.contextLayerId || rec.knowledgeFileId)!}
                        proposedContent={rec.fullContent}
                        isExpanded={expandedDiffs.has(rec.id)}
                      />
                    </div>
                  </details>
                ) : (
                  <details className="mb-3">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-sm">
                      View Full {rec.action === 'ADD' ? 'Proposed' : rec.action === 'DELETE' ? 'Content to Delete' : 'Content'}
                      {' '}({Math.ceil(rec.fullContent.length / 1000)}k characters)
                    </summary>
                    <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                        {rec.fullContent}
                      </pre>
                    </div>
                  </details>
                )}

                {/* Reasoning */}
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Reasoning:</span> {rec.reasoning}
                  </p>
                </div>
              </div>
            </div>

            {rec.status === 'PENDING' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(rec.id)}
                  disabled={loadingId === rec.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(rec.id)}
                  disabled={loadingId === rec.id}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  Reject
                </button>
              </div>
            )}

            {rec.status !== 'PENDING' && (
              <div className="flex items-center">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    rec.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : rec.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {rec.status}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
