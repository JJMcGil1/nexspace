import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuDownload, LuRocket, LuShield, LuRefreshCw, LuCheck, LuCircleAlert } from 'react-icons/lu'
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

const UpdateModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('')

  // Get current version on mount
  useEffect(() => {
    window.electronAPI?.updater?.getVersion?.().then((version: string) => {
      setCurrentVersion(version || '0.0.0')
    })
  }, [])

  // Listen for update events from main process
  useEffect(() => {
    const api = window.electronAPI?.updater
    if (!api) return

    // Update available
    const unsubAvailable = api.onUpdateAvailable((result: UpdateCheckResult) => {
      console.log('[UpdateModal] Update available:', result)
      setUpdateInfo(result)
      setStatus('available')
      setIsOpen(true)
    })

    // Download progress
    const unsubProgress = api.onDownloadProgress((progress: DownloadProgress) => {
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
  const handleCheckForUpdates = async () => {
    setStatus('checking')
    setError(null)
    try {
      const result = await window.electronAPI?.updater?.checkForUpdates()
      if (result?.updateAvailable) {
        setUpdateInfo(result)
        setStatus('available')
      } else {
        setStatus('idle')
        setError('You are running the latest version!')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to check for updates')
    }
  }

  const handleDownload = async () => {
    setStatus('downloading')
    setError(null)
    try {
      await window.electronAPI?.updater?.downloadUpdate()
    } catch (err) {
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

  const handleClose = () => {
    if (!updateInfo?.updateInfo?.mandatory) {
      setIsOpen(false)
      window.electronAPI?.updater?.dismissUpdate()
    }
  }

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  if (!isOpen) return null

  const info = updateInfo?.updateInfo

  return createPortal(
    <div className="update-modal-overlay" onClick={handleClose}>
      <div
        className="update-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
      >
        {/* Header */}
        <div className="update-modal__header">
          <div className="update-modal__title-row">
            <div className="update-modal__icon">
              {status === 'downloaded' ? <LuCheck /> : status === 'error' ? <LuCircleAlert /> : <LuRocket />}
            </div>
            <h2 id="update-modal-title" className="update-modal__title">
              {status === 'downloaded' ? 'Ready to Install' : status === 'error' ? 'Update Error' : 'Update Available'}
            </h2>
          </div>
          {!info?.mandatory && (
            <button
              className="update-modal__close"
              onClick={handleClose}
              aria-label="Close"
            >
              <LuX size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="update-modal__content">
          {/* Version info */}
          <div className="update-modal__version-info">
            <div className="update-modal__version-badge update-modal__version-badge--current">
              <span className="update-modal__version-label">Current</span>
              <span className="update-modal__version-number">v{currentVersion}</span>
            </div>
            <div className="update-modal__version-arrow">→</div>
            <div className="update-modal__version-badge update-modal__version-badge--new">
              <span className="update-modal__version-label">New</span>
              <span className="update-modal__version-number">v{info?.version || updateInfo?.latestVersion}</span>
            </div>
          </div>

          {/* Release notes */}
          {info?.releaseNotes && (
            <div className="update-modal__release-notes">
              <h3 className="update-modal__release-notes-title">What's New</h3>
              <p className="update-modal__release-notes-text">{info.releaseNotes}</p>
            </div>
          )}

          {/* Security badge */}
          <div className="update-modal__security">
            <LuShield className="update-modal__security-icon" />
            <span className="update-modal__security-text">
              Verified with SHA256 hash for your security
            </span>
          </div>

          {/* Download progress */}
          {status === 'downloading' && downloadProgress && (
            <div className="update-modal__progress">
              <div className="update-modal__progress-bar">
                <div
                  className="update-modal__progress-fill"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className="update-modal__progress-text">
                <span>{downloadProgress.percent}%</span>
                <span>{formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {status === 'error' && error && (
            <div className="update-modal__error">
              <LuCircleAlert className="update-modal__error-icon" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="update-modal__footer">
          {status === 'available' && (
            <>
              {!info?.mandatory && (
                <button className="update-modal__btn update-modal__btn--secondary" onClick={handleClose}>
                  Later
                </button>
              )}
              <button className="update-modal__btn update-modal__btn--primary" onClick={handleDownload}>
                <LuDownload size={16} />
                Download Update
              </button>
            </>
          )}

          {status === 'downloading' && (
            <button className="update-modal__btn update-modal__btn--secondary" disabled>
              <LuRefreshCw size={16} className="update-modal__spinner" />
              Downloading...
            </button>
          )}

          {status === 'downloaded' && (
            <>
              <button className="update-modal__btn update-modal__btn--secondary" onClick={handleClose}>
                Install Later
              </button>
              <button className="update-modal__btn update-modal__btn--primary" onClick={handleInstall}>
                <LuRocket size={16} />
                Install & Restart
              </button>
            </>
          )}

          {status === 'installing' && (
            <button className="update-modal__btn update-modal__btn--secondary" disabled>
              <LuRefreshCw size={16} className="update-modal__spinner" />
              Installing...
            </button>
          )}

          {status === 'error' && (
            <>
              <button className="update-modal__btn update-modal__btn--secondary" onClick={handleClose}>
                Close
              </button>
              <button className="update-modal__btn update-modal__btn--primary" onClick={handleCheckForUpdates}>
                <LuRefreshCw size={16} />
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default UpdateModal
