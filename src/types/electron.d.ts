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

interface ToolUse {
  id: string
  name: string
  input: unknown
}

interface ToolResult {
  tool_use_id: string
  content: string
}

interface ClaudeAPI {
  getToken: () => Promise<ClaudeTokenResult>
  login: () => Promise<ClaudeLoginResult>
  sendMessage: (params: ClaudeSendMessageParams) => Promise<ClaudeSendMessageResult>
  onStreamChunk: (callback: (chunk: string) => void) => () => void
  onStreamEnd: (callback: () => void) => () => void
  onToolUse: (callback: (tool: ToolUse) => void) => () => void
  onToolResult: (callback: (result: ToolResult) => void) => () => void
  onThinking: (callback: (thinking: string) => void) => () => void
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

// Canvas node as stored (serializable subset of React Flow node)
export interface CanvasNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

// Canvas edge as stored
export interface CanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

// Tool call as stored with message
export interface StoredToolCall {
  id: string
  name: string
  input: unknown
  result?: string
  status: 'pending' | 'complete'
}

// Chat message as stored
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string // ISO string for serialization
  isError?: boolean
  toolCalls?: StoredToolCall[]
  thinking?: string
}

// A NexSpace is a workspace/canvas for AI collaboration
export interface NexSpace {
  id: string
  title: string
  coverImage?: string // Base64 encoded image or URL
  coverColor?: string // Fallback color if no image
  lastEdited: string
  createdAt: string
  // Canvas state
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  // Chat state
  chatMessages: ChatMessage[]
}

// Canvas API for MCP tools / agent access
interface CanvasAPIResult<T> {
  success: boolean
  error?: string
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  node?: CanvasNode
}

interface CanvasAPI {
  getNodes: () => Promise<{ success: boolean; nodes: CanvasNode[] }>
  getEdges: () => Promise<{ success: boolean; edges: CanvasEdge[] }>
  getNodeContent: (nodeId: string) => Promise<{ success: boolean; node?: CanvasNode; error?: string }>
  addNode: (node: { type: string; position?: { x: number; y: number }; data: Record<string, unknown> }) => Promise<{ success: boolean }>
  updateNode: (nodeId: string, data: Record<string, unknown>) => Promise<{ success: boolean }>
  deleteNode: (nodeId: string) => Promise<{ success: boolean }>
  // Listeners for main process requests
  onAddNode: (callback: (node: { type: string; position?: { x: number; y: number }; data: Record<string, unknown> }) => void) => () => void
  onUpdateNode: (callback: (payload: { nodeId: string; data: Record<string, unknown> }) => void) => () => void
  onDeleteNode: (callback: (payload: { nodeId: string }) => void) => () => void
  // Listen for canvas refresh after MCP tool operations
  onRefresh: (callback: (nexspaces: NexSpace[]) => void) => () => void
}

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  platform: NodeJS.Platform
  claude: ClaudeAPI
  store: StoreAPI
  canvas: CanvasAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
