import { Cell, cellKey, parseCellAddress } from './types'

interface FormulaResult {
  value: number | string | boolean | null | (number | string | null)[]
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

// Helper to convert value to number
const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

// Helper to check if value matches criteria (for SUMIF, COUNTIF, etc.)
const matchesCriteria = (value: unknown, criteria: string): boolean => {
  const strValue = String(value ?? '').toLowerCase()
  const strCriteria = String(criteria).toLowerCase()

  // Handle comparison operators
  if (strCriteria.startsWith('>=')) {
    return toNum(value) >= toNum(strCriteria.slice(2))
  }
  if (strCriteria.startsWith('<=')) {
    return toNum(value) <= toNum(strCriteria.slice(2))
  }
  if (strCriteria.startsWith('<>') || strCriteria.startsWith('!=')) {
    return strValue !== strCriteria.slice(2).toLowerCase()
  }
  if (strCriteria.startsWith('>')) {
    return toNum(value) > toNum(strCriteria.slice(1))
  }
  if (strCriteria.startsWith('<')) {
    return toNum(value) < toNum(strCriteria.slice(1))
  }
  if (strCriteria.startsWith('=')) {
    return strValue === strCriteria.slice(1).toLowerCase()
  }

  // Handle wildcards (* and ?)
  if (strCriteria.includes('*') || strCriteria.includes('?')) {
    const regex = new RegExp(
      '^' + strCriteria.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i'
    )
    return regex.test(strValue)
  }

  // Exact match
  return strValue === strCriteria
}

// Type for function return values
type FuncReturnValue = number | string | boolean | null | (number | string | null)[]

// Built-in functions - Google Sheets/Excel compatible
const FUNCTIONS: Record<string, (...args: (number | string | null | (number | string | null)[])[]) => FuncReturnValue> = {
  // ═══════════════════════════════════════════════════════════
  // MATH FUNCTIONS
  // ═══════════════════════════════════════════════════════════
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

  SUMIF: (range, criteria, sumRange) => {
    const rangeArr = Array.isArray(range) ? range : [range]
    const sumArr = sumRange ? (Array.isArray(sumRange) ? sumRange : [sumRange]) : rangeArr
    const criteriaStr = String(criteria)

    let sum = 0
    for (let i = 0; i < rangeArr.length; i++) {
      if (matchesCriteria(rangeArr[i], criteriaStr)) {
        sum += toNum(sumArr[i] ?? rangeArr[i])
      }
    }
    return sum
  },

  SUMIFS: (sumRange, ...criteriaRanges) => {
    const sumArr = Array.isArray(sumRange) ? sumRange : [sumRange]
    const pairs: Array<{ range: unknown[]; criteria: string }> = []

    for (let i = 0; i < criteriaRanges.length; i += 2) {
      const range = criteriaRanges[i]
      const criteria = criteriaRanges[i + 1]
      pairs.push({
        range: Array.isArray(range) ? range : [range],
        criteria: String(criteria),
      })
    }

    let sum = 0
    for (let i = 0; i < sumArr.length; i++) {
      const allMatch = pairs.every(({ range, criteria }) =>
        matchesCriteria(range[i], criteria)
      )
      if (allMatch) sum += toNum(sumArr[i])
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

  AVERAGEIF: (range, criteria, avgRange) => {
    const rangeArr = Array.isArray(range) ? range : [range]
    const avgArr = avgRange ? (Array.isArray(avgRange) ? avgRange : [avgRange]) : rangeArr
    const criteriaStr = String(criteria)

    let sum = 0
    let count = 0
    for (let i = 0; i < rangeArr.length; i++) {
      if (matchesCriteria(rangeArr[i], criteriaStr)) {
        sum += toNum(avgArr[i] ?? rangeArr[i])
        count++
      }
    }
    return count > 0 ? sum / count : 0
  },

  COUNT: (...args) => {
    let count = 0
    for (const arg of args.flat(Infinity)) {
      if (typeof arg === 'number' || (typeof arg === 'string' && !isNaN(parseFloat(arg)))) {
        count++
      }
    }
    return count
  },

  COUNTA: (...args) => {
    let count = 0
    for (const arg of args.flat(Infinity)) {
      if (arg !== null && arg !== undefined && arg !== '') count++
    }
    return count
  },

  COUNTBLANK: (...args) => {
    let count = 0
    for (const arg of args.flat(Infinity)) {
      if (arg === null || arg === undefined || arg === '') count++
    }
    return count
  },

  COUNTIF: (range, criteria) => {
    const rangeArr = Array.isArray(range) ? range : [range]
    const criteriaStr = String(criteria)

    let count = 0
    for (const val of rangeArr) {
      if (matchesCriteria(val, criteriaStr)) count++
    }
    return count
  },

  COUNTIFS: (...criteriaRanges) => {
    const pairs: Array<{ range: unknown[]; criteria: string }> = []

    for (let i = 0; i < criteriaRanges.length; i += 2) {
      const range = criteriaRanges[i]
      const criteria = criteriaRanges[i + 1]
      pairs.push({
        range: Array.isArray(range) ? range : [range],
        criteria: String(criteria),
      })
    }

    if (pairs.length === 0) return 0

    const len = pairs[0].range.length
    let count = 0
    for (let i = 0; i < len; i++) {
      const allMatch = pairs.every(({ range, criteria }) =>
        matchesCriteria(range[i], criteria)
      )
      if (allMatch) count++
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
    const num = toNum(value)
    const dec = toNum(decimals)
    const factor = Math.pow(10, dec)
    return Math.round(num * factor) / factor
  },

  ROUNDUP: (value, decimals = 0) => {
    const num = toNum(value)
    const dec = toNum(decimals)
    const factor = Math.pow(10, dec)
    return Math.ceil(num * factor) / factor
  },

  ROUNDDOWN: (value, decimals = 0) => {
    const num = toNum(value)
    const dec = toNum(decimals)
    const factor = Math.pow(10, dec)
    return Math.floor(num * factor) / factor
  },

  ABS: (value) => Math.abs(toNum(value)),

  SQRT: (value) => {
    const num = toNum(value)
    return num < 0 ? 0 : Math.sqrt(num)
  },

  POWER: (base, exp) => Math.pow(toNum(base), toNum(exp)),

  MOD: (number, divisor) => toNum(number) % toNum(divisor),

  PRODUCT: (...args) => {
    let product = 1
    for (const arg of args.flat(Infinity)) {
      const num = toNum(arg)
      if (!isNaN(num)) product *= num
    }
    return product
  },

  MEDIAN: (...args) => {
    const nums = args.flat(Infinity)
      .map(v => toNum(v))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)

    if (nums.length === 0) return 0
    const mid = Math.floor(nums.length / 2)
    return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
  },

  STDEV: (...args) => {
    const nums = args.flat(Infinity).map(v => toNum(v)).filter(n => !isNaN(n))
    if (nums.length < 2) return 0

    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const squareDiffs = nums.map(n => Math.pow(n - mean, 2))
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / (nums.length - 1)
    return Math.sqrt(avgSquareDiff)
  },

  VAR: (...args) => {
    const nums = args.flat(Infinity).map(v => toNum(v)).filter(n => !isNaN(n))
    if (nums.length < 2) return 0

    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const squareDiffs = nums.map(n => Math.pow(n - mean, 2))
    return squareDiffs.reduce((a, b) => a + b, 0) / (nums.length - 1)
  },

  FLOOR: (value) => Math.floor(toNum(value)),

  CEILING: (value) => Math.ceil(toNum(value)),

  TRUNC: (value, decimals = 0) => {
    const num = toNum(value)
    const dec = toNum(decimals)
    const factor = Math.pow(10, dec)
    return Math.trunc(num * factor) / factor
  },

  LOG: (value, base = 10) => Math.log(toNum(value)) / Math.log(toNum(base)),

  LN: (value) => Math.log(toNum(value)),

  EXP: (value) => Math.exp(toNum(value)),

  PI: () => Math.PI,

  RAND: () => Math.random(),

  RANDBETWEEN: (min, max) => {
    const minN = Math.ceil(toNum(min))
    const maxN = Math.floor(toNum(max))
    return Math.floor(Math.random() * (maxN - minN + 1)) + minN
  },

  // ═══════════════════════════════════════════════════════════
  // LOOKUP FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  VLOOKUP: (searchKey, range, index, isSorted): FuncReturnValue => {
    const rangeArr = Array.isArray(range) ? range : [[range]]
    const colIndex = toNum(index) - 1
    // Default to sorted=true if not specified, treat 0 or explicit FALSE as unsorted
    const sorted = isSorted === undefined || isSorted === null || (isSorted !== 0 && String(isSorted).toUpperCase() !== 'FALSE')

    // Assume range is a 2D array (rows of values)
    // In our flat structure, we need to reshape
    // For now, treat range as columns concatenated
    const rows: unknown[][] = []
    const numCols = Math.ceil(Math.sqrt(rangeArr.length)) || 1
    for (let i = 0; i < rangeArr.length; i += numCols) {
      rows.push(rangeArr.slice(i, i + numCols))
    }

    for (const row of rows) {
      const firstCol = String(row[0] ?? '').toLowerCase()
      const searchStr = String(searchKey ?? '').toLowerCase()

      if (sorted) {
        if (firstCol === searchStr || firstCol.startsWith(searchStr)) {
          const result = row[colIndex]
          if (result === undefined) return '#REF!'
          return result as FuncReturnValue
        }
      } else {
        if (firstCol === searchStr) {
          const result = row[colIndex]
          if (result === undefined) return '#REF!'
          return result as FuncReturnValue
        }
      }
    }
    return '#N/A'
  },

  HLOOKUP: (searchKey, range, index, isSorted): FuncReturnValue => {
    const rangeArr = Array.isArray(range) ? range : [[range]]
    const rowIndex = toNum(index) - 1
    // Default to sorted=true if not specified, treat 0 or explicit FALSE as unsorted
    const sorted = isSorted === undefined || isSorted === null || (isSorted !== 0 && String(isSorted).toUpperCase() !== 'FALSE')

    // Similar to VLOOKUP but search horizontally
    const numCols = Math.ceil(Math.sqrt(rangeArr.length)) || 1
    const cols: unknown[][] = []

    for (let c = 0; c < numCols; c++) {
      const col: unknown[] = []
      for (let r = 0; r < rangeArr.length / numCols; r++) {
        col.push(rangeArr[r * numCols + c])
      }
      cols.push(col)
    }

    for (const col of cols) {
      const firstRow = String(col[0] ?? '').toLowerCase()
      const searchStr = String(searchKey ?? '').toLowerCase()

      if (sorted) {
        if (firstRow === searchStr || firstRow.startsWith(searchStr)) {
          const result = col[rowIndex]
          if (result === undefined) return '#REF!'
          return result as FuncReturnValue
        }
      } else {
        if (firstRow === searchStr) {
          const result = col[rowIndex]
          if (result === undefined) return '#REF!'
          return result as FuncReturnValue
        }
      }
    }
    return '#N/A'
  },

  INDEX: (range, rowNum, colNum = 1) => {
    const rangeArr = Array.isArray(range) ? range : [range]
    const row = toNum(rowNum) - 1
    const col = toNum(colNum) - 1

    // For 1D array
    if (col === 0) {
      return rangeArr[row] ?? '#REF!'
    }

    // For 2D array (estimate columns)
    const numCols = Math.ceil(Math.sqrt(rangeArr.length)) || 1
    const idx = row * numCols + col
    return rangeArr[idx] ?? '#REF!'
  },

  MATCH: (searchKey, range, matchType = 1) => {
    const rangeArr = Array.isArray(range) ? range : [range]
    const type = toNum(matchType)
    const searchStr = String(searchKey ?? '').toLowerCase()

    for (let i = 0; i < rangeArr.length; i++) {
      const val = String(rangeArr[i] ?? '').toLowerCase()

      if (type === 0 && val === searchStr) {
        return i + 1
      }
      if (type === 1 && val <= searchStr) {
        // Find largest value <= searchKey
        if (i === rangeArr.length - 1 || String(rangeArr[i + 1] ?? '').toLowerCase() > searchStr) {
          return i + 1
        }
      }
      if (type === -1 && val >= searchStr) {
        // Find smallest value >= searchKey
        if (i === rangeArr.length - 1 || String(rangeArr[i + 1] ?? '').toLowerCase() < searchStr) {
          return i + 1
        }
      }
    }
    return '#N/A'
  },

  LOOKUP: (searchKey, searchRange, resultRange) => {
    const searchArr = Array.isArray(searchRange) ? searchRange : [searchRange]
    const resultArr = resultRange ? (Array.isArray(resultRange) ? resultRange : [resultRange]) : searchArr
    const searchStr = String(searchKey ?? '').toLowerCase()

    let lastMatch = -1
    for (let i = 0; i < searchArr.length; i++) {
      const val = String(searchArr[i] ?? '').toLowerCase()
      if (val <= searchStr) lastMatch = i
    }

    return lastMatch >= 0 ? (resultArr[lastMatch] ?? '#N/A') : '#N/A'
  },

  // ═══════════════════════════════════════════════════════════
  // LOGIC FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  IF: (condition, trueValue, falseValue) => {
    return condition ? (trueValue ?? 0) : (falseValue ?? 0)
  },

  IFS: (...args) => {
    for (let i = 0; i < args.length; i += 2) {
      if (args[i]) return args[i + 1] ?? 0
    }
    return '#N/A'
  },

  AND: (...args) => {
    for (const arg of args.flat(Infinity)) {
      if (!arg) return false
    }
    return true
  },

  OR: (...args) => {
    for (const arg of args.flat(Infinity)) {
      if (arg) return true
    }
    return false
  },

  NOT: (value) => !value,

  XOR: (...args) => {
    let trueCount = 0
    for (const arg of args.flat(Infinity)) {
      if (arg) trueCount++
    }
    return trueCount % 2 === 1
  },

  IFERROR: (value, valueIfError) => {
    const strVal = String(value ?? '')
    if (strVal.startsWith('#')) return valueIfError ?? 0
    return value ?? 0
  },

  IFNA: (value, valueIfNA) => {
    return value === '#N/A' ? (valueIfNA ?? 0) : (value ?? 0)
  },

  SWITCH: (expression, ...cases) => {
    for (let i = 0; i < cases.length - 1; i += 2) {
      if (String(expression) === String(cases[i])) {
        return cases[i + 1] ?? 0
      }
    }
    // Last value is default if odd number of cases
    return cases.length % 2 === 1 ? cases[cases.length - 1] : '#N/A'
  },

  ISBLANK: (value) => value === null || value === undefined || value === '',
  ISNUMBER: (value) => typeof value === 'number' || !isNaN(parseFloat(String(value))),
  ISTEXT: (value) => typeof value === 'string' && isNaN(parseFloat(value)),
  ISERROR: (value) => String(value ?? '').startsWith('#'),

  // ═══════════════════════════════════════════════════════════
  // TEXT FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  CONCAT: (...args) => args.flat(Infinity).map(a => String(a ?? '')).join(''),

  CONCATENATE: (...args) => args.flat(Infinity).map(a => String(a ?? '')).join(''),

  TEXTJOIN: (delimiter, ignoreEmpty, ...args) => {
    const delim = String(delimiter ?? '')
    const values = args.flat(Infinity)
    const filtered = ignoreEmpty
      ? values.filter(v => v !== null && v !== undefined && v !== '')
      : values
    return filtered.map(v => String(v ?? '')).join(delim)
  },

  LEN: (text) => String(text ?? '').length,

  UPPER: (text) => String(text ?? '').toUpperCase(),

  LOWER: (text) => String(text ?? '').toLowerCase(),

  PROPER: (text) => {
    return String(text ?? '').replace(/\w\S*/g, txt =>
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
  },

  TRIM: (text) => String(text ?? '').trim(),

  CLEAN: (text) => String(text ?? '').replace(/[\x00-\x1F\x7F]/g, ''),

  LEFT: (text, count = 1) => String(text ?? '').substring(0, toNum(count) || 1),

  RIGHT: (text, count = 1) => {
    const str = String(text ?? '')
    const n = toNum(count) || 1
    return str.substring(str.length - n)
  },

  MID: (text, start, count) => {
    const str = String(text ?? '')
    const s = toNum(start) - 1
    const c = toNum(count)
    return str.substring(s, s + c)
  },

  SUBSTITUTE: (text, oldText, newText, instance) => {
    const str = String(text ?? '')
    const old = String(oldText ?? '')
    const newStr = String(newText ?? '')

    if (!instance) return str.split(old).join(newStr)

    const n = toNum(instance)
    let count = 0
    return str.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
      count++
      return count === n ? newStr : match
    })
  },

