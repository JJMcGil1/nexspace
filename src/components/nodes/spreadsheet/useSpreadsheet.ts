import { useState, useCallback, useMemo, useRef } from 'react'
import {
  Cell,
  CellPosition,
  CellRange,
  CellStyle,
  SpreadsheetNodeData,
  SpreadsheetSelection,
  ClipboardData,
  ConditionalFormatRule,
  ConditionalFormatType,
  ColorScaleConfig,
  DataBarConfig,
  DataValidationRule,
  DataValidationType,
  DataValidationOperator,
  CellComment,
  CellCommentReply,
  cellKey,
  parseKey,
  letterToCol,
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
  frozenRows: number
  frozenCols: number

  // Freeze panes
  freezeRows: (count: number) => void
  freezeCols: (count: number) => void
  freezeAtSelection: () => void
  unfreeze: () => void

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
  updateCellFormat: (row: number, col: number, format: Cell['format']) => void
  clearSelection: () => void
  applyStyleToSelection: (style: Partial<Cell['style']>) => void

  // Column/row operations
  resizeColumn: (col: number, width: number) => void
  resizeRow: (row: number, height: number) => void
  insertRow: (afterRow: number) => void
  insertColumn: (afterCol: number) => void
  deleteRow: (row: number) => void
  deleteColumn: (col: number) => void

  // Sorting
  sortColumn: (col: number, direction: 'asc' | 'desc') => void
  sortBySelection: (direction: 'asc' | 'desc') => void

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

  // CSV
  exportToCSV: () => string
  importFromCSV: (csvString: string) => void

  // Auto-fill
  autoFill: (direction: 'down' | 'right' | 'up' | 'left', count: number) => void

  // Borders
  updateCellBorder: (row: number, col: number, border: Cell['border']) => void
  applyBorderToSelection: (borderType: 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'none', style?: { style: 'thin' | 'medium' | 'thick' | 'dashed'; color: string }) => void

  // Merge cells
  mergeCells: () => void
  unmergeCells: () => void
  isCellMerged: (row: number, col: number) => boolean
  getMergeInfo: (row: number, col: number) => { isMaster: boolean; masterRow: number; masterCol: number; rowSpan: number; colSpan: number } | null

  // Conditional formatting
  conditionalFormatRules: ConditionalFormatRule[]
  addConditionalFormatRule: (rule: Omit<ConditionalFormatRule, 'id' | 'priority'>) => string
  updateConditionalFormatRule: (id: string, updates: Partial<ConditionalFormatRule>) => void
  deleteConditionalFormatRule: (id: string) => void
  reorderConditionalFormatRules: (ruleIds: string[]) => void
  getConditionalStyle: (row: number, col: number) => CellStyle | null
  getConditionalDataBar: (row: number, col: number) => { percent: number; color: string } | null
  getConditionalColorScale: (row: number, col: number) => string | null

  // Data validation
  dataValidationRules: DataValidationRule[]
  addDataValidationRule: (rule: Omit<DataValidationRule, 'id'>) => string
  updateDataValidationRule: (id: string, updates: Partial<DataValidationRule>) => void
  deleteDataValidationRule: (id: string) => void
  getValidationForCell: (row: number, col: number) => DataValidationRule | null
  validateCellValue: (row: number, col: number, value: string | number | null) => { valid: boolean; error?: string }
  getValidationDropdownItems: (row: number, col: number) => string[] | null

  // Cell comments
  cellComments: Record<string, CellComment>
  addComment: (row: number, col: number, text: string, author?: string) => string
  updateComment: (row: number, col: number, text: string) => void
  deleteComment: (row: number, col: number) => void
  getComment: (row: number, col: number) => CellComment | null
  resolveComment: (row: number, col: number, resolved: boolean) => void
  addReply: (row: number, col: number, text: string, author?: string) => string
  deleteReply: (row: number, col: number, replyId: string) => void
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

  // Frozen panes state
  const [frozenRows, setFrozenRows] = useState(initialData.frozenRows || 0)
  const [frozenCols, setFrozenCols] = useState(initialData.frozenCols || 0)

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

  // Conditional formatting rules
  const [conditionalFormatRules, setConditionalFormatRules] = useState<ConditionalFormatRule[]>(
    initialData.conditionalFormatRules || []
  )

  // Data validation rules
  const [dataValidationRules, setDataValidationRules] = useState<DataValidationRule[]>(
    initialData.dataValidationRules || []
  )

  // Cell comments - keyed by "row,col"
  const [cellComments, setCellComments] = useState<Record<string, CellComment>>(
    initialData.cellComments || {}
  )

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
        // Convert result to cell-compatible value
        if (typeof result.value === 'boolean') {
          newCell.value = result.value ? 'TRUE' : 'FALSE'
        } else if (Array.isArray(result.value)) {
          // For array results, take first value or convert to string
          newCell.value = result.value[0] ?? String(result.value)
        } else {
          newCell.value = result.value
        }
        newCell.displayValue = String(newCell.value ?? '')
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

  // Update cell format
  const updateCellFormat = useCallback((row: number, col: number, format: Cell['format']) => {
    const key = cellKey(row, col)
    const existingCell = cells[key] || { value: null }
    const newCell: Cell = {
      ...existingCell,
      format,
    }

    const newCells = { ...cells, [key]: newCell }
    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [cells, syncChanges])

  // Apply style to entire selection
  const applyStyleToSelection = useCallback((style: Partial<Cell['style']>) => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const newCells = { ...cells }
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = cellKey(r, c)
        const existingCell = newCells[key] || { value: null }
        newCells[key] = {
          ...existingCell,
          style: { ...existingCell.style, ...style },
        }
      }
    }

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [selection.range, cells, syncChanges])

  // Sort column
  const sortColumn = useCallback((col: number, direction: 'asc' | 'desc') => {
    // Get all rows that have data in this column
    const rowData: { row: number; value: string | number | null }[] = []
    for (let r = 0; r < rowCount; r++) {
      const cell = cells[cellKey(r, col)]
      rowData.push({ row: r, value: cell?.value ?? null })
    }

    // Sort rows
    rowData.sort((a, b) => {
      const aVal = a.value
      const bVal = b.value

      // Nulls go to bottom
      if (aVal === null || aVal === '') return 1
      if (bVal === null || bVal === '') return -1

      // Numeric comparison
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal))
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal))

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum
      }

      // String comparison
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      const cmp = aStr.localeCompare(bStr)
      return direction === 'asc' ? cmp : -cmp
    })

    // Build new cells object with reordered rows
    const newCells: Record<string, Cell> = {}
    const rowMapping = rowData.map(d => d.row)

    for (let newRow = 0; newRow < rowCount; newRow++) {
      const oldRow = rowMapping[newRow]
      for (let c = 0; c < colCount; c++) {
        const oldKey = cellKey(oldRow, c)
        const newKey = cellKey(newRow, c)
        if (cells[oldKey]) {
          newCells[newKey] = { ...cells[oldKey] }
        }
      }
    }

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [cells, rowCount, colCount, syncChanges])

  // Sort by selection (uses the first column in selection)
  const sortBySelection = useCallback((direction: 'asc' | 'desc') => {
    if (!selection.activeCell) return
    sortColumn(selection.activeCell.col, direction)
  }, [selection.activeCell, sortColumn])

  // Export to CSV
  const exportToCSV = useCallback((): string => {
    const lines: string[] = []

    for (let r = 0; r < rowCount; r++) {
      const row: string[] = []
      for (let c = 0; c < colCount; c++) {
        const cell = cells[cellKey(r, c)]
        let value = cell?.value ?? ''

        // Escape quotes and wrap in quotes if contains comma or newline
        const strValue = String(value)
        if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
          value = `"${strValue.replace(/"/g, '""')}"`
        }

        row.push(String(value))
      }

      // Skip empty rows at the end
      if (row.some(v => v !== '')) {
        lines.push(row.join(','))
      }
    }

    return lines.join('\n')
  }, [cells, rowCount, colCount])

  // Freeze panes
  const freezeRows = useCallback((count: number) => {
    const validCount = Math.max(0, Math.min(count, rowCount - 1))
    setFrozenRows(validCount)
    syncChanges({ frozenRows: validCount })
  }, [rowCount, syncChanges])

  const freezeCols = useCallback((count: number) => {
    const validCount = Math.max(0, Math.min(count, colCount - 1))
    setFrozenCols(validCount)
    syncChanges({ frozenCols: validCount })
  }, [colCount, syncChanges])

  const freezeAtSelection = useCallback(() => {
    if (!selection.activeCell) return
    const { row, col } = selection.activeCell
    setFrozenRows(row)
    setFrozenCols(col)
    syncChanges({ frozenRows: row, frozenCols: col })
  }, [selection.activeCell, syncChanges])

  const unfreeze = useCallback(() => {
    setFrozenRows(0)
    setFrozenCols(0)
    syncChanges({ frozenRows: 0, frozenCols: 0 })
  }, [syncChanges])

  // Auto-fill functionality
  const autoFill = useCallback((direction: 'down' | 'right' | 'up' | 'left', count: number) => {
    if (!selection.range || count <= 0) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const newCells = { ...cells }

    // Get source values for pattern detection
    const getSourceValues = (isVertical: boolean): (string | number | null)[][] => {
      const values: (string | number | null)[][] = []
      if (isVertical) {
        for (let c = minCol; c <= maxCol; c++) {
          const colValues: (string | number | null)[] = []
          for (let r = minRow; r <= maxRow; r++) {
            const cell = cells[cellKey(r, c)]
            colValues.push(cell?.value ?? null)
          }
          values.push(colValues)
        }
      } else {
        for (let r = minRow; r <= maxRow; r++) {
          const rowValues: (string | number | null)[] = []
          for (let c = minCol; c <= maxCol; c++) {
            const cell = cells[cellKey(r, c)]
            rowValues.push(cell?.value ?? null)
          }
          values.push(rowValues)
        }
      }
      return values
    }

    // Detect pattern and get next value
    const getNextValue = (values: (string | number | null)[], index: number): string | number | null => {
      if (values.length === 0) return null

      // Filter out nulls for pattern detection
      const nonNull = values.filter(v => v !== null)
      if (nonNull.length === 0) return null

      // Check if all values are numbers
      const allNumbers = nonNull.every(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v))))

      if (allNumbers) {
        const nums = nonNull.map(v => typeof v === 'number' ? v : parseFloat(v as string))

        if (nums.length === 1) {
          // Single number: increment by 1
          return nums[0] + index + 1
        } else {
          // Multiple numbers: detect arithmetic progression
          const diffs: number[] = []
          for (let i = 1; i < nums.length; i++) {
            diffs.push(nums[i] - nums[i - 1])
          }
          const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
          const lastValue = nums[nums.length - 1]
          return lastValue + avgDiff * (index + 1)
        }
      }

      // Check for date patterns (simple detection)
      const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/
      if (nonNull.every(v => typeof v === 'string' && datePattern.test(v as string))) {
        try {
          const dates = nonNull.map(v => new Date(v as string))
          if (dates.every(d => !isNaN(d.getTime()))) {
            if (dates.length === 1) {
              // Single date: increment by 1 day
              const newDate = new Date(dates[0])
              newDate.setDate(newDate.getDate() + index + 1)
              return newDate.toLocaleDateString()
            } else {
              // Multiple dates: detect difference
              const lastDate = dates[dates.length - 1]
              const diffMs = dates.length > 1 ? dates[dates.length - 1].getTime() - dates[dates.length - 2].getTime() : 86400000
              const newDate = new Date(lastDate.getTime() + diffMs * (index + 1))
              return newDate.toLocaleDateString()
            }
          }
        } catch {
          // Not valid dates, continue
        }
      }

      // For text: repeat pattern
      const patternIndex = index % values.length
      return values[patternIndex]
    }

    // Get source cell style for copying
    const getSourceStyle = (row: number, col: number) => {
      const cell = cells[cellKey(row, col)]
      return cell?.style ? { ...cell.style } : undefined
    }

    const isVertical = direction === 'down' || direction === 'up'
    const sourceValues = getSourceValues(isVertical)

    if (direction === 'down') {
      for (let i = 0; i < count; i++) {
        const targetRow = maxRow + 1 + i
        if (targetRow >= rowCount) break
        for (let c = minCol; c <= maxCol; c++) {
          const colIndex = c - minCol
          const newValue = getNextValue(sourceValues[colIndex], i)
          const sourceRow = minRow + (i % (maxRow - minRow + 1))
          const style = getSourceStyle(sourceRow, c)
          newCells[cellKey(targetRow, c)] = { value: newValue, style }
        }
      }
    } else if (direction === 'up') {
      for (let i = 0; i < count; i++) {
        const targetRow = minRow - 1 - i
        if (targetRow < 0) break
        for (let c = minCol; c <= maxCol; c++) {
          const colIndex = c - minCol
          const reversedValues = [...sourceValues[colIndex]].reverse()
          const newValue = getNextValue(reversedValues, i)
          const sourceRow = maxRow - (i % (maxRow - minRow + 1))
          const style = getSourceStyle(sourceRow, c)
          newCells[cellKey(targetRow, c)] = { value: newValue, style }
        }
      }
    } else if (direction === 'right') {
      for (let i = 0; i < count; i++) {
        const targetCol = maxCol + 1 + i
        if (targetCol >= colCount) break
        for (let r = minRow; r <= maxRow; r++) {
          const rowIndex = r - minRow
          const newValue = getNextValue(sourceValues[rowIndex], i)
          const sourceCol = minCol + (i % (maxCol - minCol + 1))
          const style = getSourceStyle(r, sourceCol)
          newCells[cellKey(r, targetCol)] = { value: newValue, style }
        }
      }
    } else if (direction === 'left') {
      for (let i = 0; i < count; i++) {
        const targetCol = minCol - 1 - i
        if (targetCol < 0) break
        for (let r = minRow; r <= maxRow; r++) {
          const rowIndex = r - minRow
          const reversedValues = [...sourceValues[rowIndex]].reverse()
          const newValue = getNextValue(reversedValues, i)
          const sourceCol = maxCol - (i % (maxCol - minCol + 1))
          const style = getSourceStyle(r, sourceCol)
          newCells[cellKey(r, targetCol)] = { value: newValue, style }
        }
      }
    }

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })

    // Update selection to include new cells
    let newEnd = { ...selection.range.end }
    if (direction === 'down') newEnd.row = Math.min(maxRow + count, rowCount - 1)
    else if (direction === 'up') newEnd.row = Math.max(minRow - count, 0)
    else if (direction === 'right') newEnd.col = Math.min(maxCol + count, colCount - 1)
    else if (direction === 'left') newEnd.col = Math.max(minCol - count, 0)

    setSelection({
      activeCell: selection.activeCell,
      range: { start: selection.range.start, end: newEnd },
    })
  }, [selection.range, selection.activeCell, cells, rowCount, colCount, syncChanges])

  // Update cell border
  const updateCellBorder = useCallback((row: number, col: number, border: Cell['border']) => {
    const key = cellKey(row, col)
    const existingCell = cells[key] || { value: null }
    const newCell: Cell = {
      ...existingCell,
      border: border ? { ...existingCell.border, ...border } : undefined,
    }

    const newCells = { ...cells, [key]: newCell }
    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [cells, syncChanges])

  // Apply border to entire selection
  const applyBorderToSelection = useCallback((
    borderType: 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'none',
    style: { style: 'thin' | 'medium' | 'thick' | 'dashed'; color: string } = { style: 'thin', color: '#8a63d2' }
  ) => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const newCells = { ...cells }

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = cellKey(r, c)
        const existingCell = newCells[key] || { value: null }
        let border: Cell['border'] = { ...existingCell.border }

        if (borderType === 'none') {
          border = undefined
        } else if (borderType === 'all') {
          border = { top: style, right: style, bottom: style, left: style }
        } else if (borderType === 'outer') {
          if (r === minRow) border.top = style
          if (r === maxRow) border.bottom = style
          if (c === minCol) border.left = style
          if (c === maxCol) border.right = style
          // Clear inner borders
          if (r > minRow && border.top) delete border.top
          if (r < maxRow && border.bottom) delete border.bottom
          if (c > minCol && border.left) delete border.left
          if (c < maxCol && border.right) delete border.right
        } else if (borderType === 'inner') {
          if (r > minRow) border.top = style
          if (r < maxRow) border.bottom = style
          if (c > minCol) border.left = style
          if (c < maxCol) border.right = style
        } else if (borderType === 'top') {
          if (r === minRow) border.top = style
        } else if (borderType === 'bottom') {
          if (r === maxRow) border.bottom = style
        } else if (borderType === 'left') {
          if (c === minCol) border.left = style
        } else if (borderType === 'right') {
          if (c === maxCol) border.right = style
        }

        newCells[key] = { ...existingCell, border }
      }
    }

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [selection.range, cells, syncChanges])

  // Check if a cell is part of a merge
  const getMergeInfo = useCallback((row: number, col: number): { isMaster: boolean; masterRow: number; masterCol: number; rowSpan: number; colSpan: number } | null => {
    // Check if this cell is a merge master
    const cell = cells[cellKey(row, col)]
    if (cell?.rowSpan && cell?.colSpan && (cell.rowSpan > 1 || cell.colSpan > 1)) {
      return {
        isMaster: true,
        masterRow: row,
        masterCol: col,
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
      }
    }

    // Check if this cell is part of another cell's merge
    // We need to scan for merge masters that include this cell
    for (const [key, c] of Object.entries(cells)) {
      if (c.rowSpan && c.colSpan && (c.rowSpan > 1 || c.colSpan > 1)) {
        const pos = parseKey(key)
        if (
          row >= pos.row && row < pos.row + c.rowSpan &&
          col >= pos.col && col < pos.col + c.colSpan &&
          (row !== pos.row || col !== pos.col)
        ) {
          return {
            isMaster: false,
            masterRow: pos.row,
            masterCol: pos.col,
            rowSpan: c.rowSpan,
            colSpan: c.colSpan,
          }
        }
      }
    }

    return null
  }, [cells])

  const isCellMerged = useCallback((row: number, col: number): boolean => {
    return getMergeInfo(row, col) !== null
  }, [getMergeInfo])

  // Merge cells in selection
  const mergeCells = useCallback(() => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    // Need at least 2 cells to merge
    if (maxRow - minRow === 0 && maxCol - minCol === 0) return

    // Check if any cells in the range are already merged
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const mergeInfo = getMergeInfo(r, c)
        if (mergeInfo) {
          // Cell is part of an existing merge
          // Could show error or unmerge first
          console.warn('Cannot merge: selection contains merged cells')
          return
        }
      }
    }

    const newCells = { ...cells }

    // Get the value from the top-left cell (master)
    const masterKey = cellKey(minRow, minCol)
    const masterCell = cells[masterKey]

    // Set the merge spans on the master cell
    newCells[masterKey] = {
      ...masterCell,
      value: masterCell?.value ?? null,
      rowSpan: maxRow - minRow + 1,
      colSpan: maxCol - minCol + 1,
    }

    // Clear all other cells in the merge range
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r === minRow && c === minCol) continue // Skip master
        const key = cellKey(r, c)
        // Keep style but clear value
        const existingCell = cells[key]
        if (existingCell) {
          newCells[key] = { ...existingCell, value: null }
        }
      }
    }

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [selection.range, cells, getMergeInfo, syncChanges])

  // Unmerge cells in selection
  const unmergeCells = useCallback(() => {
    if (!selection.range) return

    const { start, end } = selection.range
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const newCells = { ...cells }
    let anyUnmerged = false

    // Find all merge masters in or overlapping the selection
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const mergeInfo = getMergeInfo(r, c)
        if (mergeInfo) {
          // Unmerge by removing rowSpan/colSpan from master
          const masterKey = cellKey(mergeInfo.masterRow, mergeInfo.masterCol)
          const masterCell = newCells[masterKey]
          if (masterCell && (masterCell.rowSpan || masterCell.colSpan)) {
            newCells[masterKey] = {
              ...masterCell,
              rowSpan: undefined,
              colSpan: undefined,
            }
            anyUnmerged = true
          }
        }
      }
    }

    if (!anyUnmerged) return

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    syncChanges({ cells: newCells })
  }, [selection.range, cells, getMergeInfo, syncChanges])

  // ═══════════════════════════════════════════════════════════
  // Conditional Formatting
  // ═══════════════════════════════════════════════════════════

  // Helper: Check if a cell is within a range
  const isCellInRange = useCallback((row: number, col: number, range: CellRange): boolean => {
    const minRow = Math.min(range.start.row, range.end.row)
    const maxRow = Math.max(range.start.row, range.end.row)
    const minCol = Math.min(range.start.col, range.end.col)
    const maxCol = Math.max(range.start.col, range.end.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }, [])

  // Helper: Get all values in a range (for stats calculations)
  const getRangeValues = useCallback((ranges: CellRange[]): (number | null)[] => {
    const values: (number | null)[] = []
    ranges.forEach(range => {
      const minRow = Math.min(range.start.row, range.end.row)
      const maxRow = Math.max(range.start.row, range.end.row)
      const minCol = Math.min(range.start.col, range.end.col)
      const maxCol = Math.max(range.start.col, range.end.col)
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const cell = cells[cellKey(r, c)]
          if (cell?.value !== null && cell?.value !== undefined && cell?.value !== '') {
            const num = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value))
            values.push(isNaN(num) ? null : num)
          } else {
            values.push(null)
          }
        }
      }
    })
    return values
  }, [cells])

  // Evaluate if a rule matches a cell
  const evaluateRule = useCallback((
    rule: ConditionalFormatRule,
    row: number,
    col: number
  ): boolean => {
    // Check if cell is in any of the rule's ranges
    const inRange = rule.ranges.some(range => isCellInRange(row, col, range))
    if (!inRange) return false

    const cell = cells[cellKey(row, col)]
    const cellValue = cell?.value
    const numValue = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue || ''))
    const strValue = String(cellValue || '').toLowerCase()
    const ruleValue = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value || ''))
    const ruleValue2 = typeof rule.value2 === 'number' ? rule.value2 : parseFloat(String(rule.value2 || ''))
    const ruleStr = String(rule.value || '').toLowerCase()

    switch (rule.type) {
      case 'greaterThan':
        return !isNaN(numValue) && !isNaN(ruleValue) && numValue > ruleValue
      case 'lessThan':
        return !isNaN(numValue) && !isNaN(ruleValue) && numValue < ruleValue
      case 'greaterThanOrEqual':
        return !isNaN(numValue) && !isNaN(ruleValue) && numValue >= ruleValue
      case 'lessThanOrEqual':
        return !isNaN(numValue) && !isNaN(ruleValue) && numValue <= ruleValue
      case 'equals':
        if (!isNaN(numValue) && !isNaN(ruleValue)) return numValue === ruleValue
        return strValue === ruleStr
      case 'notEquals':
        if (!isNaN(numValue) && !isNaN(ruleValue)) return numValue !== ruleValue
        return strValue !== ruleStr
      case 'between':
        return !isNaN(numValue) && !isNaN(ruleValue) && !isNaN(ruleValue2) &&
          numValue >= Math.min(ruleValue, ruleValue2) && numValue <= Math.max(ruleValue, ruleValue2)
      case 'notBetween':
        return !isNaN(numValue) && !isNaN(ruleValue) && !isNaN(ruleValue2) &&
          (numValue < Math.min(ruleValue, ruleValue2) || numValue > Math.max(ruleValue, ruleValue2))
      case 'textContains':
        return strValue.includes(ruleStr)
      case 'textNotContains':
        return !strValue.includes(ruleStr)
      case 'textStartsWith':
        return strValue.startsWith(ruleStr)
      case 'textEndsWith':
        return strValue.endsWith(ruleStr)
      case 'blank':
        return cellValue === null || cellValue === undefined || cellValue === ''
      case 'notBlank':
        return cellValue !== null && cellValue !== undefined && cellValue !== ''
      case 'duplicate': {
        const allValues = getRangeValues(rule.ranges)
        const nonNullValues = allValues.filter(v => v !== null)
        const count = nonNullValues.filter(v => v === numValue).length
        return !isNaN(numValue) && count > 1
      }
      case 'unique': {
        const allValues = getRangeValues(rule.ranges)
        const nonNullValues = allValues.filter(v => v !== null)
        const count = nonNullValues.filter(v => v === numValue).length
        return !isNaN(numValue) && count === 1
      }
      case 'aboveAverage': {
        const allValues = getRangeValues(rule.ranges).filter(v => v !== null) as number[]
        if (allValues.length === 0) return false
        const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length
        return !isNaN(numValue) && numValue > avg
      }
      case 'belowAverage': {
        const allValues = getRangeValues(rule.ranges).filter(v => v !== null) as number[]
        if (allValues.length === 0) return false
        const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length
        return !isNaN(numValue) && numValue < avg
      }
      case 'top10': {
        const allValues = getRangeValues(rule.ranges).filter(v => v !== null) as number[]
        if (allValues.length === 0 || isNaN(numValue)) return false
        const sorted = [...new Set(allValues)].sort((a, b) => b - a)
        const n = rule.percent ? Math.ceil(sorted.length * (rule.rank || 10) / 100) : (rule.rank || 10)
        const topN = sorted.slice(0, n)
        return topN.includes(numValue)
      }
      case 'bottom10': {
        const allValues = getRangeValues(rule.ranges).filter(v => v !== null) as number[]
        if (allValues.length === 0 || isNaN(numValue)) return false
        const sorted = [...new Set(allValues)].sort((a, b) => a - b)
        const n = rule.percent ? Math.ceil(sorted.length * (rule.rank || 10) / 100) : (rule.rank || 10)
        const bottomN = sorted.slice(0, n)
        return bottomN.includes(numValue)
      }
      case 'colorScale':
      case 'dataBar':
      case 'iconSet':
        // These are handled differently - they always "match" for cells in range
        return true
      case 'customFormula':
        // Would need formula evaluation - for now, skip
        return false
      default:
        return false
    }
  }, [cells, isCellInRange, getRangeValues])

  // Add a conditional format rule
  const addConditionalFormatRule = useCallback((rule: Omit<ConditionalFormatRule, 'id' | 'priority'>): string => {
    const id = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const priority = conditionalFormatRules.length
    const newRule: ConditionalFormatRule = { ...rule, id, priority }
    const newRules = [...conditionalFormatRules, newRule]
    setConditionalFormatRules(newRules)
    syncChanges({ conditionalFormatRules: newRules })
    return id
  }, [conditionalFormatRules, syncChanges])

  // Update a conditional format rule
  const updateConditionalFormatRule = useCallback((id: string, updates: Partial<ConditionalFormatRule>) => {
    const newRules = conditionalFormatRules.map(rule =>
      rule.id === id ? { ...rule, ...updates } : rule
    )
    setConditionalFormatRules(newRules)
    syncChanges({ conditionalFormatRules: newRules })
  }, [conditionalFormatRules, syncChanges])

  // Delete a conditional format rule
  const deleteConditionalFormatRule = useCallback((id: string) => {
    const newRules = conditionalFormatRules
      .filter(rule => rule.id !== id)
      .map((rule, index) => ({ ...rule, priority: index }))
    setConditionalFormatRules(newRules)
    syncChanges({ conditionalFormatRules: newRules })
  }, [conditionalFormatRules, syncChanges])

  // Reorder rules (change priorities)
  const reorderConditionalFormatRules = useCallback((ruleIds: string[]) => {
    const newRules = ruleIds
      .map((id, index) => {
        const rule = conditionalFormatRules.find(r => r.id === id)
        return rule ? { ...rule, priority: index } : null
      })
      .filter(Boolean) as ConditionalFormatRule[]
    setConditionalFormatRules(newRules)
    syncChanges({ conditionalFormatRules: newRules })
  }, [conditionalFormatRules, syncChanges])

  // Get the conditional style for a cell
  const getConditionalStyle = useCallback((row: number, col: number): CellStyle | null => {
    // Sort rules by priority
    const sortedRules = [...conditionalFormatRules].sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
      // Skip color scales and data bars - they're handled separately
      if (rule.type === 'colorScale' || rule.type === 'dataBar' || rule.type === 'iconSet') continue

      if (evaluateRule(rule, row, col) && rule.style) {
        return rule.style
      }

      if (rule.stopIfTrue && evaluateRule(rule, row, col)) {
        break
      }
    }

    return null
  }, [conditionalFormatRules, evaluateRule])

  // Get data bar info for a cell
  const getConditionalDataBar = useCallback((row: number, col: number): { percent: number; color: string } | null => {
    const sortedRules = [...conditionalFormatRules].sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
      if (rule.type !== 'dataBar' || !rule.dataBar) continue
      if (!rule.ranges.some(range => isCellInRange(row, col, range))) continue

      const cell = cells[cellKey(row, col)]
      const numValue = typeof cell?.value === 'number' ? cell.value : parseFloat(String(cell?.value || ''))
      if (isNaN(numValue)) return null

      const allValues = getRangeValues(rule.ranges).filter(v => v !== null) as number[]
      if (allValues.length === 0) return null

      let minVal: number
      let maxVal: number

      if (rule.dataBar.minType === 'number' && rule.dataBar.minValue !== undefined) {
        minVal = rule.dataBar.minValue
      } else if (rule.dataBar.minType === 'percent' && rule.dataBar.minValue !== undefined) {
        const range = Math.max(...allValues) - Math.min(...allValues)
        minVal = Math.min(...allValues) + range * rule.dataBar.minValue / 100
      } else {
        minVal = Math.min(...allValues)
      }

      if (rule.dataBar.maxType === 'number' && rule.dataBar.maxValue !== undefined) {
        maxVal = rule.dataBar.maxValue
      } else if (rule.dataBar.maxType === 'percent' && rule.dataBar.maxValue !== undefined) {
        const range = Math.max(...allValues) - Math.min(...allValues)
        maxVal = Math.min(...allValues) + range * rule.dataBar.maxValue / 100
      } else {
        maxVal = Math.max(...allValues)
      }

      const range = maxVal - minVal
      if (range === 0) return { percent: 100, color: rule.dataBar.color }

      const percent = Math.max(0, Math.min(100, ((numValue - minVal) / range) * 100))
      return { percent, color: rule.dataBar.color }
    }

    return null
  }, [conditionalFormatRules, cells, isCellInRange, getRangeValues])

  // Get color scale color for a cell
  const getConditionalColorScale = useCallback((row: number, col: number): string | null => {
    const sortedRules = [...conditionalFormatRules].sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
      if (rule.type !== 'colorScale' || !rule.colorScale) continue
      if (!rule.ranges.some(range => isCellInRange(row, col, range))) continue

      const cell = cells[cellKey(row, col)]
      const numValue = typeof cell?.value === 'number' ? cell.value : parseFloat(String(cell?.value || ''))
      if (isNaN(numValue)) return null

      const allValues = getRangeValues(rule.ranges).filter(v => v !== null) as number[]
      if (allValues.length === 0) return null

      const minV = Math.min(...allValues)
      const maxV = Math.max(...allValues)
      const range = maxV - minV
      if (range === 0) return rule.colorScale.minColor

      // Calculate position (0-1)
      const position = (numValue - minV) / range

      // Interpolate colors
      const parseColor = (hex: string): { r: number; g: number; b: number } => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        } : { r: 255, g: 255, b: 255 }
      }

      const interpolate = (c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }, t: number) => {
        return {
          r: Math.round(c1.r + (c2.r - c1.r) * t),
          g: Math.round(c1.g + (c2.g - c1.g) * t),
          b: Math.round(c1.b + (c2.b - c1.b) * t),
        }
      }

      const minColor = parseColor(rule.colorScale.minColor)
      const maxColor = parseColor(rule.colorScale.maxColor)

      let finalColor: { r: number; g: number; b: number }

      if (rule.colorScale.midColor) {
        const midColor = parseColor(rule.colorScale.midColor)
        if (position < 0.5) {
          finalColor = interpolate(minColor, midColor, position * 2)
        } else {
          finalColor = interpolate(midColor, maxColor, (position - 0.5) * 2)
        }
      } else {
        finalColor = interpolate(minColor, maxColor, position)
      }

      return `rgb(${finalColor.r}, ${finalColor.g}, ${finalColor.b})`
    }

    return null
  }, [conditionalFormatRules, cells, isCellInRange, getRangeValues])

  // ═══════════════════════════════════════════════════════════
  // Data Validation
  // ═══════════════════════════════════════════════════════════

  // Add a data validation rule
  const addDataValidationRule = useCallback((rule: Omit<DataValidationRule, 'id'>): string => {
    const id = `dv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newRule: DataValidationRule = { ...rule, id }
    const newRules = [...dataValidationRules, newRule]
    setDataValidationRules(newRules)
    syncChanges({ dataValidationRules: newRules })
    return id
  }, [dataValidationRules, syncChanges])

  // Update a data validation rule
  const updateDataValidationRule = useCallback((id: string, updates: Partial<DataValidationRule>) => {
    const newRules = dataValidationRules.map(rule =>
      rule.id === id ? { ...rule, ...updates } : rule
    )
    setDataValidationRules(newRules)
    syncChanges({ dataValidationRules: newRules })
  }, [dataValidationRules, syncChanges])

  // Delete a data validation rule
  const deleteDataValidationRule = useCallback((id: string) => {
    const newRules = dataValidationRules.filter(rule => rule.id !== id)
    setDataValidationRules(newRules)
    syncChanges({ dataValidationRules: newRules })
  }, [dataValidationRules, syncChanges])

  // Get validation rule for a specific cell
  const getValidationForCell = useCallback((row: number, col: number): DataValidationRule | null => {
    for (const rule of dataValidationRules) {
      for (const range of rule.ranges) {
        if (isCellInRange(row, col, range)) {
          return rule
        }
      }
    }
    return null
  }, [dataValidationRules, isCellInRange])

  // Validate a cell value against its validation rule
  const validateCellValue = useCallback((
    row: number,
    col: number,
    value: string | number | null
  ): { valid: boolean; error?: string } => {
    const rule = getValidationForCell(row, col)
    if (!rule) return { valid: true }

    // Allow blank values if specified
    if ((value === null || value === undefined || value === '') && rule.allowBlank !== false) {
      return { valid: true }
    }

    const strValue = String(value || '')
    const numValue = typeof value === 'number' ? value : parseFloat(strValue)

    const getErrorMessage = () => {
      if (rule.errorMessage) return rule.errorMessage
      switch (rule.type) {
        case 'list':
          return 'Value must be from the dropdown list'
        case 'number':
        case 'decimal':
          return 'Value must be a valid number'
        case 'integer':
          return 'Value must be a whole number'
        case 'date':
          return 'Value must be a valid date'
        case 'textLength':
          return 'Text length is not valid'
        default:
          return 'Invalid value'
      }
    }

    switch (rule.type) {
      case 'list': {
        // Get list items from rule or from cell range
        let listItems: string[] = []
        if (rule.listItems) {
          listItems = rule.listItems
        } else if (rule.listSource) {
          // Parse cell range reference to get list items
          // For now, just use listItems - range parsing would be more complex
          listItems = []
        }

        if (listItems.length > 0 && !listItems.includes(strValue)) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }
      }

      case 'number':
      case 'decimal': {
        if (isNaN(numValue)) {
          return { valid: false, error: getErrorMessage() }
        }
        return validateNumericRule(numValue, rule)
      }

      case 'integer': {
        if (isNaN(numValue) || !Number.isInteger(numValue)) {
          return { valid: false, error: getErrorMessage() }
        }
        return validateNumericRule(numValue, rule)
      }

      case 'date': {
        const dateValue = new Date(strValue)
        if (isNaN(dateValue.getTime())) {
          return { valid: false, error: getErrorMessage() }
        }
        // Could add date range validation here
        return { valid: true }
      }

      case 'textLength': {
        const length = strValue.length
        return validateNumericRule(length, rule)
      }

      case 'custom': {
        // Would need formula evaluation for custom validation
        return { valid: true }
      }

      default:
        return { valid: true }
    }
  }, [getValidationForCell])

  // Helper to validate numeric values with operators
  const validateNumericRule = (
    value: number,
    rule: DataValidationRule
  ): { valid: boolean; error?: string } => {
    const value1 = typeof rule.value1 === 'number' ? rule.value1 : parseFloat(String(rule.value1 || ''))
    const value2 = typeof rule.value2 === 'number' ? rule.value2 : parseFloat(String(rule.value2 || ''))

    const getErrorMessage = () => {
      if (rule.errorMessage) return rule.errorMessage
      switch (rule.operator) {
        case 'between':
          return `Value must be between ${value1} and ${value2}`
        case 'notBetween':
          return `Value must not be between ${value1} and ${value2}`
        case 'equalTo':
          return `Value must equal ${value1}`
        case 'notEqualTo':
          return `Value must not equal ${value1}`
        case 'greaterThan':
          return `Value must be greater than ${value1}`
        case 'lessThan':
          return `Value must be less than ${value1}`
        case 'greaterThanOrEqual':
          return `Value must be greater than or equal to ${value1}`
        case 'lessThanOrEqual':
          return `Value must be less than or equal to ${value1}`
        default:
          return 'Invalid value'
      }
    }

    if (!rule.operator) return { valid: true }

    switch (rule.operator) {
      case 'between':
        if (isNaN(value1) || isNaN(value2)) return { valid: true }
        if (value < Math.min(value1, value2) || value > Math.max(value1, value2)) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      case 'notBetween':
        if (isNaN(value1) || isNaN(value2)) return { valid: true }
        if (value >= Math.min(value1, value2) && value <= Math.max(value1, value2)) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      case 'equalTo':
        if (isNaN(value1)) return { valid: true }
        if (value !== value1) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      case 'notEqualTo':
        if (isNaN(value1)) return { valid: true }
        if (value === value1) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      case 'greaterThan':
        if (isNaN(value1)) return { valid: true }
        if (value <= value1) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      case 'lessThan':
        if (isNaN(value1)) return { valid: true }
        if (value >= value1) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      case 'greaterThanOrEqual':
        if (isNaN(value1)) return { valid: true }
        if (value < value1) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      case 'lessThanOrEqual':
        if (isNaN(value1)) return { valid: true }
        if (value > value1) {
          return { valid: false, error: getErrorMessage() }
        }
        return { valid: true }

      default:
        return { valid: true }
    }
  }

  // Get dropdown items for a cell (if it has list validation)
  const getValidationDropdownItems = useCallback((row: number, col: number): string[] | null => {
    const rule = getValidationForCell(row, col)
    if (!rule || rule.type !== 'list') return null
    if (rule.showDropdown === false) return null

    // Return list items directly if defined
    if (rule.listItems && rule.listItems.length > 0) {
      return rule.listItems
    }

    // Parse cell range reference to get list items
    if (rule.listSource) {
      const match = rule.listSource.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i)
      if (match) {
        const startCol = letterToCol(match[1].toUpperCase())
        const startRow = parseInt(match[2], 10) - 1
        const endCol = letterToCol(match[3].toUpperCase())
        const endRow = parseInt(match[4], 10) - 1

        const items: string[] = []
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const cell = cells[cellKey(r, c)]
            if (cell?.value !== null && cell?.value !== undefined && cell?.value !== '') {
              items.push(String(cell.value))
            }
          }
        }
        return items
      }
    }

    return null
  }, [getValidationForCell, cells])

  // ═══════════════════════════════════════════════════════════
  // Cell Comments
  // ═══════════════════════════════════════════════════════════

  // Get comment for a cell
  const getComment = useCallback((row: number, col: number): CellComment | null => {
    const key = cellKey(row, col)
    return cellComments[key] || null
  }, [cellComments])

  // Add a comment to a cell
  const addComment = useCallback((
    row: number,
    col: number,
    text: string,
    author: string = 'User'
  ): string => {
    const key = cellKey(row, col)
    const id = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const newComment: CellComment = {
      id,
      author,
      text,
      createdAt: Date.now(),
      replies: [],
    }

    const newComments = { ...cellComments, [key]: newComment }
    setCellComments(newComments)
    syncChanges({ cellComments: newComments })
    return id
  }, [cellComments, syncChanges])

  // Update a comment's text
  const updateComment = useCallback((row: number, col: number, text: string) => {
    const key = cellKey(row, col)
    const existing = cellComments[key]
    if (!existing) return

    const updatedComment: CellComment = {
      ...existing,
      text,
      updatedAt: Date.now(),
    }

    const newComments = { ...cellComments, [key]: updatedComment }
    setCellComments(newComments)
    syncChanges({ cellComments: newComments })
  }, [cellComments, syncChanges])

  // Delete a comment from a cell
  const deleteComment = useCallback((row: number, col: number) => {
    const key = cellKey(row, col)
    if (!cellComments[key]) return

    const newComments = { ...cellComments }
    delete newComments[key]
    setCellComments(newComments)
    syncChanges({ cellComments: newComments })
  }, [cellComments, syncChanges])

  // Resolve/unresolve a comment
  const resolveComment = useCallback((row: number, col: number, resolved: boolean) => {
    const key = cellKey(row, col)
    const existing = cellComments[key]
    if (!existing) return

    const updatedComment: CellComment = {
      ...existing,
      resolved,
      updatedAt: Date.now(),
    }

    const newComments = { ...cellComments, [key]: updatedComment }
    setCellComments(newComments)
    syncChanges({ cellComments: newComments })
  }, [cellComments, syncChanges])

  // Add a reply to a comment
  const addReply = useCallback((
    row: number,
    col: number,
    text: string,
    author: string = 'User'
  ): string => {
    const key = cellKey(row, col)
    const existing = cellComments[key]
    if (!existing) return ''

    const replyId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newReply: CellCommentReply = {
      id: replyId,
      author,
      text,
      createdAt: Date.now(),
    }

    const updatedComment: CellComment = {
      ...existing,
      replies: [...(existing.replies || []), newReply],
      updatedAt: Date.now(),
    }

    const newComments = { ...cellComments, [key]: updatedComment }
    setCellComments(newComments)
    syncChanges({ cellComments: newComments })
    return replyId
  }, [cellComments, syncChanges])

  // Delete a reply from a comment
  const deleteReply = useCallback((row: number, col: number, replyId: string) => {
    const key = cellKey(row, col)
    const existing = cellComments[key]
    if (!existing || !existing.replies) return

    const updatedComment: CellComment = {
      ...existing,
      replies: existing.replies.filter(r => r.id !== replyId),
      updatedAt: Date.now(),
    }

    const newComments = { ...cellComments, [key]: updatedComment }
    setCellComments(newComments)
    syncChanges({ cellComments: newComments })
  }, [cellComments, syncChanges])

  // Import from CSV
  const importFromCSV = useCallback((csvString: string) => {
    const lines = csvString.split(/\r?\n/)
    const newCells: Record<string, Cell> = {}

    let maxCol = 0

    for (let r = 0; r < lines.length; r++) {
      const line = lines[r]
      if (!line.trim()) continue

      // Parse CSV line (handle quoted values)
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current)
          current = ''
        } else {
          current += char
        }
      }
      values.push(current)

      maxCol = Math.max(maxCol, values.length)

      for (let c = 0; c < values.length; c++) {
        const value = values[c].trim()
        if (value) {
          // Try to parse as number
          const num = parseFloat(value)
          newCells[cellKey(r, c)] = {
            value: !isNaN(num) && value === String(num) ? num : value,
          }
        }
      }
    }

    // Update dimensions if needed
    const newRowCount = Math.max(rowCount, lines.length)
    const newColCount = Math.max(colCount, maxCol)

    undoStack.current.push({ ...cells })
    redoStack.current = []
    setUndoIndex(undoStack.current.length)

    setCells(newCells)
    if (newRowCount > rowCount) setRowCount(newRowCount)
    if (newColCount > colCount) setColCount(newColCount)

    syncChanges({
      cells: newCells,
      rowCount: newRowCount,
      colCount: newColCount,
    })
  }, [cells, rowCount, colCount, syncChanges])

  return {
    // Data
    cells,
    rowCount,
    colCount,
    columnWidths,
    rowHeights,
    frozenRows,
    frozenCols,

    // Freeze panes
    freezeRows,
    freezeCols,
    freezeAtSelection,
    unfreeze,

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
    updateCellFormat,
    clearSelection,
    applyStyleToSelection,

    // Column/row operations
    resizeColumn,
    resizeRow,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,

    // Sorting
    sortColumn,
    sortBySelection,

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

    // CSV
    exportToCSV,
    importFromCSV,

    // Auto-fill
    autoFill,

    // Borders
    updateCellBorder,
    applyBorderToSelection,

    // Merge cells
    mergeCells,
    unmergeCells,
    isCellMerged,
    getMergeInfo,

    // Conditional formatting
    conditionalFormatRules,
    addConditionalFormatRule,
    updateConditionalFormatRule,
    deleteConditionalFormatRule,
    reorderConditionalFormatRules,
    getConditionalStyle,
    getConditionalDataBar,
    getConditionalColorScale,

    // Data validation
    dataValidationRules,
    addDataValidationRule,
    updateDataValidationRule,
    deleteDataValidationRule,
    getValidationForCell,
    validateCellValue,
    getValidationDropdownItems,

    // Cell comments
    cellComments,
    addComment,
    updateComment,
    deleteComment,
    getComment,
    resolveComment,
    addReply,
    deleteReply,
  }
}
