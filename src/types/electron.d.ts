/**
 * Type declarations for the Electron preload bridge.
 * This keeps the renderer fully typed even though
 * the API is injected at runtime via contextBridge.
 */
export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
