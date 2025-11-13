# Purpose

Implement Cloudflare Zero Trust security controls to protect the memory-server application, restricting UI access to approved emails and API/MCP access to known entities only.

## Original Ask

Implement security with Cloudflare Zero Trust:
- Secure access so only known entities can read or write memories
- Restrict UI access to a handful of approved emails only
- Currently, the application has NO authentication or authorization (by design for personal use)

## Complexity and the reason behind it

**Complexity Score: 4/5**

**Reasoning:**
- **High complexity** due to multi-layered security implementation across different access points
- Requires understanding of Cloudflare Zero Trust ecosystem (Access, Service Tokens, API Shield)
- Multiple authentication methods to implement: email-based (UI) and token-based (API/MCP)
- Database schema changes needed for API key management system
- Middleware implementation for authentication and authorization
- MCP client configuration updates required (non-trivial)
- CORS policy changes that could break existing integrations if not done carefully
- Rate limiting configuration across multiple endpoints
- Security headers and audit logging implementation
- Testing across multiple authentication flows
- No breaking changes allowed - must maintain backward compatibility during transition
- Requires careful planning for key rotation and access revocation
- Need to balance security with developer experience

**Why not 5/5:**
- Cloudflare provides managed authentication (reduces complexity)
- No need to build custom OAuth flows
- Clear architectural patterns to follow
- Incremental rollout possible (can secure UI first, then API)

## Architectural changes required

### Current Architecture (Insecure)
```
┌─────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE EDGE                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           UI Worker (memory-server-ui)                 │ │
│  │           ❌ NO AUTHENTICATION                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         API Worker (memory-server)                     │ │
│  │         /api/* and /mcp endpoints                      │ │
│  │         ❌ NO AUTHENTICATION                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### New Architecture (Secured with Cloudflare Zero Trust)
```
┌─────────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE ZERO TRUST LAYER                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🔒 Cloudflare Access (Identity-Based Authentication)       │   │
│  │  - Email verification (OTP, Google, GitHub OAuth)           │   │
│  │  - Policy: Allow only approved emails                       │   │
│  │  - JWT validation on worker                                 │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
│                         │                                           │
│          ✅ Authenticated Users Only                                │
│                         ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           UI Worker (memory-server-ui)                      │   │
│  │           Protected by Cloudflare Access                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🔒 Service Auth Layer (Machine Authentication)             │   │
│  │  - Service Tokens (Cloudflare-managed)                      │   │
│  │  - Custom API Keys (database-backed)                        │   │
│  │  - Permission-based authorization (read/write/delete)       │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
│                         │                                           │
│          ✅ Known Entities Only                                     │
│                         ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │         API Worker (memory-server)                          │   │
│  │         Protected by Token Authentication + Middleware      │   │
│  │                                                              │   │
│  │  New Components:                                            │   │
│  │  - apiKeyAuth middleware                                    │   │
│  │  - requirePermission middleware                             │   │
│  │  - Audit logging system                                     │   │
│  │  - Rate limiting (per-entity)                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

New Database Tables:
┌──────────────────┐          ┌──────────────────┐
│   api_keys       │          │   audit_logs     │
├──────────────────┤          ├──────────────────┤
│ - key_hash       │          │ - timestamp      │
│ - entity_name    │          │ - entity_name    │
│ - permissions    │          │ - action         │
│ - rate_limit     │          │ - resource_type  │
│ - expires_at     │          │ - success        │
│ - is_active      │          │ - ip_address     │
└──────────────────┘          └──────────────────┘
```

### Key Architectural Changes

1. **Two-Tier Authentication System**
   - **Tier 1 (UI):** Identity-based authentication via Cloudflare Access
   - **Tier 2 (API/MCP):** Token-based authentication for machines/services

2. **New Middleware Layer**
   - Authentication middleware (`apiKeyAuth`)
   - Authorization middleware (`requirePermission`)
   - Security headers middleware
   - Audit logging middleware

3. **Database Schema Expansion**
   - Add `api_keys` table for custom API key management
   - Add `audit_logs` table for security event tracking
   - Add indexes for performance

4. **CORS Policy Hardening**
   - Remove wildcard (`*`) origins
   - Whitelist specific domains only
   - Enable credentials support with restricted origins

5. **MCP Client Architecture Change**
   - Add proxy layer to inject authentication headers
   - Update MCP client configuration with credentials
   - Support for both Service Tokens and API Keys

## Backend changes required

### Phase 1: Database Migrations

#### Migration 1: API Keys Table

**File: `migrations/0003_api_keys.sql`**

```sql
-- Create API keys table for custom API key authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT UNIQUE NOT NULL,      -- SHA-256 hash of API key
  entity_name TEXT NOT NULL,           -- Human-readable name: "Claude MCP - Laptop"
  permissions TEXT NOT NULL,           -- JSON array: ["read", "write", "delete"]
  created_at INTEGER NOT NULL,         -- Unix timestamp
  last_used_at INTEGER,                -- Unix timestamp, updated on each use
  expires_at INTEGER,                  -- Unix timestamp, NULL = never expires
  is_active INTEGER DEFAULT 1,         -- 0 = revoked, 1 = active
  rate_limit_per_hour INTEGER DEFAULT 1000,
  notes TEXT                           -- Optional notes about this key
);

-- Indexes for performance
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_entity ON api_keys(entity_name);

-- Example seed data (these key_hashes are SHA-256 of example keys)
-- In production, generate secure keys using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
INSERT INTO api_keys (key_hash, entity_name, permissions, created_at, rate_limit_per_hour, notes)
VALUES
  (
    'example_hash_1',
    'Claude MCP - Primary Laptop',
    '["read","write","delete"]',
    strftime('%s','now'),
    5000,
    'Primary development machine'
  ),
  (
    'example_hash_2',
    'Mobile App',
    '["read","write"]',
    strftime('%s','now'),
    2000,
    'Mobile client - no delete permission'
  ),
  (
    'example_hash_3',
    'CI/CD Pipeline',
    '["read"]',
    strftime('%s','now'),
    1000,
    'Read-only access for automated tests'
  );
