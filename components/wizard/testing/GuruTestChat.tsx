'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  projectId: string;
}

const MAX_MESSAGES = 20;

// Helper to extract text content from message parts
function getMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('');
}

export function GuruTestChat({ projectId }: Props) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoize transport to prevent recreation on re-renders
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: `/api/projects/${projectId}/guru/chat`,
      }),
    [projectId]
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `guru-test-${projectId}`,
    transport,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Set initial greeting message on mount
  useEffect(() => {
    if (!isInitialized && messages.length === 0) {
      setMessages([
        {
          id: 'initial',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Hello! I\'m your guru in test mode. Feel free to ask me questions and see how I respond. You have up to 20 messages to test our conversation.',
            },
          ],
        },
      ]);
      setIsInitialized(true);
    }
  }, [isInitialized, messages.length, setMessages]);

  // Count user messages
  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const remainingMessages = MAX_MESSAGES - userMessageCount;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if limit reached
  useEffect(() => {
    if (userMessageCount >= MAX_MESSAGES) {
      setHasReachedLimit(true);
    }
  }, [userMessageCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || hasReachedLimit) return;

    sendMessage({ text: inputValue });
    setInputValue('');
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'initial',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello! I\'m your guru in test mode. Feel free to ask me questions and see how I respond. You have up to 20 messages to test our conversation.',
          },
        ],
      },
    ]);
    setInputValue('');
    setHasReachedLimit(false);
  };

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] border rounded-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm sm:text-base">Guru Test Chat</h3>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            Test Mode
          </Badge>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {userMessageCount}/{MAX_MESSAGES} messages
          </span>
          <Button variant="outline" size="sm" onClick={handleReset} className="min-h-[36px]">
            Reset
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((message) => {
          const text = getMessageText(message.parts);
          const isUser = message.role === 'user';

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 ${
                  isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="text-xs sm:text-sm whitespace-pre-wrap">{text}</div>
              </Card>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <Card className="max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 bg-muted">
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm text-muted-foreground">Guru is typing</span>
                <span className="flex gap-1">
                  <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t bg-muted/50">
        {hasReachedLimit && (
          <div className="mb-3 p-2 sm:p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-xs sm:text-sm text-amber-800">
              You've reached the maximum of {MAX_MESSAGES} messages for this test session.
              Click Reset to start a new conversation.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              hasReachedLimit
                ? 'Message limit reached. Reset to continue.'
                : 'Type your message...'
            }
            disabled={isLoading || hasReachedLimit}
            className="min-h-[60px] sm:min-h-[60px] max-h-[120px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading || hasReachedLimit}
            className="self-stretch sm:self-end min-h-[44px] sm:min-h-auto text-sm"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-2">
          {hasReachedLimit ? (
            <span className="text-amber-600 font-medium">
              {remainingMessages} messages remaining (limit reached)
            </span>
          ) : (
            <>
              {remainingMessages} message{remainingMessages !== 1 ? 's' : ''} remaining.
              <span className="hidden sm:inline"> Press Enter to send, Shift+Enter for new line.</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
