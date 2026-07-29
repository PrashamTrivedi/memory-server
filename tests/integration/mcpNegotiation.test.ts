/**
 * End-to-end negotiation over HTTP.
 *
 * Exercises the real entry point (`handleMCPHttpRequest`) rather than passing a
 * profile in directly, so the wire-level capability detection is what is under
 * test.
 */
import { describe, it, expect } from 'vitest'

import { handleMCPHttpRequest, FULL_PROFILE, TOOLS_ONLY_PROFILE } from '../../src/mcp/server'
import { UI_EXTENSION_ID, UI_RESOURCE_MIME_TYPE } from '../../src/mcp/capabilities'

function makeEnv(): any {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ results: [] }),
    first: async () => null,
    run: async () => ({ success: true }),
  }
  return {
    DB: { prepare: () => stmt },
    CACHE_KV: { get: async () => null, put: async () => {} },
    TEMP_MEMORIES_KV: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) },
    MCP_APPS_KV: { get: async () => null },
  }
}

/** Pull the JSON-RPC payload out of either a JSON or an SSE response body. */
function parsePayload(contentType: string, text: string): any {
  if (contentType.includes('text/event-stream')) {
    const line = text.split('\n').find(l => l.startsWith('data:'))
    if (!line) throw new Error(`no data frame in SSE body: ${text}`)
    return JSON.parse(line.slice('data:'.length).trim())
  }
  return JSON.parse(text)
}

async function post(
  body: unknown,
  { accept = 'application/json, text/event-stream', profile = FULL_PROFILE, route = '/mcp' } = {}
): Promise<{ payload: any; contentType: string }> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept }

  // The 2026-07-28 revision requires the request to declare its method in an
  // `Mcp-Method` header that agrees with the body (SEP-2243), so the edge can
  // classify a message without parsing it.
  const method = (body as { method?: string })?.method
  if (!Array.isArray(body) && method) headers['mcp-method'] = method

  const request = new Request(`https://memory.example${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const response = await handleMCPHttpRequest(makeEnv(), request, profile, route)
  const text = await response.text()
  const contentType = response.headers.get('content-type') ?? ''
  expect(response.status, `unexpected status ${response.status}: ${text}`).toBe(200)
  return { payload: parsePayload(contentType, text), contentType }
}

/** A legacy-era `initialize` carrying the given client capabilities. */
function initialize(capabilities: Record<string, unknown>) {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities,
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  }
}

const UI_CAPABILITY = {
  extensions: { [UI_EXTENSION_ID]: { mimeTypes: [UI_RESOURCE_MIME_TYPE] } },
}

describe('MCP endpoint over HTTP', () => {
  it('serves 2025-era clients through the legacy fallback', async () => {
    // Today's shipping clients still speak this revision; the endpoint must
    // keep answering them after the move to the 2026-07-28 stack.
    const { payload } = await post(initialize({}))
    expect(payload.result?.capabilities).toBeDefined()
    expect(payload.result?.serverInfo?.name).toBe('memory-server-mcp')
  })

  it('requires clients to accept both JSON and SSE, per streamable HTTP', async () => {
    // Behaviour change from the previous `enableJsonResponse: true` transport,
    // which answered JSON-only clients. Streamable HTTP requires a client to
    // accept both encodings and lets the server choose, so a single-encoding
    // Accept header is now correctly refused.
    for (const accept of ['application/json', 'text/event-stream']) {
      const request = new Request('https://memory.example/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept, 'mcp-method': 'initialize' },
        body: JSON.stringify(initialize({})),
      })
      const response = await handleMCPHttpRequest(makeEnv(), request, FULL_PROFILE, '/mcp')
      expect(response.status, `accept: ${accept}`).toBe(406)
    }
  })

  it('accepts a client declaring the MCP Apps extension', async () => {
    const { payload } = await post(initialize(UI_CAPABILITY))
    expect(payload.result?.capabilities).toBeDefined()
  })

  it('reads client capabilities from the 2026-07-28 per-request envelope', async () => {
    // On the modern revision there is no handshake to remember: capabilities
    // ride along on every request, which is what makes stateless negotiation
    // possible at all.
    const { payload } = await post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': UI_CAPABILITY,
        },
      },
    })

    const tools = payload.result?.tools
    expect(Array.isArray(tools)).toBe(true)
    const getMemory = tools.find((t: any) => t.name === 'get_memory')
    expect(getMemory._meta?.ui?.resourceUri).toBe('ui://memory-editor')
  })

  it('drops ui metadata for a modern client with no UI extension', async () => {
    const { payload } = await post({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    })

    const tools = payload.result?.tools
    for (const tool of tools) {
      expect(tool._meta?.ui, `${tool.name} should carry no ui metadata`).toBeUndefined()
    }
    expect(tools.map((t: any) => t.name)).toContain('get_memory')
  })

  it('serves the tools-only surface on its own route', async () => {
    const { payload } = await post(
      { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} },
      { profile: TOOLS_ONLY_PROFILE, route: '/mcp/tools-only' }
    )
    const names = payload.result?.tools.map((t: any) => t.name)
    expect(names).toContain('read_memory_resource')
    expect(names).toContain('get_workflow')
  })
})