  REPLACE: (text, start, count, newText) => {
    const str = String(text ?? '')
    const s = toNum(start) - 1
    const c = toNum(count)
    return str.substring(0, s) + String(newText ?? '') + str.substring(s + c)
  },

  FIND: (findText, withinText, startNum = 1) => {
    const find = String(findText ?? '')
    const within = String(withinText ?? '')
    const start = toNum(startNum) - 1
    const result = within.indexOf(find, start)
    return result >= 0 ? result + 1 : '#VALUE!'
  },

  SEARCH: (findText, withinText, startNum = 1) => {
    const find = String(findText ?? '').toLowerCase()
    const within = String(withinText ?? '').toLowerCase()
    const start = toNum(startNum) - 1
    const result = within.indexOf(find, start)
    return result >= 0 ? result + 1 : '#VALUE!'
  },

  REPT: (text, times) => String(text ?? '').repeat(Math.max(0, toNum(times))),

  CHAR: (number) => String.fromCharCode(toNum(number)),

  CODE: (text) => String(text ?? '').charCodeAt(0) || 0,

  TEXT: (value, format) => {
    // Basic text formatting
    const num = toNum(value)
    const fmt = String(format ?? '')

    if (fmt.includes('%')) {
      const decimals = (fmt.match(/0/g) || []).length - 1
      return (num * 100).toFixed(Math.max(0, decimals)) + '%'
    }
    if (fmt.includes('$')) {
      return '$' + num.toFixed(2)
    }
    return String(value ?? '')
  },

