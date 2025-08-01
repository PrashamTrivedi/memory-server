import { Hono } from 'hono';
import { cors } from 'hono/cors';

// TODO: Import MCP server handlers
// TODO: Import database handlers
// TODO: Import memory handlers

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

// TODO: Add MCP server endpoints
// TODO: Add memory CRUD endpoints
// TODO: Add UI static file serving

export default app;