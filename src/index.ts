import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as tagHierarchyHandlers from './handlers/tagHierarchy';
import * as memoryHandlers from './handlers/memory';
import { handleMCPHttpRequest } from './mcp/server';

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  BROWSER: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for React UI
app.use('*', cors());

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    message: 'Memory Server API',
    version: '1.0.0',
    status: 'healthy'
  });
});

// Tag Hierarchy API endpoints
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
app.get('/api/memories/:id', memoryHandlers.getMemory);
app.put('/api/memories/:id', memoryHandlers.updateMemory);
app.delete('/api/memories/:id', memoryHandlers.deleteMemory);

// MCP endpoint - supports all MCP operations
app.all('/mcp', async (c) => {
  try {
    return await handleMCPHttpRequest(c.env, c.req.raw);
  } catch (error) {
    console.error('MCP endpoint error:', error);
    return c.json({
      error: 'MCP server error',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Agent SDK enhanced endpoints
app.get('/mcp/agent/capabilities', async (c) => {
  try {
    return await handleMCPHttpRequest(c.env, c.req.raw);
  } catch (error) {
    console.error('Agent capabilities error:', error);
    return c.json({ error: 'Agent capabilities error' }, 500);
  }
});

app.get('/mcp/agent/config', async (c) => {
  try {
    return await handleMCPHttpRequest(c.env, c.req.raw);
  } catch (error) {
    console.error('Agent config error:', error);
    return c.json({ error: 'Agent config error' }, 500);
  }
});

// Health check for MCP with agent support
app.get('/mcp/health', (c) => {
  return c.json({
    mcp: 'ready',
    version: '1.0.0',
    capabilities: ['tools', 'resources', 'prompts'],
    agentSdk: {
      enabled: true,
      version: '1.0.0',
      features: ['batch-requests', 'session-management', 'capabilities-negotiation']
    },
    tools: [
      'add_memory',
      'get_memory', 
      'list_memories',
      'delete_memory',
      'find_memories',
      'add_tags',
      'update_url_content'
    ],
    endpoints: {
      mcp: '/mcp',
      capabilities: '/mcp/agent/capabilities',
      config: '/mcp/agent/config',
      health: '/mcp/health'
    }
  });
});

export default app;