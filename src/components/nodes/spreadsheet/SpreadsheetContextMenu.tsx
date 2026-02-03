// ═══════════════════════════════════════════════════════════
// SpreadsheetContextMenu - Right-click context menu
// Full Google Sheets/Excel style context menu
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback } from 'react'
import {
  LuCopy,
  LuClipboard,
  LuScissors,
  LuTrash2,
  LuPlus,
  LuMinus,
  LuArrowUpDown,
  LuArrowLeftRight,
  LuAlignLeft,
  LuAlignCenter,
  LuAlignRight,
  LuBold,
  LuItalic,
  LuUnderline,
  LuPaintBucket,
  LuType,
  LuArrowUp,
  LuArrowDown,
  LuCombine,
  LuSplit,
  LuMessageSquare,
} from 'react-icons/lu'
import './SpreadsheetContextMenu.css'

export interface ContextMenuPosition {
  x: number
  y: number
}

export interface ContextMenuAction {
  id: string
  label: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  divider?: boolean
  submenu?: ContextMenuAction[]
  onClick?: () => void
}

interface SpreadsheetContextMenuProps {
  position: ContextMenuPosition
  onClose: () => void
  // Cell actions
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onDelete: () => void
  // Row/column actions
  onInsertRowAbove: () => void
  onInsertRowBelow: () => void
  onInsertColumnLeft: () => void
  onInsertColumnRight: () => void
  onDeleteRow: () => void
  onDeleteColumn: () => void
  // Sort actions
  onSortAscending: () => void
  onSortDescending: () => void
  // Format actions
  onFormatBold: () => void
  onFormatItalic: () => void
  onFormatUnderline: () => void
  onAlignLeft: () => void
  onAlignCenter: () => void
  onAlignRight: () => void
  // Merge
  onMergeCells: () => void
  onUnmergeCells: () => void
  canMerge: boolean
  canUnmerge: boolean
  // Comment
  onAddComment: () => void
  hasComment: boolean
  // Theme
  isDark: boolean
  // What's selected
  selectionType: 'cell' | 'row' | 'column' | 'range'
  hasSelection: boolean
  canPaste: boolean
}

