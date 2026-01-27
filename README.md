# Memory Server with MCP Support

A developer memory server hosted on Cloudflare with comprehensive Model Context
Protocol (MCP) support. Store, search, and manage development notes, URLs, and
code snippets with intelligent tagging and retrieval.

## Features

- 🧠 **Intelligent Memory Management** - Store and retrieve development
  knowledge
- 🏷️ **Smart Hierarchical Tagging** - Parent-child tag relationships with auto-creation
- 🔍 **Advanced Search** - Full-text search across memories and tags
- 🌐 **URL Content Fetching** - Automatically fetch and store web content
- 🤖 **MCP Integration** - Full Model Context Protocol support for AI tools
- 📦 **Claude Code Skill Download** - One-click skill package with pre-configured MCP setup
- ⚡ **Cloudflare Workers** - Fast, globally distributed hosting
- 🗄️ **D1 Database** - Serverless SQL storage
- 🔄 **Real-time Sync** - KV cache for performance
- 🎯 **Workflow Prompts** - Pre-built AI workflows for memory management
- ⏳ **Temporary Memories** - TTL-based memories that auto-promote with repeated access
- 🖼️ **MCP Apps** - Interactive UIs for memory browsing, editing, triage, and tag management

## Hierarchical Tagging System

Create and manage parent-child tag relationships for better organization:

### Hierarchical Tag Format

Use the `parent>child` format when adding tags to memories:

```bash
# Examples of hierarchical tags
"programming>javascript"     # javascript is a child of programming
"frontend>react"            # react is a child of frontend  
"database>postgresql"       # postgresql is a child of database
```

### Creating Tag Hierarchies

**Via Memory Creation:**
```json
{
  "name": "React Hooks Guide",
  "content": "Comprehensive guide to React hooks",
  "tags": ["programming>javascript", "frontend>react", "tutorial"]
}
```

**Via Direct API:**
```bash
POST /api/tags/create-with-parent
{
  "child_tag_name": "javascript", 
  "parent_tag_name": "programming"
}
```

### Smart Tag Creation Rules

- **Both tags exist**: Returns error to prevent disrupting existing relationships
- **One tag exists**: Creates the missing tag and establishes relationship
- **Neither tag exists**: Creates both tags and establishes relationship
- **Automatic validation**: Prevents circular references and self-references

### Benefits

- **Automatic Organization**: Tags are automatically organized in a hierarchy
- **Better Discovery**: Find related memories through parent-child relationships
- **Flexible Structure**: Mix hierarchical and simple tags as needed
- **Visual Tree View**: See your entire tag structure in the UI

## Temporary Memories

Temporary memories provide a stage-based lifecycle for memories that may not need permanent storage. They automatically expire if unused, but promote to permanent storage when accessed repeatedly. A dedicated review interface makes it easy to rescue important memories before they expire.

### Lifecycle Stages

Temporary memories progress through two stages with increasing TTL and access thresholds:

**Stage 1 (14-day TTL):**
- Initial stage when memory is created with `temporary: true`
- TTL: 14 days from last access
- Advancement threshold: 5 accesses
- Upon reaching 5 accesses, automatically advances to Stage 2

**Stage 2 (28-day TTL):**
- Extended stage after reaching 5 accesses
- TTL: 28 days from last access
- Auto-promotion threshold: 15 total accesses
- Upon reaching 15 total accesses, automatically promotes to permanent storage

### Lifecycle Metadata

Each temporary memory tracks:
- **access_count** - Total number of times the memory has been accessed
- **stage** - Current stage (1 or 2)
- **last_accessed** - Timestamp of most recent access
- **days_until_expiry** - Calculated based on TTL and last access time

### Key Behaviors

- **Transparent to Users**: Temporary status is hidden from API responses - temporary memories appear identical to permanent ones
- **Automatic Expiration**: Memories not accessed within TTL are automatically deleted by Cloudflare KV
- **Manual Promotion**: Use `POST /api/memories/:id/promote` or the `promote_memory` MCP tool to immediately promote a temporary memory

