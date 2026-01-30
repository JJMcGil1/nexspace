/**
 * Type declarations for the Electron preload bridge.
 * This keeps the renderer fully typed even though
 * the API is injected at runtime via contextBridge.
 */

interface ClaudeTokenResult {
  success: boolean
  token?: string
  error?: string
}

interface ClaudeLoginResult {
  success: boolean
  message?: string
  error?: string
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeSendMessageParams {
  messages: ClaudeMessage[]
  model: string
}

interface ClaudeSendMessageResult {
  success: boolean
  error?: 'token_expired' | 'api_error' | 'stream_error' | 'request_error'
  message?: string
}

interface ClaudeAPI {
  getToken: () => Promise<ClaudeTokenResult>
  login: () => Promise<ClaudeLoginResult>
  sendMessage: (params: ClaudeSendMessageParams) => Promise<ClaudeSendMessageResult>
  onStreamChunk: (callback: (chunk: string) => void) => () => void
  onStreamEnd: (callback: () => void) => () => void
}

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  platform: NodeJS.Platform
  claude: ClaudeAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
