import React, { useState, useRef } from 'react'
import { LuSun, LuMoon, LuCheck, LuInfo, LuRefreshCw, LuTriangleAlert, LuTerminal, LuUser, LuPlug, LuPalette, LuCamera, LuSettings } from 'react-icons/lu'
import { useTheme } from '../contexts/ThemeContext'
import { useAI } from '../contexts/AIContext'
import { useUser, NEXSPACE_COLORS } from '../contexts/UserContext'
import Modal from './Modal'
import './SettingsModal.css'

type SettingsTab = 'account' | 'connections' | 'preferences'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme()
  const { authStatus, checkAuth } = useAI()
  const { user, setUser } = useUser()

  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loginMessage, setLoginMessage] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>('')

  // Get app version on mount
  React.useEffect(() => {
    window.electronAPI?.updater?.getVersion?.().then((version: string) => {
      setAppVersion(version || '0.0.0')
    })
  }, [])

  // Account editing state
  const [editName, setEditName] = useState(user?.name || '')
  const [editEmail, setEditEmail] = useState(user?.email || '')
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync edit state when user changes
  React.useEffect(() => {
    if (user) {
      setEditName(user.name)
      setEditEmail(user.email)
    }
  }, [user])

  const handleRefreshAuth = async () => {
    setIsRefreshing(true)
    setLoginMessage(null)
    await checkAuth()
    setIsRefreshing(false)
  }

  const handleOpenTerminalLogin = async () => {
    setIsRefreshing(true)
    setLoginMessage(null)

    const result = await window.electronAPI.claude.login()

    if (result.success && result.message) {
      setLoginMessage(result.message)
    } else if (result.error) {
      setLoginMessage(result.error)
    }

    setIsRefreshing(false)
  }

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return

    setIsSaving(true)
    await setUser({
      ...user,
      name: editName.trim(),
      email: editEmail.trim(),
    })
    setIsSaving(false)
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Convert to base64
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      await setUser({
        ...user,
        avatarImage: base64,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleColorChange = async (color: string) => {
    if (!user) return
    await setUser({
      ...user,
      avatarColor: color,
      avatarImage: undefined, // Clear image when selecting color
    })
  }

  const hasChanges = user && (editName !== user.name || editEmail !== user.email)

  const getAuthStatusDisplay = () => {
    switch (authStatus) {
      case 'checking':
        return {
          icon: <LuRefreshCw size={14} className="settings__status-icon--spin" />,
          text: 'Checking...',
          className: 'settings__auth-badge--checking'
        }
      case 'authenticated':
        return {
          icon: <LuCheck size={14} />,
          text: 'Connected',
          className: 'settings__auth-badge--connected'
        }
      case 'token_expired':
        return {
          icon: <LuTriangleAlert size={14} />,
          text: 'Expired',
          className: 'settings__auth-badge--error'
        }
      case 'not_authenticated':
        return {
          icon: <LuInfo size={14} />,
          text: 'Not connected',
          className: 'settings__auth-badge--disconnected'
        }
      case 'error':
        return {
          icon: <LuTriangleAlert size={14} />,
          text: 'Error',
          className: 'settings__auth-badge--error'
        }
      default:
        return {
          icon: <LuInfo size={14} />,
          text: 'Unknown',
          className: ''
        }
    }
  }

  const statusDisplay = getAuthStatusDisplay()
  const needsReauth = authStatus === 'not_authenticated' || authStatus === 'token_expired' || authStatus === 'error'
  const isChecking = authStatus === 'checking'

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: LuUser },
    { id: 'connections' as const, label: 'Connections', icon: LuPlug },
    { id: 'preferences' as const, label: 'Preferences', icon: LuPalette },
  ]

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" icon={<LuSettings size={18} />} width={640}>
      <div className="settings">
        {/* Sidebar */}
        <nav className="settings__sidebar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings__nav-item ${activeTab === tab.id ? 'settings__nav-item--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="settings__content">
          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="settings__panel">
              <div className="settings__panel-header">
                <h3 className="settings__panel-title">Account</h3>
                <p className="settings__panel-desc">Manage your profile information</p>
              </div>

              {/* Avatar Section */}
              <div className="settings__avatar-section">
                <button
                  className="settings__avatar-btn"
                  onClick={handleAvatarClick}
                  style={{
                    background: user?.avatarImage ? 'transparent' : user?.avatarColor || '#6366f1',
                  }}
                >
                  {user?.avatarImage ? (
                    <img src={user.avatarImage} alt={user.name} className="settings__avatar-img" />
                  ) : (
                    <span className="settings__avatar-initials">{getInitials(user?.name || 'U')}</span>
                  )}
                  <span className="settings__avatar-overlay">
                    <LuCamera size={20} />
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="settings__avatar-input"
                />

                {/* Color Picker */}
                <div className="settings__color-picker">
                  {NEXSPACE_COLORS.map(color => (
                    <button
                      key={color}
                      className={`settings__color-swatch ${user?.avatarColor === color && !user?.avatarImage ? 'settings__color-swatch--active' : ''}`}
                      style={{ background: color }}
                      onClick={() => handleColorChange(color)}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="settings__form">
                <div className="settings__field">
                  <label className="settings__label">Name</label>
                  <input
                    type="text"
                    className="settings__input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="settings__field">
                  <label className="settings__label">Email</label>
                  <input
                    type="email"
                    className="settings__input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                {hasChanges && (
                  <button
                    className="settings__save-btn"
                    onClick={handleSaveProfile}
                    disabled={isSaving || !editName.trim()}
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div className="settings__panel">
              <div className="settings__panel-header">
                <h3 className="settings__panel-title">Connections</h3>
                <p className="settings__panel-desc">Manage AI service connections</p>
              </div>

              <div className="settings__connection-card">
                <div className="settings__connection-header">
                  <div className="settings__connection-info">
                    <div className="settings__connection-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                    </div>
                    <div className="settings__connection-text">
                      <span className="settings__connection-name">Claude</span>
                      <span className="settings__connection-desc">Anthropic AI assistant</span>
                    </div>
                  </div>
                  <div className="settings__connection-actions">
                    <span className={`settings__auth-badge ${statusDisplay.className}`}>
                      {statusDisplay.icon}
                      {statusDisplay.text}
                    </span>
                    <button
                      className="settings__refresh-btn"
                      onClick={handleRefreshAuth}
                      disabled={isRefreshing || isChecking}
                      aria-label="Refresh status"
                    >
                      <LuRefreshCw size={14} className={isRefreshing ? 'settings__status-icon--spin' : ''} />
                    </button>
                  </div>
                </div>

                {needsReauth && (
                  <button
                    className="settings__connect-btn"
                    onClick={handleOpenTerminalLogin}
                    disabled={isRefreshing || isChecking}
                  >
                    <LuTerminal size={14} />
                    Connect
                  </button>
                )}

                {loginMessage && (
                  <div className="settings__login-message">
                    {loginMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="settings__panel">
              <div className="settings__panel-header">
                <h3 className="settings__panel-title">Preferences</h3>
                <p className="settings__panel-desc">Customize your experience</p>
              </div>

              <div className="settings__pref-row">
                <div className="settings__pref-info">
                  <span className="settings__pref-label">Theme</span>
                  <span className="settings__pref-desc">Switch between light and dark mode</span>
                </div>
                <button
                  className="settings__theme-switch"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  <span className={`settings__theme-option ${theme === 'light' ? 'settings__theme-option--active' : ''}`}>
                    <LuSun size={14} />
                  </span>
                  <span className={`settings__theme-option ${theme === 'dark' ? 'settings__theme-option--active' : ''}`}>
                    <LuMoon size={14} />
                  </span>
                  <span
                    className="settings__theme-slider"
                    style={{ transform: theme === 'dark' ? 'translateX(36px)' : 'translateX(0)' }}
                  />
                </button>
              </div>

              {/* Version Info */}
              <div className="settings__pref-row settings__pref-row--version">
                <div className="settings__pref-info">
                  <span className="settings__pref-label">Version</span>
                  <span className="settings__pref-desc">Current app version</span>
                </div>
                <span className="settings__version-badge">v{appVersion}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SettingsModal
