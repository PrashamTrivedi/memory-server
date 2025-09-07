import { HttpStreamableTransport } from './transport/http.js';
import type { Env } from '../index.js';

// Tool imports
import {
  addMemoryTool,
  getMemoryTool,
  listMemoriesTool,
  deleteMemoryTool,
  updateUrlContentTool,
  handleAddMemory,
  handleGetMemory,
  handleListMemories,
  handleDeleteMemory,
  handleUpdateUrlContent,
} from './tools/memory.js';

import {
  findMemoriesTool,
  addTagsTool,
  handleFindMemories,
  handleAddTags,
} from './tools/search.js';

// Resource imports
import {
  memoryResource,
  memoryTextResource,
  handleMemoryResource,
  handleMemoryTextResource,
  listMemoryResources,
} from './resources/memory.js';

// Prompt imports
import {
  availableWorkflowPrompts,
  getWorkflowPrompt,
} from './prompts/workflows.js';

/**
 * Complete MCP Server implementation for Memory Server
 * Provides tools, resources, and prompts with HTTP streamable transport
 */
export class MCPMemoryServer {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Handle tool calls directly
   */
  async handleToolCall(name: string, args: any): Promise<any> {
    try {
      switch (name) {
        case 'add_memory':
          return await handleAddMemory(this.env, args);
        case 'get_memory':
          return await handleGetMemory(this.env, args);
        case 'list_memories':
          return await handleListMemories(this.env, args);
        case 'delete_memory':
          return await handleDeleteMemory(this.env, args);
        case 'update_url_content':
          return await handleUpdateUrlContent(this.env, args);
        case 'find_memories':
          return await handleFindMemories(this.env, args);
        case 'add_tags':
          return await handleAddTags(this.env, args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List available tools
   */
  getTools() {
    return [
      addMemoryTool,
      getMemoryTool,
      listMemoriesTool,
      deleteMemoryTool,
      updateUrlContentTool,
      findMemoriesTool,
      addTagsTool,
    ];
  }

  /**
   * Handle resource requests
   */
  async handleResourceRequest(uri: string): Promise<any> {
    try {
      if (uri.startsWith('memory://') && uri.endsWith('/text')) {
        return await handleMemoryTextResource(this.env, uri);
      } else if (uri.startsWith('memory://')) {
        return await handleMemoryResource(this.env, uri);
      } else {
        throw new Error(`Unsupported resource URI: ${uri}`);
      }
    } catch (error) {
      throw new Error(`Resource error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List available resources
   */
  async getResources() {
    const memoryResources = await listMemoryResources(this.env);
    return [
      memoryResource,
      memoryTextResource,
      ...memoryResources,
    ];
  }

  /**
   * Handle prompt requests
   */
  async handlePromptRequest(name: string, args: any = {}): Promise<any> {
    try {
      const promptContent = getWorkflowPrompt(name, args);
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
      };
    } catch (error) {
      throw new Error(`Prompt error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List available prompts
   */
  getPrompts() {
    return availableWorkflowPrompts;
  }

  /**
   * Get server capabilities
   */
  getCapabilities() {
    return {
      tools: this.getTools(),
      resources: [],
      prompts: this.getPrompts(),
    };
  }

  /**
   * Handle HTTP requests for MCP operations
   */
  async handleHttpRequest(request: Request): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      // Handle GET requests - basic server info
      if (request.method === 'GET') {
        return new Response(
          JSON.stringify({
            name: 'memory-server-mcp',
            version: '1.0.0',
            capabilities: {
              tools: this.getTools().length,
              resources: true,
              prompts: this.getPrompts().length,
            },
            tools: this.getTools().map(tool => ({ name: tool.name, description: tool.description })),
            endpoints: {
              tools: '/mcp/tools',
              resources: '/mcp/resources',
              prompts: '/mcp/prompts',
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Handle POST requests - MCP operations
      if (request.method === 'POST') {
        const body = await request.json();
        const { method, params } = body;

        let result;
        switch (method) {
          case 'tools/list':
            result = { tools: this.getTools() };
            break;
          case 'tools/call':
            result = await this.handleToolCall(params.name, params.arguments);
            break;
          case 'resources/list':
            result = { resources: await this.getResources() };
            break;
          case 'resources/read':
            result = await this.handleResourceRequest(params.uri);
            break;
          case 'prompts/list':
            result = { prompts: this.getPrompts() };
            break;
          case 'prompts/get':
            result = await this.handlePromptRequest(params.name, params.arguments);
            break;
          default:
            throw new Error(`Unknown method: ${method}`);
        }

        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id || null,
            result,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      return new Response('Method not allowed', { status: 405 });

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
}