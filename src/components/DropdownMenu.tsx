import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './DropdownMenu.css'

export interface DropdownMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

interface DropdownMenuProps {
  items: DropdownMenuItem[]
  isOpen: boolean
  onClose: () => void
  onSelect: (itemId: string) => void
  anchorEl: HTMLElement | null
  align?: 'left' | 'right'
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  items,
  isOpen,
  onClose,
  onSelect,
  anchorEl,
  align = 'right',
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Handle open/close with animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setIsClosing(false)
    } else if (isVisible) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setIsClosing(false)
      }, 150) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Calculate position based on anchor element
  useEffect(() => {
    if (isVisible && anchorEl && menuRef.current) {
      const anchorRect = anchorEl.getBoundingClientRect()
      const menuRect = menuRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth

      let top = anchorRect.bottom + 4
      let left = align === 'right'
        ? anchorRect.right - menuRect.width
        : anchorRect.left

      // Flip up if not enough space below
      if (top + menuRect.height > viewportHeight - 8) {
        top = anchorRect.top - menuRect.height - 4
      }

      // Keep within horizontal bounds
      if (left < 8) {
        left = 8
      } else if (left + menuRect.width > viewportWidth - 8) {
        left = viewportWidth - menuRect.width - 8
      }

      setPosition({ top, left })
    }
  }, [isOpen, anchorEl, align])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Delay adding listener to prevent immediate close
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isVisible) return null

  const handleItemClick = (item: DropdownMenuItem) => {
    if (item.disabled || item.divider) return
    onSelect(item.id)
    onClose()
  }

  return createPortal(
    <div
      ref={menuRef}
      className={`dropdown-menu ${isClosing ? 'dropdown-menu--closing' : ''}`}
      style={{ top: position.top, left: position.left }}
      role="menu"
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`divider-${index}`} className="dropdown-menu__divider" />
        }

        return (
          <button
            key={item.id}
            className={`dropdown-menu__item ${item.danger ? 'dropdown-menu__item--danger' : ''} ${item.disabled ? 'dropdown-menu__item--disabled' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
          >
            {item.icon && <span className="dropdown-menu__icon">{item.icon}</span>}
            <span className="dropdown-menu__label">{item.label}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

export default DropdownMenu
