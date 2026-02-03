import { Cell, cellKey, parseCellAddress } from './types'

interface FormulaResult {
  value: number | string | null
  error?: string
}

// Parse cell references like A1, B2, A1:B5
const CELL_REF_REGEX = /([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/gi

// Get value from cells record
function getCellValue(cells: Record<string, Cell>, row: number, col: number): number | string | null {
  const cell = cells[cellKey(row, col)]
  if (!cell) return null
  if (cell.error) return null
  return cell.value
}

// Expand a range like A1:B3 into array of values
function expandRange(
  cells: Record<string, Cell>,
  startCol: string,
  startRow: string,
  endCol: string,
  endRow: string
): (number | string | null)[] {
  const values: (number | string | null)[] = []

  const colStart = startCol.toUpperCase().charCodeAt(0) - 65
  const colEnd = endCol.toUpperCase().charCodeAt(0) - 65
  const rowStart = parseInt(startRow, 10) - 1
  const rowEnd = parseInt(endRow, 10) - 1

  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      values.push(getCellValue(cells, r, c))
    }
  }

  return values
}

// Built-in functions
const FUNCTIONS: Record<string, (...args: (number | string | null)[]) => number | string> = {
  SUM: (...args) => {
    let sum = 0
    for (const arg of args.flat(Infinity)) {
      if (typeof arg === 'number') sum += arg
      else if (typeof arg === 'string') {
        const num = parseFloat(arg)
        if (!isNaN(num)) sum += num
      }
    }
    return sum
  },

  AVERAGE: (...args) => {
    let sum = 0
    let count = 0
    for (const arg of args.flat(Infinity)) {
      if (typeof arg === 'number') {
        sum += arg
        count++
      } else if (typeof arg === 'string') {
        const num = parseFloat(arg)
        if (!isNaN(num)) {
          sum += num
          count++
        }
      }
    }
    return count > 0 ? sum / count : 0
  },

  COUNT: (...args) => {
    let count = 0
    for (const arg of args.flat(Infinity)) {
      if (arg !== null && arg !== undefined && arg !== '') count++
    }
    return count
  },

  MAX: (...args) => {
    let max = -Infinity
    for (const arg of args.flat(Infinity)) {
      const num = typeof arg === 'number' ? arg : parseFloat(String(arg))
      if (!isNaN(num) && num > max) max = num
    }
    return max === -Infinity ? 0 : max
  },

  MIN: (...args) => {
    let min = Infinity
    for (const arg of args.flat(Infinity)) {
      const num = typeof arg === 'number' ? arg : parseFloat(String(arg))
      if (!isNaN(num) && num < min) min = num
    }
    return min === Infinity ? 0 : min
  },

  ROUND: (value, decimals = 0) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    const dec = typeof decimals === 'number' ? decimals : parseInt(String(decimals), 10)
    if (isNaN(num)) return 0
    const factor = Math.pow(10, dec || 0)
    return Math.round(num * factor) / factor
  },

  ABS: (value) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    return isNaN(num) ? 0 : Math.abs(num)
  },

  SQRT: (value) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    return isNaN(num) || num < 0 ? 0 : Math.sqrt(num)
  },

  POWER: (base, exp) => {
    const b = typeof base === 'number' ? base : parseFloat(String(base))
    const e = typeof exp === 'number' ? exp : parseFloat(String(exp))
    if (isNaN(b) || isNaN(e)) return 0
    return Math.pow(b, e)
  },

  IF: (condition, trueValue, falseValue) => {
    return condition ? (trueValue ?? 0) : (falseValue ?? 0)
  },

  CONCAT: (...args) => {
    return args.flat(Infinity).map(a => String(a ?? '')).join('')
  },

  LEN: (text) => {
    return String(text ?? '').length
  },

  UPPER: (text) => {
    return String(text ?? '').toUpperCase()
  },

  LOWER: (text) => {
    return String(text ?? '').toLowerCase()
  },

  TRIM: (text) => {
    return String(text ?? '').trim()
  },

  LEFT: (text, count = 1) => {
    const str = String(text ?? '')
    const n = typeof count === 'number' ? count : parseInt(String(count), 10)
    return str.substring(0, n || 1)
  },

  RIGHT: (text, count = 1) => {
    const str = String(text ?? '')
    const n = typeof count === 'number' ? count : parseInt(String(count), 10)
    return str.substring(str.length - (n || 1))
  },

  MID: (text, start, count) => {
    const str = String(text ?? '')
    const s = (typeof start === 'number' ? start : parseInt(String(start), 10)) - 1
    const c = typeof count === 'number' ? count : parseInt(String(count), 10)
    return str.substring(s, s + c)
  },

  NOW: () => {
    return Date.now()
  },

  TODAY: () => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  },

  YEAR: (date) => {
    const d = new Date(String(date))
    return isNaN(d.getTime()) ? 0 : d.getFullYear()
  },

  MONTH: (date) => {
    const d = new Date(String(date))
    return isNaN(d.getTime()) ? 0 : d.getMonth() + 1
  },

  DAY: (date) => {
    const d = new Date(String(date))
    return isNaN(d.getTime()) ? 0 : d.getDate()
  },

  FLOOR: (value) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    return isNaN(num) ? 0 : Math.floor(num)
  },

  CEILING: (value) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    return isNaN(num) ? 0 : Math.ceil(num)
  },
}

