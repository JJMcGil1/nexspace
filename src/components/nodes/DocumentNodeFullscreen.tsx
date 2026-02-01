import React, { useCallback, useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useTheme } from '../../contexts/ThemeContext'
import './DocumentNodeFullscreen.css'

interface DocumentNodeFullscreenProps {
  nodeId: string
  title: string
  content: string
  onClose: () => void
  onUpdate: (nodeId: string, data: { title?: string; content?: string }) => void
}

const DocumentNodeFullscreen: React.FC<DocumentNodeFullscreenProps> = ({
  nodeId,
  title: initialTitle,
  content: initialContent,
  onClose,
  onUpdate,
}) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [title, setTitle] = useState(initialTitle || 'Untitled')
  const [isEditingTitle, setIsEditingTitle] = useState(false)

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
    content: initialContent || '',
    onUpdate: ({ editor }) => {
      onUpdate(nodeId, { content: editor.getHTML() })
    },
    editorProps: {
      attributes: {
        class: 'document-fullscreen__editor',
      },
    },
    autofocus: 'end',
  })

  // Handle title change
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      onUpdate(nodeId, { title: newTitle })
    },
    [nodeId, onUpdate]
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

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditingTitle) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isEditingTitle])

  return (
    <div className={`document-fullscreen ${isDark ? 'document-fullscreen--dark' : 'document-fullscreen--light'}`}>
      {/* Backdrop */}
      <div className="document-fullscreen__backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="document-fullscreen__modal">
        {/* Header */}
        <div className="document-fullscreen__header">
          <div className="document-fullscreen__header-left">
            <div className="document-fullscreen__icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 2v4h4M5.5 8h5M5.5 10.5h5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {isEditingTitle ? (
              <input
                type="text"
                className="document-fullscreen__title-input"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                autoFocus
              />
            ) : (
              <h2
                className="document-fullscreen__title"
                onDoubleClick={() => setIsEditingTitle(true)}
                onClick={() => setIsEditingTitle(true)}
              >
                {title}
              </h2>
            )}
          </div>
          <div className="document-fullscreen__header-right">
            <span className="document-fullscreen__hint">Press ESC to close</span>
            <button
              className="document-fullscreen__close-btn"
              onClick={onClose}
              title="Close (ESC)"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="document-fullscreen__content">
          <EditorContent editor={editor} />
        </div>

        {/* Formatting Toolbar */}
        {editor && (
          <div className="document-fullscreen__toolbar">
            <div className="document-fullscreen__toolbar-group">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
                title="Bold (⌘B)"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
                title="Italic (⌘I)"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
                title="Strikethrough"
              >
                <s>S</s>
              </button>
            </div>
            <div className="document-fullscreen__toolbar-divider" />
            <div className="document-fullscreen__toolbar-group">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                title="Heading 3"
              >
                H3
              </button>
            </div>
            <div className="document-fullscreen__toolbar-divider" />
            <div className="document-fullscreen__toolbar-group">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
                title="Bullet List"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3h10v1H5V3zm0 4h10v1H5V7zm0 4h10v1H5v-1zM2 3.5a1 1 0 110 2 1 1 0 010-2zm0 4a1 1 0 110 2 1 1 0 010-2zm0 4a1 1 0 110 2 1 1 0 010-2z"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
                title="Numbered List"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3h10v1H5V3zm0 4h10v1H5V7zm0 4h10v1H5v-1zM1.5 2.5h1v2.5h-1v-2h-.5v-1h1.5v.5zm-.5 5h2v1h-1v.5h1v1h-2v-1h1v-.5h-1v-1zm0 4h1.5v.5h-1v.5h1v1h-2v-2.5h.5v.5z"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
                title="Task List"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.5 2.5h3v3h-3v-3zm1 1v1h1v-1h-1zm3.5 0h7v1H7v-1zm-4.5 4h3v3h-3v-3zm1 1v1h1v-1h-1zm3.5 0h7v1H7v-1zm-4.5 4h3v3h-3v-3zm1 1v1h1v-1h-1zm3.5 0h7v1H7v-1z"/>
                </svg>
              </button>
            </div>
            <div className="document-fullscreen__toolbar-divider" />
            <div className="document-fullscreen__toolbar-group">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                title="Quote"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.5 6a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-1.5v1.5a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5h1v-2h-2a.5.5 0 01-.5-.5zm5.5 0a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-1.5v1.5a.5.5 0 01-1 0v-2a.5.5 0 01.5-.5h1v-2h-2a.5.5 0 01-.5-.5z"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`document-fullscreen__toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
                title="Code Block"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.854 4.146a.5.5 0 010 .708L2.707 8l3.147 3.146a.5.5 0 01-.708.708l-3.5-3.5a.5.5 0 010-.708l3.5-3.5a.5.5 0 01.708 0zm4.292 0a.5.5 0 000 .708L13.293 8l-3.147 3.146a.5.5 0 00.708.708l3.5-3.5a.5.5 0 000-.708l-3.5-3.5a.5.5 0 00-.708 0z"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="document-fullscreen__toolbar-btn"
                title="Horizontal Rule"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 8a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11A.5.5 0 012 8z"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentNodeFullscreen
