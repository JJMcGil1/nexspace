import React, { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'
import './Modal.css'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: number
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 440,
}) => {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="modal__header">
            <h2 id="modal-title" className="modal__title">{title}</h2>
            <button
              className="modal__close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <LuX size={18} />
            </button>
          </div>
        )}
        <div className="modal__content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal
