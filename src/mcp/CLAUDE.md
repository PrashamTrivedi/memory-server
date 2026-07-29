# MCP Implementation

Model Context Protocol implementation built on `@modelcontextprotocol/server`
(v2) and served through the stateless Workers handler from `agents/mcp/server`.

## Structure

- `server.ts` - MCP server setup, tool/resource/prompt registration, HTTP entry
- `capabilities.ts` - Client profile + MCP Apps capability negotiation
- `tools/` - Tool handlers (memory.ts, search.ts, tags.ts)
- `resources/` - Resource handlers for `memory://` URIs
- `prompts/` - Workflow prompt definitions
- `utils/` - MCP response formatters

## Protocol

The endpoint serves the **2026-07-28** revision and, through the handler's
legacy fallback, the 2025-era revisions that most shipping clients still speak.
Both are served from the same registration code — there is no separate legacy
path to maintain.

On 2026-07-28 there is no `initialize` handshake and no session: the client's
protocol version and capabilities ride on every request in `_meta`. That is what
makes per-request capability negotiation possible on a stateless Worker.

Two behaviours differ from the previous `enableJsonResponse: true` transport:

- Clients must accept **both** `application/json` and `text/event-stream`;
  a single-encoding `Accept` header now gets a `406`.
- 2026-07-28 requests must declare their method in an `Mcp-Method` header, and
  `tools/call` must additionally name the tool in an `Mcp-Name` header. Both
  have to agree with the body or the request is rejected with `-32020`
  (SEP-2243). Conformant client SDKs set these; hand-rolled `curl` calls do not.

Probing the deployed endpoint by hand therefore looks like:

```bash
curl -X POST "$HOST/mcp" \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'mcp-method: tools/call' -H 'mcp-name: list_tags' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
        "name":"list_tags","arguments":{},
        "_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28",
                 "io.modelcontextprotocol/clientCapabilities":{}}}}'
```

## Endpoints

| Route | Surface |
|-------|---------|
| `/mcp` | Tools + resources + prompts. MCP Apps negotiated per client. |
| `/mcp/tools-only` | Tools only; resources and prompts reprojected as tools. |

### Why two routes

MCP Apps support **is** negotiable — clients declare the
`io.modelcontextprotocol/ui` extension, so `server.ts` detects it and omits UI
metadata and `ui://` resources when it is absent.

Resource and prompt *consumption* is **not** negotiable. `ClientCapabilities`
describes what a client offers the server (roots, sampling, elicitation); no
revision through 2026-07-28 carries a "will consume resources/prompts" flag, and
the spec warns against branching on the self-reported `clientInfo.name`. Hosts
that ignore those primitives (Cursor, Gemini CLI at time of writing) therefore
select the tools-only surface by URL.

Nothing is lost on that route: `list_memory_resources` / `read_memory_resource`
and `list_workflows` / `get_workflow` delegate to the same handlers the native
resources and prompts use, so the two surfaces cannot drift.

## Response Pattern

Tools return a **triple-format** response from `createDualFormatResponse`:

1. **Markdown** - human/AI readable
2. **JSON text block** - retained for hosts that parse content blocks
3. **`structuredContent`** - machine-readable, for hosts that support it

The MCP Apps bundles locate the JSON block by content pattern because some hosts
strip the (non-spec) `mimeType` from text blocks; `structuredContent` is the
supported replacement for that heuristic.

## Adding New Tools

1. Create a handler in `tools/` returning `createDualFormatResponse(...)`
2. Register it in `server.ts` with `server.registerTool`, a Zod **object**
   schema, a `title`, and `annotations`
3. Add the name to `MEMORY_TOOL_NAMES` — a protocol test asserts it matches
   what `tools/list` returns

Annotations matter: `destructiveHint: true` is what makes a conformant host
prompt for confirmation before an irreversible call.

## Tool Categories

- Memory CRUD: add_memory, get_memory, list_memories, delete_memory, update_memory
- Search: find_memories, add_tags (supports hierarchical tags and temporary memories)
- Lifecycle: promote_memory, review_temporary_memories
- Maintenance: update_url_content
- Tag Management: list_tags, rename_tag, merge_tags, set_tag_parent
- Fallbacks (tools-only route): list_memory_resources, read_memory_resource,
  list_workflows, get_workflow

## Resources

| URI | Notes |
|-----|-------|
| `memory://list` | Static; JSON index of all memories |
| `memory://{id}` | Template; individual memory (also enumerated in `resources/list`) |
| `memory://{id}/text` | Template; plain-text content |

These are registered with `ResourceTemplate`. They were previously registered as
the literal strings `memory://*` and `memory://*/text`, which the SDK treats as
*static* URIs matched by exact string equality — so no real memory ID ever
resolved.

## MCP Apps (UI Resources)

Interactive UIs served via `ui://` for hosts that declare the MCP Apps
extension:

| Resource | Description | Related Tools |
|----------|-------------|---------------|
| `ui://memory-browser` | Browse/filter memories with bulk actions | find_memories, list_memories |
| `ui://memory-editor` | Markdown editor with live preview | get_memory, update_memory |
| `ui://triage-dashboard` | Temp memory review with urgency indicators | review_temporary_memories, promote_memory |
| `ui://tag-manager` | Hierarchical tag tree with merge/rename | list_tags, rename_tag, merge_tags |

Apps are built with Preact, bundled as single-file HTML via
vite-plugin-singlefile, and stored in MCP_APPS_KV. The `mcp-apps/` bundles keep
using `@modelcontextprotocol/ext-apps` for the in-iframe client; the server side
needs only the small amount of `_meta` normalisation in `capabilities.ts`.

### Deploying Apps

```bash
cd mcp-apps && npm run build
./scripts/deploy-mcp-apps.sh
```

## Tests

`tests/integration/mcpProtocol.test.ts` and `mcpNegotiation.test.ts` drive a
real MCP client / real HTTP requests rather than calling handlers directly.
Prefer adding to those over handler-level tests: registration bugs (a resource
under an unaddressable URI, a missing annotation) are invisible at the handler
level.