```

#### Migration 2: Audit Logs Table

**File: `migrations/0004_audit_logs.sql`**

```sql
-- Create audit logs table for security event tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,          -- Unix timestamp
  entity_name TEXT NOT NULL,            -- From API key or JWT email
  action TEXT NOT NULL,                 -- "CREATE_MEMORY", "DELETE_MEMORY", "UPDATE_MEMORY", etc.
  resource_type TEXT NOT NULL,          -- "memory", "tag", "tag_hierarchy"
  resource_id TEXT,                     -- Memory ID, tag ID, etc.
  ip_address TEXT,                      -- CF-Connecting-IP header
  user_agent TEXT,                      -- User-Agent header
  success INTEGER NOT NULL,             -- 1 = success, 0 = failure
  error_message TEXT,                   -- Error details if success = 0
  request_path TEXT,                    -- API endpoint path
  http_method TEXT                      -- GET, POST, PUT, DELETE
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_name);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);

-- Index for time-range queries (e.g., "last 7 days")
CREATE INDEX idx_audit_logs_entity_timestamp ON audit_logs(entity_name, timestamp);
```

### Phase 2: Authentication Middleware

#### File: `src/middleware/apiKeyAuth.ts` (new)

```typescript
import { Context, Next } from 'hono';
import { createHash } from 'node:crypto';

interface ApiKey {
  id: number;
  key_hash: string;
  entity_name: string;
  permissions: string;
  is_active: number;
  rate_limit_per_hour: number;
  last_used_at: number | null;
  expires_at: number | null;
}

interface ApiKeyContext {
  id: number;
  entityName: string;
  permissions: string[];
}

/**
 * Middleware to authenticate requests using API keys
 * Expects: Authorization: Bearer <api-key>
 */
export async function apiKeyAuth(c: Context, next: Next) {
  // Extract API key from Authorization header
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: 'Missing or invalid Authorization header. Expected: Bearer <api-key>'
      },
      401
    );
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

  // Validate API key format (basic check)
  if (apiKey.length < 32) {
    return c.json(
      {
        success: false,
        error: 'Invalid API key format'
      },
      401
    );
  }

  // Hash the provided API key using SHA-256
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Query database for matching API key
  const db = c.env.DB;
  const result = await db
    .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1')
    .bind(keyHash)
    .first<ApiKey>();

  if (!result) {
    return c.json(
      {
        success: false,
        error: 'Invalid or inactive API key'
      },
      401
    );
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (result.expires_at && result.expires_at < now) {
    return c.json(
      {
        success: false,
        error: 'API key has expired'
      },
      401
    );
  }

  // Parse permissions from JSON
  let permissions: string[];
  try {
    permissions = JSON.parse(result.permissions) as string[];
  } catch (error) {
    console.error('Failed to parse permissions:', error);
    return c.json(
      {
        success: false,
        error: 'Internal server error: Invalid permissions format'
      },
      500
    );
  }

  // Update last_used_at timestamp (fire-and-forget, don't await)
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .bind(now, result.id)
    .run()
    .catch(err => console.error('Failed to update last_used_at:', err));

  // Store auth context for downstream handlers
  c.set('apiKey', {
    id: result.id,
    entityName: result.entity_name,
    permissions: permissions,
  } as ApiKeyContext);

  await next();
}

/**
 * Middleware to check if authenticated entity has required permission
 * Must be used after apiKeyAuth middleware
 */
export function requirePermission(permission: 'read' | 'write' | 'delete') {
  return async (c: Context, next: Next) => {
    const apiKey = c.get('apiKey') as ApiKeyContext | undefined;

    if (!apiKey) {
      return c.json(
        {
          success: false,
          error: 'Authentication required'
        },
        401
      );
    }

    if (!apiKey.permissions.includes(permission)) {
      return c.json(
        {
          success: false,
          error: `Insufficient permissions: '${permission}' permission required`,
          required_permission: permission,
          your_permissions: apiKey.permissions
        },
        403
      );
    }

    await next();
  };
}

/**
 * Optional: Cloudflare Service Token authentication
 * Checks CF-Access-Client-Id and CF-Access-Client-Secret headers
 */
export async function serviceTokenAuth(c: Context, next: Next) {
  const clientId = c.req.header('CF-Access-Client-Id');
  const clientSecret = c.req.header('CF-Access-Client-Secret');

  if (!clientId || !clientSecret) {
    return c.json(
      {
        success: false,
        error: 'Missing Cloudflare Access service token headers'
      },
      401
    );
  }

  // Cloudflare validates these automatically if Access policy is configured
  // If we reach here, the token is valid
  // Store service token context
  c.set('serviceToken', {
    clientId: clientId,
    entityName: `Service Token: ${clientId.substring(0, 8)}...`
  });

  await next();
}
```

### Phase 3: Audit Logging

#### File: `src/middleware/auditLog.ts` (new)

```typescript
import { Context } from 'hono';

interface AuditLogEntry {
  timestamp: number;
  entity_name: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string;
  user_agent: string;
  success: number;
  error_message: string | null;
  request_path: string;
  http_method: string;
}

/**
 * Log security and access events to audit_logs table
 */
