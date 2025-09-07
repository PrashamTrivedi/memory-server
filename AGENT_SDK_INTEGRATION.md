# Cloudflare Agent SDK Integration

This document describes the Cloudflare Agent SDK integration implemented in the memory-server MCP implementation.

## Overview

The memory-server now includes enhanced support for Cloudflare's Agent SDK while maintaining full backward compatibility with standard MCP clients. The implementation focuses on HTTP Streamable transport as specified in your requirements.

## Key Features

### ✅ Agent SDK Enhancements

1. **Session Management**
   - Agent session tracking with auto-cleanup
   - Session-based connection reuse
   - Configurable session timeouts (1 hour default)

2. **Batch Operations**
   - Support for batch JSON-RPC requests
   - Parallel processing for improved performance
   - Configurable batch size limits (max 10 requests)

3. **Enhanced Transport**
   - Agent-specific HTTP headers support
   - Enhanced CORS configuration for agents
   - Session ID management and tracking

4. **Capability Negotiation**
   - Dynamic capability discovery
   - Client-server capability matching
   - Feature negotiation support

## New Endpoints

### Agent Discovery & Configuration

- `GET /mcp` - Enhanced server discovery with agent capabilities
- `GET /mcp/agent/capabilities` - Detailed capability information
- `GET /mcp/agent/config` - Configuration and resource limits
- `GET /mcp/health` - Health check with Agent SDK status

### MCP Operations (Enhanced)

- `POST /mcp` - Main MCP endpoint with batch support
- All standard MCP operations: tools, resources, prompts

## Agent-Specific Headers

### Request Headers
- `x-agent-id` - Agent identifier
- `x-agent-version` - Agent version
- `x-agent-capabilities` - Comma-separated capabilities
- `mcp-session-id` - Session identifier

### Response Headers
- `mcp-session-id` - Session identifier
- `x-agent-session-id` - Agent session identifier
- `x-batch-size` - Batch operation size

## Tools, Resources & Prompts

### ✅ Fully Exposed Tools (7 total)
1. `add_memory` - Add new memories with URL content fetching
2. `get_memory` - Retrieve specific memory by ID
3. `list_memories` - List memories with pagination/filtering
4. `delete_memory` - Delete memory by ID
5. `find_memories` - Advanced search with content/tag filtering
6. `add_tags` - Add tags to existing memories
7. `update_url_content` - Refresh URL-based memory content

### ✅ Resources Exposed
- `memory://list` - List of all available memories
- `memory://{id}` - Individual memory resources
- `memory://{id}/text` - Memory content as plain text

### ✅ Workflow Prompts (4 total)
1. `memory_capture_workflow` - Complete content capture workflow
2. `knowledge_discovery_workflow` - Multi-step knowledge discovery
3. `content_maintenance_workflow` - Content maintenance and refresh
4. `research_session_workflow` - Systematic research sessions

## Configuration

### Resource Limits
- Maximum memory size: 10MB
- Maximum batch size: 10 requests
- Session timeout: 1 hour
- Tool calls per minute: 100
- Concurrent tool calls: 5

### Caching
- KV cache enabled with 5-minute TTL
- Resource caching for improved performance
- URL content caching (5 days)

## Implementation Details

### Transport Layer
- **File**: `src/mcp/transport/streamableHttp.ts`
- Enhanced `CloudflareStreamableHttpTransport` class
- Agent session management
- Batch request processing
- Capability negotiation

### Main Application
- **File**: `src/index.ts`
- Agent SDK endpoint routing
- Enhanced health checks
- CORS configuration for agents

## Testing

Run the Agent SDK test suite:
```bash
node test-agent-mcp.js
```

## Backward Compatibility

✅ **Fully Maintained**
- All existing MCP tools work unchanged
- Standard MCP protocol compliance (JSON-RPC 2.0)
- Existing resource and prompt systems intact
- No breaking changes for current implementations

## Usage Example

### Basic MCP Request
```javascript
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

### Agent SDK Enhanced Request
```javascript
POST /mcp
Content-Type: application/json
x-agent-id: my-agent
x-agent-version: 1.0.0
x-agent-capabilities: batch-requests,streaming

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "add_memory",
    "arguments": {
      "name": "Important Note",
      "content": "This is a test memory",
      "tags": ["test", "example"]
    }
  },
  "id": 1
}
```

### Batch Request
```javascript
POST /mcp
Content-Type: application/json
x-agent-id: my-agent

[
  {
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  },
  {
    "jsonrpc": "2.0",
    "method": "resources/list",
    "id": 2
  }
]
```

## Architecture Benefits

1. **No Authorization Required** - As requested, perfect for testing phase
2. **HTTP Streamable Only** - No SSE/STDIO complexity
3. **Resource & Prompt Exposure** - Both directly and indirectly available
4. **Performance Optimized** - Caching, batching, session reuse
5. **Agent-Friendly** - Enhanced headers, discovery, configuration

## Next Steps

The implementation is ready for Cloudflare Agent SDK integration. The memory-server now provides:

- ✅ Enhanced HTTP Streamable transport
- ✅ Agent session management
- ✅ Batch operation support
- ✅ Capability negotiation
- ✅ Full MCP compliance
- ✅ Tools, resources, and prompts fully exposed
- ✅ No authorization required
- ✅ Backward compatibility maintained

Your memory-server is now optimized for Cloudflare Agent SDK while maintaining all existing functionality.