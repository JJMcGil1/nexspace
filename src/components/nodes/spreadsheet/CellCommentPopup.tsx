// ═══════════════════════════════════════════════════════════
// CellCommentPopup.tsx - Cell Comment Viewer and Editor
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react'
import {
  LuX,
  LuTrash2,
  LuCheck,
  LuMessageSquare,
  LuCircleCheck,
  LuCircle,
  LuSend,
  LuPencil,
} from 'react-icons/lu'
import { CellComment } from './types'
import './CellCommentPopup.css'

interface CellCommentPopupProps {
  isDark: boolean
  comment: CellComment | null
  row: number
  col: number
  position: { x: number; y: number }
  onAddComment: (text: string) => void
  onUpdateComment: (text: string) => void
  onDeleteComment: () => void
  onResolveComment: (resolved: boolean) => void
  onAddReply: (text: string) => void
  onDeleteReply: (replyId: string) => void
  onClose: () => void
}

export const CellCommentPopup: React.FC<CellCommentPopupProps> = ({
  isDark,
  comment,
  row,
  col,
  position,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onResolveComment,
  onAddReply,
  onDeleteReply,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(!comment)
  const [editText, setEditText] = useState(comment?.text || '')
  const [replyText, setReplyText] = useState('')
  const [showReplyInput, setShowReplyInput] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing && comment) {
          setIsEditing(false)
          setEditText(comment.text)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, comment, onClose])

  const handleSaveComment = () => {
    const text = editText.trim()
    if (!text) return

    if (comment) {
      onUpdateComment(text)
    } else {
      onAddComment(text)
    }
    setIsEditing(false)
  }

  const handleSaveReply = () => {
    const text = replyText.trim()
    if (!text) return

    onAddReply(text)
    setReplyText('')
    setShowReplyInput(false)
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // Less than a minute
    if (diff < 60000) return 'Just now'
    // Less than an hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    // Less than a day
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    // Less than a week
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`

    // Full date
    return date.toLocaleDateString()
  }

  // Calculate optimal position
  const adjustedPosition = { ...position }
  if (typeof window !== 'undefined') {
    const popupWidth = 320
    const popupHeight = 300
    if (position.x + popupWidth > window.innerWidth - 20) {
      adjustedPosition.x = window.innerWidth - popupWidth - 20
    }
    if (position.y + popupHeight > window.innerHeight - 20) {
      adjustedPosition.y = window.innerHeight - popupHeight - 20
    }
  }

  return (
    <div
      ref={popupRef}
      className={`cell-comment-popup ${isDark ? 'cell-comment-popup--dark' : ''}`}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div className="cell-comment-popup__header">
        <div className="cell-comment-popup__title">
          <LuMessageSquare size={14} />
          <span>Comment on {String.fromCharCode(65 + col)}{row + 1}</span>
        </div>
        <div className="cell-comment-popup__header-actions">
          {comment && (
            <button
              className={`cell-comment-popup__resolve-btn ${comment.resolved ? 'cell-comment-popup__resolve-btn--resolved' : ''}`}
              onClick={() => onResolveComment(!comment.resolved)}
              title={comment.resolved ? 'Reopen' : 'Resolve'}
            >
              {comment.resolved ? <LuCircleCheck size={14} /> : <LuCircle size={14} />}
            </button>
          )}
          <button className="cell-comment-popup__close-btn" onClick={onClose}>
            <LuX size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="cell-comment-popup__content">
        {isEditing ? (
          /* Edit mode */
          <div className="cell-comment-popup__edit">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Add a comment..."
              className="cell-comment-popup__textarea"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  handleSaveComment()
                }
              }}
            />
            <div className="cell-comment-popup__edit-actions">
              {comment && (
                <button
                  className="cell-comment-popup__cancel-btn"
                  onClick={() => {
                    setIsEditing(false)
                    setEditText(comment.text)
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                className="cell-comment-popup__save-btn"
                onClick={handleSaveComment}
                disabled={!editText.trim()}
              >
                <LuCheck size={14} />
                {comment ? 'Save' : 'Add Comment'}
              </button>
            </div>
            <span className="cell-comment-popup__hint">
              Press Ctrl+Enter to save
            </span>
          </div>
        ) : comment ? (
          /* View mode */
          <div className="cell-comment-popup__view">
            {/* Main comment */}
            <div className={`cell-comment-popup__comment ${comment.resolved ? 'cell-comment-popup__comment--resolved' : ''}`}>
              <div className="cell-comment-popup__comment-header">
                <span className="cell-comment-popup__author">{comment.author}</span>
                <span className="cell-comment-popup__time">
                  {formatTimestamp(comment.updatedAt || comment.createdAt)}
                  {comment.updatedAt ? ' (edited)' : ''}
                </span>
              </div>
              <div className="cell-comment-popup__comment-text">{comment.text}</div>
              <div className="cell-comment-popup__comment-actions">
                <button onClick={() => setIsEditing(true)}>
                  <LuPencil size={12} />
                  Edit
                </button>
                <button onClick={onDeleteComment} className="cell-comment-popup__delete-btn">
                  <LuTrash2 size={12} />
                  Delete
                </button>
              </div>
            </div>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="cell-comment-popup__replies">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="cell-comment-popup__reply">
                    <div className="cell-comment-popup__reply-header">
                      <span className="cell-comment-popup__author">{reply.author}</span>
                      <span className="cell-comment-popup__time">
                        {formatTimestamp(reply.createdAt)}
                      </span>
                    </div>
                    <div className="cell-comment-popup__reply-text">{reply.text}</div>
                    <button
                      className="cell-comment-popup__reply-delete"
                      onClick={() => onDeleteReply(reply.id)}
                    >
                      <LuTrash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            {showReplyInput ? (
              <div className="cell-comment-popup__reply-input">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="cell-comment-popup__textarea cell-comment-popup__textarea--small"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      handleSaveReply()
                    }
                    if (e.key === 'Escape') {
                      setShowReplyInput(false)
                      setReplyText('')
                    }
                  }}
                />
                <div className="cell-comment-popup__reply-actions">
                  <button
                    className="cell-comment-popup__cancel-btn"
                    onClick={() => {
                      setShowReplyInput(false)
                      setReplyText('')
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="cell-comment-popup__send-btn"
                    onClick={handleSaveReply}
                    disabled={!replyText.trim()}
                  >
                    <LuSend size={12} />
                    Reply
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="cell-comment-popup__add-reply-btn"
                onClick={() => setShowReplyInput(true)}
              >
                <LuMessageSquare size={12} />
                Reply
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CellCommentPopup
