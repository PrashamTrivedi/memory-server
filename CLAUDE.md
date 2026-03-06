# Memory Server

Cloudflare Workers app using Hono framework with MCP (Model Context Protocol) support, D1 database, and KV storage.

## Commands

- `npm run dev` - Local dev server (wrangler)
- `npm run build` - Build (dry-run deploy)
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run test` - Run tests (vitest, watch mode)
- `npm run test:run` - Run tests once
- `npm run type-check` - TypeScript check
- `npm run db:migrate` - Apply D1 migrations
- `npm run cf-typegen` - Regenerate worker types

## Tech Stack

- **Runtime**: Cloudflare Workers (ES2022, nodejs_compat)
- **Framework**: Hono
- **Database**: D1 (SQLite) with FTS5 full-text search
- **Storage**: KV (cache, temp memories, MCP app bundles), R2 (skill templates)
- **Auth**: Dual auth - API keys (`msk_` prefix, SHA-256 hashed) + OAuth 2.0/JWT
- **Validation**: Zod schemas
- **MCP SDK**: `@modelcontextprotocol/sdk`

## Project Structure

- `src/` - Backend source (Hono routes, handlers, services, MCP server)
- `ui/` - React admin interface (separate Vite app, deployed as Worker)
- `mcp-apps/` - Preact interactive UIs served via MCP Apps protocol
- `migrations/` - D1 SQL migrations
- `tests/` - Vitest integration tests
- `types/` - Shared TypeScript types (Env bindings)

## Key Patterns

- **Dual-format responses**: All MCP tools return both Markdown (human-readable) and JSON (machine-parsable)
- **Temporary memory lifecycle**: Stage 1 (14d TTL, 5 accesses) -> Stage 2 (28d TTL, 15 accesses) -> Permanent (D1)
- **Hierarchical tags**: Use `parent>child` format, auto-creates hierarchy with circular reference prevention
- **Error classes**: Custom errors in `src/errors/` for memories and tag hierarchy

## Bindings (wrangler.jsonc)

- `DB` - D1 database
- `CACHE_KV` - URL content cache (5-day TTL)
- `TEMP_MEMORIES_KV` - Temporary memory storage
- `MCP_APPS_KV` - MCP app HTML bundles
- `BROWSER` - Browser rendering for URL fetching
- `SKILL_TEMPLATES` - R2 bucket for skill packages
- `API_RATE_LIMITER` / `MCP_RATE_LIMITER` - Rate limiting
