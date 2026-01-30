import React, { useState } from 'react'
import { LuSettings, LuSearch } from 'react-icons/lu'
import { HiOutlineDotsHorizontal } from 'react-icons/hi'
import './Sidebar.css'

interface Canvas {
  id: string
  title: string
  lastEdited: string
}

// Dummy data for canvases
const DUMMY_CANVASES: Canvas[] = [
  { id: '1', title: 'Product Roadmap Q1', lastEdited: '2 min ago' },
  { id: '2', title: 'Marketing Strategy', lastEdited: '1 hour ago' },
  { id: '3', title: 'Design System v2', lastEdited: '3 hours ago' },
  { id: '4', title: 'User Research Notes', lastEdited: 'Yesterday' },
  { id: '5', title: 'Sprint Planning', lastEdited: 'Yesterday' },
  { id: '6', title: 'Competitor Analysis', lastEdited: '2 days ago' },
  { id: '7', title: 'Brand Guidelines', lastEdited: '3 days ago' },
  { id: '8', title: 'Onboarding Flow', lastEdited: '1 week ago' },
]

interface SidebarProps {
  isOpen: boolean
  onOpenSettings: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onOpenSettings }) => {
  const [activeCanvasId, setActiveCanvasId] = useState('1')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCanvases = DUMMY_CANVASES.filter(canvas =>
    canvas.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleMenuClick = (e: React.MouseEvent, canvasId: string) => {
    e.stopPropagation()
    // TODO: Open context menu
    console.log('Menu clicked for canvas:', canvasId)
  }

  return (
    <nav className={`sidebar ${!isOpen ? 'sidebar--closed' : ''}`}>
      {/* Canvas list section */}
      <div className="sidebar__canvas-section">
        {/* Search */}
        <div className="sidebar__search">
          <LuSearch size={14} className="sidebar__search-icon" />
          <input
            type="text"
            placeholder="Search canvases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar__search-input"
          />
        </div>

        {/* Canvas list */}
        <div className="sidebar__canvas-list">
          {filteredCanvases.map((canvas) => {
            const isActive = activeCanvasId === canvas.id

            return (
              <div
                key={canvas.id}
                className={`sidebar__canvas-item ${isActive ? 'sidebar__canvas-item--active' : ''}`}
                onClick={() => setActiveCanvasId(canvas.id)}
                role="button"
                tabIndex={0}
              >
                {/* Active indicator bar */}
                <div className={`sidebar__canvas-indicator ${isActive ? 'sidebar__canvas-indicator--active' : ''}`} />

                {/* Canvas icon */}
                <div className={`sidebar__canvas-icon-wrapper ${isActive ? 'sidebar__canvas-icon-wrapper--active' : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="sidebar__canvas-svg">
                    <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "1" : "0.5"} />
                    <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "0.7" : "0.3"} />
                    <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "0.7" : "0.3"} />
                    <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "0.5" : "0.2"} />
                  </svg>
                </div>

                {/* Canvas info */}
                <div className="sidebar__canvas-content">
                  <span className="sidebar__canvas-title">{canvas.title}</span>
                  <span className="sidebar__canvas-time">{canvas.lastEdited}</span>
                </div>

                {/* More menu (visible on hover via CSS) */}
                <button
                  className="sidebar__canvas-menu"
                  onClick={(e) => handleMenuClick(e, canvas.id)}
                  aria-label="Canvas options"
                >
                  <HiOutlineDotsHorizontal size={16} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom section — settings, profile */}
      <div className="sidebar__footer">
        {/* Settings */}
        <button className="sidebar__item" aria-label="Settings" onClick={onOpenSettings}>
          <LuSettings size={18} className="sidebar__icon" />
          <span className="sidebar__label">Settings</span>
        </button>

        {/* User Profile */}
        <button className="sidebar__item sidebar__profile" aria-label="Profile">
          <div className="sidebar__avatar">N</div>
          <div className="sidebar__profile-info">
            <span className="sidebar__profile-name">NexSpace</span>
            <span className="sidebar__profile-email">user@nexspace.io</span>
          </div>
        </button>
      </div>
    </nav>
  )
}

export default Sidebar
