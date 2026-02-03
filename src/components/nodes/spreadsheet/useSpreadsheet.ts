import { useState, useCallback, useMemo, useRef } from 'react'
import {
  Cell,
  CellPosition,
  CellRange,
  SpreadsheetNodeData,
  SpreadsheetSelection,
  ClipboardData,
  cellKey,
  parseKey,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  MIN_COL_WIDTH,
  MAX_COL_WIDTH,
  MIN_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
} from './types'
import { evaluateFormula } from './formulaEngine'

interface UseSpreadsheetOptions {
  initialData: SpreadsheetNodeData
  onChange: (data: Partial<SpreadsheetNodeData>) => void
}

interface UseSpreadsheetReturn {
  // Data
  cells: Record<string, Cell>
  rowCount: number
  colCount: number
  columnWidths: number[]
  rowHeights: number[]

  // Selection
  selection: SpreadsheetSelection
  setSelection: (selection: SpreadsheetSelection) => void
  selectCell: (row: number, col: number, extend?: boolean) => void
  selectRange: (start: CellPosition, end: CellPosition) => void
  selectAll: () => void
  selectRow: (row: number) => void
  selectColumn: (col: number) => void

  // Editing
  editingCell: CellPosition | null
  editValue: string
  startEditing: (row: number, col: number, initialValue?: string) => void
  updateEditValue: (value: string) => void
  commitEdit: () => void
  cancelEdit: () => void

  // Cell operations
  getCell: (row: number, col: number) => Cell | undefined
  getCellDisplayValue: (row: number, col: number) => string
  updateCell: (row: number, col: number, value: string) => void
  updateCellStyle: (row: number, col: number, style: Partial<Cell['style']>) => void
  clearSelection: () => void

  // Column/row operations
  resizeColumn: (col: number, width: number) => void
  resizeRow: (row: number, height: number) => void
  insertRow: (afterRow: number) => void
  insertColumn: (afterCol: number) => void
  deleteRow: (row: number) => void
  deleteColumn: (col: number) => void

  // Clipboard
  copy: () => void
  cut: () => void
  paste: () => void
  clipboard: ClipboardData | null