### Creating Temporary Memories

**Via REST API:**
```json
POST /api/memories
{
  "name": "Quick Note",
  "content": "This might not be important long-term",
  "tags": ["temporary", "notes"],
  "temporary": true
}
```

**Via MCP Tool:**
```json
{
  "name": "add_memory",
  "arguments": {
    "name": "Quick Note",
    "content": "This might not be important long-term",
    "tags": ["temporary", "notes"],
    "temporary": true
  }
}
```

### Promoting Temporary Memories

**Via REST API:**
```bash
POST /api/memories/:id/promote
```

**Via MCP Tool:**
```json
{
  "name": "promote_memory",
  "arguments": {
    "id": "memory-uuid-here"
  }
}
```

### Use Cases

- **Experimental Notes**: Store quick thoughts that may not be valuable long-term
- **Session Data**: Capture context that's only relevant for a short period
- **Draft Content**: Save work-in-progress that needs validation before permanent storage
- **Trial Information**: Test storing data before committing to permanent storage

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Wrangler CLI configured
- [MCP Inspector](https://modelcontextprotocol.io/inspector) or MCP-compatible
  client

### Installation

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd memory-server
   npm install
   ```

2. **Configure Cloudflare:**
   ```bash
   # Login to Cloudflare
   wrangler auth

   # Create D1 database
   wrangler d1 create memory-db

   # Create KV namespaces
   wrangler kv namespace create "CACHE_KV"
   wrangler kv namespace create "TEMP_MEMORIES_KV"
   wrangler kv namespace create "MCP_APPS_KV"

   # Run migrations
   npm run db:migrate
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Deploy to Cloudflare:**
   ```bash
   npm run deploy
   ```

## MCP Integration

This server provides full Model Context Protocol support, making it compatible
with Claude Desktop, MCP Inspector, and other MCP clients.

**Note:** This server currently runs without authentication - ensure you deploy it in a secure environment and consider adding authentication for production use.

### Response Format

All MCP tool responses are returned in a dual-format response pattern optimized for AI agent comprehension:

- **Markdown Format**: Human-readable formatted output for direct interpretation by AI agents and users
- **JSON Format**: Structured machine-parsable data for programmatic integration

This dual-format approach ensures that responses are both easily understood by language models and provide clean structured data for downstream processing.

#### Understanding Dual-Format Responses

Each MCP tool returns an MCP response containing two content items:

**Example Response Structure:**
```
MCP Response
├─ Content Item 1: Markdown Text
│  └─ Formatted for human/AI readability with headers, lists, metadata
└─ Content Item 2: JSON with MIME type
   └─ Complete structured data with full information density
```

**Markdown Benefits:**
- Clear visual hierarchy with formatted headers
- Content previews for better AI comprehension
- Pagination and result summaries for context
- Natural language formatting for agent interpretation

**JSON Benefits:**
- Complete data preservation (IDs, timestamps, pagination metadata)
- Enables downstream tool integration and data extraction
- Maintains strict data types and structures
- Supports programmatic processing

**Example Memory Response:**

Markdown (Human-readable):
```
# Memory: React Hooks Guide

Comprehensive guide to React hooks...

## Metadata
- **ID**: abc-123-def
- **Tags**: programming, javascript, react
- **URL**: https://react.dev/hooks
- **Updated**: Nov 06, 2025 14:30:45
```

JSON (Machine-parsable):
```json
{
  "success": true,
  "data": {
    "id": "abc-123-def",
    "name": "React Hooks Guide",
    "content": "Comprehensive guide...",
    "tags": ["programming", "javascript", "react"],
    "url": "https://react.dev/hooks",
    "created_at": 1730898645,
    "updated_at": 1730898645
  }
}
```

### Connection Setup

#### For Local Development

Connect your MCP client to:

```
http://localhost:8787/mcp
```

#### For Production Deployment

Connect your MCP client to:

```
https://your-worker-subdomain.your-subdomain.workers.dev/mcp
```

#### MCP Inspector Setup

1. Open [MCP Inspector](https://modelcontextprotocol.io/inspector)
2. Enter your server URL in the connection field
3. Click "Connect" - you should see green status indicators

### Available MCP Tools

The server exposes 14 memory management tools via MCP. All tools return responses in dual-format (Markdown + JSON) for optimal AI agent comprehension.

#### Core Memory Tools

**`add_memory`** - Create new memories with hierarchical tag support

```json
{
  "name": "My Development Note",
  "content": "Important information about React hooks",
  "url": "https://react.dev/hooks",
  "tags": ["programming>javascript", "frontend>react", "tutorial"],
  "temporary": false
}
```

*Supports hierarchical tags using "parent>child" format alongside simple tags. Set `temporary: true` to create a memory with TTL-based lifecycle.*

Response includes human-readable memory details in markdown and complete memory object with metadata in JSON format.

**`get_memory`** - Retrieve specific memory

```json
{
  "id": "memory-uuid-here"
}
```

**`list_memories`** - List all memories with pagination

```json
{
  "limit": 10,
  "offset": 0,
  "tags": ["react", "javascript"]
}
```

**`delete_memory`** - Remove memory

```json
{
  "id": "memory-uuid-here"
}
```

#### Advanced Tools

**`find_memories`** - Advanced search across memories

```json
{
  "query": "React hooks useState",
  "tags": ["react"],
  "limit": 5
}
```

Returns formatted search results with matching memories, search criteria summary, and pagination information in dual-format response.

**`update_url_content`** - Refresh URL content

```json
{
  "id": "memory-uuid-here"
}
```

**`add_tags`** - Add tags to existing memory with hierarchical support

```json
{
  "memoryId": "memory-uuid-here",
  "tags": ["tutorial", "beginner", "programming>javascript"]
}
```

*Supports both permanent and temporary memories. Tags can use hierarchical "parent>child" format - relationships are automatically created and both parent and child tags are assigned to the memory.*

**`update_memory`** - Update existing memory or create new (upsert)

```json
{
  "id": "memory-uuid-here",
  "name": "Updated Title",
  "content": "Updated content here",
  "tags": ["new-tag", "category>subcategory"]
}
```

*Updates an existing memory's name, content, or tags. If the ID is not found, creates a new memory (upsert behavior). Tags support hierarchical "parent>child" format.*

**`review_temporary_memories`** - Review temporary memories with lifecycle status

```json
{
  "limit": 50,
  "offset": 0
}
```

*Lists all temporary memories with their complete lifecycle metadata. Shows access count, current stage, last accessed time, and days until expiry. Perfect for reviewing and rescuing important memories before they expire. Includes pagination support.*

**`promote_memory`** - Promote temporary memory to permanent

```json
{
  "id": "memory-uuid-here"
}
```

*Immediately promotes a temporary memory to permanent storage without waiting for the auto-promotion threshold. Returns an error if the memory is already permanent or does not exist.*

#### Tag Management Tools

**`list_tags`** - List all tags with hierarchy and memory counts

```json
{}
```

*Returns a hierarchical view of all tags with their parent-child relationships and the number of memories associated with each tag.*

**`rename_tag`** - Rename an existing tag

```json
{
  "tagId": 42,
  "newName": "new-tag-name"
}
```

*Renames a tag while preserving all memory associations and hierarchy relationships.*

**`merge_tags`** - Merge one tag into another

```json
{
  "sourceTagId": 42,
  "targetTagId": 17
}
```

*Moves all memory associations from source tag to target tag, transfers child tags, then deletes the source tag.*

**`set_tag_parent`** - Set or remove parent-child relationship

```json
{
  "childTagId": 42,
  "parentTagId": 17
}
```

*Sets a parent tag for the specified child tag. Pass `null` for parentTagId to make it a root tag. Prevents circular hierarchies.*

### MCP Resources

Access memory data through resource URIs:

- **`memory://list`** - List all available memories with metadata
- **`memory://{id}`** - Get specific memory with full content and metadata
- **`memory://{id}/text`** - Get memory content as plain text

### MCP Apps (Interactive UIs)

For MCP hosts that support the Apps extension, four interactive UIs are available:

| Resource URI | Description |
|--------------|-------------|
| `ui://memory-browser` | Browse and filter memories with search, tag filtering, and bulk actions |
| `ui://memory-editor` | Markdown editor with live preview for creating/editing memories |
| `ui://triage-dashboard` | Review temporary memories with urgency indicators and quick promote/dismiss |
| `ui://tag-manager` | Visual tag hierarchy tree with rename, merge, and reparent operations |

Apps are built with Preact and Tailwind CSS, bundled as single-file HTML, and served from KV storage.

### Workflow Prompts

Pre-built AI workflow prompts for common memory management tasks:

#### `memory_capture_workflow`

Complete workflow for capturing web content with intelligent analysis and
tagging.

**Arguments:**

- `url` (required) - URL to capture
- `custom_title` (optional) - Custom title override
- `additional_context` (optional) - Extra context about the content
- `suggested_tags` (optional) - Comma-separated suggested tags

**Example usage:**

```json
{
  "name": "memory_capture_workflow",
  "arguments": {
    "url": "https://platform.openai.com/docs/api-reference",
    "custom_title": "OpenAI API Reference",
    "additional_context": "Official documentation for OpenAI's APIs",
    "suggested_tags": "openai,api,documentation"
  }
}
```

#### `knowledge_discovery_workflow`

Intelligent knowledge discovery across your memory collection.

**Arguments:**

- `initial_query` (required) - Starting search query
- `search_depth` (optional) - shallow, medium, or deep
- `focus_areas` (optional) - Specific areas to focus search
- `exclude_tags` (optional) - Tags to exclude from results

#### `content_maintenance_workflow`

Automated content maintenance and freshness checking.

**Arguments:**

- `maintenance_type` (required) - refresh_all, check_stale, or update_specific
- `max_age_days` (optional) - Maximum age before content is stale (default: 30)
- `specific_tags` (optional) - Only maintain memories with these tags
- `specific_memory_id` (optional) - Specific memory to update

#### `research_session_workflow`

Complete research session management with systematic exploration.

**Arguments:**

- `research_topic` (required) - Main research topic or question
- `research_goals` (optional) - Specific goals to achieve
- `prior_knowledge_tags` (optional) - Related existing knowledge tags
- `session_duration` (optional) - short, medium, or long session

### Example MCP Client Configurations

#### Claude Desktop (macOS/Windows)

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "memory-server": {
      "transport": "streamable-http",
      "url": "YOUR_DEPLOYMENT_URL/mcp"
    }
  }
}
```

#### VS Code with MCP Extension

1. Install an MCP-compatible extension
2. Add server connection: `YOUR_DEPLOYMENT_URL/mcp`

## Claude Code Skill Download

The Memory Server provides a convenient skill package download feature that allows Claude Code users to quickly set up the MCP integration with a pre-configured skill file and API key.

### Skill Package Generation

**Endpoint:** `POST /api/skills/generate`

**Authentication:** Required (Bearer token or session)

Generates a downloadable skill package containing:
- `memory-skill/SKILL.md` - Claude Code skill file with memory management instructions
- `memory-skill/mcp.json` - MCP server configuration with embedded API key

**Response Format:**

```json
{
  "success": true,
  "reused": false,
  "download_url": "/skills/download/{token}",
  "expires_in": 14400,
  "skill_key": {
    "id": "uuid-here",
    "entity_name": "skill-download-key",
    "created_at": 1735000000
  },
  "instructions": {
    "mcp_config_redacted": {
      "mcpServers": {
        "memory-server": {
          "type": "http",
          "url": "https://your-server.workers.dev/mcp",
          "headers": {
            "Authorization": "Bearer [REDACTED]"
          }
        }
      }
    },
    "steps": [
      "Download and extract the ZIP file",
      "Move the 'memory-skill' folder to your project root or ~/.claude/skills/",
      "The MCP configuration is included in mcp.json",
      "Claude Code will automatically detect and use the skill"
    ]
  }
}
```

**Behavior:**
- If a valid skill package was generated within the last 4 hours, the existing package is reused (`"reused": true`)
- New packages are generated when no recent package exists or the previous one has expired
- The download token is valid for 4 hours (14400 seconds)

### Skill Package Download

**Endpoint:** `GET /skills/download/:token`

**Authentication:** None required (the token serves as authentication)

Downloads the skill package as a ZIP file. The token is obtained from the generate endpoint response.

**Response:**
- Content-Type: `application/zip`
- Content-Disposition: `attachment; filename="memory-skill.zip"`

**ZIP Contents:**
```
memory-skill.zip
├── memory-skill/
│   ├── SKILL.md      # Claude Code skill instructions
│   └── mcp.json      # MCP configuration with API key
```

### Installation Steps

1. **Generate the skill package:**
   ```bash
   curl -X POST https://your-server.workers.dev/api/skills/generate \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -H "Content-Type: application/json"
   ```

2. **Download the package** using the URL from the response:
   ```bash
   curl -O https://your-server.workers.dev/skills/download/{token}
   ```

3. **Extract the ZIP file** to your preferred location:
   - Project-specific: Extract to your project root directory
   - Global: Extract to `~/.claude/skills/` for use across all projects

4. **Verify the setup:**
   - Claude Code will automatically detect the `memory-skill` folder
   - The MCP configuration in `mcp.json` includes your API key for authentication

### Security Notes

- Download tokens are single-use and expire after 4 hours
- Each skill package contains a unique API key tied to your account
- The API key in the package has limited scope for MCP operations only
- Regenerating a skill package will create a new API key

## API Endpoints

### REST API

All REST API endpoints support both JSON and Markdown response formats via content negotiation. Use the `Accept` header to specify your preferred format:

- `Accept: application/json` - Returns JSON (default)
- `Accept: text/markdown` - Returns formatted Markdown

**Example:**
```bash
# JSON Response (default)
curl http://localhost:8787/api/memories

