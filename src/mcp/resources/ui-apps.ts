import type { Env } from '../../index';

// MCP App configurations
interface McpAppConfig {
  name: string;
  description: string;
  uri: string;
  relatedTools: string[];
}

export const mcpApps: McpAppConfig[] = [
  {
    name: 'Memory Browser',
    description: 'Browse and manage memories with filtering, bulk operations, and preview',
    uri: 'ui://memory-browser',
    relatedTools: ['find_memories', 'list_memories', 'delete_memory', 'add_tags'],
  },
  {
    name: 'Memory Editor',
    description: 'Edit memories with side-by-side markdown preview and inline tag management',
    uri: 'ui://memory-editor',
    relatedTools: ['get_memory', 'update_memory'],
  },
  {
    name: 'Triage Dashboard',
    description: 'Review and manage temporary memories with urgency indicators and batch actions',
    uri: 'ui://triage-dashboard',
    relatedTools: ['review_temporary_memories', 'promote_memory', 'delete_memory'],
  },
  {
    name: 'Tag Manager',
    description: 'Manage tags with hierarchical tree view, merge, rename, and organization',
    uri: 'ui://tag-manager',
    relatedTools: ['list_tags', 'rename_tag', 'merge_tags', 'set_tag_parent', 'add_tags'],
  },
];

// Resource type definition
interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Handle UI app resource requests
 * Returns the bundled HTML for the requested MCP app
 */
export async function handleUiAppResource(env: Env, uri: string): Promise<any> {
  try {
    // Parse app name from URI (ui://app-name)
    const match = uri.match(/^ui:\/\/(.+)$/);
    if (!match) {
      throw new Error('Invalid UI URI format. Expected: ui://app-name');
    }

    const appName = match[1];

    // Validate app exists
    const appConfig = mcpApps.find(app => app.uri === uri);
    if (!appConfig) {
      throw new Error(`Unknown MCP app: ${appName}. Available apps: ${mcpApps.map(a => a.uri).join(', ')}`);
    }

    // Check KV cache for the bundled HTML
    const kvKey = `mcp-app:${appName}`;
    let bundleHtml = await env.MCP_APPS_KV?.get(kvKey);

    if (!bundleHtml) {
      // In development/testing, return a placeholder
      // In production, this should be pre-populated via deployment script
      bundleHtml = generatePlaceholderHtml(appConfig);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/html',
          text: bundleHtml,
        }
      ]
    };

  } catch (error) {
    throw new Error(`Failed to handle UI app resource: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List available UI app resources
 */
export function listUiAppResources(): Resource[] {
  return mcpApps.map(app => ({
    uri: app.uri,
    name: app.name,
    description: app.description,
    mimeType: 'text/html',
  }));
}

/**
 * Get tool-to-UI mapping for a given tool name
 */
export function getUiAppForTool(toolName: string): McpAppConfig | undefined {
  return mcpApps.find(app => app.relatedTools.includes(toolName));
}

/**
 * Generate placeholder HTML for development
 */
function generatePlaceholderHtml(app: McpAppConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${app.name}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
      color: #333;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    h1 { color: #1a1a1a; margin-bottom: 0.5rem; }
    p { color: #666; }
    .tools { margin-top: 1rem; font-size: 0.875rem; color: #888; }
    .tools code { background: #eee; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${app.name}</h1>
    <p>${app.description}</p>
    <p class="tools">
      Related tools: ${app.relatedTools.map(t => `<code>${t}</code>`).join(', ')}
    </p>
    <p style="margin-top: 1.5rem; font-size: 0.875rem; color: #999;">
      App bundle not deployed. Run build and deploy scripts.
    </p>
  </div>
</body>
</html>`;
}
