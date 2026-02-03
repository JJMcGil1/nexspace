// ═══════════════════════════════════════════════════════════
// Number & Cell Formatting Utilities - Google Sheets/Excel Level
// ═══════════════════════════════════════════════════════════

import { CellFormat } from './types'

/**
 * Format a numeric value according to the cell format settings
 */
export function formatNumber(value: number | string | null, format?: CellFormat): string {
  if (value === null || value === undefined || value === '') return ''

  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return String(value)

  if (!format || format.type === 'general') {
    // Auto-detect: if it looks like it should be formatted, do basic formatting
    if (Number.isInteger(num) && Math.abs(num) >= 1000) {
      return num.toLocaleString('en-US')
    }
    return String(value)
  }

  const decimals = format.decimals ?? 2
  const useThousands = format.thousandsSeparator ?? true

  switch (format.type) {
    case 'number':
      return formatDecimal(num, decimals, useThousands)

    case 'currency':
      return formatCurrency(num, format.currency || '$', decimals, useThousands)

    case 'percent':
      return formatPercent(num, decimals)

    case 'date':
      return formatDate(num, format.dateFormat)

    case 'time':
      return formatTime(num)

    case 'text':
      return String(value)

    default:
      return String(value)
  }
}

/**
 * Format as decimal with optional thousands separator
 */
function formatDecimal(num: number, decimals: number, useThousands: boolean): string {
  const fixed = num.toFixed(decimals)

  if (!useThousands) return fixed

  const parts = fixed.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

/**
 * Format as currency
 */
function formatCurrency(
  num: number,
  currency: '$' | '€' | '£' | '¥',
  decimals: number,
  useThousands: boolean
): string {
  const isNegative = num < 0
  const absNum = Math.abs(num)
  const formatted = formatDecimal(absNum, decimals, useThousands)

  // Different currencies have different conventions
  switch (currency) {
    case '$':
      return isNegative ? `-$${formatted}` : `$${formatted}`
    case '€':
      return isNegative ? `-€${formatted}` : `€${formatted}`
    case '£':
      return isNegative ? `-£${formatted}` : `£${formatted}`
    case '¥':
      // Yen typically doesn't use decimals
      const yenFormatted = formatDecimal(absNum, 0, useThousands)
      return isNegative ? `-¥${yenFormatted}` : `¥${yenFormatted}`
    default:
      return isNegative ? `-$${formatted}` : `$${formatted}`
  }
}

/**
 * Format as percentage
 */
function formatPercent(num: number, decimals: number): string {
  // Multiply by 100 if the value is in decimal form (< 1)
  const percentValue = Math.abs(num) <= 1 ? num * 100 : num
  return `${percentValue.toFixed(decimals)}%`
}

/**
 * Format as date
 */
function formatDate(value: number | string, dateFormat?: string): string {
  let date: Date

  // Handle Excel serial date numbers
  if (typeof value === 'number' && value > 0 && value < 2958466) {
    // Excel serial date (days since 1900-01-01)
    date = excelSerialToDate(value)
  } else {
    date = new Date(value)
  }

  if (isNaN(date.getTime())) return String(value)

  const format = dateFormat || 'MM/DD/YYYY'

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return format
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    .replace('MM', String(month).padStart(2, '0'))
    .replace('M', String(month))
    .replace('DD', String(day).padStart(2, '0'))
    .replace('D', String(day))
}

/**
 * Format as time
 */
function formatTime(value: number | string): string {
  let date: Date

  if (typeof value === 'number') {
    // Fractional part of Excel serial date represents time
    const fraction = value % 1
    const totalSeconds = Math.round(fraction * 24 * 60 * 60)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  date = new Date(value)
  if (isNaN(date.getTime())) return String(value)

  return date.toLocaleTimeString('en-US', { hour12: false })
}

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelSerialToDate(serial: number): Date {
  // Excel's epoch is January 1, 1900
  // But Excel incorrectly considers 1900 as a leap year
  const epoch = new Date(1899, 11, 30) // December 30, 1899
  const msPerDay = 24 * 60 * 60 * 1000
  return new Date(epoch.getTime() + serial * msPerDay)
}

/**
 * Convert JavaScript Date to Excel serial date
 */
export function dateToExcelSerial(date: Date): number {
  const epoch = new Date(1899, 11, 30)
  const msPerDay = 24 * 60 * 60 * 1000
  return (date.getTime() - epoch.getTime()) / msPerDay
}

// ═══════════════════════════════════════════════════════════
// Format Presets - Quick access formats
// ═══════════════════════════════════════════════════════════

export interface FormatPreset {
  name: string
  format: CellFormat
  example: string
}

export const FORMAT_PRESETS: FormatPreset[] = [
  { name: 'General', format: { type: 'general' }, example: '1234.56' },
  { name: 'Number', format: { type: 'number', decimals: 2, thousandsSeparator: true }, example: '1,234.56' },
  { name: 'Number (no decimals)', format: { type: 'number', decimals: 0, thousandsSeparator: true }, example: '1,235' },
  { name: 'Currency ($)', format: { type: 'currency', currency: '$', decimals: 2, thousandsSeparator: true }, example: '$1,234.56' },
  { name: 'Currency (€)', format: { type: 'currency', currency: '€', decimals: 2, thousandsSeparator: true }, example: '€1,234.56' },
  { name: 'Currency (£)', format: { type: 'currency', currency: '£', decimals: 2, thousandsSeparator: true }, example: '£1,234.56' },
  { name: 'Percent', format: { type: 'percent', decimals: 2 }, example: '12.34%' },
  { name: 'Percent (no decimals)', format: { type: 'percent', decimals: 0 }, example: '12%' },
  { name: 'Date (MM/DD/YYYY)', format: { type: 'date', dateFormat: 'MM/DD/YYYY' }, example: '01/15/2025' },
  { name: 'Date (DD/MM/YYYY)', format: { type: 'date', dateFormat: 'DD/MM/YYYY' }, example: '15/01/2025' },
  { name: 'Date (YYYY-MM-DD)', format: { type: 'date', dateFormat: 'YYYY-MM-DD' }, example: '2025-01-15' },
  { name: 'Time', format: { type: 'time' }, example: '14:30:00' },
  { name: 'Text', format: { type: 'text' }, example: '001234' },
]

// ═══════════════════════════════════════════════════════════
// Accounting Format (special handling for negatives)
// ═══════════════════════════════════════════════════════════

export function formatAccounting(
  num: number,
  currency: '$' | '€' | '£' | '¥' = '$',
  decimals: number = 2
): string {
  const absNum = Math.abs(num)
  const formatted = formatDecimal(absNum, decimals, true)

  if (num < 0) {
    return `(${currency}${formatted})`
  }
  return ` ${currency}${formatted} `
}

// ═══════════════════════════════════════════════════════════
// Scientific Notation
// ═══════════════════════════════════════════════════════════

export function formatScientific(num: number, decimals: number = 2): string {
  return num.toExponential(decimals)
}

// ═══════════════════════════════════════════════════════════
// Fraction Format
// ═══════════════════════════════════════════════════════════

export function formatFraction(num: number): string {
  if (Number.isInteger(num)) return String(num)

  const wholePart = Math.floor(num)
  const decimal = num - wholePart

  // Find closest fraction with denominator up to 16
  let bestNumerator = 0
  let bestDenominator = 1
  let bestError = Math.abs(decimal)

  for (let d = 2; d <= 16; d++) {
    const n = Math.round(decimal * d)
    const error = Math.abs(decimal - n / d)
    if (error < bestError) {
      bestError = error
      bestNumerator = n
      bestDenominator = d
    }
  }

  if (bestNumerator === 0) return String(wholePart || 0)
  if (wholePart === 0) return `${bestNumerator}/${bestDenominator}`
  return `${wholePart} ${bestNumerator}/${bestDenominator}`
}
