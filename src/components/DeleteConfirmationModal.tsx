import React, { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LuTriangleAlert } from 'react-icons/lu'
import { useDeleteConfirmation } from '../contexts/DeleteConfirmationContext'
import './DeleteConfirmationModal.css'

const DeleteConfirmationModal: React.FC = () => {
  const { isOpen, options, hideDeleteConfirmation, confirm } = useDeleteConfirmation()

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideDeleteConfirmation()
    }
  }, [hideDeleteConfirmation])

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

  if (!isOpen || !options) return null

  return createPortal(
    <div className="delete-modal-overlay" onClick={hideDeleteConfirmation}>
      <div
        className="delete-modal"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
      >
        {/* Warning icon */}
        <div className="delete-modal__icon-wrapper">
          <LuTriangleAlert size={24} className="delete-modal__icon" />
        </div>

        {/* Content */}
        <div className="delete-modal__content">
          <h2 id="delete-modal-title" className="delete-modal__title">
            {options.title}
          </h2>
          <p id="delete-modal-description" className="delete-modal__message">
            {options.message}
            {options.itemName && (
              <span className="delete-modal__item-name">{options.itemName}</span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="delete-modal__actions">
          <button
            type="button"
            className="delete-modal__btn delete-modal__btn--cancel"
            onClick={hideDeleteConfirmation}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-modal__btn delete-modal__btn--delete"
            onClick={confirm}
            autoFocus
          >
            {options.confirmLabel || 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DeleteConfirmationModal
