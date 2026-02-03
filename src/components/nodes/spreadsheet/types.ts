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
  fontSize?: string // e.g., '14px'
  fontFamily?: string // e.g., 'Arial, sans-serif'
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
  // Conditional formatting rules
  conditionalFormatRules?: ConditionalFormatRule[]
  // Data validation rules
  dataValidationRules?: DataValidationRule[]
  // Cell comments - keyed by "row,col"
  cellComments?: Record<string, CellComment>
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

// ═══════════════════════════════════════════════════════════
// Conditional Formatting Types
// ═══════════════════════════════════════════════════════════

export type ConditionalFormatType =
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'equals'
  | 'notEquals'
  | 'between'
  | 'notBetween'
  | 'textContains'
  | 'textNotContains'
  | 'textStartsWith'
  | 'textEndsWith'
  | 'duplicate'
  | 'unique'
  | 'blank'
  | 'notBlank'
  | 'top10'
  | 'bottom10'
  | 'aboveAverage'
  | 'belowAverage'
  | 'colorScale'
  | 'dataBar'
  | 'iconSet'
  | 'customFormula'

export interface ColorScaleConfig {
  minColor: string
  midColor?: string
  maxColor: string
  minType: 'min' | 'number' | 'percent' | 'percentile'
  midType?: 'number' | 'percent' | 'percentile'
  maxType: 'max' | 'number' | 'percent' | 'percentile'
  minValue?: number
  midValue?: number
  maxValue?: number
}

export interface DataBarConfig {
  color: string
  showValue: boolean
  minType: 'min' | 'number' | 'percent'
  maxType: 'max' | 'number' | 'percent'
  minValue?: number
  maxValue?: number
}

export interface IconSetConfig {
  iconSet: '3arrows' | '3arrowsGray' | '3flags' | '3trafficLights' | '3symbols' | '4arrows' | '4ratings' | '5arrows' | '5ratings'
  reverseOrder?: boolean
  showValue?: boolean
  thresholds: number[] // Percentages for icon boundaries
}

export interface ConditionalFormatRule {
  id: string
  ranges: CellRange[] // Multiple ranges can share a rule
  type: ConditionalFormatType
  // For comparison rules
  value?: string | number
  value2?: string | number // For 'between' rules
  // Style to apply (for non-color-scale rules)
  style?: CellStyle
  // Special configs
  colorScale?: ColorScaleConfig
  dataBar?: DataBarConfig
  iconSet?: IconSetConfig
  // For custom formula
  formula?: string
  // Top/bottom N
  rank?: number
  percent?: boolean
  // Priority (lower = higher priority)
  priority: number
  // Stop if true (don't apply lower priority rules)
  stopIfTrue?: boolean
}

// ═══════════════════════════════════════════════════════════
// Data Validation Types
// ═══════════════════════════════════════════════════════════

export type DataValidationType =
  | 'list' // Dropdown list
  | 'number' // Number range
  | 'integer' // Whole numbers only
  | 'decimal' // Decimal numbers
  | 'date' // Date range
  | 'textLength' // Text length restriction
  | 'custom' // Custom formula

export type DataValidationOperator =
  | 'between'
  | 'notBetween'
  | 'equalTo'
  | 'notEqualTo'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'

export interface DataValidationRule {
  id: string
  ranges: CellRange[] // Cells this validation applies to
  type: DataValidationType
  // For list type
  listItems?: string[] // Dropdown options
  listSource?: string // Cell range reference for list items e.g., "A1:A10"
  // For number/date/textLength types
  operator?: DataValidationOperator
  value1?: number | string // First value (min, equal to, etc.)
  value2?: number | string // Second value (for between)
  // For custom type
  formula?: string
  // UI options
  showDropdown?: boolean // Show dropdown arrow for list type (default: true)
  allowBlank?: boolean // Allow empty cells (default: true)
  showInputMessage?: boolean // Show help message when cell selected
  inputTitle?: string
  inputMessage?: string
  // Error handling
  showErrorAlert?: boolean // Show error when invalid (default: true)
  errorStyle?: 'stop' | 'warning' | 'info' // Error severity
  errorTitle?: string
  errorMessage?: string
}

// ═══════════════════════════════════════════════════════════
// Cell Comment Types
// ═══════════════════════════════════════════════════════════

export interface CellComment {
  id: string
  author: string
  text: string
  createdAt: number // Unix timestamp
  updatedAt?: number // Unix timestamp
  resolved?: boolean
  replies?: CellCommentReply[]
}

export interface CellCommentReply {
  id: string
  author: string
  text: string
  createdAt: number
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
