import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as tagHierarchyHandlers from './handlers/tagHierarchy';
import * as memoryHandlers from './handlers/memory';

// TODO: Import MCP server handlers
// TODO: Import database handlers

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

// TODO: Add MCP server endpoints
export default app;