const SpreadsheetContextMenu: React.FC<SpreadsheetContextMenuProps> = ({
  position,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDeleteRow,
  onDeleteColumn,
  onSortAscending,
  onSortDescending,
  onFormatBold,
  onFormatItalic,
  onFormatUnderline,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onMergeCells,
  onUnmergeCells,
  canMerge,
  canUnmerge,
  onAddComment,
  hasComment,
  isDark,
  selectionType,
  hasSelection,
  canPaste,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = position.x
      let adjustedY = position.y

      if (position.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8
      }
      if (position.y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8
      }

      menuRef.current.style.left = `${adjustedX}px`
      menuRef.current.style.top = `${adjustedY}px`
    }
  }, [position])

  const handleAction = useCallback((action: () => void) => {
    action()
    onClose()
  }, [onClose])

  const MenuItem: React.FC<{
    icon?: React.ReactNode
    label: string
    shortcut?: string
    disabled?: boolean
    onClick: () => void
  }> = ({ icon, label, shortcut, disabled, onClick }) => (
    <button
      className={`context-menu__item ${disabled ? 'context-menu__item--disabled' : ''}`}
      onClick={() => !disabled && handleAction(onClick)}
      disabled={disabled}
    >
      <span className="context-menu__item-icon">{icon}</span>
      <span className="context-menu__item-label">{label}</span>
      {shortcut && <span className="context-menu__item-shortcut">{shortcut}</span>}
    </button>
  )

  const Divider = () => <div className="context-menu__divider" />

  return (
    <div
      ref={menuRef}
      className={`context-menu ${isDark ? 'context-menu--dark' : 'context-menu--light'}`}
      style={{ left: position.x, top: position.y }}
    >
      {/* Clipboard Actions */}
      <MenuItem icon={<LuCopy size={14} />} label="Copy" shortcut="⌘C" onClick={onCopy} disabled={!hasSelection} />
      <MenuItem icon={<LuScissors size={14} />} label="Cut" shortcut="⌘X" onClick={onCut} disabled={!hasSelection} />
      <MenuItem icon={<LuClipboard size={14} />} label="Paste" shortcut="⌘V" onClick={onPaste} disabled={!canPaste} />
      <MenuItem icon={<LuTrash2 size={14} />} label="Clear contents" shortcut="Del" onClick={onDelete} disabled={!hasSelection} />

      <Divider />

      {/* Insert Options */}
      <div className="context-menu__submenu-trigger">
        <span className="context-menu__item-icon"><LuPlus size={14} /></span>
        <span className="context-menu__item-label">Insert</span>
        <span className="context-menu__item-arrow">›</span>
        <div className="context-menu__submenu">
          <MenuItem icon={<LuArrowUp size={14} />} label="Row above" onClick={onInsertRowAbove} />
          <MenuItem icon={<LuArrowDown size={14} />} label="Row below" onClick={onInsertRowBelow} />
          <Divider />
          <MenuItem icon={<LuArrowLeftRight size={14} />} label="Column left" onClick={onInsertColumnLeft} />
          <MenuItem icon={<LuArrowLeftRight size={14} />} label="Column right" onClick={onInsertColumnRight} />
        </div>
      </div>

      {/* Delete Options */}
      <div className="context-menu__submenu-trigger">
        <span className="context-menu__item-icon"><LuMinus size={14} /></span>
        <span className="context-menu__item-label">Delete</span>
        <span className="context-menu__item-arrow">›</span>
        <div className="context-menu__submenu">
          <MenuItem icon={<LuArrowUpDown size={14} />} label="Delete row" onClick={onDeleteRow} />
          <MenuItem icon={<LuArrowLeftRight size={14} />} label="Delete column" onClick={onDeleteColumn} />
        </div>
      </div>

      <Divider />

      {/* Merge Cells */}
      <MenuItem icon={<LuCombine size={14} />} label="Merge cells" onClick={onMergeCells} disabled={!canMerge} />
      <MenuItem icon={<LuSplit size={14} />} label="Unmerge cells" onClick={onUnmergeCells} disabled={!canUnmerge} />

      <Divider />

      {/* Comment */}
      <MenuItem
        icon={<LuMessageSquare size={14} />}
        label={hasComment ? "View/edit comment" : "Add comment"}
        onClick={onAddComment}
        disabled={!hasSelection}
      />

      <Divider />

      {/* Sort Options */}
      <div className="context-menu__submenu-trigger">
        <span className="context-menu__item-icon"><LuArrowUpDown size={14} /></span>
        <span className="context-menu__item-label">Sort</span>
        <span className="context-menu__item-arrow">›</span>
        <div className="context-menu__submenu">
          <MenuItem icon={<LuArrowUp size={14} />} label="Sort A → Z" onClick={onSortAscending} />
          <MenuItem icon={<LuArrowDown size={14} />} label="Sort Z → A" onClick={onSortDescending} />
        </div>
      </div>

      <Divider />

      {/* Format Options */}
      <div className="context-menu__submenu-trigger">
        <span className="context-menu__item-icon"><LuType size={14} /></span>
        <span className="context-menu__item-label">Format</span>
        <span className="context-menu__item-arrow">›</span>
        <div className="context-menu__submenu">
          <MenuItem icon={<LuBold size={14} />} label="Bold" shortcut="⌘B" onClick={onFormatBold} />
          <MenuItem icon={<LuItalic size={14} />} label="Italic" shortcut="⌘I" onClick={onFormatItalic} />
          <MenuItem icon={<LuUnderline size={14} />} label="Underline" shortcut="⌘U" onClick={onFormatUnderline} />
          <Divider />
          <MenuItem icon={<LuAlignLeft size={14} />} label="Align left" onClick={onAlignLeft} />
          <MenuItem icon={<LuAlignCenter size={14} />} label="Align center" onClick={onAlignCenter} />
          <MenuItem icon={<LuAlignRight size={14} />} label="Align right" onClick={onAlignRight} />
        </div>
      </div>
    </div>
  )
}

export default SpreadsheetContextMenu
