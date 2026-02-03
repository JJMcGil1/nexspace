import React, { useCallback, useState, useEffect, useRef } from 'react'
import { NodeProps } from '@xyflow/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { IoMove, IoDocumentText } from 'react-icons/io5'
import { LuCopy, LuMaximize2, LuTrash2 } from 'react-icons/lu'
import { useTheme } from '../../contexts/ThemeContext'
import { useDeleteConfirmation } from '../../contexts/DeleteConfirmationContext'
import { useCanvas } from '../../contexts/CanvasContext'
import './DocumentNode.css'

interface DocumentNodeData {
  title?: string
  content?: string
  width?: number
  height?: number
  onFullscreen?: (nodeId: string) => void
}

type ResizeDirection = 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right'

const DocumentNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { updateNode, deleteNode: deleteCanvasNode, addNode, nodes: canvasNodes, setNodes: setCanvasNodes } = useCanvas()
  const { showDeleteConfirmation } = useDeleteConfirmation()
  const nodeData = data as unknown as DocumentNodeData

  const [title, setTitle] = useState(nodeData.title || 'Untitled')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [width, setWidth] = useState(nodeData.width || 400)
  const [height, setHeight] = useState(nodeData.height || 300)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStart = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: 0, height: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0 })
  const resizeDirection = useRef<ResizeDirection>('right')

  // Debounce timer for content saves
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Track if we made the last update (to avoid syncing our own changes)
  const isSelfUpdate = useRef(false)

  // Save content to node data (debounced to prevent focus loss)
  // Uses useCanvas().updateNode to ensure persistence to electron-store
  const saveContent = useCallback((html: string) => {
    console.log('[DocumentNode] Saving content for node:', id)
    isSelfUpdate.current = true
    updateNode(id, { content: html })
  }, [id, updateNode])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: nodeData.content || '',
    onUpdate: ({ editor }) => {
      // Debounce content save to prevent re-renders while typing
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        saveContent(editor.getHTML())
      }, 500) // Save after 500ms of no typing
    },
    onBlur: ({ editor }) => {
      // Save immediately when editor loses focus
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      saveContent(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'document-node__editor',
      },
    },
  })

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Update title in node data
  // Uses useCanvas().updateNode to ensure persistence to electron-store
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      console.log('[DocumentNode] Saving title for node:', id, newTitle)
      updateNode(id, { title: newTitle })
    },
    [id, updateNode]
  )

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false)
    if (!title.trim()) {
      handleTitleChange('Untitled')
    }
  }, [title, handleTitleChange])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        setIsEditingTitle(false)
        editor?.commands.focus()
      }
      if (e.key === 'Escape') {
        setIsEditingTitle(false)
      }
    },
    [editor]
  )

  // Sync title from props
  useEffect(() => {
    if (nodeData.title !== undefined && nodeData.title !== title) {
      setTitle(nodeData.title)
    }
  }, [nodeData.title])

  // Sync content from props (for external changes like fullscreen edits)
  // Only syncs when content was changed externally, not from our own typing
  useEffect(() => {
    if (editor && nodeData.content !== undefined) {
      if (isSelfUpdate.current) {
        isSelfUpdate.current = false
        return // Skip sync - this was our own update
      }
      const currentContent = editor.getHTML()
      if (nodeData.content !== currentContent) {
        console.log('[DocumentNode] Syncing content from props (external change) for node:', id)
        editor.commands.setContent(nodeData.content, { emitUpdate: false })
      }
    }
  }, [nodeData.content, editor, id])

  // Handle duplicate node
  // Uses useCanvas().addNode to ensure persistence to electron-store
  const handleDuplicate = useCallback(() => {
    const currentNode = canvasNodes.find((n) => n.id === id)
    if (!currentNode) return

    const newNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: currentNode.type,
      position: {
        x: currentNode.position.x + 40,
        y: currentNode.position.y + 40,
      },
      data: { ...currentNode.data },
    }
    console.log('[DocumentNode] Duplicating node:', id, 'as', newNode.id)
    addNode(newNode)
  }, [id, canvasNodes, addNode])

  // Handle delete node
  // Uses useCanvas().deleteNode to ensure persistence to electron-store
  const handleDelete = useCallback(() => {
    showDeleteConfirmation({
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      itemName: title,
      confirmLabel: 'Delete Document',
      onConfirm: () => {
        console.log('[DocumentNode] Deleting node:', id)
        deleteCanvasNode(id)
      },
    })
  }, [id, deleteCanvasNode, showDeleteConfirmation, title])

  // Handle fullscreen (dispatch custom event for FlowCanvas to handle)
  const handleFullscreen = useCallback(() => {
    const event = new CustomEvent('node-fullscreen', { detail: { nodeId: id } })
    window.dispatchEvent(event)
  }, [id])

  // Focus editor when clicking anywhere on the card
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't steal focus if clicking on the editor itself (TipTap handles that)
    const target = e.target as HTMLElement
    if (target.closest('.ProseMirror')) return

    // Focus editor - TipTap will place cursor appropriately
    editor?.commands.focus()
  }, [editor])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()

    // Get current node position from canvas nodes
    const currentNode = canvasNodes.find((n) => n.id === id)
    if (!currentNode) return

    setIsResizing(true)
    resizeStart.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = { width, height }
    resizeStartPos.current = { x: currentNode.position.x, y: currentNode.position.y }
    resizeDirection.current = direction
  }, [width, height, canvasNodes, id])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const deltaX = e.clientX - resizeStart.current.x
    const deltaY = e.clientY - resizeStart.current.y
    const dir = resizeDirection.current

    // Calculate new width based on direction
    if (dir === 'right' || dir === 'bottom-right') {
      const newWidth = Math.max(280, Math.min(800, resizeStartSize.current.width + deltaX))
      setWidth(newWidth)
    } else if (dir === 'left' || dir === 'bottom-left') {
      // Calculate new width and position for left-side resize
      const potentialWidth = resizeStartSize.current.width - deltaX
      const newWidth = Math.max(280, Math.min(800, potentialWidth))

      // Calculate how much the width actually changed (accounting for clamping)
      const actualWidthDelta = resizeStartSize.current.width - newWidth

      // Move the node position to keep right edge anchored
      const newX = resizeStartPos.current.x + actualWidthDelta

      setWidth(newWidth)
      // Use CanvasContext's setNodes for position updates to ensure persistence
      setCanvasNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, position: { ...node.position, x: newX } }
            : node
        )
      )
    }

    // Calculate new height based on direction
    if (dir === 'bottom' || dir === 'bottom-left' || dir === 'bottom-right') {
      const newHeight = Math.max(150, Math.min(800, resizeStartSize.current.height + deltaY))
      setHeight(newHeight)
    }
  }, [isResizing, id, setCanvasNodes])

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return
    setIsResizing(false)

    // Save dimensions to node data using CanvasContext for persistence
    console.log('[DocumentNode] Saving dimensions for node:', id, { width, height })
    updateNode(id, { width, height })
  }, [isResizing, id, updateNode, width, height])

  // Attach global mouse events for resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // Sync dimensions from props
  useEffect(() => {
    if (nodeData.width !== undefined && nodeData.width !== width) {
      setWidth(nodeData.width)
    }
  }, [nodeData.width])

  useEffect(() => {
    if (nodeData.height !== undefined && nodeData.height !== height) {
      setHeight(nodeData.height)
    }
  }, [nodeData.height])

  return (
    <div
      className={`document-node-wrapper ${isDark ? 'document-node-wrapper--dark' : 'document-node-wrapper--light'} ${isResizing ? 'document-node-wrapper--resizing' : ''}`}
      style={{ width }}
    >
      {/* Resize handles */}
      <div
        className="document-node__resize-handle document-node__resize-handle--left nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'left')}
      />
      <div
        className="document-node__resize-handle document-node__resize-handle--right nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />
      <div
        className="document-node__resize-handle document-node__resize-handle--bottom nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />
      <div
        className="document-node__resize-handle document-node__resize-handle--bottom-left nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
      />
      <div
        className="document-node__resize-handle document-node__resize-handle--bottom-right nodrag"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
      />
      {/* Header row: title on left, hover nav on right */}
      <div className="document-node__header-row">
        {/* External title - positioned above the card */}
        <div className="document-node__external-title">
          {isEditingTitle ? (
            <input
              type="text"
              className="document-node__title-input"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          ) : (
            <span
              className="document-node__title"
              onDoubleClick={(e) => {
                e.stopPropagation()
                setIsEditingTitle(true)
              }}
            >
              {title}
            </span>
          )}
        </div>

        {/* Hover navigation - all separate circular buttons */}
        <div className="document-node__hover-nav">
          <button
            type="button"
            className="document-node__hover-btn"
            onClick={handleDuplicate}
            title="Duplicate"
          >
            <LuCopy size={16} />
          </button>

          <button
            type="button"
            className="document-node__hover-btn"
            onClick={handleFullscreen}
            title="Expand"
          >
            <LuMaximize2 size={16} />
          </button>

          <div className="document-node__hover-nav-divider" />

          <div className="document-node__hover-btn document-node__drag-handle" title="Move">
            <IoMove size={16} />
          </div>
        </div>
      </div>

      {/* Node base - the footer that the card sits on top of */}
      <div
        className={`document-node__base ${isDark ? 'document-node__base--dark' : 'document-node__base--light'}`}
        onClick={handleCardClick}
      >
        {/* Main card - sits on top of the base */}
        <div
          className={`document-node ${isDark ? 'document-node--dark' : 'document-node--light'} ${selected ? 'document-node--selected' : ''}`}
          style={{ height }}
        >
          {/* TipTap Editor */}
          <div className="document-node__content nodrag nowheel">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Node type footer - visible below the card */}
        <div className="document-node__type-footer">
          <div className="document-node__type-badge">
            <IoDocumentText size={16} className="document-node__type-icon" />
          </div>
          <span className="document-node__type-label">Document</span>
          <button
            type="button"
            className="document-node__footer-delete nodrag"
            onClick={handleDelete}
            title="Delete"
          >
            <LuTrash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentNode
