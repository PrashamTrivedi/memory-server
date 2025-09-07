
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {Env} from "../../index"

// Agent session tracking for Cloudflare Agent SDK
interface AgentSession {
  id: string
  created: number
  lastActivity: number
  capabilities: string[]
  metadata: Record<string, any>
}

/**
 * Streamable HTTP Transport adapter for Cloudflare Workers with Agent SDK support
 * This creates a bridge between Cloudflare's Request/Response and MCP's streamable HTTP transport
 * Enhanced for Cloudflare Agent SDK integration
 */
export class CloudflareStreamableHttpTransport {
  private server: McpServer
  private env: Env
  private agentSessions: Map<string, AgentSession> = new Map()

  constructor(server: McpServer, env: Env) {
    this.server = server
    this.env = env
  }

  /**
   * Create or update agent session
   */
  private createAgentSession(request: Request): AgentSession {
    const sessionId = request.headers.get('mcp-session-id') || crypto.randomUUID()
    const agentId = request.headers.get('x-agent-id')
    const agentVersion = request.headers.get('x-agent-version')
    const agentCapabilities = request.headers.get('x-agent-capabilities')?.split(',') || []

    const session: AgentSession = {
      id: sessionId,
      created: Date.now(),
      lastActivity: Date.now(),
      capabilities: agentCapabilities,
      metadata: {
        agentId,
        agentVersion,
        userAgent: request.headers.get('user-agent'),
      }
    }

    this.agentSessions.set(sessionId, session)
    return session
  }

  /**
   * Update agent session activity
   */
  private updateAgentSession(sessionId: string): void {
    const session = this.agentSessions.get(sessionId)
    if (session) {
      session.lastActivity = Date.now()
    }
  }

  /**
   * Clean up expired sessions (older than 1 hour)
   */
  private cleanupExpiredSessions(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    for (const [sessionId, session] of this.agentSessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        this.agentSessions.delete(sessionId)
      }
    }
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
            'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, last-event-id, x-agent-id, x-agent-version, x-agent-capabilities',
            'Access-Control-Expose-Headers': 'mcp-session-id, x-agent-session-id',
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
   * Handle GET requests for agent discovery and capabilities
   * Enhanced for Cloudflare Agent SDK support
   */
  private handleGetRequest(request: Request): Response {
    const url = new URL(request.url)
    const path = url.pathname
    
    // Clean up expired sessions
    this.cleanupExpiredSessions()
    
    // Create or get agent session
    const session = this.createAgentSession(request)

    // Handle different GET endpoints
    if (path.endsWith('/agent/capabilities') || path.endsWith('/capabilities')) {
      return this.handleAgentCapabilities(session)
    }

    if (path.endsWith('/agent/config') || path.endsWith('/config')) {
      return this.handleAgentConfig(session)
    }

    // Default: return enhanced server info with agent support
    return new Response(
      JSON.stringify({
        name: 'memory-server-mcp',
        version: '1.0.0',
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {
            subscribe: true,
            listChanged: true,
          },
          prompts: {
            listChanged: true,
          },
          experimental: {
            agentSdk: true,
            batchRequests: true,
            streaming: true,
          }
        },
        transport: {
          type: 'streamable-http',
          version: '1.0.0',
          features: ['agent-sessions', 'batch-operations', 'capabilities-negotiation']
        },
        agent: {
          sessionId: session.id,
          capabilities: session.capabilities,
          supportedFeatures: ['tools', 'resources', 'prompts', 'batch-requests']
        },
        endpoints: {
          capabilities: '/agent/capabilities',
          config: '/agent/config',
          tools: '/tools',
          resources: '/resources', 
          prompts: '/prompts'
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'mcp-session-id': session.id,
          'x-agent-session-id': session.id,
        },
      }
    )
  }

  /**
   * Handle agent capabilities endpoint
   */
  private handleAgentCapabilities(session: AgentSession): Response {
    return new Response(
      JSON.stringify({
        sessionId: session.id,
        serverCapabilities: {
          tools: {
            count: 7,
            features: ['json-schema', 'validation', 'caching'],
            available: ['add_memory', 'get_memory', 'list_memories', 'delete_memory', 'find_memories', 'add_tags', 'update_url_content']
          },
          resources: {
            schemes: ['memory://'],
            features: ['dynamic-listing', 'caching', 'content-types'],
            patterns: ['memory://list', 'memory://{id}', 'memory://{id}/text']
          },
          prompts: {
            count: 4,
            features: ['workflow-templates', 'argument-validation'],
            available: ['memory_capture_workflow', 'knowledge_discovery_workflow', 'content_maintenance_workflow', 'research_session_workflow']
          }
        },
        clientCapabilities: session.capabilities,
        negotiated: {
          transport: 'streamable-http',
          features: ['batch-requests', 'async-operations', 'result-caching']
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'mcp-session-id': session.id,
        },
      }
    )
  }

  /**
   * Handle agent configuration endpoint
   */
  private handleAgentConfig(session: AgentSession): Response {
    return new Response(
      JSON.stringify({
        sessionId: session.id,
        config: {
          maxMemorySize: 10 * 1024 * 1024, // 10MB
          maxBatchSize: 10,
          defaultTimeout: 30000,
          caching: {
            enabled: true,
            ttl: 300, // 5 minutes
          },
          features: {
            urlContent: true,
            tagging: true,
            search: true,
            workflows: true,
          }
        },
        limits: {
          toolCalls: {
            perMinute: 100,
            concurrent: 5
          },
          resources: {
            maxSize: 50 * 1024 * 1024, // 50MB
            concurrent: 10
          },
          prompts: {
            maxLength: 100000,
            concurrent: 3
          }
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'mcp-session-id': session.id,
        },
      }
    )
  }

  /**
   * Handle POST requests with JSON-RPC messages
   * Enhanced for Cloudflare Agent SDK with batch operation support
   */
  private async handlePostRequest(request: Request): Promise<Response> {
    try {
      const body = await request.json() as any
      const session = this.createAgentSession(request)
      
      // Update session activity
      this.updateAgentSession(session.id)

      // Handle batch requests (array of JSON-RPC messages)
      if (Array.isArray(body)) {
        return await this.handleBatchRequest(body, session)
      }

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
              'mcp-session-id': session.id,
            },
          }
        )
      }

      // Route the JSON-RPC message to the MCP server
      const result = await this.routeJsonRpcMessage(body, session)

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'mcp-session-id': session.id,
            'x-agent-session-id': session.id,
          },
        }
      )

    } catch (error) {
      const session = this.createAgentSession(request)
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
            'mcp-session-id': session.id,
          },
        }
      )
    }
  }

  /**
   * Handle batch JSON-RPC requests for improved agent performance
   */
  private async handleBatchRequest(batch: any[], session: AgentSession): Promise<Response> {
    const maxBatchSize = 10 // Configurable limit
    
    if (batch.length > maxBatchSize) {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: `Batch size ${batch.length} exceeds maximum of ${maxBatchSize}`,
          },
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'mcp-session-id': session.id,
          },
        }
      )
    }

    // Process all requests in the batch
    const results = await Promise.all(
      batch.map(async (request) => {
        try {
          return await this.routeJsonRpcMessage(request, session)
        } catch (error) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : String(error),
            },
          }
        }
      })
    )

    return new Response(
      JSON.stringify(results),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'mcp-session-id': session.id,
          'x-batch-size': batch.length.toString(),
        },
      }
    )
  }

  /**
   * Route JSON-RPC messages to appropriate MCP server handlers
   */
  private async routeJsonRpcMessage(message: any, session?: AgentSession): Promise<any> {
    const {method, params, id} = message

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
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