import React from 'react'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import ChatPanel from './components/ChatPanel'
import FlowCanvas from './components/FlowCanvas'
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
const App: React.FC = () => {
  return (
    <div className="app">
      <Titlebar />
      <div className="app__body">
        <Sidebar />
        <ChatPanel />
        <FlowCanvas />
      </div>
    </div>
  )
}

export default App
