import React, { useState } from 'react'
import { LuSun, LuMoon, LuSparkles, LuCheck, LuInfo, LuRefreshCw, LuTriangleAlert, LuTerminal } from 'react-icons/lu'
import { useTheme } from '../contexts/ThemeContext'
import { useAI, AVAILABLE_MODELS, ClaudeModel } from '../contexts/AIContext'
import Modal from './Modal'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme()
  const { authStatus, checkAuth, refreshAuth, model, setModel, isConfigured } = useAI()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loginMessage, setLoginMessage] = useState<string | null>(null)

  const handleRefreshAuth = async () => {
    setIsRefreshing(true)
    setLoginMessage(null)
    await checkAuth()
    setIsRefreshing(false)
  }

  const handleOpenTerminalLogin = async () => {
    setIsRefreshing(true)
    setLoginMessage(null)

    // This will open Terminal and run `claude login`
    const result = await window.electronAPI.claude.login()

    if (result.success && result.message) {
      setLoginMessage(result.message)
    } else if (result.error) {
      setLoginMessage(result.error)
    }

    setIsRefreshing(false)
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setModel(e.target.value as ClaudeModel)
  }

  const getAuthStatusDisplay = () => {
    switch (authStatus) {
      case 'checking':
        return {
          icon: <LuRefreshCw size={14} className="settings__status-icon--spin" />,
          text: 'Checking authentication...',
          className: ''
        }
      case 'authenticated':
        return {
          icon: <LuCheck size={14} />,
          text: 'Authenticated with Claude',
          className: 'settings__status--success'
        }
      case 'token_expired':
        return {
          icon: <LuTriangleAlert size={14} />,
          text: 'Token expired - please re-authenticate',
          className: 'settings__status--error'
        }
      case 'not_authenticated':
        return {
          icon: <LuInfo size={14} />,
          text: 'Not authenticated',
          className: 'settings__status--warning'
        }
      case 'error':
        return {
          icon: <LuTriangleAlert size={14} />,
          text: 'Error checking authentication',
          className: 'settings__status--error'
        }
      default:
        return {
          icon: <LuInfo size={14} />,
          text: 'Unknown status',
          className: ''
        }
    }
  }

  const statusDisplay = getAuthStatusDisplay()
  const needsReauth = authStatus === 'not_authenticated' || authStatus === 'token_expired' || authStatus === 'error'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width={520}>
      <div className="settings">
        {/* AI Provider Section */}
        <div className="settings__section">
          <h3 className="settings__section-title">
            <LuSparkles size={14} />
            AI Provider
          </h3>

          {/* Claude Authentication Row */}
          <div className="settings__row settings__row--column">
            <div className="settings__row-info">
              <span className="settings__row-label">Claude Authentication</span>
              <span className="settings__row-desc">
                Uses your Claude CLI token (same as Claude Code / Cursor)
              </span>
            </div>

            {/* Status indicator */}
            <div className={`settings__status ${statusDisplay.className}`}>
              {statusDisplay.icon}
              {statusDisplay.text}
            </div>

            <div className="settings__auth-actions">
              {needsReauth && (
                <button
                  className="settings__auth-btn settings__auth-btn--primary"
                  onClick={handleOpenTerminalLogin}
                  disabled={isRefreshing || authStatus === 'checking'}
                >
                  <LuTerminal size={14} />
                  Re-authenticate with Claude
                </button>
              )}

              <button
                className="settings__auth-btn"
                onClick={handleRefreshAuth}
                disabled={isRefreshing || authStatus === 'checking'}
              >
                <LuRefreshCw size={14} className={isRefreshing ? 'settings__status-icon--spin' : ''} />
                {isRefreshing ? 'Checking...' : 'Refresh'}
              </button>
            </div>

            {/* Login message */}
            {loginMessage && (
              <div className="settings__login-message">
                {loginMessage}
              </div>
            )}
          </div>

          {/* Model Selector Row */}
          <div className="settings__row">
            <div className="settings__row-info">
              <span className="settings__row-label">Model</span>
              <span className="settings__row-desc">
                Select which Claude model to use
              </span>
            </div>

            <select
              className="settings__select"
              value={model}
              onChange={handleModelChange}
              disabled={!isConfigured}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="settings__section">
          <h3 className="settings__section-title">Appearance</h3>

          <div className="settings__row">
            <div className="settings__row-info">
              <span className="settings__row-label">Theme</span>
              <span className="settings__row-desc">
                Choose between light and dark mode
              </span>
            </div>

            <div className="settings__theme-toggle">
              <button
                className={`settings__theme-btn ${theme === 'light' ? 'settings__theme-btn--active' : ''}`}
                onClick={() => theme !== 'light' && toggleTheme()}
                aria-label="Light mode"
              >
                <LuSun size={16} />
                <span>Light</span>
              </button>
              <button
                className={`settings__theme-btn ${theme === 'dark' ? 'settings__theme-btn--active' : ''}`}
                onClick={() => theme !== 'dark' && toggleTheme()}
                aria-label="Dark mode"
              >
                <LuMoon size={16} />
                <span>Dark</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default SettingsModal
