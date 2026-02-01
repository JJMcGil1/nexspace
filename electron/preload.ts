import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

/**
 * Expose a safe, typed API to the renderer process.
 * This is the ONLY bridge between Node/Electron and the browser context.
 */
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
  },

  // Local store (persistent database on user's machine)
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    getAll: () => ipcRenderer.invoke('store:getAll'),
    clear: () => ipcRenderer.invoke('store:clear'),
  },
})
