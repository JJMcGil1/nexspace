import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

/**
 * Expose a safe, typed API to the renderer process.
 * This is the ONLY bridge between Node/Electron and the browser context.
 */

// Types for auto-updater
interface UpdateInfo {
  version: string
  url: string
  sha256: string
  releaseNotes?: string
  releaseDate?: string
  mandatory?: boolean
}

interface UpdateCheckResult {
  updateAvailable: boolean
  currentVersion: string
  latestVersion?: string
  updateInfo?: UpdateInfo
  error?: string
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Platform info (useful for rendering traffic lights vs window buttons)
  platform: process.platform,

  // Claude CLI integration
  claude: {
    getToken: () => ipcRenderer.invoke('claude:getToken'),
    login: () => ipcRenderer.invoke('claude:login'),
    sendMessage: (params: { messages: Array<{ role: string; content: string }>; model: string }) =>
      ipcRenderer.invoke('claude:sendMessage', params),
    onStreamChunk: (callback: (chunk: string) => void) => {
      const handler = (_event: IpcRendererEvent, chunk: string) => callback(chunk)
      ipcRenderer.on('claude:stream-chunk', handler)
      return () => ipcRenderer.removeListener('claude:stream-chunk', handler)
    },
    onStreamEnd: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('claude:stream-end', handler)
      return () => ipcRenderer.removeListener('claude:stream-end', handler)
    },
    onToolUse: (callback: (tool: { id: string; name: string; input: unknown }) => void) => {
      const handler = (_event: IpcRendererEvent, tool: { id: string; name: string; input: unknown }) => callback(tool)
      ipcRenderer.on('claude:tool-use', handler)
      return () => ipcRenderer.removeListener('claude:tool-use', handler)
    },
    onToolResult: (callback: (result: { tool_use_id: string; content: string }) => void) => {
      const handler = (_event: IpcRendererEvent, result: { tool_use_id: string; content: string }) => callback(result)
      ipcRenderer.on('claude:tool-result', handler)
      return () => ipcRenderer.removeListener('claude:tool-result', handler)
    },
    onThinking: (callback: (thinking: string) => void) => {
      const handler = (_event: IpcRendererEvent, thinking: string) => callback(thinking)
      ipcRenderer.on('claude:thinking', handler)
      return () => ipcRenderer.removeListener('claude:thinking', handler)
    },
  },

  // Local store (persistent database on user's machine)
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    getAll: () => ipcRenderer.invoke('store:getAll'),
    clear: () => ipcRenderer.invoke('store:clear'),
  },

  // Canvas state (for MCP tools / agent access)
  canvas: {
    getNodes: () => ipcRenderer.invoke('canvas:getNodes'),
    getEdges: () => ipcRenderer.invoke('canvas:getEdges'),
    getNodeContent: (nodeId: string) => ipcRenderer.invoke('canvas:getNodeContent', nodeId),
    addNode: (node: { type: string; position?: { x: number; y: number }; data: Record<string, unknown> }) =>
      ipcRenderer.invoke('canvas:addNode', node),
    updateNode: (nodeId: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('canvas:updateNode', nodeId, data),
    deleteNode: (nodeId: string) => ipcRenderer.invoke('canvas:deleteNode', nodeId),
    // Listeners for main process requests
    onAddNode: (callback: (node: { type: string; position?: { x: number; y: number }; data: Record<string, unknown> }) => void) => {
      const handler = (_event: IpcRendererEvent, node: { type: string; position?: { x: number; y: number }; data: Record<string, unknown> }) => callback(node)
      ipcRenderer.on('canvas:addNode', handler)
      return () => ipcRenderer.removeListener('canvas:addNode', handler)
    },
    onUpdateNode: (callback: (payload: { nodeId: string; data: Record<string, unknown> }) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { nodeId: string; data: Record<string, unknown> }) => callback(payload)
      ipcRenderer.on('canvas:updateNode', handler)
      return () => ipcRenderer.removeListener('canvas:updateNode', handler)
    },
    onDeleteNode: (callback: (payload: { nodeId: string }) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { nodeId: string }) => callback(payload)
      ipcRenderer.on('canvas:deleteNode', handler)
      return () => ipcRenderer.removeListener('canvas:deleteNode', handler)
    },
    // Listen for canvas refresh events (after MCP tool modifies data)
    onRefresh: (callback: (nexspaces: Array<{ id: string; nodes: unknown[]; edges: unknown[]; chatMessages?: unknown[] }>) => void) => {
      const handler = (_event: IpcRendererEvent, nexspaces: Array<{ id: string; nodes: unknown[]; edges: unknown[]; chatMessages?: unknown[] }>) => callback(nexspaces)
      ipcRenderer.on('canvas:refresh', handler)
      return () => ipcRenderer.removeListener('canvas:refresh', handler)
    },
  },

  // ═══════════════════════════════════════════════════════════
  // Auto-Updater API (Self-Signing with Hash Verification)
  // ═══════════════════════════════════════════════════════════
  updater: {
    // Check for updates manually
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),

    // Download the update
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),

    // Install the downloaded update (quits app)
    installUpdate: () => ipcRenderer.invoke('updater:install'),

    // Get current app version
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),

    // Dismiss the update notification
    dismissUpdate: () => ipcRenderer.invoke('updater:dismiss'),

    // Event listeners
    onUpdateAvailable: (callback: (result: UpdateCheckResult) => void) => {
      const handler = (_event: IpcRendererEvent, result: UpdateCheckResult) => callback(result)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },

    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
      const handler = (_event: IpcRendererEvent, progress: DownloadProgress) => callback(progress)
      ipcRenderer.on('update:download-progress', handler)
      return () => ipcRenderer.removeListener('update:download-progress', handler)
    },

    onUpdateDownloaded: (callback: (info: { filePath: string }) => void) => {
      const handler = (_event: IpcRendererEvent, info: { filePath: string }) => callback(info)
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    },

    onUpdateError: (callback: (info: { error: string }) => void) => {
      const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info)
      ipcRenderer.on('update:error', handler)
      return () => ipcRenderer.removeListener('update:error', handler)
    },
  },
})
