/**
 * Claude Code Skill Templates
 *
 * Generates SKILL.md and mcp.json content for downloadable skill packages.
 */

/**
 * Generate SKILL.md content with server URL
 */
export function generateSkillMd(serverUrl: string): string {
  return `---
name: memory-server
description: Personal knowledge base for storing code, architecture decisions,
  and research findings. Use when user says "remember this", "save to memory",
  "find in memory", "what did I learn about". Supports hierarchical tags.
---

# Memory Server

Your personal knowledge base at: ${serverUrl}

## Usage

### Save Information
- "Remember this code snippet about React hooks"
- "Save to memory with tags cloudflare>workers, typescript"
- "Store this API documentation"

### Search & Retrieve
- "What did I save about Durable Objects?"
- "Find my notes on MCP transport"
- "List memories tagged with architecture"

## Available Tools

| Tool | Description |
|------|-------------|
| \`add_memory\` | Save new memory with name, content, optional URL and tags |
| \`find_memories\` | Search by query text and/or filter by tags |
| \`list_memories\` | Browse all memories with pagination |
| \`get_memory\` | Retrieve specific memory by ID |
| \`add_tags\` | Add tags to existing memory |
| \`delete_memory\` | Remove a memory |
| \`update_url_content\` | Refresh content from URL source |

## Tagging System

Use hierarchical tags for better organization:

\`\`\`
parent>child format:
- cloudflare>workers
- cloudflare>d1
- mcp>transport
- mcp>tools
- programming>typescript
- architecture>sop
\`\`\`

## Examples

### Save a Code Snippet
\`\`\`
"Remember this Hono middleware pattern with tags hono, middleware, cloudflare>workers"
\`\`\`

### Research Session
\`\`\`
"What do I have saved about WebSocket implementation?"
"Save this new finding with tags real-time, websockets, durable-objects"
\`\`\`
`;
}

/**
 * Generate mcp.json configuration object
 */
export function generateMcpJson(serverUrl: string, apiKey: string): object {
  return {
    mcpServers: {
      'memory-server': {
        transport: 'streamable-http',
        url: `${serverUrl}/mcp`,
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    }
  };
}

/**
 * Generate redacted mcp.json for display (key hidden)
 */
export function generateMcpJsonRedacted(serverUrl: string, redactedKey: string): object {
  return {
    mcpServers: {
      'memory-server': {
        transport: 'streamable-http',
        url: `${serverUrl}/mcp`,
        headers: {
          Authorization: `Bearer ${redactedKey}`
        }
      }
    }
  };
}

/**
 * Get installation steps for the skill package
 */
export function getInstallationSteps(): string[] {
  return [
    'Extract the downloaded ZIP file',
    'Copy memory-skill folder to ~/.config/claude/skills/',
    'Merge mcp.json into ~/.config/claude/claude_desktop_config.json',
    'Restart Claude Code or Claude Desktop',
    "Test with: 'Save a test note to memory'"
  ];
}

/**
 * Redact API key for display purposes
 * msk_abc123def456... → msk_****...****
 */
export function redactApiKey(key: string): string {
  if (!key || key.length < 8) {
    return '****';
  }
  const prefix = key.slice(0, 4);
  return `${prefix}****...****`;
}

/**
 * Generate skill-bound key name
 */
export function generateSkillKeyName(entityName: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sanitizedName = entityName.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 20);
  return `skill-${sanitizedName}-${timestamp}`;
}
