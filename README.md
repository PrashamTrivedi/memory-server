# Memory Server with MCP Support

A developer memory server hosted on Cloudflare with comprehensive Model Context Protocol (MCP) support. Store, search, and manage development notes, URLs, and code snippets with intelligent tagging and retrieval.

## Features

- 🧠 **Intelligent Memory Management** - Store and retrieve development knowledge
- 🏷️ **Smart Tagging** - Hierarchical tagging system with auto-suggestions  
- 🔍 **Advanced Search** - Full-text search across memories and tags
- 🌐 **URL Content Fetching** - Automatically fetch and store web content
- 🤖 **MCP Integration** - Full Model Context Protocol support for AI tools
- ⚡ **Cloudflare Workers** - Fast, globally distributed hosting
- 🗄️ **D1 Database** - Serverless SQL storage
- 🔄 **Real-time Sync** - KV cache for performance
- 🎯 **Workflow Prompts** - Pre-built AI workflows for memory management

## Quick Start

### Prerequisites

- Node.js 18+ 
- Cloudflare account with Wrangler CLI configured
- [MCP Inspector](https://modelcontextprotocol.io/inspector) or MCP-compatible client

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

   # Create KV namespace  
   wrangler kv namespace create "CACHE_KV"

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

This server provides full Model Context Protocol support, making it compatible with Claude Desktop, MCP Inspector, and other MCP clients.

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

The server exposes 7 memory management tools via MCP:

#### Core Memory Tools

**`add_memory`** - Create new memories
```json
{
  "name": "My Development Note",
  "content": "Important information about React hooks",
  "url": "https://react.dev/hooks", 
  "tags": ["react", "hooks", "frontend"]
}
```

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

**`update_url_content`** - Refresh URL content
```json
{
  "id": "memory-uuid-here"
}
```

**`add_tags`** - Add tags to existing memory
```json
{
  "memoryId": "memory-uuid-here",
  "tags": ["tutorial", "beginner"]
}
```

### MCP Resources

Access memory data through resource URIs:

- **`memory://list`** - List all available memories with metadata
- **`memory://{id}`** - Get specific memory with full content and metadata
- **`memory://{id}/text`** - Get memory content as plain text

### Workflow Prompts

Pre-built AI workflow prompts for common memory management tasks:

#### `memory_capture_workflow`
Complete workflow for capturing web content with intelligent analysis and tagging.

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
      "command": "node",
      "args": ["-e", "console.log('Connect to: YOUR_DEPLOYMENT_URL/mcp')"],
      "transport": "streamable-http",
      "url": "YOUR_DEPLOYMENT_URL/mcp"
    }
  }
}
```

#### VS Code with MCP Extension
1. Install an MCP-compatible extension
2. Add server connection: `YOUR_DEPLOYMENT_URL/mcp`
3. Configure authentication if needed

## API Endpoints

### REST API
- `GET /api/memories` - List memories
- `POST /api/memories` - Create memory  
- `GET /api/memories/{id}` - Get memory
- `PUT /api/memories/{id}` - Update memory
- `DELETE /api/memories/{id}` - Delete memory

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
├── mcp/                  # MCP implementation
│   ├── server.ts         # MCP server setup
│   ├── tools/            # MCP tool implementations
│   ├── resources/        # MCP resource handlers  
│   ├── prompts/          # Workflow prompt definitions
│   └── transport/        # HTTP transport for Cloudflare Workers
└── types/                # TypeScript type definitions
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production (dry-run deploy)
npm run deploy       # Deploy to Cloudflare Workers
npm run db:migrate   # Run database migrations
npm run type-check   # TypeScript type checking
npm run test         # Run tests
```

### Environment Variables
Configure in `wrangler.toml`:

```toml
[env.production.vars]
ENVIRONMENT = "production"

[[env.production.d1_databases]]
binding = "DB"
database_name = "memory-db"
database_id = "your-d1-database-id"

[[env.production.kv_namespaces]]
binding = "CACHE_KV" 
id = "your-kv-namespace-id"
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

**Ready to enhance your development workflow with intelligent memory management and MCP integration!** 🚀