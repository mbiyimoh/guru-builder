'use client';

import { useState, useEffect } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SynthesisResult } from '@/lib/guruProfile/types';

interface ProfileVoiceModeProps {
  projectId: string;
  onComplete: (result: SynthesisResult) => void;
  onCancel: () => void;
}

export function ProfileVoiceMode({ projectId, onComplete, onCancel }: ProfileVoiceModeProps) {
  const { isListening, transcript, isSupported, error, startListening, stopListening, resetTranscript } =
    useSpeechRecognition();

  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'stopped'>('idle');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // Handle browser support check
  if (!isSupported) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Voice Input Not Supported
          </CardTitle>
          <CardDescription>
            Your browser doesn't support voice input. Please use Chrome, Edge, or another Chromium-based browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Voice input requires the Web Speech API, which is currently only available in:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Google Chrome (desktop & mobile)</li>
              <li>Microsoft Edge</li>
              <li>Opera</li>
            </ul>
            <p className="text-sm text-gray-600">
              Safari and Firefox don't currently support this feature. Please switch to a supported browser or
              use the text input mode instead.
            </p>
            <div className="pt-4">
              <Button onClick={onCancel} variant="outline">
                Back to Text Input
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle start recording
  const handleStartRecording = () => {
    resetTranscript();
    setSynthesisError(null);
    setRecordingState('recording');
    startListening();
  };

  // Handle stop recording
  const handleStopRecording = () => {
    stopListening();
    setRecordingState('stopped');
  };

  // Handle re-record
  const handleReRecord = () => {
    resetTranscript();
    setSynthesisError(null);
    setRecordingState('idle');
  };

  // Handle generate profile
  const handleGenerateProfile = async () => {
    if (!transcript.trim()) {
      setSynthesisError('No transcript available. Please record your input first.');
      return;
    }

    setIsSynthesizing(true);
    setSynthesisError(null);

    try {
      const response = await fetch('/api/projects/synthesize-guru-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawInput: transcript,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to synthesize profile');
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Synthesis failed');
      }

      // Call onComplete with the synthesized profile
      onComplete(data.profile);
    } catch (err) {
      console.error('Synthesis error:', err);
      setSynthesisError(err instanceof Error ? err.message : 'Failed to generate profile');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-blue-500" />
          Voice Input Mode
        </CardTitle>
        <CardDescription>
          Describe your teaching assistant in your own words. Speak naturally about what you want to teach, who
          your students are, and your teaching approach.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recording Controls */}
        {recordingState === 'idle' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Button
              onClick={handleStartRecording}
              size="lg"
              className="h-24 w-24 rounded-full bg-blue-600 hover:bg-blue-700"
            >
              <Mic className="h-10 w-10" />
            </Button>
            <p className="text-sm text-gray-600">Click the microphone to start recording</p>
          </div>
        )}

        {recordingState === 'recording' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="relative">
              <Button
                onClick={handleStopRecording}
                size="lg"
                className="h-24 w-24 rounded-full bg-red-600 hover:bg-red-700"
              >
                <MicOff className="h-10 w-10" />
              </Button>
              <div className="absolute -inset-2 rounded-full bg-red-500 opacity-75 animate-ping" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm font-medium text-red-600">Recording...</p>
            </div>
            <p className="text-sm text-gray-600">Click again to stop recording</p>
          </div>
        )}

        {/* Live Transcription */}
        {isListening && transcript && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <div className="flex items-start gap-2">
              <Mic className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Live Transcription</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{transcript}</p>
              </div>
            </div>
          </div>
        )}

        {/* Final Transcript */}
        {recordingState === 'stopped' && transcript && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-green-900 mb-2">Recording Complete</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{transcript}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button onClick={handleReRecord} variant="outline" disabled={isSynthesizing}>
                <Mic className="h-4 w-4 mr-2" />
                Re-record
              </Button>
              <Button
                onClick={handleGenerateProfile}
                disabled={isSynthesizing || !transcript.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Profile...
                  </>
                ) : (
                  'Generate Profile'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {(error || synthesisError) && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-900">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error || synthesisError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Button */}
        <div className="pt-4 border-t">
          <Button onClick={onCancel} variant="outline" disabled={isSynthesizing}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
