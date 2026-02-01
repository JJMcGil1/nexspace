import React from 'react'
import { LuPanelLeft, LuLayoutGrid } from 'react-icons/lu'
import { RiChatAiLine } from 'react-icons/ri'
import Tooltip from './Tooltip'
import './LayoutToggleButtons.css'

interface LayoutToggleButtonsProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  chatOpen: boolean
  onToggleChat: () => void
  canvasOpen: boolean
  onToggleCanvas: () => void
}

const LayoutToggleButtons: React.FC<LayoutToggleButtonsProps> = ({
  sidebarOpen,
  onToggleSidebar,
  chatOpen,
  onToggleChat,
  canvasOpen,
  onToggleCanvas,
}) => {
  return (
    <div className="layout-toggles no-drag">
      <Tooltip content="Toggle Sidebar" position="bottom">
        <button
          className={`layout-toggle ${sidebarOpen ? 'layout-toggle--active' : ''}`}
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
        >
          <LuPanelLeft size={16} strokeWidth={1.5} />
        </button>
      </Tooltip>

      <Tooltip content="Toggle Chat" position="bottom">
        <button
          className={`layout-toggle ${chatOpen ? 'layout-toggle--active' : ''}`}
          onClick={onToggleChat}
          aria-label="Toggle Chat"
        >
          <RiChatAiLine size={16} />
        </button>
      </Tooltip>

      <Tooltip content="Toggle Canvas" position="bottom">
        <button
          className={`layout-toggle ${canvasOpen ? 'layout-toggle--active' : ''}`}
          onClick={onToggleCanvas}
          aria-label="Toggle Canvas"
        >
          <LuLayoutGrid size={16} strokeWidth={1.5} />
        </button>
      </Tooltip>
    </div>
  )
}

export default LayoutToggleButtons
