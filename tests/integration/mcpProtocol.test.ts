/**
 * Protocol-level tests for the MCP server.
 *
 * These drive a real MCP client over an in-memory transport and assert on what
 * actually crosses the wire, rather than calling handlers directly. That is the
 * only way to catch registration mistakes — a resource registered under a URI
 * no client can address still looks fine at the handler level.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { Client } from '@modelcontextprotocol/client'

import {
  createMCPMemoryServer,
  describeTools,
  FULL_PROFILE,
  TOOLS_ONLY_PROFILE,
} from '../../src/mcp/server'
import { UI_EXTENSION_ID, UI_RESOURCE_MIME_TYPE } from '../../src/mcp/capabilities'

const MEMORY_ROW = {
  id: 'abc-123',
  name: 'Test Memory',
  content: 'hello world',
  url: null,
  created_at: 1_700_000_000,
  updated_at: 1_700_000_000,
}

function makeEnv(): any {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ results: [MEMORY_ROW] }),
    first: async () => MEMORY_ROW,
    run: async () => ({ success: true }),
  }
  return {
    DB: { prepare: () => stmt },
    CACHE_KV: { get: async () => null, put: async () => {} },
    TEMP_MEMORIES_KV: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) },
    MCP_APPS_KV: { get: async () => null },
  }
}

/** Connect a client to a server built with the given profile. */
async function connect(profile = FULL_PROFILE, clientCapabilities: any = {}) {
  const server = createMCPMemoryServer(makeEnv(), profile)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: clientCapabilities }
  )
  await Promise.all([
    server.connect(serverTransport as any),
    client.connect(clientTransport as any),
  ])
  return { client, server }
}

describe('MCP protocol surface', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('full profile', () => {
    it('advertises every tool with annotations and a title', async () => {
      const { client } = await connect()
      const { tools } = await client.listTools()

      expect(tools).toHaveLength(14)
      for (const tool of tools) {
        expect(tool.title, `${tool.name} should have a title`).toBeTruthy()
        expect(tool.annotations, `${tool.name} should have annotations`).toBeDefined()
      }
      await client.close()
    })

    it('matches the tool list the health endpoint advertises', async () => {
      // Guards against the health probe drifting from the real registrations.
      const { client } = await connect()
      const { tools } = await client.listTools()
      expect(tools.map(t => t.name).sort()).toEqual([...describeTools().full].sort())
      await client.close()
    })

    it('marks the irreversible tools destructive', async () => {
      const { client } = await connect()
      const { tools } = await client.listTools()
      const byName = Object.fromEntries(tools.map(t => [t.name, t]))

      // merge_tags hard-deletes the source tag; delete_memory cascades to tag
      // links; update_memory replaces tags wholesale and can upsert.
      expect(byName.merge_tags.annotations?.destructiveHint).toBe(true)
      expect(byName.delete_memory.annotations?.destructiveHint).toBe(true)
      expect(byName.update_memory.annotations?.destructiveHint).toBe(true)

      expect(byName.find_memories.annotations?.readOnlyHint).toBe(true)
      expect(byName.get_memory.annotations?.readOnlyHint).toBe(true)
      await client.close()
    })

    it('exposes individual memories as a resource template, not a literal wildcard', async () => {
      const { client } = await connect()

      const { resources } = await client.listResources()
      const uris = resources.map(r => r.uri)
      // The old registration advertised these literal strings.
      expect(uris).not.toContain('memory://*')
      expect(uris).not.toContain('memory://*/text')

      const { resourceTemplates } = await client.listResourceTemplates()
      const templates = resourceTemplates.map(t => t.uriTemplate)
      expect(templates).toContain('memory://{id}')
      expect(templates).toContain('memory://{id}/text')
      await client.close()
    })

    it('reads a real memory URI', async () => {
      const { client } = await connect()
      // This is the case that failed outright before: a concrete id matched no
      // registered resource.
      const result = await client.readResource({ uri: 'memory://abc-123' })
      expect(result.contents.length).toBeGreaterThan(0)
      expect(result.contents[0].uri).toBe('memory://abc-123')
      await client.close()
    })

    it('exposes the workflow prompts', async () => {
      const { client } = await connect()
      const { prompts } = await client.listPrompts()
      expect(prompts.map(p => p.name)).toEqual([
        'memory_capture_workflow',
        'knowledge_discovery_workflow',
        'content_maintenance_workflow',
        'research_session_workflow',
      ])
      await client.close()
    })

    it('returns structuredContent alongside the text blocks', async () => {
      const { client } = await connect()
      const result = await client.callTool({ name: 'get_memory', arguments: { id: 'abc-123' } })

      // Both legacy text blocks are preserved for hosts that read them...
      expect(result.content).toHaveLength(2)
      // ...and the machine-readable mirror is now present too.
      expect(result.structuredContent).toBeDefined()
      expect((result.structuredContent as any).success).toBe(true)
      await client.close()
    })
  })

  describe('MCP Apps negotiation', () => {
    it('attaches ui metadata and app resources when the client declares the UI extension', async () => {
      const { client } = await connect(FULL_PROFILE, {
        extensions: { [UI_EXTENSION_ID]: { mimeTypes: [UI_RESOURCE_MIME_TYPE] } },
      })

      const { tools } = await client.listTools()
      const getMemory = tools.find(t => t.name === 'get_memory')!
      expect((getMemory._meta as any)?.ui?.resourceUri).toBe('ui://memory-editor')

      const { resources } = await client.listResources()
      expect(resources.map(r => r.uri)).toContain('ui://memory-browser')
      await client.close()
    })

    it('omits ui metadata and app resources when apps are disabled', async () => {
      const { client } = await connect({ ...FULL_PROFILE, apps: false })

      const { tools } = await client.listTools()
      // Every tool still present — only the UI metadata is dropped.
      expect(tools).toHaveLength(14)
      for (const tool of tools) {
        expect((tool._meta as any)?.ui).toBeUndefined()
      }

      const { resources } = await client.listResources()
      expect(resources.filter(r => r.uri.startsWith('ui://'))).toHaveLength(0)
      await client.close()
    })
  })

  describe('tools-only profile', () => {
    it('reports no resources or prompts', async () => {
      const { client } = await connect(TOOLS_ONLY_PROFILE)

      const caps = client.getServerCapabilities()
      expect(caps?.resources).toBeUndefined()
      expect(caps?.prompts).toBeUndefined()
      await client.close()
    })

    it('reprojects resources and prompts as tools so nothing is lost', async () => {
      const { client } = await connect(TOOLS_ONLY_PROFILE)
      const { tools } = await client.listTools()
      const names = tools.map(t => t.name)

      expect(names).toContain('list_memory_resources')
      expect(names).toContain('read_memory_resource')
      expect(names).toContain('list_workflows')
      expect(names).toContain('get_workflow')

      // The 14 originals plus the four fallbacks.
      expect(tools).toHaveLength(18)
      expect(names.sort()).toEqual([...describeTools().toolsOnly].sort())
      await client.close()
    })

    it('read_memory_resource returns the same content the resource would', async () => {
      const { client } = await connect(TOOLS_ONLY_PROFILE)
      const result = await client.callTool({
        name: 'read_memory_resource',
        arguments: { uri: 'memory://abc-123' },
      })
      expect(result.content.length).toBeGreaterThan(0)
      expect((result.structuredContent as any).success).toBe(true)
      await client.close()
    })

    it('get_workflow returns the same prompt text the prompt would', async () => {
      const { client: promptClient } = await connect(FULL_PROFILE)
      const native = await promptClient.getPrompt({
        name: 'memory_capture_workflow',
        arguments: { url: 'https://example.com' },
      })
      const nativeText = (native.messages[0].content as any).text
      await promptClient.close()

      const { client } = await connect(TOOLS_ONLY_PROFILE)
      const viaTool = await client.callTool({
        name: 'get_workflow',
        arguments: { name: 'memory_capture_workflow', arguments: { url: 'https://example.com' } },
      })
      expect((viaTool.structuredContent as any).data.prompt).toBe(nativeText)
      await client.close()
    })
  })
})
