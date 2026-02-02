import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './FlowCanvas.css'
import { useTheme } from '../contexts/ThemeContext'
import { useCanvas } from '../contexts/CanvasContext'
import { nodeTypes, NODE_LIBRARY } from './nodes'
import DocumentNodeFullscreen from './nodes/DocumentNodeFullscreen'
import { LuLayoutTemplate } from 'react-icons/lu'
import { IoDocumentText } from 'react-icons/io5'
import Tooltip from './Tooltip'
import type { CanvasNode, CanvasEdge } from '../types/electron'

/** NexSpace accent for edges */
const EDGE_STYLE: React.CSSProperties = { stroke: '#6366f1' }

/** Theme-aware styles for default nodes */
const getThemeStyles = (isDark: boolean) => ({
  node: {
    background: isDark ? '#19191b' : '#ffffff',
    color: isDark ? '#ffffff' : '#1d1d1f',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)'}`,
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13,
    fontFamily: "'Space Grotesk', sans-serif",
  } as React.CSSProperties,
  minimap: {
    background: isDark ? '#111113' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
    borderRadius: 8,
  } as React.CSSProperties,
  minimapMask: isDark ? 'rgba(10, 10, 11, 0.85)' : 'rgba(245, 245, 247, 0.85)',
  minimapNodeColor: '#6366f1',
  backgroundDotColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)',
})

interface FlowCanvasProps {
  isOpen: boolean
  isFullWidth: boolean
}

/** Fullscreen node state */
interface FullscreenNodeState {
  nodeId: string
  nodeType: string
  title: string
  content: string
}

/** Node library dropdown */
interface NodeLibraryDropdownProps {
  isOpen: boolean
  onClose: () => void
  onSelectNode: (type: string, defaultData: Record<string, unknown>) => void
  isDark: boolean
  triggerRef: React.RefObject<HTMLButtonElement>
}

