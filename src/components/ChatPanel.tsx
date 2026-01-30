import React, { useState, useRef, useEffect } from 'react'
import { IoSend } from 'react-icons/io5'
import './ChatPanel.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Welcome to NexSpace. How can I help you today?',
  timestamp: new Date(),
}

interface ChatPanelProps {
  isOpen: boolean
  isFullWidth: boolean
  width: number
  isResizing: boolean
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, isFullWidth, width, isResizing }) => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    // Simulated assistant echo (no AI wired up yet)
    const assistantMsg: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: `Received: "${text}"\n\nThis is a placeholder response. AI integration is not connected yet.`,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const panelClasses = [
    'chat-panel',
    !isOpen && 'chat-panel--closed',
    isFullWidth && 'chat-panel--full-width',
    isResizing && 'chat-panel--resizing',
  ].filter(Boolean).join(' ')

  // Apply custom width only when both panels are open and not in full-width mode
  const style = !isFullWidth && isOpen ? { flexBasis: `${width}px` } : undefined

  return (
    <div className={panelClasses} style={style}>
      {/* Messages */}
      <div className="chat-panel__messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-msg chat-msg--${msg.role}`}
          >
            <div className="chat-msg__avatar">
              {msg.role === 'user' ? 'U' : 'N'}
            </div>
            <div className="chat-msg__body">
              <div className="chat-msg__meta">
                <span className="chat-msg__role">
                  {msg.role === 'user' ? 'You' : 'NexSpace'}
                </span>
                <span className="chat-msg__time">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="chat-msg__content">{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-panel__input-area">
        <textarea
          className="chat-panel__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
        />
        <button
          className="chat-panel__send"
          onClick={handleSend}
          disabled={!input.trim()}
          aria-label="Send message"
        >
          <IoSend size={16} />
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
