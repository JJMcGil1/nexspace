import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn } from 'child_process'
import Store from 'electron-store'
// https module removed - using Claude CLI instead

// Initialize electron-store for local database
const store = new Store({
  name: 'nexspace-data',
  defaults: {
    user: null,
    onboardingComplete: false,
    nexspaces: [],
    settings: {
      theme: 'dark',
      aiModel: 'sonnet'
    }
  }
})

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    icon: path.join(__dirname, '../build/icon.png'),
    frame: false, // Frameless — we render our own titlebar
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 20 }, // Centered in 56px titlebar
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Load either the Vite dev server or the built file
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // IPC: Window controls from renderer
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  // IPC: Claude CLI token management
  ipcMain.handle('claude:getToken', async () => {
    try {
      const authPath = path.join(os.homedir(), '.claude', 'auth.json')
      if (fs.existsSync(authPath)) {
        const data = fs.readFileSync(authPath, 'utf-8')
        const auth = JSON.parse(data)
        return { success: true, token: auth.token }
      }
      return { success: false, error: 'not_found' }
    } catch (error) {
      return { success: false, error: 'read_error' }
    }
  })

  // IPC: Claude CLI streaming (uses Claude Code CLI as subprocess)
  ipcMain.handle('claude:sendMessage', async (event, { messages, model }) => {
    return new Promise((resolve) => {
      // Get the last user message
      const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop()
      if (!lastUserMessage) {
        resolve({ success: false, error: 'api_error', message: 'No user message found' })
        return
      }

      // Build CLI arguments with stream-json + include-partial-messages for real-time token streaming
      const cliArgs = [
        '--print',
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--model', model || 'sonnet',
        lastUserMessage.content
      ]
      console.log('[Claude CLI] Spawning with streaming args...')

      // Get the user's shell PATH to find claude binary
      const userPath = process.env.PATH || ''
      const nvmPath = path.join(os.homedir(), '.nvm/versions/node')

      // Find claude in common locations
      const claudePaths = [
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        path.join(os.homedir(), '.nvm/versions/node/v22.20.0/bin/claude'),
      ]

      let claudePath = 'claude'
      for (const p of claudePaths) {
        if (fs.existsSync(p)) {
          claudePath = p
          break
        }
      }

      console.log('[Claude CLI] Using claude at:', claudePath)

      // Spawn without shell to avoid buffering issues
      const claudeProcess = spawn(claudePath, cliArgs, {
        env: {
          ...process.env,
          // Ensure NVM paths are included
          PATH: `${path.join(os.homedir(), '.nvm/versions/node/v22.20.0/bin')}:${userPath}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let hasError = false
      let buffer = ''

      claudeProcess.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()

        // Process complete JSON lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data = JSON.parse(line)

            // Handle stream_event with content_block_delta for real-time streaming
            if (data.type === 'stream_event' && data.event?.type === 'content_block_delta') {
              const textDelta = data.event.delta?.text
              if (textDelta) {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('claude:stream-chunk', textDelta)
                }
              }
            }
          } catch (e) {
            // Not valid JSON, might be partial line - ignore
          }
        }
      })

      claudeProcess.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        console.log('[Claude CLI] stderr:', text)
        // Some stderr output might be progress indicators, not errors
        if (text.includes('error') || text.includes('Error')) {
          hasError = true
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('claude:stream-chunk', `Error: ${text}`)
          }
        }
      })

      claudeProcess.on('close', (code) => {
        console.log('[Claude CLI] Process exited with code:', code)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('claude:stream-end')
        }
        if (code === 0 && !hasError) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error: 'api_error', message: `Claude CLI exited with code ${code}` })
        }
      })

      claudeProcess.on('error', (err) => {
        console.log('[Claude CLI] Process error:', err.message)
        resolve({ success: false, error: 'request_error', message: `Failed to start Claude CLI: ${err.message}` })
      })
    })
  })

  ipcMain.handle('claude:login', async () => {
    return new Promise((resolve) => {
      if (process.platform === 'darwin') {
        // macOS: Use AppleScript to open Terminal and run claude logout && claude login
        // We force logout first to ensure a fresh token is generated
        const appleScript = `
          tell application "Terminal"
            activate
            do script "claude logout && claude login"
          end tell
        `
        const osascriptProcess = spawn('osascript', ['-e', appleScript])

        osascriptProcess.on('error', (err) => {
          resolve({ success: false, error: `Failed to open Terminal: ${err.message}` })
        })

        osascriptProcess.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              message: 'Terminal opened. Complete the authentication in your browser, then click "Refresh" here.'
            })
          } else {
            resolve({ success: false, error: 'Failed to open Terminal. Please run `claude logout && claude login` manually.' })
          }
        })
      } else {
        // Other platforms: Just show instructions
        resolve({
          success: true,
          message: 'Please run `claude logout && claude login` in your terminal, then click "Refresh" when done.'
        })
      }
    })
  })

  // IPC: Local Store operations
  ipcMain.handle('store:get', async (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    store.set(key, value)
    return { success: true }
  })

  ipcMain.handle('store:delete', async (_event, key: string) => {
    store.delete(key as keyof typeof store.store)
    return { success: true }
  })

  ipcMain.handle('store:getAll', async () => {
    return store.store
  })

  ipcMain.handle('store:clear', async () => {
    store.clear()
    return { success: true }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Set macOS dock icon
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(
      path.join(__dirname, '../build/icon.png')
    )
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon)
    }
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
