import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'
import type { Env } from '../index.js'

import {
  type ClientProfile,
  FULL_PROFILE,
  TOOLS_ONLY_PROFILE,
  UI_RESOURCE_MIME_TYPE,
  supportsApps,
  uiMeta,
} from './capabilities.js'

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

import {
  handleListTags,
  handleRenameTag,
  handleMergeTags,
  handleSetTagParent,
} from './tools/tags.js'

// Resource handlers
import {
  handleMemoryResource,
  handleMemoryTextResource,
  listMemoryResources,
} from './resources/memory.js'

import {
  handleUiAppResource,
  mcpApps,
} from './resources/ui-apps.js'

// Prompt handlers
import {
  availableWorkflowPrompts,
  getWorkflowPrompt,
} from './prompts/workflows.js'

import { createDualFormatResponse } from './utils/formatters.js'

export type { ClientProfile }
export { FULL_PROFILE, TOOLS_ONLY_PROFILE }

/**
 * Tools registered on every profile.
 *
 * Kept in sync with the registrations below by a protocol test, so the health
 * endpoint cannot drift from reality the way its hardcoded predecessor did.
 */
export const MEMORY_TOOL_NAMES = [
  'add_memory',
  'get_memory',
  'list_memories',
  'delete_memory',
  'update_url_content',
  'find_memories',
  'add_tags',
  'promote_memory',
  'review_temporary_memories',
  'update_memory',
  'list_tags',
  'rename_tag',
  'merge_tags',
  'set_tag_parent',
] as const

/** Extra tools registered only when resources/prompts are not served natively. */
export const FALLBACK_TOOL_NAMES = [
  'list_memory_resources',
  'read_memory_resource',
  'list_workflows',
  'get_workflow',
] as const

/** Tool names exposed on each endpoint, for the health probe. */
export function describeTools(): { full: string[]; toolsOnly: string[] } {
  return {
    full: [...MEMORY_TOOL_NAMES],
    toolsOnly: [...MEMORY_TOOL_NAMES, ...FALLBACK_TOOL_NAMES],
  }
}

/**
 * Create and configure the MCP Memory Server.
 *
 * The `profile` decides which primitives are exposed. It is resolved *before*
 * the server is constructed so that the advertised capabilities, `tools/list`,
 * `resources/list` and `prompts/list` all agree with one another — registering
 * everything and disabling it afterwards would leave the server advertising
 * primitives it then reports as empty.
 */