const NodeLibraryDropdown: React.FC<NodeLibraryDropdownProps> = ({
  isOpen,
  onClose,
  onSelectNode,
  isDark,
  triggerRef,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isInsideDropdown = dropdownRef.current?.contains(target)
      const isInsideTrigger = triggerRef.current?.contains(target)

      if (!isInsideDropdown && !isInsideTrigger) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className={`node-library-dropdown ${isDark ? '' : 'node-library-dropdown--light'}`}
    >
      <div className="node-library-dropdown__header">
        <span>Add Node</span>
      </div>
      <div className="node-library-dropdown__list">
        {NODE_LIBRARY.map((item) => (
          <button
            key={item.type}
            className="node-library-dropdown__item"
            onClick={() => {
              onSelectNode(item.type, { ...item.defaultData })
              onClose()
            }}
          >
            <div className="node-library-dropdown__item-icon">
              {item.icon === 'document' && <IoDocumentText size={18} />}
            </div>
            <div className="node-library-dropdown__item-content">
              <span className="node-library-dropdown__item-label">{item.label}</span>
              <span className="node-library-dropdown__item-desc">{item.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Toolbar component for the canvas */
interface ToolbarProps {
  onAddNode: (type: string, defaultData: Record<string, unknown>) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onToggleMinimap: () => void
  showMinimap: boolean
}

const CanvasToolbar: React.FC<ToolbarProps> = ({
  onAddNode,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleMinimap,
  showMinimap,
}) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [showNodeLibrary, setShowNodeLibrary] = useState(false)
  const addNodeButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <div className={`flow-canvas__toolbar ${isDark ? '' : 'flow-canvas__toolbar--light'}`}>
      {/* Add Node */}
      <div className="flow-canvas__toolbar-add-wrapper">
        <Tooltip content="Add Node" position="top">
          <button
            ref={addNodeButtonRef}
            className={`flow-canvas__toolbar-btn ${showNodeLibrary ? 'flow-canvas__toolbar-btn--active' : ''}`}
            onClick={() => setShowNodeLibrary((prev) => !prev)}
          >
            <LuLayoutTemplate size={18} />
          </button>
        </Tooltip>
        <NodeLibraryDropdown
          isOpen={showNodeLibrary}
          onClose={() => setShowNodeLibrary(false)}
          onSelectNode={onAddNode}
          isDark={isDark}
          triggerRef={addNodeButtonRef}
        />
      </div>

      <div className="flow-canvas__toolbar-divider" />

      {/* Zoom Controls */}
      <Tooltip content="Zoom Out" position="top">
        <button
          className="flow-canvas__toolbar-btn"
          onClick={onZoomOut}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </Tooltip>
      <Tooltip content="Zoom In" position="top">
        <button
          className="flow-canvas__toolbar-btn"
          onClick={onZoomIn}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </Tooltip>
      <Tooltip content="Fit to Screen" position="top">
        <button
          className="flow-canvas__toolbar-btn"
          onClick={onFitView}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </Tooltip>

      <div className="flow-canvas__toolbar-divider" />

      {/* Minimap Toggle */}
      <Tooltip content={showMinimap ? 'Hide Minimap' : 'Show Minimap'} position="top">
        <button
          className={`flow-canvas__toolbar-btn ${showMinimap ? 'flow-canvas__toolbar-btn--active' : ''}`}
          onClick={onToggleMinimap}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="9" y="9" width="4" height="4" rx="1" fill="currentColor" opacity="0.6"/>
          </svg>
        </button>
      </Tooltip>
    </div>
  )
}

/** Inner canvas component that uses React Flow hooks */
const FlowCanvasInner: React.FC<FlowCanvasProps> = ({ isOpen, isFullWidth }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const themeStyles = useMemo(() => getThemeStyles(isDark), [isDark])
  const { fitView, zoomIn, zoomOut, setCenter, getNode } = useReactFlow()

  // Use CanvasContext for persistence
  const {
    nodes: canvasNodes,
    edges: canvasEdges,
    setNodes: setCanvasNodes,
    setEdges: setCanvasEdges,
  } = useCanvas()

  // Convert CanvasNode/CanvasEdge to React Flow types
  const nodes: Node[] = useMemo(() => {
    return canvasNodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      // Pass through measured dimensions for MiniMap rendering
      measured: n.measured,
    }))
  }, [canvasNodes])

  const edges: Edge[] = useMemo(() => canvasEdges.map(e => ({
    ...e,
    animated: true,
    style: EDGE_STYLE,
  })), [canvasEdges])

  // Handle node changes from React Flow
  // We need to let dimension changes through for the MiniMap to work,
  // but we only persist position/structure changes to storage
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    // Separate dimension changes from other changes
    const dimensionChanges = changes.filter(c => c.type === 'dimensions')
    const otherChanges = changes.filter(c => c.type !== 'dimensions')

    // Always apply dimension changes to keep React Flow's internal state updated
    // (required for MiniMap to render nodes correctly)
    if (dimensionChanges.length > 0) {
      setCanvasNodes(prev => {
        const rfNodes = prev.map(n => ({ ...n, data: n.data })) as Node[]
        const updated = applyNodeChanges(dimensionChanges, rfNodes)
        // Return same structure - dimensions are stored internally by React Flow
        return updated.map(n => ({
          id: n.id,
          type: n.type || 'default',
          position: n.position,
          data: n.data as Record<string, unknown>,
          // Preserve measured dimensions for minimap
          measured: (n as Node).measured,
        })) as CanvasNode[]
      })
    }

    // Apply other meaningful changes (position, remove, add, select)
    if (otherChanges.length > 0) {
      setCanvasNodes(prev => {
        const rfNodes = prev.map(n => ({ ...n, data: n.data })) as Node[]
        const updated = applyNodeChanges(otherChanges, rfNodes)
        return updated.map(n => ({
          id: n.id,
          type: n.type || 'default',
          position: n.position,
          data: n.data as Record<string, unknown>,
          measured: (n as Node).measured,
        })) as CanvasNode[]
      })
    }
  }, [setCanvasNodes])

  // Handle edge changes from React Flow
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setCanvasEdges(prev => {
      const rfEdges = prev.map(e => ({ ...e })) as Edge[]
      const updated = applyEdgeChanges(changes, rfEdges)
      return updated.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }))
    })
  }, [setCanvasEdges])

  const [fullscreenNode, setFullscreenNode] = useState<FullscreenNodeState | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const newEdge: CanvasEdge = {
        id: `edge-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      }
      setCanvasEdges((eds) => [...eds, newEdge])
    },
    [setCanvasEdges]
  )

  const handleAddNode = useCallback(
    (type: string, defaultData: Record<string, unknown>) => {
      // Use timestamp-based ID to ensure uniqueness across sessions
      const newNode: CanvasNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        position: {
          x: 100 + (canvasNodes.length % 4) * 360,
          y: 100 + Math.floor(canvasNodes.length / 4) * 280,
        },
        data: { ...defaultData },
      }
      console.log('[FlowCanvas] Adding new node:', newNode.id)
      setCanvasNodes((nds) => [...nds, newNode])
    },
    [canvasNodes.length, setCanvasNodes]
  )

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 })
  }, [zoomIn])

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 })
  }, [zoomOut])

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 })
  }, [fitView])

  const handleToggleMinimap = useCallback(() => {
    setShowMinimap((prev) => !prev)
  }, [])

  // Handle node hover - direct DOM manipulation as backup for CSS :hover
  const handleNodeMouseEnter: NodeMouseHandler = useCallback(
    (_event, node) => {
      const nodeEl = document.querySelector(`[data-id="${node.id}"]`)
      nodeEl?.classList.add('rf-node-hovered')
    },
    []
  )

  const handleNodeMouseLeave: NodeMouseHandler = useCallback(
    (_event, node) => {
      const nodeEl = document.querySelector(`[data-id="${node.id}"]`)
      nodeEl?.classList.remove('rf-node-hovered')
    },
    []
  )

  // Handle double-click on nodes to open fullscreen
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Only open fullscreen for document nodes
      if (node.type === 'document') {
        const nodeData = node.data as { title?: string; content?: string }
        setFullscreenNode({
          nodeId: node.id,
          nodeType: node.type,
          title: nodeData.title || 'Untitled',
          content: nodeData.content || '',
        })
      }
    },
    []
  )

  // Handle updates from fullscreen editor
  const handleFullscreenUpdate = useCallback(
    (nodeId: string, data: { title?: string; content?: string }) => {
      setCanvasNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      )
      // Also update the fullscreen state to keep it in sync
      setFullscreenNode((prev) =>
        prev && prev.nodeId === nodeId
          ? { ...prev, ...data }
          : prev
      )
    },
    [setCanvasNodes]
  )

  // Close fullscreen
  const handleCloseFullscreen = useCallback(() => {
    setFullscreenNode(null)
  }, [])

  // Listen for fullscreen events from nodes
  useEffect(() => {
    const handleFullscreenEvent = (event: CustomEvent<{ nodeId: string }>) => {
      const node = nodes.find((n) => n.id === event.detail.nodeId)
      if (node && node.type === 'document') {
        const nodeData = node.data as { title?: string; content?: string }
        setFullscreenNode({
          nodeId: node.id,
          nodeType: node.type,
          title: nodeData.title || 'Untitled',
          content: nodeData.content || '',
        })
      }
    }

    window.addEventListener('node-fullscreen', handleFullscreenEvent as EventListener)
    return () => window.removeEventListener('node-fullscreen', handleFullscreenEvent as EventListener)
  }, [nodes])

  // Listen for focus-node events from search
  useEffect(() => {
    const handleFocusNode = (event: CustomEvent<{ nodeId: string }>) => {
      const node = getNode(event.detail.nodeId)
      if (node) {
        // Center the viewport on the node with animation
        const nodeWidth = node.measured?.width || 300
        const nodeHeight = node.measured?.height || 200
        setCenter(
          node.position.x + nodeWidth / 2,
          node.position.y + nodeHeight / 2,
          { duration: 500, zoom: 1.2 }
        )

        // Add a temporary highlight effect to the node
        const nodeEl = document.querySelector(`[data-id="${node.id}"]`)
        if (nodeEl) {
          nodeEl.classList.add('rf-node-search-highlight')
          setTimeout(() => {
            nodeEl.classList.remove('rf-node-search-highlight')
          }, 2000)
        }
      }
    }

    window.addEventListener('nexspace:focus-node', handleFocusNode as EventListener)
    return () => window.removeEventListener('nexspace:focus-node', handleFocusNode as EventListener)
  }, [getNode, setCenter])

  const canvasClasses = [
    'flow-canvas',
    !isOpen && 'flow-canvas--closed',
    isFullWidth && 'flow-canvas--full-width',
  ].filter(Boolean).join(' ')

  return (
    <div className={canvasClasses}>
      {/* React Flow viewport */}
      <div className="flow-canvas__viewport">
        {/* Floating Toolbar */}
        <CanvasToolbar
          onAddNode={handleAddNode}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
          onToggleMinimap={handleToggleMinimap}
          showMinimap={showMinimap}
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ animated: true }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={themeStyles.backgroundDotColor}
          />
          {showMinimap && (
            <MiniMap
              nodeColor={() => isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}
              nodeStrokeColor={() => isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)'}
              nodeStrokeWidth={1}
              maskColor={isDark ? 'rgba(10, 10, 11, 0.85)' : 'rgba(245, 245, 247, 0.85)'}
              style={themeStyles.minimap}
              zoomable
              pannable
            />
          )}
        </ReactFlow>
      </div>

      {/* Fullscreen Document Editor */}
      {fullscreenNode && fullscreenNode.nodeType === 'document' && (
        <DocumentNodeFullscreen
          nodeId={fullscreenNode.nodeId}
          title={fullscreenNode.title}
          content={fullscreenNode.content}
          onClose={handleCloseFullscreen}
          onUpdate={handleFullscreenUpdate}
        />
      )}
    </div>
  )
}

/** Wrapper component that provides React Flow context */
const FlowCanvas: React.FC<FlowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

export default FlowCanvas
