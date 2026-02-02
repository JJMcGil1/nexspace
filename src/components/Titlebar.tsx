import React, { useState, useRef, useEffect, useCallback } from 'react'
import { LuPlus, LuSearch, LuX } from 'react-icons/lu'
import { IoDocumentText } from 'react-icons/io5'
import { useTheme } from '../contexts/ThemeContext'
import { useCanvas } from '../contexts/CanvasContext'
import LayoutToggleButtons from './LayoutToggleButtons'
import './Titlebar.css'

interface TitlebarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  chatOpen: boolean
  onToggleChat: () => void
  canvasOpen: boolean
  onToggleCanvas: () => void
  onNewCanvas?: () => void
}

/**
 * Custom frameless titlebar.
 * - macOS: Leaves room for traffic-light buttons on the left.
 * - Windows/Linux: Renders minimize / maximize / close buttons on the right.
 * The entire bar is draggable (app-region: drag).
 */
const Titlebar: React.FC<TitlebarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  chatOpen,
  onToggleChat,
  canvasOpen,
  onToggleCanvas,
  onNewCanvas,
}) => {
  const { theme } = useTheme()
  const { currentNexSpace, nodes } = useCanvas()
  const isMac = window.electronAPI?.platform === 'darwin'
  const isDark = theme === 'dark'

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  // Filter nodes based on search query - show all when no query
  const filteredNodes = searchQuery.trim()
    ? nodes.filter(node => {
        const title = String(node.data?.title || node.data?.label || '')
        const content = String(node.data?.content || '')
        const searchLower = searchQuery.toLowerCase()
        return title.toLowerCase().includes(searchLower) ||
               content.toLowerCase().includes(searchLower)
      })
    : nodes

  // Handle node selection - dispatch event to focus on node in canvas
  const handleSelectNode = useCallback((nodeId: string) => {
    window.dispatchEvent(new CustomEvent('nexspace:focus-node', { detail: { nodeId } }))
    setSearchQuery('')
    setIsSearchFocused(false)
    searchInputRef.current?.blur()
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!filteredNodes.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredNodes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filteredNodes[selectedIndex]) {
      e.preventDefault()
      handleSelectNode(filteredNodes[selectedIndex].id)
    } else if (e.key === 'Escape') {
      setSearchQuery('')
      setIsSearchFocused(false)
      searchInputRef.current?.blur()
    }
  }, [filteredNodes, selectedIndex, handleSelectNode])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Click outside to close dropdown - only listen when focused
  useEffect(() => {
    if (!isSearchFocused) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false)
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }

    // Use setTimeout to avoid the same click that opened it from closing it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSearchFocused])

  // Truncate long nexspace names for placeholder
  const fullNexspaceName = currentNexSpace?.title || 'NexSpace'
  const nexspaceName = fullNexspaceName.length > 20
    ? fullNexspaceName.slice(0, 20) + '...'
    : fullNexspaceName

  return (
    <header className="titlebar drag-region">
      {/* macOS traffic-light spacer */}
      {isMac && <div className="titlebar__traffic-spacer" />}

      {/* Logo */}
      <div className="titlebar__logo">
        <svg viewBox="0 0 280 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="titlebar__logo-svg">
          <defs>
            <linearGradient id="lineGradTB" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={isDark ? 0.6 : 0.5}/>
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={isDark ? 0.3 : 0.25}/>
            </linearGradient>
            <linearGradient id="nodeGradTB" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1"/>
              <stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
            <linearGradient id="docGradTB" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? "#ffffff" : "#f5f5f5"}/>
              <stop offset="100%" stopColor={isDark ? "#e5e5e5" : "#e8e8e8"}/>
            </linearGradient>
            <linearGradient id="textGradTB" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1"/>
              <stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
          </defs>
          {/* Icon */}
          <path d="M20 20 L32 32" stroke="url(#lineGradTB)" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M44 20 L32 32" stroke="url(#lineGradTB)" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M32 32 L20 44" stroke="url(#lineGradTB)" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M32 32 L44 44" stroke="url(#lineGradTB)" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="12" y="12" width="16" height="16" rx="3" fill="url(#docGradTB)" stroke={isDark ? "none" : "#e0e0e0"} strokeWidth="1"/>
          <rect x="15" y="16" width="7" height="1.5" rx="0.75" fill={isDark ? "#c4c4c4" : "#d4d4d4"}/>
          <rect x="15" y="19.5" width="10" height="1.5" rx="0.75" fill={isDark ? "#c4c4c4" : "#d4d4d4"}/>
          <rect x="15" y="23" width="5" height="1.5" rx="0.75" fill={isDark ? "#c4c4c4" : "#d4d4d4"}/>
          <rect x="36" y="12" width="16" height="16" rx="3" fill="url(#nodeGradTB)"/>
          <circle cx="44" cy="20" r="4" fill="white" fillOpacity="0.25"/>
          <circle cx="32" cy="32" r="7" fill="url(#nodeGradTB)"/>
          <circle cx="32" cy="32" r="3" fill="white" fillOpacity="0.9"/>
          <rect x="12" y="36" width="16" height="16" rx="3" fill={isDark ? "#1e1e24" : "#fafafa"} stroke="url(#nodeGradTB)" strokeWidth="1.5"/>
          <rect x="16" y="40" width="4" height="4" rx="1" fill="url(#nodeGradTB)" fillOpacity={isDark ? 0.5 : 0.4}/>
          <rect x="22" y="44" width="3" height="3" rx="0.75" fill="url(#nodeGradTB)" fillOpacity={isDark ? 0.3 : 0.25}/>
          <rect x="36" y="36" width="16" height="16" rx="3" fill="#22c55e"/>
          <path d="M42 42 L46 42 L46 50 L42 50 Z" fill="white" fillOpacity="0.3"/>
          <path d="M44 44 L48 44 L48 48 L44 48 Z" fill="white" fillOpacity="0.5"/>
          {/* Text */}
          <text x="70" y="46" fontFamily="'Space Grotesk', sans-serif" fontSize="44" fontWeight="600" letterSpacing="-1.5">
            <tspan fill="url(#textGradTB)">Nex</tspan><tspan fill={isDark ? "#ffffff" : "#0a0a0b"}>Space</tspan>
          </text>
        </svg>
      </div>

      {/* Layout toggles - positioned left of center */}
      <div className="titlebar__layout-toggles-wrapper no-drag">
        <LayoutToggleButtons
          sidebarOpen={sidebarOpen}
          onToggleSidebar={onToggleSidebar}
          chatOpen={chatOpen}
          onToggleChat={onToggleChat}
          canvasOpen={canvasOpen}
          onToggleCanvas={onToggleCanvas}
        />
      </div>

      {/* Search bar - centered */}
      <div className="titlebar__search-container no-drag" ref={dropdownRef}>
        <div className={`titlebar__search ${isSearchFocused ? 'titlebar__search--focused' : ''}`}>
          <LuSearch className="titlebar__search-icon" size={14} />
          <input
            ref={searchInputRef}
            type="text"
            className="titlebar__search-input"
            placeholder={`Search ${nexspaceName}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={handleKeyDown}
          />
          {searchQuery && (
            <button
              className="titlebar__search-clear"
              onClick={() => {
                setSearchQuery('')
                searchInputRef.current?.focus()
              }}
              aria-label="Clear search"
            >
              <LuX size={12} />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {isSearchFocused && (
          <div className="titlebar__search-dropdown">
            {filteredNodes.length > 0 ? (
              filteredNodes.slice(0, 8).map((node, index) => (
                <button
                  key={node.id}
                  className={`titlebar__search-result ${index === selectedIndex ? 'titlebar__search-result--selected' : ''}`}
                  onClick={() => handleSelectNode(node.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="titlebar__search-result-left">
                    <IoDocumentText className="titlebar__search-result-icon" size={14} />
                    <span className="titlebar__search-result-title">
                      {String(node.data?.title || node.data?.label || 'Untitled')}
                    </span>
                  </div>
                  <span className="titlebar__search-result-type">
                    Document
                  </span>
                </button>
              ))
            ) : (
              <div className="titlebar__search-empty">
                No nodes in this NexSpace
              </div>
            )}
          </div>
        )}
      </div>

      <div className="titlebar__spacer" />

      {/* New NexSpace button */}
      <button
        className="titlebar__new-canvas no-drag"
        onClick={onNewCanvas}
        aria-label="New NexSpace"
      >
        <LuPlus size={14} />
        <span>New NexSpace</span>
      </button>

      {/* Windows / Linux controls */}
      {!isMac && (
        <div className="titlebar__controls no-drag">
          <button
            className="titlebar__btn"
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="titlebar__btn"
            onClick={handleMaximize}
            aria-label="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="0.5"
                y="0.5"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          </button>
          <button
            className="titlebar__btn titlebar__btn--close"
            onClick={handleClose}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
              <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      )}
    </header>
  )
}

export default Titlebar
