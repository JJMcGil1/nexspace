import React from 'react'
import './Titlebar.css'

/**
 * Custom frameless titlebar.
 * - macOS: Leaves room for traffic-light buttons on the left.
 * - Windows/Linux: Renders minimize / maximize / close buttons on the right.
 * The entire bar is draggable (app-region: drag).
 */
const Titlebar: React.FC = () => {
  const isMac = window.electronAPI?.platform === 'darwin'

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <header className="titlebar drag-region">
      {/* macOS traffic-light spacer */}
      {isMac && <div className="titlebar__traffic-spacer" />}

      <span className="titlebar__title">NexSpace</span>

      <div className="titlebar__spacer" />

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