export async function auditLog(
  db: D1Database,
  entityName: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  request: Request,
  success: boolean,
  errorMessage: string | null = null
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const ipAddress = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For') ||
                   'unknown';
  const userAgent = request.headers.get('User-Agent')?.substring(0, 500) || 'unknown';
  const url = new URL(request.url);
  const requestPath = url.pathname;
  const httpMethod = request.method;

  try {
    await db
      .prepare(`
        INSERT INTO audit_logs
        (timestamp, entity_name, action, resource_type, resource_id,
         ip_address, user_agent, success, error_message, request_path, http_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        timestamp,
        entityName,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        success ? 1 : 0,
        errorMessage,
        requestPath,
        httpMethod
      )
      .run();
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the request
    console.error('Audit logging failed:', error);
  }
}

/**
 * Helper to get entity name from context (API key or service token)
 */
export function getEntityName(c: Context): string {
  const apiKey = c.get('apiKey');
  if (apiKey) {
    return apiKey.entityName;
  }

  const serviceToken = c.get('serviceToken');
  if (serviceToken) {
    return serviceToken.entityName;
  }

  return 'unknown';
}

/**
 * Action constants for consistency
 */
export const AuditActions = {
  // Memory actions
  CREATE_MEMORY: 'CREATE_MEMORY',
  GET_MEMORY: 'GET_MEMORY',
  LIST_MEMORIES: 'LIST_MEMORIES',
  UPDATE_MEMORY: 'UPDATE_MEMORY',
  DELETE_MEMORY: 'DELETE_MEMORY',
  SEARCH_MEMORIES: 'SEARCH_MEMORIES',

  // Tag actions
  CREATE_TAG: 'CREATE_TAG',
  ADD_TAG_PARENT: 'ADD_TAG_PARENT',
  REMOVE_TAG_PARENT: 'REMOVE_TAG_PARENT',
  GET_TAG_TREE: 'GET_TAG_TREE',
  GET_TAG_ANCESTORS: 'GET_TAG_ANCESTORS',
  GET_TAG_DESCENDANTS: 'GET_TAG_DESCENDANTS',

  // Authentication actions
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILURE: 'AUTH_FAILURE',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const;
```

### Phase 4: Security Headers

#### File: `src/middleware/securityHeaders.ts` (new)

```typescript
import { Context, Next } from 'hono';

/**
 * Middleware to add security headers to all responses
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();

  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // Enable browser XSS protection
  c.header('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser features
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",  // 'unsafe-inline' needed for React
    "style-src 'self' 'unsafe-inline'",   // 'unsafe-inline' needed for styled components
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  c.header('Content-Security-Policy', csp);

  // Force HTTPS in production (HSTS)
  const environment = c.env?.ENVIRONMENT || 'development';
  if (environment === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}
```

### Phase 5: Update Main Application

#### File: `src/index.ts` (modifications)

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiKeyAuth, requirePermission } from './middleware/apiKeyAuth';
import { securityHeaders } from './middleware/securityHeaders';
import { auditLog, getEntityName, AuditActions } from './middleware/auditLog';

const app = new Hono<{ Bindings: Env }>();

// 1. Apply security headers to all routes
app.use('*', securityHeaders);

// 2. Update CORS - Remove wildcard, add specific origins
app.use('/*', cors({
  origin: [
    'https://memory-server-ui.yourworkers.dev',  // Replace with actual UI domain
    'https://memory.yourdomain.com',             // Replace with custom domain if used
    'http://localhost:5173',                     // Local UI development
    'http://localhost:8788',                     // Local UI development (alternative port)
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'CF-Access-Client-Id',      // For Cloudflare Service Tokens
    'CF-Access-Client-Secret',  // For Cloudflare Service Tokens
  ],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600,
  credentials: true,  // Allow auth headers
}));

// 3. Apply authentication to API and MCP routes
app.use('/api/*', apiKeyAuth);
app.use('/mcp', apiKeyAuth);

// 4. Apply permission checks to specific routes

// Memory routes - Write operations
app.post('/api/memories', requirePermission('write'), async (c) => {
  // ... existing handler logic ...

  // Add audit logging
  const entityName = getEntityName(c);
  const memory = /* created memory */;
  await auditLog(
    c.env.DB,
    entityName,
    AuditActions.CREATE_MEMORY,
    'memory',
    memory.id,
    c.req.raw,
    true
  );

  // ... return response
});

app.put('/api/memories/:id', requirePermission('write'), async (c) => {
  // ... existing handler logic with audit logging
});

app.delete('/api/memories/:id', requirePermission('delete'), async (c) => {
  // ... existing handler logic with audit logging
});

// Memory routes - Read operations
app.get('/api/memories', requirePermission('read'), async (c) => {
  // ... existing handler logic
});

app.get('/api/memories/:id', requirePermission('read'), async (c) => {
  // ... existing handler logic
});

app.get('/api/memories/search', requirePermission('read'), async (c) => {
  // ... existing handler logic
});

app.get('/api/memories/stats', requirePermission('read'), async (c) => {
  // ... existing handler logic
});

// Tag hierarchy routes - Apply similar pattern
// (All tag routes need appropriate permission checks)

// MCP endpoint - Needs read permission at minimum
// Individual MCP tools can check for additional permissions
app.all('/mcp', requirePermission('read'), async (c) => {
  // ... existing MCP handler logic
  // The MCP tools themselves should check for write/delete permissions
});

// Health check endpoint - No auth required
app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

export default app;
```

### Phase 6: Update Error Handlers

Both `handleMemoryError` and `handleTagHierarchyError` need to log failed attempts:

```typescript
// In src/handlers/memory.ts and src/handlers/tagHierarchy.ts

function handleMemoryError(error: unknown, c: Context<{ Bindings: Env }>) {
  // ... existing error detection logic ...

  // Log failed operation
  const entityName = getEntityName(c);
  auditLog(
    c.env.DB,
    entityName,
    'MEMORY_OPERATION_FAILED',
    'memory',
    null,
    c.req.raw,
    false,
    errorMessage
  ).catch(err => console.error('Audit log failed:', err));

  return c.json({
    success: false,
    error: errorMessage
  }, statusCode);
}
```

## Frontend changes required

### UI Worker: No Code Changes Required

The React UI will continue to work with zero code changes because:
- Cloudflare Access handles authentication before requests reach the worker
- JWT tokens are automatically added to requests by Cloudflare
- UI worker can optionally verify JWT for extra security

### Optional: UI Worker JWT Verification

If you want defense-in-depth, add JWT verification to UI worker:

#### File: `ui/src/worker.ts` (optional enhancement)

```typescript
import { verify } from '@tsndr/cloudflare-worker-jwt';

async function verifyCloudflareAccessJWT(request: Request): Promise<boolean> {
  const jwt = request.headers.get('CF-Access-JWT-Assertion');
  if (!jwt) return false;

  try {
    // Your Cloudflare Access team domain
    const teamDomain = 'yourteam.cloudflareaccess.com'; // Replace with actual domain

    // Verify JWT signature
    const isValid = await verify(jwt, {
      issuer: `https://${teamDomain}`,
      // Additional validation can be added here
    });

    return isValid;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return false;
  }
}

// In your worker's fetch handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Optional: Verify JWT
    if (env.ENVIRONMENT === 'production') {
      const isAuthenticated = await verifyCloudflareAccessJWT(request);
      if (!isAuthenticated) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // ... rest of worker logic
  }
}
```

### MCP Client Configuration

**Update Claude Desktop configuration** (or equivalent MCP client):

#### File: `~/.config/Claude/claude_desktop_config.json`

**Option 1: Using API Keys (Simpler)**
```json
{
  "mcpServers": {
    "memory-server": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-everything",
        "http://localhost:8788/mcp"
      ],
      "env": {
        "HTTP_AUTHORIZATION": "Bearer msk_your_api_key_here_32chars_minimum"
      }
    }
  }
}
```

**Option 2: Using Node.js Proxy (For Service Tokens or Complex Auth)**

Create proxy script: `~/mcp-memory-proxy.js`

```javascript
#!/usr/bin/env node
const http = require('http');
const https = require('https');
const { URL } = require('url');

