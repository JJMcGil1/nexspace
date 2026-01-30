import React, { useState, useCallback, useRef, useEffect } from 'react'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import ChatPanel from './components/ChatPanel'
import FlowCanvas from './components/FlowCanvas'
import SettingsModal from './components/SettingsModal'
import './App.css'

/**
 * Root application layout:
 *
 *  ┌─────────────────────────────────────────────────┐
 *  │                  TITLEBAR                       │
 *  ├────┬──────────────┬─────────────────────────────┤
 *  │    │              │                             │
 *  │ S  │    CHAT      │       REACT FLOW            │
 *  │ I  │    PANEL     │       CANVAS                │
 *  │ D  │              │                             │
 *  │ E  │              │                             │
 *  │ B  │              │                             │
 *  │ A  │              │                             │
 *  │ R  │              │                             │
 *  │    │              │                             │
 *  └────┴──────────────┴─────────────────────────────┘
 */
const MIN_CHAT_WIDTH = 280
const MAX_CHAT_WIDTH = 600
const DEFAULT_CHAT_WIDTH = 380

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [canvasOpen, setCanvasOpen] = useState(true)
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const appBodyRef = useRef<HTMLDivElement>(null)

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)
  const toggleChat = () => setChatOpen((prev) => !prev)
  const toggleCanvas = () => setCanvasOpen((prev) => !prev)
  const openSettings = () => setSettingsOpen(true)
  const closeSettings = () => setSettingsOpen(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !appBodyRef.current) return

    const appBodyRect = appBodyRef.current.getBoundingClientRect()
    const sidebarWidth = sidebarOpen ? 260 : 0
    const newWidth = e.clientX - appBodyRect.left - sidebarWidth

    setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, newWidth)))
  }, [isResizing, sidebarOpen])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Only show resize handle when both panels are open
  const showResizeHandle = chatOpen && canvasOpen

  return (
    <div className={`app ${isResizing ? 'app--resizing' : ''}`}>
      <Titlebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        chatOpen={chatOpen}
        onToggleChat={toggleChat}
        canvasOpen={canvasOpen}
        onToggleCanvas={toggleCanvas}
      />
      <div className="app__body" ref={appBodyRef}>
        <Sidebar isOpen={sidebarOpen} onOpenSettings={openSettings} />
        <ChatPanel
          isOpen={chatOpen}
          isFullWidth={!canvasOpen}
          width={chatWidth}
          isResizing={isResizing}
        />
        {showResizeHandle && (
          <div
            className={`resize-handle ${isResizing ? 'resize-handle--active' : ''}`}
            onMouseDown={handleMouseDown}
          />
        )}
        <FlowCanvas isOpen={canvasOpen} isFullWidth={!chatOpen} />
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={closeSettings} />
    </div>
  )
}

export default App
