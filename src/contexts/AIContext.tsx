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
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
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
      onChunk: (chunk: string) => void,
      onComplete: () => void,
      onError: (error: string) => void
    ) => {
      // Claude CLI handles its own authentication
      if (authStatus !== 'authenticated') {
        onError('Not authenticated. Please run "claude login" in your terminal.')
        return
      }

      setIsStreaming(true)
      console.log('[AIContext] Setting up stream listeners...')

      // Claude CLI outputs plain text directly, no SSE parsing needed
      const unsubChunk = window.electronAPI.claude.onStreamChunk((chunk: string) => {
        console.log('[AIContext] Received chunk:', chunk.substring(0, 50))
        onChunk(chunk)
      })

      const unsubEnd = window.electronAPI.claude.onStreamEnd(() => {
        console.log('[AIContext] Stream ended')
        unsubChunk()
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