const API_URL = process.env.API_URL || 'https://memory-server.yourworkers.dev/mcp';
const API_KEY = process.env.API_KEY;
const CF_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID;
const CF_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET;

// Create proxy server that adds auth headers
const server = http.createServer((req, res) => {
  const targetUrl = new URL(API_URL);

  // Build headers with authentication
  const headers = {
    ...req.headers,
    host: targetUrl.host,
  };

  // Add API key if provided
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  // Add Cloudflare Service Token if provided
  if (CF_CLIENT_ID && CF_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = CF_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = CF_CLIENT_SECRET;
  }

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: targetUrl.pathname + (req.url?.slice(1) || ''),
    method: req.method,
    headers: headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

const PORT = 8788;
server.listen(PORT, () => {
  console.log(`MCP proxy listening on http://localhost:${PORT}`);
  console.log(`Forwarding to: ${API_URL}`);
});
```

Then update Claude Desktop config:

```json
{
  "mcpServers": {
    "memory-server": {
      "command": "node",
      "args": ["/path/to/mcp-memory-proxy.js"],
      "env": {
        "API_URL": "https://memory-server.yourworkers.dev/mcp",
        "API_KEY": "msk_your_api_key_here"
      }
    }
  }
}
```

## Cloudflare Zero Trust Configuration

### Step 1: Enable Zero Trust

1. Go to **Cloudflare Dashboard** → **Zero Trust**
2. If first time: Complete onboarding, choose team name
3. Note your team domain: `yourteam.cloudflareaccess.com`

### Step 2: Configure Authentication Methods

1. Go to **Settings** → **Authentication** → **Login methods**
2. Enable desired providers:
   - ✅ **One-time PIN** (email OTP) - Free, works for any email
   - ✅ **Google Workspace** - If your team uses Google
   - ✅ **GitHub** - Good for developer teams
   - ✅ **Microsoft Azure AD** - For enterprise

### Step 3: Create Access Application for UI

1. Go to **Access** → **Applications** → **Add an application**
2. Choose **Self-hosted**
3. Configure:
   - **Name:** Memory Server UI
   - **Session Duration:** 24 hours
   - **Application Domain:**
     - `memory-server-ui.yourworkers.dev` (workers.dev domain)
     - OR `memory.yourdomain.com` (custom domain)
   - **Accept all available identity providers:** ✅

4. Click **Next** to create policy

### Step 4: Create Access Policy for UI

1. **Policy name:** Approved Users Only
2. **Action:** Allow
3. **Configure rules:**
   - Click **Add rule** → **Include**
   - Select **Emails** and enter:
     ```
     user1@example.com
     user2@example.com
     user3@example.com
     ```
   - Alternative: Use **Emails ending in** for domain-based access
     ```
     @yourcompany.com
     ```

4. Optional: Add **Require** rule for additional security:
   - Email verification ✅
   - Country: Your country (optional)
   - IP ranges: Your office/home IPs (optional)

5. Click **Save policy** → **Done**

### Step 5: Create Service Tokens for API/MCP

1. Go to **Access** → **Service Auth** → **Service Tokens**
2. Click **Create Service Token**
3. Create tokens for each known entity:

**Token 1: Claude MCP Client**
- **Name:** Claude MCP - Personal Laptop
- Click **Generate token**
- **IMPORTANT:** Copy `Client ID` and `Client Secret` immediately
- Store securely (1Password, environment variables, etc.)

**Token 2: Mobile App**
- **Name:** Memory Server Mobile App
- Generate and store credentials

**Token 3: CI/CD**
- **Name:** CI/CD Pipeline
- Generate and store credentials

### Step 6: Create Service Token Policy for API

1. Go to **Access** → **Applications** → **Add an application**
2. Choose **Self-hosted**
3. Configure:
   - **Name:** Memory Server API
   - **Application Domain:** `memory-server.yourworkers.dev`
   - **Path:** `/api`, `/mcp` (add both paths)

4. Create policy:
   - **Policy name:** Authorized Services Only
   - **Action:** Allow
   - **Include:**
     - **Selector:** Service Token
     - Select all created service tokens:
       - ✅ Claude MCP - Personal Laptop
       - ✅ Memory Server Mobile App
       - ✅ CI/CD Pipeline

5. Click **Save**

### Step 7: Rate Limiting (Optional but Recommended)

1. Go to **Security** → **WAF** → **Rate limiting rules**
2. Create rules:

**Rule 1: UI Rate Limit**
```yaml
Rule Name: Memory UI Rate Limit
If incoming requests match:
  - Field: Hostname
  - Operator: equals
  - Value: memory-server-ui.yourworkers.dev
Then:
  - Requests: 100
  - Period: 1 minute
  - Action: Block
  - Duration: 1 hour
```

**Rule 2: API Rate Limit**
```yaml
Rule Name: Memory API Rate Limit
If incoming requests match:
  - Field: URI Path
  - Operator: starts with
  - Value: /api/
Then:
  - Requests: 1000
  - Period: 1 hour
  - Action: Challenge (CAPTCHA)
```

**Rule 3: MCP Rate Limit**
```yaml
Rule Name: Memory MCP Rate Limit
If incoming requests match:
  - Field: URI Path
  - Operator: equals
  - Value: /mcp
Then:
  - Requests: 500
  - Period: 1 hour
  - Action: Block
  - Duration: 1 hour
```

## Validation

### Pre-Deployment Testing

#### 1. Local Development Testing

**Start development environment:**
```bash
# Terminal 1: Start API worker
npm run dev

# Terminal 2: Start UI worker
cd ui && npm run worker:dev

# Terminal 3: Run type checking
npm run type-check
```

**Test API key authentication locally:**
```bash
# Generate test API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123def456... (example key)

# Hash it for database
node -e "console.log(require('crypto').createHash('sha256').update('abc123def456...').digest('hex'))"
# Output: hash123... (save this in database)

# Insert into local database
wrangler d1 execute memory-db --local --command \
  "INSERT INTO api_keys (key_hash, entity_name, permissions, created_at) \
   VALUES ('hash123...', 'Test Key', '[\"read\",\"write\",\"delete\"]', strftime('%s','now'))"

# Test authenticated request
curl http://localhost:8787/api/memories \
  -H "Authorization: Bearer abc123def456..."
# Expected: 200 OK with memories list

# Test unauthenticated request
curl http://localhost:8787/api/memories
# Expected: 401 Unauthorized

# Test insufficient permissions
# (Create a read-only key first)
curl -X DELETE http://localhost:8787/api/memories/some-id \
  -H "Authorization: Bearer read_only_key"
# Expected: 403 Forbidden
```

#### 2. Database Migration Testing

```bash
# Apply migrations to local database
wrangler d1 migrations apply memory-db --local

# Verify tables created
wrangler d1 execute memory-db --local --command \
  "SELECT name FROM sqlite_master WHERE type='table'"
# Expected output should include: api_keys, audit_logs

# Verify indexes created
wrangler d1 execute memory-db --local --command \
  "SELECT name FROM sqlite_master WHERE type='index'"
# Expected: idx_api_keys_hash, idx_api_keys_active, idx_audit_logs_timestamp, etc.
```

#### 3. Audit Logging Testing

```bash
# Perform some operations with API key
curl -X POST http://localhost:8787/api/memories \
  -H "Authorization: Bearer abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","content":"Test content","tags":["test"]}'

# Check audit logs
wrangler d1 execute memory-db --local --command \
  "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5"
# Expected: Should show CREATE_MEMORY action with entity_name, ip_address, etc.

# Test failed authentication logging
curl http://localhost:8787/api/memories \
  -H "Authorization: Bearer invalid_key"

# Check for failed auth in logs
wrangler d1 execute memory-db --local --command \
  "SELECT * FROM audit_logs WHERE success = 0 ORDER BY timestamp DESC LIMIT 1"
```

### Production Deployment Testing

#### 1. Deploy to Production

```bash
# Run database migrations on production
wrangler d1 migrations apply memory-db --remote

# Deploy API worker
npm run deploy

# Deploy UI worker
cd ui && npm run worker:deploy

# Verify deployment
curl https://memory-server.yourworkers.dev/health
# Expected: {"status":"healthy"}
```

#### 2. Test Cloudflare Access (UI)

**Test unauthenticated access (should redirect to login):**
```bash
curl -I https://memory-server-ui.yourworkers.dev
# Expected: 302 Redirect to Cloudflare Access login page
```

**Test authenticated access:**
1. Open https://memory-server-ui.yourworkers.dev in browser
2. Should see Cloudflare Access login page
3. Enter approved email address
4. Verify OTP code from email
5. Should successfully access UI
6. Check browser DevTools → Network → Headers for `CF-Access-JWT-Assertion`

**Test unauthorized email:**
1. Try logging in with non-approved email
2. Expected: Access denied message from Cloudflare

#### 3. Test Service Tokens (API)

**Test without token:**
```bash
curl https://memory-server.yourworkers.dev/api/memories
# Expected: 401 Unauthorized
```

**Test with valid Service Token:**
```bash
curl https://memory-server.yourworkers.dev/api/memories \
  -H "CF-Access-Client-Id: <your-client-id>" \
  -H "CF-Access-Client-Secret: <your-client-secret>"
# Expected: 200 OK (if Cloudflare Access policy configured)
#           OR 401 (if not using Cloudflare Access, will hit API key auth)
```

**Test with API Key:**
```bash
# First, generate and insert production API key
# (Use secure process, don't log the actual key)

curl https://memory-server.yourworkers.dev/api/memories \
  -H "Authorization: Bearer <your-production-api-key>"
# Expected: 200 OK with memories list
```

#### 4. Test MCP Integration

**Update MCP client config** with production API key or service token

**Test MCP connection:**
```bash
# Using MCP Inspector
# 1. Open https://modelcontextprotocol.io/inspector
# 2. Connect to your proxy: http://localhost:8788
# 3. Verify proxy forwards to production with auth headers
# 4. Test each MCP tool:
#    - add_memory
#    - get_memory
#    - list_memories
#    - find_memories
#    - delete_memory
#    - update_url_content
#    - add_tags
```

**Test with Claude Desktop:**
1. Restart Claude Desktop to reload config
2. Try creating a memory: "Add a memory about testing security"
3. Expected: Should successfully create memory
4. Verify in UI or via curl that memory was created

#### 5. Test Permission Enforcement

**Test read-only key attempting write:**
```bash
# Create read-only API key first
# Then test:
curl -X POST https://memory-server.yourworkers.dev/api/memories \
  -H "Authorization: Bearer <read-only-key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","content":"Test","tags":[]}'