  // Navigation
  moveSelection: (direction: 'up' | 'down' | 'left' | 'right', extend?: boolean) => void

  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useSpreadsheet({ initialData, onChange }: UseSpreadsheetOptions): UseSpreadsheetReturn {
  // Core data state
  const [cells, setCells] = useState<Record<string, Cell>>(initialData.cells || {})
  const [rowCount, setRowCount] = useState(initialData.rowCount || 100)
  const [colCount, setColCount] = useState(initialData.colCount || 26)
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    // Ensure columnWidths is always a valid array
    if (Array.isArray(initialData.columnWidths) && initialData.columnWidths.length > 0) {
      return initialData.columnWidths
    }
    return Array(initialData.colCount || 26).fill(DEFAULT_COL_WIDTH)
  })
  const [rowHeights, setRowHeights] = useState<number[]>(() => {
    // Ensure rowHeights is always a valid array
    if (Array.isArray(initialData.rowHeights) && initialData.rowHeights.length > 0) {
      return initialData.rowHeights
    }
    return Array(initialData.rowCount || 100).fill(DEFAULT_ROW_HEIGHT)
  })

  // Selection state
  const [selection, setSelection] = useState<SpreadsheetSelection>({
    activeCell: null,
    range: null,
  })

  // Editing state
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null)
  const [editValue, setEditValue] = useState('')

  // Clipboard
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)

  // Undo/redo stacks
  const undoStack = useRef<Record<string, Cell>[]>([])
  const redoStack = useRef<Record<string, Cell>[]>([])
  const [undoIndex, setUndoIndex] = useState(0)

  // Helper to sync changes
  const syncChanges = useCallback((updates: Partial<SpreadsheetNodeData>) => {
    onChange(updates)
  }, [onChange])

  // Get cell at position
  const getCell = useCallback((row: number, col: number): Cell | undefined => {
    return cells[cellKey(row, col)]
  }, [cells])

  // Get display value (handles formulas)
  const getCellDisplayValue = useCallback((row: number, col: number): string => {
    const cell = cells[cellKey(row, col)]
    if (!cell) return ''

    if (cell.error) return cell.error
    if (cell.displayValue !== undefined) return cell.displayValue
    if (cell.value === null || cell.value === undefined) return ''

    return String(cell.value)
  }, [cells])

  // Update a single cell
  const updateCell = useCallback((row: number, col: number, value: string) => {
    const key = cellKey(row, col)
    const isFormula = value.startsWith('=')

    let newCell: Cell = {
      value: isFormula ? null : value,
      formula: isFormula ? value : undefined,
    }

    // Evaluate formula if present
    if (isFormula) {
      try {
        const result = evaluateFormula(value, cells)
        newCell.value = result.value
        newCell.displayValue = String(result.value)
        newCell.error = result.error
      } catch (err) {
        newCell.error = '#ERROR!'
        newCell.displayValue = '#ERROR!'
      }
    }

    // Preserve existing style
    const existingCell = cells[key]
    if (existingCell?.style) {
      newCell.style = existingCell.style
    }

    const newCells = { ...cells, [key]: newCell }

    // Save for undo
    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [cells, syncChanges])

  // Update cell style
  const updateCellStyle = useCallback((row: number, col: number, style: Partial<Cell['style']>) => {
    const key = cellKey(row, col)
    const existingCell = cells[key] || { value: null }
    const newCell: Cell = {
      ...existingCell,
      style: { ...existingCell.style, ...style },
    }

    const newCells = { ...cells, [key]: newCell }
    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [cells, syncChanges])

  // Selection operations
  const selectCell = useCallback((row: number, col: number, extend = false) => {
    if (extend && selection.activeCell) {
      // Extend selection to create range
      setSelection({
        activeCell: selection.activeCell,
        range: {
          start: selection.activeCell,
          end: { row, col },
        },
      })
    } else {
      setSelection({
        activeCell: { row, col },
        range: { start: { row, col }, end: { row, col } },
      })
    }
  }, [selection.activeCell])

  const selectRange = useCallback((start: CellPosition, end: CellPosition) => {
    setSelection({
      activeCell: start,
      range: { start, end },
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelection({
      activeCell: { row: 0, col: 0 },
      range: {
        start: { row: 0, col: 0 },
        end: { row: rowCount - 1, col: colCount - 1 },
      },
    })
  }, [rowCount, colCount])

  const selectRow = useCallback((row: number) => {
    setSelection({
      activeCell: { row, col: 0 },
      range: {
        start: { row, col: 0 },
        end: { row, col: colCount - 1 },
      },
    })
  }, [colCount])

  const selectColumn = useCallback((col: number) => {
    setSelection({
      activeCell: { row: 0, col },
      range: {
        start: { row: 0, col },
        end: { row: rowCount - 1, col },
      },
    })
  }, [rowCount])

  // Editing operations
  const startEditing = useCallback((row: number, col: number, initialValue?: string) => {
    const cell = cells[cellKey(row, col)]
    const value = initialValue !== undefined
      ? initialValue
      : (cell?.formula || String(cell?.value || ''))
    setEditingCell({ row, col })
    setEditValue(value)
  }, [cells])

  const updateEditValue = useCallback((value: string) => {
    setEditValue(value)
  }, [])

  const commitEdit = useCallback(() => {
    if (editingCell) {
      updateCell(editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
      setEditValue('')
    }
  }, [editingCell, editValue, updateCell])

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

  // Clear selection content
  const clearSelection = useCallback(() => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const newCells = { ...cells }
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        delete newCells[cellKey(r, c)]
      }
    }

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [selection.range, cells, syncChanges])

  // Resize operations
  const resizeColumn = useCallback((col: number, width: number) => {
    const clampedWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, width))
    const newWidths = [...columnWidths]
    newWidths[col] = clampedWidth
    setColumnWidths(newWidths)
    syncChanges({ columnWidths: newWidths })
  }, [columnWidths, syncChanges])

  const resizeRow = useCallback((row: number, height: number) => {
    const clampedHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, height))
    const newHeights = [...rowHeights]
    newHeights[row] = clampedHeight
    setRowHeights(newHeights)
    syncChanges({ rowHeights: newHeights })
  }, [rowHeights, syncChanges])

  // Insert/delete rows and columns
  const insertRow = useCallback((afterRow: number) => {
    // Shift all cells below down by 1
    const newCells: Record<string, Cell> = {}
    Object.entries(cells).forEach(([key, cell]) => {
      const pos = parseKey(key)
      if (pos.row > afterRow) {
        newCells[cellKey(pos.row + 1, pos.col)] = cell
      } else {
        newCells[key] = cell
      }
    })

    const newRowHeights = [...rowHeights]
    newRowHeights.splice(afterRow + 1, 0, DEFAULT_ROW_HEIGHT)

    setCells(newCells)
    setRowHeights(newRowHeights)
    setRowCount(rowCount + 1)
    syncChanges({ cells: newCells, rowHeights: newRowHeights, rowCount: rowCount + 1 })
  }, [cells, rowHeights, rowCount, syncChanges])

  const insertColumn = useCallback((afterCol: number) => {
    // Shift all cells to the right by 1
    const newCells: Record<string, Cell> = {}
    Object.entries(cells).forEach(([key, cell]) => {
      const pos = parseKey(key)
      if (pos.col > afterCol) {
        newCells[cellKey(pos.row, pos.col + 1)] = cell
      } else {
        newCells[key] = cell
      }
    })

    const newColWidths = [...columnWidths]
    newColWidths.splice(afterCol + 1, 0, DEFAULT_COL_WIDTH)

    setCells(newCells)
    setColumnWidths(newColWidths)
    setColCount(colCount + 1)
    syncChanges({ cells: newCells, columnWidths: newColWidths, colCount: colCount + 1 })
  }, [cells, columnWidths, colCount, syncChanges])

  const deleteRow = useCallback((row: number) => {
    // Remove cells in row and shift cells below up
    const newCells: Record<string, Cell> = {}
    Object.entries(cells).forEach(([key, cell]) => {
      const pos = parseKey(key)
      if (pos.row === row) return // Delete this row
      if (pos.row > row) {
        newCells[cellKey(pos.row - 1, pos.col)] = cell
      } else {
        newCells[key] = cell
      }
    })

    const newRowHeights = [...rowHeights]
    newRowHeights.splice(row, 1)

    setCells(newCells)
    setRowHeights(newRowHeights)
    setRowCount(rowCount - 1)
    syncChanges({ cells: newCells, rowHeights: newRowHeights, rowCount: rowCount - 1 })
  }, [cells, rowHeights, rowCount, syncChanges])

  const deleteColumn = useCallback((col: number) => {
    // Remove cells in column and shift cells to the right left
    const newCells: Record<string, Cell> = {}
    Object.entries(cells).forEach(([key, cell]) => {
      const pos = parseKey(key)
      if (pos.col === col) return // Delete this column
      if (pos.col > col) {
        newCells[cellKey(pos.row, pos.col - 1)] = cell
      } else {
        newCells[key] = cell
      }
    })

    const newColWidths = [...columnWidths]
    newColWidths.splice(col, 1)

    setCells(newCells)
    setColumnWidths(newColWidths)
    setColCount(colCount - 1)
    syncChanges({ cells: newCells, columnWidths: newColWidths, colCount: colCount - 1 })
  }, [cells, columnWidths, colCount, syncChanges])

  // Clipboard operations
  const copy = useCallback(() => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const copiedCells: Record<string, Cell> = {}
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = cells[cellKey(r, c)]
        if (cell) {
          copiedCells[cellKey(r - minRow, c - minCol)] = { ...cell }
        }
      }
    }

    setClipboard({
      cells: copiedCells,
      range: { start: { row: 0, col: 0 }, end: { row: maxRow - minRow, col: maxCol - minCol } },
      isCut: false,
    })

    // Also copy to system clipboard as TSV
    const lines: string[] = []
    for (let r = minRow; r <= maxRow; r++) {
      const row: string[] = []
      for (let c = minCol; c <= maxCol; c++) {
        const cell = cells[cellKey(r, c)]
        row.push(cell?.value?.toString() || '')
      }
      lines.push(row.join('\t'))
    }
    navigator.clipboard?.writeText(lines.join('\n'))
  }, [selection.range, cells])

  const cut = useCallback(() => {
    copy()
    if (clipboard) {
      setClipboard({ ...clipboard, isCut: true })
    }
  }, [copy, clipboard])

  const paste = useCallback(() => {
    if (!clipboard || !selection.activeCell) return

    const { row: startRow, col: startCol } = selection.activeCell
    const newCells = { ...cells }

    Object.entries(clipboard.cells).forEach(([key, cell]) => {
      const pos = parseKey(key)
      const targetKey = cellKey(startRow + pos.row, startCol + pos.col)
      newCells[targetKey] = { ...cell }
    })

    // If it was a cut, clear original cells
    if (clipboard.isCut && selection.range) {
      const { start, end } = selection.range
      const minRow = Math.min(start.row, end.row)
      const maxRow = Math.max(start.row, end.row)
      const minCol = Math.min(start.col, end.col)
      const maxCol = Math.max(start.col, end.col)

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          // Only delete if not in paste target
          const isInTarget =
            r >= startRow && r <= startRow + (clipboard.range.end.row) &&
            c >= startCol && c <= startCol + (clipboard.range.end.col)
          if (!isInTarget) {
            delete newCells[cellKey(r, c)]
          }
        }
      }
      setClipboard(null)
    }

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [clipboard, selection.activeCell, selection.range, cells, syncChanges])

  // Navigation
  const moveSelection = useCallback((direction: 'up' | 'down' | 'left' | 'right', extend = false) => {
    if (!selection.activeCell) return

    let { row, col } = selection.activeCell

    switch (direction) {
      case 'up': row = Math.max(0, row - 1); break
      case 'down': row = Math.min(rowCount - 1, row + 1); break
      case 'left': col = Math.max(0, col - 1); break
      case 'right': col = Math.min(colCount - 1, col + 1); break
    }

    selectCell(row, col, extend)
  }, [selection.activeCell, rowCount, colCount, selectCell])

  // Undo/Redo
  const canUndo = undoStack.current.length > 0
  const canRedo = redoStack.current.length > 0

  const undo = useCallback(() => {
    if (!canUndo) return
    const prevCells = undoStack.current.pop()
    if (prevCells) {
      redoStack.current.push({ ...cells })
      setCells(prevCells)
      syncChanges({ cells: prevCells })
      setUndoIndex(undoStack.current.length)
    }
  }, [canUndo, cells, syncChanges])

  const redo = useCallback(() => {
    if (!canRedo) return
    const nextCells = redoStack.current.pop()
    if (nextCells) {
      undoStack.current.push({ ...cells })
      setCells(nextCells)
      syncChanges({ cells: nextCells })
      setUndoIndex(undoStack.current.length)
    }
  }, [canRedo, cells, syncChanges])

  return {
    // Data
    cells,
    rowCount,
    colCount,
    columnWidths,
    rowHeights,

    // Selection
    selection,
    setSelection,
    selectCell,
    selectRange,
    selectAll,
    selectRow,
    selectColumn,

    // Editing
    editingCell,
    editValue,
    startEditing,
    updateEditValue,
    commitEdit,
    cancelEdit,

    // Cell operations
    getCell,
    getCellDisplayValue,
    updateCell,
    updateCellStyle,
    clearSelection,

    // Column/row operations
    resizeColumn,
    resizeRow,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,

    // Clipboard
    copy,
    cut,
    paste,
    clipboard,

    // Navigation
    moveSelection,

    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
