'use client';

import { useState, useRef, useEffect, KeyboardEvent, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Send, Loader2, Play, Edit3 } from 'lucide-react';
import { ResearchPlanDisplay } from './ResearchPlanDisplay';
import { cn } from '@/lib/utils';
import type { ResearchPlan, ResearchChatMessage } from '@/lib/research/chat-types';
import type { GuruProfileData } from '@/lib/guruProfile/types';

interface ResearchChatAssistantProps {
  projectId: string;
  guruProfile: GuruProfileData | null;
  onExecutePlan: (plan: ResearchPlan) => void;
}

export interface ResearchChatAssistantRef {
  setInputMessage: (msg: string) => void;
}

export const ResearchChatAssistant = forwardRef<ResearchChatAssistantRef, ResearchChatAssistantProps>(
  function ResearchChatAssistant({ projectId, guruProfile, onExecutePlan }, ref) {
  const [messages, setMessages] = useState<ResearchChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm here to help you create a research plan for your teaching assistant. Let's build a plan that discovers the knowledge your guru needs.

What would you like your guru to learn about? You can describe:
- Specific topics or concepts you want covered
- Learning gaps you've identified
- Areas where your teaching domain needs more depth
- Any particular teaching dimensions (foundations, examples, common mistakes, etc.)

What should we research?`,
      timestamp: new Date(),
    },
  ]);
  const [currentPlan, setCurrentPlan] = useState<ResearchPlan | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose setInputMessage method to parent via ref
  useImperativeHandle(ref, () => ({
    setInputMessage: (msg: string) => {
      setInputMessage(msg);
      textareaRef.current?.focus();
    },
  }));

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle sending message
  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isRefining) return;

    // Add user message
    const userMessage: ResearchChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    // Call API to refine plan
    setIsRefining(true);
    try {
      const response = await fetch('/api/research/refine-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          message: trimmedMessage,
          currentPlan,
          guruProfile,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refine plan');
      }

      const data = await response.json();

      // Add assistant response
      const assistantMessage: ResearchChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update plan if provided
      if (data.updatedPlan) {
        setCurrentPlan(data.updatedPlan);
      }
    } catch (error) {
      console.error('Error refining plan:', error);
      const errorMessage: ResearchChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'I apologize, but I encountered an error processing your request. Please try again or rephrase your message.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsRefining(false);
      textareaRef.current?.focus();
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle plan changes from ResearchPlanDisplay
  const handlePlanChange = (updatedPlan: ResearchPlan) => {
    setCurrentPlan(updatedPlan);
  };

  // Handle execute plan
  const handleExecutePlan = () => {
    if (currentPlan) {
      onExecutePlan(currentPlan);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 h-auto lg:h-[calc(100vh-16rem)]">
      {/* Left Panel - Chat */}
      <Card className="flex flex-col overflow-hidden h-[500px] lg:h-auto">
        {/* Chat Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Research Assistant</h3>
          <p className="text-xs sm:text-sm text-gray-600">Chat to create and refine your research plan</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm',
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p
                  className={cn(
                    'text-xs mt-1 sm:mt-2',
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  )}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isRefining && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-gray-600" />
                  <span className="text-xs sm:text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t bg-gray-50">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              className="resize-none min-h-[60px] sm:min-h-[80px] text-sm"
              disabled={isRefining}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isRefining}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 flex-shrink-0 w-full sm:w-auto min-h-[44px]"
            >
              {isRefining ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 hidden sm:block">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>

      {/* Right Panel - Research Plan */}
      <Card className="flex flex-col overflow-hidden h-[500px] lg:h-auto">
        {/* Plan Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Research Plan</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              {currentPlan ? 'Review and execute' : 'Will appear as you chat'}
            </p>
          </div>
          {currentPlan && (
            <Button
              onClick={() => setEditingPlan(!editingPlan)}
              size="sm"
              variant="outline"
              className="gap-2 min-h-[36px] w-full sm:w-auto"
            >
              <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
              {editingPlan ? 'Done Editing' : 'Edit'}
            </Button>
          )}
        </div>

        {/* Plan Display */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          <ResearchPlanDisplay
            plan={currentPlan}
            editing={editingPlan}
            onChange={handlePlanChange}
          />
        </div>

        {/* Execute Button */}
        {currentPlan && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-gray-50">
            <Button
              onClick={handleExecutePlan}
              className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 min-h-[44px]"
              size="lg"
            >
              <Play className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">Execute Research Plan</span>
            </Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              This will start a research run using the queries and focus areas above
            </p>
          </div>
        )}
      </Card>
    </div>
  );
});
