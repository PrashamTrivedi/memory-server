# MCP Implementation

MCP server using `@modelcontextprotocol/sdk` with HTTP transport on Cloudflare Workers.

## Structure

- `server.ts` - Server setup, tool/resource/prompt registration
- `tools/` - Tool handlers (memory.ts, search.ts, tags.ts)
- `resources/` - Resource handlers (`memory://` and `ui://` URIs)
- `prompts/` - Workflow prompt definitions
- `utils/` - Response formatters for dual-format output
- `transport/` - HTTP transport adapter for Workers

## Adding New Tools

1. Create handler in `tools/` returning dual-format response (Markdown + JSON)
2. Register in `server.ts` with Zod schema for input validation
3. Use formatters from `utils/` for consistent responses

## Tool Categories

- **Memory CRUD**: add_memory, get_memory, list_memories, delete_memory, update_memory
- **Search**: find_memories, add_tags (hierarchical tags, temporary memories)
- **Lifecycle**: promote_memory, review_temporary_memories
- **Maintenance**: update_url_content
- **Tags**: list_tags, rename_tag, merge_tags, set_tag_parent