# Markdown Response
curl http://localhost:8787/api/memories \
  -H "Accept: text/markdown"
```

#### Memory Management
- `GET /api/memories` - List memories
- `POST /api/memories` - Create memory (supports hierarchical tags and temporary flag)
- `GET /api/memories/{id}` - Get memory
- `PUT /api/memories/{id}` - Update memory (supports hierarchical tags)
- `DELETE /api/memories/{id}` - Delete memory
- `POST /api/memories/{id}/promote` - Promote temporary memory to permanent
- `GET /api/memories/temporary` - List temporary memories with lifecycle metadata (access count, stage, last accessed, days until expiry)
- `GET /api/memories/stats` - Get memory statistics
- `GET /api/memories/search` - Search memories

#### Tag Hierarchy Management
- `POST /api/tags/create-with-parent` - Create parent-child tag relationship
- `GET /api/tags/tree` - Get complete tag hierarchy tree
- `GET /api/tags/{id}/ancestors` - Get all ancestor tags
- `GET /api/tags/{id}/descendants` - Get all descendant tags
- `GET /api/tags/{id}/parents` - Get immediate parent tags
- `GET /api/tags/{id}/children` - Get immediate child tags
- `POST /api/tags/{id}/parent` - Add parent relationship
- `DELETE /api/tags/{id}/parent/{parentId}` - Remove parent relationship

#### Skill Package
- `POST /api/skills/generate` - Generate skill download package (requires auth)
- `GET /skills/download/:token` - Download skill package ZIP (token auth)

### Response Format Examples

#### JSON Format (Default)

```json
{
  "success": true,
  "data": {
    "id": "abc-123-def",
    "name": "React Hooks Guide",
    "content": "Comprehensive guide to React hooks...",
    "tags": ["programming", "javascript", "react"],
    "url": "https://react.dev/hooks",
    "created_at": 1730898645,
    "updated_at": 1730898645
  }
}
```

#### Markdown Format (Accept: text/markdown)

```markdown
# Memory: React Hooks Guide

