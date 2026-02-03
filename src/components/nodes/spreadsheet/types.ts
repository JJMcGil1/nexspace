// ═══════════════════════════════════════════════════════════
// SpreadsheetNode Types - Complete type definitions
// ═══════════════════════════════════════════════════════════

export interface CellStyle {
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'line-through'
  textAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  color?: string
  backgroundColor?: string
  fontSize?: number
}

export interface CellFormat {
  type: 'general' | 'number' | 'currency' | 'percent' | 'date' | 'time' | 'text'
  decimals?: number
  currency?: '$' | '€' | '£' | '¥'
  dateFormat?: string
  thousandsSeparator?: boolean
}

export interface CellBorder {
  top?: { style: 'thin' | 'medium' | 'thick' | 'dashed'; color: string }
  right?: { style: 'thin' | 'medium' | 'thick' | 'dashed'; color: string }
  bottom?: { style: 'thin' | 'medium' | 'thick' | 'dashed'; color: string }
  left?: { style: 'thin' | 'medium' | 'thick' | 'dashed'; color: string }
}

export interface Cell {
  value: string | number | null
  formula?: string // Starts with '=' if present
  displayValue?: string // Computed/formatted value for display
  style?: CellStyle
  format?: CellFormat
  border?: CellBorder
  error?: string // #REF!, #VALUE!, #DIV/0!, etc.
  rowSpan?: number // For merged cells
  colSpan?: number // For merged cells
}

export interface CellPosition {
  row: number
  col: number
}

export interface CellRange {
  start: CellPosition
  end: CellPosition
}

export interface SpreadsheetNodeData {
  title?: string
  // 2D sparse array of cells - use object for memory efficiency
  cells: Record<string, Cell> // Key format: "row,col" e.g., "0,0", "1,2"
  // Dimensions
  rowCount: number
  colCount: number
  // Column/row sizes
  columnWidths: number[] // Width in pixels per column
  rowHeights: number[] // Height in pixels per row
  // Frozen panes
  frozenRows?: number
  frozenCols?: number
  // Node dimensions
  width?: number
  height?: number
}

export interface SpreadsheetSelection {
  activeCell: CellPosition | null
  range: CellRange | null
  ranges?: CellRange[] // For multi-select with Ctrl+click
}

export interface ClipboardData {
  cells: Record<string, Cell>
  range: CellRange
  isCut: boolean
}

export interface UndoAction {
  type: 'cell' | 'row' | 'column' | 'format' | 'structure'
  before: Partial<SpreadsheetNodeData>
  after: Partial<SpreadsheetNodeData>
  timestamp: number
}

// Helper functions
export const cellKey = (row: number, col: number): string => `${row},${col}`

export const parseKey = (key: string): CellPosition => {
  const [row, col] = key.split(',').map(Number)
  return { row, col }
}

export const colToLetter = (col: number): string => {
  let result = ''
  let n = col
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

export const letterToCol = (letter: string): number => {
  let result = 0
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64)
  }
  return result - 1
}

export const cellAddress = (row: number, col: number): string => {
  return `${colToLetter(col)}${row + 1}`
}

export const parseCellAddress = (address: string): CellPosition | null => {
  const match = address.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return null
  return {
    col: letterToCol(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1,
  }
}

// Default cell dimensions
export const DEFAULT_COL_WIDTH = 100
export const DEFAULT_ROW_HEIGHT = 28
export const MIN_COL_WIDTH = 40
export const MAX_COL_WIDTH = 500
export const MIN_ROW_HEIGHT = 24
export const MAX_ROW_HEIGHT = 200

// Default grid size
export const DEFAULT_ROW_COUNT = 100
export const DEFAULT_COL_COUNT = 26

// Create empty spreadsheet data
export const createEmptySpreadsheet = (): SpreadsheetNodeData => ({
  title: 'Untitled Spreadsheet',
  cells: {},
  rowCount: DEFAULT_ROW_COUNT,
  colCount: DEFAULT_COL_COUNT,
  columnWidths: Array(DEFAULT_COL_COUNT).fill(DEFAULT_COL_WIDTH),
  rowHeights: Array(DEFAULT_ROW_COUNT).fill(DEFAULT_ROW_HEIGHT),
  width: 500,
  height: 350,
})
