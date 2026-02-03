import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { NodeProps, useReactFlow } from '@xyflow/react'
import { IoMove } from 'react-icons/io5'
import { LuCopy, LuMaximize2, LuTrash2 } from 'react-icons/lu'
import { BsTable } from 'react-icons/bs'
import { useTheme } from '../../../contexts/ThemeContext'
import { useDeleteConfirmation } from '../../../contexts/DeleteConfirmationContext'
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
import './SpreadsheetNode.css'

type ResizeDirection = 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right'

const SpreadsheetNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { setNodes, getNodes } = useReactFlow()
  const { showDeleteConfirmation } = useDeleteConfirmation()

  const nodeData = useMemo(() => {
    const d = data as unknown as SpreadsheetNodeData
    return {
      ...createEmptySpreadsheet(),
      ...d,
    }
  }, [data])

  const [title, setTitle] = useState(nodeData.title || 'Untitled Spreadsheet')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [width, setWidth] = useState(nodeData.width || 500)
  const [height, setHeight] = useState(nodeData.height || 350)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStart = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: 0, height: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0 })
  const resizeDirection = useRef<ResizeDirection>('right')

  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce timer for saves
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Save to node data
  const saveData = useCallback((updates: Partial<SpreadsheetNodeData>) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      )
    }, 300)
  }, [id, setNodes])

  // Use spreadsheet hook
  const spreadsheet = useSpreadsheet({
    initialData: nodeData,
    onChange: saveData,
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
    moveSelection,
    copy,
    cut,
    paste,
    clearSelection,
  } = spreadsheet

  // Visible rows/cols for virtualization
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const HEADER_HEIGHT = 28
  const ROW_HEADER_WIDTH = 50

  // Calculate visible range
  const visibleRows = useMemo(() => {
    const viewportHeight = height - HEADER_HEIGHT - 60 // Account for header and footer
    let start = 0
    let accumulated = 0

    // Find start row
    for (let i = 0; i < rowCount; i++) {
      if (accumulated + (rowHeights[i] || DEFAULT_ROW_HEIGHT) > scrollTop) {
        start = i
        break
      }
      accumulated += rowHeights[i] || DEFAULT_ROW_HEIGHT
    }

    // Find end row
    let end = start
    accumulated = 0
    for (let i = start; i < rowCount; i++) {
      accumulated += rowHeights[i] || DEFAULT_ROW_HEIGHT
      end = i
      if (accumulated > viewportHeight + 50) break // Buffer
    }

    return { start, end: Math.min(end + 1, rowCount) }
  }, [scrollTop, height, rowCount, rowHeights])

  const visibleCols = useMemo(() => {
    const viewportWidth = width - ROW_HEADER_WIDTH - 10
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
      if (accumulated > viewportWidth + 100) break
    }

    return { start, end: Math.min(end + 1, colCount) }
  }, [scrollLeft, width, colCount, columnWidths])

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

  // Total dimensions
  const totalWidth = useMemo(() => {
    return columnWidths.reduce((sum, w) => sum + (w || DEFAULT_COL_WIDTH), 0)
  }, [columnWidths])

  const totalHeight = useMemo(() => {
    return rowHeights.reduce((sum, h) => sum + (h || DEFAULT_ROW_HEIGHT), 0)
  }, [rowHeights])

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)
    setScrollLeft(target.scrollLeft)
  }, [])

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (e.shiftKey && selection.activeCell) {
      selectCell(row, col, true)
    } else {
      selectCell(row, col)
    }
  }, [selectCell, selection.activeCell])

  // Handle cell double-click
  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    startEditing(row, col)
  }, [startEditing])

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
        spreadsheet.redo()
      } else {
        spreadsheet.undo()
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && selection.activeCell) {
      // Start typing in cell
      startEditing(selection.activeCell.row, selection.activeCell.col, e.key)
    }
  }, [editingCell, selection.activeCell, moveSelection, startEditing, commitEdit, cancelEdit, clearSelection, copy, cut, paste, spreadsheet])

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
    saveData({ title: newTitle })
  }, [saveData])

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

  // Sync title from props
  useEffect(() => {
    if (nodeData.title !== undefined && nodeData.title !== title) {
      setTitle(nodeData.title)
    }
  }, [nodeData.title])

  // Duplicate node
  const handleDuplicate = useCallback(() => {
    const nodes = getNodes()
    const currentNode = nodes.find((n) => n.id === id)
    if (!currentNode) return

    const newNode = {
      ...currentNode,
      id: `node-${Date.now()}`,
      position: {
        x: currentNode.position.x + 40,
        y: currentNode.position.y + 40,
      },
      data: { ...currentNode.data },
      selected: false,
    }
    setNodes((nds) => [...nds, newNode])
  }, [id, getNodes, setNodes])

  // Delete node
  const handleDelete = useCallback(() => {
    showDeleteConfirmation({
      title: 'Delete Spreadsheet',
      message: 'Are you sure you want to delete this spreadsheet? This action cannot be undone.',
      itemName: title,
      confirmLabel: 'Delete Spreadsheet',
      onConfirm: () => {
        setNodes((nds) => nds.filter((node) => node.id !== id))
      },
    })
  }, [id, setNodes, showDeleteConfirmation, title])

  // Fullscreen
  const handleFullscreen = useCallback(() => {
    const event = new CustomEvent('node-fullscreen', { detail: { nodeId: id } })
    window.dispatchEvent(event)
  }, [id])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()

    const nodes = getNodes()
    const currentNode = nodes.find((n) => n.id === id)
    if (!currentNode) return

    setIsResizing(true)
    resizeStart.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = { width, height }
    resizeStartPos.current = { x: currentNode.position.x, y: currentNode.position.y }
    resizeDirection.current = direction
  }, [width, height, getNodes, id])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const deltaX = e.clientX - resizeStart.current.x
    const deltaY = e.clientY - resizeStart.current.y
    const dir = resizeDirection.current

    if (dir === 'right' || dir === 'bottom-right') {
      const newWidth = Math.max(400, Math.min(1200, resizeStartSize.current.width + deltaX))
      setWidth(newWidth)
    } else if (dir === 'left' || dir === 'bottom-left') {
      const potentialWidth = resizeStartSize.current.width - deltaX
      const newWidth = Math.max(400, Math.min(1200, potentialWidth))
      const actualWidthDelta = resizeStartSize.current.width - newWidth
      const newX = resizeStartPos.current.x + actualWidthDelta

      setWidth(newWidth)
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, position: { ...node.position, x: newX } }
            : node
        )
      )
    }

    if (dir === 'bottom' || dir === 'bottom-left' || dir === 'bottom-right') {
      const newHeight = Math.max(250, Math.min(800, resizeStartSize.current.height + deltaY))
      setHeight(newHeight)
    }
  }, [isResizing, id, setNodes])

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return
    setIsResizing(false)
    saveData({ width, height })
  }, [isResizing, width, height, saveData])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // Sync dimensions from props
  useEffect(() => {
    if (nodeData.width !== undefined && nodeData.width !== width) {
      setWidth(nodeData.width)
    }
  }, [nodeData.width])

  useEffect(() => {
    if (nodeData.height !== undefined && nodeData.height !== height) {
      setHeight(nodeData.height)
    }
  }, [nodeData.height])

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Check if cell is selected
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

  return (
    <div
      className={`spreadsheet-node-wrapper ${isDark ? 'spreadsheet-node-wrapper--dark' : 'spreadsheet-node-wrapper--light'} ${isResizing ? 'spreadsheet-node-wrapper--resizing' : ''}`}
      style={{ width }}
    >
      {/* Resize handles */}
      <div
        className="spreadsheet-node__resize-handle spreadsheet-node__resize-handle--left nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'left')}
      />
      <div
        className="spreadsheet-node__resize-handle spreadsheet-node__resize-handle--right nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />
      <div
        className="spreadsheet-node__resize-handle spreadsheet-node__resize-handle--bottom nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />
      <div
        className="spreadsheet-node__resize-handle spreadsheet-node__resize-handle--bottom-left nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
      />
      <div
        className="spreadsheet-node__resize-handle spreadsheet-node__resize-handle--bottom-right nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
      />

      {/* Header row */}
      <div className="spreadsheet-node__header-row">
        <div className="spreadsheet-node__external-title">
          {isEditingTitle ? (
            <input
              type="text"
              className="spreadsheet-node__title-input"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          ) : (
            <span
              className="spreadsheet-node__title"
              onDoubleClick={(e) => {
                e.stopPropagation()
                setIsEditingTitle(true)
              }}
            >
              {title}
            </span>
          )}
        </div>

        <div className="spreadsheet-node__hover-nav">
          <button
            type="button"
            className="spreadsheet-node__hover-btn"
            onClick={handleDuplicate}
            title="Duplicate"
          >
            <LuCopy size={16} />
          </button>

          <button
            type="button"
            className="spreadsheet-node__hover-btn"
            onClick={handleFullscreen}
            title="Expand"
          >
            <LuMaximize2 size={16} />
          </button>

          <div className="spreadsheet-node__hover-nav-divider" />

          <div className="spreadsheet-node__hover-btn spreadsheet-node__drag-handle" title="Move">
            <IoMove size={16} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`spreadsheet-node__base ${isDark ? 'spreadsheet-node__base--dark' : 'spreadsheet-node__base--light'}`}
      >
        <div
          className={`spreadsheet-node ${isDark ? 'spreadsheet-node--dark' : 'spreadsheet-node--light'} ${selected ? 'spreadsheet-node--selected' : ''}`}
          style={{ height }}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Formula bar */}
          <div className="spreadsheet-node__formula-bar nodrag">
            <span className="spreadsheet-node__cell-address">
              {selection.activeCell ? cellAddress(selection.activeCell.row, selection.activeCell.col) : ''}
            </span>
            <span className="spreadsheet-node__formula-value">
              {selection.activeCell
                ? (cells[cellKey(selection.activeCell.row, selection.activeCell.col)]?.formula ||
                   getCellDisplayValue(selection.activeCell.row, selection.activeCell.col))
                : ''}
            </span>
          </div>

          {/* Grid container */}
          <div
            ref={gridRef}
            className="spreadsheet-node__grid-container nodrag nowheel"
            onScroll={handleScroll}
          >
            {/* Grid content with proper dimensions */}
            <div
              className="spreadsheet-node__grid-content"
              style={{
                width: totalWidth + ROW_HEADER_WIDTH,
                height: totalHeight + HEADER_HEIGHT,
              }}
            >
              {/* Column headers */}
              <div
                className="spreadsheet-node__column-headers"
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
                      className="spreadsheet-node__col-header"
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
                className="spreadsheet-node__row-headers"
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
                      className="spreadsheet-node__row-header"
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
                className="spreadsheet-node__corner-cell"
                style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }}
                onClick={() => spreadsheet.selectAll()}
              />

              {/* Cells */}
              <div
                className="spreadsheet-node__cells"
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
                        className={`spreadsheet-node__cell ${isSelected ? 'spreadsheet-node__cell--selected' : ''} ${isActive ? 'spreadsheet-node__cell--active' : ''}`}
                        style={{
                          left,
                          top,
                          width: colWidth,
                          height: rowHeight,
                          backgroundColor: cell?.style?.backgroundColor,
                          color: cell?.style?.color,
                          fontWeight: cell?.style?.fontWeight,
                          fontStyle: cell?.style?.fontStyle,
                          textAlign: cell?.style?.textAlign || 'left',
                        }}
                        onClick={(e) => handleCellClick(row, col, e)}
                        onDoubleClick={() => handleCellDoubleClick(row, col)}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            className="spreadsheet-node__cell-input"
                            value={editValue}
                            onChange={(e) => updateEditValue(e.target.value)}
                            onBlur={commitEdit}
                          />
                        ) : (
                          <span className={`spreadsheet-node__cell-value ${cell?.error ? 'spreadsheet-node__cell-value--error' : ''}`}>
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

        {/* Footer */}
        <div className="spreadsheet-node__type-footer">
          <div className="spreadsheet-node__type-badge">
            <BsTable size={16} className="spreadsheet-node__type-icon" />
          </div>
          <span className="spreadsheet-node__type-label">Spreadsheet</span>
          <button
            type="button"
            className="spreadsheet-node__footer-delete nodrag"
            onClick={handleDelete}
            title="Delete"
          >
            <LuTrash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SpreadsheetNode
