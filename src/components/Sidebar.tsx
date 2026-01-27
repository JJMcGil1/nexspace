import React, { useState } from 'react'
import './Sidebar.css'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'canvas',
    label: 'Canvas',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'files',
    label: 'Files',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

const Sidebar: React.FC = () => {
  const [activeId, setActiveId] = useState('chat')
  const [expanded, setExpanded] = useState(false)

  return (
    <nav className={`sidebar ${expanded ? 'sidebar--expanded' : ''}`}>
      {/* Logo + toggle row */}
      <button
        className="sidebar__logo-btn"
        onClick={() => setExpanded((prev) => !prev)}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {expanded ? (
          /* Full logo with wordmark */
          <svg
            className="sidebar__logo-full"
            viewBox="0 0 280 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="NexSpace"
          >
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3"/>
              </linearGradient>
              <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
              <linearGradient id="docGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#e5e5e5"/>
              </linearGradient>
              <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
            <path d="M20 20 L32 32" stroke="url(#lineGrad)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M44 20 L32 32" stroke="url(#lineGrad)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M32 32 L20 44" stroke="url(#lineGrad)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M32 32 L44 44" stroke="url(#lineGrad)" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="12" y="12" width="16" height="16" rx="3" fill="url(#docGrad)"/>
            <rect x="15" y="16" width="7" height="1.5" rx="0.75" fill="#c4c4c4"/>
            <rect x="15" y="19.5" width="10" height="1.5" rx="0.75" fill="#c4c4c4"/>
            <rect x="15" y="23" width="5" height="1.5" rx="0.75" fill="#c4c4c4"/>
            <rect x="36" y="12" width="16" height="16" rx="3" fill="url(#nodeGrad)"/>
            <circle cx="44" cy="20" r="4" fill="white" fillOpacity="0.25"/>
            <circle cx="32" cy="32" r="7" fill="url(#nodeGrad)"/>
            <circle cx="32" cy="32" r="3" fill="white" fillOpacity="0.9"/>
            <rect x="12" y="36" width="16" height="16" rx="3" fill="#1e1e24" stroke="url(#nodeGrad)" strokeWidth="1.5"/>
            <rect x="16" y="40" width="4" height="4" rx="1" fill="url(#nodeGrad)" fillOpacity="0.5"/>
            <rect x="22" y="44" width="3" height="3" rx="0.75" fill="url(#nodeGrad)" fillOpacity="0.3"/>
            <rect x="36" y="36" width="16" height="16" rx="3" fill="#22c55e"/>
            <path d="M42 42 L46 42 L46 50 L42 50 Z" fill="white" fillOpacity="0.3"/>
            <path d="M44 44 L48 44 L48 48 L44 48 Z" fill="white" fillOpacity="0.5"/>
            <text x="70" y="46" fontFamily="'Space Grotesk', sans-serif" fontSize="44" fontWeight="600" letterSpacing="-1.5">
              <tspan fill="url(#textGrad)">Nex</tspan><tspan fill="#ffffff">Space</tspan>
            </text>
          </svg>
        ) : (
          /* Icon only */
          <svg
            className="sidebar__logo-icon"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="NexSpace"
          >
            <defs>
              <linearGradient id="lineGradI" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3"/>
              </linearGradient>
              <linearGradient id="nodeGradI" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
              <linearGradient id="docGradI" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#e5e5e5"/>
              </linearGradient>
            </defs>
            <path d="M20 20 L32 32" stroke="url(#lineGradI)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M44 20 L32 32" stroke="url(#lineGradI)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M32 32 L20 44" stroke="url(#lineGradI)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M32 32 L44 44" stroke="url(#lineGradI)" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="12" y="12" width="16" height="16" rx="3" fill="url(#docGradI)"/>
            <rect x="15" y="16" width="7" height="1.5" rx="0.75" fill="#c4c4c4"/>
            <rect x="15" y="19.5" width="10" height="1.5" rx="0.75" fill="#c4c4c4"/>
            <rect x="15" y="23" width="5" height="1.5" rx="0.75" fill="#c4c4c4"/>
            <rect x="36" y="12" width="16" height="16" rx="3" fill="url(#nodeGradI)"/>
            <circle cx="44" cy="20" r="4" fill="white" fillOpacity="0.25"/>
            <circle cx="32" cy="32" r="7" fill="url(#nodeGradI)"/>
            <circle cx="32" cy="32" r="3" fill="white" fillOpacity="0.9"/>
            <rect x="12" y="36" width="16" height="16" rx="3" fill="#1e1e24" stroke="url(#nodeGradI)" strokeWidth="1.5"/>
            <rect x="16" y="40" width="4" height="4" rx="1" fill="url(#nodeGradI)" fillOpacity="0.5"/>
            <rect x="22" y="44" width="3" height="3" rx="0.75" fill="url(#nodeGradI)" fillOpacity="0.3"/>
            <rect x="36" y="36" width="16" height="16" rx="3" fill="#22c55e"/>
            <path d="M42 42 L46 42 L46 50 L42 50 Z" fill="white" fillOpacity="0.3"/>
            <path d="M44 44 L48 44 L48 48 L44 48 Z" fill="white" fillOpacity="0.5"/>
          </svg>
        )}
      </button>

      <div className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar__item ${activeId === item.id ? 'sidebar__item--active' : ''}`}
            onClick={() => setActiveId(item.id)}
            title={!expanded ? item.label : undefined}
            aria-label={item.label}
          >
            <span className="sidebar__icon">{item.icon}</span>
            {expanded && <span className="sidebar__label">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Bottom section — user avatar / profile */}
      <div className="sidebar__footer">
        <button className="sidebar__item" title={!expanded ? 'Profile' : undefined} aria-label="Profile">
          <div className="sidebar__avatar">N</div>
          {expanded && <span className="sidebar__label">Profile</span>}
        </button>
      </div>
    </nav>
  )
}

export default Sidebar
