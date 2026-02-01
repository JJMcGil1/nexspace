import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

// Claude CLI model aliases - these are the canonical aliases supported by the CLI
export type ClaudeModel = 'opus' | 'sonnet' | 'haiku'

export interface ModelInfo {
  id: ClaudeModel
  name: string
  description: string
}

// Models available via Claude CLI (using simple aliases)
export const AVAILABLE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet', description: 'Fast and intelligent (default)' },
  { id: 'opus', name: 'Opus', description: 'Most capable, best for complex tasks' },
  { id: 'haiku', name: 'Haiku', description: 'Fastest responses' },
]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Tool call tracking
export interface ToolCall {
  id: string
  name: string
  input: unknown
  result?: string
  status: 'pending' | 'complete'
}

// Streaming event callbacks
export interface StreamCallbacks {
  onChunk: (chunk: string) => void
  onToolUse: (tool: ToolCall) => void
  onToolResult: (toolId: string, result: string) => void
  onThinking: (thinking: string) => void
  onComplete: () => void
  onError: (error: string) => void
}

type AuthStatus = 'checking' | 'authenticated' | 'not_authenticated' | 'token_expired' | 'error'

interface AIContextValue {
  authStatus: AuthStatus
  checkAuth: () => Promise<void>
  refreshAuth: () => Promise<void>
  model: ClaudeModel
  setModel: (model: ClaudeModel) => void
  isConfigured: boolean
  isStreaming: boolean
  sendMessage: (
    message: string,
    history: ChatMessage[],
    callbacks: StreamCallbacks
  ) => void
  abortStream: () => void
}

// ═══════════════════════════════════════════════════════════
// Storage Keys
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY_MODEL = 'nexspace-claude-model'

// ═══════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════

const AIContext = createContext<AIContextValue | undefined>(undefined)

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [token, setToken] = useState<string | null>(null)

  const [model, setModelState] = useState<ClaudeModel>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_MODEL)
    if (stored && AVAILABLE_MODELS.some(m => m.id === stored)) {
      return stored as ClaudeModel
    }
    return 'sonnet'
  })

  const [isStreaming, setIsStreaming] = useState(false)

  // Check for Claude CLI token
  const checkAuth = useCallback(async () => {
    setAuthStatus('checking')
    try {
      const result = await window.electronAPI.claude.getToken()
      if (result.success && result.token) {
        setToken(result.token)
        setAuthStatus('authenticated')
      } else {
        setToken(null)
        setAuthStatus('not_authenticated')
      }
    } catch {
      setToken(null)
      setAuthStatus('error')
    }
  }, [])

  // Refresh auth - prompts user to re-authenticate
  const refreshAuth = useCallback(async () => {
    await window.electronAPI.claude.login()
    // After login prompt, check auth again
    await checkAuth()
  }, [checkAuth])

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const setModel = useCallback((newModel: ClaudeModel) => {
    setModelState(newModel)
    localStorage.setItem(STORAGE_KEY_MODEL, newModel)
  }, [])

  const isConfigured = authStatus === 'authenticated' && Boolean(token)

  const abortStream = useCallback(() => {
    // TODO: Implement IPC-based abort if needed
    setIsStreaming(false)
  }, [])

  const sendMessage = useCallback(
    async (
      message: string,
      history: ChatMessage[],
      callbacks: StreamCallbacks
    ) => {
      const { onChunk, onToolUse, onToolResult, onThinking, onComplete, onError } = callbacks

      // Claude CLI handles its own authentication
      if (authStatus !== 'authenticated') {
        onError('Not authenticated. Please run "claude login" in your terminal.')
        return
      }

      setIsStreaming(true)
      console.log('[AIContext] Setting up stream listeners...')

      // Track if we've already completed to prevent double-firing
      let hasCompleted = false

      // Text chunks
      const unsubChunk = window.electronAPI.claude.onStreamChunk((chunk: string) => {
        console.log('[AIContext] Received chunk, length:', chunk.length)
        onChunk(chunk)
      })

      // Tool usage events
      const unsubToolUse = window.electronAPI.claude.onToolUse((tool) => {
        console.log('[AIContext] Tool use:', tool.name)
        onToolUse({
          id: tool.id,
          name: tool.name,
          input: tool.input,
          status: 'pending'
        })
      })

      // Tool result events
      const unsubToolResult = window.electronAPI.claude.onToolResult((result) => {
        console.log('[AIContext] Tool result for:', result.tool_use_id)
        onToolResult(result.tool_use_id, result.content)
      })

      // Thinking events
      const unsubThinking = window.electronAPI.claude.onThinking((thinking) => {
        console.log('[AIContext] Thinking:', thinking.substring(0, 50))
        onThinking(thinking)
      })

      // Stream end
      const unsubEnd = window.electronAPI.claude.onStreamEnd(() => {
        console.log('[AIContext] Stream ended, hasCompleted:', hasCompleted)
        if (hasCompleted) {
          console.warn('[AIContext] DUPLICATE stream-end blocked!')
          return
        }
        hasCompleted = true
        // Cleanup all listeners
        unsubChunk()
        unsubToolUse()
        unsubToolResult()
        unsubThinking()
        unsubEnd()
        setIsStreaming(false)
        onComplete()
      })

      try {
        // Convert history to Claude format
        const messages = [
          ...history,
          { role: 'user' as const, content: message }
        ]

        // Send message via IPC (main process uses Claude CLI)
        console.log('[AIContext] Calling sendMessage with model:', model)
        const result = await window.electronAPI.claude.sendMessage({
          messages,
          model,
        })
        console.log('[AIContext] sendMessage result:', result)

        if (!result.success) {
          unsubChunk()
          unsubToolUse()
          unsubToolResult()
          unsubThinking()
          unsubEnd()
          setIsStreaming(false)

          if (result.error === 'token_expired') {
            setAuthStatus('token_expired')
            onError('Your Claude token has expired. Please click "Re-authenticate with Claude" in Settings to get a fresh token.')
          } else {
            onError(result.message || 'An error occurred')
          }
        }
      } catch (error) {
        unsubChunk()
        unsubToolUse()
        unsubToolResult()
        unsubThinking()
        unsubEnd()
        setIsStreaming(false)

        if (error instanceof Error) {
          onError(error.message)
        } else {
          onError('An unknown error occurred')
        }
      }
    },
    [authStatus, model]
  )

  return (
    <AIContext.Provider
      value={{
        authStatus,
        checkAuth,
        refreshAuth,
        model,
        setModel,
        isConfigured,
        isStreaming,
        sendMessage,
        abortStream,
      }}
    >
      {children}
    </AIContext.Provider>
  )
}

export const useAI = (): AIContextValue => {
  const context = useContext(AIContext)
  if (!context) {
    throw new Error('useAI must be used within an AIProvider')
  }
  return context
}
