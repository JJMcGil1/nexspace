import { contextBridge, ipcRenderer } from 'electron'

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
})
