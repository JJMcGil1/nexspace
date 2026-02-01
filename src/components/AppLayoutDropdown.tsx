import React, { useState, useRef, useEffect } from 'react'
import { BsLayoutWtf } from 'react-icons/bs'
import { LuPanelLeft, LuLayoutGrid } from 'react-icons/lu'
import { RiChatAiLine } from 'react-icons/ri'
import './AppLayoutDropdown.css'

interface AppLayoutDropdownProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  chatOpen: boolean
  onToggleChat: () => void
  canvasOpen: boolean
  onToggleCanvas: () => void
}

const AppLayoutDropdown: React.FC<AppLayoutDropdownProps> = ({
  sidebarOpen,
  onToggleSidebar,
  chatOpen,
  onToggleChat,
  canvasOpen,
  onToggleCanvas,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const closeDropdown = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsOpen(false)
      setIsClosing(false)
    }, 150) // Match animation duration
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }

    if (isOpen && !isClosing) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, isClosing])

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown()
    } else {
      setIsOpen(true)
    }
  }

  return (
    <div className="app-layout-dropdown no-drag" ref={dropdownRef}>
      <button
        className="app-layout-dropdown__trigger"
        onClick={toggleDropdown}
        aria-label="Layout"
        title="Layout"
        aria-expanded={isOpen}
      >
        <BsLayoutWtf size={14} />
        <span>Layout</span>
      </button>

      {isOpen && (
        <div className={`app-layout-dropdown__menu ${isClosing ? 'app-layout-dropdown__menu--closing' : ''}`}>
          <button
            className={`app-layout-dropdown__item ${sidebarOpen ? 'app-layout-dropdown__item--active' : ''}`}
            onClick={() => onToggleSidebar()}
          >
            <LuPanelLeft size={16} />
            <span>Sidebar</span>
          </button>

          <button
            className={`app-layout-dropdown__item ${chatOpen ? 'app-layout-dropdown__item--active' : ''}`}
            onClick={() => onToggleChat()}
          >
            <RiChatAiLine size={16} />
            <span>Chat</span>
          </button>

          <button
            className={`app-layout-dropdown__item ${canvasOpen ? 'app-layout-dropdown__item--active' : ''}`}
            onClick={() => onToggleCanvas()}
          >
            <LuLayoutGrid size={16} />
            <span>Canvas</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default AppLayoutDropdown
