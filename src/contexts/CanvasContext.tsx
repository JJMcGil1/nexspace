import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { CanvasNode, CanvasEdge, NexSpace, ChatMessage } from '../types/electron'

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

  // Chat state
  chatMessages: ChatMessage[]

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

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentNexSpaceId, setCurrentNexSpaceId] = useState<string | null>(null)
  const [currentNexSpace, setCurrentNexSpace] = useState<NexSpace | null>(null)
  const [nodes, setNodesState] = useState<CanvasNode[]>([])
  const [edges, setEdgesState] = useState<CanvasEdge[]>([])
  const [chatMessages, setChatMessagesState] = useState<ChatMessage[]>([])
  const [isDirty, setIsDirty] = useState(false)

  // ─────────────────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────────────────

  const saveCanvas = useCallback(async () => {
    if (!currentNexSpaceId || !currentNexSpace) return

    // Debug: Check tool calls in chat messages being saved
    const messagesWithTools = chatMessages.filter(m => m.toolCalls && m.toolCalls.length > 0)
    console.log('[CanvasContext] Saving - messages with toolCalls:', messagesWithTools.length)
    messagesWithTools.forEach(m => {
      console.log(`[CanvasContext] Message ${m.id} has ${m.toolCalls?.length} tool calls`)
    })

    const updatedNexSpace: NexSpace = {
      ...currentNexSpace,
      nodes,
      edges,
      chatMessages,
      lastEdited: new Date().toISOString(),
    }

    // Get all nexspaces and update the current one
    const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const updatedNexSpaces = allNexSpaces.map(ns =>
      ns.id === currentNexSpaceId ? updatedNexSpace : ns
    )

    await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    setCurrentNexSpace(updatedNexSpace)
    setIsDirty(false)
    console.log('[CanvasContext] Saved canvas state for NexSpace:', currentNexSpaceId)
  }, [currentNexSpaceId, currentNexSpace, nodes, edges, chatMessages])

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
    setChatMessagesState(prev => {
      const newMessages = typeof update === 'function' ? update(prev) : update
      // Check if new messages have tool calls - if so, we want to save immediately
      const newMsgsWithTools = newMessages.filter(m =>
        m.toolCalls && m.toolCalls.length > 0 && !prev.some(p => p.id === m.id)
      )
      if (newMsgsWithTools.length > 0) {
        console.log('[CanvasContext] New messages with toolCalls detected, will save immediately')
      }
      return newMessages
    })
    setIsDirty(true)
  }, [])

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
  // NexSpace operations
  // ─────────────────────────────────────────────────────────

  // Expose a sync save function that captures current React state
  const saveCurrentNexSpaceSync = useCallback(async () => {
    if (!currentNexSpaceId || !currentNexSpace) return

    console.log('[CanvasContext] Sync saving NexSpace:', currentNexSpaceId, 'messages:', chatMessages.length)
    const updatedNexSpace: NexSpace = {
      ...currentNexSpace,
      nodes,
      edges,
      chatMessages,
      lastEdited: new Date().toISOString(),
    }

    const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    const updatedNexSpaces = allNexSpaces.map(ns =>
      ns.id === currentNexSpaceId ? updatedNexSpace : ns
    )
    await window.electronAPI.store.set('nexspaces', updatedNexSpaces)
    setCurrentNexSpace(updatedNexSpace)
    setIsDirty(false)
  }, [currentNexSpaceId, currentNexSpace, nodes, edges, chatMessages])

  const loadNexSpace = useCallback(async (id: string) => {
    // Skip if already on this nexspace
    if (id === currentNexSpaceId) return

    console.log('[CanvasContext] === SWITCHING NEXSPACE ===')
    console.log('[CanvasContext] From:', currentNexSpaceId, 'To:', id)

    // STEP 1: IMMEDIATELY clear state to prevent stale data from showing
    // This ensures no "bleeding" of messages between nexspaces
    setChatMessagesState([])
    setNodesState([])
    setEdgesState([])

    // STEP 2: Save current nexspace state before switching
    if (currentNexSpaceId && currentNexSpace) {
      console.log('[CanvasContext] Saving current NexSpace:', currentNexSpaceId, 'messages:', chatMessages.length)
      const updatedNexSpace: NexSpace = {
        ...currentNexSpace,
        nodes,
        edges,
        chatMessages,
        lastEdited: new Date().toISOString(),
      }
      const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
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
      console.log('[CanvasContext] Messages in store:', nexspace.chatMessages?.length || 0)

      // Debug: Check if loaded messages have tool calls
      const loadedMessagesWithTools = (nexspace.chatMessages || []).filter(m => m.toolCalls && m.toolCalls.length > 0)
      console.log('[CanvasContext] Loaded messages with toolCalls:', loadedMessagesWithTools.length)
      loadedMessagesWithTools.forEach(m => {
        console.log(`[CanvasContext] Loaded message ${m.id} has ${m.toolCalls?.length} tool calls:`, m.toolCalls)
      })

      // STEP 4: Set all state with fresh data from store
      setCurrentNexSpaceId(id)
      setCurrentNexSpace(nexspace)
      setNodesState(nexspace.nodes || [])
      setEdgesState(nexspace.edges || [])
      setChatMessagesState(nexspace.chatMessages || [])
      setIsDirty(false)

      // Store the current nexspace ID so MCP server knows which one is active
      await window.electronAPI.store.set('currentNexSpaceId', id)
      console.log('[CanvasContext] State updated for NexSpace:', id)
    } else {
      console.warn('[CanvasContext] NexSpace not found:', id)
    }
  }, [currentNexSpaceId, currentNexSpace, nodes, edges, chatMessages])

  const createNexSpace = useCallback(async (title: string): Promise<NexSpace> => {
    const newNexSpace: NexSpace = {
      id: `nexspace-${Date.now()}`,
      title,
      createdAt: new Date().toISOString(),
      lastEdited: new Date().toISOString(),
      nodes: [],
      edges: [],
      chatMessages: [],
    }

    const allNexSpaces: NexSpace[] = await window.electronAPI.store.get('nexspaces') || []
    await window.electronAPI.store.set('nexspaces', [...allNexSpaces, newNexSpace])

    // Automatically load the new NexSpace
    setCurrentNexSpaceId(newNexSpace.id)
    setCurrentNexSpace(newNexSpace)
    setNodesState([])
    setEdgesState([])
    setChatMessagesState([])
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
  const stateRef = useRef({ currentNexSpaceId, currentNexSpace, nodes, edges, chatMessages })
  stateRef.current = { currentNexSpaceId, currentNexSpace, nodes, edges, chatMessages }

  useEffect(() => {
    const handleBeforeUnload = async () => {
      const { currentNexSpaceId, currentNexSpace, nodes, edges, chatMessages } = stateRef.current
      if (!currentNexSpaceId || !currentNexSpace) return

      console.log('[CanvasContext] beforeunload - force saving nodes:', nodes.length)
      const updatedNexSpace = {
        ...currentNexSpace,
        nodes,
        edges,
        chatMessages,
        lastEdited: new Date().toISOString(),
      }
      const allNexSpaces = await window.electronAPI.store.get('nexspaces') || []
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
        console.log('[CanvasContext] Initial nodes from store:', nexspace.nodes?.length || 0, nexspace.nodes?.map(n => n.id))
        console.log('[CanvasContext] Initial messages from store:', nexspace.chatMessages?.length || 0)

        // Debug: Check if initial messages have tool calls
        const initialMessagesWithTools = (nexspace.chatMessages || []).filter(m => m.toolCalls && m.toolCalls.length > 0)
        console.log('[CanvasContext] Initial messages with toolCalls:', initialMessagesWithTools.length)
        initialMessagesWithTools.forEach(m => {
          console.log(`[CanvasContext] Initial message ${m.id} has ${m.toolCalls?.length} tool calls`)
        })

        setCurrentNexSpaceId(nexspace.id)
        setCurrentNexSpace(nexspace)
        setNodesState(nexspace.nodes || [])
        setEdgesState(nexspace.edges || [])
        setChatMessagesState(nexspace.chatMessages || [])
        setIsDirty(false)
        // Store the current nexspace ID so MCP server knows which one is active
        await window.electronAPI.store.set('currentNexSpaceId', nexspace.id)
      } else {
        // Create a default NexSpace
        const newNexSpace: NexSpace = {
          id: `nexspace-${Date.now()}`,
          title: 'My First Space',
          createdAt: new Date().toISOString(),
          lastEdited: new Date().toISOString(),
          nodes: [],
          edges: [],
          chatMessages: [],
        }
        await window.electronAPI.store.set('nexspaces', [newNexSpace])
        setCurrentNexSpaceId(newNexSpace.id)
        setCurrentNexSpace(newNexSpace)
        setNodesState([])
        setEdgesState([])
        setChatMessagesState([])
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
