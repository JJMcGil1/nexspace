import React, { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './FlowCanvas.css'

/**
 * Starter nodes — just enough to show the canvas is alive.
 * Users will build their own graph on top of this.
 */
/** Shared node style — uses NexSpace design tokens */
const NODE_STYLE: React.CSSProperties = {
  background: '#19191b',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 8,
  padding: '10px 20px',
  fontSize: 13,
  fontFamily: "'Space Grotesk', sans-serif",
}

const INITIAL_NODES: Node[] = [
  {
    id: 'start',
    type: 'default',
    position: { x: 80, y: 120 },
    data: { label: 'Start' },
    style: NODE_STYLE,
  },
  {
    id: 'process',
    type: 'default',
    position: { x: 320, y: 120 },
    data: { label: 'Process' },
    style: NODE_STYLE,
  },
  {
    id: 'output',
    type: 'default',
    position: { x: 560, y: 120 },
    data: { label: 'Output' },
    style: NODE_STYLE,
  },
]

/** NexSpace accent for edges */
const EDGE_STYLE: React.CSSProperties = { stroke: '#6366f1' }

const INITIAL_EDGES: Edge[] = [
  {
    id: 'e-start-process',
    source: 'start',
    target: 'process',
    animated: true,
    style: EDGE_STYLE,
  },
  {
    id: 'e-process-output',
    source: 'process',
    target: 'output',
    animated: true,
    style: EDGE_STYLE,
  },
]

interface FlowCanvasProps {
  isOpen: boolean
  isFullWidth: boolean
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({ isOpen, isFullWidth }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, animated: true, style: EDGE_STYLE }, eds)
      )
    },
    [setEdges]
  )

  const canvasClasses = [
    'flow-canvas',
    !isOpen && 'flow-canvas--closed',
    isFullWidth && 'flow-canvas--full-width',
  ].filter(Boolean).join(' ')

  return (
    <div className={canvasClasses}>
      {/* React Flow viewport */}
      <div className="flow-canvas__viewport">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ animated: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255, 255, 255, 0.06)"
          />
          <Controls
            showInteractive={false}
            style={{
              background: '#19191b',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor="#6366f1"
            maskColor="rgba(10, 10, 11, 0.85)"
            style={{
              background: '#111113',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
            }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}

export default FlowCanvas