export function createMCPMemoryServer(
  env: Env,
  profile: ClientProfile = FULL_PROFILE
): McpServer {
  const server = new McpServer({
    name: 'memory-server-mcp',
    version: '1.0.0',
    title: 'Developer Memory Server',
  })

  // ---------------------------------------------------------------------------
  // Memory management tools
  // ---------------------------------------------------------------------------

  server.registerTool(
    'add_memory',
    {
      title: 'Add Memory',
      description: 'Add a new memory to the server with optional URL content fetching',
      inputSchema: z.object({
        name: z.string().describe('Name or title of the memory'),
        content: z.string().describe('Content of the memory'),
        url: z.string().optional().describe('Optional URL to fetch content from'),
        tags: z.array(z.string()).optional().describe('Optional tags to associate with the memory'),
        temporary: z.boolean().optional().describe('Create as temporary memory with TTL (auto-expires if not accessed, promotes to permanent after repeated access)'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => await handleAddMemory(env, args)
  )

  server.registerTool(
    'get_memory',
    {
      title: 'Get Memory',
      description: 'Retrieve a specific memory by ID',
      inputSchema: z.object({
        id: z.string().describe('Memory ID to retrieve'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://memory-editor', profile),
    },
    async (args) => await handleGetMemory(env, args)
  )

  server.registerTool(
    'list_memories',
    {
      title: 'List Memories',
      description: 'List all memories with optional filtering and pagination',
      inputSchema: z.object({
        limit: z.number().optional().describe('Maximum number of memories to return'),
        offset: z.number().optional().describe('Number of memories to skip'),
        tags: z.array(z.string()).optional().describe('Filter by tags'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://memory-browser', profile),
    },
    async (args) => await handleListMemories(env, args)
  )

  server.registerTool(
    'delete_memory',
    {
      title: 'Delete Memory',
      description: 'Delete a specific memory by ID. This cannot be undone.',
      inputSchema: z.object({
        id: z.string().describe('Memory ID to delete'),
      }),
      // Irreversible: also removes the memory's tag associations.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      _meta: uiMeta('ui://memory-browser', profile),
    },
    async (args) => await handleDeleteMemory(env, args)
  )

  server.registerTool(
    'update_url_content',
    {
      title: 'Refresh URL Content',
      description: 'Re-fetch and update the stored content of a memory from its source URL',
      inputSchema: z.object({
        // The handler requires this; it was previously registered as optional
        // with a description promising an "update all" mode that never existed.
        id: z.string().describe('Memory ID whose URL content should be refreshed'),
        force: z.boolean().optional().describe('Bypass the cached copy and re-fetch from the origin'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => await handleUpdateUrlContent(env, args)
  )

  server.registerTool(
    'find_memories',
    {
      title: 'Search Memories',
      description: 'Search memories by content or tags with advanced filtering',
      inputSchema: z.object({
        query: z.string().optional().describe('Search query for content'),
        tags: z.array(z.string()).optional().describe('Tags to filter by'),
        limit: z.number().optional().describe('Maximum number of results to return'),
        offset: z.number().optional().describe('Number of results to skip'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://memory-browser', profile),
    },
    async (args) => await handleFindMemories(env, args)
  )

  server.registerTool(
    'add_tags',
    {
      title: 'Add Tags',
      description: 'Add tags to existing memories',
      inputSchema: z.object({
        memoryId: z.string().describe('Memory ID to add tags to'),
        tags: z.array(z.string()).describe('Tags to add'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://memory-browser', profile),
    },
    async (args) => await handleAddTags(env, args)
  )

  server.registerTool(
    'promote_memory',
    {
      title: 'Promote Memory',
      description: 'Promote a temporary memory to permanent status',
      inputSchema: z.object({
        id: z.string().describe('Memory ID to promote'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://triage-dashboard', profile),
    },
    async (args) => await handlePromoteMemory(env, args)
  )

  server.registerTool(
    'review_temporary_memories',
    {
      title: 'Review Temporary Memories',
      description: 'List temporary memories with lifecycle metadata for review. Shows days until expiry, access count, stage, and last accessed time. Use to rescue important memories before they expire.',
      inputSchema: z.object({
        limit: z.number().optional().describe('Maximum number of memories to return (max 100)'),
        offset: z.number().optional().describe('Number of memories to skip'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://triage-dashboard', profile),
    },
    async (args) => await handleReviewTemporaryMemories(env, args)
  )

  server.registerTool(
    'update_memory',
    {
      title: 'Update Memory',
      description: 'Update an existing memory\'s content, name, or tags. Creates a new memory if the ID is not found (upsert behavior). Passing `tags` replaces the existing tags rather than merging them.',
      inputSchema: z.object({
        id: z.string().describe('Memory ID to update (creates new if not found)'),
        name: z.string().optional().describe('New name/title (required for new memories)'),
        content: z.string().optional().describe('New content (required for new memories)'),
        tags: z.array(z.string()).optional().describe('New tags (replaces existing). Supports hierarchical "parent>child" format'),
        temporary: z.boolean().optional().describe('Create as temporary memory if creating new (ignored for updates)'),
      }),
      // Replaces tags wholesale and can silently create a new record, so it is
      // not safely repeatable with partial input.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      _meta: uiMeta('ui://memory-editor', profile),
    },
    async (args) => await handleUpdateMemory(env, args)
  )

  // ---------------------------------------------------------------------------
  // Tag management tools
  // ---------------------------------------------------------------------------

  server.registerTool(
    'list_tags',
    {
      title: 'List Tags',
      description: 'List all tags with their hierarchy relationships and memory counts',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://tag-manager', profile),
    },
    async () => await handleListTags(env)
  )

  server.registerTool(
    'rename_tag',
    {
      title: 'Rename Tag',
      description: 'Rename an existing tag',
      inputSchema: z.object({
        tagId: z.number().describe('Tag ID to rename'),
        newName: z.string().describe('New name for the tag'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://tag-manager', profile),
    },
    async (args) => await handleRenameTag(env, args)
  )

  server.registerTool(
    'merge_tags',
    {
      title: 'Merge Tags',
      description: 'Merge one tag into another, moving all memory associations. The source tag is permanently deleted and this cannot be undone.',
      inputSchema: z.object({
        sourceTagId: z.number().describe('Tag ID to merge from (will be deleted)'),
        targetTagId: z.number().describe('Tag ID to merge into (will be kept)'),
      }),
      // Hard-deletes the source tag and rewrites hierarchy links.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      _meta: uiMeta('ui://tag-manager', profile),
    },
    async (args) => await handleMergeTags(env, args)
  )

  server.registerTool(
    'set_tag_parent',
    {
      title: 'Set Tag Parent',
      description: 'Set or remove parent-child relationship between tags',
      inputSchema: z.object({
        childTagId: z.number().describe('Child tag ID'),
        parentTagId: z.number().nullable().describe('Parent tag ID (null to remove parent and make root tag)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: uiMeta('ui://tag-manager', profile),
    },
    async (args) => await handleSetTagParent(env, args)
  )

  // ---------------------------------------------------------------------------
  // Memory resources — native, or reprojected as tools
  // ---------------------------------------------------------------------------

  if (profile.resources) {
    registerMemoryResources(server, env)
  } else {
    registerResourceFallbackTools(server, env)
  }

  // ---------------------------------------------------------------------------
  // UI app resources (MCP Apps)
  // ---------------------------------------------------------------------------

  if (profile.apps) {
    for (const app of mcpApps) {
      server.registerResource(
        app.name,
        app.uri,
        {
          description: app.description,
          mimeType: UI_RESOURCE_MIME_TYPE,
        },
        async () => await handleUiAppResource(env, app.uri)
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Workflow prompts — native, or reprojected as tools
  // ---------------------------------------------------------------------------

  if (profile.prompts) {
    registerWorkflowPrompts(server)
  } else {
    registerPromptFallbackTools(server)
  }

  return server
}

/**
 * Register `memory://` resources.
 *
 * The individual-memory entries are URI templates, not fixed URIs. They were
 * previously registered as literal wildcard strings, which the SDK treats as
 * static URIs matched by exact string equality — so `memory://<real-id>`
 * matched nothing and every read of an actual memory failed.
 */
function registerMemoryResources(server: McpServer, env: Env): void {
  server.registerResource(
    'memory-list',
    'memory://list',
    {
      title: 'Memory List',
      description: 'List of all available memories',
      mimeType: 'application/json',
    },
    async () => {
      const resources = await listMemoryResources(env)
      return {
        contents: [{
          uri: 'memory://list',
          text: JSON.stringify(resources, null, 2),
          mimeType: 'application/json',
        }],
      }
    }
  )

  server.registerResource(
    'memory-individual',
    new ResourceTemplate('memory://{id}', {
      // Makes individual memories discoverable through resources/list rather
      // than only via the JSON blob behind memory://list.
      list: async () => ({ resources: await listMemoryResources(env) }),
    }),
    {
      title: 'Memory Resource',
      description: 'Individual memory resources by ID',
      mimeType: 'application/json',
    },
    // The handler already returns a well-formed { contents: [...] } result;
    // it used to be re-wrapped and JSON-stringified into a nested shape.
    async (uri: URL) => await handleMemoryResource(env, uri.toString())
  )

  server.registerResource(
    'memory-text',
    new ResourceTemplate('memory://{id}/text', { list: undefined }),
    {
      title: 'Memory Text Resource',
      description: 'Plain-text content of a memory',
      mimeType: 'text/plain',
    },
    async (uri: URL) => await handleMemoryTextResource(env, uri.toString())
  )
}

/**
 * Expose the `memory://` resources as tools for hosts that ignore resources.
 *
 * Mirrors the shape FastMCP's `ResourcesAsTools` transform uses: one tool to
 * enumerate, one to read. Both delegate to the same handlers the native
 * resources use, so behaviour cannot drift between the two surfaces.
 */
function registerResourceFallbackTools(server: McpServer, env: Env): void {
  server.registerTool(
    'list_memory_resources',
    {
      title: 'List Memory Resources',
      description: 'List the readable memory:// resources. Equivalent to the MCP resources/list operation, exposed as a tool for hosts that do not consume resources.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const resources = await listMemoryResources(env)
      return createDualFormatResponse(
        `# Memory Resources\n\n${resources.length} resource(s) available.\n\n` +
          resources.map(r => `- \`${r.uri}\` — ${r.name}`).join('\n'),
        { success: true, data: { resources } }
      )
    }
  )

  server.registerTool(
    'read_memory_resource',
    {
      title: 'Read Memory Resource',
      description: 'Read a memory:// resource by URI. Equivalent to the MCP resources/read operation, exposed as a tool for hosts that do not consume resources. Accepts memory://list, memory://{id} and memory://{id}/text.',
      inputSchema: z.object({
        uri: z.string().describe('Resource URI, e.g. memory://abc-123 or memory://abc-123/text'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ uri }) => {
      if (uri === 'memory://list') {
        const resources = await listMemoryResources(env)
        return createDualFormatResponse(
          `# Memory Resources\n\n${resources.length} resource(s) available.`,
          { success: true, data: { resources } }
        )
      }

      const result = uri.endsWith('/text')
        ? await handleMemoryTextResource(env, uri)
        : await handleMemoryResource(env, uri)

      const text = result?.contents?.[0]?.text ?? ''
      return createDualFormatResponse(text, { success: true, data: result })
    }
  )
}

/** Register the workflow prompts natively. */
function registerWorkflowPrompts(server: McpServer): void {
  for (const prompt of availableWorkflowPrompts) {
    const shape: Record<string, z.ZodTypeAny> = {}
    for (const arg of prompt.arguments ?? []) {
      const field = z.string().describe(arg.description ?? '')
      shape[arg.name] = arg.required ? field : field.optional()
    }

    server.registerPrompt(
      prompt.name,
      {
        title: prompt.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: prompt.description,
        argsSchema: z.object(shape),
      },
      async (args: Record<string, unknown>) => ({
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: getWorkflowPrompt(prompt.name, args as Record<string, any>),
          },
        }],
      })
    )
  }
}

/**
 * Expose the workflow prompts as tools for hosts that ignore prompts.
 *
 * `get_workflow` returns the same prompt text the native prompt would produce,
 * so the model can follow the workflow even where the host offers no way to
 * invoke a prompt.
 */
function registerPromptFallbackTools(server: McpServer): void {
  const names = availableWorkflowPrompts.map(p => p.name)

  server.registerTool(
    'list_workflows',
    {
      title: 'List Workflows',
      description: 'List the available guided workflows. Equivalent to the MCP prompts/list operation, exposed as a tool for hosts that do not consume prompts.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const workflows = availableWorkflowPrompts.map(p => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments ?? [],
      }))
      return createDualFormatResponse(
        `# Available Workflows\n\n` +
          workflows.map(w =>
            `## ${w.name}\n\n${w.description}\n\n` +
            (w.arguments.length
              ? w.arguments.map((a: any) => `- \`${a.name}\`${a.required ? ' (required)' : ''} — ${a.description}`).join('\n')
              : '_No arguments._')
          ).join('\n\n'),
        { success: true, data: { workflows } }
      )
    }
  )

  server.registerTool(
    'get_workflow',
    {
      title: 'Get Workflow',
      description: `Get the instructions for a guided workflow. Equivalent to the MCP prompts/get operation, exposed as a tool for hosts that do not consume prompts. Available workflows: ${names.join(', ')}.`,
      inputSchema: z.object({
        name: z.enum(names as [string, ...string[]]).describe('Workflow name'),
        arguments: z.record(z.string(), z.string()).optional().describe('Workflow arguments as a string map'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ name, arguments: args }) => {
      const text = getWorkflowPrompt(name, (args ?? {}) as Record<string, any>)
      return createDualFormatResponse(text, {
        success: true,
        data: { name, arguments: args ?? {}, prompt: text },
      })
    }
  )
}

/**
 * HTTP handler for the MCP endpoint.
 *
 * Uses the stateless handler from `agents/mcp/server`, which serves both the
 * 2026-07-28 protocol revision (client capabilities travel per-request in
 * `_meta`, so no session is needed) and, through its legacy fallback, the
 * 2025-era revisions that today's shipping clients still speak.
 *
 * The server instance is built per request by the factory below. MCP Apps
 * support is negotiated from the client's declared capabilities; the
 * resources/prompts split is fixed per endpoint by `baseProfile`, because no
 * protocol signal for it exists.
 */
function createMemoryMcpHandler(env: Env, profile: ClientProfile, route: string) {
  return createMcpHandler(
    // Closes over this request's env and resolved profile. Deliberately not
    // hoisted to module scope: a Workers isolate serves concurrent requests,
    // so shared mutable state here would let one client's negotiated profile
    // leak into another's response.
    () => createMCPMemoryServer(env, profile),
    {
      route,
      // Origin/Host validation is handled by the Hono CORS layer in front of
      // this handler.
      corsOptions: false,
      allowedOriginHostnames: '*',
    }
  )
}

/** `_meta` key carrying client capabilities on every 2026-07-28 request. */
const CLIENT_CAPABILITIES_META_KEY = 'io.modelcontextprotocol/clientCapabilities'

/**
 * Determine whether the calling client can render MCP Apps.
 *
 * Two wire shapes have to be handled:
 *
 * - **2026-07-28**: every request carries the client's capabilities in
 *   `params._meta`, so any method can be negotiated.
 * - **2025-era**: capabilities appear only on `initialize`. A stateless
 *   `tools/list` from a legacy client therefore carries no signal at all, and
 *   there is nothing to persist it in. Those requests fall back to the
 *   endpoint default rather than silently dropping UI from hosts such as
 *   Claude.ai that do render it.
 */
async function detectAppsSupport(request: Request, fallback: boolean): Promise<boolean> {
  if (request.method !== 'POST') return fallback

  let body: unknown
  try {
    const raw = await request.clone().text()
    if (!raw) return fallback
    body = JSON.parse(raw)
  } catch {
    return fallback
  }

  const messages = Array.isArray(body) ? body : [body]
  for (const message of messages) {
    const params = (message as { params?: Record<string, any> })?.params
    if (!params) continue

    const declared = params._meta?.[CLIENT_CAPABILITIES_META_KEY]
    if (declared) return supportsApps(declared)

    if ((message as { method?: string }).method === 'initialize' && params.capabilities) {
      return supportsApps(params.capabilities)
    }
  }

  return fallback
}

/**
 * Entry point used by the Hono route.
 */
export async function handleMCPHttpRequest(
  env: Env,
  request: Request,
  profile: ClientProfile = FULL_PROFILE,
  route = '/mcp'
): Promise<Response> {
  const resolved: ClientProfile = {
    ...profile,
    apps: profile.apps ? await detectAppsSupport(request, true) : false,
  }

  const handler = createMemoryMcpHandler(env, resolved, route)

  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext

  return handler(request, env, ctx)
}