  VALUE: (text) => {
    const num = parseFloat(String(text ?? '').replace(/[$,]/g, ''))
    return isNaN(num) ? '#VALUE!' : num
  },

  SPLIT: (text, delimiter) => {
    return String(text ?? '').split(String(delimiter ?? ','))[0] || ''
  },

  // ═══════════════════════════════════════════════════════════
  // DATE & TIME FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  NOW: () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  },

  TODAY: () => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  },

  DATE: (year, month, day) => {
    const d = new Date(toNum(year), toNum(month) - 1, toNum(day))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  TIME: (hour, minute, second) => {
    return `${String(toNum(hour)).padStart(2, '0')}:${String(toNum(minute)).padStart(2, '0')}:${String(toNum(second)).padStart(2, '0')}`
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

  HOUR: (time) => {
    const d = new Date(String(time))
    return isNaN(d.getTime()) ? 0 : d.getHours()
  },

  MINUTE: (time) => {
    const d = new Date(String(time))
    return isNaN(d.getTime()) ? 0 : d.getMinutes()
  },

  SECOND: (time) => {
    const d = new Date(String(time))
    return isNaN(d.getTime()) ? 0 : d.getSeconds()
  },

  WEEKDAY: (date, type = 1) => {
    const d = new Date(String(date))
    if (isNaN(d.getTime())) return 0
    const day = d.getDay()
    const t = toNum(type)
    if (t === 1) return day + 1 // Sunday = 1
    if (t === 2) return day === 0 ? 7 : day // Monday = 1
    if (t === 3) return day === 0 ? 6 : day - 1 // Monday = 0
    return day + 1
  },

  WEEKNUM: (date, type = 1) => {
    const d = new Date(String(date))
    if (isNaN(d.getTime())) return 0
    const start = new Date(d.getFullYear(), 0, 1)
    const diff = d.getTime() - start.getTime()
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    return Math.ceil((diff / oneWeek) + 1)
  },

  DATEDIF: (startDate, endDate, unit) => {
    const start = new Date(String(startDate))
    const end = new Date(String(endDate))
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '#VALUE!'

    const diffMs = end.getTime() - start.getTime()
    const u = String(unit ?? 'D').toUpperCase()

    if (u === 'D') return Math.floor(diffMs / (24 * 60 * 60 * 1000))
    if (u === 'M') return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    if (u === 'Y') return end.getFullYear() - start.getFullYear()
    return '#VALUE!'
  },

  EDATE: (startDate, months) => {
    const d = new Date(String(startDate))
    if (isNaN(d.getTime())) return '#VALUE!'
    d.setMonth(d.getMonth() + toNum(months))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  EOMONTH: (startDate, months) => {
    const d = new Date(String(startDate))
    if (isNaN(d.getTime())) return '#VALUE!'
    d.setMonth(d.getMonth() + toNum(months) + 1, 0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  NETWORKDAYS: (startDate, endDate) => {
    const start = new Date(String(startDate))
    const end = new Date(String(endDate))
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '#VALUE!'

    let count = 0
    const current = new Date(start)
    while (current <= end) {
      const day = current.getDay()
      if (day !== 0 && day !== 6) count++
      current.setDate(current.getDate() + 1)
    }
    return count
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
      const args: FuncReturnValue[] = []
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
function parseArgument(arg: string, cells: Record<string, Cell>): FuncReturnValue {
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
