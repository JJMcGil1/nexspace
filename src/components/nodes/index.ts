import DocumentNode from './DocumentNode'

// Export all custom node types for React Flow
export const nodeTypes = {
  document: DocumentNode,
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
] as const

export type NodeLibraryItem = typeof NODE_LIBRARY[number]
export type NodeType = NodeLibraryItem['type']

export { DocumentNode }