// Tokenize formula
function tokenize(formula: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inString = false
  let stringChar = ''

  for (let i = 0; i < formula.length; i++) {
    const char = formula[i]

    if (inString) {
      current += char
      if (char === stringChar) {
        tokens.push(current)
        current = ''
        inString = false
      }
    } else if (char === '"' || char === "'") {
      if (current) tokens.push(current)
      current = char
      inString = true
      stringChar = char
    } else if ('+-*/^%(),:<>='.includes(char)) {
      if (current) tokens.push(current)
      // Handle operators like >=, <=, <>
      if ((char === '>' || char === '<' || char === '=') &&
          (formula[i + 1] === '=' || formula[i + 1] === '>')) {
        tokens.push(char + formula[i + 1])
        i++
      } else {
        tokens.push(char)
      }
      current = ''
    } else if (char === ' ') {
      if (current) tokens.push(current)
      current = ''
    } else {
      current += char
    }
  }

  if (current) tokens.push(current)

  return tokens
}

// Evaluate a simple expression (basic arithmetic)
function evaluateExpression(tokens: string[], cells: Record<string, Cell>): number | string {
  // Replace cell references with values
  const processed = tokens.map(token => {
    // Check if it's a cell reference like A1
    const match = token.match(/^([A-Z]+)(\d+)$/i)
    if (match) {
      const pos = parseCellAddress(token)
      if (pos) {
        const val = getCellValue(cells, pos.row, pos.col)
        if (val === null) return 0
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0
      }
    }
    // Check if it's a number
    const num = parseFloat(token)
    if (!isNaN(num)) return num
    // Check if it's a string literal
    if ((token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))) {
      return token.slice(1, -1)
    }
    return token
  })

  // Simple left-to-right evaluation with operator precedence
  // First pass: multiplication and division
  let i = 0
  while (i < processed.length) {
    if (processed[i] === '*' || processed[i] === '/') {
      const left = Number(processed[i - 1])
      const right = Number(processed[i + 1])
      const result = processed[i] === '*' ? left * right : left / right
      processed.splice(i - 1, 3, result)
      i--
    } else {
      i++
    }
  }

  // Second pass: addition and subtraction
  i = 0
  while (i < processed.length) {
    if (processed[i] === '+' || processed[i] === '-') {
      const left = Number(processed[i - 1])
      const right = Number(processed[i + 1])
      const result = processed[i] === '+' ? left + right : left - right
      processed.splice(i - 1, 3, result)
      i--
    } else {
      i++
    }
  }

  return processed[0] as number | string
}

// Main formula evaluator
export function evaluateFormula(formula: string, cells: Record<string, Cell>): FormulaResult {
  if (!formula.startsWith('=')) {
    return { value: formula }
  }

  const expr = formula.substring(1).trim()

  try {
    // Check if it's a function call
    const funcMatch = expr.match(/^([A-Z]+)\((.*)\)$/i)

    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase()
      const argsStr = funcMatch[2]

      // Parse arguments (handling nested functions and ranges)
      const args: (number | string | null | (number | string | null)[])[] = []
      let depth = 0
      let current = ''

      for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i]
        if (char === '(') depth++
        else if (char === ')') depth--
        else if (char === ',' && depth === 0) {
          args.push(parseArgument(current.trim(), cells))
          current = ''
          continue
        }
        current += char
      }
      if (current.trim()) {
        args.push(parseArgument(current.trim(), cells))
      }

      // Execute function
      const func = FUNCTIONS[funcName]
      if (!func) {
        return { value: null, error: '#NAME?' }
      }

      // Flatten arrays for functions that expect flat args
      const flatArgs = args.flat(Infinity) as (number | string | null)[]
      const result = func(...flatArgs)
      return { value: result }
    }

    // Simple expression evaluation
    const tokens = tokenize(expr)
    const result = evaluateExpression(tokens, cells)
    return { value: result }

  } catch (error) {
    return { value: null, error: '#ERROR!' }
  }
}

// Parse a single argument (could be a range, cell ref, or literal)
function parseArgument(arg: string, cells: Record<string, Cell>): number | string | null | (number | string | null)[] {
  // Check for range like A1:B3
  const rangeMatch = arg.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i)
  if (rangeMatch) {
    return expandRange(cells, rangeMatch[1], rangeMatch[2], rangeMatch[3], rangeMatch[4])
  }

  // Check for cell reference like A1
  const cellMatch = arg.match(/^([A-Z]+)(\d+)$/i)
  if (cellMatch) {
    const pos = parseCellAddress(arg)
    if (pos) {
      return getCellValue(cells, pos.row, pos.col)
    }
  }

  // Check for nested function
  if (arg.match(/^[A-Z]+\(/i)) {
    const result = evaluateFormula('=' + arg, cells)
    return result.value
  }

  // Check for number
  const num = parseFloat(arg)
  if (!isNaN(num)) return num

  // Check for string literal
  if ((arg.startsWith('"') && arg.endsWith('"')) ||
      (arg.startsWith("'") && arg.endsWith("'"))) {
    return arg.slice(1, -1)
  }

  return arg
}
