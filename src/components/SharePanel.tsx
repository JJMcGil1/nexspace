import React, { useState } from 'react'
import { LuX, LuCopy, LuCheck, LuLink, LuMail, LuUsers, LuGlobe, LuLock } from 'react-icons/lu'
import { useCanvas } from '../contexts/CanvasContext'
import './SharePanel.css'

interface SharePanelProps {
  isOpen: boolean
  onClose: () => void
}

const SharePanel: React.FC<SharePanelProps> = ({ isOpen, onClose }) => {
  const { currentNexSpace } = useCanvas()
  const [copied, setCopied] = useState(false)
  const [accessLevel, setAccessLevel] = useState<'private' | 'anyone'>('private')

  const shareLink = `https://nexspace.app/s/${currentNexSpace?.id || 'demo'}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const nexspaceName = currentNexSpace?.title || 'Untitled Space'

  return (
    <div className={`share-panel ${isOpen ? 'share-panel--open' : ''}`}>
      {/* Header */}
      <div className="share-panel__header">
        <h2 className="share-panel__title">Share "{nexspaceName}"</h2>
        <button
          className="share-panel__close"
          onClick={onClose}
          aria-label="Close share panel"
        >
          <LuX size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="share-panel__content">
        {/* Link Section */}
        <div className="share-panel__section">
          <div className="share-panel__section-header">
            <LuLink size={16} />
            <span>Share link</span>
          </div>
          <div className="share-panel__link-row">
            <input
              type="text"
              className="share-panel__link-input"
              value={shareLink}
              readOnly
            />
            <button
              className={`share-panel__copy-btn ${copied ? 'share-panel__copy-btn--copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copied ? <LuCheck size={16} /> : <LuCopy size={16} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Access Level */}
        <div className="share-panel__section">
          <div className="share-panel__section-header">
            <LuUsers size={16} />
            <span>Who can access</span>
          </div>
          <div className="share-panel__access-options">
            <button
              className={`share-panel__access-option ${accessLevel === 'private' ? 'share-panel__access-option--active' : ''}`}
              onClick={() => setAccessLevel('private')}
            >
              <LuLock size={18} />
              <div className="share-panel__access-info">
                <span className="share-panel__access-label">Only people invited</span>
                <span className="share-panel__access-desc">Only specific people can view</span>
              </div>
            </button>
            <button
              className={`share-panel__access-option ${accessLevel === 'anyone' ? 'share-panel__access-option--active' : ''}`}
              onClick={() => setAccessLevel('anyone')}
            >
              <LuGlobe size={18} />
              <div className="share-panel__access-info">
                <span className="share-panel__access-label">Anyone with the link</span>
                <span className="share-panel__access-desc">Anyone can view with the link</span>
              </div>
            </button>
          </div>
        </div>

        {/* Invite Section */}
        <div className="share-panel__section">
          <div className="share-panel__section-header">
            <LuMail size={16} />
            <span>Invite people</span>
          </div>
          <div className="share-panel__invite-row">
            <input
              type="email"
              className="share-panel__invite-input"
              placeholder="Enter email address..."
            />
            <button className="share-panel__invite-btn">
              Invite
            </button>
          </div>
        </div>

        {/* Invited People (placeholder) */}
        <div className="share-panel__section">
          <div className="share-panel__people-list">
            <div className="share-panel__person">
              <div className="share-panel__person-avatar">You</div>
              <div className="share-panel__person-info">
                <span className="share-panel__person-name">You</span>
                <span className="share-panel__person-role">Owner</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SharePanel
