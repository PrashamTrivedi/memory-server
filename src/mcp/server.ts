import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '../index.js';
import { CloudflareStreamableHttpTransport } from './transport/streamableHttp.js';

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
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name or title of the memory',
          },
          content: {
            type: 'string',
            description: 'Content of the memory',
          },
          url: {
            type: 'string',
            description: 'Optional URL to fetch content from',
            format: 'uri',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags to associate with the memory',
          },
        },
        required: ['name', 'content'],
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
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Memory ID to retrieve',
          },
        },
        required: ['id'],
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
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of memories to return',
            default: 10,
          },
          offset: {
            type: 'number',
            description: 'Number of memories to skip',
            default: 0,
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags',
          },
        },
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
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Memory ID to delete',
          },
        },
        required: ['id'],
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
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Memory ID to update (optional, updates all if not provided)',
          },
        },
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
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for content',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to filter by',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10,
          },
          offset: {
            type: 'number',
            description: 'Number of results to skip',
            default: 0,
          },
        },
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
        type: 'object',
        properties: {
          memoryId: {
            type: 'string',
            description: 'Memory ID to add tags to',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to add',
          },
        },
        required: ['memoryId', 'tags'],
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
    'memory://list',
    {
      title: 'Memory List',
      description: 'List of all available memories',
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
    'memory://*',
    {
      title: 'Memory Resource',
      description: 'Individual memory resources by ID',
    },
    async (uri) => {
      const result = await handleMemoryResource(env, uri);
      return {
        contents: [{
          uri,
          text: JSON.stringify(result, null, 2),
          mimeType: 'application/json'
        }]
      };
    }
  );

  server.registerResource(
    'memory://*/text',
    {
      title: 'Memory Text Resource',
      description: 'Text content of memory resources',
    },
    async (uri) => {
      const result = await handleMemoryTextResource(env, uri);
      return {
        contents: [{
          uri,
          text: typeof result === 'string' ? result : JSON.stringify(result),
          mimeType: 'text/plain'
        }]
      };
    }
  );

  // Register prompts
  availableWorkflowPrompts.forEach(prompt => {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: prompt.argsSchema,
      },
      (args) => {
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


/**
 * Create HTTP handler for MCP server using Streamable HTTP transport
 */
export async function handleMCPHttpRequest(env: Env, request: Request): Promise<Response> {
  try {
    const server = createMCPMemoryServer(env);
    const transport = new CloudflareStreamableHttpTransport(server, env);
    
    return await transport.handleRequest(request);

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