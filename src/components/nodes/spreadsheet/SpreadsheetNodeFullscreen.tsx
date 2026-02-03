import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { BsFileSpreadsheetFill } from 'react-icons/bs'
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
  LuArrowUp,
  LuArrowDown,
  LuDownload,
  LuUpload,
  LuSearch,
  LuX,
  LuChevronDown,
  LuDollarSign,
  LuPercent,
  LuHash,
  LuCalendar,
  LuType,
  LuPaintBucket,
  LuPanelLeftClose,
  LuPanelTopClose,
  LuGrid2X2,
  LuSquare,
  LuGrid3X3,
  LuCombine,
  LuSplit,
  LuPalette,
  LuTrash2,
  LuPlus,
  LuListChecks,
  LuChevronRight,
  LuMessageSquare,
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
  Cell,
  ConditionalFormatRule,
  ConditionalFormatType,
  CellRange,
} from './types'
import { formatNumber, FORMAT_PRESETS } from './formatUtils'
import SpreadsheetContextMenu, { ContextMenuPosition } from './SpreadsheetContextMenu'
import ConditionalFormattingDialog from './ConditionalFormattingDialog'
import DataValidationDialog from './DataValidationDialog'
import CellCommentPopup from './CellCommentPopup'
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
  const [isClosing, setIsClosing] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null)

  // Find/Replace state
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findValue, setFindValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [findResults, setFindResults] = useState<{ row: number; col: number }[]>([])
  const [currentFindIndex, setCurrentFindIndex] = useState(-1)

  // Format dropdown state
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)
  const formatDropdownRef = useRef<HTMLDivElement>(null)

  // Freeze dropdown state
  const [showFreezeDropdown, setShowFreezeDropdown] = useState(false)
  const freezeDropdownRef = useRef<HTMLDivElement>(null)

  // Border dropdown state
  const [showBorderDropdown, setShowBorderDropdown] = useState(false)
  const borderDropdownRef = useRef<HTMLDivElement>(null)

  // Color picker state
  const [showBgColorPicker, setShowBgColorPicker] = useState(false)
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  const bgColorPickerRef = useRef<HTMLDivElement>(null)
  const textColorPickerRef = useRef<HTMLDivElement>(null)

  // Font dropdowns state
  const [showFontFamilyDropdown, setShowFontFamilyDropdown] = useState(false)
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false)
  const fontFamilyDropdownRef = useRef<HTMLDivElement>(null)
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null)

  // Conditional formatting dialog state
  const [showConditionalFormatDialog, setShowConditionalFormatDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<ConditionalFormatRule | null>(null)

  // Data validation dialog state
  const [showDataValidationDialog, setShowDataValidationDialog] = useState(false)

  // Comment popup state
  const [commentPopup, setCommentPopup] = useState<{
    row: number
    col: number
    x: number
    y: number
  } | null>(null)

  // Validation dropdown state
  const [validationDropdown, setValidationDropdown] = useState<{
    row: number
    col: number
    items: string[]
    x: number
    y: number
  } | null>(null)

  // Auto-fill drag state
  const [isAutoFillDragging, setIsAutoFillDragging] = useState(false)
  const [autoFillTarget, setAutoFillTarget] = useState<{ row: number; col: number } | null>(null)
  const autoFillStartRef = useRef<{ row: number; col: number } | null>(null)

  // Column/row resize state
  const [resizingCol, setResizingCol] = useState<{ col: number; startX: number; startWidth: number } | null>(null)
  const [resizingRow, setResizingRow] = useState<{ row: number; startY: number; startHeight: number } | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 250)
  }, [isClosing, onClose])

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
    frozenRows,
    frozenCols,
    freezeRows,
    freezeCols,
    freezeAtSelection,
    unfreeze,
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
    updateCell,
    updateCellStyle,
    updateCellFormat,
    applyStyleToSelection,
    moveSelection,
    copy,
    cut,
    paste,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    sortColumn,
    sortBySelection,
    exportToCSV,
    importFromCSV,
    clipboard,
    autoFill,
    applyBorderToSelection,
    mergeCells,
    unmergeCells,
    isCellMerged,
    getMergeInfo,
    conditionalFormatRules,
    addConditionalFormatRule,
    updateConditionalFormatRule,
    deleteConditionalFormatRule,
    getConditionalStyle,
    getConditionalDataBar,
    getConditionalColorScale,
    dataValidationRules,
    addDataValidationRule,
    updateDataValidationRule,
    deleteDataValidationRule,
    getValidationForCell,
    validateCellValue,
    getValidationDropdownItems,
    // Resize
    resizeColumn,
    resizeRow,
    // Cell comments
    cellComments,
    addComment,
    updateComment,
    deleteComment,
    getComment,
    resolveComment,
    addReply,
    deleteReply,
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

  // Calculate frozen dimensions
  const frozenRowsHeight = useMemo(() => {
    let height = 0
    for (let i = 0; i < frozenRows; i++) {
      height += rowHeights[i] || DEFAULT_ROW_HEIGHT
    }
    return height
  }, [frozenRows, rowHeights])

  const frozenColsWidth = useMemo(() => {
    let width = 0
    for (let i = 0; i < frozenCols; i++) {
      width += columnWidths[i] || DEFAULT_COL_WIDTH
    }
    return width
  }, [frozenCols, columnWidths])

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

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
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

  // Validation dropdown handlers
  const handleShowValidationDropdown = useCallback((
    row: number,
    col: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    const items = getValidationDropdownItems(row, col)
    if (items && items.length > 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setValidationDropdown({
        row,
        col,
        items,
        x: rect.left,
        y: rect.bottom + 2,
      })
    }
  }, [getValidationDropdownItems])

  const handleSelectDropdownItem = useCallback((item: string) => {
    if (validationDropdown) {
      updateCell(validationDropdown.row, validationDropdown.col, item)
      setValidationDropdown(null)
    }
  }, [validationDropdown, updateCell])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (validationDropdown) {
        setValidationDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [validationDropdown])

  // Comment handlers
  const handleOpenComment = useCallback((row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).closest('.spreadsheet-fullscreen__cell')?.getBoundingClientRect()
    if (rect) {
      setCommentPopup({
        row,
        col,
        x: rect.right + 8,
        y: rect.top,
      })
    }
  }, [])

  const handleAddCommentToSelection = useCallback(() => {
    if (!selection.activeCell) return
    const { row, col } = selection.activeCell
    // Calculate position based on cell position
    const cellLeft = getColumnLeft(col) + ROW_HEADER_WIDTH + frozenColsWidth - scrollLeft
    const cellTop = getRowTop(row) + HEADER_HEIGHT + frozenRowsHeight - scrollTop
    const cellWidth = columnWidths[col] || DEFAULT_COL_WIDTH

    setCommentPopup({
      row,
      col,
      x: cellLeft + cellWidth + 8,
      y: cellTop + 100, // Account for toolbar height
    })
  }, [selection.activeCell, getColumnLeft, getRowTop, frozenColsWidth, frozenRowsHeight, scrollLeft, scrollTop, columnWidths])

  // Auto-fill handlers
  const handleAutoFillStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selection.range) return

    setIsAutoFillDragging(true)
    const { end } = selection.range
    autoFillStartRef.current = { row: end.row, col: end.col }
  }, [selection.range])

  const handleAutoFillMove = useCallback((row: number, col: number) => {
    if (!isAutoFillDragging || !selection.range) return
    setAutoFillTarget({ row, col })
  }, [isAutoFillDragging, selection.range])

  const handleAutoFillEnd = useCallback(() => {
    if (!isAutoFillDragging || !selection.range || !autoFillTarget) {
      setIsAutoFillDragging(false)
      setAutoFillTarget(null)
      return
    }

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    // Determine fill direction and count
    if (autoFillTarget.row > maxRow) {
      // Fill down
      const count = autoFillTarget.row - maxRow
      autoFill('down', count)
    } else if (autoFillTarget.row < minRow) {
      // Fill up
      const count = minRow - autoFillTarget.row
      autoFill('up', count)
    } else if (autoFillTarget.col > maxCol) {
      // Fill right
      const count = autoFillTarget.col - maxCol
      autoFill('right', count)
    } else if (autoFillTarget.col < minCol) {
      // Fill left
      const count = minCol - autoFillTarget.col
      autoFill('left', count)
    }

    setIsAutoFillDragging(false)
    setAutoFillTarget(null)
    autoFillStartRef.current = null
  }, [isAutoFillDragging, selection.range, autoFillTarget, autoFill])

  // Handle mouse up globally for auto-fill
  useEffect(() => {
    const handleMouseUp = () => {
      if (isAutoFillDragging) {
        handleAutoFillEnd()
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isAutoFillDragging, handleAutoFillEnd])

  // Column resize handlers
  const handleColResizeStart = useCallback((col: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startWidth = columnWidths[col] || DEFAULT_COL_WIDTH
    setResizingCol({ col, startX: e.clientX, startWidth })
  }, [columnWidths])

  const handleRowResizeStart = useCallback((row: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT
    setResizingRow({ row, startY: e.clientY, startHeight })
  }, [rowHeights])

  // Handle resize mouse move and up globally
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol) {
        const diff = e.clientX - resizingCol.startX
        const newWidth = Math.max(30, resizingCol.startWidth + diff)
        resizeColumn(resizingCol.col, newWidth)
      }
      if (resizingRow) {
        const diff = e.clientY - resizingRow.startY
        const newHeight = Math.max(20, resizingRow.startHeight + diff)
        resizeRow(resizingRow.row, newHeight)
      }
    }

    const handleMouseUp = () => {
      setResizingCol(null)
      setResizingRow(null)
    }

    if (resizingCol || resizingRow) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [resizingCol, resizingRow, resizeColumn, resizeRow])

  // Find functionality
  const handleFind = useCallback(() => {
    if (!findValue.trim()) {
      setFindResults([])
      setCurrentFindIndex(-1)
      return
    }

    const results: { row: number; col: number }[] = []
    const searchLower = findValue.toLowerCase()

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = cells[cellKey(r, c)]
        const value = cell?.value?.toString().toLowerCase() || ''
        if (value.includes(searchLower)) {
          results.push({ row: r, col: c })
        }
      }
    }

    setFindResults(results)
    if (results.length > 0) {
      setCurrentFindIndex(0)
      selectCell(results[0].row, results[0].col)
    } else {
      setCurrentFindIndex(-1)
    }
  }, [findValue, cells, rowCount, colCount, selectCell])

  const handleFindNext = useCallback(() => {
    if (findResults.length === 0) return
    const nextIndex = (currentFindIndex + 1) % findResults.length
    setCurrentFindIndex(nextIndex)
    selectCell(findResults[nextIndex].row, findResults[nextIndex].col)
  }, [findResults, currentFindIndex, selectCell])

  const handleFindPrevious = useCallback(() => {
    if (findResults.length === 0) return
    const prevIndex = currentFindIndex <= 0 ? findResults.length - 1 : currentFindIndex - 1
    setCurrentFindIndex(prevIndex)
    selectCell(findResults[prevIndex].row, findResults[prevIndex].col)
  }, [findResults, currentFindIndex, selectCell])

  const handleReplaceOne = useCallback(() => {
    if (currentFindIndex < 0 || currentFindIndex >= findResults.length) return
    const { row, col } = findResults[currentFindIndex]
    const cell = cells[cellKey(row, col)]
    const currentValue = cell?.value?.toString() || ''
    const newValue = currentValue.replace(new RegExp(findValue, 'i'), replaceValue)
    updateCell(row, col, newValue)
    handleFind()
  }, [currentFindIndex, findResults, cells, findValue, replaceValue, updateCell, handleFind])

  const handleReplaceAll = useCallback(() => {
    findResults.forEach(({ row, col }) => {
      const cell = cells[cellKey(row, col)]
      const currentValue = cell?.value?.toString() || ''
      const newValue = currentValue.replace(new RegExp(findValue, 'gi'), replaceValue)
      updateCell(row, col, newValue)
    })
    handleFind()
  }, [findResults, cells, findValue, replaceValue, updateCell, handleFind])

  // CSV Export
  const handleExportCSV = useCallback(() => {
    const csv = exportToCSV()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [exportToCSV, title])

  // CSV Import
  const handleImportCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const csv = event.target?.result as string
      if (csv) {
        importFromCSV(csv)
      }
    }
    reader.readAsText(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [importFromCSV])

  // Apply format to selection
  const applyFormat = useCallback((format: Cell['format']) => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        updateCellFormat(r, c, format)
      }
    }
    setShowFormatDropdown(false)
  }, [selection.range, updateCellFormat])

  // Color presets
  const colorPresets = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ffffff', '#e5e5e5', '#a3a3a3', '#525252', '#171717',
  ]

  // Font family presets
  const fontFamilyPresets = [
    { name: 'Default', value: '' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Helvetica', value: 'Helvetica, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
    { name: 'Impact', value: 'Impact, sans-serif' },
  ]

  // Font size presets
  const fontSizePresets = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Find/Replace shortcuts
    if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setShowFindReplace(true)
      setTimeout(() => findInputRef.current?.focus(), 100)
      return
    }

    if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setShowFindReplace(true)
      setTimeout(() => findInputRef.current?.focus(), 100)
      return
    }

    if (e.key === 'Escape') {
      if (showFindReplace) {
        setShowFindReplace(false)
        return
      }
      if (contextMenu) {
        closeContextMenu()
        return
      }
      if (!editingCell) {
        handleClose()
        return
      }
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
      applyStyleToSelection({ fontWeight: 'bold' })
    } else if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      applyStyleToSelection({ fontStyle: 'italic' })
    } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      applyStyleToSelection({ textDecoration: 'underline' })
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && selection.activeCell) {
      startEditing(selection.activeCell.row, selection.activeCell.col, e.key)
    }
  }, [editingCell, selection.activeCell, moveSelection, startEditing, commitEdit, cancelEdit, clearSelection, copy, cut, paste, spreadsheet, undo, redo, handleClose, showFindReplace, contextMenu, closeContextMenu, applyStyleToSelection])

  // Apply style to selection (with toggle for non-color properties)
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

  // Apply color to selection (always set, don't toggle)
  const applyColorStyle = useCallback((property: string, value: string) => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        // For colors, always set the value (or clear if empty)
        updateCellStyle(r, c, { [property]: value || undefined })
      }
    }
  }, [selection.range, updateCellStyle])

  // Focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setShowFormatDropdown(false)
      }
      if (freezeDropdownRef.current && !freezeDropdownRef.current.contains(e.target as Node)) {
        setShowFreezeDropdown(false)
      }
      if (borderDropdownRef.current && !borderDropdownRef.current.contains(e.target as Node)) {
        setShowBorderDropdown(false)
      }
      if (bgColorPickerRef.current && !bgColorPickerRef.current.contains(e.target as Node)) {
        setShowBgColorPicker(false)
      }
      if (textColorPickerRef.current && !textColorPickerRef.current.contains(e.target as Node)) {
        setShowTextColorPicker(false)
      }
      if (fontFamilyDropdownRef.current && !fontFamilyDropdownRef.current.contains(e.target as Node)) {
        setShowFontFamilyDropdown(false)
      }
      if (fontSizeDropdownRef.current && !fontSizeDropdownRef.current.contains(e.target as Node)) {
        setShowFontSizeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // Calculate auto-fill preview range (moved before isCellInAutoFillPreview to avoid "used before declaration" error)
  const autoFillPreview = useMemo(() => {
    if (!isAutoFillDragging || !selection.range || !autoFillTarget) return null

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    // Determine which direction we're filling
    let previewStart: { row: number; col: number }
    let previewEnd: { row: number; col: number }

    if (autoFillTarget.row > maxRow) {
      // Filling down
      previewStart = { row: maxRow + 1, col: minCol }
      previewEnd = { row: autoFillTarget.row, col: maxCol }
    } else if (autoFillTarget.row < minRow) {
      // Filling up
      previewStart = { row: autoFillTarget.row, col: minCol }
      previewEnd = { row: minRow - 1, col: maxCol }
    } else if (autoFillTarget.col > maxCol) {
      // Filling right
      previewStart = { row: minRow, col: maxCol + 1 }
      previewEnd = { row: maxRow, col: autoFillTarget.col }
    } else if (autoFillTarget.col < minCol) {
      // Filling left
      previewStart = { row: minRow, col: autoFillTarget.col }
      previewEnd = { row: maxRow, col: minCol - 1 }
    } else {
      return null
    }

    return { start: previewStart, end: previewEnd }
  }, [isAutoFillDragging, selection.range, autoFillTarget])

  const isCellInAutoFillPreview = useCallback((row: number, col: number) => {
    if (!autoFillPreview) return false
    const { start, end } = autoFillPreview
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }, [autoFillPreview])

  // Get current cell style for toolbar state
  const activeStyle = useMemo(() => {
    if (!selection.activeCell) return {}
    const cell = getCell(selection.activeCell.row, selection.activeCell.col)
    return cell?.style || {}
  }, [selection.activeCell, getCell])

  // Calculate auto-fill handle position
  const autoFillHandlePosition = useMemo(() => {
    if (!selection.range) return null

    const { start, end } = selection.range
    const maxRow = Math.max(start.row, end.row)
    const maxCol = Math.max(start.col, end.col)

    // Calculate position relative to the grid
    const left = getColumnLeft(maxCol) + (columnWidths[maxCol] || DEFAULT_COL_WIDTH) - frozenColsWidth - scrollLeft
    const top = getRowTop(maxRow) + (rowHeights[maxRow] || DEFAULT_ROW_HEIGHT) - frozenRowsHeight - scrollTop

    return { left, top, row: maxRow, col: maxCol }
  }, [selection.range, getColumnLeft, getRowTop, columnWidths, rowHeights, frozenColsWidth, frozenRowsHeight, scrollLeft, scrollTop])

  // Check if cell should be rendered (not a slave of a merge)
  const shouldRenderCell = useCallback((row: number, col: number): boolean => {
    const mergeInfo = getMergeInfo(row, col)
    if (!mergeInfo) return true
    return mergeInfo.isMaster // Only render master cells
  }, [getMergeInfo])

  // Get merged cell dimensions
  const getMergedCellDimensions = useCallback((row: number, col: number): { width: number; height: number } | null => {
    const mergeInfo = getMergeInfo(row, col)
    if (!mergeInfo || !mergeInfo.isMaster) return null

    let width = 0
    for (let c = col; c < col + mergeInfo.colSpan; c++) {
      width += columnWidths[c] || DEFAULT_COL_WIDTH
    }

    let height = 0
    for (let r = row; r < row + mergeInfo.rowSpan; r++) {
      height += rowHeights[r] || DEFAULT_ROW_HEIGHT
    }

    return { width, height }
  }, [getMergeInfo, columnWidths, rowHeights])

  // Get conditional formatting info for a cell
  const getConditionalFormattingInfo = useCallback((row: number, col: number) => {
    const conditionalStyle = getConditionalStyle(row, col)
    const dataBar = getConditionalDataBar(row, col)
    const colorScale = getConditionalColorScale(row, col)

    return { conditionalStyle, dataBar, colorScale }
  }, [getConditionalStyle, getConditionalDataBar, getConditionalColorScale])

  // Get border style for a cell
  const getCellBorderStyle = useCallback((row: number, col: number): React.CSSProperties => {
    const cell = cells[cellKey(row, col)]
    if (!cell?.border) return {}

    const getBorderValue = (side: { style: string; color: string } | undefined): string => {
      if (!side) return ''
      const widths = { thin: '1px', medium: '2px', thick: '3px', dashed: '1px' }
      const styles = { thin: 'solid', medium: 'solid', thick: 'solid', dashed: 'dashed' }
      return `${widths[side.style as keyof typeof widths] || '1px'} ${styles[side.style as keyof typeof styles] || 'solid'} ${side.color}`
    }

    return {
      borderTop: getBorderValue(cell.border.top) || undefined,
      borderRight: getBorderValue(cell.border.right) || undefined,
      borderBottom: getBorderValue(cell.border.bottom) || undefined,
      borderLeft: getBorderValue(cell.border.left) || undefined,
    }
  }, [cells])

  // Get formatted display value
  const getFormattedDisplayValue = useCallback((row: number, col: number): string => {
    const cell = cells[cellKey(row, col)]
    if (!cell) return ''
    if (cell.error) return cell.error
    if (cell.format) {
      return formatNumber(cell.value, cell.format)
    }
    if (cell.displayValue !== undefined) return cell.displayValue
    if (cell.value === null || cell.value === undefined) return ''
    return String(cell.value)
  }, [cells])

  // Selection type for context menu
  const getSelectionType = useCallback((): 'cell' | 'row' | 'column' | 'range' => {
    if (!selection.range) return 'cell'
    const { start, end } = selection.range
    if (start.row === end.row && start.col === end.col) return 'cell'
    if (start.col === 0 && end.col === colCount - 1) return 'row'
    if (start.row === 0 && end.row === rowCount - 1) return 'column'
    return 'range'
  }, [selection.range, colCount, rowCount])

  // Check if a cell has a comment
  const cellHasComment = useCallback((row: number, col: number): boolean => {
    const key = cellKey(row, col)
    return !!cellComments[key]
  }, [cellComments])

  return (
    <div className={`spreadsheet-fullscreen ${isDark ? 'spreadsheet-fullscreen--dark' : 'spreadsheet-fullscreen--light'} ${isClosing ? 'spreadsheet-fullscreen--closing' : ''}`}>
      <div className="spreadsheet-fullscreen__modal" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Header */}
        <div className="spreadsheet-fullscreen__header">
          <div className="spreadsheet-fullscreen__header-left">
            <div className="spreadsheet-fullscreen__icon">
              <BsFileSpreadsheetFill size={20} />
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
              onClick={handleClose}
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
          {/* Undo/Redo */}
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

          {/* Format Dropdown */}
          <div className="spreadsheet-fullscreen__toolbar-group" ref={formatDropdownRef}>
            <div className="spreadsheet-fullscreen__dropdown">
              <button
                className="spreadsheet-fullscreen__toolbar-btn spreadsheet-fullscreen__dropdown-trigger"
                onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                title="Number Format"
              >
                <LuHash size={16} />
                <LuChevronDown size={12} />
              </button>
              {showFormatDropdown && (
                <div className={`spreadsheet-fullscreen__dropdown-menu ${isDark ? 'dark' : 'light'}`}>
                  {FORMAT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      className="spreadsheet-fullscreen__dropdown-item"
                      onClick={() => applyFormat(preset.format)}
                    >
                      <span className="spreadsheet-fullscreen__dropdown-item-icon">
                        {preset.format.type === 'currency' && <LuDollarSign size={14} />}
                        {preset.format.type === 'percent' && <LuPercent size={14} />}
                        {preset.format.type === 'date' && <LuCalendar size={14} />}
                        {preset.format.type === 'number' && <LuHash size={14} />}
                        {preset.format.type === 'text' && <LuType size={14} />}
                        {preset.format.type === 'general' && <LuType size={14} />}
                      </span>
                      <span className="spreadsheet-fullscreen__dropdown-item-label">{preset.name}</span>
                      <span className="spreadsheet-fullscreen__dropdown-item-example">{preset.example}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Font Family & Size */}
          <div className="spreadsheet-fullscreen__toolbar-group">
            {/* Font Family Dropdown */}
            <div className="spreadsheet-fullscreen__dropdown" ref={fontFamilyDropdownRef}>
              <button
                className="spreadsheet-fullscreen__toolbar-btn spreadsheet-fullscreen__font-dropdown-trigger"
                onClick={() => setShowFontFamilyDropdown(!showFontFamilyDropdown)}
                title="Font Family"
              >
                <span className="spreadsheet-fullscreen__font-label">
                  {activeStyle.fontFamily ? fontFamilyPresets.find(f => f.value === activeStyle.fontFamily)?.name || 'Custom' : 'Default'}
                </span>
                <LuChevronDown size={12} />
              </button>
              {showFontFamilyDropdown && (
                <div className={`spreadsheet-fullscreen__dropdown-menu ${isDark ? 'dark' : 'light'}`}>
                  {fontFamilyPresets.map((font) => (
                    <button
                      key={font.name}
                      className={`spreadsheet-fullscreen__dropdown-item ${activeStyle.fontFamily === font.value ? 'active' : ''}`}
                      style={{ fontFamily: font.value || 'inherit' }}
                      onClick={() => {
                        applyColorStyle('fontFamily', font.value)
                        setShowFontFamilyDropdown(false)
                      }}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Font Size Dropdown */}
            <div className="spreadsheet-fullscreen__dropdown" ref={fontSizeDropdownRef}>
              <button
                className="spreadsheet-fullscreen__toolbar-btn spreadsheet-fullscreen__font-dropdown-trigger spreadsheet-fullscreen__font-size-trigger"
                onClick={() => setShowFontSizeDropdown(!showFontSizeDropdown)}
                title="Font Size"
              >
                <span className="spreadsheet-fullscreen__font-label">
                  {activeStyle.fontSize ? parseInt(activeStyle.fontSize as string) : '13'}
                </span>
                <LuChevronDown size={12} />
              </button>
              {showFontSizeDropdown && (
                <div className={`spreadsheet-fullscreen__dropdown-menu spreadsheet-fullscreen__dropdown-menu--narrow ${isDark ? 'dark' : 'light'}`}>
                  {fontSizePresets.map((size) => (
                    <button
                      key={size}
                      className={`spreadsheet-fullscreen__dropdown-item ${activeStyle.fontSize === `${size}px` ? 'active' : ''}`}
                      onClick={() => {
                        applyColorStyle('fontSize', `${size}px`)
                        setShowFontSizeDropdown(false)
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Text Formatting */}
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

          {/* Color Pickers */}
          <div className="spreadsheet-fullscreen__toolbar-group">
            <div className="spreadsheet-fullscreen__color-picker-wrapper" ref={bgColorPickerRef}>
              <button
                className="spreadsheet-fullscreen__toolbar-btn"
                onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                title="Background Color"
              >
                <LuPaintBucket size={16} />
              </button>
              {showBgColorPicker && (
                <div className={`spreadsheet-fullscreen__color-picker ${isDark ? 'dark' : 'light'}`}>
                  <div className="spreadsheet-fullscreen__color-grid">
                    {colorPresets.map((color) => (
                      <button
                        key={color}
                        className="spreadsheet-fullscreen__color-swatch"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          applyColorStyle('backgroundColor', color)
                          setShowBgColorPicker(false)
                        }}
                      />
                    ))}
                  </div>
                  <button
                    className="spreadsheet-fullscreen__color-clear"
                    onClick={() => {
                      applyColorStyle('backgroundColor', '')
                      setShowBgColorPicker(false)
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <div className="spreadsheet-fullscreen__color-picker-wrapper" ref={textColorPickerRef}>
              <button
                className="spreadsheet-fullscreen__toolbar-btn"
                onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                title="Text Color"
                style={{ color: activeStyle.color || 'inherit' }}
              >
                <LuType size={16} />
              </button>
              {showTextColorPicker && (
                <div className={`spreadsheet-fullscreen__color-picker ${isDark ? 'dark' : 'light'}`}>
                  <div className="spreadsheet-fullscreen__color-grid">
                    {colorPresets.map((color) => (
                      <button
                        key={color}
                        className="spreadsheet-fullscreen__color-swatch"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          applyColorStyle('color', color)
                          setShowTextColorPicker(false)
                        }}
                      />
                    ))}
                  </div>
                  <button
                    className="spreadsheet-fullscreen__color-clear"
                    onClick={() => {
                      applyColorStyle('color', '')
                      setShowTextColorPicker(false)
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Borders */}
          <div className="spreadsheet-fullscreen__toolbar-group" ref={borderDropdownRef}>
            <div className="spreadsheet-fullscreen__dropdown">
              <button
                className="spreadsheet-fullscreen__toolbar-btn spreadsheet-fullscreen__dropdown-trigger"
                onClick={() => setShowBorderDropdown(!showBorderDropdown)}
                title="Cell Borders"
              >
                <LuSquare size={16} />
                <LuChevronDown size={12} />
              </button>
              {showBorderDropdown && (
                <div className={`spreadsheet-fullscreen__dropdown-menu ${isDark ? 'dark' : 'light'}`}>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('all')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuGrid3X3 size={14} /></span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">All borders</span>
                  </button>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('outer')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuSquare size={14} /></span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Outer borders</span>
                  </button>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('inner')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon">╬</span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Inner borders</span>
                  </button>
                  <div className="spreadsheet-fullscreen__dropdown-divider" />
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('top')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon">▔</span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Top border</span>
                  </button>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('bottom')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon">▁</span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Bottom border</span>
                  </button>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('left')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon">▏</span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Left border</span>
                  </button>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('right')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon">▕</span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Right border</span>
                  </button>
                  <div className="spreadsheet-fullscreen__dropdown-divider" />
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      applyBorderToSelection('none')
                      setShowBorderDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuX size={14} /></span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">No border</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Merge Cells */}
          <div className="spreadsheet-fullscreen__toolbar-group">
            <button
              className="spreadsheet-fullscreen__toolbar-btn"
              onClick={mergeCells}
              title="Merge Cells"
            >
              <LuCombine size={16} />
            </button>
            <button
              className="spreadsheet-fullscreen__toolbar-btn"
              onClick={unmergeCells}
              title="Unmerge Cells"
            >
              <LuSplit size={16} />
            </button>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Conditional Formatting */}
          <div className="spreadsheet-fullscreen__toolbar-group">
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${conditionalFormatRules.length > 0 ? 'active' : ''}`}
              onClick={() => setShowConditionalFormatDialog(true)}
              title="Conditional Formatting"
            >
              <LuPalette size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${dataValidationRules.length > 0 ? 'active' : ''}`}
              onClick={() => setShowDataValidationDialog(true)}
              title="Data Validation"
            >
              <LuListChecks size={16} />
            </button>
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${selection.activeCell && cellHasComment(selection.activeCell.row, selection.activeCell.col) ? 'active' : ''}`}
              onClick={handleAddCommentToSelection}
              title="Add/View Comment"
              disabled={!selection.activeCell}
            >
              <LuMessageSquare size={16} />
            </button>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Alignment */}
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

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Sort */}
          <div className="spreadsheet-fullscreen__toolbar-group">
            <button
              className="spreadsheet-fullscreen__toolbar-btn"
              onClick={() => sortBySelection('asc')}
              title="Sort A → Z"
            >
              <LuArrowUp size={16} />
            </button>
            <button
              className="spreadsheet-fullscreen__toolbar-btn"
              onClick={() => sortBySelection('desc')}
              title="Sort Z → A"
            >
              <LuArrowDown size={16} />
            </button>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Freeze Panes */}
          <div className="spreadsheet-fullscreen__toolbar-group" ref={freezeDropdownRef}>
            <div className="spreadsheet-fullscreen__dropdown">
              <button
                className={`spreadsheet-fullscreen__toolbar-btn spreadsheet-fullscreen__dropdown-trigger ${(frozenRows > 0 || frozenCols > 0) ? 'active' : ''}`}
                onClick={() => setShowFreezeDropdown(!showFreezeDropdown)}
                title="Freeze Panes"
              >
                <LuGrid2X2 size={16} />
                <LuChevronDown size={12} />
              </button>
              {showFreezeDropdown && (
                <div className={`spreadsheet-fullscreen__dropdown-menu ${isDark ? 'dark' : 'light'}`}>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      freezeAtSelection()
                      setShowFreezeDropdown(false)
                    }}
                    disabled={!selection.activeCell}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuGrid2X2 size={14} /></span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Freeze at selection</span>
                    {selection.activeCell && (
                      <span className="spreadsheet-fullscreen__dropdown-item-example">
                        {selection.activeCell.row > 0 && `${selection.activeCell.row} rows`}
                        {selection.activeCell.row > 0 && selection.activeCell.col > 0 && ', '}
                        {selection.activeCell.col > 0 && `${selection.activeCell.col} cols`}
                      </span>
                    )}
                  </button>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      freezeRows(1)
                      setShowFreezeDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuPanelTopClose size={14} /></span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Freeze top row</span>
                  </button>
                  <button
                    className="spreadsheet-fullscreen__dropdown-item"
                    onClick={() => {
                      freezeCols(1)
                      setShowFreezeDropdown(false)
                    }}
                  >
                    <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuPanelLeftClose size={14} /></span>
                    <span className="spreadsheet-fullscreen__dropdown-item-label">Freeze first column</span>
                  </button>
                  {selection.activeCell && selection.activeCell.row > 0 && (
                    <button
                      className="spreadsheet-fullscreen__dropdown-item"
                      onClick={() => {
                        freezeRows(selection.activeCell!.row)
                        setShowFreezeDropdown(false)
                      }}
                    >
                      <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuPanelTopClose size={14} /></span>
                      <span className="spreadsheet-fullscreen__dropdown-item-label">Freeze up to row {selection.activeCell.row}</span>
                    </button>
                  )}
                  {selection.activeCell && selection.activeCell.col > 0 && (
                    <button
                      className="spreadsheet-fullscreen__dropdown-item"
                      onClick={() => {
                        freezeCols(selection.activeCell!.col)
                        setShowFreezeDropdown(false)
                      }}
                    >
                      <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuPanelLeftClose size={14} /></span>
                      <span className="spreadsheet-fullscreen__dropdown-item-label">Freeze up to column {colToLetter(selection.activeCell.col - 1)}</span>
                    </button>
                  )}
                  {(frozenRows > 0 || frozenCols > 0) && (
                    <>
                      <div className="spreadsheet-fullscreen__dropdown-divider" />
                      <button
                        className="spreadsheet-fullscreen__dropdown-item"
                        onClick={() => {
                          unfreeze()
                          setShowFreezeDropdown(false)
                        }}
                      >
                        <span className="spreadsheet-fullscreen__dropdown-item-icon"><LuX size={14} /></span>
                        <span className="spreadsheet-fullscreen__dropdown-item-label">Unfreeze all</span>
                        <span className="spreadsheet-fullscreen__dropdown-item-example">
                          {frozenRows > 0 && `${frozenRows} rows`}
                          {frozenRows > 0 && frozenCols > 0 && ', '}
                          {frozenCols > 0 && `${frozenCols} cols`}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="spreadsheet-fullscreen__toolbar-divider" />

          {/* Find & CSV */}
          <div className="spreadsheet-fullscreen__toolbar-group">
            <button
              className={`spreadsheet-fullscreen__toolbar-btn ${showFindReplace ? 'active' : ''}`}
              onClick={() => {
                setShowFindReplace(!showFindReplace)
                if (!showFindReplace) {
                  setTimeout(() => findInputRef.current?.focus(), 100)
                }
              }}
              title="Find & Replace (Ctrl+F)"
            >
              <LuSearch size={16} />
            </button>
            <button
              className="spreadsheet-fullscreen__toolbar-btn"
              onClick={handleExportCSV}
              title="Export CSV"
            >
              <LuDownload size={16} />
            </button>
            <button
              className="spreadsheet-fullscreen__toolbar-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Import CSV"
            >
              <LuUpload size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Find/Replace Bar */}
        {showFindReplace && (
          <div className="spreadsheet-fullscreen__find-bar">
            <div className="spreadsheet-fullscreen__find-inputs">
              <input
                ref={findInputRef}
                type="text"
                className="spreadsheet-fullscreen__find-input"
                placeholder="Find..."
                value={findValue}
                onChange={(e) => setFindValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) {
                      handleFindPrevious()
                    } else if (findResults.length === 0) {
                      handleFind()
                    } else {
                      handleFindNext()
                    }
                  }
                }}
              />
              <input
                type="text"
                className="spreadsheet-fullscreen__find-input"
                placeholder="Replace with..."
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReplaceOne()
                }}
              />
            </div>
            <div className="spreadsheet-fullscreen__find-actions">
              <button onClick={handleFind} className="spreadsheet-fullscreen__find-btn">Find</button>
              <button onClick={handleFindPrevious} className="spreadsheet-fullscreen__find-btn" disabled={findResults.length === 0}>Previous</button>
              <button onClick={handleFindNext} className="spreadsheet-fullscreen__find-btn" disabled={findResults.length === 0}>Next</button>
              <button onClick={handleReplaceOne} className="spreadsheet-fullscreen__find-btn" disabled={currentFindIndex < 0}>Replace</button>
              <button onClick={handleReplaceAll} className="spreadsheet-fullscreen__find-btn" disabled={findResults.length === 0}>Replace All</button>
              <span className="spreadsheet-fullscreen__find-count">
                {findResults.length > 0 ? `${currentFindIndex + 1} of ${findResults.length}` : 'No results'}
              </span>
              <button onClick={() => setShowFindReplace(false)} className="spreadsheet-fullscreen__find-close">
                <LuX size={16} />
              </button>
            </div>
          </div>
        )}

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

        {/* Grid with Frozen Panes */}
        <div className="spreadsheet-fullscreen__content" onContextMenu={handleContextMenu}>
          {/* Main scrollable container */}
          <div
            ref={gridRef}
            className="spreadsheet-fullscreen__grid-container"
            onScroll={handleScroll}
            style={{
              marginLeft: ROW_HEADER_WIDTH + frozenColsWidth,
              marginTop: HEADER_HEIGHT + frozenRowsHeight,
            }}
          >
            <div
              className="spreadsheet-fullscreen__grid-content"
              style={{
                width: totalWidth - frozenColsWidth,
                height: totalHeight - frozenRowsHeight,
              }}
            >
              {/* Scrollable cells (bottom-right quadrant) */}
              {Array.from({ length: visibleRows.end - visibleRows.start }).map((_, ri) => {
                const row = visibleRows.start + ri
                if (row < frozenRows) return null
                const top = getRowTop(row) - frozenRowsHeight - scrollTop
                const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT

                return Array.from({ length: visibleCols.end - visibleCols.start }).map((_, ci) => {
                  const col = visibleCols.start + ci
                  if (col < frozenCols) return null

                  // Skip cells that are slaves of a merge
                  if (!shouldRenderCell(row, col)) return null

                  const left = getColumnLeft(col) - frozenColsWidth - scrollLeft
                  const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                  const isActive = isCellActive(row, col)
                  const isSelected = isCellSelected(row, col)
                  const isAutoFillPreview = isCellInAutoFillPreview(row, col)
                  const isEditing = editingCell?.row === row && editingCell?.col === col
                  const cell = cells[cellKey(row, col)]

                  // Get merged cell dimensions
                  const mergedDimensions = getMergedCellDimensions(row, col)
                  const cellWidth = mergedDimensions?.width || colWidth
                  const cellHeight = mergedDimensions?.height || rowHeight
                  const isMerged = mergedDimensions !== null

                  // Get conditional formatting
                  const cfInfo = getConditionalFormattingInfo(row, col)
                  const cfStyle = cfInfo.conditionalStyle || {}
                  const cfBgColor = cfInfo.colorScale || cfStyle.backgroundColor || cell?.style?.backgroundColor
                  const cfTextColor = cfStyle.color || cell?.style?.color

                  return (
                    <div
                      key={`${row}-${col}`}
                      className={`spreadsheet-fullscreen__cell ${isSelected ? 'spreadsheet-fullscreen__cell--selected' : ''} ${isActive ? 'spreadsheet-fullscreen__cell--active' : ''} ${isAutoFillPreview ? 'spreadsheet-fullscreen__cell--autofill-preview' : ''} ${isMerged ? 'spreadsheet-fullscreen__cell--merged' : ''}`}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: cellWidth,
                        height: cellHeight,
                        backgroundColor: cfBgColor,
                        color: cfTextColor,
                        fontWeight: cfStyle.fontWeight || cell?.style?.fontWeight,
                        fontStyle: cfStyle.fontStyle || cell?.style?.fontStyle,
                        textDecoration: cfStyle.textDecoration || cell?.style?.textDecoration,
                        textAlign: (cell?.style?.textAlign as React.CSSProperties['textAlign']) || 'left',
                        fontFamily: cell?.style?.fontFamily,
                        fontSize: cell?.style?.fontSize,
                        zIndex: isMerged ? 5 : undefined,
                        ...getCellBorderStyle(row, col),
                      }}
                      onClick={(e) => handleCellClick(row, col, e)}
                      onDoubleClick={() => handleCellDoubleClick(row, col)}
                      onMouseEnter={() => isAutoFillDragging && handleAutoFillMove(row, col)}
                    >
                      {/* Data bar */}
                      {cfInfo.dataBar && (
                        <div
                          className="spreadsheet-fullscreen__cell-databar"
                          style={{
                            width: `${cfInfo.dataBar.percent}%`,
                            backgroundColor: cfInfo.dataBar.color,
                          }}
                        />
                      )}
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
                        <>
                          <span className={`spreadsheet-fullscreen__cell-value ${cell?.error ? 'spreadsheet-fullscreen__cell-value--error' : ''}`}>
                            {getFormattedDisplayValue(row, col)}
                          </span>
                          {getValidationDropdownItems(row, col) && (
                            <button
                              className="spreadsheet-fullscreen__cell-dropdown-btn"
                              onClick={(e) => handleShowValidationDropdown(row, col, e)}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <LuChevronDown size={12} />
                            </button>
                          )}
                          {/* Comment indicator */}
                          {cellHasComment(row, col) && (
                            <div
                              className="spreadsheet-fullscreen__cell-comment-indicator"
                              onClick={(e) => handleOpenComment(row, col, e)}
                              title="View comment"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )
                })
              })}

              {/* Auto-fill handle */}
              {autoFillHandlePosition && !editingCell && (
                <div
                  className="spreadsheet-fullscreen__autofill-handle"
                  style={{
                    position: 'absolute',
                    left: autoFillHandlePosition.left - 4,
                    top: autoFillHandlePosition.top - 4,
                    zIndex: 50,
                  }}
                  onMouseDown={handleAutoFillStart}
                />
              )}
            </div>
          </div>

          {/* Corner cell (top-left, always visible) */}
          <div
            className="spreadsheet-fullscreen__corner-cell"
            style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }}
            onClick={() => spreadsheet.selectAll()}
          />

          {/* Column headers (scrolls horizontally with main content) */}
          <div
            className="spreadsheet-fullscreen__column-headers"
            style={{
              left: ROW_HEADER_WIDTH + frozenColsWidth,
              width: `calc(100% - ${ROW_HEADER_WIDTH + frozenColsWidth}px)`,
              height: HEADER_HEIGHT,
              overflow: 'hidden',
            }}
          >
            <div style={{ transform: `translateX(${-scrollLeft}px)`, position: 'relative' }}>
              {Array.from({ length: colCount - frozenCols }).map((_, i) => {
                const col = frozenCols + i
                const left = getColumnLeft(col) - frozenColsWidth
                const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                return (
                  <div
                    key={col}
                    className="spreadsheet-fullscreen__col-header"
                    style={{
                      position: 'absolute',
                      left,
                      width: colWidth,
                      height: HEADER_HEIGHT,
                    }}
                    onClick={() => selectColumn(col)}
                  >
                    {colToLetter(col)}
                    <div
                      className="spreadsheet-fullscreen__col-resize-handle"
                      onMouseDown={(e) => handleColResizeStart(col, e)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Frozen column headers (doesn't scroll horizontally) */}
          {frozenCols > 0 && (
            <div
              className="spreadsheet-fullscreen__column-headers spreadsheet-fullscreen__column-headers--frozen"
              style={{
                left: ROW_HEADER_WIDTH,
                width: frozenColsWidth,
                height: HEADER_HEIGHT,
              }}
            >
              {Array.from({ length: frozenCols }).map((_, col) => {
                const left = getColumnLeft(col)
                const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                return (
                  <div
                    key={col}
                    className="spreadsheet-fullscreen__col-header"
                    style={{
                      position: 'absolute',
                      left,
                      width: colWidth,
                      height: HEADER_HEIGHT,
                    }}
                    onClick={() => selectColumn(col)}
                  >
                    {colToLetter(col)}
                    <div
                      className="spreadsheet-fullscreen__col-resize-handle"
                      onMouseDown={(e) => handleColResizeStart(col, e)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Row headers (scrolls vertically with main content) */}
          <div
            className="spreadsheet-fullscreen__row-headers"
            style={{
              top: HEADER_HEIGHT + frozenRowsHeight,
              height: `calc(100% - ${HEADER_HEIGHT + frozenRowsHeight}px)`,
              width: ROW_HEADER_WIDTH,
              overflow: 'hidden',
            }}
          >
            <div style={{ transform: `translateY(${-scrollTop}px)`, position: 'relative' }}>
              {Array.from({ length: rowCount - frozenRows }).map((_, i) => {
                const row = frozenRows + i
                const top = getRowTop(row) - frozenRowsHeight
                const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT
                return (
                  <div
                    key={row}
                    className="spreadsheet-fullscreen__row-header"
                    style={{
                      position: 'absolute',
                      top,
                      height: rowHeight,
                      width: ROW_HEADER_WIDTH,
                    }}
                    onClick={() => selectRow(row)}
                  >
                    {row + 1}
                    <div
                      className="spreadsheet-fullscreen__row-resize-handle"
                      onMouseDown={(e) => handleRowResizeStart(row, e)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Frozen row headers (doesn't scroll vertically) */}
          {frozenRows > 0 && (
            <div
              className="spreadsheet-fullscreen__row-headers spreadsheet-fullscreen__row-headers--frozen"
              style={{
                top: HEADER_HEIGHT,
                height: frozenRowsHeight,
                width: ROW_HEADER_WIDTH,
              }}
            >
              {Array.from({ length: frozenRows }).map((_, row) => {
                const top = getRowTop(row)
                const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT
                return (
                  <div
                    key={row}
                    className="spreadsheet-fullscreen__row-header"
                    style={{
                      position: 'absolute',
                      top,
                      height: rowHeight,
                      width: ROW_HEADER_WIDTH,
                    }}
                    onClick={() => selectRow(row)}
                  >
                    {row + 1}
                    <div
                      className="spreadsheet-fullscreen__row-resize-handle"
                      onMouseDown={(e) => handleRowResizeStart(row, e)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Frozen corner cells (top-left quadrant - doesn't scroll) */}
          {(frozenRows > 0 && frozenCols > 0) && (
            <div
              className="spreadsheet-fullscreen__frozen-corner"
              style={{
                left: ROW_HEADER_WIDTH,
                top: HEADER_HEIGHT,
                width: frozenColsWidth,
                height: frozenRowsHeight,
              }}
            >
              {Array.from({ length: frozenRows }).map((_, ri) => {
                const row = ri
                const top = getRowTop(row)
                const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT

                return Array.from({ length: frozenCols }).map((_, ci) => {
                  const col = ci

                  // Skip cells that are slaves of a merge
                  if (!shouldRenderCell(row, col)) return null

                  const left = getColumnLeft(col)
                  const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                  const isActive = isCellActive(row, col)
                  const isSelected = isCellSelected(row, col)
                  const isEditing = editingCell?.row === row && editingCell?.col === col
                  const cell = cells[cellKey(row, col)]

                  // Get merged cell dimensions
                  const mergedDimensions = getMergedCellDimensions(row, col)
                  const cellWidth = mergedDimensions?.width || colWidth
                  const cellHeight = mergedDimensions?.height || rowHeight
                  const isMerged = mergedDimensions !== null

                  // Get conditional formatting
                  const cfInfo = getConditionalFormattingInfo(row, col)
                  const cfStyle = cfInfo.conditionalStyle || {}
                  const cfBgColor = cfInfo.colorScale || cfStyle.backgroundColor || cell?.style?.backgroundColor
                  const cfTextColor = cfStyle.color || cell?.style?.color

                  return (
                    <div
                      key={`${row}-${col}`}
                      className={`spreadsheet-fullscreen__cell spreadsheet-fullscreen__cell--frozen ${isSelected ? 'spreadsheet-fullscreen__cell--selected' : ''} ${isActive ? 'spreadsheet-fullscreen__cell--active' : ''} ${isMerged ? 'spreadsheet-fullscreen__cell--merged' : ''}`}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: cellWidth,
                        height: cellHeight,
                        backgroundColor: cfBgColor,
                        color: cfTextColor,
                        fontWeight: cfStyle.fontWeight || cell?.style?.fontWeight,
                        fontStyle: cfStyle.fontStyle || cell?.style?.fontStyle,
                        textDecoration: cfStyle.textDecoration || cell?.style?.textDecoration,
                        textAlign: (cell?.style?.textAlign as React.CSSProperties['textAlign']) || 'left',
                        fontFamily: cell?.style?.fontFamily,
                        fontSize: cell?.style?.fontSize,
                        zIndex: isMerged ? 5 : undefined,
                        ...getCellBorderStyle(row, col),
                      }}
                      onClick={(e) => handleCellClick(row, col, e)}
                      onDoubleClick={() => handleCellDoubleClick(row, col)}
                    >
                      {/* Data bar */}
                      {cfInfo.dataBar && (
                        <div
                          className="spreadsheet-fullscreen__cell-databar"
                          style={{
                            width: `${cfInfo.dataBar.percent}%`,
                            backgroundColor: cfInfo.dataBar.color,
                          }}
                        />
                      )}
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
                        <>
                          <span className={`spreadsheet-fullscreen__cell-value ${cell?.error ? 'spreadsheet-fullscreen__cell-value--error' : ''}`}>
                            {getFormattedDisplayValue(row, col)}
                          </span>
                          {getValidationDropdownItems(row, col) && (
                            <button
                              className="spreadsheet-fullscreen__cell-dropdown-btn"
                              onClick={(e) => handleShowValidationDropdown(row, col, e)}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <LuChevronDown size={12} />
                            </button>
                          )}
                          {/* Comment indicator */}
                          {cellHasComment(row, col) && (
                            <div
                              className="spreadsheet-fullscreen__cell-comment-indicator"
                              onClick={(e) => handleOpenComment(row, col, e)}
                              title="View comment"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )
                })
              })}
            </div>
          )}

          {/* Frozen rows (top - scrolls horizontally only) */}
          {frozenRows > 0 && (
            <div
              className="spreadsheet-fullscreen__frozen-rows"
              style={{
                left: ROW_HEADER_WIDTH + frozenColsWidth,
                top: HEADER_HEIGHT,
                width: `calc(100% - ${ROW_HEADER_WIDTH + frozenColsWidth}px)`,
                height: frozenRowsHeight,
                overflow: 'hidden',
              }}
            >
              <div style={{ transform: `translateX(${-scrollLeft}px)`, position: 'relative', width: totalWidth - frozenColsWidth, height: frozenRowsHeight }}>
                {Array.from({ length: frozenRows }).map((_, ri) => {
                  const row = ri
                  const top = getRowTop(row)
                  const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT

                  return Array.from({ length: colCount - frozenCols }).map((_, ci) => {
                    const col = frozenCols + ci

                    // Skip cells that are slaves of a merge
                    if (!shouldRenderCell(row, col)) return null

                    const left = getColumnLeft(col) - frozenColsWidth
                    const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                    const isActive = isCellActive(row, col)
                    const isSelected = isCellSelected(row, col)
                    const isEditing = editingCell?.row === row && editingCell?.col === col
                    const cell = cells[cellKey(row, col)]

                    // Get merged cell dimensions
                    const mergedDimensions = getMergedCellDimensions(row, col)
                    const cellWidth = mergedDimensions?.width || colWidth
                    const cellHeight = mergedDimensions?.height || rowHeight
                    const isMerged = mergedDimensions !== null

                    // Get conditional formatting
                    const cfInfo = getConditionalFormattingInfo(row, col)
                    const cfStyle = cfInfo.conditionalStyle || {}
                    const cfBgColor = cfInfo.colorScale || cfStyle.backgroundColor || cell?.style?.backgroundColor
                    const cfTextColor = cfStyle.color || cell?.style?.color

                    return (
                      <div
                        key={`${row}-${col}`}
                        className={`spreadsheet-fullscreen__cell spreadsheet-fullscreen__cell--frozen ${isSelected ? 'spreadsheet-fullscreen__cell--selected' : ''} ${isActive ? 'spreadsheet-fullscreen__cell--active' : ''} ${isMerged ? 'spreadsheet-fullscreen__cell--merged' : ''}`}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width: cellWidth,
                          height: cellHeight,
                          backgroundColor: cfBgColor,
                          color: cfTextColor,
                          fontWeight: cfStyle.fontWeight || cell?.style?.fontWeight,
                          fontStyle: cfStyle.fontStyle || cell?.style?.fontStyle,
                          textDecoration: cfStyle.textDecoration || cell?.style?.textDecoration,
                          textAlign: (cell?.style?.textAlign as React.CSSProperties['textAlign']) || 'left',
                          fontFamily: cell?.style?.fontFamily,
                          fontSize: cell?.style?.fontSize,
                          zIndex: isMerged ? 5 : undefined,
                          ...getCellBorderStyle(row, col),
                        }}
                        onClick={(e) => handleCellClick(row, col, e)}
                        onDoubleClick={() => handleCellDoubleClick(row, col)}
                      >
                        {/* Data bar */}
                        {cfInfo.dataBar && (
                          <div
                            className="spreadsheet-fullscreen__cell-databar"
                            style={{
                              width: `${cfInfo.dataBar.percent}%`,
                              backgroundColor: cfInfo.dataBar.color,
                            }}
                          />
                        )}
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
                          <>
                            <span className={`spreadsheet-fullscreen__cell-value ${cell?.error ? 'spreadsheet-fullscreen__cell-value--error' : ''}`}>
                              {getFormattedDisplayValue(row, col)}
                            </span>
                            {getValidationDropdownItems(row, col) && (
                              <button
                                className="spreadsheet-fullscreen__cell-dropdown-btn"
                                onClick={(e) => handleShowValidationDropdown(row, col, e)}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <LuChevronDown size={12} />
                              </button>
                            )}
                            {/* Comment indicator */}
                            {cellHasComment(row, col) && (
                              <div
                                className="spreadsheet-fullscreen__cell-comment-indicator"
                                onClick={(e) => handleOpenComment(row, col, e)}
                                title="View comment"
                              />
                            )}
                          </>
                        )}
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          )}

          {/* Frozen columns (left - scrolls vertically only) */}
          {frozenCols > 0 && (
            <div
              className="spreadsheet-fullscreen__frozen-cols"
              style={{
                left: ROW_HEADER_WIDTH,
                top: HEADER_HEIGHT + frozenRowsHeight,
                width: frozenColsWidth,
                height: `calc(100% - ${HEADER_HEIGHT + frozenRowsHeight}px)`,
                overflow: 'hidden',
              }}
            >
              <div style={{ transform: `translateY(${-scrollTop}px)`, position: 'relative', width: frozenColsWidth, height: totalHeight - frozenRowsHeight }}>
                {Array.from({ length: rowCount - frozenRows }).map((_, ri) => {
                  const row = frozenRows + ri
                  const top = getRowTop(row) - frozenRowsHeight
                  const rowHeight = rowHeights[row] || DEFAULT_ROW_HEIGHT

                  return Array.from({ length: frozenCols }).map((_, ci) => {
                    const col = ci

                    // Skip cells that are slaves of a merge
                    if (!shouldRenderCell(row, col)) return null

                    const left = getColumnLeft(col)
                    const colWidth = columnWidths[col] || DEFAULT_COL_WIDTH
                    const isActive = isCellActive(row, col)
                    const isSelected = isCellSelected(row, col)
                    const isEditing = editingCell?.row === row && editingCell?.col === col
                    const cell = cells[cellKey(row, col)]

                    // Get merged cell dimensions
                    const mergedDimensions = getMergedCellDimensions(row, col)
                    const cellWidth = mergedDimensions?.width || colWidth
                    const cellHeight = mergedDimensions?.height || rowHeight
                    const isMerged = mergedDimensions !== null

                    // Get conditional formatting
                    const cfInfo = getConditionalFormattingInfo(row, col)
                    const cfStyle = cfInfo.conditionalStyle || {}
                    const cfBgColor = cfInfo.colorScale || cfStyle.backgroundColor || cell?.style?.backgroundColor
                    const cfTextColor = cfStyle.color || cell?.style?.color

                    return (
                      <div
                        key={`${row}-${col}`}
                        className={`spreadsheet-fullscreen__cell spreadsheet-fullscreen__cell--frozen ${isSelected ? 'spreadsheet-fullscreen__cell--selected' : ''} ${isActive ? 'spreadsheet-fullscreen__cell--active' : ''} ${isMerged ? 'spreadsheet-fullscreen__cell--merged' : ''}`}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width: cellWidth,
                          height: cellHeight,
                          backgroundColor: cfBgColor,
                          color: cfTextColor,
                          fontWeight: cfStyle.fontWeight || cell?.style?.fontWeight,
                          fontStyle: cfStyle.fontStyle || cell?.style?.fontStyle,
                          textDecoration: cfStyle.textDecoration || cell?.style?.textDecoration,
                          textAlign: (cell?.style?.textAlign as React.CSSProperties['textAlign']) || 'left',
                          fontFamily: cell?.style?.fontFamily,
                          fontSize: cell?.style?.fontSize,
                          zIndex: isMerged ? 5 : undefined,
                          ...getCellBorderStyle(row, col),
                        }}
                        onClick={(e) => handleCellClick(row, col, e)}
                        onDoubleClick={() => handleCellDoubleClick(row, col)}
                      >
                        {/* Data bar */}
                        {cfInfo.dataBar && (
                          <div
                            className="spreadsheet-fullscreen__cell-databar"
                            style={{
                              width: `${cfInfo.dataBar.percent}%`,
                              backgroundColor: cfInfo.dataBar.color,
                            }}
                          />
                        )}
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
                          <>
                            <span className={`spreadsheet-fullscreen__cell-value ${cell?.error ? 'spreadsheet-fullscreen__cell-value--error' : ''}`}>
                              {getFormattedDisplayValue(row, col)}
                            </span>
                            {getValidationDropdownItems(row, col) && (
                              <button
                                className="spreadsheet-fullscreen__cell-dropdown-btn"
                                onClick={(e) => handleShowValidationDropdown(row, col, e)}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <LuChevronDown size={12} />
                              </button>
                            )}
                            {/* Comment indicator */}
                            {cellHasComment(row, col) && (
                              <div
                                className="spreadsheet-fullscreen__cell-comment-indicator"
                                onClick={(e) => handleOpenComment(row, col, e)}
                                title="View comment"
                              />
                            )}
                          </>
                        )}
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          )}

          {/* Freeze line indicators */}
          {frozenRows > 0 && (
            <div
              className="spreadsheet-fullscreen__freeze-line spreadsheet-fullscreen__freeze-line--horizontal"
              style={{ top: HEADER_HEIGHT + frozenRowsHeight, left: ROW_HEADER_WIDTH }}
            />
          )}
          {frozenCols > 0 && (
            <div
              className="spreadsheet-fullscreen__freeze-line spreadsheet-fullscreen__freeze-line--vertical"
              style={{ left: ROW_HEADER_WIDTH + frozenColsWidth, top: HEADER_HEIGHT }}
            />
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <SpreadsheetContextMenu
            position={contextMenu}
            onClose={closeContextMenu}
            onCopy={copy}
            onCut={cut}
            onPaste={paste}
            onDelete={clearSelection}
            onInsertRowAbove={() => selection.activeCell && insertRow(selection.activeCell.row - 1)}
            onInsertRowBelow={() => selection.activeCell && insertRow(selection.activeCell.row)}
            onInsertColumnLeft={() => selection.activeCell && insertColumn(selection.activeCell.col - 1)}
            onInsertColumnRight={() => selection.activeCell && insertColumn(selection.activeCell.col)}
            onDeleteRow={() => selection.activeCell && deleteRow(selection.activeCell.row)}
            onDeleteColumn={() => selection.activeCell && deleteColumn(selection.activeCell.col)}
            onSortAscending={() => sortBySelection('asc')}
            onSortDescending={() => sortBySelection('desc')}
            onFormatBold={() => applyStyle('fontWeight', 'bold')}
            onFormatItalic={() => applyStyle('fontStyle', 'italic')}
            onFormatUnderline={() => applyStyle('textDecoration', 'underline')}
            onAlignLeft={() => applyStyle('textAlign', 'left')}
            onAlignCenter={() => applyStyle('textAlign', 'center')}
            onAlignRight={() => applyStyle('textAlign', 'right')}
            onMergeCells={mergeCells}
            onUnmergeCells={unmergeCells}
            canMerge={selection.range ? (
              Math.abs(selection.range.end.row - selection.range.start.row) > 0 ||
              Math.abs(selection.range.end.col - selection.range.start.col) > 0
            ) : false}
            canUnmerge={selection.activeCell ? isCellMerged(selection.activeCell.row, selection.activeCell.col) : false}
            onAddComment={handleAddCommentToSelection}
            hasComment={selection.activeCell ? cellHasComment(selection.activeCell.row, selection.activeCell.col) : false}
            isDark={isDark}
            selectionType={getSelectionType()}
            hasSelection={!!selection.activeCell}
            canPaste={!!clipboard}
          />
        )}

        {/* Conditional Formatting Dialog */}
        {showConditionalFormatDialog && (
          <ConditionalFormattingDialog
            isDark={isDark}
            rules={conditionalFormatRules}
            currentSelection={selection.range}
            onAddRule={(rule) => {
              addConditionalFormatRule(rule)
              setEditingRule(null)
            }}
            onUpdateRule={(id, updates) => {
              updateConditionalFormatRule(id, updates)
              setEditingRule(null)
            }}
            onDeleteRule={deleteConditionalFormatRule}
            onClose={() => {
              setShowConditionalFormatDialog(false)
              setEditingRule(null)
            }}
          />
        )}

        {/* Data Validation Dialog */}
        {showDataValidationDialog && (
          <DataValidationDialog
            isDark={isDark}
            rules={dataValidationRules}
            currentSelection={selection.range}
            onAddRule={addDataValidationRule}
            onUpdateRule={updateDataValidationRule}
            onDeleteRule={deleteDataValidationRule}
            onClose={() => setShowDataValidationDialog(false)}
          />
        )}

        {/* Validation Dropdown */}
        {validationDropdown && (
          <div
            className={`spreadsheet-fullscreen__validation-dropdown ${isDark ? 'spreadsheet-fullscreen__validation-dropdown--dark' : ''}`}
            style={{
              position: 'fixed',
              left: validationDropdown.x,
              top: validationDropdown.y,
              zIndex: 10000,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {validationDropdown.items.map((item, index) => (
              <div
                key={index}
                className="spreadsheet-fullscreen__validation-dropdown-item"
                onClick={() => handleSelectDropdownItem(item)}
              >
                {item}
              </div>
            ))}
          </div>
        )}

        {/* Cell Comment Popup */}
        {commentPopup && (
          <CellCommentPopup
            isDark={isDark}
            comment={getComment(commentPopup.row, commentPopup.col)}
            row={commentPopup.row}
            col={commentPopup.col}
            position={{ x: commentPopup.x, y: commentPopup.y }}
            onAddComment={(text) => {
              addComment(commentPopup.row, commentPopup.col, text)
            }}
            onUpdateComment={(text) => {
              updateComment(commentPopup.row, commentPopup.col, text)
            }}
            onDeleteComment={() => {
              deleteComment(commentPopup.row, commentPopup.col)
              setCommentPopup(null)
            }}
            onResolveComment={(resolved) => {
              resolveComment(commentPopup.row, commentPopup.col, resolved)
            }}
            onAddReply={(text) => {
              addReply(commentPopup.row, commentPopup.col, text)
            }}
            onDeleteReply={(replyId) => {
              deleteReply(commentPopup.row, commentPopup.col, replyId)
            }}
            onClose={() => setCommentPopup(null)}
          />
        )}
      </div>
    </div>
  )
}

export default SpreadsheetNodeFullscreen