# Expected: 403 Forbidden with permission error message
```

**Test delete permission:**
```bash
# With key that has write but not delete
curl -X DELETE https://memory-server.yourworkers.dev/api/memories/<memory-id> \
  -H "Authorization: Bearer <no-delete-key>"
# Expected: 403 Forbidden
```

#### 6. Test Rate Limiting

**Test UI rate limit (if configured):**
```bash
# Send 101 requests in quick succession
for i in {1..101}; do
  curl -s https://memory-server-ui.yourworkers.dev > /dev/null
  echo "Request $i"
done
# Expected: Requests 1-100 succeed or redirect, request 101+ get blocked/rate limited
```

**Test API rate limit:**
```bash
# Send many requests with API key
for i in {1..1001}; do
  curl -s https://memory-server.yourworkers.dev/api/memories \
    -H "Authorization: Bearer <api-key>" > /dev/null
  echo "Request $i"
done
# Expected: First 1000 succeed, 1001+ get rate limited (depending on your configuration)
```

#### 7. Test Security Headers

```bash
curl -I https://memory-server.yourworkers.dev/health
# Verify response includes:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
# Content-Security-Policy: default-src 'self'; ...
# Strict-Transport-Security: max-age=31536000 (in production)
```

#### 8. Test CORS

**Test from allowed origin:**
```bash
curl https://memory-server.yourworkers.dev/api/memories \
  -H "Origin: https://memory-server-ui.yourworkers.dev" \
  -H "Authorization: Bearer <api-key>" \
  -I
