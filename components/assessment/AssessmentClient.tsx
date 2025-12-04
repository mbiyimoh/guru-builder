'use client'

import { useState, useMemo, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'
import { renderOpeningBoard } from '@/lib/assessment/asciiBoard'
import { BackgammonMove } from '@/lib/assessment/types'
import { checkGuruMatchedBest } from '@/lib/assessment/moveComparison'
import { StarRating } from './StarRating'
import { ContextAuditModal } from './ContextAuditModal'
import { MoveDetailModal } from './MoveDetailModal'

interface Props {
  projectId: string
}

// Helper to extract text content from message parts
function getMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('')
}

export function AssessmentClient({ projectId }: Props) {
  const [diceRoll, setDiceRoll] = useState('')
  const [currentDice, setCurrentDice] = useState<string | null>(null)
  const [groundTruth, setGroundTruth] = useState<BackgammonMove[] | null>(null)
  const [isLoadingTruth, setIsLoadingTruth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastResultId, setLastResultId] = useState<string | null>(null)

  // Audit trail state
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [lastMessageId, setLastMessageId] = useState<string | null>(null)

  // Move detail modal state
  const [selectedMove, setSelectedMove] = useState<BackgammonMove | null>(null)
  const [selectedMoveRank, setSelectedMoveRank] = useState<number>(0)
  const [showMoveDetail, setShowMoveDetail] = useState(false)

  // Use ref to always have current dice value available to transport body
  const currentDiceRef = useRef<string | null>(null)

  // Memoize transport with custom fetch to capture messageId from response headers
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: `/api/projects/${projectId}/assessment/chat`,
        body: () => ({ diceRoll: currentDiceRef.current || '' }),
        fetch: async (input, init) => {
          const response = await fetch(input, init)
          const messageId = response.headers.get('X-Message-Id')
          if (messageId) {
            setLastMessageId(messageId)
          }
          return response
        },
      }),
    [projectId]
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `assessment-${projectId}`,
    transport,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  async function startProblem() {
    if (!diceRoll.match(/^[1-6]-[1-6]$/)) {
      setError('Invalid dice format. Use format like "3-1"')
      return
    }
    setError(null)
    // Sync both state and ref atomically to prevent desync
    const newDice = diceRoll
    setCurrentDice(newDice)
    currentDiceRef.current = newDice
    setGroundTruth(null)
    setMessages([])
    setLastResultId(null)

    if (!sessionId) {
      const response = await fetch(`/api/projects/${projectId}/assessment/session`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.session) {
        setSessionId(data.session.id)
      }
    }
  }

  async function fetchGroundTruth() {
    if (!currentDice) return
    setIsLoadingTruth(true)
    setError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/assessment/ground-truth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diceRoll: currentDice }),
      })
      const data = await response.json()
      if (data.error) throw new Error(data.message || data.error)
      if (!data.bestMoves || !Array.isArray(data.bestMoves)) {
        throw new Error('Invalid response: bestMoves not found')
      }
      setGroundTruth(data.bestMoves)

      if (sessionId && messages.length > 0) {
        const assistantMsg = messages.find((m) => m.role === 'assistant')
        const guruResponse = assistantMsg ? getMessageText(assistantMsg.parts) : ''

        // Only save results if guru actually responded
        if (!guruResponse) {
          setError('Guru has not responded yet. Click "Ask Guru" first, then check the answer.')
          return
        }

        const guruMatchedBest = checkGuruMatchedBest(guruResponse, data.bestMoves)

        const saveResponse = await fetch(`/api/projects/${projectId}/assessment/results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            diceRoll: currentDice,
            guruResponse,
            bestMoves: data.bestMoves,
            guruMatchedBest,
          }),
        })
        const saveData = await saveResponse.json()
        if (saveData.result?.id) {
          setLastResultId(saveData.result.id)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ground truth')
    } finally {
      setIsLoadingTruth(false)
    }
  }

  function askGuru() {
    if (!currentDice) return
    sendMessage({ text: 'What is the best move for this position?' })
  }

  function handleMoveClick(move: BackgammonMove, rank: number) {
    setSelectedMove(move)
    setSelectedMoveRank(rank)
    setShowMoveDetail(true)
  }

  return (
    <div className="space-y-6">
      {/* Dice Roll Input */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Dice Roll</label>
            <input
              type="text"
              value={diceRoll}
              onChange={(e) => setDiceRoll(e.target.value)}
              placeholder="e.g., 3-1"
              className="px-3 py-2 border rounded-md w-32"
            />
          </div>
          <button
            onClick={startProblem}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Set Problem
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {/* Split Screen: Guru vs Ground Truth */}
      {currentDice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Board + Guru Chat */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Guru Analysis</h2>
            </div>

            {/* ASCII Board */}
            <div className="p-4 bg-gray-50 border-b font-mono text-xs whitespace-pre overflow-x-auto">
              {renderOpeningBoard(currentDice.split('-').map(Number) as [number, number])}
            </div>

            {/* Chat Messages */}
            <div className="h-64 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{getMessageText(msg.parts)}</p>
                </div>
              ))}
              {isLoading && <p className="text-gray-500 text-sm">Guru is thinking...</p>}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={askGuru}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Thinking...' : 'Ask Guru'}
              </button>
            </div>
          </div>

          {/* Right: Ground Truth */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold">Ground Truth (GNU Backgammon)</h2>
              <button
                onClick={fetchGroundTruth}
                disabled={isLoadingTruth}
                className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {isLoadingTruth ? 'Loading...' : 'Check Answer'}
              </button>
            </div>

            <div className="p-4 min-h-[200px]">
              {!groundTruth && !isLoadingTruth && (
                <p className="text-gray-500">Click "Check Answer" to see engine analysis</p>
              )}
              {groundTruth && (
                <div className="space-y-3">
                  <h3 className="font-medium">Best Moves (ranked by equity):</h3>
                  <p className="text-xs text-gray-500">Click any move to see detailed analysis</p>
                  {groundTruth.slice(0, 5).map((move, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleMoveClick(move, idx + 1)}
                      className="w-full flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors cursor-pointer text-left"
                    >
                      <span className="font-mono text-sm">
                        {idx + 1}. {move.move}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${move.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {move.equity >= 0 ? '+' : ''}
                          {move.equity.toFixed(4)}
                        </span>
                        {move.evaluation && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* User Rating */}
                  {lastResultId && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Rate this response:</h4>
                      <StarRating resultId={lastResultId} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Section */}
      {messages.length > 0 && lastMessageId && (
        <>
          <div className="bg-purple-50 p-4 rounded-lg shadow-sm border border-purple-200">
            <h3 className="font-semibold mb-2 text-purple-900">🔍 Context Audit Trail</h3>
            <p className="text-sm text-purple-700 mb-3">
              View detailed information about the AI's response including token usage, costs, and reasoning traces.
            </p>
            <button
              onClick={() => setShowAuditModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
            >
              View Audit Trail
            </button>
          </div>

          <ContextAuditModal
            projectId={projectId}
            messageId={lastMessageId}
            isOpen={showAuditModal}
            onClose={() => setShowAuditModal(false)}
          />
        </>
      )}

      {/* Move Detail Modal */}
      <MoveDetailModal
        move={selectedMove}
        rank={selectedMoveRank}
        isOpen={showMoveDetail}
        onClose={() => setShowMoveDetail(false)}
      />
    </div>
  )
}
