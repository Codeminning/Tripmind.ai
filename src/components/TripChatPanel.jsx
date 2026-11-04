import React, { useState, useRef, useEffect } from 'react'
import {
  Send,
  Sparkles,
  Bot,
  User,
  Check,
  X,
  Undo2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  MapPin,
  Tag
} from 'lucide-react'
import {
  sendTripChatMessage,
  applyTripEdits,
  getEditDiffDetails,
  validateAndSanitizeEdits
} from '../tripChat'

export function TripChatPanel({
  trip,
  currentUser,
  onTripUpdated,
  formatLocal,
  showToast,
  initialMessage = '',
  onClearInitialMessage
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your TripMind concierge for ${trip?.destination || 'your trip'}. Ask me to modify your days (e.g. "swap Day 2 for indoor activities", "add a sunset viewpoint on Day 1"), or ask for local recommendations.`,
      edits: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [appliedEditsMap, setAppliedEditsMap] = useState({}) // messageId -> snapshot of previous trip
  const [lastUndoSnapshot, setLastUndoSnapshot] = useState(null)

  const abortControllerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Handle incoming initialMessage from companion shortcuts
  useEffect(() => {
    if (initialMessage && initialMessage.trim()) {
      setInput(initialMessage.trim())
      onClearInitialMessage?.()
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [initialMessage, onClearInitialMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Cancel in-flight request
  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setLoading(false)
      showToast?.('Chat request cancelled.')
    }
  }

  const handleSendMessage = async (textToSend) => {
    const messageText = (textToSend || input).trim()
    if (!messageText || loading) return

    if (messageText.length > 500) {
      setError('Message exceeds 500 characters. Please shorten your request.')
      return
    }

    setError(null)
    const userMsgId = `user_${Date.now()}`
    const newMessages = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: messageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]

    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const data = await sendTripChatMessage({
        trip,
        message: messageText,
        chatHistory: newMessages.slice(-6),
        token: currentUser?.token,
        signal: controller.signal
      })

      const assistantMsg = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Here are some recommendations for your itinerary.',
        edits: Array.isArray(data.edits) ? data.edits : [],
        aiGenerated: data.aiGenerated !== false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      if (err.name === 'AbortError') {
        // Handled via handleCancelRequest
        return
      }
      console.warn('Trip chat error:', err)
      setError(err.message || 'Could not communicate with the AI concierge.')
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  // Apply proposed edits to the trip
  const handleApplyEdits = (msgId, edits) => {
    if (!trip || !Array.isArray(edits) || edits.length === 0) return

    // Save previous snapshot for Undo
    const previousSnapshot = JSON.parse(JSON.stringify(trip))
    const updatedTrip = applyTripEdits(trip, edits)

    setAppliedEditsMap(prev => ({ ...prev, [msgId]: previousSnapshot }))
    setLastUndoSnapshot(previousSnapshot)

    onTripUpdated?.(updatedTrip)
    showToast?.('Itinerary updated with proposed edits! ✨')
  }

  // Undo applied edits
  const handleUndoEdits = (msgId) => {
    const snapshotToRestore = appliedEditsMap[msgId] || lastUndoSnapshot
    if (!snapshotToRestore) return

    onTripUpdated?.(snapshotToRestore)
    setAppliedEditsMap(prev => {
      const next = { ...prev }
      delete next[msgId]
      return next
    })
    setLastUndoSnapshot(null)
    showToast?.('Changes reverted to previous itinerary state. ↩️')
  }

  // Dismiss proposed edits without applying
  const handleDismissEdits = (msgId) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, edits: [], dismissed: true } : m))
    showToast?.('Proposed edits dismissed.')
  }

  const suggestedPrompts = [
    'Swap Day 2 for indoor activities 🌧️',
    'Where should I eat lunch on Day 1? 🍜',
    'Add an evening scenic viewpoint 🌅',
    'Recommend a quiet afternoon café ☕'
  ]

  return (
    <div className="trip-chat-container" role="region" aria-label="Trip AI Chat Panel">
      {/* Header Banner */}
      <div className="trip-chat-header">
        <div className="trip-chat-title-group">
          <div className="trip-chat-icon-badge" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <div>
            <h3>Chat with Your Itinerary</h3>
            <p>Ask questions, swap activities, or refine your daily schedule.</p>
          </div>
        </div>
        {lastUndoSnapshot && (
          <button
            type="button"
            className="chat-global-undo-btn"
            onClick={() => handleUndoEdits(Object.keys(appliedEditsMap)[0])}
            title="Undo the last applied itinerary changes"
          >
            <Undo2 size={14} />
            <span>Undo last change</span>
          </button>
        )}
      </div>

      {/* Suggested Quick Actions */}
      <div className="chat-suggestions-strip" role="group" aria-label="Suggested Prompts">
        {suggestedPrompts.map((promptText, idx) => (
          <button
            key={idx}
            type="button"
            className="chat-suggestion-chip"
            onClick={() => handleSendMessage(promptText)}
            disabled={loading}
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="chat-messages-scroll" tabIndex={0} aria-label="Conversation history">
        {messages.map((msg) => {
          const isUser = msg.role === 'user'
          const hasEdits = Array.isArray(msg.edits) && msg.edits.length > 0
          const isApplied = Boolean(appliedEditsMap[msg.id])

          return (
            <div
              key={msg.id}
              className={`chat-bubble-row ${isUser ? 'user-row' : 'assistant-row'}`}
            >
              <div className="chat-avatar" aria-hidden="true">
                {isUser ? (
                  currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt="" className="chat-user-img" />
                  ) : (
                    <User size={16} />
                  )
                ) : (
                  <Sparkles size={16} />
                )}
              </div>

              <div className="chat-bubble-content">
                <div className="chat-meta">
                  <span className="chat-author">{isUser ? 'You' : 'TripMind Concierge'}</span>
                  <span className="chat-time">{msg.timestamp}</span>
                </div>

                <div className="chat-text">{msg.content}</div>

                {/* Diff Box for Proposed Edits */}
                {hasEdits && (
                  <div className="chat-diff-box">
                    <div className="chat-diff-header">
                      <span className="diff-badge">Proposed Itinerary Edits ({msg.edits.length})</span>
                      {isApplied && (
                        <span className="diff-applied-tag">
                          <Check size={12} /> Applied
                        </span>
                      )}
                    </div>

                    <div className="chat-diff-items">
                      {msg.edits.map((edit, editIdx) => {
                        const diff = getEditDiffDetails(trip, edit)
                        return (
                          <div key={editIdx} className={`diff-card diff-type-${diff.type}`}>
                            <div className="diff-card-top">
                              <span className="diff-type-label">{diff.badge}</span>
                              <span className="diff-day-label">Day {edit.day}</span>
                            </div>

                            {diff.before && (
                              <div className="diff-comparison-line before-line">
                                <span className="diff-line-tag">Before:</span>
                                <span className="diff-title">{diff.before.title}</span>
                                {diff.before.time && <span className="diff-time">({diff.before.time})</span>}
                                {diff.before.cost !== undefined && formatLocal && (
                                  <span className="diff-cost">{formatLocal(diff.before.cost)}</span>
                                )}
                              </div>
                            )}

                            {diff.after && (
                              <div className="diff-comparison-line after-line">
                                <span className="diff-line-tag">After:</span>
                                <span className="diff-title">{diff.after.title}</span>
                                {diff.after.time && <span className="diff-time">({diff.after.time})</span>}
                                {diff.after.cost !== undefined && formatLocal && (
                                  <span className="diff-cost">{formatLocal(diff.after.cost)}</span>
                                )}
                              </div>
                            )}

                            {diff.type === 'remove' && diff.before && (
                              <div className="diff-remove-note">
                                Removed from Day {edit.day} schedule.
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Diff Actions */}
                    <div className="chat-diff-actions">
                      {!isApplied ? (
                        <>
                          <button
                            type="button"
                            className="button button-dark btn-sm"
                            onClick={() => handleApplyEdits(msg.id, msg.edits)}
                          >
                            <Check size={14} />
                            <span>Apply Edits</span>
                          </button>
                          <button
                            type="button"
                            className="button button-secondary btn-sm"
                            onClick={() => handleDismissEdits(msg.id)}
                          >
                            <X size={14} />
                            <span>Dismiss</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="button button-secondary btn-sm"
                          onClick={() => handleUndoEdits(msg.id)}
                        >
                          <Undo2 size={14} />
                          <span>Undo Changes</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Disclaimer underneath assistant messages */}
                {!isUser && (
                  <div className="chat-ai-disclaimer" role="note">
                    <AlertCircle size={12} aria-hidden="true" />
                    <span>AI-generated response. Live details, prices, and opening hours should be verified locally.</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Loading Indicator with Cancel Button */}
        {loading && (
          <div className="chat-bubble-row assistant-row chat-loading-row" aria-live="polite">
            <div className="chat-avatar" aria-hidden="true">
              <Sparkles size={16} />
            </div>
            <div className="chat-bubble-content">
              <div className="chat-typing-indicator">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span className="typing-text">TripMind AI is thinking...</span>
              </div>
              <button
                type="button"
                className="chat-cancel-btn"
                onClick={handleCancelRequest}
              >
                <X size={13} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="chat-error-banner" role="alert">
            <AlertCircle size={16} />
            <div className="chat-error-text">
              <strong>Could not complete request</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="chat-error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Screen Reader Live Status */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? 'TripMind AI is generating recommendations...' : ''}
      </div>

      {/* Chat Input Bar */}
      <form
        className="chat-input-bar"
        onSubmit={(e) => {
          e.preventDefault()
          handleSendMessage()
        }}
      >
        <div className="chat-input-wrapper">
          <label htmlFor="trip-chat-input" className="sr-only">
            Ask TripMind to modify your trip or suggest local spots
          </label>
          <input
            id="trip-chat-input"
            ref={inputRef}
            type="text"
            placeholder="e.g. Swap Day 2 for indoor activities, or where should I eat near the fort?"
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <div className="chat-char-counter" aria-hidden="true">
            {input.length}/500
          </div>
        </div>

        <button
          type="submit"
          className="button button-dark chat-send-btn"
          disabled={!input.trim() || loading}
          aria-label="Send message to TripMind concierge"
        >
          <Send size={16} />
          <span>Send</span>
        </button>
      </form>
    </div>
  )
}

