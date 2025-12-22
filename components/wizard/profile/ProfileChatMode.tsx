'use client'

/**
 * ProfileChatMode Component
 *
 * Provides a guided chat interface for creating a guru profile.
 * AI asks follow-up questions to gather comprehensive information.
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Sparkles } from 'lucide-react'
import type { SynthesisResult } from '@/lib/guruProfile/types'

interface Message {
  role: 'assistant' | 'user'
  content: string
  timestamp: Date
}

interface ProfileChatModeProps {
  onComplete: (result: SynthesisResult) => void
}

const INITIAL_MESSAGE = `Hi! I'm here to help you create a profile for your AI teaching assistant. Let's start with the basics:

What subject or domain will your guru teach? And who is your target audience?

Feel free to share as much detail as you'd like - I'll ask follow-up questions to fill in any gaps.`

const MIN_EXCHANGES = 2 // Minimum user responses before allowing synthesis

export default function ProfileChatMode({ onComplete }: ProfileChatModeProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: INITIAL_MESSAGE,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [userResponseCount, setUserResponseCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  /**
   * Auto-scroll to bottom when new messages appear
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /**
   * Send user message and get AI follow-up
   */
  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setUserResponseCount((prev) => prev + 1)
    setIsTyping(true)

    // Simulate AI thinking and generate follow-up question
    // In a real implementation, this would call an API endpoint
    setTimeout(() => {
      const followUpQuestions = [
        "That's helpful! Could you tell me more about your teaching style? For example, do you prefer a formal or conversational tone? How do you typically explain complex concepts?",
        "Great! What are some key concepts or principles you want to emphasize? Are there any topics or approaches you'd like to avoid?",
        "Excellent detail! One more thing - what makes your teaching approach unique or particularly effective? What common misconceptions do you want your guru to address?",
        "Perfect! I think I have enough information now. Click 'Generate Profile' below to synthesize everything into a structured guru profile.",
      ]

      const responseIndex = Math.min(userResponseCount, followUpQuestions.length - 1)
      const assistantMessage: Message = {
        role: 'assistant',
        content: followUpQuestions[responseIndex],
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1500)
  }

  /**
   * Handle Enter key (with Shift+Enter for newlines)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  /**
   * Synthesize profile from conversation history
   */
  const handleGenerateProfile = async () => {
    setIsSynthesizing(true)

    try {
      // Combine all user messages into raw input
      const rawInput = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n')

      const response = await fetch('/api/projects/synthesize-guru-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawInput,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to synthesize profile')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to synthesize profile')
      }

      // Call parent callback with result
      onComplete(data.profile)
    } catch (error) {
      console.error('Synthesis error:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate profile')
      setIsSynthesizing(false)
    }
  }

  const canGenerateProfile = userResponseCount >= MIN_EXCHANGES && !isTyping

  return (
    <div className="flex flex-col h-[600px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 border rounded-lg bg-muted/20">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-background border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response... (Shift+Enter for new line)"
            className="min-h-[80px] resize-none"
            disabled={isTyping || isSynthesizing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isTyping || isSynthesizing}
            size="icon"
            className="shrink-0 h-[80px] w-[80px]"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {canGenerateProfile && (
          <Button
            onClick={handleGenerateProfile}
            disabled={isSynthesizing}
            className="w-full"
            size="lg"
          >
            {isSynthesizing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Profile...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Profile
              </>
            )}
          </Button>
        )}

        {userResponseCount < MIN_EXCHANGES && (
          <p className="text-sm text-muted-foreground text-center">
            Please provide at least {MIN_EXCHANGES} responses before generating a profile
          </p>
        )}
      </div>
    </div>
  )
}
