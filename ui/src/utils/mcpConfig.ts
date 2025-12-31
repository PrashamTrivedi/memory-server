/**
 * MCP Configuration Utilities
 * Generate MCP server configuration for Claude Code integration
 */

/**
 * Get the server URL (origin) for MCP configuration
 */
export function getServerUrl(): string {
  return window.location.origin;
}

/**
 * Generate MCP configuration JSON object
 */
export function generateMcpConfig(serverUrl: string, apiKey: string): object {
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
 * Redact API key for display
 * msk_abc123... -> msk_****...****
 */
export function redactApiKey(key: string): string {
  const prefix = key.slice(0, 4);
  return `${prefix}****...****`;
}
