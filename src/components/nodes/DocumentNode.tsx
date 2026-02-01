import React, { useCallback, useState, useEffect, useRef } from 'react'
import { NodeProps, useReactFlow } from '@xyflow/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { IoMove, IoDocumentText } from 'react-icons/io5'
import { LuCopy, LuMaximize2, LuEllipsisVertical, LuTrash2 } from 'react-icons/lu'
import { useTheme } from '../../contexts/ThemeContext'
import './DocumentNode.css'

interface DocumentNodeData {
  title?: string
  content?: string
  onFullscreen?: (nodeId: string) => void
}

const DocumentNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { setNodes, getNodes } = useReactFlow()
  const nodeData = data as unknown as DocumentNodeData

  const [title, setTitle] = useState(nodeData.title || 'Untitled')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  // Debounce timer for content saves
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Save content to node data (debounced to prevent focus loss)
  const saveContent = useCallback((html: string) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, content: html } }
          : node
      )
    )
  }, [id, setNodes])

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
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, title: newTitle } }
            : node
        )
      )
    },
    [id, setNodes]
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

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as HTMLElement)) {
        setShowMoreMenu(false)
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMoreMenu])

  // Handle duplicate node
  const handleDuplicate = useCallback(() => {
    const nodes = getNodes()
    const currentNode = nodes.find((n) => n.id === id)
    if (!currentNode) return

    const newNode = {
      ...currentNode,
      id: `node-${Date.now()}`,
      position: {
        x: currentNode.position.x + 40,
        y: currentNode.position.y + 40,
      },
      data: { ...currentNode.data },
      selected: false,
    }
    setNodes((nds) => [...nds, newNode])
  }, [id, getNodes, setNodes])

  // Handle delete node
  const handleDelete = useCallback(() => {
    setNodes((nds) => nds.filter((node) => node.id !== id))
    setShowMoreMenu(false)
  }, [id, setNodes])

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

  return (
    <div
      className={`document-node-wrapper ${isDark ? 'document-node-wrapper--dark' : 'document-node-wrapper--light'}`}
    >
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

          <div className="document-node__more-wrapper" ref={moreMenuRef}>
            <button
              type="button"
              className={`document-node__hover-btn ${showMoreMenu ? 'active' : ''}`}
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="More options"
            >
              <LuEllipsisVertical size={16} />
            </button>

            {showMoreMenu && (
              <div className="document-node__more-menu">
                <button
                  type="button"
                  className="document-node__more-menu-item document-node__more-menu-item--danger"
                  onClick={handleDelete}
                >
                  <LuTrash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

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
        >
          {/* TipTap Editor */}
          <div className="document-node__content nodrag nowheel">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Node type footer - visible below the card */}
        <div className="document-node__type-footer">
          <IoDocumentText size={14} className="document-node__type-icon" />
          <span className="document-node__type-label">Document</span>
        </div>
      </div>
    </div>
  )
}

export default DocumentNode
