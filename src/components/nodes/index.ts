import DocumentNode from './DocumentNode'
import SpreadsheetNode from './spreadsheet/SpreadsheetNode'

// Export all custom node types for React Flow
export const nodeTypes = {
  document: DocumentNode,
  spreadsheet: SpreadsheetNode,
}

// Node type definitions for the toolbar
export const NODE_LIBRARY = [
  {
    type: 'document',
    label: 'Document',
    description: 'A rich text document with formatting',
    icon: 'document',
    defaultData: {
      title: 'Untitled',
      content: '',
    },
  },
  {
    type: 'spreadsheet',
    label: 'Spreadsheet',
    description: 'A powerful spreadsheet with formulas and formatting',
    icon: 'spreadsheet',
    defaultData: {
      title: 'Untitled Spreadsheet',
      cells: {},
      columnWidths: {},
      rowHeights: {},
      rowCount: 100,
      colCount: 26,
    },
  },
] as const

export type NodeLibraryItem = typeof NODE_LIBRARY[number]
export type NodeType = NodeLibraryItem['type']

export { DocumentNode, SpreadsheetNode }
