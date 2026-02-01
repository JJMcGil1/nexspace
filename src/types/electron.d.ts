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

interface StoreAPI {
  get: <T = unknown>(key: string) => Promise<T>
  set: (key: string, value: unknown) => Promise<{ success: boolean }>
  delete: (key: string) => Promise<{ success: boolean }>
  getAll: () => Promise<StoreData>
  clear: () => Promise<{ success: boolean }>
}

// User profile stored locally
export interface UserProfile {
  id: string
  name: string
  email: string
  avatarColor: string
  avatarImage?: string // Base64 encoded image or URL
  createdAt: string
}

// Store data structure
export interface StoreData {
  user: UserProfile | null
  onboardingComplete: boolean
  nexspaces: NexSpace[]
  settings: {
    theme: 'light' | 'dark'
    aiModel: string
  }
}

// A NexSpace is a workspace/canvas for AI collaboration
export interface NexSpace {
  id: string
  title: string
  coverImage?: string // Base64 encoded image or URL
  coverColor?: string // Fallback color if no image
  lastEdited: string
  createdAt: string
}

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  platform: NodeJS.Platform
  claude: ClaudeAPI
  store: StoreAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
