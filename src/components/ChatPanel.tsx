import React, { useState, useRef, useEffect, useCallback } from 'react'
import { FaArrowUp, FaStop } from 'react-icons/fa'
import { useTheme } from '../contexts/ThemeContext'
import { useAI, AVAILABLE_MODELS } from '../contexts/AIContext'
import NexoIconDark from '../assets/nexspace-icon-dark.svg'
import NexoIconLight from '../assets/nexspace-icon-light.svg'
import './ChatPanel.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  isError?: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Welcome to NexSpace. How can I help you today?',
  timestamp: new Date(),
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

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingMessageIdRef = useRef<string | null>(null)

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

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return

    // Check if API is configured
    if (!isConfigured) {
      const errorMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Please click "Re-authenticate with Claude" in Settings, or run `claude logout && claude login` in your terminal.',
        timestamp: new Date(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMsg])
      return
    }

    // Add user message
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    // Create placeholder for assistant response
    const assistantMsgId = `msg-${Date.now() + 1}`
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    streamingMessageIdRef.current = assistantMsgId
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')

    // Send to API
    sendMessage(
      text,
      chatHistory,
      // onChunk - append streamed text
      (chunk: string) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        )
      },
      // onComplete - finalize message and update history
      () => {
        setMessages((prev) => {
          const finalMessages = prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, isStreaming: false }
              : msg
          )

          // Update chat history for context
          const assistantContent = finalMessages.find(m => m.id === assistantMsgId)?.content || ''
          if (assistantContent) {
            setChatHistory((h) => [
              ...h,
              { role: 'user', content: text },
              { role: 'assistant', content: assistantContent },
            ])
          }

          return finalMessages
        })
        streamingMessageIdRef.current = null
      },
      // onError - show error message
      (error: string) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `Error: ${error}`,
                  isStreaming: false,
                  isError: true,
                }
              : msg
          )
        )
        streamingMessageIdRef.current = null
      }
    )
  }, [input, isStreaming, isConfigured, chatHistory, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStopStreaming = () => {
    abortStream()
    if (streamingMessageIdRef.current) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingMessageIdRef.current
            ? { ...msg, isStreaming: false, content: msg.content + ' [stopped]' }
            : msg
        )
      )
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
              <div className="chat-msg__content">
                {msg.content || (msg.isStreaming && <span className="chat-msg__typing">Thinking...</span>)}
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
        {/* Model selector */}
        <div className="chat-composer__model-row">
          <select
            className="chat-composer__model-select"
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
            disabled={isStreaming}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
