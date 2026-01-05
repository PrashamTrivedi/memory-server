import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {createMcpHandler, WorkerTransport} from 'agents/mcp'
import {z} from 'zod'
import type {Env} from '../index.js'

// Tool handlers
import {
  handleAddMemory,
  handleGetMemory,
  handleListMemories,
  handleDeleteMemory,
  handleUpdateUrlContent,
  handlePromoteMemory,
  handleReviewTemporaryMemories,
  handleUpdateMemory,
} from './tools/memory.js'

import {
  handleFindMemories,
  handleAddTags,
} from './tools/search.js'

// Resource handlers
import {
  handleMemoryResource,
  handleMemoryTextResource,
  listMemoryResources,
} from './resources/memory.js'

// Prompt handlers
import {
  availableWorkflowPrompts,
  getWorkflowPrompt,
} from './prompts/workflows.js'

/**
 * Create and configure MCP Memory Server using the official TypeScript SDK
 */
export function createMCPMemoryServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'memory-server-mcp',
    version: '1.0.0',
  })

  // Register memory management tools
  server.tool(
    'add_memory',
    'Add a new memory to the server with optional URL content fetching',
    {
      name: z.string().describe('Name or title of the memory'),
      content: z.string().describe('Content of the memory'),
      url: z.string().optional().describe('Optional URL to fetch content from'),
      tags: z.array(z.string()).optional().describe('Optional tags to associate with the memory'),
      temporary: z.boolean().optional().describe('Create as temporary memory with TTL (auto-expires if not accessed, promotes to permanent after repeated access)'),
    },
    async (args) => {
      return await handleAddMemory(env, args)
    }
  )

  server.tool(
    'get_memory',
    'Retrieve a specific memory by ID',
    {
      id: z.string().describe('Memory ID to retrieve'),
    },
    async (args) => {
      return await handleGetMemory(env, args)
    }
  )

  server.tool(
    'list_memories',
    'List all memories with optional filtering and pagination',
    {
      limit: z.number().optional().describe('Maximum number of memories to return'),
      offset: z.number().optional().describe('Number of memories to skip'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
    },
    async (args) => {
      return await handleListMemories(env, args)
    }
  )

  server.tool(
    'delete_memory',
    'Delete a specific memory by ID',
    {
      id: z.string().describe('Memory ID to delete'),
    },
    async (args) => {
      return await handleDeleteMemory(env, args)
    }
  )

  server.tool(
    'update_url_content',
    'Update content of memories by fetching from their URLs',
    {
      id: z.string().optional().describe('Memory ID to update (optional, updates all if not provided)'),
    },
    async (args) => {
      return await handleUpdateUrlContent(env, args)
    }
  )

  server.tool(
    'find_memories',
    'Search memories by content or tags with advanced filtering',
    {
      query: z.string().optional().describe('Search query for content'),
      tags: z.array(z.string()).optional().describe('Tags to filter by'),
      limit: z.number().optional().describe('Maximum number of results to return'),
      offset: z.number().optional().describe('Number of results to skip'),
    },
    async (args) => {
      return await handleFindMemories(env, args)
    }
  )

  server.tool(
    'add_tags',
    'Add tags to existing memories',
    {
      memoryId: z.string().describe('Memory ID to add tags to'),
      tags: z.array(z.string()).describe('Tags to add'),
    },
    async (args) => {
      return await handleAddTags(env, args)
    }
  )

  server.tool(
    'promote_memory',
    'Promote a temporary memory to permanent status',
    {
      id: z.string().describe('Memory ID to promote'),
    },
    async (args) => {
      return await handlePromoteMemory(env, args)
    }
  )

  server.tool(
    'review_temporary_memories',
    'List temporary memories with lifecycle metadata for review. Shows days until expiry, access count, stage, and last accessed time. Use to rescue important memories before they expire.',
    {
      limit: z.number().optional().describe('Maximum number of memories to return (max 100)'),
      offset: z.number().optional().describe('Number of memories to skip'),
    },
    async (args) => {
      return await handleReviewTemporaryMemories(env, args)
    }
  )

  server.tool(
    'update_memory',
    'Update an existing memory\'s content, name, or tags. Creates new memory if ID not found (upsert behavior).',
    {
      id: z.string().describe('Memory ID to update (creates new if not found)'),
      name: z.string().optional().describe('New name/title (required for new memories)'),
      content: z.string().optional().describe('New content (required for new memories)'),
      tags: z.array(z.string()).optional().describe('New tags (replaces existing). Supports hierarchical "parent>child" format'),
      temporary: z.boolean().optional().describe('Create as temporary memory if creating new (ignored for updates)'),
    },
    async (args) => {
      return await handleUpdateMemory(env, args)
    }
  )

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
      const resources = await listMemoryResources(env)
      return {
        contents: [{
          uri: 'memory://list',
          text: JSON.stringify(resources, null, 2),
          mimeType: 'application/json'
        }]
      }
    }
  )

  server.registerResource(
    'memory-individual',
    'memory://*',
    {
      title: 'Memory Resource',
      description: 'Individual memory resources by ID',
      mimeType: 'application/json'
    },
    async (uri: URL) => {
      const result = await handleMemoryResource(env, uri.toString())
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(result, null, 2),
          mimeType: 'application/json'
        }]
      }
    }
  )

  server.registerResource(
    'memory-text',
    'memory://*/text',
    {
      title: 'Memory Text Resource',
      description: 'Text content of memory resources',
      mimeType: 'text/plain'
    },
    async (uri: URL) => {
      const result = await handleMemoryTextResource(env, uri.toString())
      return {
        contents: [{
          uri: uri.toString(),
          text: typeof result === 'string' ? result : JSON.stringify(result),
          mimeType: 'text/plain'
        }]
      }
    }
  )

  // Register prompts
  availableWorkflowPrompts.forEach(prompt => {
    // Convert arguments to zod schema
    const argsSchema: Record<string, any> = {}
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        if (arg.required) {
          argsSchema[arg.name] = z.string().describe(arg.description)
        } else {
          argsSchema[arg.name] = z.string().optional().describe(arg.description)
        }
      }
    }

    server.prompt(
      prompt.name,
      prompt.description,
      argsSchema,
      async (args: any) => {
        const promptContent = getWorkflowPrompt(prompt.name, args)
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: promptContent,
            },
          }],
        }
      }
    )
  })

  return server
}



/**
 * Create HTTP handler for MCP server using Cloudflare's agents/mcp package
 * with WorkerTransport for native Cloudflare Workers support
 */
export async function handleMCPHttpRequest(env: Env, request: Request): Promise<Response> {
  const server = createMCPMemoryServer(env)

  // Use Cloudflare's createMcpHandler with WorkerTransport
  // enableJsonResponse: true disables SSE streaming for stateless operation
  // Type assertion needed due to SDK version mismatch between agents package and our direct dependency
  const handler = createMcpHandler(server as unknown as Parameters<typeof createMcpHandler>[0], {
    transport: new WorkerTransport({
      enableJsonResponse: true, // Use JSON responses instead of SSE for stateless mode
    }),
  })

  // Create a minimal ExecutionContext
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext

  return handler(request, env, ctx)
}