/**
 * Claude Code Skill Templates
 *
 * Helper functions for skill package generation.
 * Templates are stored in R2 bucket (SKILL_TEMPLATES).
 */

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
