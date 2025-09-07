import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { Env } from '../index.js';

// Tool handlers
import {
  handleAddMemory,
  handleGetMemory,
  handleListMemories,
  handleDeleteMemory,
  handleUpdateUrlContent,
} from './tools/memory.js';

import {
  handleFindMemories,
  handleAddTags,
} from './tools/search.js';

/**
 * Create simplified MCP Memory Server using official SDK
 */
export function createSimpleMCPServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'memory-server-mcp',
    version: '1.0.0',
  });

  // Register tools with simplified zod schemas
  server.registerTool(
    'add_memory',
    {
      title: 'Add Memory',
      description: 'Add a new memory to the server',
      inputSchema: {
        name: z.string().describe('Name or title of the memory'),
        content: z.string().describe('Content of the memory'),
        url: z.string().optional().describe('Optional URL to fetch content from'),
        tags: z.array(z.string()).optional().describe('Optional tags'),
      },
    },
    async (args) => {
      const result = await handleAddMemory(env, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    'list_memories',
    {
      title: 'List Memories',
      description: 'List all memories',
      inputSchema: {
        limit: z.number().optional().describe('Maximum number to return'),
        offset: z.number().optional().describe('Number to skip'),
      },
    },
    async (args) => {
      const result = await handleListMemories(env, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  return server;
}

// Map to store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Simplified HTTP handler for MCP server using official SDK transport
 */
export async function handleSimpleMCPHttpRequest(env: Env, request: Request): Promise<Response> {
  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, last-event-id',
        },
      });
    }

    const server = createSimpleMCPServer(env);
    
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    // Connect the transport to the MCP server
    await server.connect(transport);

    // Convert Cloudflare Request to Node.js-like request object
    const body = request.method === 'POST' ? await request.json() : null;
    
    const mockReq = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body
    } as any;

    let responseData: any = null;
    let statusCode = 200;
    let responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    const mockRes = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        responseData = data;
        return mockRes;
      },
      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value;
        return mockRes;
      },
      send: (data: any) => {
        responseData = data;
        return mockRes;
      },
      headersSent: false
    } as any;

    // Handle the request using the official SDK transport
    await transport.handleRequest(mockReq, mockRes, body);

    // Return the response
    return new Response(
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      {
        status: statusCode,
        headers: responseHeaders,
      }
    );

  } catch (error) {
    console.error('MCP HTTP request error:', error);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}