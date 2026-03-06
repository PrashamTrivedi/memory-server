# Backend Source

Hono app entry point is `index.ts`. All routes defined there.

## Directory Layout

- `handlers/` - HTTP request handlers (memory CRUD, tags, API keys, skills, MCP apps admin)
- `services/` - Business logic (temporary memory lifecycle, tag hierarchy operations)
- `mcp/` - MCP server implementation (separate CLAUDE.md)
- `middleware/` - Auth middleware (dualAuth.ts, apiKeyAuth.ts)
- `oauth/` - OAuth 2.0 flow (handlers, metadata discovery, HTML templates)
- `errors/` - Custom error classes (memoryErrors.ts, tagHierarchyErrors.ts)
- `utils/` - Response formatting, email utilities
- `skills/` - Skill package template generation

## Patterns

- Handlers receive Hono context `c`, access bindings via `c.env`
- Auth middleware (`dualAuth`) applied to all API routes; localhost bypasses auth in dev
- Services encapsulate complex logic (TTL promotion, hierarchy validation)
- Custom error classes thrown from services/handlers, caught at route level
