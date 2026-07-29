import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as tagHierarchyHandlers from './handlers/tagHierarchy';
import * as memoryHandlers from './handlers/memory';
import * as apiKeyHandlers from './handlers/apiKeys';
import * as skillHandlers from './handlers/skills';
import * as mcpAppsAdminHandlers from './handlers/mcpAppsAdmin';
import { handleMCPHttpRequest, describeTools, FULL_PROFILE, TOOLS_ONLY_PROFILE } from './mcp/server';
import { getEntityName } from './middleware/apiKeyAuth';
import { dualAuth } from './middleware/dualAuth';
import { getProtectedResourceMetadata, getAuthorizationServerMetadata } from './oauth/metadata';
import { showAuthorizeForm, handleAuthorize, handleToken, handleClientRegistration } from './oauth/handlers';
import { Env } from '../types';

// Re-export Env for backward compatibility
export type { Env };

const app = new Hono<{ Bindings: Env }>();

// CORS configuration - restricted origins for security
app.use('/*', cors({
  origin: [
    'https://memory-server-ui.dev-286.workers.dev',
    'http://localhost:5173',
    'http://localhost:8788',
    'https://claude.ai',
    'https://claude.com',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600,
  credentials: true,
}));

// OAuth Discovery endpoints (no auth required)
// Resource-specific discovery (Claude Desktop requests this path)
app.get('/.well-known/oauth-protected-resource/mcp', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json(getProtectedResourceMetadata(baseUrl));
});

app.get('/.well-known/oauth-protected-resource', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json(getProtectedResourceMetadata(baseUrl));
});

app.get('/.well-known/oauth-authorization-server', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json(getAuthorizationServerMetadata(baseUrl));
});

// OAuth flow endpoints (no auth required)
app.get('/oauth/authorize', showAuthorizeForm);
app.post('/oauth/authorize', handleAuthorize);
app.post('/oauth/token', handleToken);
app.post('/oauth/register', handleClientRegistration);

// Skill download endpoint (no auth required - token is the auth)
app.get('/skills/download/:token', skillHandlers.downloadSkillPackage);

// Apply authentication to API and MCP routes (supports both API Key and JWT)
app.use('/api/*', dualAuth);
// Listed explicitly rather than as '/mcp/*' so that the public '/mcp/health'
// probe stays unauthenticated.
app.use('/mcp', dualAuth);
app.use('/mcp/tools-only', dualAuth);

// Apply rate limiting to API routes
app.use('/api/*', async (c, next) => {
  const entityName = getEntityName(c);
  const { success } = await c.env.API_RATE_LIMITER.limit({
    key: entityName
  });

  if (!success) {
    return c.json({
      success: false,
      error: 'Rate limit exceeded'
    }, 429);
  }

  await next();
});

// Apply rate limiting to MCP routes
const mcpRateLimit = async (c: any, next: any) => {
  const entityName = getEntityName(c);
  const { success } = await c.env.MCP_RATE_LIMITER.limit({
    key: entityName
  });

  if (!success) {
    return c.json({
      success: false,
      error: 'Rate limit exceeded'
    }, 429);
  }

  await next();
};

app.use('/mcp', mcpRateLimit);
app.use('/mcp/tools-only', mcpRateLimit);

