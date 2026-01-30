import React from 'react'
import { LuSun, LuMoon } from 'react-icons/lu'
import { useTheme } from '../contexts/ThemeContext'
import Modal from './Modal'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width={480}>
      <div className="settings">
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