# Expected: Access-Control-Allow-Origin: https://memory-server-ui.yourworkers.dev
```

**Test from disallowed origin:**
```bash
curl https://memory-server.yourworkers.dev/api/memories \
  -H "Origin: https://evil.com" \
  -H "Authorization: Bearer <api-key>" \
  -I
# Expected: No Access-Control-Allow-Origin header (CORS blocked)
```

### Monitoring and Alerts

#### 1. View Cloudflare Access Logs

1. Go to **Zero Trust** → **Logs** → **Access**
2. Filter by:
   - **Application:** Memory Server UI
   - **Date range:** Last 24 hours
3. Verify:
   - ✅ Successful authentications for approved users
   - ✅ Blocked attempts for unauthorized users
   - ✅ No suspicious patterns

#### 2. Query Audit Logs

```bash
# View recent audit logs
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name, action, resource_type, success, timestamp
   FROM audit_logs
   ORDER BY timestamp DESC
   LIMIT 20"

# View failed operations
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name, action, error_message, timestamp
   FROM audit_logs
   WHERE success = 0
   ORDER BY timestamp DESC
   LIMIT 10"

# View activity by entity
wrangler d1 execute memory-db --remote --command \
  "SELECT action, COUNT(*) as count
   FROM audit_logs
   WHERE entity_name = 'Claude MCP - Personal Laptop'
   GROUP BY action"
```

#### 3. Monitor API Key Usage

```bash
# Check last used timestamps
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name,
          datetime(last_used_at, 'unixepoch') as last_used,
          is_active
   FROM api_keys
   ORDER BY last_used_at DESC"

# Check for expired keys still active
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name, datetime(expires_at, 'unixepoch') as expires
   FROM api_keys
   WHERE expires_at < strftime('%s', 'now')
   AND is_active = 1"
