import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LuSparkles, LuRefreshCw } from 'react-icons/lu'
import './UpdateModal.css'

// Types matching the preload API
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

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error'

const UpdateToast: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Listen for update events from main process
  useEffect(() => {
    const api = window.electronAPI?.updater
    if (!api) return

    // Update available
    const unsubAvailable = api.onUpdateAvailable((result: UpdateCheckResult) => {
      console.log('[UpdateToast] Update available:', result)
      setUpdateInfo(result)
      setStatus('available')
      setIsOpen(true)
    })

    // Download progress
    const unsubProgress = api.onDownloadProgress((progress: DownloadProgress) => {
      console.log('[UpdateToast] Download progress:', progress.percent + '%')
      setDownloadProgress(progress)
    })

    // Update downloaded
    const unsubDownloaded = api.onUpdateDownloaded(() => {
      setStatus('downloaded')
      setDownloadProgress(null)
    })

    // Update error
    const unsubError = api.onUpdateError((info: { error: string }) => {
      setStatus('error')
      setError(info.error)
    })

    return () => {
      unsubAvailable?.()
      unsubProgress?.()
      unsubDownloaded?.()
      unsubError?.()
    }
  }, [])

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !updateInfo?.updateInfo?.mandatory) {
      setIsOpen(false)
    }
  }, [updateInfo])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // Actions
  const handleDownload = async () => {
    console.log('[UpdateToast] Starting download...')
    setStatus('downloading')
    setError(null)
    try {
      const result = await window.electronAPI?.updater?.downloadUpdate()
      console.log('[UpdateToast] Download result:', result)
      if (result && !result.success) {
        setStatus('error')
        setError(result.error || 'Download failed')
      }
    } catch (err) {
      console.error('[UpdateToast] Download error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const handleInstall = async () => {
    setStatus('installing')
    try {
      await window.electronAPI?.updater?.installUpdate()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Installation failed')
    }
  }

  const handleLater = () => {
    if (!updateInfo?.updateInfo?.mandatory) {
      setIsOpen(false)
      window.electronAPI?.updater?.dismissUpdate()
    }
  }

  const handleRetry = async () => {
    setError(null)
    setStatus('available')
  }

  if (!isOpen) return null

  const info = updateInfo?.updateInfo
  const version = info?.version || updateInfo?.latestVersion || ''

  return createPortal(
    <div className="update-toast" role="dialog" aria-label="Update available">
      {/* Header row with icon and title */}
      <div className="update-toast__header">
        <div className="update-toast__icon">
          <LuSparkles size={16} />
        </div>
        <div className="update-toast__title-group">
          <span className="update-toast__title">Update Available</span>
          <span className="update-toast__version">v{version}</span>
        </div>
      </div>

      {/* Progress bar - only show when downloading */}
      {status === 'downloading' && (
        <div className="update-toast__progress">
          <div
            className="update-toast__progress-fill"
            style={{ width: `${downloadProgress?.percent || 0}%` }}
          />
        </div>
      )}

      {/* Error message */}
      {status === 'error' && error && (
        <div className="update-toast__error">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="update-toast__actions">
        {status === 'available' && (
          <>
            {!info?.mandatory && (
              <button className="update-toast__btn update-toast__btn--ghost" onClick={handleLater}>
                Later
              </button>
            )}
            <button className="update-toast__btn update-toast__btn--primary" onClick={handleDownload}>
              Download
            </button>
          </>
        )}

        {status === 'downloading' && (
          <button className="update-toast__btn update-toast__btn--ghost" disabled>
            <LuRefreshCw size={14} className="update-toast__spinner" />
            {downloadProgress ? `${Math.round(downloadProgress.percent)}%` : 'Starting...'}
          </button>
        )}

        {status === 'downloaded' && (
          <>
            <button className="update-toast__btn update-toast__btn--ghost" onClick={handleLater}>
              Later
            </button>
            <button className="update-toast__btn update-toast__btn--primary" onClick={handleInstall}>
              Install
            </button>
          </>
        )}

        {status === 'installing' && (
          <button className="update-toast__btn update-toast__btn--ghost" disabled>
            <LuRefreshCw size={14} className="update-toast__spinner" />
            Installing...
          </button>
        )}

        {status === 'error' && (
          <>
            <button className="update-toast__btn update-toast__btn--ghost" onClick={handleLater}>
              Later
            </button>
            <button className="update-toast__btn update-toast__btn--primary" onClick={handleRetry}>
              Retry
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

export default UpdateToast
