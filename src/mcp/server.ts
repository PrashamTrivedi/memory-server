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

// Resource handlers
import {
  handleMemoryResource,
  handleMemoryTextResource,
  listMemoryResources,
} from './resources/memory.js';

// Prompt handlers
import {
  availableWorkflowPrompts,
  getWorkflowPrompt,
} from './prompts/workflows.js';

/**
 * Create and configure MCP Memory Server using the official TypeScript SDK
 */
export function createMCPMemoryServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'memory-server-mcp',
    version: '1.0.0',
  });

  // Register memory management tools
  server.registerTool(
    'add_memory',
    {
      title: 'Add Memory',
      description: 'Add a new memory to the server with optional URL content fetching',
      inputSchema: {
        name: z.string().describe('Name or title of the memory'),
        content: z.string().describe('Content of the memory'),
        url: z.string().optional().describe('Optional URL to fetch content from'),
        tags: z.array(z.string()).optional().describe('Optional tags to associate with the memory'),
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
    'get_memory',
    {
      title: 'Get Memory',
      description: 'Retrieve a specific memory by ID',
      inputSchema: {
        id: z.string().describe('Memory ID to retrieve'),
      },
    },
    async (args) => {
      const result = await handleGetMemory(env, args);
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
      description: 'List all memories with optional filtering and pagination',
      inputSchema: {
        limit: z.number().optional().describe('Maximum number of memories to return'),
        offset: z.number().optional().describe('Number of memories to skip'),
        tags: z.array(z.string()).optional().describe('Filter by tags'),
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

  server.registerTool(
    'delete_memory',
    {
      title: 'Delete Memory',
      description: 'Delete a specific memory by ID',
      inputSchema: {
        id: z.string().describe('Memory ID to delete'),
      },
    },
    async (args) => {
      const result = await handleDeleteMemory(env, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    'update_url_content',
    {
      title: 'Update URL Content',
      description: 'Update content of memories by fetching from their URLs',
      inputSchema: {
        id: z.string().optional().describe('Memory ID to update (optional, updates all if not provided)'),
      },
    },
    async (args) => {
      const result = await handleUpdateUrlContent(env, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    'find_memories',
    {
      title: 'Find Memories',
      description: 'Search memories by content or tags with advanced filtering',
      inputSchema: {
        query: z.string().optional().describe('Search query for content'),
        tags: z.array(z.string()).optional().describe('Tags to filter by'),
        limit: z.number().optional().describe('Maximum number of results to return'),
        offset: z.number().optional().describe('Number of results to skip'),
      },
    },
    async (args) => {
      const result = await handleFindMemories(env, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    'add_tags',
    {
      title: 'Add Tags',
      description: 'Add tags to existing memories',
      inputSchema: {
        memoryId: z.string().describe('Memory ID to add tags to'),
        tags: z.array(z.string()).describe('Tags to add'),
      },
    },
    async (args) => {
      const result = await handleAddTags(env, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  // Register resources
  server.registerResource(
    'memory-list',
    'memory://list',
    {
      title: 'Memory List',
      description: 'List of all available memories',
      mimeType: 'application/json'
    },
    async () => {
      const resources = await listMemoryResources(env);
      return {
        contents: [{
          uri: 'memory://list',
          text: JSON.stringify(resources, null, 2),
          mimeType: 'application/json'
        }]
      };
    }
  );

  server.registerResource(
    'memory-individual',
    'memory://*',
    {
      title: 'Memory Resource',
      description: 'Individual memory resources by ID',
      mimeType: 'application/json'
    },
    async (uri: URL) => {
      const result = await handleMemoryResource(env, uri.toString());
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(result, null, 2),
          mimeType: 'application/json'
        }]
      };
    }
  );

  server.registerResource(
    'memory-text',
    'memory://*/text',
    {
      title: 'Memory Text Resource',
      description: 'Text content of memory resources',
      mimeType: 'text/plain'
    },
    async (uri: URL) => {
      const result = await handleMemoryTextResource(env, uri.toString());
      return {
        contents: [{
          uri: uri.toString(),
          text: typeof result === 'string' ? result : JSON.stringify(result),
          mimeType: 'text/plain'
        }]
      };
    }
  );

  // Register prompts
  availableWorkflowPrompts.forEach(prompt => {
    // Convert arguments to zod schema
    const argsSchema: Record<string, any> = {};
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        if (arg.required) {
          argsSchema[arg.name] = z.string().describe(arg.description);
        } else {
          argsSchema[arg.name] = z.string().optional().describe(arg.description);
        }
      }
    }

    server.registerPrompt(
      prompt.name,
      {
        title: prompt.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: prompt.description,
        argsSchema: argsSchema,
      },
      (args: any) => {
        const promptContent = getWorkflowPrompt(prompt.name, args);
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: promptContent,
            },
          }],
        };
      }
    );
  });

  return server;
}


// Map to store transports by session ID for Cloudflare Workers
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Create HTTP handler for MCP server using official SDK Streamable HTTP transport
 */
export async function handleMCPHttpRequest(env: Env, request: Request): Promise<Response> {
  try {
    const sessionId = request.headers.get('mcp-session-id');
    
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

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else {
      // Create new transport for new sessions or initialization
      const server = createMCPMemoryServer(env);
      
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId: string) => {
          console.log(`Session initialized with ID: ${newSessionId}`);
          transports.set(newSessionId, transport);
        }
      });

      // Set up onclose handler to clean up transport
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports.has(sid)) {
          console.log(`Transport closed for session ${sid}`);
          transports.delete(sid);
        }
      };

      // Connect the transport to the MCP server
      await server.connect(transport);
    }

    // Convert Cloudflare Request to Node.js-like request object
    const body = request.method === 'POST' ? await request.json() : null;
    
    // Create a mock Express-like request and response
    const mockReq = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body
    };

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
    };

    // Handle the request using the official SDK transport
    await transport.handleRequest(mockReq as any, mockRes as any, body);

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