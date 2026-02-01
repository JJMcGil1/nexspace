import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { FaArrowUp, FaStop } from 'react-icons/fa'
import { LuChevronDown, LuChevronRight, LuCheck, LuLoader, LuCircleCheck, LuBrain, LuPaperclip, LuX } from 'react-icons/lu'
import { useTheme } from '../contexts/ThemeContext'
import { useAI, AVAILABLE_MODELS, ClaudeModel, ToolCall } from '../contexts/AIContext'
import { useCanvas } from '../contexts/CanvasContext'
import type { ChatMessage as StoredChatMessage } from '../types/electron'
import NexoIconDark from '../assets/nexspace-icon-dark.svg'
import NexoIconLight from '../assets/nexspace-icon-light.svg'
import './ChatPanel.css'

// Collapsible tool call item
const ToolCallItem: React.FC<{ tool: ToolCall }> = ({ tool }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isPending = tool.status === 'pending'
  const toolName = tool.name.replace('mcp__nexspace-canvas__', '')

  return (
    <div className={`tool-call ${isPending ? 'tool-call--pending' : 'tool-call--complete'}`}>
      <button
        type="button"
        className="tool-call__header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="tool-call__status">
          {isPending ? (
            <LuLoader className="tool-call__icon tool-call__icon--spin" />
          ) : (
            <LuCircleCheck className="tool-call__icon tool-call__icon--done" />
          )}
        </span>
        <span className="tool-call__name">{toolName}</span>
        {tool.result && (
          <LuChevronRight className={`tool-call__chevron ${isExpanded ? 'tool-call__chevron--open' : ''}`} />
        )}
      </button>
      {isExpanded && tool.result && (
        <div className="tool-call__result">
          <pre>{tool.result}</pre>
        </div>
      )}
    </div>
  )
}

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
  const [attachedImages, setAttachedImages] = useState<{ id: string; file: File; preview: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    // Debug: Check stored messages for tool calls
    const withTools = chatMessages.filter(m => m.toolCalls && m.toolCalls.length > 0)
    if (withTools.length > 0) {
      console.log(`[ChatPanel] useMemo: ${withTools.length} messages have tool calls`)
    }

    const storedMessages: Message[] = chatMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      isError: msg.isError,
      // Include persisted tool calls and thinking
      toolCalls: msg.toolCalls as ToolCall[] | undefined,
      thinking: msg.thinking,
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

  // Refs to capture tool calls and thinking for persistence (needed because setState callback can't access other state)
  const toolCallsRef = useRef<ToolCall[]>([])
  const thinkingRef = useRef<string>('')

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

  // Handle file attachment
  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .slice(0, 4 - attachedImages.length) // Max 4 images
      .map(file => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
      }))

    setAttachedImages(prev => [...prev, ...newImages].slice(0, 4))
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleRemoveImage = (id: string) => {
    setAttachedImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter(img => img.id !== id)
    })
  }

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      attachedImages.forEach(img => URL.revokeObjectURL(img.preview))
    }
  }, [])

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
    // Clear attached images after sending
    attachedImages.forEach(img => URL.revokeObjectURL(img.preview))
    setAttachedImages([])

    // Send to API with all callbacks
    // Reset refs for new message
    toolCallsRef.current = []
    thinkingRef.current = ''

    sendMessage(text, chatHistory, {
      // onChunk - append streamed text
      onChunk: (chunk: string) => {
        setStreamingMessage((prev) =>
          prev ? { ...prev, content: prev.content + chunk } : null
        )
      },
      // onToolUse - track tool call
      onToolUse: (tool: ToolCall) => {
        setStreamingToolCalls((prev) => {
          const updated = [...prev, tool]
          toolCallsRef.current = updated // Keep ref in sync
          return updated
        })
      },
      // onToolResult - update tool call with result
      onToolResult: (toolId: string, result: string) => {
        setStreamingToolCalls((prev) => {
          const updated = prev.map((t) =>
            t.id === toolId ? { ...t, result, status: 'complete' as const } : t
          )
          toolCallsRef.current = updated // Keep ref in sync
          return updated
        })
      },
      // onThinking - update thinking content
      onThinking: (thinking: string) => {
        setStreamingThinking(thinking)
        thinkingRef.current = thinking // Keep ref in sync
      },
      // onComplete - persist final message WITH tool calls and clear streaming state
      onComplete: () => {
        console.log('[ChatPanel] onComplete called')
        console.log('[ChatPanel] toolCallsRef.current:', JSON.stringify(toolCallsRef.current))
        console.log('[ChatPanel] thinkingRef.current:', thinkingRef.current?.substring(0, 50))

        // Capture refs BEFORE clearing
        const finalToolCalls = [...toolCallsRef.current]
        const finalThinking = thinkingRef.current

        // Get the streaming message ID to use
        const msgId = streamingMessageIdRef.current

        // Read streaming message state and persist
        setStreamingMessage((prev) => {
          if (prev && (prev.content || finalToolCalls.length > 0)) {
            // Build the final message to persist
            const finalMsg: StoredChatMessage = {
              id: prev.id,
              role: 'assistant',
              content: prev.content,
              timestamp: prev.timestamp.toISOString(),
              // IMPORTANT: Persist tool calls and thinking with the message
              toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
              thinking: finalThinking || undefined,
            }
            console.log('[ChatPanel] Persisting message:', finalMsg.id)
            console.log('[ChatPanel] With toolCalls:', finalMsg.toolCalls?.length || 0)
            console.log('[ChatPanel] ToolCalls data:', JSON.stringify(finalMsg.toolCalls))

            // Add to persistent storage immediately
            addChatMessage(finalMsg)
          }
          return null
        })

        // Clear streaming state (React will batch these updates)
        setStreamingToolCalls([])
        setStreamingThinking('')
        toolCallsRef.current = []
        thinkingRef.current = ''
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
            // Still persist any tool calls that happened before the error
            toolCalls: toolCallsRef.current.length > 0 ? toolCallsRef.current : undefined,
          }
          addChatMessage(errorMsg)
          return null
        })
        setStreamingToolCalls([])
        setStreamingThinking('')
        toolCallsRef.current = []
        thinkingRef.current = ''
        streamingMessageIdRef.current = null
      },
    })
  }, [input, isStreaming, isConfigured, chatHistory, sendMessage, addChatMessage, attachedImages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStopStreaming = () => {
    abortStream()
    if (streamingMessageIdRef.current && streamingMessage) {
      // Persist the partial message with [stopped] marker, including any tool calls
      const stoppedMsg: StoredChatMessage = {
        id: streamingMessage.id,
        role: 'assistant',
        content: streamingMessage.content + ' [stopped]',
        timestamp: streamingMessage.timestamp.toISOString(),
        toolCalls: toolCallsRef.current.length > 0 ? toolCallsRef.current : undefined,
        thinking: thinkingRef.current || undefined,
      }
      addChatMessage(stoppedMsg)
      setStreamingMessage(null)
      setStreamingToolCalls([])
      setStreamingThinking('')
      toolCallsRef.current = []
      thinkingRef.current = ''
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

              {/* Thinking indicator (for streaming message) */}
              {msg.isStreaming && streamingThinking && (
                <div className="chat-msg__thinking">
                  <LuBrain className="chat-msg__thinking-icon" />
                  <span className="chat-msg__thinking-text">
                    {streamingThinking.length > 100
                      ? streamingThinking.substring(0, 100) + '...'
                      : streamingThinking}
                  </span>
                </div>
              )}

              {/* Persisted thinking (for completed messages) */}
              {!msg.isStreaming && msg.thinking && (
                <div className="chat-msg__thinking chat-msg__thinking--complete">
                  <LuBrain className="chat-msg__thinking-icon" />
                  <span className="chat-msg__thinking-text">
                    {msg.thinking.length > 100
                      ? msg.thinking.substring(0, 100) + '...'
                      : msg.thinking}
                  </span>
                </div>
              )}

              {/* Tool calls - collapsible one-liners */}
              {(() => {
                const toolsToShow = msg.isStreaming ? streamingToolCalls : (msg.toolCalls || [])
                // Debug: log tool calls being rendered
                if (!msg.isStreaming && msg.toolCalls) {
                  console.log(`[ChatPanel] Render msg ${msg.id} toolCalls:`, msg.toolCalls.length, msg.toolCalls)
                }
                if (toolsToShow.length === 0) return null
                return (
                  <div className="tool-calls">
                    {toolsToShow.map((tool) => (
                      <ToolCallItem key={tool.id} tool={tool} />
                    ))}
                  </div>
                )
              })()}

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
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="chat-composer__file-input"
          />

          {/* Image previews */}
          {attachedImages.length > 0 && (
            <div className="chat-composer__images">
              {attachedImages.map(img => (
                <div key={img.id} className="chat-composer__image-preview">
                  <img src={img.preview} alt="Attached" />
                  <button
                    type="button"
                    className="chat-composer__image-remove"
                    onClick={() => handleRemoveImage(img.id)}
                    aria-label="Remove image"
                  >
                    <LuX size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

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
            {/* Left side: Model selector + Attach button */}
            <div className="chat-composer__actions-left">
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

              {/* Attach button */}
              <button
                type="button"
                className="chat-composer__attach"
                onClick={handleAttachClick}
                disabled={isStreaming || attachedImages.length >= 4}
                aria-label="Attach image"
              >
                <LuPaperclip size={16} />
              </button>
            </div>

            {/* Right side: Send/Stop button */}
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
                className={`chat-composer__send ${input.trim() || attachedImages.length > 0 ? 'chat-composer__send--active' : ''}`}
                onClick={handleSend}
                disabled={!input.trim() && attachedImages.length === 0}
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
