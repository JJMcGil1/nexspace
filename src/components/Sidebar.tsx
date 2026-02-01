import React, { useState, useRef } from 'react'
import { LuSettings, LuSearch, LuPlus, LuPencil, LuCopy, LuTrash2, LuImage } from 'react-icons/lu'
import { HiOutlineDotsHorizontal } from 'react-icons/hi'
import { useUser, NEXSPACE_COLORS } from '../contexts/UserContext'
import { useCanvas } from '../contexts/CanvasContext'
import DropdownMenu, { DropdownMenuItem } from './DropdownMenu'
import './Sidebar.css'

// Format timestamp to human-readable relative time
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  // For older dates, show formatted date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface SidebarProps {
  isOpen: boolean
  onOpenSettings: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onOpenSettings }) => {
  const { user, nexspaces, addNexSpace, updateNexSpace, deleteNexSpace } = useUser()
  const { currentNexSpaceId, loadNexSpace } = useCanvas()
  // Use currentNexSpaceId directly from context - no redundant local state
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Dropdown menu state
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuNexSpaceId, setMenuNexSpaceId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Cover image upload
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCoverId, setUploadingCoverId] = useState<string | null>(null)

  const filteredNexSpaces = nexspaces.filter(ns =>
    ns.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectNexSpace = async (nexspaceId: string) => {
    if (nexspaceId === currentNexSpaceId) return
    await loadNexSpace(nexspaceId)
  }

  const handleNewNexSpace = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      // Pick a random color for the new nexspace
      const randomColor = NEXSPACE_COLORS[Math.floor(Math.random() * NEXSPACE_COLORS.length)]
      const newNexSpace = await addNexSpace('Untitled Space', undefined, randomColor)
      // Load the new nexspace into canvas context
      await loadNexSpace(newNexSpace.id)
    } catch (error) {
      console.error('Failed to create NexSpace:', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleMenuClick = (e: React.MouseEvent, nexspaceId: string) => {
    e.stopPropagation()
    setMenuNexSpaceId(nexspaceId)
    setMenuAnchor(e.currentTarget as HTMLElement)
    setMenuOpen(true)
  }

  const handleMenuClose = () => {
    setMenuOpen(false)
    setMenuNexSpaceId(null)
    setMenuAnchor(null)
  }

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingCoverId) return

    // Validate file type
    if (!file.type.startsWith('image/')) return

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) return

    // Convert to base64
    const reader = new FileReader()
    reader.onload = async (event) => {
      const result = event.target?.result as string
      await updateNexSpace(uploadingCoverId, { coverImage: result })
      setUploadingCoverId(null)
    }
    reader.readAsDataURL(file)

    // Reset input
    if (coverInputRef.current) {
      coverInputRef.current.value = ''
    }
  }

  const handleMenuSelect = async (itemId: string) => {
    if (!menuNexSpaceId) return

    const nexspace = nexspaces.find(ns => ns.id === menuNexSpaceId)
    if (!nexspace) return

    switch (itemId) {
      case 'rename':
        setRenamingId(menuNexSpaceId)
        setRenameValue(nexspace.title)
        setTimeout(() => renameInputRef.current?.focus(), 0)
        break
      case 'cover':
        setUploadingCoverId(menuNexSpaceId)
        setTimeout(() => coverInputRef.current?.click(), 0)
        break
      case 'duplicate':
        await addNexSpace(`${nexspace.title} (copy)`, nexspace.coverImage, nexspace.coverColor)
        break
      case 'delete':
        await deleteNexSpace(menuNexSpaceId)
        // If deleting current nexspace, load another one
        if (currentNexSpaceId === menuNexSpaceId) {
          const remaining = nexspaces.filter(ns => ns.id !== menuNexSpaceId)
          if (remaining.length > 0) {
            await loadNexSpace(remaining[0].id)
          }
        }
        break
    }
  }

  const handleRenameSubmit = async (nexspaceId: string) => {
    if (renameValue.trim()) {
      await updateNexSpace(nexspaceId, { title: renameValue.trim() })
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent, nexspaceId: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(nexspaceId)
    } else if (e.key === 'Escape') {
      setRenamingId(null)
      setRenameValue('')
    }
  }

  // Menu items for nexspace dropdown
  const menuItems: DropdownMenuItem[] = [
    { id: 'rename', label: 'Rename', icon: <LuPencil size={16} /> },
    { id: 'cover', label: 'Change cover', icon: <LuImage size={16} /> },
    { id: 'duplicate', label: 'Duplicate', icon: <LuCopy size={16} /> },
    { id: 'divider', label: '', divider: true },
    { id: 'delete', label: 'Delete', icon: <LuTrash2 size={16} />, danger: true },
  ]

  return (
    <nav className={`sidebar ${!isOpen ? 'sidebar--closed' : ''}`}>
      {/* NexSpace list section */}
      <div className="sidebar__nexspace-section">
        {/* Search */}
        <div className="sidebar__search">
          <LuSearch size={14} className="sidebar__search-icon" />
          <input
            type="text"
            placeholder="Search NexSpaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar__search-input"
          />
        </div>

        {/* Hidden file input for cover image upload */}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverImageUpload}
          className="sidebar__file-input"
        />

        {/* NexSpace list */}
        <div className="sidebar__nexspace-list">
          {filteredNexSpaces.length === 0 && (
            <div className="sidebar__empty">
              <p className="sidebar__empty-text">
                {searchQuery ? 'No NexSpaces found' : 'No NexSpaces yet'}
              </p>
              {!searchQuery && (
                <button
                  className="sidebar__empty-btn"
                  onClick={handleNewNexSpace}
                  disabled={isCreating}
                >
                  <LuPlus size={14} />
                  Create your first NexSpace
                </button>
              )}
            </div>
          )}
          {filteredNexSpaces.map((nexspace) => {
            const isActive = currentNexSpaceId === nexspace.id
            const isRenaming = renamingId === nexspace.id

            return (
              <div
                key={nexspace.id}
                className={`sidebar__nexspace-item ${isActive ? 'sidebar__nexspace-item--active' : ''}`}
                onClick={() => !isRenaming && handleSelectNexSpace(nexspace.id)}
                role="button"
                tabIndex={0}
              >
                {/* Active indicator bar */}
                <div className={`sidebar__nexspace-indicator ${isActive ? 'sidebar__nexspace-indicator--active' : ''}`} />

                {/* NexSpace thumbnail */}
                <div className={`sidebar__nexspace-thumb ${isActive ? 'sidebar__nexspace-thumb--active' : ''}`}>
                  {nexspace.coverImage ? (
                    <img
                      src={nexspace.coverImage}
                      alt=""
                      className="sidebar__nexspace-thumb-img"
                    />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="sidebar__nexspace-icon">
                      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "1" : "0.5"} />
                      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "0.7" : "0.3"} />
                      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "0.7" : "0.3"} />
                      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" fillOpacity={isActive ? "0.5" : "0.2"} />
                    </svg>
                  )}
                </div>

                {/* NexSpace info */}
                <div className="sidebar__nexspace-content">
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      className="sidebar__nexspace-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(nexspace.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, nexspace.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="sidebar__nexspace-title">{nexspace.title}</span>
                      <span className="sidebar__nexspace-time">{formatRelativeTime(nexspace.lastEdited)}</span>
                    </>
                  )}
                </div>

                {/* More menu (visible on hover via CSS) */}
                {!isRenaming && (
                  <button
                    className="sidebar__nexspace-menu"
                    onClick={(e) => handleMenuClick(e, nexspace.id)}
                    aria-label="NexSpace options"
                  >
                    <HiOutlineDotsHorizontal size={16} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom section — settings, profile */}
      <div className="sidebar__footer">
        {/* Settings */}
        <button className="sidebar__item" aria-label="Settings" onClick={onOpenSettings}>
          <LuSettings size={18} className="sidebar__icon" />
          <span className="sidebar__label">Settings</span>
        </button>

        {/* User Profile */}
        {user && (
          <button className="sidebar__item sidebar__profile" aria-label="Profile">
            {user.avatarImage ? (
              <img
                src={user.avatarImage}
                alt={user.name}
                className="sidebar__avatar sidebar__avatar--image"
              />
            ) : (
              <div
                className="sidebar__avatar"
                style={{ backgroundColor: user.avatarColor }}
              >
                {getInitials(user.name)}
              </div>
            )}
            <div className="sidebar__profile-info">
              <span className="sidebar__profile-name">{user.name}</span>
              {user.email && (
                <span className="sidebar__profile-email">{user.email}</span>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      <DropdownMenu
        items={menuItems}
        isOpen={menuOpen}
        onClose={handleMenuClose}
        onSelect={handleMenuSelect}
        anchorEl={menuAnchor}
        align="right"
      />
    </nav>
  )
}

export default Sidebar