```

### Success Criteria Checklist

**Authentication & Authorization:**
- [ ] ✅ UI requires email authentication via Cloudflare Access
- [ ] ✅ Only approved emails can access UI
- [ ] ✅ API/MCP endpoints require API key or Service Token
- [ ] ✅ Invalid/missing credentials return 401 Unauthorized
- [ ] ✅ Insufficient permissions return 403 Forbidden
- [ ] ✅ Permission checks work correctly (read/write/delete)

**Database & Migrations:**
- [ ] ✅ `api_keys` table created with correct schema
- [ ] ✅ `audit_logs` table created with correct schema
- [ ] ✅ All indexes created for performance
- [ ] ✅ No migration errors in production

**Security Features:**
- [ ] ✅ Security headers present in all responses
- [ ] ✅ CORS restricted to allowed origins only
- [ ] ✅ Rate limiting configured and working
- [ ] ✅ HTTPS enforced in production (HSTS header)
- [ ] ✅ API keys stored as hashes, not plaintext

**Audit Logging:**
- [ ] ✅ All memory operations logged
- [ ] ✅ Authentication failures logged
- [ ] ✅ Permission denials logged
- [ ] ✅ Logs include IP address and user agent
- [ ] ✅ Failed operations have error messages

**MCP Integration:**
- [ ] ✅ MCP client configured with authentication
- [ ] ✅ All MCP tools work with authentication
- [ ] ✅ Claude Desktop can create/read/update/delete memories
- [ ] ✅ MCP operations require appropriate permissions

**Backward Compatibility:**
- [ ] ✅ No breaking changes to API responses
- [ ] ✅ UI functionality unchanged (just auth added)
- [ ] ✅ Type checking passes with no new errors
- [ ] ✅ All existing features still work

**Monitoring & Operations:**
- [ ] ✅ Cloudflare Access logs show authentication events
- [ ] ✅ Audit logs query successfully
- [ ] ✅ API key last_used_at updates correctly
- [ ] ✅ Can revoke API keys (set is_active = 0)
- [ ] ✅ Can rotate API keys without downtime

### Post-Deployment Verification Timeline

**Day 1:**
- Monitor authentication logs every 2 hours
- Check for any 401/403 errors from legitimate users
- Verify audit logs are recording correctly
- Test MCP integration from all configured clients

**Week 1:**
- Daily review of audit logs for suspicious patterns
- Check API key usage patterns
- Verify rate limiting is appropriate (not too strict/loose)
- Collect user feedback on authentication experience

**Month 1:**
- Weekly security log review
- Review and rotate any temporary/test API keys
- Audit list of approved emails, remove any departed users
- Check for any unused API keys (last_used_at is old)
- Review rate limiting effectiveness

**Quarterly:**
- Full security audit
- Review and update Cloudflare Access policies
- Rotate long-lived API keys
- Review audit logs for anomalies
- Update documentation

### Troubleshooting Common Issues

**Issue: UI redirects to login but returns error after authentication**
- **Cause:** Cloudflare Access policy misconfigured or email not in approved list
- **Fix:** Check Access policy rules, verify email is exactly correct (case-sensitive)

**Issue: API returns 401 even with valid API key**
- **Cause:** API key not hashed correctly or not in database
- **Fix:** Verify key hash matches database, check key hasn't expired

**Issue: MCP client can't connect**
- **Cause:** Proxy not running, incorrect URL, or auth headers not being sent
- **Fix:** Check proxy logs, verify API_KEY env var is set, test curl with same credentials

**Issue: Rate limiting blocking legitimate traffic**
- **Cause:** Limits set too low for actual usage patterns
- **Fix:** Review rate limiting rules, increase limits or change to Challenge instead of Block

**Issue: CORS errors from UI**
- **Cause:** UI domain not in allowed origins list
- **Fix:** Add UI worker domain to CORS configuration in src/index.ts

**Issue: Audit logs not recording**
- **Cause:** Database write errors or audit_logs table doesn't exist
- **Fix:** Check wrangler logs for errors, verify migrations applied, check D1 database status

## Implementation Timeline

### Week 1: Foundation (Database & Middleware)
- **Day 1-2:** Create and test database migrations locally
  - [ ] Create `migrations/0003_api_keys.sql`
  - [ ] Create `migrations/0004_audit_logs.sql`
  - [ ] Test migrations with `wrangler d1 migrations apply --local`
  - [ ] Verify table schemas and indexes

- **Day 3:** Implement authentication middleware
  - [ ] Create `src/middleware/apiKeyAuth.ts`
  - [ ] Create `src/middleware/securityHeaders.ts`
  - [ ] Write unit tests for middleware

- **Day 4:** Implement audit logging
  - [ ] Create `src/middleware/auditLog.ts`
  - [ ] Test audit log writes
  - [ ] Verify log queries work

- **Day 5:** Update main application
  - [ ] Modify `src/index.ts` to use middleware
  - [ ] Update CORS configuration
  - [ ] Test locally with curl

### Week 2: Cloudflare Access & UI Protection
- **Day 1:** Set up Cloudflare Zero Trust
  - [ ] Enable Zero Trust in Cloudflare dashboard
  - [ ] Configure authentication providers (OTP, Google, GitHub)
  - [ ] Note team domain for later use

- **Day 2:** Create Access application for UI
  - [ ] Create Access application for UI worker domain
  - [ ] Create Access policy with approved emails
  - [ ] Test policy with curl (should get redirect)

- **Day 3-4:** Deploy and test UI authentication
  - [ ] Deploy UI worker to production
  - [ ] Test login flow with approved email
  - [ ] Test rejection of unauthorized email
  - [ ] Verify JWT headers present after login

- **Day 5:** Optional JWT verification in UI worker
  - [ ] Implement JWT verification in `ui/src/worker.ts`
  - [ ] Test double authentication
  - [ ] Document security benefits

### Week 3: API Protection & MCP Integration
- **Day 1:** Generate production API keys
  - [ ] Generate secure API keys for each entity
  - [ ] Hash keys with SHA-256
  - [ ] Insert into production database
  - [ ] Store keys securely (1Password, etc.)
  - [ ] Document key distribution process

- **Day 2:** Create Service Tokens
  - [ ] Create Service Tokens in Cloudflare Access
  - [ ] Create Access policy for API worker
  - [ ] Test Service Token authentication
  - [ ] Document token usage

- **Day 3:** Deploy API worker with authentication
  - [ ] Apply migrations to production database
  - [ ] Deploy updated API worker
  - [ ] Test API key authentication
  - [ ] Test permission checks
  - [ ] Verify audit logging works

- **Day 4:** Configure MCP clients
  - [ ] Update Claude Desktop config with API key
  - [ ] Create MCP proxy script if needed
  - [ ] Test MCP connection
  - [ ] Test all MCP tools

- **Day 5:** End-to-end testing
  - [ ] Test UI → API flow
  - [ ] Test MCP → API flow
  - [ ] Test permission boundaries
  - [ ] Test error cases

### Week 4: Hardening & Monitoring
- **Day 1:** Configure rate limiting
  - [ ] Create rate limiting rules for UI
  - [ ] Create rate limiting rules for API
  - [ ] Create rate limiting rules for MCP
  - [ ] Test rate limits

- **Day 2:** Security headers and CORS
  - [ ] Verify security headers in production
  - [ ] Test CORS from allowed origins
  - [ ] Test CORS blocking from unknown origins
  - [ ] Verify CSP doesn't break UI

- **Day 3:** Set up monitoring
  - [ ] Configure Cloudflare notifications
  - [ ] Create audit log query scripts
  - [ ] Set up alerts for failed auth
  - [ ] Document monitoring procedures

- **Day 4:** Documentation and training
  - [ ] Document security architecture
  - [ ] Create API key management procedures
  - [ ] Write user guide for approved users
  - [ ] Create troubleshooting guide

- **Day 5:** Security review and sign-off
  - [ ] Full security testing
  - [ ] Review all success criteria
  - [ ] Address any remaining issues
  - [ ] Get sign-off from stakeholders

## Cost Estimate

### Cloudflare Zero Trust Pricing

**Free Tier (Recommended for this use case):**
- ✅ Up to 50 users/month
- ✅ Unlimited applications
- ✅ Service Tokens (no additional cost)
- ✅ Access logs (7-day retention)
- ✅ Rate limiting rules (included)
- ✅ API Shield (basic features)

**Total Estimated Cost: $0/month** (assuming < 50 users and standard Workers pricing)

**Paid Tier (if needed): $7/user/month**
- Extended log retention (30 days)
- Advanced security features
- More authentication providers
- Priority support

**Workers Pricing:**
- Already paying for Workers (existing deployment)
- No additional cost for authentication logic
- D1 database: Free tier sufficient for audit logs

## Security Maintenance

### Daily Tasks
- [ ] Monitor Cloudflare Access logs for suspicious login attempts
- [ ] Check audit logs for failed API operations
- [ ] Review rate limiting events

### Weekly Tasks
- [ ] Review audit logs for unusual patterns
- [ ] Check API key last_used_at timestamps (identify stale keys)
- [ ] Review list of approved emails (add/remove as needed)
- [ ] Monitor error rates in Workers analytics

### Monthly Tasks
- [ ] Review and rotate temporary/test API keys
- [ ] Audit Service Tokens (revoke unused ones)
- [ ] Review rate limiting effectiveness
- [ ] Check for expired but still-active API keys
- [ ] Update security documentation

### Quarterly Tasks
- [ ] Full security audit
- [ ] Penetration testing (if required)
- [ ] Review and update Access policies
- [ ] Rotate long-lived API keys
- [ ] Review and update rate limiting rules
- [ ] Update incident response procedures

### Annual Tasks
- [ ] Comprehensive security review
- [ ] Update security policies and documentation
- [ ] Disaster recovery drill
- [ ] Third-party security assessment
- [ ] Review and renew mTLS certificates (if using)

## API Key Management Procedures

### Generating New API Keys

```bash
# 1. Generate secure random key
node -e "console.log('msk_' + require('crypto').randomBytes(32).toString('hex'))"
# Output: msk_abc123def456... (give to user)

