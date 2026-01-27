import { Context } from 'hono';
import { Env } from '../../types';

// Valid MCP app names
const VALID_APP_NAMES = ['memory-browser', 'memory-editor', 'triage-dashboard', 'tag-manager'] as const;
type McpAppName = typeof VALID_APP_NAMES[number];

interface McpAppInfo {
  name: string;
  deployed: boolean;
  size?: number;
  updatedAt?: string;
}

interface KVMetadata {
  size: number;
  updatedAt: string;
}

function isValidAppName(name: string): name is McpAppName {
  return VALID_APP_NAMES.includes(name as McpAppName);
}

function isValidHtml(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

/**
 * List all MCP apps with deployment status
 * GET /api/admin/mcp-apps
 */
export async function listMcpApps(c: Context<{ Bindings: Env }>) {
  try {
    const kv = c.env.MCP_APPS_KV;

    if (!kv) {
      return c.json({
        success: false,
        error: 'MCP_APPS_KV binding not configured'
      }, 500);
    }

    const apps: McpAppInfo[] = await Promise.all(
      VALID_APP_NAMES.map(async (name) => {
        const result = await kv.getWithMetadata<KVMetadata>(`mcp-app:${name}`);

        if (result.value) {
          return {
            name,
            deployed: true,
            size: result.metadata?.size,
            updatedAt: result.metadata?.updatedAt
          };
        }

        return {
          name,
          deployed: false
        };
      })
    );

    return c.json({
      success: true,
      data: { apps }
    });
  } catch (error) {
    console.error('List MCP apps error:', error);
    return c.json({
      success: false,
      error: 'Failed to list MCP apps',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Get specific MCP app metadata
 * GET /api/admin/mcp-apps/:appName
 */
export async function getMcpAppMetadata(c: Context<{ Bindings: Env }>) {
  try {
    const appName = c.req.param('appName');

    if (!isValidAppName(appName)) {
      return c.json({
        success: false,
        error: 'Invalid app name'
      }, 400);
    }

    const kv = c.env.MCP_APPS_KV;

    if (!kv) {
      return c.json({
        success: false,
        error: 'MCP_APPS_KV binding not configured'
      }, 500);
    }

    const result = await kv.getWithMetadata<KVMetadata>(`mcp-app:${appName}`);

    if (!result.value) {
      return c.json({
        success: false,
        error: 'App not deployed'
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        name: appName,
        deployed: true,
        size: result.metadata?.size,
        updatedAt: result.metadata?.updatedAt
      }
    });
  } catch (error) {
    console.error('Get MCP app metadata error:', error);
    return c.json({
      success: false,
      error: 'Failed to get MCP app metadata',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Upload/replace MCP app bundle
 * PUT /api/admin/mcp-apps/:appName
 */
export async function uploadMcpApp(c: Context<{ Bindings: Env }>) {
  try {
    const appName = c.req.param('appName');

    if (!isValidAppName(appName)) {
      return c.json({
        success: false,
        error: 'Invalid app name'
      }, 400);
    }

    const kv = c.env.MCP_APPS_KV;

    if (!kv) {
      return c.json({
        success: false,
        error: 'MCP_APPS_KV binding not configured'
      }, 500);
    }

    const content = await c.req.text();

    if (!content || content.trim().length === 0) {
      return c.json({
        success: false,
        error: 'Bundle content is required'
      }, 400);
    }

    if (!isValidHtml(content)) {
      return c.json({
        success: false,
        error: 'Invalid HTML bundle'
      }, 400);
    }

    const size = new TextEncoder().encode(content).length;
    const updatedAt = new Date().toISOString();

    await kv.put(`mcp-app:${appName}`, content, {
      metadata: { size, updatedAt }
    });

    return c.json({
      success: true,
      data: { size, updatedAt }
    });
  } catch (error) {
    console.error('Upload MCP app error:', error);
    return c.json({
      success: false,
      error: 'Failed to upload MCP app',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

/**
 * Delete MCP app bundle
 * DELETE /api/admin/mcp-apps/:appName
 */
export async function deleteMcpApp(c: Context<{ Bindings: Env }>) {
  try {
    const appName = c.req.param('appName');

    if (!isValidAppName(appName)) {
      return c.json({
        success: false,
        error: 'Invalid app name'
      }, 400);
    }

    const kv = c.env.MCP_APPS_KV;

    if (!kv) {
      return c.json({
        success: false,
        error: 'MCP_APPS_KV binding not configured'
      }, 500);
    }

    // Check if app exists first
    const existing = await kv.get(`mcp-app:${appName}`);

    if (!existing) {
      return c.json({
        success: false,
        error: 'App not deployed'
      }, 404);
    }

    await kv.delete(`mcp-app:${appName}`);

    return c.json({
      success: true,
      message: `${appName} deleted successfully`
    });
  } catch (error) {
    console.error('Delete MCP app error:', error);
    return c.json({
      success: false,
      error: 'Failed to delete MCP app',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
