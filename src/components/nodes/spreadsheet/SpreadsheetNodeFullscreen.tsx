import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { BsTable } from 'react-icons/bs'
import {
  LuBold,
  LuItalic,
  LuUnderline,
  LuStrikethrough,
  LuAlignLeft,
  LuAlignCenter,
  LuAlignRight,
  LuUndo2,
  LuRedo2,
} from 'react-icons/lu'
import { useTheme } from '../../../contexts/ThemeContext'
import { useSpreadsheet } from './useSpreadsheet'
import {
  SpreadsheetNodeData,
  cellKey,
  colToLetter,
  cellAddress,
  createEmptySpreadsheet,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
} from './types'
import './SpreadsheetNodeFullscreen.css'

interface SpreadsheetNodeFullscreenProps {
  nodeId: string
  title: string
  data: SpreadsheetNodeData
  onClose: () => void
  onUpdate: (nodeId: string, data: Partial<SpreadsheetNodeData>) => void
}

const SpreadsheetNodeFullscreen: React.FC<SpreadsheetNodeFullscreenProps> = ({
  nodeId,
  title: initialTitle,
  data: initialData,
  onClose,
  onUpdate,
}) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [title, setTitle] = useState(initialTitle || 'Untitled Spreadsheet')
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const nodeData = useMemo(() => ({
    ...createEmptySpreadsheet(),
    ...initialData,
  }), [initialData])

  // Save handler
  const handleChange = useCallback((updates: Partial<SpreadsheetNodeData>) => {
    onUpdate(nodeId, updates)
  }, [nodeId, onUpdate])

  const spreadsheet = useSpreadsheet({
    initialData: nodeData,
    onChange: handleChange,
  })

  const {
    cells,
    rowCount,
    colCount,
    columnWidths,
    rowHeights,
    selection,
    selectCell,
    selectRow,
    selectColumn,
    editingCell,
    editValue,
    startEditing,
    updateEditValue,
    commitEdit,
    cancelEdit,
    getCellDisplayValue,
    getCell,
    updateCellStyle,
    moveSelection,
    copy,
    cut,
    paste,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
  } = spreadsheet

  // Scroll state
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const HEADER_HEIGHT = 32
  const ROW_HEADER_WIDTH = 60
  const VIEWPORT_HEIGHT = window.innerHeight - 200
  const VIEWPORT_WIDTH = window.innerWidth - 100

  // Calculate visible range
  const visibleRows = useMemo(() => {
    let start = 0
    let accumulated = 0

    for (let i = 0; i < rowCount; i++) {
      if (accumulated + (rowHeights[i] || DEFAULT_ROW_HEIGHT) > scrollTop) {
        start = i
        break
      }
      accumulated += rowHeights[i] || DEFAULT_ROW_HEIGHT
    }

    let end = start
    accumulated = 0
    for (let i = start; i < rowCount; i++) {
      accumulated += rowHeights[i] || DEFAULT_ROW_HEIGHT
      end = i
      if (accumulated > VIEWPORT_HEIGHT + 100) break
    }

    return { start, end: Math.min(end + 1, rowCount) }
  }, [scrollTop, rowCount, rowHeights, VIEWPORT_HEIGHT])

  const visibleCols = useMemo(() => {
    let start = 0
    let accumulated = 0

    for (let i = 0; i < colCount; i++) {
      if (accumulated + (columnWidths[i] || DEFAULT_COL_WIDTH) > scrollLeft) {
        start = i
        break
      }
      accumulated += columnWidths[i] || DEFAULT_COL_WIDTH
    }

    let end = start
    accumulated = 0
    for (let i = start; i < colCount; i++) {
      accumulated += columnWidths[i] || DEFAULT_COL_WIDTH
      end = i
      if (accumulated > VIEWPORT_WIDTH + 200) break
    }

    return { start, end: Math.min(end + 1, colCount) }
  }, [scrollLeft, colCount, columnWidths, VIEWPORT_WIDTH])

  // Calculate positions
  const getColumnLeft = useCallback((col: number) => {
    let left = 0
    for (let i = 0; i < col; i++) {
      left += columnWidths[i] || DEFAULT_COL_WIDTH
    }
    return left
  }, [columnWidths])

  const getRowTop = useCallback((row: number) => {
    let top = 0
    for (let i = 0; i < row; i++) {
      top += rowHeights[i] || DEFAULT_ROW_HEIGHT
    }
    return top
  }, [rowHeights])

  const totalWidth = useMemo(() => {
    if (!Array.isArray(columnWidths)) return colCount * DEFAULT_COL_WIDTH
    return columnWidths.reduce((sum, w) => sum + (w || DEFAULT_COL_WIDTH), 0)
  }, [columnWidths, colCount])

  const totalHeight = useMemo(() => {
    if (!Array.isArray(rowHeights)) return rowCount * DEFAULT_ROW_HEIGHT
    return rowHeights.reduce((sum, h) => sum + (h || DEFAULT_ROW_HEIGHT), 0)
  }, [rowHeights, rowCount])

  // Scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)
    setScrollLeft(target.scrollLeft)
  }, [])

  // Cell handlers
  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (e.shiftKey && selection.activeCell) {
      selectCell(row, col, true)
    } else {
      selectCell(row, col)
    }
  }, [selectCell, selection.activeCell])

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    startEditing(row, col)
  }, [startEditing])

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !editingCell) {
      onClose()
      return
    }

    if (editingCell) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitEdit()
        moveSelection('down')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        commitEdit()
        moveSelection(e.shiftKey ? 'left' : 'right')
      } else if (e.key === 'Escape') {
        cancelEdit()
      }
      return
    }

    // Navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveSelection('up', e.shiftKey)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveSelection('down', e.shiftKey)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      moveSelection('left', e.shiftKey)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      moveSelection('right', e.shiftKey)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      moveSelection(e.shiftKey ? 'left' : 'right')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selection.activeCell) {
        startEditing(selection.activeCell.row, selection.activeCell.col)
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      clearSelection()
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      copy()
    } else if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      cut()
    } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      paste()
    } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      spreadsheet.selectAll()
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (e.shiftKey) {
        redo()
      } else {
        undo()
      }
    } else if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      applyStyle('fontWeight', 'bold')
    } else if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      applyStyle('fontStyle', 'italic')
    } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      applyStyle('textDecoration', 'underline')
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && selection.activeCell) {
      startEditing(selection.activeCell.row, selection.activeCell.col, e.key)
    }
  }, [editingCell, selection.activeCell, moveSelection, startEditing, commitEdit, cancelEdit, clearSelection, copy, cut, paste, spreadsheet, undo, redo, onClose])

  // Apply style to selection
  const applyStyle = useCallback((property: string, value: string) => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = getCell(r, c)
        const currentValue = cell?.style?.[property as keyof typeof cell.style]
        const newValue = currentValue === value ? undefined : value
        updateCellStyle(r, c, { [property]: newValue })
      }
    }
  }, [selection.range, getCell, updateCellStyle])

  // Focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  // Title handlers
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle)
    onUpdate(nodeId, { title: newTitle })
  }, [nodeId, onUpdate])

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false)
    if (!title.trim()) {
      handleTitleChange('Untitled Spreadsheet')
    }
  }, [title, handleTitleChange])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault()
      setIsEditingTitle(false)
    }
  }, [])

  // Cell selection helpers
  const isCellSelected = useCallback((row: number, col: number) => {
    if (!selection.range) return false
    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }, [selection.range])

  const isCellActive = useCallback((row: number, col: number) => {
    return selection.activeCell?.row === row && selection.activeCell?.col === col
  }, [selection.activeCell])

  // Get current cell style for toolbar state
  const activeStyle = useMemo(() => {
    if (!selection.activeCell) return {}
    const cell = getCell(selection.activeCell.row, selection.activeCell.col)
    return cell?.style || {}
  }, [selection.activeCell, getCell])

  return (
    <div className={`spreadsheet-fullscreen ${isDark ? 'spreadsheet-fullscreen--dark' : 'spreadsheet-fullscreen--light'}`}>
      <div className="spreadsheet-fullscreen__modal" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Header */}
        <div className="spreadsheet-fullscreen__header">
          <div className="spreadsheet-fullscreen__header-left">
            <div className="spreadsheet-fullscreen__icon">
              <BsTable size={20} />
            </div>
            {isEditingTitle ? (
              <input
                type="text"
                className="spreadsheet-fullscreen__title-input"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                autoFocus
              />
            ) : (
              <h2
                className="spreadsheet-fullscreen__title"
                onClick={() => setIsEditingTitle(true)}
              >
                {title}
              </h2>
            )}
          </div>
          <div className="spreadsheet-fullscreen__header-right">
            <span className="spreadsheet-fullscreen__hint">Press ESC to close</span>
            <button
              className="spreadsheet-fullscreen__close-btn"
              onClick={onClose}
              title="Close (ESC)"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="spreadsheet-fullscreen__toolbar">
          <div className="spreadsheet-fullscreen__toolbar-group">
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${canUndo ? '' : 'disabled'}`}
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <LuUndo2 size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${canRedo ? '' : 'disabled'}`}
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <LuRedo2 size={16} />
            </button>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          <div className="spreadsheet-fullscreen__toolbar-group">
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${activeStyle.fontWeight === 'bold' ? 'active' : ''}`}
              onClick={() => applyStyle('fontWeight', 'bold')}
              title="Bold (Ctrl+B)"
            >
              <LuBold size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${activeStyle.fontStyle === 'italic' ? 'active' : ''}`}
              onClick={() => applyStyle('fontStyle', 'italic')}
              title="Italic (Ctrl+I)"
            >
              <LuItalic size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${activeStyle.textDecoration === 'underline' ? 'active' : ''}`}
              onClick={() => applyStyle('textDecoration', 'underline')}
              title="Underline (Ctrl+U)"
            >
              <LuUnderline size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${activeStyle.textDecoration === 'line-through' ? 'active' : ''}`}
              onClick={() => applyStyle('textDecoration', 'line-through')}
              title="Strikethrough"
            >
              <LuStrikethrough size={16} />
            </button>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          <div className="spreadsheet-fullscreen__toolbar-group">
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${activeStyle.textAlign === 'left' ? 'active' : ''}`}
              onClick={() => applyStyle('textAlign', 'left')}
              title="Align Left"
            >
              <LuAlignLeft size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${activeStyle.textAlign === 'center' ? 'active' : ''}`}
              onClick={() => applyStyle('textAlign', 'center')}
              title="Align Center"
            >
              <LuAlignCenter size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${activeStyle.textAlign === 'right' ? 'active' : ''}`}
              onClick={() => applyStyle('textAlign', 'right')}
              title="Align Right"
            >
              <LuAlignRight size={16} />
            </button>
          </div>
        </div>

        {/* Formula bar */}
        <div className="spreadsheet-fullscreen__formula-bar">
          <span className="spreadsheet-fullscreen__cell-address">
            {selection.activeCell ? cellAddress(selection.activeCell.row, selection.activeCell.col) : ''}
          </span>
          <span className="spreadsheet-fullscreen__formula-value">
            {selection.activeCell
              ? (cells[cellKey(selection.activeCell.row, selection.activeCell.col)]?.formula ||
                 getCellDisplayValue(selection.activeCell.row, selection.activeCell.col))
              : ''}
          </span>
        </div>

        {/* Grid */}
        <div className="spreadsheet-fullscreen__content">
          <div
            ref={gridRef}
            className="spreadsheet-fullscreen__grid-container"
            onScroll={handleScroll}
          >
            <div
              className="spreadsheet-fullscreen__grid-content"
              style={{
                width: totalWidth + ROW_HEADER_WIDTH,
                height: totalHeight + HEADER_HEIGHT,
              }}
            >
              {/* Column headers */}
              <div
                className="spreadsheet-fullscreen__column-headers"
                style={{
                  left: ROW_HEADER_WIDTH - scrollLeft,
                  height: HEADER_HEIGHT,
                }}
              >
                {Array.from({ length: visibleCols.end - visibleCols.start }).map((_, i) => {
                  const col = visibleCols.start + i
                  const left = getColumnLeft(col)
                  const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                  return (
                    <div
                      key={col}
                      className="spreadsheet-fullscreen__col-header"
                      style={{
                        left: left,
                        width: colWidth,
                        height: HEADER_HEIGHT,
                      }}
                      onClick={() => selectColumn(col)}
                    >
                      {colToLetter(col)}
                    </div>
                  )
                })}
              </div>

              {/* Row headers */}
              <div
                className="spreadsheet-fullscreen__row-headers"
                style={{
                  top: HEADER_HEIGHT - scrollTop,
                  width: ROW_HEADER_WIDTH,
                }}
              >
                {Array.from({ length: visibleRows.end - visibleRows.start }).map((_, i) => {
                  const row = visibleRows.start + i
                  const top = getRowTop(row)
                  const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT
                  return (
                    <div
                      key={row}
                      className="spreadsheet-fullscreen__row-header"
                      style={{
                        top: top,
                        height: rowHeight,
                        width: ROW_HEADER_WIDTH,
                      }}
                      onClick={() => selectRow(row)}
                    >
                      {row + 1}
                    </div>
                  )
                })}
              </div>

              {/* Corner cell */}
              <div
                className="spreadsheet-fullscreen__corner-cell"
                style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }}
                onClick={() => spreadsheet.selectAll()}
              />

              {/* Cells */}
              <div
                className="spreadsheet-fullscreen__cells"
                style={{
                  left: ROW_HEADER_WIDTH,
                  top: HEADER_HEIGHT,
                  width: totalWidth,
                  height: totalHeight,
                }}
              >
                {Array.from({ length: visibleRows.end - visibleRows.start }).map((_, ri) => {
                  const row = visibleRows.start + ri
                  const top = getRowTop(row) - scrollTop
                  const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT

                  return Array.from({ length: visibleCols.end - visibleCols.start }).map((_, ci) => {
                    const col = visibleCols.start + ci
                    const left = getColumnLeft(col) - scrollLeft
                    const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                    const isActive = isCellActive(row, col)
                    const isSelected = isCellSelected(row, col)
                    const isEditing = editingCell?.row === row && editingCell?.col === col
                    const cell = cells[cellKey(row, col)]

                    return (
                      <div
                        key={`${row}-${col}`}
                        className={`spreadsheet-fullscreen__cell ${isSelected ? 'spreadsheet-fullscreen__cell--selected' : ''} ${isActive ? 'spreadsheet-fullscreen__cell--active' : ''}`}
                        style={{
                          left,
                          top,
                          width: colWidth,
                          height: rowHeight,
                          backgroundColor: cell?.style?.backgroundColor,
                          color: cell?.style?.color,
                          fontWeight: cell?.style?.fontWeight,
                          fontStyle: cell?.style?.fontStyle,
                          textDecoration: cell?.style?.textDecoration,
                          textAlign: cell?.style?.textAlign || 'left',
                        }}
                        onClick={(e) => handleCellClick(row, col, e)}
                        onDoubleClick={() => handleCellDoubleClick(row, col)}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            className="spreadsheet-fullscreen__cell-input"
                            value={editValue}
                            onChange={(e) => updateEditValue(e.target.value)}
                            onBlur={commitEdit}
                          />
                        ) : (
                          <span className={`spreadsheet-fullscreen__cell-value ${cell?.error ? 'spreadsheet-fullscreen__cell-value--error' : ''}`}>
                            {getCellDisplayValue(row, col)}
                          </span>
                        )}
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SpreadsheetNodeFullscreen
