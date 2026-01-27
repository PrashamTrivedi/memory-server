# MCP Implementation

Model Context Protocol implementation using `@modelcontextprotocol/sdk`.

## Structure

- `server.ts` - MCP server setup, tool/resource/prompt registration
- `tools/` - Tool handlers (memory.ts, search.ts)
- `resources/` - Resource handlers for `memory://` URIs
- `prompts/` - Workflow prompt definitions
- `utils/` - MCP response formatters

## Response Pattern

All MCP tools return **dual-format responses**:
1. **Markdown** - Human/AI readable with headers, metadata
2. **JSON** - Machine-parsable with full data structure

Use formatters from `utils/` to generate consistent responses.

## Adding New Tools

1. Create handler in `tools/` that returns dual-format response
2. Register in `server.ts` with Zod schema for input validation
3. Follow existing patterns for error handling

## Tool Categories

- Memory CRUD: add_memory, get_memory, list_memories, delete_memory, update_memory
- Search: find_memories, add_tags (supports hierarchical tags and temporary memories)
- Lifecycle: promote_memory, review_temporary_memories
- Maintenance: update_url_content
- Tag Management: list_tags, rename_tag, merge_tags, set_tag_parent

## MCP Apps (UI Resources)

Interactive UIs served via `ui://` scheme for hosts that support MCP Apps:

| Resource | Description | Related Tools |
|----------|-------------|---------------|
| `ui://memory-browser` | Browse/filter memories with bulk actions | find_memories, list_memories |
| `ui://memory-editor` | Markdown editor with live preview | get_memory, update_memory |
| `ui://triage-dashboard` | Temp memory review with urgency indicators | review_temporary_memories, promote_memory |
| `ui://tag-manager` | Hierarchical tag tree with merge/rename | list_tags, rename_tag, merge_tags |

Apps are built with Preact, bundled as single-file HTML via vite-plugin-singlefile, and stored in MCP_APPS_KV.

### Deploying Apps

```bash
cd mcp-apps && npm run build
./scripts/deploy-mcp-apps.sh
```
