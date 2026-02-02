import { app, BrowserWindow, dialog } from 'electron'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as https from 'https'
import * as http from 'http'

// ═══════════════════════════════════════════════════════════
// Auto-Updater with Self-Signing (Hash Verification)
// No certificates needed - just SHA256 hash verification
// ═══════════════════════════════════════════════════════════

export interface UpdateInfo {
  version: string
  url: string
  sha256: string
  releaseNotes?: string
  releaseDate?: string
  mandatory?: boolean
}

export interface UpdateCheckResult {
  updateAvailable: boolean
  currentVersion: string
  latestVersion?: string
  updateInfo?: UpdateInfo
  error?: string
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}

// Configuration - GitHub Releases
const UPDATE_CONFIG = {
  // GitHub repository owner and name
  owner: 'JJMcGil1',
  repo: 'nexspace',

  // Check interval in milliseconds (default: 1 hour)
  checkInterval: 60 * 60 * 1000,

  // Enable automatic checking on app start
  autoCheck: true,
}

// GitHub Release Asset interface
interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
}

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: GitHubAsset[]
}

let mainWindow: BrowserWindow | null = null
let isDownloading = false
let downloadedFilePath: string | null = null

/**
 * Initialize the auto-updater with the main window reference
 */
export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window

  // Check for updates on startup (after a small delay)
  if (UPDATE_CONFIG.autoCheck && !process.env.VITE_DEV_SERVER_URL) {
    setTimeout(() => {
      checkForUpdates().catch(console.error)
    }, 5000)
  }

  // Set up periodic update checks
  if (!process.env.VITE_DEV_SERVER_URL) {
    setInterval(() => {
      checkForUpdates().catch(console.error)
    }, UPDATE_CONFIG.checkInterval)
  }
}

/**
 * Get current app version from package.json
 */
export function getCurrentVersion(): string {
  return app.getVersion()
}

/**
 * Compare two semver version strings
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number)
  const partsB = b.replace(/^v/, '').split('.').map(Number)

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

/**
 * Fetch latest release from GitHub Releases API
 */
async function fetchGitHubRelease(): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${UPDATE_CONFIG.owner}/${UPDATE_CONFIG.repo}/releases/latest`,
      headers: {
        'User-Agent': 'NexSpace-AutoUpdater',
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const request = https.get(options, (response) => {
      if (response.statusCode === 404) {
        reject(new Error('No releases found'))
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`GitHub API returned status ${response.statusCode}`))
        return
      }

      let data = ''
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error('Invalid JSON response from GitHub'))
        }
      })
    })

    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('GitHub API request timed out'))
    })
  })
}

/**
 * Get the appropriate asset for the current platform
 */
function getPlatformAsset(assets: GitHubAsset[]): GitHubAsset | null {
  const platform = process.platform
  const arch = process.arch

  for (const asset of assets) {
    const name = asset.name.toLowerCase()

    if (platform === 'darwin') {
      // macOS: prefer .dmg, then .zip with mac/darwin in name
      if (name.endsWith('.dmg')) return asset
      if (name.endsWith('.zip') && (name.includes('mac') || name.includes('darwin'))) return asset
    } else if (platform === 'win32') {
      // Windows: prefer Setup.exe or .exe
      if (name.endsWith('.exe')) return asset
    } else if (platform === 'linux') {
      // Linux: prefer .AppImage
      if (name.endsWith('.appimage')) return asset
    }
  }

  return null
}

// Type for latest.json content
interface LatestJsonContent {
  version?: string
  sha256?: string
  platforms?: {
    mac?: { sha256?: string; size?: number }
    win?: { sha256?: string; size?: number }
    linux?: { sha256?: string; size?: number }
  }
}

/**
 * Find the latest.json asset which contains SHA256 hashes
 */
async function fetchLatestJson(assets: GitHubAsset[]): Promise<LatestJsonContent | null> {
  const latestJsonAsset = assets.find(a => a.name === 'latest.json')
  if (!latestJsonAsset) return null

  return new Promise((resolve, reject) => {
    const url = new URL(latestJsonAsset.browser_download_url)

    const request = https.get(url, {
      headers: { 'User-Agent': 'NexSpace-AutoUpdater' }
    }, (response) => {
      // Handle GitHub redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          https.get(redirectUrl, (redirectResponse) => {
            let data = ''
            redirectResponse.on('data', (chunk) => { data += chunk })
            redirectResponse.on('end', () => {
              try {
                resolve(JSON.parse(data))
              } catch {
                resolve(null)
              }
            })
          }).on('error', () => resolve(null))
          return
        }
      }

      let data = ''
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve(null)
        }
      })
    })

    request.on('error', () => resolve(null))
    request.setTimeout(10000, () => {
      request.destroy()
      resolve(null)
    })
  })
}

/**
 * Fetch update info from GitHub Releases
 */
async function fetchUpdateInfo(): Promise<UpdateInfo> {
  const release = await fetchGitHubRelease()

  // Get the appropriate download asset for this platform
  const asset = getPlatformAsset(release.assets)
  if (!asset) {
    throw new Error(`No compatible release found for ${process.platform}`)
  }

  // Try to get latest.json for SHA256 hashes
  const latestJson = await fetchLatestJson(release.assets)

  // Extract version from tag (remove 'v' prefix if present)
  const version = release.tag_name.replace(/^v/, '')

  // Get SHA256 hash from latest.json if available
  let sha256 = ''
  if (latestJson) {
    // Try to find hash for this platform
    const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux'
    const platformData = latestJson.platforms?.[platform]
    if (platformData?.sha256) {
      sha256 = platformData.sha256
    } else if (latestJson.sha256) {
      sha256 = latestJson.sha256
    }
  }

  return {
    version,
    url: asset.browser_download_url,
    sha256,
    releaseNotes: release.body || 'Bug fixes and improvements.',
    releaseDate: release.published_at,
  }
}

/**
 * Check for available updates
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion()

  console.log('[AutoUpdater] Checking for updates...')
  console.log('[AutoUpdater] Current version:', currentVersion)

  try {
    const updateInfo = await fetchUpdateInfo()
    console.log('[AutoUpdater] Latest version:', updateInfo.version)

    const updateAvailable = compareVersions(updateInfo.version, currentVersion) > 0

    const result: UpdateCheckResult = {
      updateAvailable,
      currentVersion,
      latestVersion: updateInfo.version,
      updateInfo: updateAvailable ? updateInfo : undefined,
    }

    // Notify renderer if update is available
    if (updateAvailable && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', result)
    }

    return result
  } catch (error) {
    console.error('[AutoUpdater] Update check failed:', error)
    return {
      updateAvailable: false,
      currentVersion,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Download a file with progress tracking
 */
function downloadFile(url: string, destPath: string, onProgress: (progress: DownloadProgress) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http

    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`))
        return
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedSize = 0

      const fileStream = fs.createWriteStream(destPath)

      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length
        const progress: DownloadProgress = {
          percent: totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0,
          transferred: downloadedSize,
          total: totalSize,
        }
        onProgress(progress)
      })

      response.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}) // Delete partial file
        reject(err)
      })
    })

    request.on('error', (err) => {
      fs.unlink(destPath, () => {}) // Delete partial file
      reject(err)
    })

    request.setTimeout(300000, () => { // 5 minute timeout
      request.destroy()
      reject(new Error('Download timed out'))
    })
  })
}