Comprehensive guide to React hooks...

## Metadata
- **ID**: abc-123-def
- **Tags**: programming, javascript, react
- **URL**: https://react.dev/hooks
- **Created**: Nov 06, 2025 14:30:45
- **Updated**: Nov 06, 2025 14:30:45
```

The Markdown format provides a human-readable, AI-friendly representation of the data, while the JSON format maintains complete structured information. Both formats are backward compatible, with JSON remaining the default when no `Accept` header is specified.

### MCP Endpoint

- `ALL /mcp` - Model Context Protocol endpoint

### Health Check

- `GET /` - Server status and info

## Development

### Project Structure

```
src/
├── index.ts              # Main Hono application
├── handlers/             # HTTP request handlers
│   ├── memory.ts         # Memory CRUD operations
│   └── tagHierarchy.ts   # Tag management
├── services/             # Business logic services
│   ├── temporaryMemory.ts # Temporary memory TTL management
│   └── tagHierarchy.ts   # Tag hierarchy operations
├── mcp/                  # MCP implementation
│   ├── server.ts         # MCP server setup
│   ├── tools/            # MCP tool implementations
│   ├── resources/        # MCP resource handlers
│   ├── prompts/          # Workflow prompt definitions
│   └── transport/        # HTTP transport for Cloudflare Workers
└── types/                # TypeScript type definitions

