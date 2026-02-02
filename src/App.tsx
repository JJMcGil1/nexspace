import React, { useState, useCallback, useRef, useEffect } from 'react'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import ChatPanel from './components/ChatPanel'
import FlowCanvas from './components/FlowCanvas'
import SharePanel from './components/SharePanel'
import SettingsModal from './components/SettingsModal'
import DeleteConfirmationModal from './components/DeleteConfirmationModal'
import UpdateModal from './components/UpdateModal'
import Onboarding from './components/Onboarding'
import { useUser, NEXSPACE_COLORS } from './contexts/UserContext'
import { useCanvas } from './contexts/CanvasContext'
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
  const { onboardingComplete, isLoading, addNexSpace } = useUser()
  const { loadNexSpace } = useCanvas()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [canvasOpen, setCanvasOpen] = useState(true)
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const appBodyRef = useRef<HTMLDivElement>(null)

  // Sidebar toggles freely, but Chat/Canvas: at least one must stay open
  const toggleSidebar = () => setSidebarOpen((prev) => !prev)

  const toggleChat = () => {
    if (chatOpen && !canvasOpen) return // Can't close Chat if Canvas is closed
    setChatOpen((prev) => !prev)
  }

  const toggleCanvas = () => {
    if (canvasOpen && !chatOpen) return // Can't close Canvas if Chat is closed
    setCanvasOpen((prev) => !prev)
  }
  const openSettings = () => setSettingsOpen(true)
  const closeSettings = () => setSettingsOpen(false)
  const toggleShare = () => setShareOpen((prev) => !prev)
  const closeShare = () => setShareOpen(false)

  const handleNewCanvas = useCallback(async () => {
    const title = `Untitled Space ${Date.now().toString(36).slice(-4)}`
    const randomColor = NEXSPACE_COLORS[Math.floor(Math.random() * NEXSPACE_COLORS.length)]
    const newNexSpace = await addNexSpace(title, undefined, randomColor)
    // Load the new nexspace into canvas context
    await loadNexSpace(newNexSpace.id)
  }, [addNexSpace, loadNexSpace])

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

  // Show loading state while checking onboarding status
  if (isLoading) {
    return (
      <div className="app app--loading">
        <div className="app__loader">
          <div className="app__loader-spinner" />
        </div>
      </div>
    )
  }

  // Show onboarding if not completed
  if (!onboardingComplete) {
    return <Onboarding />
  }

  return (
    <div className={`app ${isResizing ? 'app--resizing' : ''}`}>
      <Titlebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        chatOpen={chatOpen}
        onToggleChat={toggleChat}
        canvasOpen={canvasOpen}
        onToggleCanvas={toggleCanvas}
        onNewCanvas={handleNewCanvas}
      />
      <div className="app__body" ref={appBodyRef}>
        <Sidebar isOpen={sidebarOpen} onOpenSettings={openSettings} />
        <ChatPanel
          isOpen={chatOpen}
          isFullWidth={!canvasOpen && !shareOpen}
          width={chatWidth}
          isResizing={isResizing}
        />
        {showResizeHandle && (
          <div
            className={`resize-handle ${isResizing ? 'resize-handle--active' : ''}`}
            onMouseDown={handleMouseDown}
          />
        )}
        <FlowCanvas isOpen={canvasOpen} isFullWidth={!chatOpen && !shareOpen} />
        {/* Share Panel - inside layout */}
        <SharePanel isOpen={shareOpen} onClose={closeShare} />
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={closeSettings} />

      {/* Global Delete Confirmation Modal */}
      <DeleteConfirmationModal />

      {/* Auto-Update Modal (Self-Signing with Hash Verification) */}
      <UpdateModal />
    </div>
  )
}

export default App
