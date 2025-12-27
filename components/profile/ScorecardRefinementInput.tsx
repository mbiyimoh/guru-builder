'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Mic, MicOff, Loader2, Sparkles, Keyboard, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SynthesisResult } from '@/lib/guruProfile/types';

export interface ScorecardRefinementInputRef {
  setPrompt: (prompt: string) => void;
  focusInput: () => void;
}

interface ScorecardRefinementInputProps {
  existingBrainDump: string;
  onRefinementComplete: (result: SynthesisResult) => void;
  onRefinementStart?: () => void;
  disabled?: boolean;
}

export const ScorecardRefinementInput = forwardRef<
  ScorecardRefinementInputRef,
  ScorecardRefinementInputProps
>(function ScorecardRefinementInput(
  { existingBrainDump, onRefinementComplete, onRefinementStart, disabled = false },
  ref
) {
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechRecognition();

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    setPrompt: (prompt: string) => {
      setInputText(prompt);
      setInputMode('text');
      setTimeout(() => textareaRef.current?.focus(), 100);
    },
    focusInput: () => {
      textareaRef.current?.focus();
    },
  }));

  // Sync voice transcript to input
  useEffect(() => {
    if (inputMode === 'voice' && speech.transcript) {
      setInputText(prev => {
        // Append new transcript to existing text
        if (prev && !prev.endsWith(' ')) {
          return prev + ' ' + speech.transcript;
        }
        return prev + speech.transcript;
      });
    }
  }, [speech.transcript, inputMode]);

  const handleVoiceToggle = () => {
    if (speech.isListening) {
      speech.stopListening();
    } else {
      speech.resetTranscript();
      speech.startListening();
    }
  };

  const handleSubmit = async () => {
    if (!inputText.trim() || isProcessing || disabled) return;

    setIsProcessing(true);
    setError(null);
    onRefinementStart?.();

    try {
      // Combine existing brain dump with new input
      const combinedInput = existingBrainDump
        ? `${existingBrainDump}\n\n--- Additional Context ---\n${inputText.trim()}`
        : inputText.trim();

      const res = await fetch('/api/projects/synthesize-guru-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: combinedInput }),
      });

      const data = await res.json();

      if (data.success) {
        setInputText('');
        speech.resetTranscript();
        onRefinementComplete(data.profile);
      } else {
        setError(data.error?.message || 'Failed to refine profile');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const canSubmit = inputText.trim().length >= 20 && !isProcessing && !disabled;

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Improve Your Profile</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={inputMode === 'text' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setInputMode('text');
                if (speech.isListening) speech.stopListening();
              }}
              disabled={isProcessing}
              className="h-7 px-2"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </Button>
            {speech.isSupported && (
              <Button
                type="button"
                variant={inputMode === 'voice' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInputMode('voice')}
                disabled={isProcessing}
                className="h-7 px-2"
              >
                <Mic className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              inputMode === 'voice'
                ? 'Click the microphone button to start speaking...'
                : 'Tell me more about your teaching approach, experience, or the areas marked for improvement...'
            }
            className={cn(
              'min-h-[100px] resize-none bg-background',
              inputMode === 'voice' && speech.isListening && 'border-red-500 animate-pulse'
            )}
            disabled={isProcessing || (inputMode === 'voice' && speech.isListening)}
          />

          {/* Voice Controls (when in voice mode) */}
          {inputMode === 'voice' && (
            <div className="flex items-center justify-center">
              <Button
                type="button"
                variant={speech.isListening ? 'destructive' : 'default'}
                size="sm"
                onClick={handleVoiceToggle}
                disabled={isProcessing}
              >
                {speech.isListening ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Character count and error */}
          <div className="flex items-center justify-between text-xs">
            <span className={cn(
              'text-muted-foreground',
              inputText.trim().length >= 20 && 'text-green-600'
            )}>
              {inputText.trim().length} characters (min 20)
            </span>
            {speech.error && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {speech.error}
              </span>
            )}
            {error && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Refining Profile...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Improve Profile
            </>
          )}
        </Button>

        {/* Hint text */}
        <p className="text-xs text-muted-foreground text-center">
          Add details about your teaching style, experience, or expertise. Your new input will be
          combined with your original profile to create an improved version.
        </p>
      </CardContent>
    </Card>
  );
});