mcp-apps/                 # MCP Apps (interactive UIs)
├── src/
│   ├── memory-browser/   # Memory browsing UI
│   ├── memory-editor/    # Markdown editor UI
│   ├── triage-dashboard/ # Temporary memory triage UI
│   ├── tag-manager/      # Tag hierarchy management UI
│   └── shared/           # Shared components and utilities
├── vite.config.ts        # Vite build config with single-file output
└── package.json          # Preact, Tailwind, vite-plugin-singlefile
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production (dry-run deploy)
npm run deploy       # Deploy to Cloudflare Workers
npm run db:migrate   # Run database migrations
npm run type-check   # TypeScript type checking
npm run test         # Run tests

# MCP Apps
cd mcp-apps && npm run build          # Build all MCP Apps
./scripts/deploy-mcp-apps.sh          # Deploy apps to KV storage
```

### Environment Variables

Configure in `wrangler.toml` or `wrangler.jsonc`:

```toml
[env.production.vars]
ENVIRONMENT = "production"

[[env.production.d1_databases]]
binding = "DB"
database_name = "memory-db"
database_id = "your-d1-database-id"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "your-cache-kv-namespace-id"

[[env.production.kv_namespaces]]
binding = "TEMP_MEMORIES_KV"
id = "your-temp-memories-kv-namespace-id"
```

**Note:** The `TEMP_MEMORIES_KV` namespace is required for the temporary memories feature. The `MCP_APPS_KV` namespace is required for serving MCP Apps. Create them with:
```bash
wrangler kv namespace create "TEMP_MEMORIES_KV"
wrangler kv namespace create "MCP_APPS_KV"
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details.

## Support

- 📚 [MCP Documentation](https://modelcontextprotocol.io)
- 🔧 [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- 🐛 [Report Issues](https://github.com/your-username/memory-server/issues)

---

**Ready to enhance your development workflow with intelligent memory management
and MCP integration!** 🚀