# 2. Hash the key for database storage
node -e "const key='msk_abc123def456...'; console.log(require('crypto').createHash('sha256').update(key).digest('hex'))"
# Output: hash123... (store in database)

# 3. Insert into database
wrangler d1 execute memory-db --remote --command \
  "INSERT INTO api_keys (key_hash, entity_name, permissions, created_at, rate_limit_per_hour, notes) \
   VALUES ('hash123...', 'User Name - Device', '[\"read\",\"write\"]', strftime('%s','now'), 2000, 'Created on 2025-11-13')"

# 4. Securely transmit key to user (1Password share, encrypted email, etc.)
# 5. User confirms key works
# 6. Delete the plaintext key from your system
```

### Rotating API Keys

```bash
# 1. Generate new key (same process as above)
# 2. Give new key to user
# 3. User confirms new key works
# 4. Deactivate old key (don't delete - keep for audit trail)
wrangler d1 execute memory-db --remote --command \
  "UPDATE api_keys SET is_active = 0 WHERE key_hash = 'old_hash_here'"
```

### Revoking API Keys

```bash
# Immediate revocation (user lost device, security incident, etc.)
wrangler d1 execute memory-db --remote --command \
  "UPDATE api_keys SET is_active = 0 WHERE entity_name = 'User Name - Device'"

# Verify revocation worked
curl https://memory-server.yourworkers.dev/api/memories \
  -H "Authorization: Bearer <revoked-key>"
# Expected: 401 Unauthorized
```

### Checking API Key Usage

```bash
# List all keys with usage info
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name,
          datetime(created_at, 'unixepoch') as created,
          datetime(last_used_at, 'unixepoch') as last_used,
          is_active,
          permissions
   FROM api_keys
   ORDER BY last_used_at DESC"

# Find unused keys (never used or > 30 days)
wrangler d1 execute memory-db --remote --command \
  "SELECT entity_name,
          datetime(created_at, 'unixepoch') as created,
          datetime(last_used_at, 'unixepoch') as last_used
   FROM api_keys
   WHERE (last_used_at IS NULL OR last_used_at < strftime('%s', 'now', '-30 days'))
   AND is_active = 1"
```

## Next Steps & Recommendations

### Immediate Priority (Start Here)
1. **Review this plan** - Ensure you understand all components
2. **Decide on authentication approach** - Hybrid (Service Tokens + API Keys) recommended
3. **Get approval** - Confirm list of approved emails for UI access
4. **Begin Week 1 implementation** - Database migrations and middleware

### Future Enhancements (Post-Implementation)
1. **Advanced Rate Limiting** - Per-entity rate limiting with token bucket algorithm
2. **API Key Scoping** - Restrict keys to specific resources (e.g., only certain tags)
3. **WebAuthn Support** - Add hardware key authentication for UI
4. **IP Whitelisting** - Add IP-based restrictions for extra security
5. **Anomaly Detection** - Alert on unusual access patterns
6. **Read-Only Mode** - Emergency mode to prevent writes during incidents
7. **Backup Authentication** - Recovery codes for emergency access

### Integration Considerations
- **Mobile App** - Will need API key authentication
- **Browser Extensions** - Consider OAuth flow for better UX
- **Third-Party Integrations** - Use Service Tokens with minimal permissions
- **Webhooks** - If adding webhooks, they'll need webhook-specific authentication

## Conclusion

This plan provides a comprehensive, production-ready security implementation for memory-server using Cloudflare Zero Trust. The phased approach allows for incremental rollout, minimizing risk and allowing for testing at each stage.

**Key Benefits:**
- ✅ Zero Trust architecture with continuous verification
- ✅ No code required for UI authentication (Cloudflare handles it)
- ✅ Flexible API authentication supporting multiple methods
- ✅ Complete audit trail for compliance
- ✅ Fine-grained permission system (read/write/delete)
- ✅ Rate limiting to prevent abuse
- ✅ No additional cost for typical use case (< 50 users)
- ✅ Incremental rollout possible (can secure UI first, then API)

**Implementation Effort:**
- 4 weeks full-time (1 person)
- 2 weeks part-time (dedicated 20 hrs/week)
- Complexity: 4/5 (Medium-High)

Ready to begin implementation when you give the approval!