// Health check endpoint (no auth required)
app.get('/health', (c) => {
  return c.json({
    message: 'Memory Server API',
    version: '1.0.0',
    status: 'healthy'
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Memory Server API',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      api: '/api/*',
      mcp: '/mcp',
      health: '/health'
    }
  });
});

// Tag Hierarchy API endpoints
app.post('/api/tags/create-with-parent', tagHierarchyHandlers.createTagsWithRelationship);
app.post('/api/tags/:id/parent', tagHierarchyHandlers.addParent);
app.delete('/api/tags/:id/parent/:parentId', tagHierarchyHandlers.removeParent);
app.get('/api/tags/:id/ancestors', tagHierarchyHandlers.getAncestors);
app.get('/api/tags/:id/descendants', tagHierarchyHandlers.getDescendants);
app.get('/api/tags/:id/parents', tagHierarchyHandlers.getImmediateParents);
app.get('/api/tags/:id/children', tagHierarchyHandlers.getImmediateChildren);
app.get('/api/tags/tree', tagHierarchyHandlers.getTagTree);

// Memory API endpoints
app.post('/api/memories', memoryHandlers.createMemory);
app.get('/api/memories', memoryHandlers.listMemories);
app.get('/api/memories/stats', memoryHandlers.getMemoryStats);
app.get('/api/memories/search', memoryHandlers.findMemories);
app.get('/api/memories/temporary', memoryHandlers.listTemporaryMemories);
app.get('/api/memories/:id', memoryHandlers.getMemory);
app.put('/api/memories/:id', memoryHandlers.updateMemory);
app.delete('/api/memories/:id', memoryHandlers.deleteMemory);
app.post('/api/memories/:id/promote', memoryHandlers.promoteMemory);

// API Key Management endpoints
// Note: These require authentication (same level as other API routes)
// In production, you may want to add additional admin-only middleware
app.post('/api/admin/keys', apiKeyHandlers.createApiKey);
app.get('/api/admin/keys', apiKeyHandlers.listApiKeys);
app.get('/api/admin/keys/:id', apiKeyHandlers.getApiKey);
app.patch('/api/admin/keys/:id', apiKeyHandlers.updateApiKey);
app.delete('/api/admin/keys/:id', apiKeyHandlers.revokeApiKey);

// MCP Apps Admin endpoints
app.get('/api/admin/mcp-apps', mcpAppsAdminHandlers.listMcpApps);
app.get('/api/admin/mcp-apps/:appName', mcpAppsAdminHandlers.getMcpAppMetadata);
app.put('/api/admin/mcp-apps/:appName', mcpAppsAdminHandlers.uploadMcpApp);
app.delete('/api/admin/mcp-apps/:appName', mcpAppsAdminHandlers.deleteMcpApp);

// Skill Package Generation endpoints
app.post('/api/skills/generate', skillHandlers.generateSkillPackage);

// MCP endpoint — full surface (tools + resources + prompts, MCP Apps negotiated)
app.all('/mcp', async (c) => {
  try {
    return await handleMCPHttpRequest(c.env, c.req.raw, FULL_PROFILE, '/mcp');
  } catch (error) {
    console.error('MCP endpoint error:', error);
    return c.json({
      error: 'MCP server error',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// MCP endpoint — tools-only surface for hosts that ignore resources and
// prompts (e.g. Cursor, Gemini CLI). Nothing is lost: the memory:// resources
// and the workflow prompts are reprojected as tools. There is no capability
// flag for this in any protocol revision, so it is selected by URL.
app.all('/mcp/tools-only', async (c) => {
  try {
    return await handleMCPHttpRequest(c.env, c.req.raw, TOOLS_ONLY_PROFILE, '/mcp/tools-only');
  } catch (error) {
    console.error('MCP endpoint error:', error);
    return c.json({
      error: 'MCP server error',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Health check for MCP.
// The endpoint listing is derived from the server itself rather than restated
// here, so it cannot drift from what the tools actually are.
app.get('/mcp/health', (c) => {
  return c.json({
    mcp: 'ready',
    version: '1.0.0',
    endpoints: {
      '/mcp': {
        capabilities: ['tools', 'resources', 'prompts'],
        notes: 'Full surface. MCP Apps (ui:// resources) are advertised only to clients that declare the io.modelcontextprotocol/ui extension.'
      },
      '/mcp/tools-only': {
        capabilities: ['tools'],
        notes: 'For hosts that ignore resources and prompts. Both are reprojected as tools (list/read_memory_resource, list/get_workflow), so no functionality is lost.'
      }
    },
    tools: describeTools()
  });
});

export default app;