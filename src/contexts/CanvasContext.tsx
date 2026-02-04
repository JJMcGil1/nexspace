import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { CanvasNode, CanvasEdge, NexSpace, ChatMessage, ChatSession } from '../types/electron'

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface CanvasContextValue {
  // Current NexSpace
  currentNexSpaceId: string | null
  currentNexSpace: NexSpace | null

  // Canvas state
  nodes: CanvasNode[]
  edges: CanvasEdge[]

  // Chat state - current session messages
  chatMessages: ChatMessage[]

  // Chat sessions
  chatSessions: ChatSession[]
  activeChatSessionId: string | null
  openSessionIds: string[] // Sessions visible in tab bar

  // Mutations
  setNodes: (nodes: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => void
  setEdges: (edges: CanvasEdge[] | ((prev: CanvasEdge[]) => CanvasEdge[])) => void
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void

  // Node operations (for MCP tools)
  addNode: (node: CanvasNode) => void
  updateNode: (nodeId: string, data: Partial<CanvasNode['data']>) => void
  deleteNode: (nodeId: string) => void
  getNodeContent: (nodeId: string) => CanvasNode | undefined

  // Edge operations
  addEdge: (edge: CanvasEdge) => void
  deleteEdge: (edgeId: string) => void

  // Chat operations
  addChatMessage: (message: ChatMessage) => void
  updateChatMessage: (messageId: string, content: string) => void

  // Chat session operations
  createChatSession: (title?: string) => ChatSession
  switchChatSession: (sessionId: string) => void
  closeSession: (sessionId: string) => void // Remove from tab bar (keeps session)
  reopenSession: (sessionId: string) => void // Add back to tab bar
  deleteChatSession: (sessionId: string) => void // Permanently delete
  renameChatSession: (sessionId: string, title: string) => void

  // NexSpace operations
  loadNexSpace: (id: string) => Promise<void>
  createNexSpace: (title: string) => Promise<NexSpace>
  listNexSpaces: () => Promise<NexSpace[]>

  // Persistence
  saveCanvas: () => Promise<void>
  isDirty: boolean
}

// ═══════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined)

// Debounce helper
function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: unknown[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )
}

// Helper to create a default chat session
const createDefaultSession = (): ChatSession => ({
  id: `session-${Date.now()}`,
  title: 'New Chat',
  messages: [],
  createdAt: new Date().toISOString(),
})

