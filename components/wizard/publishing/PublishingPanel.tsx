'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Share2, Copy, ExternalLink, Eye, Trash2, Loader2, Check } from 'lucide-react';

interface PublishStatus {
  isPublished: boolean;
  shortId: string | null;
  publicUrl: string | null;
  publishedAt: string | null;
  revokedAt: string | null;
  viewCount: number;
}

interface Props {
  projectId: string;
}

export default function PublishingPanel({ projectId }: Props) {
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch publish status on mount
  useEffect(() => {
    fetchStatus();
  }, [projectId]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/publish`);

      if (!response.ok) {
        throw new Error('Failed to fetch publish status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load publish status');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/publish`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to publish guru');
      }

      const data = await response.json();

      // Update status with new data
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish guru');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/publish`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke publishing');
      }

      await fetchStatus();
      setShowRevokeDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke publishing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!status?.publicUrl) return;

    const fullUrl = `${window.location.origin}${status.publicUrl}`;

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy URL to clipboard');
    }
  };

  const handleOpenInNewTab = () => {
    if (!status?.publicUrl) return;
    window.open(status.publicUrl, '_blank');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Publish Your Guru
          </CardTitle>
          <CardDescription>
            Make your guru publicly accessible via a shareable link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {!status?.isPublished ? (
            // Not published state
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens when you publish?</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Your guru gets a unique public URL</li>
                  <li>Anyone with the link can view your guru's profile and materials</li>
                  <li>You can revoke access at any time</li>
                  <li>View counts are tracked automatically</li>
                </ul>
              </div>

              <Button
                onClick={handlePublish}
                disabled={actionLoading}
                className="w-full"
                size="lg"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Publish Guru
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Published state
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex items-center gap-2 text-green-900 font-medium mb-2">
                  <Check className="h-5 w-5" />
                  Your guru is live!
                </div>
                <p className="text-sm text-green-800">
                  Published on {status.publishedAt ? new Date(status.publishedAt).toLocaleDateString() : 'Unknown'}
                </p>
              </div>

              {/* Public URL Display */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Public URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${status.publicUrl}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyUrl}
                    title="Copy URL"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* View Count */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Eye className="h-4 w-4" />
                <span>{status.viewCount} {status.viewCount === 1 ? 'view' : 'views'}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleOpenInNewTab}
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRevokeDialog(true)}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revoke
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Publishing?</DialogTitle>
            <DialogDescription>
              This will make your guru inaccessible to the public. The URL will stop working,
              but you can re-publish it later if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokeDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Publishing'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