/**
 * Calculate SHA256 hash of a file
 */
function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Download and verify the update
 */
export async function downloadUpdate(updateInfo: UpdateInfo): Promise<{ success: boolean; error?: string }> {
  if (isDownloading) {
    return { success: false, error: 'Download already in progress' }
  }

  isDownloading = true
  console.log('[AutoUpdater] Starting download...')

  try {
    // Create temp directory for download
    const tempDir = path.join(os.tmpdir(), 'nexspace-update')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Determine file extension from URL
    const urlPath = new URL(updateInfo.url).pathname
    const ext = path.extname(urlPath) || '.zip'
    const fileName = `nexspace-${updateInfo.version}${ext}`
    const downloadPath = path.join(tempDir, fileName)

    // Download with progress
    await downloadFile(updateInfo.url, downloadPath, (progress) => {
      console.log(`[AutoUpdater] Download progress: ${progress.percent}%`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:download-progress', progress)
      }
    })

    console.log('[AutoUpdater] Download complete, verifying hash...')

    // Verify hash
    const fileHash = await calculateFileHash(downloadPath)
    console.log('[AutoUpdater] Expected hash:', updateInfo.sha256)
    console.log('[AutoUpdater] Actual hash:', fileHash)

    if (fileHash.toLowerCase() !== updateInfo.sha256.toLowerCase()) {
      // Delete the corrupted/tampered file
      fs.unlinkSync(downloadPath)

      const error = 'Hash verification failed! The download may be corrupted or tampered with.'
      console.error('[AutoUpdater]', error)

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:error', { error })
      }

      return { success: false, error }
    }

    console.log('[AutoUpdater] Hash verified successfully!')
    downloadedFilePath = downloadPath

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:downloaded', { filePath: downloadPath })
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[AutoUpdater] Download failed:', errorMessage)

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:error', { error: errorMessage })
    }

    return { success: false, error: errorMessage }
  } finally {
    isDownloading = false
  }
}

/**
 * Install the downloaded update
 * This will quit the app and run the installer
 */
export async function installUpdate(): Promise<{ success: boolean; error?: string }> {
  if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
    return { success: false, error: 'No update downloaded' }
  }

  console.log('[AutoUpdater] Installing update from:', downloadedFilePath)

  try {
    const ext = path.extname(downloadedFilePath).toLowerCase()

    if (process.platform === 'darwin') {
      // macOS: Open the DMG or ZIP
      if (ext === '.dmg') {
        // Open DMG file
        const { spawn } = await import('child_process')
        spawn('open', [downloadedFilePath as string], { detached: true })
      } else if (ext === '.zip') {
        // Extract and open the app
        const { spawn, execSync } = await import('child_process')
        const extractDir = path.join(os.tmpdir(), 'nexspace-update-extract')

        // Unzip using execSync for simplicity
        try {
          execSync(`unzip -o "${downloadedFilePath}" -d "${extractDir}"`)
        } catch {
          throw new Error('Failed to extract update')
        }

        // Find and open the .app
        const files = fs.readdirSync(extractDir)
        const appFile = files.find(f => f.endsWith('.app'))
        if (appFile) {
          spawn('open', [path.join(extractDir, appFile)], { detached: true })
        }
      }
    } else if (process.platform === 'win32') {
      // Windows: Run the installer
      const { spawn } = await import('child_process')
      spawn(downloadedFilePath as string, [], { detached: true, shell: true })
    } else {
      // Linux: Make AppImage executable and run
      const { spawn } = await import('child_process')
      fs.chmodSync(downloadedFilePath as string, '755')
      spawn(downloadedFilePath as string, [], { detached: true })
    }

    // Quit the current app after a short delay
    setTimeout(() => {
      app.quit()
    }, 1000)

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[AutoUpdater] Install failed:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Show a native dialog for update notification (fallback)
 */
export async function showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `A new version of NexSpace is available!`,
    detail: `Version ${updateInfo.version} is ready to download.\n\n${updateInfo.releaseNotes || 'Bug fixes and improvements.'}`,
    buttons: ['Download Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })

  return result.response === 0
}