// Helper to migrate legacy chatMessages to sessions
const migrateLegacyMessages = (nexspace: NexSpace): { sessions: ChatSession[], activeId: string } => {
  if (nexspace.chatSessions && nexspace.chatSessions.length > 0) {
    // Already has sessions, return them
    return {
      sessions: nexspace.chatSessions,
      activeId: nexspace.activeChatSessionId || nexspace.chatSessions[0].id,
    }
  }

  // Migrate legacy messages to a session
  const defaultSession: ChatSession = {
    id: `session-${Date.now()}`,
    title: 'New Chat',
    messages: nexspace.chatMessages || [],
    createdAt: nexspace.createdAt,
  }

  return {
    sessions: [defaultSession],
    activeId: defaultSession.id,
  }
}

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentNexSpaceId, setCurrentNexSpaceId] = useState<string | null>(null)
  const [currentNexSpace, setCurrentNexSpace] = useState<NexSpace | null>(null)
  const [nodes, setNodesState] = useState<CanvasNode[]>([])
  const [edges, setEdgesState] = useState<CanvasEdge[]>([])
  const [chatSessions, setChatSessionsState] = useState<ChatSession[]>([])
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null)
  const [openSessionIds, setOpenSessionIds] = useState<string[]>([])
  const [isDirty, setIsDirty] = useState(false)

  // Derive current chat messages from active session
  const chatMessages = chatSessions.find(s => s.id === activeChatSessionId)?.messages || []

  // ─────────────────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────────────────

  const saveCanvas = useCallback(async () => {
    if (!currentNexSpaceId || !currentNexSpace) return

    // Debug: Check tool calls in chat messages being saved
    const allMessages = chatSessions.flatMap(s => s.messages)
    const messagesWithTools = allMessages.filter(m => m.toolCalls && m.toolCalls.length > 0)
    console.log('[CanvasContext] Saving - messages with toolCalls:', messagesWithTools.length)

    // Get all nexspaces from store to preserve any external updates (like title renames)
    const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const storeNexSpace = allNexSpaces.find(ns => ns.id === currentNexSpaceId)

    // Merge: preserve title/coverImage/coverColor from store, update canvas data from state
    const updatedNexSpace: NexSpace = {
      ...currentNexSpace,
      // Preserve externally-updated fields (title, cover) from store, with fallback
      title: storeNexSpace?.title || currentNexSpace.title || 'Untitled NexSpace',
      coverImage: storeNexSpace?.coverImage ?? currentNexSpace.coverImage,
      coverColor: storeNexSpace?.coverColor || currentNexSpace.coverColor,
      // Update canvas-managed fields from state
      nodes,
      edges,
      chatSessions,
      activeChatSessionId: activeChatSessionId || undefined,
      openSessionIds: openSessionIds.length > 0 ? openSessionIds : undefined,
      // Clear legacy field
      chatMessages: undefined,
      lastEdited: new Date().toISOString(),
    }

    const updatedNexSpaces = allNexSpaces.map(ns =>
      ns.id === currentNexSpaceId ? updatedNexSpace : ns
    )

    await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    setCurrentNexSpace(updatedNexSpace)
    setIsDirty(false)
    console.log('[CanvasContext] Saved canvas state for NexSpace:', currentNexSpaceId)
  }, [currentNexSpaceId, currentNexSpace, nodes, edges, chatSessions, activeChatSessionId, openSessionIds])

  // Debounced auto-save (reduced to 300ms for responsiveness)
  const debouncedSave = useDebouncedCallback(saveCanvas, 300)

  // Auto-save when dirty
  useEffect(() => {
    if (isDirty && currentNexSpaceId) {
      debouncedSave()
    }
  }, [isDirty, currentNexSpaceId, debouncedSave])

  // Track previous node count to detect structural changes
  const prevNodeCountRef = useRef(nodes.length)

  // Immediate save when nodes are added/removed (structural changes)
  useEffect(() => {
    if (prevNodeCountRef.current !== nodes.length && currentNexSpaceId && currentNexSpace) {
      console.log('[CanvasContext] Node count changed:', prevNodeCountRef.current, '->', nodes.length, '- saving immediately')
      prevNodeCountRef.current = nodes.length
      // Call saveCanvas directly (not debounced) for structural changes
      saveCanvas()
    }
  }, [nodes.length, currentNexSpaceId, currentNexSpace, saveCanvas])

  // Track previous chat message count for immediate save on new messages
  const prevChatCountRef = useRef(chatMessages.length)

  // Immediate save when chat messages are added (ensures tool calls are persisted)
  useEffect(() => {
    if (prevChatCountRef.current !== chatMessages.length && currentNexSpaceId && currentNexSpace) {
      console.log('[CanvasContext] Chat message count changed:', prevChatCountRef.current, '->', chatMessages.length, '- saving immediately')
      prevChatCountRef.current = chatMessages.length
      // Call saveCanvas directly (not debounced) for new messages
      saveCanvas()
    }
  }, [chatMessages.length, currentNexSpaceId, currentNexSpace, saveCanvas])

  // Track session count for immediate save
  const prevSessionCountRef = useRef(chatSessions.length)

  useEffect(() => {
    if (prevSessionCountRef.current !== chatSessions.length && currentNexSpaceId && currentNexSpace) {
      console.log('[CanvasContext] Chat session count changed:', prevSessionCountRef.current, '->', chatSessions.length, '- saving immediately')
      prevSessionCountRef.current = chatSessions.length
      saveCanvas()
    }
  }, [chatSessions.length, currentNexSpaceId, currentNexSpace, saveCanvas])

  // ─────────────────────────────────────────────────────────
  // Node/Edge setters that mark dirty
  // ─────────────────────────────────────────────────────────

  const setNodes = useCallback((update: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => {
    setNodesState(prev => {
      const newNodes = typeof update === 'function' ? update(prev) : update
      // Detect structural changes (add/remove) for immediate save
      if (newNodes.length !== prev.length) {
        console.log('[CanvasContext] Node count changed, triggering immediate save')
        // We'll trigger immediate save via a separate effect
      }
      return newNodes
    })
    setIsDirty(true)
  }, [])

  const setEdges = useCallback((update: CanvasEdge[] | ((prev: CanvasEdge[]) => CanvasEdge[])) => {
    setEdgesState(update)
    setIsDirty(true)
  }, [])

  const setChatMessages = useCallback((update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setChatSessionsState(prevSessions => {
      return prevSessions.map(session => {
        if (session.id === activeChatSessionId) {
          const newMessages = typeof update === 'function' ? update(session.messages) : update
          // Check if new messages have tool calls - if so, we want to save immediately
          const newMsgsWithTools = newMessages.filter(m =>
            m.toolCalls && m.toolCalls.length > 0 && !session.messages.some(p => p.id === m.id)
          )
          if (newMsgsWithTools.length > 0) {
            console.log('[CanvasContext] New messages with toolCalls detected, will save immediately')
          }
          return { ...session, messages: newMessages }
        }
        return session
      })
    })
    setIsDirty(true)
  }, [activeChatSessionId])

  // ─────────────────────────────────────────────────────────
  // Node operations (for MCP tools)
  // ─────────────────────────────────────────────────────────

  const addNode = useCallback((node: CanvasNode) => {
    setNodes(prev => [...prev, node])
  }, [setNodes])

  const updateNode = useCallback((nodeId: string, data: Partial<CanvasNode['data']>) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...data } }
        : node
    ))
  }, [setNodes])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId))
    // Also remove connected edges
    setEdges(prev => prev.filter(edge => edge.source !== nodeId && edge.target !== nodeId))
  }, [setNodes, setEdges])

  const getNodeContent = useCallback((nodeId: string) => {
    return nodes.find(node => node.id === nodeId)
  }, [nodes])

  // ─────────────────────────────────────────────────────────
  // Edge operations
  // ─────────────────────────────────────────────────────────

  const addEdge = useCallback((edge: CanvasEdge) => {
    setEdges(prev => [...prev, edge])
  }, [setEdges])

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(edge => edge.id !== edgeId))
  }, [setEdges])

  // ─────────────────────────────────────────────────────────
  // Chat message operations
  // ─────────────────────────────────────────────────────────

  const addChatMessage = useCallback((message: ChatMessage) => {
    console.log('[CanvasContext] addChatMessage called with id:', message.id, 'role:', message.role)
    console.log('[CanvasContext] addChatMessage toolCalls:', message.toolCalls?.length || 0, JSON.stringify(message.toolCalls))
    console.log('[CanvasContext] addChatMessage thinking:', message.thinking?.substring(0, 50))
    setChatMessages(prev => {
      // PREVENT DUPLICATES: Check if message with this ID already exists
      if (prev.some(m => m.id === message.id)) {
        console.warn('[CanvasContext] DUPLICATE BLOCKED - message already exists:', message.id)
        return prev
      }
      console.log('[CanvasContext] Adding message, prev count:', prev.length, 'new count:', prev.length + 1)
      return [...prev, message]
    })
  }, [setChatMessages])

  const updateChatMessage = useCallback((messageId: string, content: string) => {
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, content }
        : msg
    ))
  }, [setChatMessages])

  // ─────────────────────────────────────────────────────────
  // Chat session operations
  // ─────────────────────────────────────────────────────────

  const createChatSession = useCallback((title?: string): ChatSession => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: title || 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
    }
    setChatSessionsState(prev => [...prev, newSession])
    setActiveChatSessionId(newSession.id)
    setOpenSessionIds(prev => [...prev, newSession.id]) // Add to open tabs
    setIsDirty(true)
    console.log('[CanvasContext] Created new chat session:', newSession.id)
    return newSession
  }, [])

  const switchChatSession = useCallback((sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId)
    if (session) {
      setActiveChatSessionId(sessionId)
      // Also ensure it's in open tabs (for reopening from history)
      setOpenSessionIds(prev => prev.includes(sessionId) ? prev : [...prev, sessionId])
      setIsDirty(true)
      console.log('[CanvasContext] Switched to chat session:', sessionId)
    }
  }, [chatSessions])

  // Close a session tab (remove from tab bar, but keep the session data)
  const closeSession = useCallback((sessionId: string) => {
    // Don't allow closing the last open tab
    if (openSessionIds.length <= 1) {
      console.warn('[CanvasContext] Cannot close the last open tab')
      return
    }

    setOpenSessionIds(prev => prev.filter(id => id !== sessionId))

    // If closing the active session, switch to another open one
    if (activeChatSessionId === sessionId) {
      const remainingOpen = openSessionIds.filter(id => id !== sessionId)
      if (remainingOpen.length > 0) {
        setActiveChatSessionId(remainingOpen[0])
      }
    }

    setIsDirty(true)
    console.log('[CanvasContext] Closed chat tab:', sessionId)
  }, [openSessionIds, activeChatSessionId])

  // Reopen a session from history (add to tab bar and switch to it)
  const reopenSession = useCallback((sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId)
    if (session) {
      setOpenSessionIds(prev => prev.includes(sessionId) ? prev : [...prev, sessionId])
      setActiveChatSessionId(sessionId)
      setIsDirty(true)
      console.log('[CanvasContext] Reopened chat session:', sessionId)
    }
  }, [chatSessions])

  const deleteChatSession = useCallback((sessionId: string) => {
    // Don't allow deleting the last session
    if (chatSessions.length <= 1) {
      console.warn('[CanvasContext] Cannot delete the last chat session')
      return
    }

    setChatSessionsState(prev => prev.filter(s => s.id !== sessionId))
    setOpenSessionIds(prev => prev.filter(id => id !== sessionId))

    // If deleting the active session, switch to the first remaining one
    if (activeChatSessionId === sessionId) {
      const remaining = chatSessions.filter(s => s.id !== sessionId)
      if (remaining.length > 0) {
        setActiveChatSessionId(remaining[0].id)
      }
    }

    setIsDirty(true)
    console.log('[CanvasContext] Deleted chat session:', sessionId)
  }, [chatSessions, activeChatSessionId])

  const renameChatSession = useCallback((sessionId: string, title: string) => {
    setChatSessionsState(prev => prev.map(s =>
      s.id === sessionId ? { ...s, title } : s
    ))
    setIsDirty(true)
    console.log('[CanvasContext] Renamed chat session:', sessionId, 'to', title)
  }, [])

  // ─────────────────────────────────────────────────────────
  // NexSpace operations
  // ─────────────────────────────────────────────────────────

  // Expose a sync save function that captures current React state
  const saveCurrentNexSpaceSync = useCallback(async () => {
    if (!currentNexSpaceId || !currentNexSpace) return

    console.log('[CanvasContext] Sync saving NexSpace:', currentNexSpaceId, 'sessions:', chatSessions.length)

    // Get latest from store to preserve externally-updated fields (title, cover)
    const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const storeNexSpace = allNexSpaces.find(ns => ns.id === currentNexSpaceId)

    const updatedNexSpace: NexSpace = {
      ...currentNexSpace,
      // Preserve externally-updated fields from store, with fallback
      title: storeNexSpace?.title || currentNexSpace.title || 'Untitled NexSpace',
      coverImage: storeNexSpace?.coverImage ?? currentNexSpace.coverImage,
      coverColor: storeNexSpace?.coverColor || currentNexSpace.coverColor,
      // Update canvas-managed fields
      nodes,
      edges,
      chatSessions,
      activeChatSessionId: activeChatSessionId || undefined,
      openSessionIds: openSessionIds.length > 0 ? openSessionIds : undefined,
      chatMessages: undefined,
      lastEdited: new Date().toISOString(),
    }

    const updatedNexSpaces = allNexSpaces.map(ns =>
      ns.id === currentNexSpaceId ? updatedNexSpace : ns
    )
    await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    setCurrentNexSpace(updatedNexSpace)
    setIsDirty(false)
  }, [currentNexSpaceId, currentNexSpace, nodes, edges, chatSessions, activeChatSessionId, openSessionIds])

  const loadNexSpace = useCallback(async (id: string) => {
    // Skip if already on this nexspace
    if (id === currentNexSpaceId) return

    console.log('[CanvasContext] === SWITCHING NEXSPACE ===')
    console.log('[CanvasContext] From:', currentNexSpaceId, 'To:', id)

    // STEP 1: IMMEDIATELY clear state to prevent stale data from showing
    // This ensures no "bleeding" of messages between nexspaces
    setChatSessionsState([])
    setActiveChatSessionId(null)
    setOpenSessionIds([])
    setNodesState([])
    setEdgesState([])

    // STEP 2: Save current nexspace state before switching
    if (currentNexSpaceId && currentNexSpace) {
      console.log('[CanvasContext] Saving current NexSpace:', currentNexSpaceId, 'sessions:', chatSessions.length)
      // Get latest from store to preserve externally-updated fields (title, cover)
      const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
      const storeNexSpace = allNexSpaces.find(ns => ns.id === currentNexSpaceId)

      const updatedNexSpace: NexSpace = {
        ...currentNexSpace,
        // Preserve externally-updated fields from store, with fallback
        title: storeNexSpace?.title || currentNexSpace.title || 'Untitled NexSpace',
        coverImage: storeNexSpace?.coverImage ?? currentNexSpace.coverImage,
        coverColor: storeNexSpace?.coverColor || currentNexSpace.coverColor,
        // Update canvas-managed fields
        nodes,
        edges,
        chatSessions,
        activeChatSessionId: activeChatSessionId || undefined,
        openSessionIds: openSessionIds.length > 0 ? openSessionIds : undefined,
        chatMessages: undefined, // Clear legacy field
        lastEdited: new Date().toISOString(),
      }
      const updatedNexSpaces = allNexSpaces.map(ns =>
        ns.id === currentNexSpaceId ? updatedNexSpace : ns
      )
      await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    }

    // STEP 3: Load the new NexSpace from store
    const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const nexspace = allNexSpaces.find(ns => ns.id === id)

    if (nexspace) {
      console.log('[CanvasContext] LOADING nexspace:', id)

      // Migrate legacy messages to sessions if needed
      const { sessions, activeId } = migrateLegacyMessages(nexspace)
      console.log('[CanvasContext] Sessions:', sessions.length, 'Active:', activeId)

      // STEP 4: Set all state with fresh data from store
      setCurrentNexSpaceId(id)
      setCurrentNexSpace(nexspace)
      setNodesState(nexspace.nodes || [])
      setEdgesState(nexspace.edges || [])
      setChatSessionsState(sessions)
      setActiveChatSessionId(activeId)
      // If no openSessionIds saved, open all sessions by default (or just the active one)
      const savedOpenIds = nexspace.openSessionIds || [activeId]
      setOpenSessionIds(savedOpenIds)
      setIsDirty(false)

      // Store the current nexspace ID so MCP server knows which one is active
      await window.electronAPI.store.set('currentNexSpaceId', id)
      console.log('[CanvasContext] State updated for NexSpace:', id)
    } else {
      console.warn('[CanvasContext] NexSpace not found:', id)
    }
  }, [currentNexSpaceId, currentNexSpace, nodes, edges, chatSessions, activeChatSessionId, openSessionIds])

  const createNexSpace = useCallback(async (title: string): Promise<NexSpace> => {
    const defaultSession = createDefaultSession()
    const newNexSpace: NexSpace = {
      id: `nexspace-${Date.now()}`,
      title: title || 'Untitled NexSpace',
      createdAt: new Date().toISOString(),
      lastEdited: new Date().toISOString(),
      nodes: [],
      edges: [],
      chatSessions: [defaultSession],
      activeChatSessionId: defaultSession.id,
      openSessionIds: [defaultSession.id],
    }

    const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    await window.electronAPI.store.set('nexspaces', [...allNexSpaces, newNexSpace])

    // Automatically load the new NexSpace
    setCurrentNexSpaceId(newNexSpace.id)
    setCurrentNexSpace(newNexSpace)
    setNodesState([])
    setEdgesState([])
    setChatSessionsState([defaultSession])
    setActiveChatSessionId(defaultSession.id)
    setOpenSessionIds([defaultSession.id])
    setIsDirty(false)

    console.log('[CanvasContext] Created NexSpace:', newNexSpace.id)
    return newNexSpace
  }, [])

  const listNexSpaces = useCallback(async (): Promise<NexSpace[]> => {
    return await window.electronAPI.store.get('nexspaces') || []
  }, [])

  // ─────────────────────────────────────────────────────────
  // Force save on window close/refresh
  // ─────────────────────────────────────────────────────────

  // Keep refs for the latest state to access in beforeunload
  const stateRef = useRef({ currentNexSpaceId, currentNexSpace, nodes, edges, chatSessions, activeChatSessionId })
  stateRef.current = { currentNexSpaceId, currentNexSpace, nodes, edges, chatSessions, activeChatSessionId }

  useEffect(() => {
    const handleBeforeUnload = async () => {
      const { currentNexSpaceId, currentNexSpace, nodes, edges, chatSessions, activeChatSessionId } = stateRef.current
      if (!currentNexSpaceId || !currentNexSpace) return

      console.log('[CanvasContext] beforeunload - force saving nodes:', nodes.length)
      // Get latest from store to preserve externally-updated fields (title, cover)
      const storedNexSpaces = await window.electronAPI.store.get('nexspaces')
      const allNexSpaces = Array.isArray(storedNexSpaces) ? storedNexSpaces : []
      const storeNexSpace = allNexSpaces.find((ns: { id: string }) => ns.id === currentNexSpaceId)

      const updatedNexSpace = {
        ...currentNexSpace,
        // Preserve externally-updated fields from store, with fallback
        title: storeNexSpace?.title || currentNexSpace.title || 'Untitled NexSpace',
        coverImage: storeNexSpace?.coverImage ?? currentNexSpace.coverImage,
        coverColor: storeNexSpace?.coverColor || currentNexSpace.coverColor,
        // Update canvas-managed fields
        nodes,
        edges,
        chatSessions,
        activeChatSessionId,
        chatMessages: undefined,
        lastEdited: new Date().toISOString(),
      }
      const updatedNexSpaces = allNexSpaces.map((ns: { id: string }) =>
        ns.id === currentNexSpaceId ? updatedNexSpace : ns
      )
      await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // ─────────────────────────────────────────────────────────
  // Load default NexSpace on mount ONLY (not on state changes)
  // ─────────────────────────────────────────────────────────

  const hasInitializedRef = useRef(false)

  useEffect(() => {
    // Only run once on mount
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    const initNexSpace = async () => {
      const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []

      if (allNexSpaces.length > 0) {
        // Load the most recently edited one
        const sorted = [...allNexSpaces].sort(
          (a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime()
        )
        // Directly load without using the loadNexSpace callback (which has changing deps)
        const nexspace = sorted[0]
        console.log('[CanvasContext] Initial load nexspace:', nexspace.id)
        console.log('[CanvasContext] Initial nodes from store:', nexspace.nodes?.length || 0)

        // Migrate legacy messages to sessions if needed
        const { sessions, activeId } = migrateLegacyMessages(nexspace)
        console.log('[CanvasContext] Initial sessions:', sessions.length, 'Active:', activeId)

        // Restore open session tabs (default to active session if none saved)
        const savedOpenIds = nexspace.openSessionIds || [activeId]
        console.log('[CanvasContext] Initial openSessionIds:', savedOpenIds)

        setCurrentNexSpaceId(nexspace.id)
        setCurrentNexSpace(nexspace)
        setNodesState(nexspace.nodes || [])
        setEdgesState(nexspace.edges || [])
        setChatSessionsState(sessions)
        setActiveChatSessionId(activeId)
        setOpenSessionIds(savedOpenIds)
        setIsDirty(false)
        // Store the current nexspace ID so MCP server knows which one is active
        await window.electronAPI.store.set('currentNexSpaceId', nexspace.id)
      } else {
        // Create a default NexSpace with a default session
        const defaultSession = createDefaultSession()
        const newNexSpace: NexSpace = {
          id: `nexspace-${Date.now()}`,
          title: 'Untitled NexSpace',
          createdAt: new Date().toISOString(),
          lastEdited: new Date().toISOString(),
          nodes: [],
          edges: [],
          chatSessions: [defaultSession],
          activeChatSessionId: defaultSession.id,
          openSessionIds: [defaultSession.id],
        }
        await window.electronAPI.store.set('nexspaces', [newNexSpace])
        setCurrentNexSpaceId(newNexSpace.id)
        setCurrentNexSpace(newNexSpace)
        setNodesState([])
        setEdgesState([])
        setChatSessionsState([defaultSession])
        setActiveChatSessionId(defaultSession.id)
        setOpenSessionIds([defaultSession.id])
        setIsDirty(false)
        console.log('[CanvasContext] Created initial NexSpace:', newNexSpace.id)
      }
    }

    initNexSpace()
  }, []) // Empty deps - run only once on mount

  // ─────────────────────────────────────────────────────────
  // Listen for IPC events from main process (MCP tools)
  // ─────────────────────────────────────────────────────────

  const nodesLengthRef = useRef(nodes.length)
  nodesLengthRef.current = nodes.length

  useEffect(() => {
    // Add node requested by main process
    const unsubAdd = window.electronAPI.canvas.onAddNode((nodeData) => {
      const newNode: CanvasNode = {
        id: `node-${Date.now()}`,
        type: nodeData.type,
        position: nodeData.position || {
          x: 100 + (nodesLengthRef.current % 4) * 360,
          y: 100 + Math.floor(nodesLengthRef.current / 4) * 280,
        },
        data: nodeData.data,
      }
      addNode(newNode)
    })

    // Update node requested by main process
    const unsubUpdate = window.electronAPI.canvas.onUpdateNode(({ nodeId, data }) => {
      updateNode(nodeId, data)
    })

    // Delete node requested by main process
    const unsubDelete = window.electronAPI.canvas.onDeleteNode(({ nodeId }) => {
      deleteNode(nodeId)
    })

    // Canvas refresh (after MCP tool modified the store file directly)
    const unsubRefresh = window.electronAPI.canvas.onRefresh((nexspaces) => {
      console.log('[CanvasContext] Refresh event received from main process')
      // Find the current nexspace in the fresh data and update state
      if (currentNexSpaceId) {
        const freshNexspace = nexspaces.find(ns => ns.id === currentNexSpaceId) as NexSpace | undefined
        if (freshNexspace) {
          console.log('[CanvasContext] Refreshing state for nexspace:', currentNexSpaceId, 'nodes:', freshNexspace.nodes?.length)
          setNodesState(freshNexspace.nodes || [])
          setEdgesState(freshNexspace.edges || [])
          // Don't overwrite chat messages as those are managed by the app
          setCurrentNexSpace(freshNexspace)
          setIsDirty(false)
        }
      }
    })

    return () => {
      unsubAdd()
      unsubUpdate()
      unsubDelete()
      unsubRefresh()
    }
  }, [addNode, updateNode, deleteNode, currentNexSpaceId])

  return (
    <CanvasContext.Provider
      value={{
        currentNexSpaceId,
        currentNexSpace,
        nodes,
        edges,
        chatMessages,
        chatSessions,
        activeChatSessionId,
        openSessionIds,
        setNodes,
        setEdges,
        setChatMessages,
        addNode,
        updateNode,
        deleteNode,
        getNodeContent,
        addEdge,
        deleteEdge,
        addChatMessage,
        updateChatMessage,
        createChatSession,
        switchChatSession,
        closeSession,
        reopenSession,
        deleteChatSession,
        renameChatSession,
        loadNexSpace,
        createNexSpace,
        listNexSpaces,
        saveCanvas,
        isDirty,
      }}
    >
      {children}
    </CanvasContext.Provider>
  )
}

export const useCanvas = (): CanvasContextValue => {
  const context = useContext(CanvasContext)
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider')
  }
  return context
}
