import { app, BrowserWindow, ipcMain, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn } from 'child_process'
import Store from 'electron-store'

// Handle EPIPE errors gracefully (happens when writing to closed pipes)
process.on('uncaughtException', (error) => {
  if (error.message.includes('EPIPE')) {
    console.warn('[Main] EPIPE error caught and ignored:', error.message)
    return
  }
  console.error('[Main] Uncaught exception:', error)
})

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
let mcpConfigPath: string | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// ═══════════════════════════════════════════════════════════
// MCP Config Generator
// Creates a temp config file for Claude CLI with NexSpace tools
// ═══════════════════════════════════════════════════════════

function findNodeExecutable(): string {
  // Check common node locations
  const candidates = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    path.join(os.homedir(), '.nvm/versions/node/v22.20.0/bin/node'),
    path.join(os.homedir(), '.nvm/versions/node/v20.0.0/bin/node'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  // Fallback to 'node' in PATH
  return 'node'
}

function getMcpServerPath(): string {
  const isDevMode = !!process.env['VITE_DEV_SERVER_URL']

  if (isDevMode) {
    // Development: use source directory
    return path.join(process.cwd(), 'mcp-servers', 'nexspace-canvas', 'dist', 'bundle.js')
  } else {
    // Production: use app resources
    return path.join(app.getAppPath(), 'mcp-servers', 'nexspace-canvas', 'dist', 'bundle.js')
  }
}

function generateMcpConfig(): string {
  const nodePath = findNodeExecutable()
  const mcpServerPath = getMcpServerPath()

  console.log('[MCP Config] Node path:', nodePath)
  console.log('[MCP Config] Server path:', mcpServerPath)

  const config = {
    mcpServers: {
      'nexspace-canvas': {
        type: 'stdio',
        command: nodePath,
        args: [mcpServerPath],
        env: {}
      }
    }
  }

  // Write to temp file
  const tempDir = os.tmpdir()
  const configPath = path.join(tempDir, `nexspace-mcp-config-${Date.now()}.json`)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  console.log('[MCP Config] Generated config at:', configPath)
  return configPath
}

function findClaudePath(): string {
  const candidates = [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.nvm/versions/node/v22.20.0/bin/claude'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return 'claude'
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    icon: path.join(__dirname, '../build/icon.png'),
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 20 },
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // IPC: Window controls
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
    } catch {
      return { success: false, error: 'read_error' }
    }
  })

  // IPC: Claude CLI streaming with MCP config
  ipcMain.handle('claude:sendMessage', async (_event, { messages, model }) => {
    return new Promise((resolve) => {
      const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop()
      if (!lastUserMessage) {
        resolve({ success: false, error: 'api_error', message: 'No user message found' })
        return
      }

      // Generate MCP config with NexSpace tools
      const currentMcpConfig = generateMcpConfig()

      // Build CLI arguments with MCP config
      // Note: --mcp-config must come before other flags, and prompt via -p
      const cliArgs = [
        '--mcp-config', currentMcpConfig,  // MCP config first
        '--dangerously-skip-permissions',  // Auto-accept all tool calls without prompting
        '--print',
        '--output-format', 'stream-json',
        '--verbose',
        '--model', model || 'sonnet',
        '-p', lastUserMessage.content  // Prompt via -p flag
      ]

      console.log('[Claude CLI] Spawning with MCP config:', currentMcpConfig)

      const claudePath = findClaudePath()
      console.log('[Claude CLI] Using claude at:', claudePath)

      const userPath = process.env.PATH || ''
      const claudeProcess = spawn(claudePath, cliArgs, {
        env: {
          ...process.env,
          PATH: `${path.join(os.homedir(), '.nvm/versions/node/v22.20.0/bin')}:${userPath}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let hasError = false
      let buffer = ''
      let responseSent = false  // Track if we've already sent the response

      claudeProcess.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)

            // Claude CLI outputs JSON lines with different types:
            // - type: "system" (init info)
            // - type: "assistant" (message with content blocks)
            // - type: "result" (final complete response)

            console.log('[Claude CLI] Received:', data.type)

            // Handle assistant messages (contains tool_use, thinking, text blocks)
            if (data.type === 'assistant' && data.message?.content) {
              const content = data.message.content
              for (const block of content) {
                if (block.type === 'tool_use') {
                  // Send tool call to renderer
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('claude:tool-use', {
                      id: block.id,
                      name: block.name,
                      input: block.input
                    })
                  }
                } else if (block.type === 'thinking') {
                  // Send thinking to renderer
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('claude:thinking', block.thinking)
                  }
                } else if (block.type === 'text') {
                  // Stream text content
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('claude:stream-chunk', block.text)
                  }
                }
              }
            }

            // Handle tool results
            if (data.type === 'user' && data.message?.content) {
              const content = data.message.content
              for (const block of content) {
                if (block.type === 'tool_result') {
                  // Extract text from content - it can be array, object, or string
                  let resultText = ''
                  if (Array.isArray(block.content)) {
                    // Array of content blocks like [{type: "text", text: "..."}]
                    resultText = block.content.map((c: { text?: string }) => c.text || '').join('')
                  } else if (typeof block.content === 'object' && block.content !== null) {
                    // Single content block like {type: "text", text: "..."}
                    resultText = (block.content as { text?: string }).text || JSON.stringify(block.content)
                  } else if (typeof block.content === 'string') {
                    resultText = block.content
                  } else {
                    resultText = String(block.content)
                  }

                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('claude:tool-result', {
                      tool_use_id: block.tool_use_id,
                      content: resultText
                    })

                    // Check if this was a canvas-modifying tool - refresh the canvas state
                    // Parse the result to see if it contains success from add_node, update_node, delete_node
                    if (resultText.includes('"success": true') || resultText.includes('"success":true')) {
                      // Re-read the store and send fresh nexspace data to renderer
                      const freshData = store.get('nexspaces') as Array<{ id: string; nodes: unknown[]; edges: unknown[] }> || []
                      mainWindow.webContents.send('canvas:refresh', freshData)
                      console.log('[Claude CLI] Canvas refresh triggered after successful tool operation')
                    }
                  }
                }
              }
            }

            // Final result (for complete text if needed)
            if (data.type === 'result' && data.result && !responseSent) {
              responseSent = true
              console.log('[Claude CLI] Final result received')
              // Only send if we haven't streamed text blocks
              // The text blocks above handle the actual content
            }
          } catch {
            // Not valid JSON - ignore
          }
        }
      })

      claudeProcess.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        console.log('[Claude CLI] stderr:', text)
        if (text.includes('error') || text.includes('Error')) {
          hasError = true
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('claude:stream-chunk', `Error: ${text}`)
          }
        }
      })

      claudeProcess.on('close', (code) => {
        console.log('[Claude CLI] Process exited with code:', code)

        // Cleanup temp config file
        try {
          if (fs.existsSync(currentMcpConfig)) {
            fs.unlinkSync(currentMcpConfig)
          }
        } catch {
          // Ignore cleanup errors
        }

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

  // ═══════════════════════════════════════════════════════════
  // Canvas State IPC (for renderer ↔ main communication)
  // ═══════════════════════════════════════════════════════════

  ipcMain.handle('canvas:getNodes', async () => {
    const nexspaces = store.get('nexspaces') as Array<{
      id: string
      nodes?: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>
    }> || []
    if (nexspaces.length === 0) return { success: true, nodes: [] }
    const current = nexspaces[0]
    return { success: true, nodes: current.nodes || [] }
  })

  ipcMain.handle('canvas:getEdges', async () => {
    const nexspaces = store.get('nexspaces') as Array<{
      id: string
      edges?: Array<{ id: string; source: string; target: string }>
    }> || []
    if (nexspaces.length === 0) return { success: true, edges: [] }
    const current = nexspaces[0]
    return { success: true, edges: current.edges || [] }
  })

  ipcMain.handle('canvas:getNodeContent', async (_event, nodeId: string) => {
    const nexspaces = store.get('nexspaces') as Array<{
      id: string
      nodes?: Array<{ id: string; type: string; data: Record<string, unknown> }>
    }> || []
    if (nexspaces.length === 0) return { success: false, error: 'No NexSpace found' }
    const current = nexspaces[0]
    const node = current.nodes?.find(n => n.id === nodeId)
    if (!node) return { success: false, error: 'Node not found' }
    return { success: true, node }
  })

  ipcMain.handle('canvas:addNode', async (_event, node: {
    type: string
    position?: { x: number; y: number }
    data: Record<string, unknown>
  }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('canvas:addNode', node)
      return { success: true }
    }
    return { success: false, error: 'Window not available' }
  })

  ipcMain.handle('canvas:updateNode', async (_event, nodeId: string, data: Record<string, unknown>) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('canvas:updateNode', { nodeId, data })
      return { success: true }
    }
    return { success: false, error: 'Window not available' }
  })

  ipcMain.handle('canvas:deleteNode', async (_event, nodeId: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('canvas:deleteNode', { nodeId })
      return { success: true }
    }
    return { success: false, error: 'Window not available' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
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
