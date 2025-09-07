
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {Env} from "../../index"

/**
 * Streamable HTTP Transport adapter for Cloudflare Workers
 * This creates a bridge between Cloudflare's Request/Response and MCP's streamable HTTP transport
 */
export class CloudflareStreamableHttpTransport {
  private server: McpServer
  private env: Env

  constructor(server: McpServer, env: Env) {
    this.server = server
    this.env = env
  }

  /**
   * Handle HTTP requests in Cloudflare Workers environment
   */
  async handleRequest(request: Request): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, mcp-protocol-version, last-event-id',
          },
        })
      }

      // Handle GET requests for SSE streams (basic implementation for now)
      if (request.method === 'GET') {
        return this.handleGetRequest(request)
      }

      // Handle POST requests with JSON-RPC
      if (request.method === 'POST') {
        return this.handlePostRequest(request)
      }

      // Handle DELETE requests for session termination
      if (request.method === 'DELETE') {
        return this.handleDeleteRequest(request)
      }

      return new Response('Method not allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      })

    } catch (error) {
      console.error('Streamable HTTP transport error:', error)
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
      )
    }
  }

  /**
   * Handle GET requests for SSE streams
   * For now, return basic server info since full SSE support requires more complex implementation
   */
  private handleGetRequest(request: Request): Response {
    const url = new URL(request.url)
    const sessionId = request.headers.get('mcp-session-id')
    const lastEventId = request.headers.get('last-event-id')

    // For now, return basic server capabilities instead of starting an SSE stream
    // Full SSE implementation would require persistent connections which is complex in Workers
    return new Response(
      JSON.stringify({
        name: 'memory-server-mcp',
        version: '1.0.0',
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
        },
        transport: 'streamable-http',
        sessionId: sessionId || undefined,
        lastEventId: lastEventId || undefined,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'mcp-session-id': sessionId || crypto.randomUUID(),
        },
      }
    )
  }

  /**
   * Handle POST requests with JSON-RPC messages
   * Route messages through the MCP server's built-in handlers
   */
  private async handlePostRequest(request: Request): Promise<Response> {
    try {
      // Validate protocol version header
      const protocolVersion = request.headers.get('mcp-protocol-version')
      if (!protocolVersion) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: 'Missing mcp-protocol-version header',
            },
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        )
      }

      // Validate origin header for security (DNS rebinding attack prevention)
      const origin = request.headers.get('origin')
      if (origin) {
        // For localhost development, allow any localhost origin
        const url = new URL(origin)
        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && !url.hostname.endsWith('.local')) {
          // In production, you might want to maintain a whitelist of allowed origins
          console.warn('Request from non-localhost origin:', origin)
        }
      }

      const body = await request.json() as any
      const sessionId = request.headers.get('mcp-session-id')

      // Basic JSON-RPC message validation
      if (!body.jsonrpc || body.jsonrpc !== '2.0') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: 'Missing or invalid jsonrpc field',
            },
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        )
      }

      // Route the JSON-RPC message to the MCP server
      const result = await this.routeJsonRpcMessage(body)

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'mcp-session-id': sessionId || crypto.randomUUID(),
          },
        }
      )

    } catch (error) {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : String(error),
          },
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }
  }

  /**
   * Route JSON-RPC messages to appropriate MCP server handlers
   */
  private async routeJsonRpcMessage(message: any): Promise<any> {
    const {method, params, id} = message

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {
                tools: {},
                resources: {},
                prompts: {},
              },
              serverInfo: {
                name: 'memory-server-mcp',
                version: '1.0.0',
              },
            },
          }

        case 'tools/list':
          // Get tools from the server
          const tools = await this.getToolsList()
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools,
            },
          }

        case 'resources/list':
          // Get resources from the server
          const resources = await this.getResourcesList()
          return {
            jsonrpc: '2.0',
            id,
            result: {
              resources,
            },
          }

        case 'prompts/list':
          // Get prompts from the server
          const prompts = await this.getPromptsList()
          return {
            jsonrpc: '2.0',
            id,
            result: {
              prompts,
            },
          }

        case 'tools/call':
          // Handle tool calls
          const toolResult = await this.handleToolCall(params)
          return {
            jsonrpc: '2.0',
            id,
            result: toolResult,
          }

        case 'resources/read':
          // Handle resource reads
          const resourceResult = await this.handleResourceRead(params)
          return {
            jsonrpc: '2.0',
            id,
            result: resourceResult,
          }

        case 'prompts/get':
          // Handle prompt gets
          const promptResult = await this.handlePromptGet(params)
          return {
            jsonrpc: '2.0',
            id,
            result: promptResult,
          }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found',
              data: `Unknown method: ${method}`,
            },
          }
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }

  /**
   * Get tools list from MCP server
   */
  private async getToolsList(): Promise<any[]> {
    // This would ideally be retrieved from the server's registered tools
    // For now, return a hardcoded list based on what we registered
    return [
      {
        name: 'add_memory',
        description: 'Add a new memory to the server with optional URL content fetching',
        inputSchema: {
          type: 'object',
          properties: {
            name: {type: 'string', description: 'Name or title of the memory'},
            content: {type: 'string', description: 'Content of the memory'},
            url: {type: 'string', description: 'Optional URL to fetch content from'},
            tags: {type: 'array', items: {type: 'string'}, description: 'Optional tags'},
          },
          required: ['name', 'content'],
        },
      },
      {
        name: 'get_memory',
        description: 'Retrieve a specific memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {type: 'string', description: 'Memory ID to retrieve'},
          },
          required: ['id'],
        },
      },
      {
        name: 'list_memories',
        description: 'List all memories with optional filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {type: 'number', description: 'Maximum number of memories to return'},
            offset: {type: 'number', description: 'Number of memories to skip'},
            tags: {type: 'array', items: {type: 'string'}, description: 'Filter by tags'},
          },
        },
      },
      {
        name: 'delete_memory',
        description: 'Delete a specific memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {type: 'string', description: 'Memory ID to delete'},
          },
          required: ['id'],
        },
      },
      {
        name: 'update_url_content',
        description: 'Update content of memories by fetching from their URLs',
        inputSchema: {
          type: 'object',
          properties: {
            id: {type: 'string', description: 'Memory ID to update'},
          },
        },
      },
      {
        name: 'find_memories',
        description: 'Search memories by content or tags with advanced filtering',
        inputSchema: {
          type: 'object',
          properties: {
            query: {type: 'string', description: 'Search query for content'},
            tags: {type: 'array', items: {type: 'string'}, description: 'Tags to filter by'},
            limit: {type: 'number', description: 'Maximum number of results to return'},
            offset: {type: 'number', description: 'Number of results to skip'},
          },
        },
      },
      {
        name: 'add_tags',
        description: 'Add tags to existing memories',
        inputSchema: {
          type: 'object',
          properties: {
            memoryId: {type: 'string', description: 'Memory ID to add tags to'},
            tags: {type: 'array', items: {type: 'string'}, description: 'Tags to add'},
          },
          required: ['memoryId', 'tags'],
        },
      },
    ]
  }

  /**
   * Get resources list from MCP server
   */
  private async getResourcesList(): Promise<any[]> {
    const {listMemoryResources} = await import('../resources/memory.js')

    try {
      // Get actual memory resources from the database
      const memoryResources = await listMemoryResources(this.env)

      // Start with the special list resource
      const resources = [
        {
          uri: 'memory://list',
          name: 'Memory List',
          description: 'List of all available memories with their metadata',
          mimeType: 'application/json',
        }
      ]

      // Add individual memory resources
      resources.push(...memoryResources)

      return resources
    } catch (error) {
      console.error('Error getting resources list:', error)
      // Fallback to basic list if there's an error
      return [
        {
          uri: 'memory://list',
          name: 'Memory List',
          description: 'List of all available memories',
          mimeType: 'application/json',
        },
      ]
    }
  }

  /**
   * Get prompts list from MCP server
   */
  private async getPromptsList(): Promise<any[]> {
    const {availableWorkflowPrompts} = await import('../prompts/workflows.js')

    try {
      // Get actual workflow prompts
      return availableWorkflowPrompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments || []
      }))
    } catch (error) {
      console.error('Error getting prompts list:', error)
      // Fallback to empty list if there's an error
      return []
    }
  }

  /**
   * Handle tool calls
   */
  private async handleToolCall(params: any): Promise<any> {
    // Import handlers dynamically to avoid circular dependencies
    const {handleAddMemory, handleGetMemory, handleListMemories, handleDeleteMemory, handleUpdateUrlContent} = await import('../tools/memory.js')
    const {handleFindMemories, handleAddTags} = await import('../tools/search.js')

    const {name, arguments: args} = params

    switch (name) {
      case 'add_memory':
        return await handleAddMemory(this.env, args)
      case 'get_memory':
        return await handleGetMemory(this.env, args)
      case 'list_memories':
        return await handleListMemories(this.env, args)
      case 'delete_memory':
        return await handleDeleteMemory(this.env, args)
      case 'update_url_content':
        return await handleUpdateUrlContent(this.env, args)
      case 'find_memories':
        return await handleFindMemories(this.env, args)
      case 'add_tags':
        return await handleAddTags(this.env, args)
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  /**
   * Handle resource reads
   */
  private async handleResourceRead(params: any): Promise<any> {
    const {handleMemoryResource, handleMemoryTextResource, listMemoryResources} = await import('../resources/memory.js')
    const {uri} = params

    // Handle special memory://list resource
    if (uri === 'memory://list') {
      const memories = await listMemoryResources(this.env)
      return {
        contents: [{
          uri,
          text: JSON.stringify(memories, null, 2),
          mimeType: 'application/json'
        }]
      }
    }

    if (uri.startsWith('memory://') && uri.endsWith('/text')) {
      return await handleMemoryTextResource(this.env, uri)
    } else if (uri.startsWith('memory://')) {
      return await handleMemoryResource(this.env, uri)
    } else {
      throw new Error(`Unsupported resource URI: ${uri}`)
    }
  }

  /**
   * Handle prompt gets
   */
  private async handlePromptGet(params: any): Promise<any> {
    const {getWorkflowPrompt} = await import('../prompts/workflows.js')
    const {name, arguments: args = {}} = params

    const promptContent = getWorkflowPrompt(name, args)
    return {
      description: `Generated ${name} workflow prompt`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: promptContent,
          },
        },
      ],
    }
  }

  /**
   * Handle DELETE requests for session termination
   */
  private handleDeleteRequest(request: Request): Response {
    const sessionId = request.headers.get('mcp-session-id')

    return new Response(
      JSON.stringify({
        message: 'Session terminated',
        sessionId: sessionId,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}