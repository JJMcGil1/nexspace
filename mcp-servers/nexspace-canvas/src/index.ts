/**
 * NexSpace Canvas MCP Server
 *
 * Provides canvas tools to Claude CLI via stdio transport.
 * Reads/writes to the same electron-store used by the NexSpace app.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
}

interface NexSpace {
  id: string;
  title: string;
  coverImage?: string;
  coverColor?: string;
  lastEdited: string;
  createdAt: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  chatMessages: ChatMessage[];
}

interface StoreData {
  user: unknown;
  onboardingComplete: boolean;
  nexspaces: NexSpace[];
  settings: {
    theme: 'light' | 'dark';
    aiModel: string;
  };
}

// ═══════════════════════════════════════════════════════════
// Store Access (electron-store compatible)
// ═══════════════════════════════════════════════════════════

function getStorePath(): string {
  const appName = 'nexspace';
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName, 'nexspace-data.json');
    case 'win32':
      return path.join(process.env.APPDATA || os.homedir(), appName, 'nexspace-data.json');
    default:
      return path.join(os.homedir(), '.config', appName, 'nexspace-data.json');
  }
}

function readStore(): StoreData {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return {
      user: null,
      onboardingComplete: false,
      nexspaces: [],
      settings: { theme: 'dark', aiModel: 'sonnet' }
    };
  }
  const data = fs.readFileSync(storePath, 'utf-8');
  return JSON.parse(data);
}

function writeStore(data: StoreData): void {
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

function getCurrentNexSpace(): NexSpace | null {
  const store = readStore();
  if (store.nexspaces.length === 0) return null;

  // First, try to get the currently selected nexspace from the app
  const currentId = (store as StoreData & { currentNexSpaceId?: string }).currentNexSpaceId;
  if (currentId) {
    const current = store.nexspaces.find(ns => ns.id === currentId);
    if (current) return current;
  }

  // Fallback: return most recently edited
  const sorted = [...store.nexspaces].sort(
    (a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime()
  );
  return sorted[0];
}

// ═══════════════════════════════════════════════════════════
// MCP Server
// ═══════════════════════════════════════════════════════════

const server = new Server(
  {
    name: 'nexspace-canvas',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_canvas_nodes',
        description: 'Get all nodes currently on the NexSpace canvas. Returns a list of nodes with their types, positions, and data.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_canvas_edges',
        description: 'Get all edges (connections) between nodes on the NexSpace canvas.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_node_content',
        description: 'Get the full content and details of a specific node by its ID.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            node_id: {
              type: 'string',
              description: 'The ID of the node to get content for',
            },
          },
          required: ['node_id'],
        },
      },
      {
        name: 'add_node',
        description: 'Add a new node to the NexSpace canvas. The node will be placed at the specified position or auto-positioned if not specified.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            type: {
              type: 'string',
              description: 'The type of node to add (e.g., "document", "image")',
            },
            title: {
              type: 'string',
              description: 'Optional title for the node',
            },
            content: {
              type: 'string',
              description: 'Optional content for the node',
            },
            position_x: {
              type: 'number',
              description: 'X position on canvas',
            },
            position_y: {
              type: 'number',
              description: 'Y position on canvas',
            },
          },
          required: ['type'],
        },
      },
      {
        name: 'update_node',
        description: 'Update an existing node on the canvas. You can change its title, content, or other data.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            node_id: {
              type: 'string',
              description: 'The ID of the node to update',
            },
            title: {
              type: 'string',
              description: 'New title for the node',
            },
            content: {
              type: 'string',
              description: 'New content for the node',
            },
          },
          required: ['node_id'],
        },
      },
      {
        name: 'delete_node',
        description: 'Delete a node from the canvas by its ID. This also removes any connected edges.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            node_id: {
              type: 'string',
              description: 'The ID of the node to delete',
            },
          },
          required: ['node_id'],
        },
      },
      {
        name: 'list_nexspaces',
        description: 'List all available NexSpace workspaces.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_current_nexspace',
        description: 'Get information about the currently active NexSpace workspace.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_canvas_nodes': {
      const nexspace = getCurrentNexSpace();
      if (!nexspace) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No NexSpace found. Please create a NexSpace first.' }) }],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              nexspace_id: nexspace.id,
              nexspace_title: nexspace.title,
              node_count: nexspace.nodes.length,
              nodes: nexspace.nodes.map(n => ({
                id: n.id,
                type: n.type,
                position: n.position,
                title: n.data.title,
                content_preview: typeof n.data.content === 'string'
                  ? n.data.content.substring(0, 100) + (n.data.content.length > 100 ? '...' : '')
                  : null,
              })),
            }, null, 2),
          },
        ],
      };
    }

    case 'get_canvas_edges': {
      const nexspace = getCurrentNexSpace();
      if (!nexspace) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No NexSpace found' }) }],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              edge_count: nexspace.edges.length,
              edges: nexspace.edges,
            }, null, 2),
          },
        ],
      };
    }

    case 'get_node_content': {
      const nodeId = args?.node_id as string;
      if (!nodeId) {
        throw new McpError(ErrorCode.InvalidParams, 'node_id is required');
      }
      const nexspace = getCurrentNexSpace();
      if (!nexspace) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No NexSpace found' }) }],
        };
      }
      const node = nexspace.nodes.find(n => n.id === nodeId);
      if (!node) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Node not found' }) }],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              node: {
                id: node.id,
                type: node.type,
                position: node.position,
                data: node.data,
              },
            }, null, 2),
          },
        ],
      };
    }

    case 'add_node': {
      const store = readStore();
      const nexspace = getCurrentNexSpace();
      if (!nexspace) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No NexSpace found' }) }],
        };
      }

      const newNode: CanvasNode = {
        id: `node-${Date.now()}`,
        type: (args?.type as string) || 'document',
        position: {
          x: (args?.position_x as number) ?? 100 + (nexspace.nodes.length % 4) * 360,
          y: (args?.position_y as number) ?? 100 + Math.floor(nexspace.nodes.length / 4) * 280,
        },
        data: {
          title: args?.title || 'Untitled',
          content: args?.content || '',
        },
      };

      const nexspaceIndex = store.nexspaces.findIndex(ns => ns.id === nexspace.id);
      if (nexspaceIndex >= 0) {
        store.nexspaces[nexspaceIndex].nodes.push(newNode);
        store.nexspaces[nexspaceIndex].lastEdited = new Date().toISOString();
        writeStore(store);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Node added successfully. Refresh the NexSpace app to see the changes.',
              node: newNode,
            }, null, 2),
          },
        ],
      };
    }

    case 'update_node': {
      const nodeId = args?.node_id as string;
      if (!nodeId) {
        throw new McpError(ErrorCode.InvalidParams, 'node_id is required');
      }
      const store = readStore();
      const nexspace = getCurrentNexSpace();
      if (!nexspace) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No NexSpace found' }) }],
        };
      }

      const nexspaceIndex = store.nexspaces.findIndex(ns => ns.id === nexspace.id);
      if (nexspaceIndex < 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'NexSpace not found in store' }) }],
        };
      }

      const nodeIndex = store.nexspaces[nexspaceIndex].nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex < 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Node not found' }) }],
        };
      }

      if (args?.title !== undefined) {
        store.nexspaces[nexspaceIndex].nodes[nodeIndex].data.title = args.title;
      }
      if (args?.content !== undefined) {
        store.nexspaces[nexspaceIndex].nodes[nodeIndex].data.content = args.content;
      }
      store.nexspaces[nexspaceIndex].lastEdited = new Date().toISOString();
      writeStore(store);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Node updated successfully',
              node: store.nexspaces[nexspaceIndex].nodes[nodeIndex],
            }, null, 2),
          },
        ],
      };
    }

    case 'delete_node': {
      const nodeId = args?.node_id as string;
      if (!nodeId) {
        throw new McpError(ErrorCode.InvalidParams, 'node_id is required');
      }
      const store = readStore();
      const nexspace = getCurrentNexSpace();
      if (!nexspace) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No NexSpace found' }) }],
        };
      }

      const nexspaceIndex = store.nexspaces.findIndex(ns => ns.id === nexspace.id);
      if (nexspaceIndex < 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'NexSpace not found' }) }],
        };
      }

      const nodeIndex = store.nexspaces[nexspaceIndex].nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex < 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Node not found' }) }],
        };
      }

      store.nexspaces[nexspaceIndex].nodes.splice(nodeIndex, 1);
      store.nexspaces[nexspaceIndex].edges = store.nexspaces[nexspaceIndex].edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );
      store.nexspaces[nexspaceIndex].lastEdited = new Date().toISOString();
      writeStore(store);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Node deleted successfully',
            }, null, 2),
          },
        ],
      };
    }

    case 'list_nexspaces': {
      const store = readStore();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              count: store.nexspaces.length,
              nexspaces: store.nexspaces.map(ns => ({
                id: ns.id,
                title: ns.title,
                lastEdited: ns.lastEdited,
                nodeCount: ns.nodes.length,
                messageCount: ns.chatMessages?.length || 0,
              })),
            }, null, 2),
          },
        ],
      };
    }

    case 'get_current_nexspace': {
      const nexspace = getCurrentNexSpace();
      if (!nexspace) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No NexSpace found' }) }],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              nexspace: {
                id: nexspace.id,
                title: nexspace.title,
                lastEdited: nexspace.lastEdited,
                createdAt: nexspace.createdAt,
                nodeCount: nexspace.nodes.length,
                edgeCount: nexspace.edges.length,
                messageCount: nexspace.chatMessages?.length || 0,
              },
            }, null, 2),
          },
        ],
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[NexSpace Canvas MCP] Server running on stdio');
}

main().catch((error) => {
  console.error('[NexSpace Canvas MCP] Failed to start:', error);
  process.exit(1);
});
