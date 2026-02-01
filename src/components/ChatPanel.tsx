import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { FaArrowUp, FaStop } from 'react-icons/fa'
import { LuChevronDown, LuCheck } from 'react-icons/lu'
import { useTheme } from '../contexts/ThemeContext'
import { useAI, AVAILABLE_MODELS, ClaudeModel, ToolCall } from '../contexts/AIContext'
import { useCanvas } from '../contexts/CanvasContext'
import type { ChatMessage as StoredChatMessage } from '../types/electron'
import NexoIconDark from '../assets/nexspace-icon-dark.svg'
import NexoIconLight from '../assets/nexspace-icon-light.svg'
import './ChatPanel.css'

// Unique ID generator to avoid React key collisions
let messageIdCounter = 0
const generateMessageId = () => `msg-${Date.now()}-${++messageIdCounter}`

// UI message with runtime state (isStreaming is not persisted)
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  isError?: boolean
  toolCalls?: ToolCall[]
  thinking?: string
}

// For Claude CLI context (minimal)
interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

const ASSISTANT_NAME = 'Nexo'

interface ChatPanelProps {
  isOpen: boolean
  isFullWidth: boolean
  width: number
  isResizing: boolean
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, isFullWidth, width, isResizing }) => {
  const { theme } = useTheme()
  const { sendMessage, isStreaming, abortStream, isConfigured, model, setModel } = useAI()
  const { chatMessages, addChatMessage, updateChatMessage, currentNexSpaceId } = useCanvas()

  // Local state for streaming message (not persisted until complete)
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null)
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([])
  const [streamingThinking, setStreamingThinking] = useState<string>('')
  const [input, setInput] = useState('')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

  // Clear any streaming state when switching nexspaces
  // This prevents messages from "bleeding" between nexspaces
  useEffect(() => {
    console.log('[ChatPanel] NexSpace changed to:', currentNexSpaceId)
    setStreamingMessage(null)
    setStreamingToolCalls([])
    setStreamingThinking('')
  }, [currentNexSpaceId])

  // Convert stored messages to UI messages
  // Use currentNexSpaceId in dependency to ensure re-render on nexspace switch
  const messages = useMemo((): Message[] => {
    const storedMessages: Message[] = chatMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      isError: msg.isError,
    }))

    // Append streaming message ONLY if it's not already persisted
    // This prevents duplicate rendering during the React state transition
    if (streamingMessage && !storedMessages.some(m => m.id === streamingMessage.id)) {
      return [...storedMessages, streamingMessage]
    }

    return storedMessages
  }, [chatMessages, streamingMessage, currentNexSpaceId])

  // Build chat history for Claude CLI context
  const chatHistory = useMemo((): ChatHistoryMessage[] => {
    return chatMessages
      .filter(msg => !msg.isError)
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }))
  }, [chatMessages])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingMessageIdRef = useRef<string | null>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  const NexoIcon = theme === 'dark' ? NexoIconDark : NexoIconLight

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isModelDropdownOpen])

  const handleModelSelect = (modelId: ClaudeModel) => {
    setModel(modelId)
    setIsModelDropdownOpen(false)
  }

  const currentModel = AVAILABLE_MODELS.find(m => m.id === model) || AVAILABLE_MODELS[0]

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return

    // Check if API is configured
    if (!isConfigured) {
      const errorMsg: StoredChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: 'Please click "Re-authenticate with Claude" in Settings, or run `claude logout && claude login` in your terminal.',
        timestamp: new Date().toISOString(),
        isError: true,
      }
      addChatMessage(errorMsg)
      return
    }

    // Add user message to persistent storage
    const userMsg: StoredChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMsg)

    // Create placeholder for assistant response (local streaming state)
    const assistantMsgId = generateMessageId()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    streamingMessageIdRef.current = assistantMsgId
    setStreamingMessage(assistantMsg)
    setStreamingToolCalls([])
    setStreamingThinking('')
    setInput('')

    // Send to API with all callbacks
    sendMessage(text, chatHistory, {
      // onChunk - append streamed text
      onChunk: (chunk: string) => {
        setStreamingMessage((prev) =>
          prev ? { ...prev, content: prev.content + chunk } : null
        )
      },
      // onToolUse - track tool call
      onToolUse: (tool: ToolCall) => {
        setStreamingToolCalls((prev) => [...prev, tool])
      },
      // onToolResult - update tool call with result
      onToolResult: (toolId: string, result: string) => {
        setStreamingToolCalls((prev) =>
          prev.map((t) =>
            t.id === toolId ? { ...t, result, status: 'complete' as const } : t
          )
        )
      },
      // onThinking - update thinking content
      onThinking: (thinking: string) => {
        setStreamingThinking(thinking)
      },
      // onComplete - persist final message and clear streaming state
      onComplete: () => {
        console.log('[ChatPanel] onComplete called')
        setStreamingMessage((prev) => {
          if (prev && prev.content) {
            const finalMsg: StoredChatMessage = {
              id: prev.id,
              role: 'assistant',
              content: prev.content,
              timestamp: prev.timestamp.toISOString(),
            }
            addChatMessage(finalMsg)
          }
          return null
        })
        setStreamingToolCalls([])
        setStreamingThinking('')
        streamingMessageIdRef.current = null
      },
      // onError - persist error message
      onError: (error: string) => {
        setStreamingMessage((prev) => {
          const errorMsg: StoredChatMessage = {
            id: prev?.id || generateMessageId(),
            role: 'assistant',
            content: `Error: ${error}`,
            timestamp: new Date().toISOString(),
            isError: true,
          }
          addChatMessage(errorMsg)
          return null
        })
        setStreamingToolCalls([])
        setStreamingThinking('')
        streamingMessageIdRef.current = null
      },
    })
  }, [input, isStreaming, isConfigured, chatHistory, sendMessage, addChatMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStopStreaming = () => {
    abortStream()
    if (streamingMessageIdRef.current && streamingMessage) {
      // Persist the partial message with [stopped] marker
      const stoppedMsg: StoredChatMessage = {
        id: streamingMessage.id,
        role: 'assistant',
        content: streamingMessage.content + ' [stopped]',
        timestamp: streamingMessage.timestamp.toISOString(),
      }
      addChatMessage(stoppedMsg)
      setStreamingMessage(null)
      streamingMessageIdRef.current = null
    }
  }

  const panelClasses = [
    'chat-panel',
    !isOpen && 'chat-panel--closed',
    isFullWidth && 'chat-panel--full-width',
    isResizing && 'chat-panel--resizing',
  ].filter(Boolean).join(' ')

  const style = !isFullWidth && isOpen ? { flexBasis: `${width}px` } : undefined

  return (
    <div className={panelClasses} style={style}>
      {/* Messages */}
      <div className="chat-panel__messages">
        {/* Empty state when no messages */}
        {messages.length === 0 && (
          <div className="chat-panel__empty">
            <div className="chat-panel__empty-icon">
              <img src={NexoIcon} alt="Nexo" className="chat-panel__empty-avatar" />
            </div>
            <h3 className="chat-panel__empty-title">Start a conversation</h3>
            <p className="chat-panel__empty-text">
              Ask Nexo to help you build, organize, or explore your ideas on the canvas.
            </p>
            <div className="chat-panel__empty-suggestions">
              <button
                type="button"
                className="chat-panel__empty-chip"
                onClick={() => setInput('Add a document node')}
              >
                Add a document node
              </button>
              <button
                type="button"
                className="chat-panel__empty-chip"
                onClick={() => setInput("What's on my canvas?")}
              >
                What's on my canvas?
              </button>
              <button
                type="button"
                className="chat-panel__empty-chip"
                onClick={() => setInput('Help me brainstorm ideas')}
              >
                Help me brainstorm
              </button>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-msg chat-msg--${msg.role} ${msg.isError ? 'chat-msg--error' : ''}`}
          >
            <div className="chat-msg__avatar">
              {msg.role === 'user' ? (
                'U'
              ) : (
                <img src={NexoIcon} alt="Nexo" className="chat-msg__avatar-icon" />
              )}
            </div>
            <div className="chat-msg__body">
              <div className="chat-msg__meta">
                <span className="chat-msg__role">
                  {msg.role === 'user' ? 'You' : ASSISTANT_NAME}
                </span>
                <span className="chat-msg__time">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Thinking indicator (only for streaming message) */}
              {msg.isStreaming && streamingThinking && (
                <div className="chat-msg__thinking">
                  <span className="chat-msg__thinking-icon">🧠</span>
                  <span className="chat-msg__thinking-text">
                    {streamingThinking.length > 100
                      ? streamingThinking.substring(0, 100) + '...'
                      : streamingThinking}
                  </span>
                </div>
              )}

              {/* Tool calls (only for streaming message) */}
              {msg.isStreaming && streamingToolCalls.length > 0 && (
                <div className="chat-msg__tools">
                  {streamingToolCalls.map((tool) => (
                    <div key={tool.id} className={`chat-msg__tool chat-msg__tool--${tool.status}`}>
                      <div className="chat-msg__tool-header">
                        <span className="chat-msg__tool-icon">
                          {tool.status === 'pending' ? '⏳' : '✅'}
                        </span>
                        <span className="chat-msg__tool-name">
                          {tool.name.replace('mcp__nexspace-canvas__', '')}
                        </span>
                      </div>
                      {tool.result && (
                        <div className="chat-msg__tool-result">
                          {tool.result.length > 200
                            ? tool.result.substring(0, 200) + '...'
                            : tool.result}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="chat-msg__content">
                {msg.content || (msg.isStreaming && !streamingThinking && streamingToolCalls.length === 0 && (
                  <span className="chat-msg__typing">Thinking...</span>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="chat-composer">
        <div className="chat-composer__container">
          <textarea
            ref={textareaRef}
            className="chat-composer__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConfigured ? 'Message Nexo...' : 'Authenticate with Claude in Settings...'}
            rows={1}
            disabled={isStreaming}
          />
          <div className="chat-composer__actions">
            {/* Model selector dropdown */}
            <div className="model-dropdown" ref={modelDropdownRef}>
              <button
                className={`model-dropdown__trigger ${isModelDropdownOpen ? 'model-dropdown__trigger--open' : ''}`}
                onClick={() => !isStreaming && setIsModelDropdownOpen(!isModelDropdownOpen)}
                disabled={isStreaming}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isModelDropdownOpen}
              >
                <span className="model-dropdown__label">{currentModel.name}</span>
                <LuChevronDown className={`model-dropdown__chevron ${isModelDropdownOpen ? 'model-dropdown__chevron--open' : ''}`} />
              </button>
              {isModelDropdownOpen && (
                <div className="model-dropdown__menu" role="listbox">
                  {AVAILABLE_MODELS.map((m) => (
                    <button
                      key={m.id}
                      className={`model-dropdown__item ${m.id === model ? 'model-dropdown__item--selected' : ''}`}
                      onClick={() => handleModelSelect(m.id)}
                      role="option"
                      aria-selected={m.id === model}
                      type="button"
                    >
                      <div className="model-dropdown__item-content">
                        <span className="model-dropdown__item-name">{m.name}</span>
                        <span className="model-dropdown__item-desc">{m.description}</span>
                      </div>
                      {m.id === model && <LuCheck className="model-dropdown__item-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Send/Stop button */}
            {isStreaming ? (
              <button
                className="chat-composer__send chat-composer__send--stop"
                onClick={handleStopStreaming}
                aria-label="Stop"
                type="button"
              >
                <FaStop size={10} />
              </button>
            ) : (
              <button
                className={`chat-composer__send ${input.trim() ? 'chat-composer__send--active' : ''}`}
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Send"
                type="button"
              >
                <FaArrowUp size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
